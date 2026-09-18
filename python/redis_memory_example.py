"""
使用 langchain_community 的 Redis 保存聊天记忆的示例
（不需要 RedisSearch 模块）
"""
# 忽略 urllib3 SSL 警告
import warnings
warnings.filterwarnings("ignore", message="urllib3 v2 only supports OpenSSL 1.1.1+")

from langchain.agents import AgentExecutor, create_tool_calling_agent, tool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_ollama import ChatOllama
from langchain_community.chat_message_histories.redis import RedisChatMessageHistory

# 定义一个工具
@tool
def get_weather(city: str) -> str:
    """获取指定城市的天气信息。"""
    return f"{city}的天气总是晴朗的！"

# 初始化模型
model = ChatOllama(
    model="qwen3:4b",
    numCtx=4096,
)

# 创建提示模板
prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "你是一个有用的助手"),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ]
)

# 创建 Agent
agent = create_tool_calling_agent(model, [get_weather], prompt)
agent_executor = AgentExecutor(agent=agent, tools=[get_weather], verbose=True)

# 初始化 Redis 历史记录
def get_session_history(session_id: str) -> RedisChatMessageHistory:
    """获取或创建基于 Redis 的聊天历史记录"""
    return RedisChatMessageHistory(
        session_id=session_id,
        url="redis://localhost:6379/0",  # 本地 Redis，默认端口 6379，数据库 0
    )

# 使用消息历史包装 Agent
agent_with_history = RunnableWithMessageHistory(
    agent_executor,
    get_session_history,
    input_messages_key="input",
    history_messages_key="chat_history",
)

# 运行测试
if __name__ == "__main__":
    print("=== 第一条消息 ===")
    response1 = agent_with_history.invoke(
        {"input": "我的名字是 Alice"},
        config={"configurable": {"session_id": "session_1"}}
    )
    print(response1["output"])

    print("\n=== 第二条消息（应该从 Redis 中记住名字）===")
    response2 = agent_with_history.invoke(
        {"input": "我叫什么名字？"},
        config={"configurable": {"session_id": "session_1"}}
    )
    print(response2["output"])

    print("\n=== 不同的会话（不应该记住）===")
    response3 = agent_with_history.invoke(
        {"input": "我叫什么名字？"},
        config={"configurable": {"session_id": "session_2"}}
    )
    print(response3["output"])

    print("\n=== 使用天气工具 ===")
    response4 = agent_with_history.invoke(
        {"input": "Alice，北京的天气怎么样？"},
        config={"configurable": {"session_id": "session_1"}}
    )
    print(response4["output"])

    print("\n=== 检查 Redis 中的会话 1 历史记录 ===")
    history1 = get_session_history("session_1")
    print(f"会话 1 在 Redis 中有 {len(history1.messages)} 条消息：")
    for i, msg in enumerate(history1.messages):
        print(f"  {i+1}. {msg.type}: {msg.content[:50]}...")

    print("\n=== 清除会话 1 的历史记录 ===")
    history1.clear()
    print(f"会话 1 现在在 Redis 中有 {len(history1.messages)} 条消息")
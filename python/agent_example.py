# pip install -qU langchain "langchain[anthropic]"
from langchain.agents import AgentExecutor, create_tool_calling_agent, tool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_ollama import ChatOllama

@tool
def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"It's always sunny in {city}!"

model = ChatOllama(
    model="qwen3:4b",
    numCtx=4096,
)

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "You are a helpful assistant"),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ]
)

agent = create_tool_calling_agent(model, [get_weather], prompt)
agent_executor = AgentExecutor(agent=agent, tools=[get_weather], verbose=True)

# Create a session storage for conversation history using InMemoryChatMessageHistory
store = {}

def get_session_history(session_id: str) -> InMemoryChatMessageHistory:
    if session_id not in store:
        store[session_id] = InMemoryChatMessageHistory()
    return store[session_id]

# Wrap the agent executor with message history
agent_with_history = RunnableWithMessageHistory(
    agent_executor,
    get_session_history,
    input_messages_key="input",
    history_messages_key="chat_history",
)

# Run the agent with memory
print("=== First message ===")
response1 = agent_with_history.invoke(
    {"input": "My name is Alice"},
    config={"configurable": {"session_id": "session_1"}}
)
print(response1["output"])

print("\n=== Second message (should remember name) ===")
response2 = agent_with_history.invoke(
    {"input": "What's my name?"},
    config={"configurable": {"session_id": "session_1"}}
)
print(response2["output"])

print("\n=== Different session (should not remember) ===")
response3 = agent_with_history.invoke(
    {"input": "What's my name?"},
    config={"configurable": {"session_id": "session_2"}}
)
print(response3["output"])

print("\n=== Using weather tool ===")
response4 = agent_with_history.invoke(
    {"input": "Alice, what is the weather in Beijing?"},
    config={"configurable": {"session_id": "session_1"}}
)
print(response4["output"])

print("\n=== Check session 1 history ===")
print(f"Session 1 has {len(store['session_1'].messages)} messages:")
for i, msg in enumerate(store['session_1'].messages):
    print(f"  {i+1}. {msg.type}: {msg.content[:50]}...")

print("\n=== Clear session 1 history ===")
store['session_1'].clear()
print(f"Session 1 now has {len(store['session_1'].messages)} messages")


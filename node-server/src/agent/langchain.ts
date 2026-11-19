/**
 * LangChain 版 agent：用 `createAgent` 组装「模型 + 工具 + 中间件 + checkpointer」。
 *
 * ══ 调用链路 ══════════════════════════════════════════════════════════════
 *
 *   ① 入口
 *      WebsocketGateway（收到 type=5 聊天消息）
 *        └─ invokeAgent(content, sessionId ?? client.id, client.id)      ← 本文件
 *           └─ invokeAgentWith(getAgent(), message, threadId, wsClientId) ← shared.ts
 *              ├─ runWithAgentContext(wsClientId ?? threadId ?? '', ...)  写 AsyncLocalStorage，
 *              │                                                          供工具读「当前是哪个连接」
 *              ├─ buildAgentConfig(threadId)   → { recursionLimit: 25, configurable: { thread_id } }
 *              └─ agent.invoke({ messages: [HumanMessage(message)] }, config)
 *                 └─ 进入 ② createAgent 编译出的图
 *
 *   ② 图内部：createAgent 自动生成的 ReAct 循环
 *
 *           START ──► model ──(AIMessage.tool_calls 非空)──► tools ──┐
 *                      │  ▲                                        │
 *                      │  └────────────────────────────────────────┘
 *                      └────(无 tool_calls)────► END
 *
 *      model 节点：每轮都前置 systemPrompt（不落盘），实际请求体是 [System, ...history]
 *      tools 节点：并行执行本轮所有 tool_calls，每个结果包成 ToolMessage
 *                  每次工具调用都经过 HandleToolErrors 中间件：
 *                  抛错时不炸图，而是返回一条 ToolMessage 交回模型重试
 *
 *   ③ 取结果
 *      extractFinalText(response.messages) → 最后一条 AI 消息的 content（数组则 JSON 化）
 *      → 回到 gateway，emit 给前端
 *
 * ══ 记忆（checkpointer）══════════════════════════════════════════════════
 *
 *   MemorySaver 按 configurable.thread_id 存 checkpoint：
 *   - 同一 threadId 的多次 invokeAgent 共享 history → 多轮对话
 *   - deleteAgentMemory(threadId) → checkpointer.deleteThread()，会话重置
 *   - 不传 threadId 就不带 configurable，此时 checkpointer 会抛「缺失 thread_id」
 *     （WebSocket 场景永远有 sessionId / client.id，HTTP 场景要注意这点）
 *
 * ══ 与 ./langgraph.ts 的关系 ═════════════════════════════════════════════
 *
 *   两个文件编排同一套东西，只是这里由 createAgent 内部完成：
 *   systemPrompt → 自动前置；middleware → 包裹工具节点；checkpointer → 自动存档。
 *   langgraph.ts 则把这张图逐节点写出来，便于看清每一步。
 */

import { RedisSaver } from '@langchain/langgraph-checkpoint-redis';
import { createAgent, createMiddleware, ToolMessage, tool } from 'langchain';
import { loadGithubMcpTools } from './mcp/github';
import { REDIS_CONF } from './redis';
import { tools } from './tools';
import { DeepSeekChatModel, SYSTEM_PROMPT, invokeAgentWith } from './shared';

/**
 * 组装 agent：把模型、工具、中间件、checkpointer、系统提示交给 createAgent，
 * 返回的是编译好、可直接 invoke 的图（内部即 ② 那张 ReAct 图）。
 *
 * GitHub MCP 工具需要异步拉起 stdio 子进程并拉取工具列表，RedisSaver 也需要
 * 异步建立连接并建索引，因此这里改为异步组装；MCP 连接失败时
 * loadGithubMcpTools 会降级返回空数组，本地工具照常生效。
 */
const createConfiguredAgent = async (allTools: ReturnType<typeof tool>[]) => {
  // 中间件：包住每一次工具调用，把异常转成 ToolMessage，避免工具报错直接掀翻整轮对话
  const handleToolErrors = createMiddleware({
    name: 'HandleToolErrors',
    wrapToolCall: async (request, handler) => {
      try {
        return await handler(request);
      } catch (error) {
        // Return a custom error message to the model
        return new ToolMessage({
          content: `Tool error: Please check your input and try again. (${error})`,
          tool_call_id: request.toolCall.id!,
        });
      }
    },
  });

  // 用 Redis 做 checkpointer：多实例（PM2 集群）共享同一份会话记忆，
  // 避免 MemorySaver 只在单进程内存里导致跨进程「失忆」。
  const checkpointer = await RedisSaver.fromUrl(REDIS_CONF.url, REDIS_CONF.ttl);
  return createAgent({
    model: new DeepSeekChatModel(), // 未 bindTools，由 createAgent 内部按 tools 绑定
    tools: allTools,
    middleware: [handleToolErrors],
    checkpointer,
    systemPrompt: SYSTEM_PROMPT,
  });
};

// createConfiguredAgent 是 async，返回的是 Promise<ReactAgent>，这里用 Awaited 取出图本身
type ConfiguredAgent = Awaited<ReturnType<typeof createConfiguredAgent>>;

let agentPromise: Promise<ConfiguredAgent> | undefined;

/**
 * 懒加载 + 进程内单例：图只建一次，RedisSaver 连接也只建一次。
 * 多实例部署时每个 worker 各自建一份图（这是正常的），但 checkpointer 都指向
 * 同一个 Redis，因此会话记忆跨进程共享。
 * 本地工具 + GitHub MCP 工具合并后一起交给 createAgent。
 */
const getAgent = (): Promise<ConfiguredAgent> => {
  agentPromise ??= loadGithubMcpTools().then((mcpTools) =>
    createConfiguredAgent([...tools, ...mcpTools]),
  );
  return agentPromise;
};

/**
 * 清掉某个会话的记忆：直接操作 checkpointer 里该 thread 的存档。
 * WebSocket 断开连接时由 websocket.service 调用。
 * RedisSaver 的 deleteThread 会删掉 Redis 里该 thread 的全部 checkpoint，
 * 多实例下同样生效（所有 worker 共享同一个 Redis）。
 */
export const deleteAgentMemory = async (threadId: string): Promise<void> => {
  const checkpointer = (await getAgent()).checkpointer;
  // checkpointer 类型上可能是 boolean/undefined（未配置时），这里确认是可用实例再删
  if (checkpointer && typeof checkpointer === 'object') {
    await checkpointer.deleteThread(threadId);
  }
};

/**
 * 对外唯一入口：把消息交给 agent 跑一轮（可能包含多次工具调用），返回最终回复文本。
 *
 * 真正的调用、上下文注入、结果提取都在 shared.ts 的 invokeAgentWith 里，
 * 这里只负责把「本文件这套 LangChain 实现」传进去。
 */
export const invokeAgent = async (
  message: string,
  threadId?: string,
  wsClientId?: string,
): Promise<string> =>
  invokeAgentWith(await getAgent(), message, threadId, wsClientId);

// Keep the standalone script behavior available for manual experiments.
// 注意：图里配了 checkpointer，必须带 thread_id，否则 MemorySaver 会抛
// "missing a required thread_id"（这里传一个固定 thread 方便手动跑）。
if (require.main === module) {
  invokeAgent('1加2等于几？', 'langchain-demo')
    .then(console.log)
    .catch(console.error);
}

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

import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { createAgent, createMiddleware, ToolMessage } from 'langchain';
import { tools } from './tools';
import { DeepSeekChatModel, SYSTEM_PROMPT, invokeAgentWith } from './shared';

/**
 * 组装 agent：把模型、工具、中间件、checkpointer、系统提示交给 createAgent，
 * 返回的是编译好、可直接 invoke 的图（内部即 ② 那张 ReAct 图）。
 */
const createConfiguredAgent = () => {
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

  const checkpointer = new MemorySaver();
  return createAgent({
    model: new DeepSeekChatModel(), // 未 bindTools，由 createAgent 内部按 tools 绑定
    tools: tools,
    middleware: [handleToolErrors],
    checkpointer,
    systemPrompt: SYSTEM_PROMPT,
  });
};

let agent: ReturnType<typeof createConfiguredAgent> | undefined;

/** 懒加载 + 进程内单例：图只建一次，MemorySaver 也只有一份，多轮记忆才能共享。 */
const getAgent = () => {
  agent ??= createConfiguredAgent();
  return agent;
};

/**
 * 清掉某个会话的记忆：直接操作 checkpointer 里该 thread 的存档。
 * WebSocket 断开连接时由 websocket.service 调用。
 */
export const deleteAgentMemory = async (threadId: string): Promise<void> => {
  const checkpointer = getAgent().checkpointer;
  if (checkpointer instanceof MemorySaver) {
    await checkpointer.deleteThread(threadId);
  }
};

/**
 * 对外唯一入口：把消息交给 agent 跑一轮（可能包含多次工具调用），返回最终回复文本。
 *
 * 真正的调用、上下文注入、结果提取都在 shared.ts 的 invokeAgentWith 里，
 * 这里只负责把「本文件这套 LangChain 实现」传进去。
 */
export const invokeAgent = (
  message: string,
  threadId?: string,
  wsClientId?: string,
): Promise<string> =>
  invokeAgentWith(getAgent(), message, threadId, wsClientId);

// Keep the standalone script behavior available for manual experiments.
// 注意：图里配了 checkpointer，必须带 thread_id，否则 MemorySaver 会抛
// "missing a required thread_id"（这里传一个固定 thread 方便手动跑）。
if (require.main === module) {
  invokeAgent('1加2等于几？', 'langchain-demo')
    .then(console.log)
    .catch(console.error);
}

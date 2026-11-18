/**
 * LangGraph 版 agent：用 `StateGraph` 把 createAgent 内部那张 ReAct 图逐节点写出来。
 *
 * ══ 调用链路 ══════════════════════════════════════════════════════════════
 *
 *   ① 入口
 *      WebsocketGateway（收到 type=5 聊天消息）
 *        └─ invokeAgent(content, sessionId ?? client.id, client.id)      ← 本文件
 *           └─ invokeAgentWith(getAgentGraph(), message, threadId, wsClientId) ← shared.ts
 *              ├─ runWithAgentContext(wsClientId ?? threadId ?? '', ...)  写 AsyncLocalStorage
 *              ├─ buildAgentConfig(threadId)   → { recursionLimit: 25, configurable: { thread_id } }
 *              └─ graph.invoke({ messages: [HumanMessage(message)] }, config)
 *                 └─ 进入 ② 本文件编译出的图
 *
 *   ② 图结构
 *
 *           START ──► agent ──(有 tool_calls)──► tools ──┐
 *                      │  ▲                            │
 *                      │  └────────────────────────────┘
 *                      └────(无 tool_calls)────► END
 *
 *      agent 节点（callModel）：[System, ...state.messages] → 模型 → AIMessage
 *      tools 节点（ToolNode）：并行执行本轮 tool_calls，结果包成 ToolMessage
 *      条件边（toolsCondition）：看最后一条消息有没有 tool_calls，有就继续转，没有就收工
 *
 *   ③ 取结果
 *      extractFinalText(response.messages) → 最后一条 AI 消息的 content（数组则 JSON 化）
 *      → 回到 gateway，emit 给前端
 *
 * ══ 一次「带工具调用」的消息，state.messages 如何累积 ═════════════════════
 *
 *   superstep 1  agent
 *      输入 state.messages = [Human("北京天气怎么样？")]
 *      实际请求        = [System, Human]
 *      产出            = AIMessage(tool_calls: [get_weather{city:"北京"}])
 *      state.messages  = [Human, AI(tool_calls)]
 *
 *   superstep 2  agent → tools（条件边判定有 tool_calls）
 *      执行 get_weather → 产出 ToolMessage("天气是大太阳…", tool_call_id)
 *      state.messages  = [Human, AI(tool_calls), Tool]
 *
 *   superstep 3  tools → agent
 *      实际请求        = [System, Human, AI(tool_calls), Tool]
 *      产出            = AIMessage("北京天气晴朗，20℃…")，无 tool_calls
 *      state.messages  = [Human, AI(tool_calls), Tool, AI]
 *
 *   superstep 4  agent → END（条件边判定没有 tool_calls）
 *      response.messages.at(-1) 就是要返回给前端的文本
 *
 *   下一轮用户消息进来时，state.messages 会在这 4 条之后继续追加——
 *   历史就是这么攒起来的，攒的内容由 checkpointer 按 thread_id 存。
 *
 * ══ 与 ./langchain.ts 的对应关系 ══════════════════════════════════════════
 *
 *   createAgent 自动做的事，这里全部显式书写：
 *   systemPrompt  → callModel 里手动前置 SystemMessage（不写入状态，避免被反复持久化）
 *   middleware    → ToolNode({ handleToolErrors: true })，异常转 ToolMessage，不炸图
 *   checkpointer  → compile({ checkpointer })，与 langchain.ts 一样按 thread_id 存档
 *   recursionLimit → buildAgentConfig 传入，默认 25 个 superstep，超限抛 GraphRecursionError
 *
 *   注意工具异常文案不同：这里是 ToolNode 固定的 `Error: ... Please fix your mistakes.`，
 *   langchain.ts 中间件里是自定义的 `Tool error: Please check your input and try again. (...)`，
 *   两者都只给模型看，行为一致。
 */

import { SystemMessage } from '@langchain/core/messages';
import {
  END,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { tools } from './tools';
import { DeepSeekChatModel, SYSTEM_PROMPT, invokeAgentWith } from './shared';

let checkpointer: MemorySaver | undefined;

/** 与图分开持有 checkpointer，deleteAgentMemory 不必等图编译完才能用。 */
const getCheckpointer = (): MemorySaver => {
  checkpointer ??= new MemorySaver();
  return checkpointer;
};

const buildGraph = () => {
  // 与 createAgent 一致：模型只绑定一次工具，后续每次循环复用同一实例
  const model = new DeepSeekChatModel().bindTools(tools);

  /** agent 节点：把「系统提示 + 目前所有历史消息」丢给模型，产出 AIMessage。 */
  const callModel = async (state: typeof MessagesAnnotation.State) => {
    // 系统提示不写入会话状态，只在每次调用模型时前置，避免被 checkpointer 反复持久化
    const response = await model.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      ...state.messages,
    ]);

    // MessagesAnnotation 的 messages 通道有 reducer，返回数组是「追加」而不是覆盖
    return { messages: [response] };
  };

  // tools 节点：并行执行最后一条 AIMessage 里的所有 tool_calls
  const toolNode = new ToolNode(tools, {
    name: 'tools',
    // 等价于 langchain.ts 中 wrapToolCall 的 HandleToolErrors 中间件：
    // 工具抛错时转成 ToolMessage 交回模型，而不是让整张图崩掉。
    // 注意 ToolNode 的错误文案是固定的 `Error: ... Please fix your mistakes.`，
    // 与中间件里的自定义文案不同，但行为一致。
    handleToolErrors: true,
  });

  return (
    new StateGraph(MessagesAnnotation)
      // ① 调模型
      .addNode('agent', callModel)
      // ② 执行模型要的工具
      .addNode('tools', toolNode)
      // 入口
      .addEdge(START, 'agent')
      // ③ 分叉：模型还要调工具就去 tools，否则结束
      .addConditionalEdges('agent', toolsCondition, ['tools', END])
      // ④ 工具结果回到模型，进入下一轮（这就是 ReAct 循环）
      .addEdge('tools', 'agent')
      // 编译时注入 checkpointer：每个 superstep 结束后自动存档，按 thread_id 归档
      .compile({ checkpointer: getCheckpointer() })
  );
};

type AgentGraph = ReturnType<typeof buildGraph>;

let graph: AgentGraph | undefined;

/** 懒加载编译后的图，进程内单例（只编译一次，避免重复建图）。 */
export const getAgentGraph = (): AgentGraph => {
  graph ??= buildGraph();
  return graph;
};

/**
 * 清掉某个会话的记忆：删掉 checkpointer 里该 thread 的存档。
 * WebSocket 断开连接时由 websocket.service 调用。
 */
export const deleteAgentMemory = async (threadId: string): Promise<void> => {
  await getCheckpointer().deleteThread(threadId);
};

/**
 * 对外唯一入口：把消息交给图跑一轮（可能经过多次 agent ↔ tools 循环），返回最终回复文本。
 *
 * 真正的调用、上下文注入、结果提取都在 shared.ts 的 invokeAgentWith 里，
 * 这里只负责把「本文件这套 LangGraph 实现」传进去。
 */
export const invokeAgent = (
  message: string,
  threadId?: string,
  wsClientId?: string,
): Promise<string> =>
  invokeAgentWith(getAgentGraph(), message, threadId, wsClientId);

// Keep the standalone script behavior available for manual experiments.
if (require.main === module) {
  invokeAgent('1加2等于几？', 'langgraph-demo')
    .then(console.log)
    .catch(console.error);
}

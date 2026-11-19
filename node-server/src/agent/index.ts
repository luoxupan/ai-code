/**
 * Agent 入口。
 *
 * 这里只是出口（barrel），真正的实现拆在几个文件里：
 * - ./shared.ts     两个实现共用的部分（DeepSeekChatModel / SYSTEM_PROMPT / 调用与取结果）
 * - ./langchain.ts  用 LangChain 的 createAgent 实现（默认对外暴露的版本）
 * - ./langgraph.ts  用 LangGraph 的 StateGraph 手写同一套 ReAct 图
 *
 * 两个实现的 `invokeAgent` / `deleteAgentMemory` 签名完全一致，切换实现只需改 import 路径。
 * `src/modules/**` 目前统一从 `../../agent` 引用，即 LangChain 版本。
 */

export { DeepSeekChatModel, SYSTEM_PROMPT } from './shared';
export { deleteAgentMemory, invokeAgent } from './langchain';
// export { deleteAgentMemory, invokeAgent } from './langgraph';

/**
 * Agent 调用的「隐式上下文」：把 WebSocket 连接标识（wsClientId）传进工具函数。
 *
 * 为什么需要它：
 * 1. 工具（search_faq / send_mail_card / disconnect_websocket）是模块加载时创建好的单例，
 *    参数 schema 是给模型填的，没法把 wsClientId 做成工具参数，否则模型得凭空猜连接 ID；
 * 2. 也不能用模块级变量存「当前连接」，一个进程同时服务多个 socket 时，
 *    A 卡在 await 期间 B 进来覆盖变量，A 醒来就会拿着 B 的 id 去推卡片（并发串号）。
 *
 * 方案：用 Node 的 AsyncLocalStorage 做「异步调用链局部」存储。
 * runWithAgentContext() 在一个作用域里执行回调，回调派生出的整条 promise 链
 * （后续所有 await、定时器、LangGraph 图里各个节点）都能读到同一份数据，
 * 不同作用域的 run() 之间互不可见。
 *
 * 用法：
 *   // 写入：入口处包一层（见 src/agent/shared.ts 的 invokeAgentWith）
 *   runWithAgentContext(wsClientId, () => agent.invoke(...));
 *   // 读取：工具内部直接取，不需要参数层层传递
 *   const wsClientId = getAgentContext()?.wsClientId;
 *
 * 注意：
 * - 只沿异步调用链传播：worker_threads / child_process / 任务队列（如 BullMQ）不会继承，
 *   这类场景需要把 wsClientId 显式放进 job payload；
 * - 异步操作必须在 run() 的回调里发起，不能先创建 Promise 再包进去，否则作用域已失效；
 * - 与 NestJS 的 REQUEST scope 无关，只是 agent 目录内部的一个轻量设施。
 */

import { AsyncLocalStorage } from 'node:async_hooks';

/** 进程级存储实例；数据本身按异步调用链隔离，不是全局共享的一份值。 */
const agentContextStorage = new AsyncLocalStorage<{ wsClientId: string }>();

/**
 * 在指定上下文里执行回调，并原样返回回调的 Promise（AsyncLocalStorage.run 是同步的）。
 *
 * 进入作用域后，回调内部任意深度的异步任务都能通过 getAgentContext() 读到 wsClientId。
 *
 * @param wsClientId 当前 WebSocket 连接的 client.id；HTTP 场景可退化传 threadId，无连接时传 ''
 * @param callback   真正要执行的异步逻辑，通常是 agent.invoke(...)
 */
export const runWithAgentContext = <T>(
  wsClientId: string,
  callback: () => Promise<T>,
): Promise<T> => agentContextStorage.run({ wsClientId }, callback);

/**
 * 读取当前异步调用链上的上下文。
 *
 * 只在 runWithAgentContext() 的作用域内有效；作用域外（例如定时任务、别处直接调工具）
 * 返回 undefined，调用方需要自己兜底，例如：
 *   const wsClientId = getAgentContext()?.wsClientId;
 *   if (!wsClientId) throw new Error('WebSocket client context is not available');
 */
export const getAgentContext = (): { wsClientId: string } | undefined =>
  agentContextStorage.getStore();

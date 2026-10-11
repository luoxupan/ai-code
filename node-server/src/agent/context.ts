import { AsyncLocalStorage } from 'node:async_hooks';

const agentContextStorage = new AsyncLocalStorage<{ wsClientId: string }>();

export const runWithAgentContext = <T>(
  wsClientId: string,
  callback: () => Promise<T>,
): Promise<T> => agentContextStorage.run({ wsClientId }, callback);

export const getAgentContext = (): { wsClientId: string } | undefined =>
  agentContextStorage.getStore();

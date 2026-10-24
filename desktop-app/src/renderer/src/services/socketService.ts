import { SESSION_STATUS } from '../constants/chat';

type Status = 'connecting' | 'connected' | 'disconnected';
type SessionStatus = typeof SESSION_STATUS[keyof typeof SESSION_STATUS];

type ChatSocketApi = {
  setSessionInfo: (session: {
    userId: string;
    sessionId: string;
    sessionStatus: SessionStatus;
  }) => Promise<void>;
  getStatus: () => Promise<Status>;
  connect: () => Promise<void>;
  sendMessage: (message: any) => Promise<any>;
  onMessage: (callback: (message: any) => void) => () => void;
  onStatusChange: (callback: (status: Status) => void) => () => void;
};

declare global {
  interface Window {
    chatSocket: ChatSocketApi;
  }
}

const getChatSocket = (): ChatSocketApi => {
  if (!window.chatSocket) {
    throw new Error('Chat socket bridge is unavailable.');
  }

  return window.chatSocket;
};

export const socketService = {
  setSessionInfo: (
    userId: string,
    sessionId: string,
    sessionStatus: SessionStatus,
  ): Promise<void> => getChatSocket().setSessionInfo({
    userId,
    sessionId,
    sessionStatus,
  }),
  getStatus: (): Promise<Status> => getChatSocket().getStatus(),
  connect: (): Promise<void> => getChatSocket().connect(),
  sendMessage: (message: any): Promise<any> => getChatSocket().sendMessage(message),
  onMessage: (callback: (message: any) => void): (() => void) => {
    return getChatSocket().onMessage(callback);
  },
  onStatusChange: (callback: (status: Status) => void): (() => void) => {
    return getChatSocket().onStatusChange(callback);
  },
};


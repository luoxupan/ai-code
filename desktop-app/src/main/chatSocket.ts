import { BrowserWindow, ipcMain } from 'electron';
import { io, Socket } from 'socket.io-client';
import { MESSAGE_TYPE, SESSION_STATUS } from '../shared/chat';

const SOCKET_URL = 'ws://localhost:3002';
const SEND_TIMEOUT = 6000;

export type ChatSocketStatus = 'connecting' | 'connected' | 'disconnected';

export type ChatSocketSession = {
  userId: string;
  sessionId: string;
  sessionStatus: typeof SESSION_STATUS[keyof typeof SESSION_STATUS];
};

const STATUS_CHANNEL = 'chat-socket:status';
const MESSAGE_CHANNEL = 'chat-socket:message';

class ChatSocketService {
  private socket: Socket | null = null;
  private ackListeners = new Map<string, (ack: any) => void>();
  private connectionPromise: Promise<void> | null = null;
  private connectionReject: ((error: Error) => void) | null = null;
  private sessionId = '';
  private userId = '';
  private shouldConnectWithTemporaryAuth = false;
  private status: ChatSocketStatus = 'disconnected';

  private broadcast(channel: string, payload?: unknown): void {
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, payload);
      }
    });
  }

  private setStatus(status: ChatSocketStatus): void {
    this.status = status;
    this.broadcast(STATUS_CHANNEL, status);
  }

  private createAuth(): Record<string, unknown> {
    const auth: Record<string, unknown> = {
      user_id: this.userId,
      session_id: this.sessionId,
    };

    if (this.shouldConnectWithTemporaryAuth) {
      auth.iconnect = true;
    }

    return auth;
  }

  public setSessionInfo(session: ChatSocketSession): void {
    this.userId = session.userId;
    this.sessionId = session.sessionId;
    this.shouldConnectWithTemporaryAuth = session.sessionStatus === SESSION_STATUS.TEMPORARY;
  }

  public getStatus(): ChatSocketStatus {
    return this.status;
  }

  public connect(): Promise<void> {
    if (this.socket?.connected) {
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // this.setStatus('connecting');
    // this.socket = io(SOCKET_URL, {
    //   transports: ['websocket'],
    //   auth: this.createAuth(),
    // });

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        auth: this.createAuth(),
      });
      this.setStatus('connecting');
      this.connectionReject = reject;

      this.socket.on('connect', () => {
        console.log('[chat-socket] connected');
        this.setupMessageListener();
        this.shouldConnectWithTemporaryAuth = false;
        this.setStatus('connected');
        this.connectionPromise = null;
        this.connectionReject = null;
        resolve();
      });

      this.socket.on('disconnect', (reason: string) => {
        console.warn('[chat-socket] disconnected:', reason);
        this.cleanup();
        this.connectionPromise = null;
        this.connectionReject = null;
        this.setStatus('disconnected');
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('[chat-socket] connect error:', error);
        this.cleanup();
        this.connectionPromise = null;
        this.connectionReject = null;
        this.setStatus('disconnected');
        reject(error);
      });
    });

    return this.connectionPromise;
  }

  private setupMessageListener(): void {
    if (!this.socket) return;
    this.socket.on('Message', (message: any) => {
      if (message.type === MESSAGE_TYPE.ACK) {
        if (message.mid && this.ackListeners.has(message.mid)) {
          this.ackListeners.get(message.mid)?.(message);
          this.ackListeners.delete(message.mid);
        }
      } else {
        this.broadcast(MESSAGE_CHANNEL, message);
        this.sendAck(message.mid);
      }
    });
  }

  private cleanup(): void {
    this.socket?.off();
    this.socket = null;
    this.ackListeners.clear();
  }

  private sendAck(mid: string): void {
    if (!mid || !this.socket) return;
    this.socket.emit('Message', { type: MESSAGE_TYPE.ACK, mid, payload: {} });
  }

  public async sendMessage(message: any): Promise<any> {
    if (!this.socket?.connected) {
      await this.connect();
    }

    if (!this.socket?.connected) {
      throw new Error('WebSocket is not connected.');
    }

    const socket = this.socket;
    const mid = message.mid;
    if (!mid) {
      throw new Error('Message must have a unique mid.');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ackListeners.delete(mid);
        reject(new Error(`Message send timed out for mid: ${mid}`));
      }, SEND_TIMEOUT);

      this.ackListeners.set(mid, (ack) => {
        clearTimeout(timeout);
        resolve(ack);
      });

      if (message.type !== MESSAGE_TYPE.ACK) {
        socket.emit('Message', message);
      }
    });
  }
}

export const chatSocketService = new ChatSocketService();

export function registerChatSocketIpc(): void {
  ipcMain.handle('chat-socket:set-session-info', (_event, session: ChatSocketSession) => {
    chatSocketService.setSessionInfo(session);
  });

  ipcMain.handle('chat-socket:get-status', () => chatSocketService.getStatus());
  ipcMain.handle('chat-socket:connect', () => chatSocketService.connect());
  ipcMain.handle('chat-socket:send-message', (_event, message: any) => {
    return chatSocketService.sendMessage(message);
  });
}

registerChatSocketIpc();

import { io, Socket } from 'socket.io-client';
import { MESSAGE_TYPE } from '../constants/chat';

const SOCKET_URL = 'ws://localhost:3002'; // Replace with your actual WebSocket server URL
const SEND_TIMEOUT = 10000; // 5 seconds

type Status = 'connecting' | 'connected' | 'disconnected';

class SocketService {
  private static instance: SocketService;
  public socket: Socket | null = null;
  private messageListeners: Array<(message: any) => void> = [];
  private ackListeners: Map<string, (ack: any) => void> = new Map();
  private statusListeners: Array<(status: Status) => void> = [];
  private connectionPromise: Promise<void> | null = null;
  public status: Status = 'disconnected';

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  private setStatus(status: Status) {
    this.status = status;
    this.statusListeners.forEach(listener => listener(status));
  }

  public connect(): Promise<void> {
    if (this.socket && this.socket.connected) {
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
      });
      this.setStatus('connecting');

      this.socket.on('connect', () => {
        console.log('Socket.IO connected');
        this.setStatus('connected');
        this.setupDefaultListeners();
        this.connectionPromise = null;
        resolve();
      });

      this.socket.on('disconnect', (reason: string) => {
        console.log('Socket.IO disconnected:', reason);
        this.setStatus('disconnected');
        this.cleanup();
      });

      this.socket.on('connect_error', (err: Error) => {
        console.error('Socket.IO connection error:', err);
        this.setStatus('disconnected');
        this.connectionPromise = null;
        reject(err);
      });
    });
    
    return this.connectionPromise;
  }

  private setupDefaultListeners() {
    if (!this.socket) return;
    this.socket.on('Message', (message: any) => {
      if (message.type === MESSAGE_TYPE.ACK && message.mid) {
        if (this.ackListeners.has(message.mid)) {
          this.ackListeners.get(message.mid)?.(message);
          this.ackListeners.delete(message.mid);
        }
      } else {
        this.messageListeners.forEach(listener => listener(message));
        this.sendAck(message.mid);
      }
    });
  }

  public disconnect() {
    this.socket?.disconnect();
    this.cleanup();
  }

  private cleanup() {
    this.socket?.off();
    this.socket = null;
    this.ackListeners.clear();
  }
  
  private sendAck(mid: string) {
    if (!mid || !this.socket) return;
    this.socket.emit('Message', { type: MESSAGE_TYPE.ACK, mid, payload: {} });
  }

  public async sendMessage(message: any): Promise<any> {
    if (!this.socket || !this.socket.connected) {
      await this.connect();
    }
    
    // This check is needed because connect() could have failed
    if (!this.socket) {
      throw new Error('Socket connection failed.');
    }

    return new Promise((resolve, reject) => {
      const mid = message.mid;
      if (!mid) {
        return reject(new Error('Message must have a unique mid'));
      }

      const timeout = setTimeout(() => {
        this.ackListeners.delete(mid);
        reject(new Error(`Message send timed out for mid: ${mid}`));
      }, SEND_TIMEOUT);

      this.ackListeners.set(mid, (ack) => {
        clearTimeout(timeout);
        this.ackListeners.delete(mid);
        resolve(ack);
      });

      this.socket!.emit('Message', message);
    });
  }

  public onMessage(callback: (message: any) => void): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter(
        listener => listener !== callback
      );
    };
  }

  public onStatusChange(callback: (status: Status) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(
        listener => listener !== callback
      );
    };
  }
}

export const socketService = SocketService.getInstance();


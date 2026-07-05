import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'ws://localhost:3002'; // Replace with your actual WebSocket server URL
const SEND_TIMEOUT = 5000; // 5 seconds

class SocketService {
  private static instance: SocketService;
  public socket: Socket | null = null;
  private messageListeners: Array<(message: any) => void> = [];
  private ackListeners: Map<string, (ack: any) => void> = new Map();

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public connect(
    onConnect: () => void,
    onDisconnect: () => void,
    onConnectError: (err: Error) => void
  ) {
    if (this.socket) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Socket.IO connected');
      onConnect();
      this.setupDefaultListeners();
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Socket.IO disconnected:', reason);
      onDisconnect();
      this.cleanup();
    });

    this.socket.on('connect_error', (err: Error) => {
      console.error('Socket.IO connection error:', err);
      onConnectError(err);
    });
  }

  private setupDefaultListeners() {
    if (!this.socket) return;

    // Listener for general messages from the server
    this.socket.on('Message', (message: any) => {
      // Handle ACKs separately from general messages
      if (message.type === 3 && message.mid) {
        if (this.ackListeners.has(message.mid)) {
          const callback = this.ackListeners.get(message.mid);
          callback?.(message);
          this.ackListeners.delete(message.mid);
        }
      } else {
        // It's a regular message, notify listeners and send ACK back
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
    this.socket.emit('Message', { type: 3, mid, payload: {} });
  }

  public sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('Socket not connected'));
      }

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

      this.socket.emit('Message', message);
    });
  }

  public onMessage(callback: (message: any) => void): () => void {
    this.messageListeners.push(callback);
    // Return a function to unsubscribe
    return () => {
      this.messageListeners = this.messageListeners.filter(
        listener => listener !== callback
      );
    };
  }
}

export const socketService = SocketService.getInstance();

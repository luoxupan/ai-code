import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { Repository } from 'typeorm';
import { configureDisconnectHandler } from '../../agent/tools';
import { Session, SessionStatus } from './entities/session.entity';

type SessionConnection = {
  user_id: string;
  wsClientId: string;
};

@Injectable()
export class WebsocketService implements OnModuleInit {
  private readonly clients = new Map<string, Socket>();
  private readonly sessionConnections = new Map<string, SessionConnection>();
  private readonly sessionIdsByClientId = new Map<string, string>();

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  onModuleInit() {
    configureDisconnectHandler((wsClientId) =>
      this.disconnectClient(wsClientId),
    );
  }

  addClient(client: Socket) {
    this.clients.set(client.id, client);
  }

  registerSessionConnection(
    sessionId: string,
    userId: string,
    wsClientId: string,
  ) {
    this.sessionConnections.set(sessionId, { user_id: userId, wsClientId });
    this.sessionIdsByClientId.set(wsClientId, sessionId);
  }

  getSessionIdByClientId(wsClientId: string): string | undefined {
    return this.sessionIdsByClientId.get(wsClientId);
  }

  getSessionClientId(sessionId: string): string | undefined {
    return this.sessionConnections.get(sessionId)?.wsClientId;
  }

  removeClient(clientId: string) {
    this.clients.delete(clientId);
    this.sessionIdsByClientId.delete(clientId);
  }

  sendMessageToClient(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (client) {
      client.emit('messageToClient', message);
      return true;
    }
    return false;
  }

  postMessage(message: string, sessionId: string) {
    const wsClientId = this.getSessionClientId(sessionId);
console.log('handleConnection:wsClientId', wsClientId)
    if (!wsClientId) {
      throw new NotFoundException(`WebSocket session ${sessionId} not found`);
    }

    const client = this.clients.get(wsClientId);
    if (!client) {
      throw new NotFoundException(`WebSocket client ${wsClientId} not found`);
    }

    client.emit('Message', {
      mid: uuidv4(),
      subType: 0,
      type: 5,
      sender: 'system',
      payload: {
        content: message,
      },
    });
    return {
      deliveredCount: 1,
    };
  }

  getClients(): Map<string, Socket> {
    return this.clients;
  }

  disconnectClient(wsClientId: string): boolean {
    const client = this.clients.get(wsClientId);

    if (!client) {
      return false;
    }

    client.emit('Message', {
      mid: uuidv4(),
      subType: 0,
      type: 5,
      sender: 'system',
      payload: {
        content: '连接即将断开',
      },
    });
    client.disconnect(true);
    return true;
  }

  async createInitialSession(sessionId: string, userId: string): Promise<void> {
    await this.sessionRepository.save({
      session_id: sessionId,
      user_id: userId,
      session_status: SessionStatus.InProgress,
      timestamp: Date.now(),
    });
  }

  async getSessionInfo(
    user_id: string,
  ): Promise<Pick<Session, 'user_id' | 'session_id' | 'session_status'>> {
    const session = await this.sessionRepository.findOne({
      where: { user_id },
      order: { timestamp: 'DESC' },
    });

    if (session) {
      const { user_id, session_id, session_status } = session;
      return { user_id, session_id, session_status };
    }

    return {
      user_id,
      session_id: uuidv4(),
      session_status: SessionStatus.Temporary,
    };
  }
}

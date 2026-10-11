import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { Repository } from 'typeorm';
import { configureDisconnectHandler } from '../../agent/tools';
import { Session } from './entities/session.entity';

@Injectable()
export class WebsocketService implements OnModuleInit {
  private readonly clients = new Map<string, Socket>();

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

  removeClient(clientId: string) {
    this.clients.delete(clientId);
  }

  sendMessageToClient(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (client) {
      client.emit('messageToClient', message);
      return true;
    }
    return false;
  }

  postMessage(message: string, wsClientId?: string) {
    if (wsClientId) {
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

    for (const client of this.clients.values()) {
      client.emit('Message', {
        mid: uuidv4(),
        subType: 0,
        type: 5,
        sender: 'system',
        payload: {
          content: message,
        },
      });
    }
    return {
      deliveredCount: this.clients.size,
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

  getSessionInfo(user_id: string): Promise<Session | null> {
    return this.sessionRepository.findOneBy({ user_id });
  }
}

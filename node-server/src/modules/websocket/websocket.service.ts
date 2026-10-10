
import { Injectable, NotFoundException } from '@nestjs/common';
import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WebsocketService {
  private readonly clients = new Map<string, Socket>();

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
        }
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
        }
      });
    }
    return {
      deliveredCount: this.clients.size,
    };
  }

  getClients(): Map<string, Socket> {
    return this.clients;
  }
}

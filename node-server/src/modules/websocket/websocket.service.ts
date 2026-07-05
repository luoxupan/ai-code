
import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

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

  getClients(): Map<string, Socket> {
    return this.clients;
  }
}

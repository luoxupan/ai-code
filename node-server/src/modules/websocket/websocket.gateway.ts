
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WebsocketService } from './websocket.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  pingInterval: 5000,
  pingTimeout: 10000,
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly websocketService: WebsocketService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.websocketService.addClient(client);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.websocketService.removeClient(client.id);
  }

  @SubscribeMessage('Message')
  handleMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket): void {
    console.log(`Message from client ${client.id}: ${JSON.stringify(data)}`);
    // Echo message back to the sender
    setTimeout(() => {
      client.emit('Message', {
      type: 3,
      ...data,
    });
    }, 4000)
  }

  /**
   * Broadcasts a message to all connected clients.
   * @param message The message to send.
   */
  public broadcast(message: any) {
    this.server.emit('Message', message);
  }
}

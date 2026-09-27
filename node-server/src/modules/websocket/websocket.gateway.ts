
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
import { invokeAgent } from '../../agent';

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
  async handleMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket): Promise<any> {
    console.log(`Message from client ${client.id}: ${JSON.stringify(data) }\n${data?.payload?.content}`);
    // Echo message back to the sender
    if (data?.type !== 3) {
      client.emit('Message', {
        ...data,
        type: 3,
      });
      let content = data?.payload?.content;
      if (data?.payload?.content) {
        try {
          content = await invokeAgent(data?.payload?.content);
        } catch (e: any) {
          content = e?.message || 'Error';
        }
      }
      client.emit('Message', {
        ...data,
        payload: {
          ...data?.payload,
          content: content,
        },
        subType: 0,
        type: 5,
      });
    }
  }

  /**
   * Broadcasts a message to all connected clients.
   * @param message The message to send.
   */
  public broadcast(message: any) {
    this.server.emit('Message', message);
  }
}

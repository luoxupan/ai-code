import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WebsocketService } from './websocket.service';
import { invokeAgent } from '../../agent';

type WebsocketMessage = {
  type?: number;
  payload?: {
    content?: string;
  };
};

type WebsocketAuth = {
  iconnect?: boolean;
  session_id: string;
  user_id: string;
};

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  pingInterval: 5000,
  pingTimeout: 10000,
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WebsocketGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly websocketService: WebsocketService) {}

  async handleConnection(client: Socket) {
    const auth = client.handshake.auth as WebsocketAuth;
    this.logger.log(`Client connected: ${client.id}`, auth.session_id);
    this.websocketService.addClient(client);
    console.log('handleConnection:', auth.session_id,client.id)
    this.websocketService.registerSessionConnection(
      auth.session_id,
      auth.user_id,
      client.id,
    );

    if (auth.iconnect !== true || !auth.session_id || !auth.user_id) {
      return;
    }

    try {
      await this.websocketService.createInitialSession(
        auth.session_id,
        auth.user_id,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to create session for client ${client.id}: ${JSON.stringify(
          error,
        )}`,
      );
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.websocketService.removeClient(client.id);
  }

  @SubscribeMessage('Message')
  async handleMessage(
    @MessageBody() data: WebsocketMessage,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    this.logger.log(
      `Message from client ${client.id}: ${JSON.stringify(data)}`,
    );
    // Echo message back to the sender
    if (data?.type !== 3) {
      client.emit('Message', {
        ...data,
        type: 3,
      });
      let content = data?.payload?.content;
      if (data?.payload?.content) {
        try {
          const sessionId = this.websocketService.getSessionIdByClientId(
            client.id,
          );
          content = await invokeAgent(
            data?.payload?.content,
            sessionId ?? client.id,
            client.id,
          );
        } catch (error: unknown) {
          content = error instanceof Error ? error.message : 'Error';
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

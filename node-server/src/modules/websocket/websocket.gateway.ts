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
import { MailService } from '../mail/mail.service';
import { WebsocketService } from './websocket.service';
import { invokeAgent } from '../../agent';
import { v4 as uuidv4 } from 'uuid';

type WebsocketMessage = {
  type?: number;
  subType?: number;
  payload?: {
    content?: unknown;
  };
};

type MailContent = {
  recipients?: string;
  subject?: string;
  body?: string;
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

  constructor(
    private readonly websocketService: WebsocketService,
    private readonly mailService: MailService,
  ) {}

  async handleConnection(client: Socket) {
    const auth = client.handshake.auth as WebsocketAuth;
    this.logger.log(`Client connected: ${client.id}`, auth.session_id);
    this.websocketService.addClient(client);
    console.log('handleConnection:', auth.session_id, client.id);
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

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    await this.websocketService.removeClient(client.id);
  }

  @SubscribeMessage('Message')
  async handleMessage(
    @MessageBody() data: WebsocketMessage,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    this.logger.log(
      `Message from client ${client.id}: ${JSON.stringify(data)}`,
    );

    if (data?.type === 6 && data?.subType === 4) {
      const mailContent = data.payload?.content as MailContent | undefined;
      try {
        await this.mailService.sendMail({
          recipients: mailContent?.recipients ?? '',
          subject: mailContent?.subject ?? '',
          body: mailContent?.body ?? '',
        });
        client.emit('Message', {
          ...data,
          type: 3,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '发送邮件失败';
        this.logger.error(`Failed to handle mail request: ${message}`);
        client.emit('Message', {
          mid: `${client.id}-${Date.now()}`,
          subType: 0,
          type: 5,
          sender: 'system',
          payload: { content: message },
        });
      }
      return;
    }

    // Echo message back to the sender
    if (data?.type !== 3) {
      client.emit('Message', {
        ...data,
        type: 3,
      });
      let content: string | undefined = data?.payload?.content as
        | string
        | undefined;
      if (typeof content === 'string' && content) {
        try {
          const sessionId = this.websocketService.getSessionIdByClientId(
            client.id,
          );
          content = await invokeAgent(
            content,
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
          content: typeof content === 'string' ? content : JSON.stringify(content),
        },
        subType: 0,
        type: 5,
        mid: uuidv4(),
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

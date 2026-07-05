
import { Controller, Get, Post, Body } from '@nestjs/common';
import { TestService } from './test.service';
import { WebsocketService } from '../websocket/websocket.service';

@Controller('app/test')
export class TestController {
  constructor(
    private readonly testService: TestService,
    private readonly websocketService: WebsocketService,
  ) {}

  @Get()
  getTest(): string {
    return this.testService.getTest();
  }

  @Post('send-message')
  sendMessage(@Body() body: { clientId: string; message: string }) {
    const { clientId, message } = body;
    const result = this.websocketService.sendMessageToClient(clientId, message);
    return { success: result };
  }
}


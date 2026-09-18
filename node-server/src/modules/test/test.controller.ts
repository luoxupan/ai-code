
import { Controller, Get, Post, Body, Query, Redirect } from '@nestjs/common';
import { TestService } from './test.service';
import { WebsocketService } from '../websocket/websocket.service';

@Controller('test')
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

  @Get('redirect')
  @Redirect('http://localhost:3002/api/v1/default', 302)
  redirectUrl(@Query('version') version): any {
    if (version && version === '5') {
      return { url: 'http://localhost:3002/api/v1/v5' };
    }
  }
}


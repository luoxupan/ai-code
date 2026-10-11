import { Body, Controller, Post } from '@nestjs/common';
import { WebsocketService } from './websocket.service';
import { PostMessageDto } from './dto/post-message.dto';
import { GetSessionInfoDto } from './dto/get-session-info.dto';

@Controller('websocket')
export class WebsocketController {
  constructor(private readonly websocketService: WebsocketService) {}

  @Post('postMessage')
  postMessage(@Body() postMessageDto: PostMessageDto) {
    return this.websocketService.postMessage(
      postMessageDto.message,
      postMessageDto.wsClientId,
    );
  }

  @Post('getSessionInfo')
  getSessionInfo(@Body() getSessionInfoDto: GetSessionInfoDto) {
    return this.websocketService.getSessionInfo(getSessionInfoDto.user_id);
  }
}

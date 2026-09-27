import { Body, Controller, Post } from '@nestjs/common';
import { AgentService } from './agent.service';
import { MessageDto } from './dto/message.dto';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('message')
  message(@Body() messageDto: MessageDto): Promise<string> {
    return this.agentService.sendMessage(messageDto.msg);
  }
}

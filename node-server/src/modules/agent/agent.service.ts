import { Injectable } from '@nestjs/common';
import { invokeAgent } from '../../agent';

@Injectable()
export class AgentService {
  sendMessage(message: string): Promise<string> {
    return invokeAgent(message);
  }
}

import { Injectable } from '@nestjs/common';
import { invokeAgent } from '../../agent';
import { configureUserLoader } from '../../agent/tools';
import { UsersService } from '../users/users.service';

@Injectable()
export class AgentService {
  constructor(private readonly usersService: UsersService) {
    configureUserLoader(() => this.usersService.findAll());
  }

  sendMessage(message: string): Promise<string> {
    return invokeAgent(message);
  }
}

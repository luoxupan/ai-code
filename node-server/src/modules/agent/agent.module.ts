import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  imports: [UsersModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}

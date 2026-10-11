
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebsocketGateway } from './websocket.gateway';
import { WebsocketService } from './websocket.service';
import { WebsocketController } from './websocket.controller';
import { Session } from './entities/session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Session])],
  controllers: [WebsocketController],
  providers: [WebsocketGateway, WebsocketService],
  exports: [WebsocketService],
})
export class WebsocketModule {}

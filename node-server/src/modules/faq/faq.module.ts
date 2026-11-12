import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebsocketModule } from '../websocket/websocket.module';
import { EmbeddingService } from './embedding.service';
import { FaqController } from './faq.controller';
import { FaqService } from './faq.service';
import { Faq } from './entities/faq.entity';
import { QdrantService } from './qdrant.service';

@Module({
  imports: [TypeOrmModule.forFeature([Faq]), WebsocketModule],
  controllers: [FaqController],
  providers: [FaqService, EmbeddingService, QdrantService],
  exports: [FaqService],
})
export class FaqModule {}

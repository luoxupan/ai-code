import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { getAgentContext } from '../../agent/context';
import { configureFaqSearchHandler } from '../../agent/tools';
import { RagConfig } from '../../config';
import { WebsocketService } from '../websocket/websocket.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { EmbeddingService } from './embedding.service';
import { Faq, FaqIndexStatus } from './entities/faq.entity';
import { FaqVectorPayload, QdrantService } from './qdrant.service';

export type FaqSearchResult = {
  id: number;
  question: string;
  answer: string;
  category: string | null;
  score: number;
};

@Injectable()
export class FaqService implements OnModuleInit {
  private readonly logger = new Logger(FaqService.name);
  private readonly rag: RagConfig;

  constructor(
    @InjectRepository(Faq)
    private readonly faqRepository: Repository<Faq>,
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantService: QdrantService,
    private readonly websocketService: WebsocketService,
    configService: ConfigService,
  ) {
    this.rag = configService.getOrThrow<RagConfig>('config.rag');
  }

  onModuleInit(): void {
    configureFaqSearchHandler(async (query) => {
      const hits = await this.search(query);
      if (!hits.length) {
        return { hits, cardPushed: false };
      }

      const wsClientId = getAgentContext()?.wsClientId;
      const cardPushed = wsClientId
        ? this.websocketService.sendFaqCardToClient(
            wsClientId,
            hits[0].question,
            hits[0].answer,
          )
        : false;

      return { hits, cardPushed };
    });
  }

  findAll(): Promise<Faq[]> {
    return this.faqRepository.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<Faq> {
    const faq = await this.faqRepository.findOneBy({ id });
    if (!faq) {
      throw new NotFoundException(`FAQ ${id} not found`);
    }
    return faq;
  }

  async create(createFaqDto: CreateFaqDto): Promise<Faq> {
    const saved = await this.faqRepository.save(
      this.faqRepository.create({
        ...createFaqDto,
        category: createFaqDto.category ?? null,
        enabled: createFaqDto.enabled ?? true,
        index_status: 'pending',
      }),
    );

    return this.syncToIndex(saved);
  }

  async update(id: number, updateFaqDto: UpdateFaqDto): Promise<Faq> {
    const faq = await this.findOne(id);
    const merged = this.faqRepository.merge(faq, updateFaqDto);
    const saved = await this.faqRepository.save(merged);

    return this.syncToIndex(saved);
  }

  async remove(id: number): Promise<void> {
    const faq = await this.findOne(id);
    await this.faqRepository.delete(id);

    try {
      await this.qdrantService.remove(faq.id);
    } catch (error) {
      // 数据库已删除，残留向量会在检索回查时被过滤掉，这里只记录告警。
      this.logger.warn(
        `FAQ ${faq.id} deleted from MySQL but Qdrant cleanup failed: ${this.message(error)}`,
      );
    }
  }

  /**
   * 检索 FAQ：先用 query 向量召回，再回查 MySQL 过滤停用条目。
   * Qdrant 只是索引，权威数据始终以 MySQL 为准。
   */
  async search(query: string, topK?: number): Promise<FaqSearchResult[]> {
    const limit = topK ?? this.rag.topK;
    const vector = await this.embeddingService.embedQuery(query);
    const hits = await this.qdrantService.search(vector, limit);

    const candidates = hits.filter(
      (hit) => hit.score >= this.rag.scoreThreshold,
    );
    if (!candidates.length) {
      return [];
    }

    const faqs = await this.faqRepository.find({
      where: { id: In(candidates.map((hit) => hit.id)) },
    });
    const faqById = new Map(faqs.map((faq) => [faq.id, faq]));

    return candidates
      .map((hit) => {
        const faq = faqById.get(hit.id);
        if (!faq || !faq.enabled) {
          return null;
        }
        return {
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          category: faq.category,
          score: hit.score,
        };
      })
      .filter((result): result is FaqSearchResult => result !== null);
  }

  /** 全量重建向量索引，返回成功写入的条数。 */
  async reindex(): Promise<{ indexed: number }> {
    const faqs = await this.faqRepository.find({
      where: { enabled: true },
      order: { id: 'ASC' },
    });

    await this.qdrantService.recreateCollection();

    if (!faqs.length) {
      return { indexed: 0 };
    }

    try {
      const vectors = await this.embeddingService.embedDocuments(
        faqs.map((faq) => faq.question),
      );
      await this.qdrantService.upsertMany(
        faqs.map((faq, index) => ({
          id: faq.id,
          vector: vectors[index],
          payload: this.toPayload(faq),
        })),
      );
      await this.setIndexStatus(
        faqs.map((faq) => faq.id),
        'indexed',
      );
      return { indexed: faqs.length };
    } catch (error) {
      await this.setIndexStatus(
        faqs.map((faq) => faq.id),
        'failed',
      );
      throw error;
    }
  }

  /**
   * 写时同步：MySQL 为权威存储，Qdrant 失败只降级为 pending，不影响接口成功返回。
   */
  private async syncToIndex(faq: Faq): Promise<Faq> {
    if (!faq.enabled) {
      await this.setIndexStatus([faq.id], 'pending');
      try {
        await this.qdrantService.remove(faq.id);
      } catch (error) {
        this.logger.warn(
          `FAQ ${faq.id} disabled but Qdrant removal failed: ${this.message(error)}`,
        );
      }
      return { ...faq, index_status: 'pending' };
    }

    try {
      const [vector] = await this.embeddingService.embedDocuments([
        faq.question,
      ]);
      await this.qdrantService.upsert(faq.id, vector, this.toPayload(faq));
      await this.setIndexStatus([faq.id], 'indexed');
      return { ...faq, index_status: 'indexed' };
    } catch (error) {
      this.logger.warn(
        `FAQ ${faq.id} saved but vector indexing failed, marked as pending: ${this.message(error)}`,
      );
      await this.setIndexStatus([faq.id], 'pending');
      return { ...faq, index_status: 'pending' };
    }
  }

  private async setIndexStatus(ids: number[], status: FaqIndexStatus) {
    if (!ids.length) {
      return;
    }
    await this.faqRepository.update({ id: In(ids) }, { index_status: status });
  }

  private toPayload(faq: Faq): FaqVectorPayload {
    return {
      faq_id: faq.id,
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
    };
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : JSON.stringify(error);
  }
}

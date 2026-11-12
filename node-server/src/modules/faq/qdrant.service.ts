import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { RagConfig } from '../../config';

export type FaqVectorPayload = {
  faq_id: number;
  question: string;
  answer: string;
  category: string | null;
};

export type FaqVectorHit = {
  id: number;
  score: number;
  payload: FaqVectorPayload;
};

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private readonly client: QdrantClient;
  private readonly collection: string;
  private readonly dimensions: number;

  constructor(configService: ConfigService) {
    const rag = configService.getOrThrow<RagConfig>('config.rag');
    this.collection = rag.qdrantCollection;
    this.dimensions = rag.embeddingDimensions;
    this.client = new QdrantClient({
      url: rag.qdrantUrl,
      // 注意：Qdrant 客户端的 timeout 单位是毫秒，默认 300_000（5 分钟）。
      timeout: 15_000,
      // 本地 Qdrant 不可达时不去探测服务端版本，避免启动日志里多一条无关告警。
      checkCompatibility: false,
      ...(rag.qdrantApiKey ? { apiKey: rag.qdrantApiKey } : {}),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureCollection();
      this.logger.log(
        `Qdrant collection "${this.collection}" is ready (${this.dimensions}d)`,
      );
    } catch (error) {
      // 向量库不可用不阻断启动，检索时再降级报错。
      this.logger.warn(
        `Qdrant is unavailable at startup, FAQ retrieval will fail until it recovers: ${this.message(error)}`,
      );
    }
  }

  /** 幂等建集合：已存在则跳过，不存在才按 cosine 距离创建。 */
  async ensureCollection(): Promise<void> {
    const { exists } = await this.run('check collection', () =>
      this.client.collectionExists(this.collection),
    );
    if (exists) {
      return;
    }

    await this.run('create collection', () =>
      this.client.createCollection(this.collection, {
        vectors: { size: this.dimensions, distance: 'Cosine' },
      }),
    );
  }

  /** 全量重建：删除集合并按当前维度重新创建。 */
  async recreateCollection(): Promise<void> {
    const { exists } = await this.run('check collection', () =>
      this.client.collectionExists(this.collection),
    );
    if (exists) {
      await this.run('delete collection', () =>
        this.client.deleteCollection(this.collection),
      );
    }
    await this.ensureCollection();
  }

  async upsert(id: number, vector: number[], payload: FaqVectorPayload) {
    await this.run('upsert point', () =>
      this.client.upsert(this.collection, {
        wait: true,
        points: [{ id, vector, payload }],
      }),
    );
  }

  async upsertMany(
    points: Array<{ id: number; vector: number[]; payload: FaqVectorPayload }>,
  ): Promise<void> {
    if (!points.length) {
      return;
    }
    await this.run('upsert points', () =>
      this.client.upsert(this.collection, { wait: true, points }),
    );
  }

  async remove(id: number): Promise<void> {
    await this.run('delete point', () =>
      this.client.delete(this.collection, { wait: true, points: [id] }),
    );
  }

  async search(vector: number[], limit: number): Promise<FaqVectorHit[]> {
    const response = await this.run('search points', () =>
      this.client.query(this.collection, {
        query: vector,
        limit,
        with_payload: true,
      }),
    );

    return response.points.map((point) => ({
      id: Number(point.id),
      score: point.score,
      payload: point.payload as FaqVectorPayload,
    }));
  }

  private async run<T>(
    action: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw new Error(`Qdrant ${action} failed: ${this.message(error)}`);
    }
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : JSON.stringify(error);
  }
}

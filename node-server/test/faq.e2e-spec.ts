import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EmbeddingService } from '../src/modules/faq/embedding.service';
import { Faq } from '../src/modules/faq/entities/faq.entity';
import {
  FaqVectorHit,
  FaqVectorPayload,
  QdrantService,
} from '../src/modules/faq/qdrant.service';

/**
 * FAQ 接口的端到端验证。
 * 测试环境没有 Qdrant/Ollama，用内存实现替换，验证 CRUD、检索过滤与降级行为。
 */
class InMemoryQdrantService {
  private points = new Map<
    number,
    { vector: number[]; payload: FaqVectorPayload }
  >();

  ensureCollection(): Promise<void> {
    return Promise.resolve();
  }

  recreateCollection(): Promise<void> {
    this.points.clear();
    return Promise.resolve();
  }

  upsert(id: number, vector: number[], payload: FaqVectorPayload) {
    this.points.set(id, { vector, payload });
    return Promise.resolve();
  }

  upsertMany(
    points: Array<{ id: number; vector: number[]; payload: FaqVectorPayload }>,
  ): Promise<void> {
    for (const point of points) {
      this.points.set(point.id, {
        vector: point.vector,
        payload: point.payload,
      });
    }
    return Promise.resolve();
  }

  remove(id: number): Promise<void> {
    this.points.delete(id);
    return Promise.resolve();
  }

  search(vector: number[], limit: number): Promise<FaqVectorHit[]> {
    return Promise.resolve(
      [...this.points.entries()]
        .map(([id, point]) => ({
          id,
          score: this.cosine(vector, point.vector),
          payload: point.payload,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit),
    );
  }

  private cosine(a: number[], b: number[]): number {
    const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
    const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
    const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
    return normA && normB ? dot / (normA * normB) : 0;
  }
}

class StubEmbeddingService {
  embedQuery(text: string): Promise<number[]> {
    return Promise.resolve(this.vectorize(text));
  }

  embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.resolve(texts.map((text) => this.vectorize(text)));
  }

  private vectorize(text: string): number[] {
    return text.includes('邮件') ? [1, 0] : [0, 1];
  }
}

describe('FaqController (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(QdrantService)
      .useClass(InMemoryQdrantService)
      .overrideProvider(EmbeddingService)
      .useClass(StubEmbeddingService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.setGlobalPrefix('api/v1');
    await app.init();

    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  const createFaq = (question: string, answer: string) =>
    request(server).post('/api/v1/faq').send({ question, answer });

  const searchFaq = (query: string) =>
    request(server).post('/api/v1/faq/search').send({ query });

  it('创建 FAQ 后返回 indexed 状态', async () => {
    const res = await createFaq(
      '如何发送邮件？',
      '填写邮件卡片后提交。',
    ).expect(201);

    const body = res.body as unknown as Faq;
    expect(body.id).toEqual(expect.any(Number));
    expect(body.question).toBe('如何发送邮件？');
    expect(body.index_status).toBe('indexed');
  });

  it('列表返回已创建的 FAQ', async () => {
    const res = await request(server).get('/api/v1/faq').expect(200);

    const body = res.body as unknown as Faq[];
    expect(body).toBeInstanceOf(Array);
    expect(body.some((faq) => faq.question === '如何发送邮件？')).toBe(true);
  });

  it('检索命中相同主题的 FAQ', async () => {
    const res = await searchFaq('怎么发邮件').expect(201);

    const body = res.body as unknown as Faq[];
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual(
      expect.objectContaining({
        question: '如何发送邮件？',
        answer: '填写邮件卡片后提交。',
      }),
    );
  });

  it('停用的 FAQ 不参与检索', async () => {
    const created = await createFaq('如何发送邮件？', '旧答案').expect(201);
    const createdId = (created.body as unknown as Faq).id;

    await request(server)
      .put(`/api/v1/faq/${createdId}`)
      .send({ enabled: false })
      .expect(200);

    const res = await searchFaq('怎么发邮件').expect(201);

    const body = res.body as unknown as Faq[];
    expect(body.every((faq) => faq.id !== createdId)).toBe(true);
  });

  it('reindex 重建索引并返回条数', async () => {
    const res = await request(server).post('/api/v1/faq/reindex').expect(201);

    const body = res.body as unknown as { indexed: number };
    expect(body.indexed).toBeGreaterThanOrEqual(1);
  });

  it('删除 FAQ 后检索不再返回', async () => {
    const created = await createFaq('如何发送邮件？', '临时答案').expect(201);
    const createdId = (created.body as unknown as Faq).id;

    await request(server).delete(`/api/v1/faq/${createdId}`).expect(200);

    const res = await searchFaq('怎么发邮件').expect(201);

    const body = res.body as unknown as Faq[];
    expect(body.every((faq) => faq.id !== createdId)).toBe(true);
  });

  it('不存在的 FAQ 返回 404', async () => {
    await request(server).get('/api/v1/faq/999999').expect(404);
  });

  it('缺少必填字段返回 400', async () => {
    await request(server)
      .post('/api/v1/faq')
      .send({ question: '只有问题' })
      .expect(400);
  });
});

import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RagConfig } from '../../config';
import { WebsocketService } from '../websocket/websocket.service';
import { EmbeddingService } from './embedding.service';
import { Faq } from './entities/faq.entity';
import { FaqService } from './faq.service';
import { QdrantService } from './qdrant.service';

type FaqRow = Faq;

const rag: RagConfig = {
  qdrantUrl: 'http://localhost:6333',
  qdrantApiKey: '',
  qdrantCollection: 'faq',
  ollamaBaseUrl: 'http://localhost:11434',
  embeddingModel: 'bge-m3',
  embeddingDimensions: 1024,
  topK: 3,
  scoreThreshold: 0.6,
};

describe('FaqService', () => {
  let service: FaqService;
  let rows: FaqRow[];
  let nextId: number;

  const repository = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  };

  const embeddingService = {
    embedQuery: jest.fn(),
    embedDocuments: jest.fn(),
  };

  const qdrantService = {
    upsert: jest.fn(),
    upsertMany: jest.fn(),
    remove: jest.fn(),
    search: jest.fn(),
    recreateCollection: jest.fn(),
    ensureCollection: jest.fn(),
  };

  const websocketService = { sendFaqCardToClient: jest.fn() };

  const buildFaq = (partial: Partial<Faq>): Faq => ({
    id: 1,
    question: '如何发送邮件？',
    answer: '填写邮件卡片后提交。',
    category: null,
    enabled: true,
    index_status: 'pending',
    created_at: new Date(),
    updated_at: new Date(),
    ...partial,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    rows = [];
    nextId = 1;

    repository.find.mockImplementation(
      (options?: { where?: Record<string, unknown> }) => {
        const where = options?.where;
        if (!where) {
          return Promise.resolve([...rows]);
        }
        const ids = (where.id as { _value?: number[] } | undefined)?._value;
        const enabled = where.enabled;
        return Promise.resolve(
          rows.filter(
            (row) =>
              (!ids || ids.includes(row.id)) &&
              (enabled === undefined || row.enabled === enabled),
          ),
        );
      },
    );
    repository.findOneBy.mockImplementation(({ id }: { id: number }) =>
      Promise.resolve(rows.find((row) => row.id === id) ?? null),
    );
    repository.create.mockImplementation((data: Partial<Faq>) => ({
      id: undefined,
      question: '',
      answer: '',
      category: null,
      enabled: true,
      index_status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
      ...data,
    }));
    repository.save.mockImplementation((row: Faq) => {
      if (!row.id) {
        row.id = nextId++;
        rows.push(row);
      } else {
        const index = rows.findIndex((item) => item.id === row.id);
        if (index >= 0) {
          rows[index] = row;
        }
      }
      return Promise.resolve(row);
    });
    repository.merge.mockImplementation(
      (target: Faq, source: Partial<Faq>) => ({
        ...target,
        ...source,
      }),
    );
    repository.delete.mockImplementation((id: number) => {
      rows = rows.filter((row) => row.id !== id);
      return Promise.resolve({ affected: 1 });
    });
    repository.update.mockImplementation(
      (
        criteria: { id?: { _value?: number[] } } | number,
        patch: Partial<Faq>,
      ) => {
        const ids =
          typeof criteria === 'number'
            ? [criteria]
            : (criteria.id?._value ?? rows.map((row) => row.id));
        rows = rows.map((row) =>
          ids.includes(row.id) ? { ...row, ...patch } : row,
        );
        return Promise.resolve({ affected: ids.length });
      },
    );

    embeddingService.embedDocuments.mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => [0.1, 0.2])),
    );
    embeddingService.embedQuery.mockResolvedValue([0.1, 0.2]);
    qdrantService.upsert.mockResolvedValue(undefined);
    qdrantService.upsertMany.mockResolvedValue(undefined);
    qdrantService.remove.mockResolvedValue(undefined);
    qdrantService.recreateCollection.mockResolvedValue(undefined);
    qdrantService.search.mockResolvedValue([]);
    websocketService.sendFaqCardToClient.mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaqService,
        { provide: getRepositoryToken(Faq), useValue: repository },
        { provide: EmbeddingService, useValue: embeddingService },
        { provide: QdrantService, useValue: qdrantService },
        { provide: WebsocketService, useValue: websocketService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => rag },
        },
      ],
    }).compile();

    service = module.get(FaqService);
  });

  it('创建 FAQ 后同步写入向量库并标记 indexed', async () => {
    const created = await service.create({
      question: '如何发送邮件？',
      answer: '填写邮件卡片后提交。',
    });

    expect(created.id).toBe(1);
    expect(created.index_status).toBe('indexed');
    expect(embeddingService.embedDocuments).toHaveBeenCalledWith([
      '如何发送邮件？',
    ]);
    expect(qdrantService.upsert).toHaveBeenCalledWith(1, [0.1, 0.2], {
      faq_id: 1,
      question: '如何发送邮件？',
      answer: '填写邮件卡片后提交。',
      category: null,
    });
    expect(rows[0].index_status).toBe('indexed');
  });

  it('向量库同步失败时接口仍成功，并降级为 pending', async () => {
    qdrantService.upsert.mockRejectedValue(new Error('connection refused'));

    const created = await service.create({
      question: '退款多久到账？',
      answer: '1-3 个工作日。',
    });

    expect(created.id).toBe(1);
    expect(created.index_status).toBe('pending');
    expect(rows[0].index_status).toBe('pending');
  });

  it('embedding 失败时同样降级为 pending', async () => {
    embeddingService.embedDocuments.mockRejectedValue(new Error('ollama down'));

    const created = await service.create({
      question: '客服工作时间？',
      answer: '9:00-21:00。',
    });

    expect(created.index_status).toBe('pending');
    expect(qdrantService.upsert).not.toHaveBeenCalled();
  });

  it('更新 FAQ 时重新写入向量库', async () => {
    rows.push(buildFaq({ id: 1, index_status: 'indexed' }));

    const updated = await service.update(1, { answer: '新的答案' });

    expect(updated.answer).toBe('新的答案');
    expect(updated.index_status).toBe('indexed');
    expect(qdrantService.upsert).toHaveBeenCalledTimes(1);
  });

  it('停用 FAQ 时从向量库移除并标记 pending', async () => {
    rows.push(buildFaq({ id: 1, index_status: 'indexed' }));

    const updated = await service.update(1, { enabled: false });

    expect(updated.index_status).toBe('pending');
    expect(qdrantService.remove).toHaveBeenCalledWith(1);
    expect(qdrantService.upsert).not.toHaveBeenCalled();
  });

  it('删除 FAQ 时同步删除向量，向量删除失败不影响数据库删除', async () => {
    rows.push(buildFaq({ id: 1 }));
    qdrantService.remove.mockRejectedValue(new Error('qdrant down'));

    await expect(service.remove(1)).resolves.toBeUndefined();
    expect(rows).toHaveLength(0);
  });

  it('删除不存在的 FAQ 抛 NotFoundException', async () => {
    await expect(service.remove(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('检索按阈值过滤并回查 MySQL 过滤停用条目', async () => {
    rows.push(
      buildFaq({ id: 1, enabled: true }),
      buildFaq({ id: 2, enabled: false }),
    );
    qdrantService.search.mockResolvedValue([
      { id: 1, score: 0.92, payload: {} },
      { id: 2, score: 0.88, payload: {} },
      { id: 3, score: 0.5, payload: {} },
    ]);

    const results = await service.search('怎么发邮件');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: 1, score: 0.92 });
    expect(qdrantService.search).toHaveBeenCalledWith([0.1, 0.2], 3);
  });

  it('全部低于阈值时返回空数组', async () => {
    qdrantService.search.mockResolvedValue([
      { id: 1, score: 0.2, payload: {} },
    ]);

    await expect(service.search('无关问题')).resolves.toEqual([]);
  });

  it('Qdrant 无命中时不再回查数据库', async () => {
    qdrantService.search.mockResolvedValue([]);

    await expect(service.search('完全无关')).resolves.toEqual([]);
    expect(repository.find).not.toHaveBeenCalled();
  });

  it('reindex 重建集合、批量写入并标记 indexed', async () => {
    rows.push(buildFaq({ id: 1 }), buildFaq({ id: 2 }));
    embeddingService.embedDocuments.mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);

    const result = await service.reindex();

    expect(result).toEqual({ indexed: 2 });
    expect(qdrantService.recreateCollection).toHaveBeenCalled();
    expect(qdrantService.upsertMany).toHaveBeenCalledTimes(1);
    expect(rows.every((row) => row.index_status === 'indexed')).toBe(true);
  });

  it('reindex 失败时把条目标记为 failed 并向上抛错', async () => {
    rows.push(buildFaq({ id: 1 }));
    qdrantService.upsertMany.mockRejectedValue(new Error('qdrant down'));

    await expect(service.reindex()).rejects.toThrow('qdrant down');
    expect(rows[0].index_status).toBe('failed');
  });

  it('reindex 在没有任何启用条目时只重建空集合', async () => {
    rows.push(buildFaq({ id: 1, enabled: false }));

    await expect(service.reindex()).resolves.toEqual({ indexed: 0 });
    expect(qdrantService.upsertMany).not.toHaveBeenCalled();
  });
});

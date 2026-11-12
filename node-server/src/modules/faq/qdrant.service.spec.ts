import { ConfigService } from '@nestjs/config';
import { RagConfig } from '../../config';

const collectionExists = jest.fn();
const createCollection = jest.fn();
const deleteCollection = jest.fn();
const upsert = jest.fn();
const removePoints = jest.fn();
const query = jest.fn();

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => ({
    collectionExists,
    createCollection,
    deleteCollection,
    upsert,
    delete: removePoints,
    query,
  })),
}));

import { QdrantService } from './qdrant.service';

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

const configService = { getOrThrow: () => rag } as unknown as ConfigService;

describe('QdrantService', () => {
  let service: QdrantService;

  beforeEach(() => {
    jest.clearAllMocks();
    collectionExists.mockResolvedValue({ exists: false });
    createCollection.mockResolvedValue(true);
    deleteCollection.mockResolvedValue(true);
    upsert.mockResolvedValue({ status: 'completed' });
    removePoints.mockResolvedValue({ status: 'completed' });
    query.mockResolvedValue({ points: [] });
    service = new QdrantService(configService);
  });

  it('集合不存在时按 cosine 距离创建', async () => {
    await service.ensureCollection();

    expect(createCollection).toHaveBeenCalledWith('faq', {
      vectors: { size: 1024, distance: 'Cosine' },
    });
  });

  it('集合已存在时不重复创建（幂等）', async () => {
    collectionExists.mockResolvedValue({ exists: true });

    await service.ensureCollection();
    await service.ensureCollection();

    expect(createCollection).not.toHaveBeenCalled();
  });

  it('重建集合时先删除再创建', async () => {
    collectionExists.mockResolvedValueOnce({ exists: true });
    collectionExists.mockResolvedValueOnce({ exists: false });

    await service.recreateCollection();

    expect(deleteCollection).toHaveBeenCalledWith('faq');
    expect(createCollection).toHaveBeenCalledTimes(1);
  });

  it('upsert 带 wait 并透传 payload', async () => {
    await service.upsert(7, [0.1, 0.2], {
      faq_id: 7,
      question: 'q',
      answer: 'a',
      category: null,
    });

    expect(upsert).toHaveBeenCalledWith('faq', {
      wait: true,
      points: [
        {
          id: 7,
          vector: [0.1, 0.2],
          payload: { faq_id: 7, question: 'q', answer: 'a', category: null },
        },
      ],
    });
  });

  it('upsertMany 空数组时不请求', async () => {
    await service.upsertMany([]);

    expect(upsert).not.toHaveBeenCalled();
  });

  it('搜索返回带 payload 的命中结果', async () => {
    query.mockResolvedValue({
      points: [
        {
          id: 3,
          score: 0.9,
          payload: {
            faq_id: 3,
            question: 'q',
            answer: 'a',
            category: 'c',
          },
        },
      ],
    });

    const hits = await service.search([0.1, 0.2], 3);

    expect(query).toHaveBeenCalledWith('faq', {
      query: [0.1, 0.2],
      limit: 3,
      with_payload: true,
    });
    expect(hits).toEqual([
      {
        id: 3,
        score: 0.9,
        payload: { faq_id: 3, question: 'q', answer: 'a', category: 'c' },
      },
    ]);
  });

  it('底层异常被转译为可读错误', async () => {
    createCollection.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.ensureCollection()).rejects.toThrow(
      'Qdrant create collection failed: ECONNREFUSED',
    );
  });

  it('启动探测失败只告警不抛错', async () => {
    collectionExists.mockRejectedValue(new Error('down'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });
});

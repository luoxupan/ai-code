import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaEmbeddings } from '@langchain/ollama';
import { RagConfig } from '../../config';

/** 业务请求超时：embedding 卡住时尽快降级，避免拖住接口。 */
const REQUEST_TIMEOUT_MS = 15000;
/** 启动探测超时：外部服务不可用时不希望启动被拖太久。 */
const PROBE_TIMEOUT_MS = 3000;

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly embeddings: OllamaEmbeddings;
  private readonly model: string;

  constructor(configService: ConfigService) {
    const rag = configService.getOrThrow<RagConfig>('config.rag');
    this.model = rag.embeddingModel;
    this.embeddings = new OllamaEmbeddings({
      model: rag.embeddingModel,
      baseUrl: rag.ollamaBaseUrl,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.withTimeout(
        this.embeddings.embedQuery('ping'),
        'probe',
        PROBE_TIMEOUT_MS,
      );
      this.logger.log(`Ollama embedding model "${this.model}" is ready`);
    } catch (error) {
      this.logger.warn(
        `Ollama embedding model "${this.model}" is unavailable at startup, FAQ retrieval will fail until it recovers: ${this.message(error)}`,
      );
    }
  }

  embedQuery(text: string): Promise<number[]> {
    return this.withTimeout(this.embeddings.embedQuery(text), 'embedQuery');
  }

  embedDocuments(texts: string[]): Promise<number[][]> {
    return this.withTimeout(
      this.embeddings.embedDocuments(texts),
      'embedDocuments',
    );
  }

  /**
   * Ollama 不可达时请求可能长时间挂起，超时后转成可读错误，
   * 让上层按“索引降级为 pending”处理，而不是把接口拖死。
   */
  private withTimeout<T>(
    promise: Promise<T>,
    action: string,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              `Ollama ${action} timed out after ${timeoutMs}ms (model: ${this.model})`,
            ),
          ),
        timeoutMs,
      );
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : JSON.stringify(error);
  }
}

import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export interface AppConfig {
  port: number;
  env: string;
}

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export interface RagConfig {
  qdrantUrl: string;
  qdrantApiKey: string;
  qdrantCollection: string;
  ollamaBaseUrl: string;
  embeddingModel: string;
  embeddingDimensions: number;
  topK: number;
  scoreThreshold: number;
}

export interface Config {
  app: AppConfig;
  database: TypeOrmModuleOptions;
  mail: MailConfig;
  rag: RagConfig;
}

export default registerAs('config', (): Config => {
  const isMysql = process.env.DB_TYPE !== 'sqlite';

  return {
    app: {
      port: parseInt(process.env.PORT || '3000', 10),
      env: process.env.NODE_ENV || 'development',
    },
    database: {
      type: process.env.DB_TYPE === 'sqlite' ? 'sqlite' : 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_DATABASE || 'nest_db',
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      autoLoadEntities: true,
      ...(isMysql
        ? {
            extra: {
              connectionLimit: parseInt(
                process.env.DB_CONNECTION_LIMIT || '10',
                10,
              ),
              maxIdle: parseInt(process.env.DB_MAX_IDLE || '10', 10),
              idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '60000', 10),
              queueLimit: 0,
              waitForConnections: true,
            },
          }
        : {}),
    },
    mail: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASSWORD || '',
      from: process.env.MAIL_FROM || '',
    },
    rag: {
      qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
      qdrantApiKey: process.env.QDRANT_API_KEY || '',
      qdrantCollection: process.env.QDRANT_COLLECTION || 'faq',
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'bge-m3',
      embeddingDimensions: parseInt(
        process.env.OLLAMA_EMBEDDING_DIMENSIONS || '1024',
        10,
      ),
      topK: parseInt(process.env.RAG_TOP_K || '3', 10),
      scoreThreshold: parseFloat(process.env.RAG_SCORE_THRESHOLD || '0.75'),
    },
  };
});

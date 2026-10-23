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

export interface Config {
  app: AppConfig;
  database: TypeOrmModuleOptions;
  mail: MailConfig;
}

export default registerAs('config', (): Config => {
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
    },
    mail: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASSWORD || '',
      from: process.env.MAIL_FROM || '',
    },
  };
});

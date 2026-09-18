import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export interface AppConfig {
  port: number;
  env: string;
}

export interface Config {
  app: AppConfig;
  database: TypeOrmModuleOptions;
}

export default registerAs('config', (): Config => {
  return {
    app: {
      port: parseInt(process.env.PORT || '3000', 10),
      env: process.env.NODE_ENV || 'development',
    },
    database: {
      type: (process.env.DB_TYPE as any) || 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_DATABASE || 'nest_db',
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      autoLoadEntities: true,
    },
  };
});

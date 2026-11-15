import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './modules/users/users.module';
import { TestModule } from './modules/test/test.module';
import { WebsiteModule } from './modules/website/website.module';
import configuration from './config/index';
import { HttpModule } from '@nestjs/axios';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { AuthMiddleware } from './middleware/auth.middleware';
import { AgentModule } from './modules/agent/agent.module';
import { FaqModule } from './modules/faq/faq.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // .local 文件里的变量优先生效，且不被 git 追踪，用于存放敏感信息
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}.local`,
        `.env.${process.env.NODE_ENV || 'development'}`,
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const dbConfig = configService.get('config.database');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return {
          ...dbConfig,
        };
      },
      inject: [ConfigService],
    }),
    UsersModule,
    TestModule,
    WebsocketModule,
    WebsiteModule,
    AgentModule,
    FaqModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).exclude('website/*path').forRoutes('*');
  }
}

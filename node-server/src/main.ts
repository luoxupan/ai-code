import helmet from 'helmet';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { NestFactory, HttpAdapterHost, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { TransformInterceptor } from './interceptor/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 安全防护
  app.use(helmet());

  // 开启CORS
  app.enableCors();

  // API版本控制
  app.setGlobalPrefix('api/v1');

  // 全局过滤器
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  // 全局管道
  app.useGlobalPipes(new ValidationPipe());

  // 全局拦截器
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // 优雅停机
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('config.app.port') || 3002;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api/v1`);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

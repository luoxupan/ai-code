import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './modules/users/users.module';
import { TestModule } from './modules/test/test.module';
import { User } from './modules/users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'db.sqlite',
      entities: [User],
      synchronize: true, // 仅在开发环境使用，生产环境应使用 migrations
    }),
    UsersModule,
    TestModule,
  ],
})
export class AppModule {}

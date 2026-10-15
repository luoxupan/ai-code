import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { User } from '../src/modules/users/entities/user.entity';

/**
 * user_id 唯一性的端到端验证。
 * 测试环境使用 sqlite 内存库（.env.test，DB_SYNCHRONIZE=true），唯一索引由实体定义自动创建。
 *
 * 注意：sqlite 内存库只有一条连接，真并发写入时事务会互相回滚，无法用来验证并发行为；
 * 并发冲突分支（唯一键冲突后回查）由 users.service.spec.ts 用构造的驱动错误覆盖。
 */
describe('UsersController 唯一性与并发 (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    dataSource = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await app.close();
  });

  const createUser = (user_id: number, name: string, email: string) =>
    request(app.getHttpServer())
      .post('/api/v1/users/add')
      .send({ user_id, name, email });

  type UserBody = { id: number; user_id: number; name: string; email: string };

  const listUsers = async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/list')
      .expect(200);
    return res.body as UserBody[];
  };

  it('重复请求同一个 user_id 时只落库一条', async () => {
    const first = await createUser(9001, 'First', 'first@example.com').expect(
      201,
    );
    const second = await createUser(
      9001,
      'Second',
      'second@example.com',
    ).expect(201);

    expect((second.body as UserBody).id).toBe((first.body as UserBody).id);

    const rows = (await listUsers()).filter((u) => u.user_id === 9001);
    expect(rows).toHaveLength(1);
  });

  it('数据库层存在 user_id 唯一索引（并发兜底的前提）', async () => {
    // 绕过 service 的存在性检查，直接写入重复 user_id，必须被数据库拦下
    const repository = dataSource.getRepository(User);

    await repository.insert({
      user_id: 9100,
      name: 'Direct',
      email: 'direct@example.com',
    });

    await expect(
      repository.insert({
        user_id: 9100,
        name: 'Duplicated',
        email: 'dup@example.com',
      }),
    ).rejects.toThrow(/UNIQUE constraint failed|Duplicate entry/i);
  });

  it('不同 user_id 仍可正常插入', async () => {
    await createUser(9003, 'A', 'a@example.com').expect(201);
    await createUser(9004, 'B', 'b@example.com').expect(201);

    const rows = await listUsers();
    expect(rows.filter((u) => u.user_id === 9003)).toHaveLength(1);
    expect(rows.filter((u) => u.user_id === 9004)).toHaveLength(1);
  });
});

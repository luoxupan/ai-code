import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

type MockRepository = {
  save: jest.Mock;
  findOneBy: jest.Mock;
};

const duplicateKeyError = () =>
  new QueryFailedError(
    'INSERT INTO `user`(`user_id`) VALUES (?)',
    [1001],
    Object.assign(
      new Error("Duplicate entry '1001' for key 'uk_user_user_id'"),
      {
        code: 'ER_DUP_ENTRY',
        errno: 1062,
      },
    ),
  );

const sqliteError = (message: string, code = 'SQLITE_CONSTRAINT') =>
  new QueryFailedError(
    'INSERT INTO "user"("user_id") VALUES (?)',
    [1001],
    Object.assign(new Error(message), { code, errno: 19 }),
  );

describe('UsersService', () => {
  let service: UsersService;
  let repository: MockRepository;

  const dto: CreateUserDto = {
    user_id: 1001,
    name: 'Test User',
    email: 'test@example.com',
  };

  beforeEach(async () => {
    repository = {
      save: jest.fn(),
      findOneBy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('user_id 已存在时直接返回已有记录，不再写库', async () => {
    const existing = { id: 1, ...dto };
    repository.findOneBy.mockResolvedValue(existing);

    await expect(service.create(dto)).resolves.toEqual(existing);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('user_id 不存在时插入并返回新记录', async () => {
    const created = { id: 2, ...dto };
    repository.findOneBy.mockResolvedValueOnce(null);
    repository.save.mockResolvedValue(created);

    await expect(service.create(dto)).resolves.toEqual(created);
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('并发下唯一索引拦截后，回查并返回对方已插入的记录', async () => {
    const winner = { id: 3, ...dto };
    repository.findOneBy
      .mockResolvedValueOnce(null) // 请求自身的预检查未命中
      .mockResolvedValueOnce(winner); // 冲突后回查
    repository.save.mockRejectedValue(duplicateKeyError());

    await expect(service.create(dto)).resolves.toEqual(winner);
    expect(repository.findOneBy).toHaveBeenCalledTimes(2);
  });

  it('识别 sqlite 的唯一约束冲突（消息含 UNIQUE constraint failed）', async () => {
    const winner = { id: 4, ...dto };
    repository.findOneBy
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    repository.save.mockRejectedValue(
      sqliteError('SQLITE_CONSTRAINT: UNIQUE constraint failed: user.user_id'),
    );

    await expect(service.create(dto)).resolves.toEqual(winner);
  });

  it('sqlite 的其他约束错误（如 NOT NULL）不被当作唯一冲突', async () => {
    const dbError = sqliteError(
      'SQLITE_CONSTRAINT: NOT NULL constraint failed: user.name',
    );
    repository.findOneBy.mockResolvedValue(null);
    repository.save.mockRejectedValue(dbError);

    await expect(service.create(dto)).rejects.toBe(dbError);
    expect(repository.findOneBy).toHaveBeenCalledTimes(1);
  });

  it('非唯一键冲突的数据库错误原样抛出', async () => {
    const dbError = new QueryFailedError('INSERT ...', [], {
      code: 'ER_NO_SUCH_TABLE',
    } as unknown as Error);
    repository.findOneBy.mockResolvedValue(null);
    repository.save.mockRejectedValue(dbError);

    await expect(service.create(dto)).rejects.toBe(dbError);
  });

  it('冲突后回查仍为空时抛出原始错误', async () => {
    const dbError = duplicateKeyError();
    repository.findOneBy.mockResolvedValue(null);
    repository.save.mockRejectedValue(dbError);

    await expect(service.create(dto)).rejects.toBe(dbError);
  });
});

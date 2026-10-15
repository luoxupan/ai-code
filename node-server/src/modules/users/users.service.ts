import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

/**
 * 唯一键冲突的驱动层错误码：
 * MySQL/MariaDB(ER_DUP_ENTRY)、SQLite(SQLITE_CONSTRAINT*)、PostgreSQL(23505)。
 */
const UNIQUE_VIOLATION_CODES = new Set([
  'ER_DUP_ENTRY',
  'SQLITE_CONSTRAINT',
  'SQLITE_CONSTRAINT_UNIQUE',
  'SQLITE_CONSTRAINT_PRIMARYKEY',
  '23505',
]);

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  findOne(id: number): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  /**
   * 以 user_id 为唯一键的幂等创建：库中已有该 user_id 时不再插入，直接返回已有记录。
   *
   * 并发安全依赖 user_id 上的唯一索引（见 User 实体）：
   * 先查后插只能减少冲突，两个并发请求仍可能同时通过存在性检查，
   * 这时由数据库唯一索引拦下其中一方，捕获冲突后回查返回已落库的那条记录。
   * PM2 以 cluster 多实例运行，进程内的锁不可靠，因此唯一索引是必需的兜底。
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.findByUserId(createUserDto.user_id);
    if (existing) {
      return existing;
    }

    try {
      return await this.usersRepository.save(createUserDto);
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        // 不是唯一键引发的报错
        throw error;
      }

      // 并发冲突：另一请求已插入同一 user_id，回查并返回它的记录。
      // 该请求的 INSERT 会阻塞到对方事务提交后才失败，所以这里能读到对方已提交的行。
      const created = await this.findByUserId(createUserDto.user_id);
      if (created) {
        return created;
      }

      // 极端情况（冲突行随后被删除等），抛出原始错误便于定位。
      throw error;
    }
  }

  findByUserId(userId: number): Promise<User | null> {
    return this.usersRepository.findOneBy({ user_id: userId });
  }

  private isUniqueViolation(error: unknown): boolean {
    const driverError: unknown =
      error instanceof QueryFailedError ? error.driverError : error;
    const code = (driverError as { code?: unknown } | null)?.code;
    if (typeof code !== 'string' || !UNIQUE_VIOLATION_CODES.has(code)) {
      return false;
    }

    // SQLite 的 SQLITE_CONSTRAINT 也覆盖 NOT NULL / CHECK 等约束，需按消息再确认一次。
    if (code === 'SQLITE_CONSTRAINT') {
      const message = (driverError as { message?: unknown } | null)?.message;
      return (
        typeof message === 'string' && /UNIQUE constraint failed/i.test(message)
      );
    }

    return true;
  }

  async remove(id: number): Promise<void> {
    await this.usersRepository.delete(id);
  }
}

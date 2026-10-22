import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  // user_id 作为业务唯一键：数据库层必须有唯一索引，服务层的幂等/并发控制依赖它兜底。
  @Column({ unique: true })
  user_id: number;

  @Column()
  name: string;

  @Column()
  name_en: string;

  @Column()
  email: string;
}

import { Column, Entity, PrimaryColumn } from 'typeorm';

export enum SessionStatus {
  InProgress = 1,
  Ended = 2,
}

@Entity('session')
export class Session {
  @PrimaryColumn({
    name: 'session_id',
    type: 'varchar',
  })
  session_id: string;

  @Column({
    name: 'user_id',
    type: 'varchar',
  })
  user_id: string;

  @Column({
    name: 'session_status',
    type: 'tinyint',
  })
  session_status: SessionStatus;
}

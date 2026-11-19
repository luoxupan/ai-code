/**
 * Redis 配置（agent 目录内轻量读取，不依赖 Nest ConfigService）。
 *
 * agent 是独立实验目录，不参与 Nest 运行时装配，因此这里直接从 process.env 读，
 * 与 conf.ts 的 MODEL_CONF 风格一致。多实例（PM2 集群）部署时所有 worker 共用
 * 同一个 Redis，checkpointer 记忆才能跨进程共享。
 *
 * 可读环境变量：
 * - REDIS_URL: 完整连接串，默认 redis://localhost:6379
 * - REDIS_TTL: checkpoint 默认 TTL（分钟），缺省 0 = 不过期
 */

export const REDIS_CONF = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  // defaultTTL 单位是分钟，0 表示不过期；refreshOnRead 为 true 时每次读取刷新 TTL
  ttl: {
    defaultTTL: parseInt(process.env.REDIS_TTL || '0', 10),
    refreshOnRead: true,
  },
} as const;

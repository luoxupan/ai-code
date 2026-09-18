# AGENTS.md — node-server

本文件面向在本仓库（`node-server`）中工作的编码代理。请在动手前先读完，命令与约定以本文件为准。

## 1. 项目概览

- NestJS 11 + TypeScript 5.7 后端服务，Express 平台，默认监听 `3002`（见 `.env.development` 的 `PORT`）。
- 全局路由前缀在 `src/main.ts` 中硬编码为 `api/v1`，因此所有 HTTP 路由都是 `/api/v1/...`。
- 数据层使用 TypeORM：开发/预发/生产为 MySQL，测试为 sqlite 内存库（`.env.test`）。
- 实时通信使用 socket.io，事件名为 `Message`。
- `src/agent/index.ts` 是独立的 LangChain + Ollama 实验脚本（对话 Agent + 工具调用），不参与 Nest 运行时装配，也已被 ESLint 忽略。
- Git 仓库根在**上级目录** `/Users/luoxupan/ai-code`（同时含 `web-app`、`python` 等子项目），本目录只是其中一个子项目。

## 2. 常用命令

```bash
npm install                 # 安装依赖（有 package-lock.json，勿换包管理器）

npm run start:dev           # 开发模式（watch，NODE_ENV=development）
npm run start:pre           # 预发模式
npm run build               # 编译到 dist/
npm run start:prod          # 运行 dist/main（需先 build）

npm run lint                # eslint，带 --fix
npm run format              # prettier 格式化 src 与 test
npm run test                # 单元测试（jest，rootDir=src）
npm run test:e2e            # e2e 测试（NODE_ENV=test，sqlite 内存库）
npm run test:cov            # 覆盖率

npm run pm2:dev             # 以下 pm2 脚本均需先 npm run build
npm run pm2:start           # 生产
npm run pm2:pre             # 预发
npm run pm2:restart / pm2:stop / pm2:delete
npm run pm2:logs / pm2:monit
```

本地联调 websocket：先 `npm run start:dev`，再 `node socket-test-client.js`。

### 命令相关的已知坑

- **运行前需存在对应环境文件**：`src/app.module.ts` 用 `envFilePath: .env.${NODE_ENV || 'development'}` 加载配置，缺文件会退回到 `src/config/index.ts` 里的默认值（端口 3000，可能与你期望的 3002 不一致）。
- **`npm run test` 当前会以退出码 1 结束**：其 `testRegex` 为 `.*\.spec\.ts$` 且 `rootDir` 为 `src`，而 `src/` 下暂无任何 `*.spec.ts`（“No tests found”）。新增单元测试请与被测文件同级命名为 `*.spec.ts`。
- **e2e 用例的路由与控制器不一致**（待修正）：`test/app.e2e-spec.ts` 请求 `/api/v1/users`，而 `UsersController` 实际暴露的是 `POST /api/v1/users/add` 与 `GET /api/v1/users/list`。改 e2e 前先对齐路由，否则新建/查询会 404。
- PM2 走 `dist/`，改代码后必须重新 `npm run build` 再重启，否则跑的是旧产物。

## 3. 目录结构与装配方式

```
src/
  main.ts                         # 引导：helmet / CORS / 全局前缀 / 过滤器 / 管道 / 拦截器 / 优雅停机
  app.module.ts                   # 根模块：ConfigModule、TypeOrmModule、业务模块注册、全局中间件
  config/index.ts                 # registerAs('config')，app 与 database 两段配置
  adapters/socket-io.adapter.ts   # socket.io 适配器（继承 IoAdapter）
  filters/all-exceptions.filter.ts
  interceptor/transform.interceptor.ts
  middleware/auth.middleware.ts
  modules/<name>/
    <name>.module.ts
    <name>.controller.ts
    <name>.service.ts
    dto/*.dto.ts
    entities/*.entity.ts
  agent/index.ts                  # 独立脚本，非 Nest 代码
test/                             # e2e 用例与 jest-e2e.json
```

新增功能的标准做法：在 `src/modules/` 下新建 `<name>` 目录，按上面四件套拆分，然后到 `src/app.module.ts` 的 `imports` 注册该模块。

## 4. 全局约定（改动时最容易踩的点）

- **响应结构由拦截器统一包装**：`TransformInterceptor` 把所有成功响应变成 `{ errno: 0, message: 'success', data }`。Controller 直接返回业务数据即可，不要自己再包一层。
- **异常结构由过滤器统一包装**：`AllExceptionsFilter` 输出 `{ statusCode, timestamp, path, message }`，非 `HttpException` 一律 500 并记录堆栈。抛 `NotFoundException` 等标准异常即可。
- **校验靠全局 `ValidationPipe`**：请求体类型用 DTO 类 + `class-validator` 装饰器（参考 `dto/create-user.dto.ts`），不要写手写校验。注意 `main.ts` 里用的是 `new ValidationPipe()`（未开启 `whitelist`/`forbidNonWhitelisted`），而 e2e 里额外开了这两个选项——两者行为不完全一致。
- **`AuthMiddleware` 已全局挂载**：作用于 `*`，仅排除 `website/*path`。它向 `http://localhost:3001/auth` 发请求校验，失败与异常分支目前都直接 `next()` 放行（鉴权尚未真正接入）。新增公开接口时要么加入 `exclude`，要么注意它会引入一次外部 HTTP 调用。
- **`ClassSerializerInterceptor` 已全局启用**：实体上可用 `@Exclude()` 等 class-transformer 装饰器控制输出。
- **WebSocket**：`WebsocketGateway` 事件名 `Message`，`pingInterval: 5000`、`pingTimeout: 10000`、`cors.origin: '*'`；`WebsocketService` 维护 `clientId -> Socket` 映射并已从 `WebsocketModule` 导出，需要主动推送时注入该 Service（`TestController` 是现成示例）。
- **WebSocket 消息协议**：`{ type, subType, mid, payload: { content } }`；`type` 1=连接、2=断开、3=ack、5=聊天消息，`type=5` 时前端按 `subType` 渲染（1 猜你想问、2 faq、3 订单）。完整说明见 `socket-test-client.js` 末尾注释。

## 5. 数据库

- 实体放 `entities/*.entity.ts`，在所属模块用 `TypeOrmModule.forFeature([...])` 注册；根配置开了 `autoLoadEntities: true`，无需再维护实体清单。
- `synchronize` 由 `DB_SYNCHRONIZE` 决定，仅 `.env.test` 为 `true`。仓库暂无迁移目录，schema 变更目前靠这个开关同步，**改生产/预发库前先人工确认**，不要把 `DB_SYNCHRONIZE=true` 带进非测试环境。
- 修改实体字段时，同步检查 DTO 校验、e2e 断言，以及依赖该字段的前端（`../web-app`）。

## 6. 环境变量

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `NODE_ENV` | 决定加载哪个 `.env.*` | `development` |
| `PORT` | HTTP 端口 | 3000（`.env.development` 为 3002） |
| `DB_TYPE` | `mysql` / `sqlite` | `mysql` |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` | MySQL 连接 | `localhost` / `3306` / `root` / 空 |
| `DB_DATABASE` | 库名（测试为 `:memory:`） | `nest_db` |
| `DB_SYNCHRONIZE` | 是否自动同步表结构 | `false` |

`.env.development`、`.env.pre`、`.env.production`、`.env.test` 目前都**已提交到仓库**（`.gitignore` 只忽略 `.env`、`.env.*.local`、`.env.sample`）。往这些文件里加敏感信息前先确认是否真的要入库。

## 7. 代码风格

- Prettier：`singleQuote: true`、`trailingComma: all`；提交前跑 `npm run format` 与 `npm run lint`。
- ESLint 用 flat config + `typescript-eslint` 的 `recommendedTypeChecked`；`@typescript-eslint/no-explicit-any` 已关闭，`no-floating-promises` 与 `no-unsafe-argument` 为 warn，`prettier/prettier` 为 error。
- `eslint.config.mjs` 与 `src/agent/index.ts` 在 ESLint 中被忽略，改动这两处不会有 lint 保护。
- TypeScript：`module`/`moduleResolution` 为 `nodenext`，`strictNullChecks: true`，但 `noImplicitAny: false`、`strictBindCallApply: false`；装饰器与 `emitDecoratorMetadata` 已开启（改 tsconfig 时别关掉）。
- 业务日志目前多为 `console.log`/`console.error`；在 Nest 代码里新增日志优先用内置 `Logger`。

## 8. 依赖与脚本注意事项

- 新增依赖用 `npm install <pkg>`，保持 `package-lock.json` 同步。
- `src/agent/index.ts` 从 `zod` 导入，但 `zod` 并未在 `package.json` 中直接声明（现由 langchain 间接装出 4.x）。若要正式使用该脚本，请显式声明依赖，并注意它需要本地 Ollama（默认 `qwen3:4b`）。

## 9. 提交与协作

- Git 根在上级目录，`git status` 的路径可能超出本目录；当前工作区已有 `../web-app/src/App.jsx` 的未提交改动，**不要顺手把无关改动一起提交**。
- `dist/`、`logs/`、`node_modules/`、`coverage/` 已被忽略，不要提交构建产物。
- 新建分支使用 `codex/` 前缀（除非用户另有要求）。

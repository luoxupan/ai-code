# AGENTS.md — web-app

本文件面向在本目录（`web-app`）中工作的编码代理。动手前请先读完，命令与约定以本文件为准。

## 1. 项目概览

- React 19 + Vite 7 的纯前端 SPA，以 JavaScript 为主、局部 TypeScript；无服务端代码、无测试框架。
- 路由用 `react-router-dom` v7（`BrowserRouter` 在 `src/main.jsx`，路由表在 `src/App.jsx`），全局状态用 `jotai`。
- 实时通信走 `socket.io-client`，后端是同级目录的 `../node-server`（NestJS，socket.io 网关，端口 3002，事件名 `Message`）。
- 页面：`/`（Vite 模板首页 + Jotai 计数器示例）、`/table`（数据表格）、`/websocket`（连接状态）、`/chatbot`（聊天页，唯一隐藏顶部导航的路由）。
- Git 仓库根在上级目录 `/Users/luoxupan/ai-code`（同时含 `node-server`、`python` 等子项目），本目录只是其中一个。`README.md` 仍是 Vite 默认模板，不能当项目文档用。

## 2. 常用命令

```bash
npm install     # 安装依赖（有 package-lock.json，勿换包管理器）

npm run dev     # vite dev server，默认 http://localhost:5173
npm run build   # 产物输出到 dist/（已 gitignore）
npm run preview # 预览 dist/
npm run lint    # eslint .
```

- `vite.config.js` 只注册了 react 插件，**没有端口、代理、别名配置**：不存在 `/api` 代理，后端地址都在代码里硬编码成 `localhost:3002`。
- 没有 `test`、`typecheck` 脚本。`.ts`/`.tsx` 只经 Vite(esbuild) 转译，**不做类型检查**，类型写错只会在编辑器里报，构建照样过。
- 联调聊天/WebSocket 前先起后端：`cd ../node-server && npm run start:dev`（监听 3002）。
- `npm run lint` 目前**会以非 0 退出**，原因见第 7 节。

## 3. 目录结构与新增文件放哪

```
src/
  main.jsx                  # 入口：StrictMode + BrowserRouter，并引入 utils/rem.js、index.css
  App.jsx                   # 顶部导航 + <Routes> 路由表
  index.css / App.css       # 全局样式；App.css 的 :root 里是设计变量
  pages/                    # 一个路由一个页面：XxxPage.jsx + 同名 XxxPage.css
  components/               # 通用组件；聊天相关全放 components/chatbot/
  store.ts                  # 示例 atom（countAtom）
  store/chatbotAtoms.ts     # 聊天相关 atom
  services/socketService.ts # socket.io 单例封装
  constants/chat.ts         # 消息 type / subType 常量
  utils/rem.js              # rem 适配（入口副作用，全局改写 html 字号）
```

新增页面的标准做法：写 `src/pages/FooPage.jsx` + `src/pages/FooPage.css` → 在 `src/App.jsx` 里注册 `<Route path="/foo" element={<FooPage />} />` → 需要可从导航进入时，再往 `.nav-links` 加 `<Link>`。

## 4. 运行时架构

**路由与布局**

- `App.jsx` 中 `showNavbar = location.pathname !== '/chatbot'`：聊天页是全屏无导航布局。加新路由时别破坏这个判断。

**状态（Jotai）**

- 一律用 `useAtom(atom)` 读写；跨组件共享的状态提到 `src/store/`，不要在页面里自建全局状态。
- 现有 atom：`countAtom`（示例）、`socketStatusAtom`、`messagesAtom`、`inputTextAtom`。
- `jotai-immer` 已在依赖里但**未被使用**；要改嵌套消息结构可以直接用它，或继续现有的不可变写法。
- `messagesAtom` 目前是无类型的 `atom([])`；`store/chatbotAtoms.ts` 顶部那段注释块才是消息结构的“文档”，改字段时同步更新它。

**WebSocket 与聊天数据流**

- `src/services/socketService.ts` 是单例（`SocketService.getInstance()`），统一负责连接、ACK、6 秒发送超时。**不要在组件里直接 `io()`**（`WebSocketPage.jsx` 是历史遗留的反例）。
- 消息协议：`{ type, subType, mid, payload: { content } }`；`type` 1=连接、2=断开、3=ACK、5=聊天。`type=5` 时前端按 `subType` 渲染（0 纯文本、1 猜你想问、2 FAQ、3 订单）。常量在 `src/constants/chat.ts`，后端侧完整说明见 `../node-server/socket-test-client.js` 末尾注释。
- 发送：`MessageInput` 用 `uuid` 生成 `mid`，先乐观插入 `status: 'sending'`，等 ACK 置 `'success'`，超时置 `'failed'`。这三个状态要和 `UserMessage` 的展示保持同步。
- 接收：`socketService` 收到服务端 `Message` 后先自动回 ACK（同 `mid` 的 ACK 用来 resolve 发送 Promise），再广播给 `onMessage` 订阅者；`ChatbotPage` 补 `sender: 'system'` 后写入 `messagesAtom`。
- 渲染：`MessageRenderer` 按 `type/subType` 分发，`type=3`(ACK) 和没有 `payload.content` 的一律不渲染。**新增卡片类型 = 三步**：`constants/chat.ts` 加 `SUB_TYPE` → `components/chatbot/` 加组件 → 在 `components/chatbot/index.ts` 的 `messageComponentMap` 注册。
- 历史：聊天记录存在 `localStorage` 的 `chatbot_history`（无版本号、无大小限制），`ChatbotPage` 挂载时读、`messages` 变化时写；改消息结构要考虑老数据兼容。

## 5. 样式约定

- 每个页面/组件配一个同名同目录的 `.css`，用普通类名，没有 CSS Modules、Tailwind 或预处理器。
- 设计变量集中在 `src/App.css` 的 `:root`（`--bg-primary`、`--accent-primary: #00ffaa`、`--accent-secondary`、`--glow-primary` 等），整体是深色 + 荧光绿/青风格；新增配色走变量，别硬编码（`ChatbotPage.css` 里的裸色值是历史遗留）。
- 图标目前是直接写在 JSX 里的 emoji（`⚡`、`👥`、`📦`），不是图标库。
- **尺寸单位是 rem，且被 `src/utils/rem.js` 全局改写**：设计稿宽 750、`baseVal = 100`，即 `html { font-size: 100 * min(视口宽, 750) / 750 }px`，视口超过 750px 后不再放大。换算规则是“设计稿 px ÷ 100 = rem”，如设计稿 16px 写 `0.16rem`。
- 注意 `src/index.css` 里有全局的 `h1, p, div, span, a { font-size: .4rem }`，在桌面宽度下等于 40px，是模板样式与 rem 方案叠加的结果；新页面字号异常先看这条。`ChatbotPage.css` 用 `px`/`em` 属于例外写法。

## 6. 代码风格

- 2 空格缩进；页面/组件多为无分号风格，而 `services/`、`store/`、`constants/` 下的 `.ts` 带分号——同一文件内保持一致即可。没有 Prettier 配置，也没有提交钩子。
- 模块后缀写法不统一：`store.ts`、`services/socketService.ts`、`components/chatbot/index.ts` 显式带 `.ts`，而 `pages/*.jsx` 里 `import TableComponent from '../components/TableComponent'` 又不带后缀。**跟着被改文件附近的写法走**，不要做全库统一。
- ESLint 是 flat config，`files: ['**/*.{js,jsx}']`：只覆盖 JS/JSX，`**/*.ts`、`**/*.tsx` 不受 lint 保护。`no-unused-vars` 忽略 `^[A-Z_]` 开头的名字，所以 `import React from 'react'` 不报错。
- 注释与 UI 文案以中文为主，保持现状。

## 7. 已知问题（不要当成规范照抄）

`npm run lint` 当前有 4 个 error，都是既有问题：

- `src/components/chatbot/FaqCard.jsx`、`OrderCard.jsx`：`catch (e)` 中 `e` 未使用；`FaqCard.jsx` 里还有两行无意义的 `React.useCallback;`、`React.useMemo;`。
- `src/pages/WebSocketPage.jsx`：`socket` 状态未使用；`useEffect` 中同步 `setSocket(...)` 触发 `react-hooks/set-state-in-effect`；清理函数里的 `disconnect()` 被注释掉，**离开页面不会断开连接**。
- `src/pages/WebSocketPage.jsx` 自行 `io('http://localhost:3002')`，绕开 `socketService` 单例，与聊天页同时使用时会出现第二条连接。
- `src/components/EditText.tsx` 是空壳（`count` 未使用），不是待扩展的模板。
- 后端地址（`ws://localhost:3002`、`http://localhost:3002`）硬编码在两处，没有环境变量/`.env` 支持。
- `ChatbotPage` 已不主动连接（初始连接代码被注释），只在首次发送时懒连接；开发模式 `StrictMode` 会双跑 effect，连接/断开会来回切换。

修东西时顺手清掉同文件内的这类问题是合适的；但**不要为了降低 error 数去改无关文件**。

## 8. 验证清单

改完至少跑：

```bash
npm run lint
npm run build
```

- `npm run build` 必须通过；`npm run lint` 只应剩下第 7 节中你未触及文件的历史 error。
- 聊天相关改动，手动验证：起 `../node-server`，进 `/chatbot` 发一条纯文本 → 状态由“发送中…”变为成功；停掉后端再发 → 6 秒后显示“发送失败”。
- 表格/首页改动，进对应路由看排序、空数据、以及视口小于 750px 时的表现。

## 9. 其他目录说明

- `openspec/`：spec-driven 工作流目录，`openspec` CLI（v1.2.0）已全局安装，目前 `specs/`、`changes/` 为空。`openspec/config.yaml` 的 `context` 仍是注释模板，走该工作流前先补上项目上下文。
- `.qoder/`、`.iflow/`：给 Qoder / iFlow 等工具用的命令与 skill 副本（`opsx-*`、`frontend-design`、`newcomp`、`security-review`），不是运行时依赖，也不参与构建；两边内容基本重复。
- `table-page-screenshot.jpg`：数据表格页的效果截图。

## 10. 提交与协作

- Git 根在上级目录，`git status` 会出现本目录之外的路径（如 `../node-server/...`）；**只提交自己改的文件**，不要顺手带上别人的未提交改动。
- `dist/`、`node_modules/` 已被忽略，不要提交构建产物。
- 新建分支用 `codex/` 前缀（除非用户另有要求）。
- 历史提交信息全是 `update`，没有规范约束；新提交写更具体的描述即可。

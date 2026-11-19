/**
 * GitHub MCP 接入：把 GitHub 官方 MCP Server 暴露的工具，转换成 LangChain 可用的 tool。
 *
 * ══ 为什么不用 `api.githubcopilot.com/mcp/` 这个 Remote MCP ═══════════════
 *
 *  GitHub 那个官方「远程」MCP 端点只支持 OAuth / 交互式浏览器登录，没有后端可用的
 *  PAT（Bearer token）直连方式，不适合本 NestJS 无交互环境。
 *  因此这里接入的是 GitHub 官方的**本地 stdio MCP Server**（github-mcp-server），
 *  通过环境变量 `GITHUB_PERSONAL_ACCESS_TOKEN` 注入 PAT，正是官方推荐给
 *  headless / CI 场景的做法。
 *
 * ══ 运行方式 ════════════════════════════════════════════════════════════
 *
 *  用 StdioClientTransport 直接以 `node` 拉起本地安装的 github-mcp-server
 *  子进程（@modelcontextprotocol/server-github 包），进程内长期驻留、复用同一
 *  条 stdio 通道。tools 加载失败时降级为空数组，不阻断 Nest 启动
 *  （与 Qdrant/Embedding 的降级策略一致）。
 */

import { tool } from 'langchain';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve } from 'node:path';
import { z } from 'zod';

/** github-mcp-server 的本地入口（由 @modelcontextprotocol/server-github 包提供）。 */
const GITHUB_SERVER_PATH = resolve(
  'node_modules/@modelcontextprotocol/server-github/dist/index.js',
);

/** 启动 github-mcp-server 用的环境变量，含 PAT 认证信息。 */
const buildServerEnv = (): Record<string, string> => {
  // process.env 是 Record<string, string | undefined>，这里只保留字符串值，
  // 满足 StdioServerParameters.env 的 Record<string, string> 约束。
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  // 优先读 GITHUB_PERSONAL_ACCESS_TOKEN，其次 GITHUB_TOKEN
  const token =
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
  if (token) {
    env.GITHUB_PERSONAL_ACCESS_TOKEN = token;
  }

  return env;
};

let clientPromise: Promise<ReturnType<typeof tool>[]> | undefined;

/**
 * 把 MCP 工具的 JSON Schema 转成 zod schema。
 * MCP 的 inputSchema 是 JSON Schema 草案，这里只做一层宽松兜底：
 * 有可解析的 properties 就逐项映射，否则退回空对象（模型凭 description 调用）。
 */
const jsonSchemaToZod = (inputSchema: unknown): z.ZodTypeAny => {
  const schema = (inputSchema ?? {}) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };

  if (!schema.properties) {
    return z.object({});
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, raw] of Object.entries(schema.properties)) {
    const prop = (raw ?? {}) as {
      type?: string;
      description?: string;
    };

    let field: z.ZodTypeAny;
    switch (prop.type) {
      case 'string':
        field = z.string();
        break;
      case 'number':
      case 'integer':
        field = z.number();
        break;
      case 'boolean':
        field = z.boolean();
        break;
      case 'array':
        field = z.array(z.unknown());
        break;
      case 'object':
        field = z.record(z.string(), z.unknown());
        break;
      default:
        field = z.unknown();
    }

    if (typeof prop.description === 'string') {
      field = field.describe(prop.description);
    }

    // 非必填字段设为可选
    shape[key] = schema.required?.includes(key) ? field : field.optional();
  }

  return z.object(shape);
};

/**
 * 连接 github-mcp-server，把它的工具逐个转成 LangChain DynamicStructuredTool。
 * 返回 Promise 并缓存，保证进程内只建一条连接、只加载一次。
 */
export const loadGithubMcpTools = (): Promise<ReturnType<typeof tool>[]> => {
  clientPromise ??= (async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [GITHUB_SERVER_PATH],
      env: buildServerEnv(),
    });

    const client = new Client(
      { name: 'node-server', version: '1.0.0' },
      { capabilities: {} },
    );

    await client.connect(transport);
    const { tools: mcpTools } = await client.listTools();

    return mcpTools.map((t) =>
      tool(
        async (input) => {
          const result = await client.callTool({
            name: t.name,
            // GitHub 工具的 arguments 里既有 string 也有 number/boolean（如 perPage、page），
            // 必须按原始类型透传，否则会被 server 的 zod 校验拒绝（number 收到 string）。
            // SDK 的类型定义把 arguments 收紧成 Record<string, string>，这里用断言放宽。
            arguments: input as Record<string, string>,
          });

          const content = (result.content ?? []) as Array<
            { type: 'text'; text: string } | Record<string, unknown>
          >;
          return content
            .map((part) => {
              if (part.type === 'text') {
                return part.text;
              }
              return JSON.stringify(part);
            })
            .join('\n');
        },
        {
          name: t.name,
          description: t.description ?? `调用 GitHub MCP 工具 ${t.name}`,
          schema: jsonSchemaToZod(t.inputSchema),
        },
      ),
    );
  })().catch((error) => {
    // 连接失败时重置缓存，下次调用可重试；同时降级返回空数组，不影响服务启动
    clientPromise = undefined;
    console.error('[github-mcp] 连接失败，已降级为不加载 GitHub 工具：', error);
    return [] as ReturnType<typeof tool>[];
  });

  return clientPromise;
};

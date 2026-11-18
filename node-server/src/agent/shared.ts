/**
 * langchain.ts 与 langgraph.ts 的共用部分。
 *
 * 两个实现只在“怎么编排 agent”上不同（createAgent vs StateGraph），
 * 下面这些与编排无关的代码统一放这里，避免两边各抄一份：
 * - DeepSeekChatModel：把 GLM 的 OpenAI 兼容接口适配成 LangChain 的 BaseChatModel
 * - SYSTEM_PROMPT：企业在线客服的系统提示
 * - RECURSION_LIMIT / buildAgentConfig：调用时的递归上限与 thread_id 配置
 * - extractFinalText / invokeAgentWith：带 wsClientId 上下文调用 agent 并取最后一条回复
 *
 * 工具集合见 ./tools，工具用它需要的 wsClientId 上下文见 ./context。
 */

import { AIMessage, HumanMessage } from '@langchain/core/messages';
import {
  BaseChatModel,
  BindToolsInput,
} from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import { ChatResult } from '@langchain/core/outputs';
import { MODEL_CONF } from './conf';
import { runWithAgentContext } from './context';

type DeepSeekTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: unknown;
  };
};

export class DeepSeekChatModel extends BaseChatModel {
  private readonly tools?: DeepSeekTool[];

  private readonly toolChoice?: unknown;

  constructor(fields: { tools?: DeepSeekTool[]; toolChoice?: unknown } = {}) {
    super({ disableStreaming: true });
    this.tools = fields.tools;
    this.toolChoice = fields.toolChoice;
  }

  bindTools(tools: BindToolsInput[], kwargs?: Record<string, unknown>) {
    return new DeepSeekChatModel({
      tools: tools.map((candidate) => {
        const candidateRecord = candidate as Record<string, unknown>;
        const schema = candidateRecord.schema as
          | {
              toJSONSchema?: () => unknown;
            }
          | undefined;

        return {
          type: 'function',
          function: {
            name: String(candidateRecord.name),
            description:
              typeof candidateRecord.description === 'string'
                ? candidateRecord.description
                : '',
            parameters: schema?.toJSONSchema?.() ?? schema ?? {},
          },
        };
      }),
      toolChoice: kwargs?.tool_choice,
    });
  }

  /**
   * LangChain 的消息内容可能是 string，也可能是 [{ type: 'text', text }] 内容块数组。
   * GLM 的 OpenAI 兼容接口只接受字符串，这里统一拍平成文本，否则系统提示会变成 [object Object]。
   */
  private contentToText(content: BaseMessage['content']): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }
          const record = part as Record<string, unknown>;
          return typeof record.text === 'string'
            ? record.text
            : JSON.stringify(part);
        })
        .join('');
    }
    return JSON.stringify(content);
  }

  private toApiMessage(message: BaseMessage): Record<string, unknown> {
    const content = this.contentToText(message.content);
    const result: Record<string, unknown> = {
      role:
        message.type === 'human'
          ? 'user'
          : message.type === 'ai'
            ? 'assistant'
            : message.type === 'system'
              ? 'system'
              : 'tool',
      content,
    };

    const messageRecord = message as unknown as Record<string, unknown>;
    if (message.type === 'ai' && Array.isArray(messageRecord.tool_calls)) {
      result.tool_calls = (
        messageRecord.tool_calls as Record<string, unknown>[]
      ).map((call) => ({
        id: call.id,
        type: 'function',
        function: {
          name: call.name,
          arguments: JSON.stringify(call.args ?? {}),
        },
      }));
    }
    if (message.type === 'tool') {
      result.tool_call_id = messageRecord.tool_call_id;
    }

    return result;
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const response = await fetch(MODEL_CONF.base_url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MODEL_CONF.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_CONF.model,
        messages: messages.map((message) => this.toApiMessage(message)),
        ...(this.tools ? { tools: this.tools } : {}),
        ...(this.toolChoice ? { tool_choice: this.toolChoice } : {}),
      }),
    });

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
      usage?: Record<string, unknown>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(
        `request failed (${response.status}): ${payload.error?.message ?? 'unknown error'}`,
      );
    }

    const message = payload.choices?.[0]?.message;
    if (!message) {
      throw new Error('DeepSeek returned no message');
    }

    const toolCalls = message.tool_calls?.map((call) => ({
      id: call.id,
      name: call.function.name,
      args: JSON.parse(call.function.arguments) as Record<string, unknown>,
      type: 'tool_call' as const,
    }));
    const aiMessage = new AIMessage({
      content: message.content ?? '',
      ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
    });

    return {
      generations: [
        {
          text: message.content ?? '',
          message: aiMessage,
        },
      ],
      llmOutput: payload.usage ? { tokenUsage: payload.usage } : undefined,
    };
  }

  _llmType(): string {
    return 'deepseek';
  }
}

export const SYSTEM_PROMPT = `你是企业在线客服助手，用简洁的中文回答用户问题。

规则：
1. 用户询问产品功能、使用方法、账号、订单、邮件、退款、采购、客服时间等任何业务相关问题时，必须先调用 search_faq 工具检索 FAQ 知识库，再根据检索结果回答，不要凭空猜测。
2. search_faq 命中后，系统会自动向用户推送 FAQ 卡片。你只需做简短补充、确认或引导追问，不要整段复述卡片里的问题和答案。
3. search_faq 没有命中时，可以基于通用常识回答，但要说明这是通用建议，并引导用户联系人工客服。
4. 与业务无关的问题（闲聊、写作、天气等）不要调用 search_faq，直接回答。`;

/** 与 createAgent 默认的递归上限保持一致，避免工具调用死循环。 */
export const RECURSION_LIMIT = 25;

type AgentRunConfig = {
  recursionLimit: number;
  configurable?: { thread_id: string };
};

/**
 * 两种实现里都编译了 checkpointer，因此只有传了 threadId 才能落盘；
 * 没传时与原 index.ts 语义一致——不带 thread_id，会话不记忆。
 */
export const buildAgentConfig = (threadId?: string): AgentRunConfig => ({
  recursionLimit: RECURSION_LIMIT,
  ...(threadId ? { configurable: { thread_id: threadId } } : {}),
});

/** 取最后一条消息的文本；内容块数组按 JSON 字符串返回。 */
export const extractFinalText = (messages: BaseMessage[]): string => {
  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    return '';
  }

  return typeof lastMessage.content === 'string'
    ? lastMessage.content
    : JSON.stringify(lastMessage.content);
};

/**
 * 两个实现编译出的图在调用层是同构的（输入 messages、输出带 messages 的状态），
 * 这里只依赖这一点，不耦合具体是 createAgent 还是 StateGraph。
 */
export type AgentRunner = {
  invoke(
    input: { messages: BaseMessage[] },
    config: AgentRunConfig,
  ): Promise<{ messages: BaseMessage[] }>;
};

/** 带 wsClientId 上下文调用 agent，返回最后一条模型回复。 */
export const invokeAgentWith = async (
  agent: AgentRunner,
  message: string,
  threadId?: string,
  wsClientId?: string,
): Promise<string> => {
  const response = await runWithAgentContext(wsClientId ?? threadId ?? '', () =>
    agent.invoke(
      { messages: [new HumanMessage(message)] },
      buildAgentConfig(threadId),
    ),
  );

  return extractFinalText(response.messages);
};

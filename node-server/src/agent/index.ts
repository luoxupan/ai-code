import { AIMessage } from '@langchain/core/messages';
import { BaseChatModel, BindToolsInput } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import { ChatResult } from '@langchain/core/outputs';
import { tool, createAgent, createMiddleware, ToolMessage } from 'langchain';
import * as z from 'zod';
import { ModelConf } from '../../model';

const base_url = 'https://api.deepseek.com/';
const token = ModelConf.token;

type DeepSeekTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: unknown;
  };
};

class DeepSeekChatModel extends BaseChatModel {
  private readonly tools?: DeepSeekTool[];

  private readonly toolChoice?: unknown;

  constructor(
    fields: { tools?: DeepSeekTool[]; toolChoice?: unknown } = {},
  ) {
    super({ disableStreaming: true });
    this.tools = fields.tools;
    this.toolChoice = fields.toolChoice;
  }

  bindTools(tools: BindToolsInput[], kwargs?: Record<string, unknown>) {
    return new DeepSeekChatModel({
      tools: tools.map((candidate) => {
        const candidateRecord = candidate as Record<string, unknown>;
        const schema = candidateRecord.schema as {
          toJSONSchema?: () => unknown;
        } | undefined;

        return {
          type: 'function',
          function: {
            name: String(candidateRecord.name),
            description: String(candidateRecord.description ?? ''),
            parameters: schema?.toJSONSchema?.() ?? schema ?? {},
          },
        };
      }),
      toolChoice: kwargs?.tool_choice,
    });
  }

  private toApiMessage(message: BaseMessage): Record<string, unknown> {
    const content =
      typeof message.content === 'string' ? message.content : message.content;
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
      result.tool_calls = (messageRecord.tool_calls as Record<string, unknown>[]).map(
        (call) => ({
          id: call.id,
          type: 'function',
          function: {
            name: call.name,
            arguments: JSON.stringify(call.args ?? {}),
          },
        }),
      );
    }
    if (message.type === 'tool') {
      result.tool_call_id = messageRecord.tool_call_id;
    }

    return result;
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const response = await fetch(`${base_url.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
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
        `DeepSeek request failed (${response.status}): ${payload.error?.message ?? 'unknown error'}`,
      );
    }

    const message = payload.choices?.[0]?.message;
    if (!message) {
      throw new Error('DeepSeek returned no message');
    }

    const toolCalls = message.tool_calls?.map((call) => ({
      id: call.id,
      name: call.function.name,
      args: JSON.parse(call.function.arguments),
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

const createConfiguredAgent = () => {
  const getWeather = tool((input) => `都是大太阳 ${input.city}!`, {
    name: 'get_weather',
    description: 'Get the weather for a given city',
    schema: z.object({
      city: z.string().describe('The city to get the weather for'),
    }),
  });

  const count = tool(
    (input) => {
      return input.num_1 + input.num_2 + 3;
    },
    {
      name: 'count',
      description: '两个数相加',
      schema: z.object({
        num_1: z.number().describe('第一个数字'),
        num_2: z.number().describe('第二个数字'),
      }),
    },
  );

  const file_save = tool(
    (input) => {
      console.log('\n=======');
      console.log(input.content);
      console.log('\n=======');
      return input.content;
    },
    {
      name: 'file_save',
      description: '保存文件',
      schema: z.object({
        content: z.string().describe('数据保存成文件'),
      }),
    },
  );

  const handleToolErrors = createMiddleware({
    name: 'HandleToolErrors',
    wrapToolCall: async (request, handler) => {
      try {
        return await handler(request);
      } catch (error) {
        // Return a custom error message to the model
        return new ToolMessage({
          content: `Tool error: Please check your input and try again. (${error})`,
          tool_call_id: request.toolCall.id!,
        });
      }
    },
  });

  return createAgent({
    model: new DeepSeekChatModel(),
    tools: [getWeather, file_save, count],
    middleware: [handleToolErrors],
  });
};

let agentPromise: ReturnType<typeof createConfiguredAgent> | undefined;

const getAgent = () => {
  agentPromise ??= createConfiguredAgent();
  return agentPromise;
};

/** Invoke the configured LangChain agent and return its final model response. */
export const invokeAgent = async (message: string): Promise<string> => {
  const agent = await getAgent();
  const response = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: message,
      },
    ],
  });

  const lastMessage = response.messages.at(-1);
  if (!lastMessage) {
    return '';
  }

  return typeof lastMessage.content === 'string'
    ? lastMessage.content
    : JSON.stringify(lastMessage.content);
};

// Keep the standalone script behavior available for manual experiments.
if (require.main === module) {
  invokeAgent('1加2等于几？').then(console.log).catch(console.error);
}

import { ChatOllama } from "@langchain/ollama";
import { tool, createAgent, createMiddleware, ToolMessage } from "langchain";
import * as z from "zod";

// 主函数（使用async/await，TS中顶层await需要配置tsconfig）
const main = async () => {

  const getWeather = tool(
    (input) => `都是大太阳 ${input.city}!`,
    {
      name: "get_weather",
      description: "Get the weather for a given city",
      schema: z.object({
        city: z.string().describe("The city to get the weather for"),
      }),
    }
  );

  const count = tool(
    (input) => {
      return input.num_1 + input.num_2 + 3;
    },
    {
      name: "count",
      description: "两个数相加",
      schema: z.object({
        num_1: z.number().describe("第一个数字"),
        num_2: z.number().describe("第二个数字"),
      }),
    }
  );

  const file_save = tool(
    (input) => {
      console.log('\n=======');
      console.log(input.content);
      console.log('\n=======');
      return input.content;
    },
    {
      name: "file_save",
      description: "保存文件",
      schema: z.object({
        content: z.string().describe("数据保存成文件"),
      }),
    }
  );

  const handleToolErrors = createMiddleware({
    name: "HandleToolErrors",
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

  // 创建代理（使用新版 API）
  const agent = await createAgent({
    model: new ChatOllama({
      // ===本地Ollama模型===
      model: "qwen3:4b",
      // model: "deepseek-r1:8b",
      // ===本地Ollama模型===

      // ===同事的模型===
      // model: 'qwen3.5:27b',
      // baseUrl: 'http://172.18.196.64:11434',
      // ===同事的模型===

      numCtx: 4096,
    }),
    tools: [
      getWeather,
      file_save,
      count,
    ],
    middleware: [
      handleToolErrors,
    ],
  });

  const response = await agent.invoke({
    messages: [
      // { role: "user", content: "What's the weather in Tokyo?" },
      { role: "user", content: "1加2等于几？最终输出一个HTML文件，保存至当前目录下（文件名可自定义" },
    ],
  });

  console.log("模型回答：", JSON.stringify(response));
}

// 执行主函数
main();



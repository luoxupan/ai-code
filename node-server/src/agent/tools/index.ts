import { tool } from 'langchain';
import * as z from 'zod';

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

export const tools = [
  getWeather,
  file_save,
  count,
];

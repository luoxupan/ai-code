import { tool } from 'langchain';
import * as z from 'zod';
import { getAgentContext } from '../context';

type UserRecord = {
  name: string; // 中文名
  name_en: string; // 英文名
  user_id: number;
  email: string;
};

type UserLoader = () => Promise<UserRecord[]>;

type DisconnectHandler = (wsClientId: string) => Promise<boolean> | boolean;

type MailCardContent = {
  recipients?: string;
  subject?: string;
  body?: string;
};

type MailCardHandler = (
  wsClientId: string,
  content: string,
) => Promise<boolean> | boolean;

let disconnectHandler: DisconnectHandler | undefined;

/** Configure the WebSocket disconnect handler used by the disconnect tool. */
export const configureDisconnectHandler = (
  handler: DisconnectHandler,
): void => {
  disconnectHandler = handler;
};

let mailCardHandler: MailCardHandler | undefined;

/** Configure the WebSocket handler used by the mail card tool. */
export const configureMailCardHandler = (handler: MailCardHandler): void => {
  mailCardHandler = handler;
};

type FaqSearchHit = {
  id: number;
  question: string;
  answer: string;
  score: number;
};

type FaqSearchHandler = (
  query: string,
) => Promise<{ hits: FaqSearchHit[]; cardPushed: boolean }>;

let faqSearchHandler: FaqSearchHandler | undefined;

/** Configure the FAQ retrieval handler used by the search_faq tool. */
export const configureFaqSearchHandler = (handler: FaqSearchHandler): void => {
  faqSearchHandler = handler;
};

let userLoader: UserLoader | undefined;

/** Configure the database-backed user loader used by the get_user tool. */
export const configureUserLoader = (loader: UserLoader): void => {
  userLoader = loader;
};

export const getUser = tool(
  async () => {
    if (!userLoader) {
      throw new Error('User loader has not been configured');
    }

    const users = await userLoader();
    return users
      .map(
        (user) => `${user.name},${user.name_en},${user.email},${user.user_id}`,
      )
      .join('\n');
  },
  {
    name: 'get_user',
    description: '获取当前项目数据库 user 表中的所有用户',
    schema: z.object({}),
  },
);

export const disconnectWebsocket = tool(
  async () => {
    const wsClientId = getAgentContext()?.wsClientId;

    if (!wsClientId) {
      throw new Error('WebSocket client context is not available');
    }

    if (!disconnectHandler) {
      throw new Error('WebSocket disconnect handler has not been configured');
    }

    const disconnected = await disconnectHandler(wsClientId);
    return disconnected
      ? `WebSocket ${wsClientId} 已断开`
      : `WebSocket ${wsClientId} 不存在`;
  },
  {
    name: 'disconnect_websocket',
    description: '断开当前 WebSocket 连接',
    schema: z.object({}),
  },
);

export const sendMailCard = tool(
  async (input) => {
    const wsClientId = getAgentContext()?.wsClientId;

    if (!wsClientId) {
      throw new Error('WebSocket client context is not available');
    }

    if (!mailCardHandler) {
      throw new Error('WebSocket mail card handler has not been configured');
    }

    const mailCardContent: MailCardContent = {
      ...(input.recipients ? { recipients: input.recipients } : {}),
      ...(input.subject ? { subject: input.subject } : {}),
      ...(input.body ? { body: input.body } : {}),
    };
    const delivered = await mailCardHandler(
      wsClientId,
      JSON.stringify(mailCardContent),
    );

    return delivered
      ? '已推送发送邮件卡片'
      : 'WebSocket 客户端不存在，发送邮件卡片推送失败';
  },
  {
    name: 'send_mail_card',
    description:
      '当用户表示想要发送邮件时，推送发送邮件卡片；可传入已知的收件人、主题和内容作为预填信息',
    schema: z.object({
      recipients: z
        .string()
        .optional()
        .describe('收件人邮箱地址，多个邮箱用英文逗号分隔'),
      subject: z.string().optional().describe('邮件主题'),
      body: z.string().optional().describe('邮件内容'),
    }),
  },
);

const getWeather = tool(
  (input) => `天气是大太阳，温度20摄氏度，有微风 ${input.city}!`,
  {
    name: 'get_weather',
    description: 'Get the weather for a given city',
    schema: z.object({
      city: z.string().describe('The city to get the weather for'),
    }),
  },
);

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

export const searchFaq = tool(
  async (input) => {
    if (!faqSearchHandler) {
      throw new Error('FAQ search handler has not been configured');
    }

    const { hits, cardPushed } = await faqSearchHandler(input.query);

    if (!hits.length) {
      return '未检索到相关 FAQ，请基于已有信息回答或引导用户换一种问法。';
    }

    const details = hits
      .map(
        (hit, index) =>
          `${index + 1}. 问题：${hit.question}\n   答案：${hit.answer}`,
      )
      .join('\n');

    return [
      cardPushed
        ? '已向用户推送 FAQ 卡片，用户可以直接看到上述问答，请不要再重复卡片内容。'
        : 'FAQ 卡片推送失败（当前会话没有可用的 WebSocket 客户端），请把答案直接告诉用户。',
      `检索到的 FAQ：\n${details}`,
    ].join('\n\n');
  },
  {
    name: 'search_faq',
    description:
      '查询产品 FAQ/常见问题知识库。当用户询问产品功能、使用方法、账号、订单、邮件或客服等常见问题时，先用该工具检索。',
    schema: z.object({
      query: z
        .string()
        .describe('用户问题的检索语句，尽量保留用户原话中的关键信息'),
    }),
  },
);

export const tools = [
  searchFaq,
  getUser,
  disconnectWebsocket,
  sendMailCard,
  getWeather,
  file_save,
  count,
];

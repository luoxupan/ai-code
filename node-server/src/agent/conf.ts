import { TokenConf } from '../../token';

// 保留 DeepSeek 的配置，方便切换模型（当前 MODEL_CONF 使用 glm）。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const deepseek = {
  token: TokenConf.deepseekToken,
  base_url: 'https://api.deepseek.com/chat/completions',
  model: 'deepseek-chat',
};
const glm = {
  token: TokenConf.glmToken,
  base_url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  model: 'glm-4-flash',
  // model: 'glm-5.3',
};

export const MODEL_CONF = {
  // ...deepseek,
  ...glm,
};

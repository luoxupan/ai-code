import { TokenConf } from '../../token';

const deepseek = {
  token: TokenConf.deepseekToken,
  base_url: 'https://api.deepseek.com/chat/completions',
  model: 'deepseek-chat',
};
const glm = {
  token: TokenConf.glmToken,
  base_url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  model: 'glm-5.3',
};

export const MODEL_CONF = {
  // ...deepseek,
  ...glm,
};


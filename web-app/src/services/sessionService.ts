import { SESSION_STATUS } from '../constants/chat.ts';

const API_BASE_URL = 'http://localhost:3002';

export type SessionInfo = {
  user_id: string;
  session_id: string;
  session_status: typeof SESSION_STATUS[keyof typeof SESSION_STATUS];
};

export const getSessionInfo = async (userId: string): Promise<SessionInfo> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/websocket/getSessionInfo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });

  if (!response.ok) {
    throw new Error(`获取会话信息失败: ${response.status}`);
  }

  return response.json();
};

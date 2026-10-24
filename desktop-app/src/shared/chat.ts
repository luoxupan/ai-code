export const MESSAGE_TYPE = {
  CONNECT: 1,
  DISCONNECT: 2,
  ACK: 3,
  CHAT: 5,
  ACTION: 6,
} as const;

export const SUB_TYPE = {
  PLAIN_TEXT: 0,
  GUESS_YOU_ASK: 1,
  FAQ_CARD: 2,
  ORDER_CARD: 3,
  MAIL_CARD: 4,
} as const;

export const SESSION_STATUS = {
  IN_PROGRESS: 1,
  ENDED: 2,
  TEMPORARY: 3,
} as const;

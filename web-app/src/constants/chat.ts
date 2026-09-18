export const MESSAGE_TYPE = {
  CONNECT: 1,
  DISCONNECT: 2,
  ACK: 3,
  CHAT: 5,
} as const;

export const SUB_TYPE = {
  // 0 is for plain text messages sent by the user
  PLAIN_TEXT: 0,
  GUESS_YOU_ASK: 1,
  FAQ_CARD: 2,
  ORDER_CARD: 3,
} as const;

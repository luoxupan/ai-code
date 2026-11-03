import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { v4 as uuidv4 } from 'uuid';
import { inputTextAtom, messagesAtom, replyPendingAtom } from '../../store/chatbotAtoms.ts';
import { MESSAGE_TYPE, SUB_TYPE } from '../../constants/chat.ts';
import { sendChatMessage } from './sendChatMessage.js';

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const GearIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ArrowUpIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const MessageInput = () => {
  const [text, setText] = useAtom(inputTextAtom);
  const setMessages = useSetAtom(messagesAtom);
  const setReplyPending = useSetAtom(replyPendingAtom);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;

    const mid = uuidv4();
    const newMessage = {
      mid,
      type: MESSAGE_TYPE.CHAT,
      subType: SUB_TYPE.PLAIN_TEXT, // Default to plain text, or decide based on input
      sender: 'user',
      status: 'sending',
      payload: {
        content: text,
      },
    };

    // Optimistically update the UI
    setMessages(prev => [...prev, newMessage]);
    setText('');

    await sendChatMessage(newMessage, setMessages);
    setReplyPending(true);
  };

  return (
    <form className="message-input-container" onSubmit={handleSend}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="输入消息"
        placeholder="Do anything"
      />
      <div className="message-input-toolbar">
        <div className="message-input-toolbar__left">
          {/* <button type="button" className="message-input-icon-btn" aria-label="添加附件">
            <PlusIcon />
          </button>
          <button type="button" className="message-input-icon-btn message-input-icon-btn--text">
            <GearIcon />
            <span>Custom</span>
          </button> */}
        </div>
        <div className="message-input-toolbar__right">
          <button type="button" className="message-input-model-btn">
            {/* <span>Custom</span>
            <strong>High</strong>
            <ChevronDownIcon /> */}
          </button>
          <button type="submit" className="message-input-send-btn" disabled={!text.trim()} aria-label="发送">
            <ArrowUpIcon />
          </button>
        </div>
      </div>
    </form>
  );
};

export default MessageInput;

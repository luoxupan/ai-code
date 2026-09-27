import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { v4 as uuidv4 } from 'uuid';
import { inputTextAtom, messagesAtom } from '../../store/chatbotAtoms.ts';
import { socketService } from '../../services/socketService.ts';
import { MESSAGE_TYPE, SUB_TYPE } from '../../constants/chat.ts';

const MessageInput = () => {
  const [text, setText] = useAtom(inputTextAtom);
  const setMessages = useSetAtom(messagesAtom);

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

    try {
      await socketService.sendMessage(newMessage);
      // On successful ACK, update message status
      setMessages(prev =>
        prev.map(msg => (msg.mid === mid ? { ...msg, status: 'success' } : msg))
      );
    } catch (error) {
      console.error(error);
      // On failure (timeout), update message status
      setMessages(prev =>
        prev.map(msg => (msg.mid === mid ? { ...msg, status: 'failed' } : msg))
      );
    }
  };

  return (
    <form className="message-input-container" onSubmit={handleSend}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="输入消息"
        placeholder="请输入消息..."
      />
      <button type="submit" disabled={!text.trim()}>发送</button>
    </form>
  );
};

export default MessageInput;

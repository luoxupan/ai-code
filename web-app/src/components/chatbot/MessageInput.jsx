import React from 'react';
import { useAtom } from 'jotai';
import { v4 as uuidv4 } from 'uuid';
import { inputTextAtom, messagesAtom } from '../../store/chatbotAtoms.ts';
import { socketService } from '../../services/socketService.ts';

const MessageInput = () => {
  const [text, setText] = useAtom(inputTextAtom);
  const [messages, setMessages] = useAtom(messagesAtom);

  const handleSend = async () => {
    if (!text.trim()) return;

    const mid = uuidv4();
    const newMessage = {
      mid,
      type: 5,
      subType: 0, // Default to plain text, or decide based on input
      sender: 'user',
      status: 'sending',
      payload: {
        content: text,
      },
    };

    // Optimistically update the UI
    setMessages([...messages, newMessage]);
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="message-input-container">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="请输入消息..."
      />
      <button onClick={handleSend}>发送</button>
    </div>
  );
};

export default MessageInput;

import React, { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { messagesAtom, socketStatusAtom } from '../store/chatbotAtoms.ts';
import { socketService } from '../services/socketService.ts';
import UserMessage from '../components/chatbot/UserMessage.jsx';
import SystemMessage from '../components/chatbot/SystemMessage.jsx';
import MessageRenderer from '../components/chatbot/MessageRenderer.jsx';
import MessageInput from '../components/chatbot/MessageInput.jsx';
import { sendChatMessage } from '../components/chatbot/sendChatMessage.js';
import './ChatbotPage.css';

const CHAT_HISTORY_KEY = 'chatbot_history';

const ChatbotPage = () => {
  const [messages, setMessages] = useAtom(messagesAtom);
  const [status, setStatus] = useAtom(socketStatusAtom);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load history from localStorage
    const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
    if (savedHistory) {
      setMessages(JSON.parse(savedHistory));
    }

    // Subscribe to service events
    const unsubscribeStatus = socketService.onStatusChange(setStatus);
    const unsubscribeMessage = socketService.onMessage((message) => {
      const newMessage = { ...message, sender: 'system' };
      setMessages((prev) => [...prev, newMessage]);
    });

    // Initial connection
    // socketService.connect().catch(err => {
    //   console.error("Initial connection failed", err);
    // });

    return () => {
      unsubscribeStatus();
      unsubscribeMessage();
      socketService.disconnect();
    };
  }, [setMessages, setStatus]);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
  }, [messages]);

  return (
    <div className="chatbot-page">
      <div className="header">
        <div className="header__identity">
          <span className="header__avatar" aria-hidden="true">AI</span>
          <div>
            <h1>智能客服</h1>
            <p>实时会话 · WebSocket</p>
          </div>
        </div>
        <div className={`connection-pill connection-pill--${status}`}>
          <span className="connection-dot" aria-hidden="true" />
          {status === 'connected' ? '在线' : status === 'connecting' ? '连接中' : '离线'}
        </div>
      </div>
      <div className="message-list" role="log" aria-live="polite" aria-label="聊天消息">
        {messages.length === 0 && (
          <div className="empty-state">
            <span aria-hidden="true">⚡</span>
            <strong>会话已就绪</strong>
            <p>发送第一条消息，开始与智能客服对话</p>
          </div>
        )}
        {messages.map((msg, index) => {
          const MessageContainer = msg.sender === 'user' ? UserMessage : SystemMessage;
          return (
            <MessageContainer
              key={msg.mid || index}
              status={msg.status}
              onRetry={() => sendChatMessage(msg, setMessages)}
            >
              <MessageRenderer message={msg} />
            </MessageContainer>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <MessageInput />
    </div>
  );
};

export default ChatbotPage;

import React, { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { useSearchParams } from 'react-router-dom';
import { messagesAtom, replyPendingAtom, socketStatusAtom } from '../store/chatbotAtoms.ts';
import { socketService } from '../services/socketService.ts';
import { getSessionInfo } from '../services/sessionService.ts';
import { SESSION_STATUS } from '../constants/chat.ts';
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
  const [replyPending, setReplyPending] = useAtom(replyPendingAtom);
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  const messagesEndRef = useRef(null);
  const sessionInitPromiseRef = useRef(null);

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
      setReplyPending(false);
      const newMessage = { ...message, sender: 'system' };
      setMessages((prev) => [...prev, newMessage]);
    });

    const initializeSession = async () => {
      const sessionInfo = (await getSessionInfo(userId))?.data;
      if (!sessionInfo) return;

      socketService.setSessionId(sessionInfo.session_id);
      if (sessionInfo.session_status === SESSION_STATUS.IN_PROGRESS) {
        await socketService.connect();
      }
    };

    if (!sessionInitPromiseRef.current) {
      sessionInitPromiseRef.current = initializeSession().finally(() => {
        sessionInitPromiseRef.current = null;
      });
    }

    sessionInitPromiseRef.current.catch(error => {
      console.error('初始化会话信息失败', error);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeMessage();
      socketService.disconnect();
    };
  }, [setMessages, setReplyPending, setStatus, userId]);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
  }, [messages]);

  const handleRetry = async (message) => {
    const isSent = await sendChatMessage(message, setMessages);
    setReplyPending(isSent);
  };

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
              onRetry={() => handleRetry(msg)}
            >
              <MessageRenderer message={msg} />
            </MessageContainer>
          );
        })}
        {replyPending && (
          <div className="reply-pending" role="status">
            <span className="reply-pending__dot" aria-hidden="true" />
            <span className="reply-pending__dot" aria-hidden="true" />
            <span className="reply-pending__dot" aria-hidden="true" />
            正在生成回复
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <MessageInput />
    </div>
  );
};

export default ChatbotPage;

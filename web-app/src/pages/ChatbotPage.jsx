import React, { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { messagesAtom, socketStatusAtom } from '../store/chatbotAtoms.ts';
import { socketService } from '../services/socketService.ts';
import UserMessage from '../components/chatbot/UserMessage.jsx';
import SystemMessage from '../components/chatbot/SystemMessage.jsx';
import MessageRenderer from '../components/chatbot/MessageRenderer.jsx';
import MessageInput from '../components/chatbot/MessageInput.jsx';
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

    // Connect to WebSocket
    setStatus('connecting');
    socketService.connect(
      () => setStatus('connected'),
      () => setStatus('disconnected'),
      (err) => console.error(err)
    );

    // Subscribe to incoming messages
    const unsubscribe = socketService.onMessage((message) => {
      const newMessage = { ...message, sender: 'system' };
      setMessages((prev) => [...prev, newMessage]);
    });

    return () => {
      unsubscribe();
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
        <h1>Chatbot</h1>
        <p>Connection Status: {status}</p>
      </div>
      <div className="message-list">
        {messages.map((msg, index) => {
          const MessageContainer = msg.sender === 'user' ? UserMessage : SystemMessage;
          return (
            <MessageContainer key={msg.mid || index} status={msg.status}>
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

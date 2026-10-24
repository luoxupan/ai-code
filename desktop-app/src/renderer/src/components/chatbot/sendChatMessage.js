import { socketService } from '../../services/socketService.ts';

export const sendChatMessage = async (message, setMessages) => {
  setMessages(prev =>
    prev.map(msg => (msg.mid === message.mid ? { ...msg, status: 'sending' } : msg))
  );

  try {
    await socketService.sendMessage(message);
    setMessages(prev =>
      prev.map(msg => (msg.mid === message.mid ? { ...msg, status: 'success' } : msg))
    );
    return true;
  } catch (error) {
    console.error(error);
    setMessages(prev =>
      prev.map(msg => (msg.mid === message.mid ? { ...msg, status: 'failed' } : msg))
    );
    return false;
  }
};

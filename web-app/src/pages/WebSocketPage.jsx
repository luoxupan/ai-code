import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const WebSocketPage = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to the WebSocket server
    const newSocket = io('http://localhost:3002');
    setSocket(newSocket);

    // Event listeners
    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setIsConnected(false);
    });

    // Cleanup on component unmount
    return () => {
      // newSocket.disconnect();
    };
  }, []);

  return (
    <div>
      <h1>WebSocket Connection</h1>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
    </div>
  );
};

export default WebSocketPage;

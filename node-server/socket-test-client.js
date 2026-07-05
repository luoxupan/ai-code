
const io = require('socket.io-client');

const socket = io('http://localhost:3002', {
  transports: ['websocket'], // Force websocket transport
  pingInterval: 5000,
  pingTimeout: 10000,
});

console.log('Connecting to server...');

socket.on('connect', () => {
  console.log('Connected to server with id:', socket.id);

  // Send a message to the server
  const message = { data: 'Hello from test client!' };
  console.log('Sending message:', message);
  socket.emit('messageToServer', message);
});

socket.on('messageToClient', (payload) => {
  console.log('Received message from server:', payload);
  console.log('Test successful! Keeping connection alive to test heartbeat.');
  // socket.disconnect();
  // process.exit(0);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server.');
});

socket.on('connect_error', (error) => {
  console.error('Connection Error:', error.message);
  process.exit(1);
});

// Timeout for the test
/* setTimeout(() => {
  console.error('Test timed out. Could not connect or receive message in time.');
  socket.disconnect();
  process.exit(1);
}, 5000); */

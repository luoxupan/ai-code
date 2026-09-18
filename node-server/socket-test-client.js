
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
  socket.emit('Message', message);
});

socket.on('Message', (payload) => {
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
/*

你是一个前端IM开发专家。
计划实现一个前端IM页面，websocket使用socket.io库，状态管理库使用jotai。
新创建一个页面，路由叫做chatbot。
这个IM页面是一个可以上下滚动的消息列表，左侧是后端发送的消息，右侧是用户发送的消息。
后端的websocket消息类型字段有type和subType，
websocket监听'Message'消息，前后端发送的消息按照如下json格式进行
```json
{
  type: 5,
  subType: 1,
  mid: '消息的唯一标识',
  payload: {
    content: '发送的消息内容'
  }
}
```
type=1表示websocket链接消息
type=2表示websocket断开链接消息
type=3表示ack消息，前后端接收到对方的消息的时候会直接发送ack消息回去，表示已经接收到该条消息
type=5表示聊天消息，此时前端需要根据subType来渲染组件
  1. subType=1的时候是猜你想问组件
  2. subType=2的时候是faq卡片组件
  3. subType=3的时候是订单组件
设想是进行功能拆分如下
  1. 一个service层处理websocket的链接，消息发送，消息接收。
    - 消息发送的时候会有三个状态，发送中，发送成功，发送失败，接收到消息的ack才会认为发送成功，消息发送超时时间是5秒钟
  2. 组件模块，根据subType的类型来渲染
    - 组件模块在components目录下，在外层直接把该目录下的所有组件import出去使用
    - 需要考虑设计合理性，因为会有新增组件
    - 新增组件时，开发人员只关心创建新组件，不需要有额外配置
  3. 一个是消息处理模块，处理历史消息，历史消息从本地localStorage获取
  4. input输入框，用户在输入框输入要发送的数据，然后点击发送按钮发送

*/


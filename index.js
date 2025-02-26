const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

// In-memory message store (this will be lost on server restart!)
let messages = [];

// Keep track of connected clients (users)
const connectedClients = new Set();

wss.on('connection', ws => {
  console.log('Client connected');
  connectedClients.add(ws);

  // Send existing messages to the newly connected client
  ws.send(JSON.stringify({ type: 'history', messages }));

  // Send the current online user count to the newly connected client
  sendOnlineUserCount();


  ws.on('message', message => {
    const parsedMessage = JSON.parse(message);

    if (parsedMessage.type === 'chat') {
      const newMessage = {
        user: parsedMessage.user,
        message: parsedMessage.message,
        timestamp: new Date().toISOString()
      };

      messages.push(newMessage);

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'chat', message: newMessage }));
        }
      });
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    connectedClients.delete(ws);
    sendOnlineUserCount();
  });

  ws.on('error', error => {
    console.error('WebSocket error:', error);
    connectedClients.delete(ws);
    sendOnlineUserCount();
  });
});

function sendOnlineUserCount() {
  const onlineUserCount = connectedClients.size;
  console.log(`Online Users: ${onlineUserCount}`);

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'userCount', count: onlineUserCount }));
    }
  });
}


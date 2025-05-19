 const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const clients = new Set();

wss.on('connection', ws => {
  clients.add(ws);
  console.log('Client connected. Total clients:', clients.size);

  ws.on('message', message => {
    // Broadcast received message to all clients including sender
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected. Total clients:', clients.size);
  });
});

console.log('WebSocket server running on ws://localhost:8080');

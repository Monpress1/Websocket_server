// server.js
const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 4000 });
server.on('connection', (socket) => {
    console.log('A new client connected!');
    // Listen for messages from clients
    socket.on('message', (message) => {
        console.log(`Received: ${message}`);
        
        // Broadcast the message to all connected clients
        server.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message); // Send the message as a string
            }
        });
    });
    // Handle client disconnection
    socket.on('close', () => {
        console.log('A client disconnected!');
    });
});
console.log('WebSocket server is running on port:4000');

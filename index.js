const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

let messages = [];
const connectedClients = new Set();

wss.on('connection', ws => {
    console.log('Client connected');
    connectedClients.add(ws);

    ws.send(JSON.stringify({ type: 'history', messages }));
    sendOnlineUserCount();

    ws.on('message', message => {
        const parsedMessage = JSON.parse(message);

        if (parsedMessage.type === 'chat') {
            const newMessage = {
                user: parsedMessage.user,
                message: parsedMessage.content, // <--- Corrected: Send only the content
                timestamp: new Date().toISOString(),
                room: parsedMessage.room // Ensure the room is also saved
            };

            messages.push(newMessage);

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    // Send only the message content and other necessary data
                    client.send(JSON.stringify({ 
                        type: 'chat', 
                        message: newMessage.message, // <--- Corrected: Send only the content
                        user: newMessage.user,
                        timestamp: newMessage.timestamp,
                        room: newMessage.room // Send the room so client knows where message belongs
                     }));
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


const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 4000 });

const rooms = {};

server.on('connection', (socket) => {
    // ... (connection and close handlers - same as before)

    socket.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);

            if (parsedMessage.type === 'join') {
                // ... (join room logic - same as before)
            } else if (parsedMessage.type === 'message') {
                const roomId = parsedMessage.room;
                const content = parsedMessage.content;
                const sender = parsedMessage.sender;
                const messageId = parsedMessage.id;

                if (!roomId || !content || !sender || !messageId) {
                    console.error("Room ID, content, sender and message ID are required"); // More descriptive error
                    return;
                }

                if (rooms[roomId]) {
                    for (let client of rooms[roomId].values()) {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                room: roomId,
                                content: content,
                                sender: sender, // Send back the sender
                                id: messageId     // Send back the message ID
                            }));
                        }
                    }
                } else {
                    console.log(`Room ${roomId} does not exist.`);
                }
            } else if (parsedMessage.type === 'leave') {
                // ... (leave room logic - same as before)
            } else {
                console.log("Unknown message type:", parsedMessage.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    // ... (close handler - same as before)
});

// ... (sendRoomPopulation function - same as before)

console.log('WebSocket server is running on port 4000');


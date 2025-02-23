const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 4000 });

const rooms = {};

server.on('connection', (socket) => {
    console.log('A new client connected!');

    socket.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);

            if (parsedMessage.type === 'join') {
                // ... (join room logic - same as before)
            } else if (parsedMessage.type === 'message') {
                const roomId = parsedMessage.room;
                const content = parsedMessage.content;
                const sender = parsedMessage.sender; // Get the sender from the message
                const messageId = parsedMessage.id;   // Get the ID from the message

                if (!roomId || !content || !sender || !messageId) { // Check for all required fields
                    console.error("Room ID, content, sender, and message ID are required");
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

    socket.on('close', () => {
        // ... (client disconnect logic - same as before)
    });
});

// ... (sendRoomPopulation function - same as before)

console.log('WebSocket server is running on port 4000');

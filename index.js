const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 4000 });

const rooms = {};

server.on('connection', (socket) => {
    console.log('A new client connected!');

    socket.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);

            if (parsedMessage.type === 'join') {
                const roomId = parsedMessage.room;
                if (!roomId) {
                    console.error("Room ID is required");
                    return;
                }
                if (!rooms[roomId]) {
                    rooms[roomId] = { users: new Set(), count: 1 }; // Initialize count to 1
                } else {
                    rooms[roomId].users.add(socket);
                    rooms[roomId].count++; // Increment count
                }
                console.log(`Client joined room: ${roomId}`);
                sendRoomPopulation(roomId);
            } else if (parsedMessage.type === 'message') {
                const roomId = parsedMessage.room;
                const content = parsedMessage.content;
                const sender = parsedMessage.sender;

                if (!roomId || !content || !sender) {
                    console.error("Room ID, content, and sender are required");
                    return;
                }

                if (rooms[roomId]) {
                    for (let client of rooms[roomId].users.values()) {
                        if (client.readyState === WebSocket.OPEN) {
                            if (client !== socket) { // Prevent echoing to sender
                                client.send(JSON.stringify({ room: roomId, content: content, sender: sender }));
                            }
                        }
                    }
                } else {
                    console.log(`Room ${roomId} does not exist.`);
                }
            } else if (parsedMessage.type === 'leave') {
                const roomId = parsedMessage.room;
                if (rooms[roomId]) {
                    rooms[roomId].users.delete(socket);
                    rooms[roomId].count--; // Decrement count
                    console.log(`Client left room: ${roomId}`);
                    sendRoomPopulation(roomId);
                    if (rooms[roomId].users.size === 0) {
                        delete rooms[roomId];
                    }
                }
            } else {
                console.log("Unknown message type:", parsedMessage.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    socket.on('close', () => {
        for (const roomId in rooms) {
            rooms[roomId].users.delete(socket);
            rooms[roomId].count--; // Decrement count
            if (rooms[roomId].users.size === 0) {
                delete rooms[roomId];
            }
            sendRoomPopulation(roomId);
        }
        console.log('A client disconnected!');
    });
});

function sendRoomPopulation(roomId) {
    if (rooms[roomId]) {
        const population = rooms[roomId].count;
        for (let client of rooms[roomId].users.values()) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'population', room: roomId, count: population }));
            }
        }
    }
}

console.log('WebSocket server is running on port 4000');

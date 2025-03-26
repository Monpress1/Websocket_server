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
                    rooms[roomId] = new Set();
                }
                rooms[roomId].add(socket);
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
                    for (let client of rooms[roomId].values()) {
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
                    rooms[roomId].delete(socket);
                    console.log(`Client left room: ${roomId}`);
                    sendRoomPopulation(roomId);
                    if (rooms[roomId].size === 0) {
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
            rooms[roomId].delete(socket);
            if (rooms[roomId].size === 0) {
                delete rooms[roomId];
            }
            sendRoomPopulation(roomId);
        }
        console.log('A client disconnected!');
    });
}); 

function sendRoomPopulation(roomId) {
    if (rooms[roomId]) {
        const population = rooms[roomId].size;
        for (let client of rooms[roomId].values()) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'population', room: roomId, count: population }));
            }
        }
    }
} 

console.log('WebSocket server is running on port 4000');

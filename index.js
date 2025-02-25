Const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 4000 });

const rooms = {};

server.on('connection', (socket) => {
    console.log('A new client connected!');

    socket.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);

            if (parsedMessage.type === 'join') {
                const roomId = parsedMessage.room;
                const user = parsedMessage.user;

                if (!roomId) {
                    console.error("Room ID is required");
                    return;
                }

                if (!rooms[roomId]) {
                    rooms[roomId] = { users: new Set(), messages: [] };
                }

                rooms[roomId].users.add(socket);
                console.log(`Client ${user} joined room: ${roomId}`);

                // Send message history to the newly joined client *after* joining the room
                const history = rooms[roomId].messages;
                socket.send(JSON.stringify({ type: 'history', room: roomId, messages: history }));

                sendRoomPopulation(roomId);
            } else if (parsedMessage.type === 'message') {
                const roomId = parsedMessage.room;
                const content = parsedMessage.content;
                const sender = parsedMessage.sender;
                const id = parsedMessage.id;

                if (!roomId || !content || !sender || !id) {
                    console.error("Room ID, content, sender, and ID are required");
                    return;
                }

                if (rooms[roomId]) {
                    const messageToStore = { content, sender, id };
                    rooms[roomId].messages.push(messageToStore);

                    // Send the message to *other* clients in the room *only*
                    for (let client of rooms[roomId].users) { // Iterate directly over the set
                        if (client !== socket && client.readyState === WebSocket.OPEN) { // Exclude sender
                            client.send(JSON.stringify({ type: 'message', room: roomId, content: content, sender: sender, id: id }));
                        }
                    }
                } else {
                    console.log(`Room ${roomId} does not exist.`);
                }
            } else if (parsedMessage.type === 'leave') {
                const roomId = parsedMessage.room;
                if (rooms[roomId]) {
                    rooms[roomId].users.delete(socket);
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
            if (rooms[roomId] && rooms[roomId].users) {
                rooms[roomId].users.delete(socket);
                sendRoomPopulation(roomId);
                if (rooms[roomId].users.size === 0) {
                    delete rooms[roomId];
                }
            }
        }
        console.log('A client disconnected!');
    });
});

function sendRoomPopulation(roomId) {
    if (rooms[roomId] && rooms[roomId].users) {
        const population = rooms[roomId].users.size;
        for (let client of rooms[roomId].users) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'population', room: roomId, count: population }));
            }
        }
    }
}

console.log('WebSocket server is running on port 4000');

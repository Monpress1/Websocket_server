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
                const user = parsedMessage.user;

                if (!roomId || !user) {
                    console.error("Room ID and Username are required");
                    return;
                }

                if (!rooms[roomId]) {
                    rooms[roomId] = { users: new Set(), count: 0 };
                }

                let userJoined = false;

                if (!rooms[roomId].users.has(user)) {
                    rooms[roomId].users.add(user);
                    userJoined = true;
                    console.log(`${user} joined room: ${roomId}`);
                } else {
                    console.log(`${user} is already in room: ${roomId}`);
                }

                if (userJoined) {
                    rooms[roomId].count++;
                }

                // ***Call sendRoomPopulation ONLY ONCE, AFTER all logic***
                sendRoomPopulation(roomId); // Correct placement

            } else if (parsedMessage.type === 'message') {
                // ... (message handling code - no changes needed)
            } else if (parsedMessage.type === 'leave') {
                 // ... (leave handling code - no changes needed)
            } else {
                console.log("Unknown message type:", parsedMessage.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    socket.on('close', () => {
        let userToRemove;
        for (const roomId in rooms) {
            for (const user of rooms[roomId].users) {
                if (rooms[roomId].users.has(user)) {
                    rooms[roomId].users.delete(user);
                    rooms[roomId].count--;
                    userToRemove = user;
                    console.log(`${user} disconnected`);
                    sendRoomPopulation(roomId);
                    if (rooms[roomId].users.size === 0) {
                        delete rooms[roomId];
                    }
                    break;
                }
            }
        }
        console.log('A client disconnected!');
    });
});

function sendRoomPopulation(roomId) {
    if (rooms[roomId]) {
        const population = rooms[roomId].count;
        for (let user of rooms[roomId].users) {
            for (let client of server.clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'population', room: roomId, count: population }));
                }
            }
        }
    }
}

console.log('WebSocket server is running on port 4000');


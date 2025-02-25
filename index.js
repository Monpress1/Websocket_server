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
                const user = parsedMessage.user; // Get the username

                if (!roomId || !user) {  // Check for both room and user
                    console.error("Room ID and Username are required");
                    return;
                }

                if (!rooms[roomId]) {
                    rooms[roomId] = { users: new Set(), count: 0 }; // Initialize count to 0!
                }

                if (!rooms[roomId].users.has(user)) { // Check if user already in room
                    rooms[roomId].users.add(user); // Store user by name
                    rooms[roomId].count++; // Increment count ONLY if user is new to the room
                    console.log(`${user} joined room: ${roomId}`);
                    sendRoomPopulation(roomId);
                } else {
                    console.log(`${user} is already in room: ${roomId}`); // Handle duplicate join
                    sendRoomPopulation(roomId); // Still send population update even if already joined
                }

            } else if (parsedMessage.type === 'message') {
                const roomId = parsedMessage.room;
                const content = parsedMessage.content;
                const sender = parsedMessage.sender;

                if (!roomId || !content || !sender) {
                    console.error("Room ID, content, and sender are required");
                    return;
                }

                if (rooms[roomId] && rooms[roomId].users.has(sender)) { //Check if the sender is in the room
                    for (let client of server.clients) { // Iterate over all connected clients
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ room: roomId, content: content, sender: sender }));
                        }
                    }
                } else {
                    console.log(`Room ${roomId} does not exist or user ${sender} is not in room.`);
                }
            } else if (parsedMessage.type === 'leave') {
                const roomId = parsedMessage.room;
                const user = parsedMessage.user;

                if (rooms[roomId]) {
                    if (rooms[roomId].users.delete(user)) { // Delete by username
                        rooms[roomId].count--;
                        console.log(`${user} left room: ${roomId}`);
                        sendRoomPopulation(roomId);
                        if (rooms[roomId].users.size === 0) {
                            delete rooms[roomId];
                        }
                    } else {
                        console.log(`${user} was not in room ${roomId}`);
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
        for (let user of rooms[roomId].users) { // Iterate through the users Set
            for (let client of server.clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'population', room: roomId, count: population }));
                }
            }
        }
    }
}

console.log('WebSocket server is running on port 4000');

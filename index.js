  const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 4000 });
const rooms = {};
const userConnections = new Map(); // To store user info associated with each socket

server.on('connection', (socket) => {
    console.log('A new client connected!');

    socket.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);

            if (parsedMessage.type === 'join') {
                const roomId = parsedMessage.room || 'anonymous'; // Default to 'anonymous' if no room provided
                const username = parsedMessage.user;
                const profile = parsedMessage.profile;

                if (!username) {
                    console.error("Username is required for join");
                    socket.close();
                    return;
                }
                userConnections.set(socket, { username, profile }); // Associate socket with user info

                if (!rooms[roomId]) {
                    rooms[roomId] = new Set();
                }
                rooms[roomId].add(socket);
                console.log(`Client ${username} joined room: ${roomId}`);
                sendRoomPopulation(roomId);
                sendUserList(roomId); // Send updated user list on join
            } else if (parsedMessage.type === 'message') {
                const roomId = parsedMessage.room;
                const content = parsedMessage.content;
                const senderInfo = userConnections.get(socket);
                const sender = senderInfo ? senderInfo.username : 'Anonymous';
                const senderProfile = senderInfo ? senderInfo.profile : null;
                const id = parsedMessage.id; // Get the id from the client
                const timestamp = parsedMessage.timestamp; // Get the timestamp from the client

                if (!roomId || !content || !id || !timestamp) {
                    console.error("Room ID, content, ID, and timestamp are required for message");
                    return;
                }

                if (rooms[roomId]) {
                    for (let client of rooms[roomId].values()) {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'message',
                                room: roomId,
                                content: content,
                                sender: sender,
                                senderProfile: senderProfile,
                                id: id, // Send the id back to the client
                                timestamp: timestamp // Send the timestamp back to the client
                            }));
                        }
                    }
                } else {
                    console.log(`Room ${roomId} does not exist.`);
                }
            } else if (parsedMessage.type === 'image') {
                const roomId = parsedMessage.room;
                const base64Image = parsedMessage.data;
                const senderInfo = userConnections.get(socket);
                const sender = senderInfo ? senderInfo.username : 'Anonymous';
                const senderProfile = senderInfo ? senderInfo.profile : null;
                const id = parsedMessage.id; // Get the id from the client
                const timestamp = parsedMessage.timestamp; // Get the timestamp from the client

                if (!roomId || !base64Image || !id || !timestamp) {
                    console.error("Room ID, image data, ID, and timestamp are required for images");
                    return;
                }

                if (rooms[roomId]) {
                    for (let client of rooms[roomId].values()) {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'image',
                                room: roomId,
                                data: base64Image,
                                sender: sender,
                                senderProfile: senderProfile,
                                id: id, // Send the id back to the client
                                timestamp: timestamp // Send the timestamp back to the client
                            }));
                        }
                    }
                } else {
                    console.log(`Room ${roomId} does not exist.`);
                }
            } else if (parsedMessage.type === 'leave') {
                const roomId = parsedMessage.room;
                const userInfo = userConnections.get(socket);
                const username = userInfo ? userInfo.username : 'Anonymous';

                if (rooms[roomId]) {
                    rooms[roomId].delete(socket);
                    userConnections.delete(socket);
                    console.log(`Client ${username} left room: ${roomId}`);
                    sendRoomPopulation(roomId);
                    sendUserList(roomId); // Send updated user list on leave
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
        const userInfo = userConnections.get(socket);
        const username = userInfo ? userInfo.username : 'Anonymous';
        for (const roomId in rooms) {
            rooms[roomId].delete(socket);
            if (rooms[roomId].size === 0) {
                delete rooms[roomId];
            }
            sendRoomPopulation(roomId);
            sendUserList(roomId); // Send updated user list on disconnect
        }
        userConnections.delete(socket);
        console.log(`Client ${username} disconnected!`);
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

function sendUserList(roomId) {
    if (rooms[roomId]) {
        const users = Array.from(rooms[roomId]).map(socket => {
            const userInfo = userConnections.get(socket);
            return userInfo ? userInfo.username : 'Anonymous';
        });
        for (let client of rooms[roomId].values()) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'userList', room: roomId, users: users }));
            }
        }
    }
}

console.log('WebSocket server is running on port 4000');

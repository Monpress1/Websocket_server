const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 4000 });
const rooms = {};
const userConnections = new Map();

server.on('connection', (socket) => {
    console.log('A new client connected!');

    socket.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);

            if (parsedMessage.type === 'join') {
                const roomId = parsedMessage.room || 'anonymous';
                const username = parsedMessage.user;
                const profile = parsedMessage.profile;

                if (typeof username !== 'string') {
                    console.error("Username must be a string");
                    socket.close();
                    return;
                }

                userConnections.set(socket, { username, profile });

                if (!rooms[roomId]) {
                    rooms[roomId] = new Set();
                }
                rooms[roomId].add(socket);
                console.log(`Client ${username} joined room: ${roomId}`);
                sendRoomPopulation(roomId);
                sendUser List(roomId);
            } else if (parsedMessage.type === 'message') {
                const roomId = parsedMessage.room;
                const content = parsedMessage.content;
                const senderInfo = userConnections.get(socket);
                const sender = senderInfo ? senderInfo.username : 'Anonymous';
                const senderProfile = senderInfo ? senderInfo.profile : null;
                const id = parsedMessage.id;
                const timestamp = parsedMessage.timestamp;

                if (typeof roomId !== 'string' || typeof content !== 'string' || typeof id !== 'string' || typeof timestamp !== 'string') {
                    console.error("Room ID, content, ID, and timestamp must be strings");
                    return;
                }

                if (rooms[roomId]) {
                    for (let client of rooms[roomId].values()) {
                        if (client.readyState === WebSocket.OPEN) {
                            try {
                                client.send(JSON.stringify({
                                    type: 'message',
                                    room: roomId,
                                    content: content,
                                    sender: sender,
                                    senderProfile: senderProfile,
                                    id: id,
                                    timestamp: timestamp
                                }));
                            } catch (error) {
                                console.error('Error sending message:', error);
                            }
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
                const id = parsedMessage.id;
                const timestamp = parsedMessage.timestamp;

                if (typeof roomId !== 'string' || typeof base64Image !== 'string' || typeof id !== 'string' || typeof timestamp !== 'string') {
                    console.error("Room ID, image data, ID, and timestamp must be strings");
                    return;
                }

                if (rooms[roomId]) {
                    for (let client of rooms[roomId].values()) {
                        if (client.readyState === WebSocket.OPEN) {
                            try {
                                client.send(JSON.stringify({
                                    type: 'image',
                                    room: roomId,
                                    data: base64Image,
                                    sender: sender,
                                    senderProfile: senderProfile,
                                    id: id,
                                    timestamp: timestamp
                                }));
                            } catch (error) {
                                console.error('Error sending image:', error);
                            }
                        }
                    }
                } else {
                    console.log(`Room ${roomId} does not exist.`);
                }
            } else if (parsedMessage.type === 'leave') {
                const roomId = parsedMessage.room;
                const userInfo = userConnections.get(socket);
                const username = userInfo ? userInfo.username : 'Anonymous';

                if (typeof roomId !== 'string') {
                    console.error("Room ID must be a string");
                    return;
                }

                if (rooms[roomId]) {
                    rooms[roomId].delete(socket);
                    userConnections.delete(socket);
                    console.log(`Client ${username} left room: ${roomId}`);
                    sendRoomPopulation(roomId);
                    sendUser List(roomId);
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
            sendUser List(roomId);
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
                try {
                    client.send(JSON.stringify({ type: 'population', room: roomId, count: population }));
                } catch (error) {
                    console.error('Error sending population:', error);
                }
            }
        }
    }
}

function sendUser List(roomId) {
    if (rooms[roomId]) {
        const users = Array.from(rooms[roomId]).map(socket => {
            const userInfo = userConnections.get(socket);
            return userInfo ? userInfo.username : 'Anonymous';
        });
        for (let client of rooms[roomId].values()) {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(JSON.stringify({ type: 'userList', room: roomId, users: users }));
                } catch (error) {
                    console.error('Error sending user list:', error);
                }
            }
        }
    }
}

console.log('WebSocket server is running on port 4000');

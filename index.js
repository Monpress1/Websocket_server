const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 4000 });

const rooms = {};

server.on('connection', (socket) => {
    console.log('A new client connected!');

    socket.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);

            switch (parsedMessage.type) {  // Use a switch statement for clarity
                case 'join': {
                    const roomId = parsedMessage.room;
                    const user = parsedMessage.user; // You're receiving the user, but not using it yet, consider adding it to the room data.

                    if (!roomId) {
                        console.error("Room ID is required");
                        socket.send(JSON.stringify({ type: 'error', message: 'Room ID is required' })); // Send error back to the client
                        return;
                    }

                    if (!rooms[roomId]) {
                        rooms[roomId] = { users: new Set(), messages: [], userList: [] }; // Add userList to store usernames
                    }

                    if (rooms[roomId].users.has(socket)) { // Prevent duplicate joins
                        socket.send(JSON.stringify({ type: 'error', message: 'Already in this room' }));
                        return;
                    }

                    rooms[roomId].users.add(socket);
                    rooms[roomId].userList.push(user); // Add the username

                    console.log(`Client ${user} joined room: ${roomId}`);

                    // Send message history to the newly joined client *after* joining the room
                    const history = rooms[roomId].messages;
                    socket.send(JSON.stringify({ type: 'history', room: roomId, messages: history }));

                    sendRoomPopulation(roomId);
                    sendUserList(roomId); // Send the updated user list
                    break;
                }
                case 'message': {
                    const roomId = parsedMessage.room;
                    const content = parsedMessage.content;
                    const sender = parsedMessage.sender;
                    const id = parsedMessage.id;

                    if (!roomId || !content || !sender || !id) {
                        console.error("Room ID, content, sender, and ID are required");
                        socket.send(JSON.stringify({ type: 'error', message: 'Missing required fields' }));
                        return;
                    }

                    if (rooms[roomId]) {
                        const messageToStore = { content, sender, id };
                        rooms[roomId].messages.push(messageToStore);

                        // Send the message to *other* clients in the room *only*
                        for (let client of rooms[roomId].users) {
                            if (client !== socket && client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify({ type: 'message', room: roomId, content, sender, id })); // Shorthand property names
                            }
                        }
                    } else {
                        console.log(`Room ${roomId} does not exist.`);
                        socket.send(JSON.stringify({ type: 'error', message: 'Room does not exist' }));
                    }
                    break;
                }
                case 'leave': {
                    const roomId = parsedMessage.room;
                    if (rooms[roomId]) {
                        rooms[roomId].users.delete(socket);
                        const userIndex = rooms[roomId].userList.indexOf(parsedMessage.user); // remove username
                        if (userIndex > -1){
                            rooms[roomId].userList.splice(userIndex, 1);
                        }
                        console.log(`Client ${parsedMessage.user} left room: ${roomId}`);
                        sendRoomPopulation(roomId);
                        sendUserList(roomId);
                        if (rooms[roomId].users.size === 0) {
                            delete rooms[roomId];
                        }
                    }
                    break;
                }
                default:
                    console.log("Unknown message type:", parsedMessage.type);
                    socket.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
            }
        } catch (error) {
            console.error('Error parsing message:', error);
            socket.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    });

    socket.on('close', () => {
        let userToRemove;
        for (const roomId in rooms) {
            if (rooms[roomId] && rooms[roomId].users) {
                if (rooms[roomId].users.delete(socket)) { // delete returns true if the element was present
                    userToRemove = rooms[roomId].userList.find(user => user === parsedMessage.user);
                    const userIndex = rooms[roomId].userList.indexOf(userToRemove);
                        if (userIndex > -1){
                            rooms[roomId].userList.splice(userIndex, 1);
                        }
                    sendRoomPopulation(roomId);
                    sendUserList(roomId);
                    if (rooms[roomId].users.size === 0) {
                        delete rooms[roomId];
                    }
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

function sendUserList(roomId) {
    if (rooms[roomId] && rooms[roomId].users) {
        const userList = rooms[roomId].userList;
        for (let client of rooms[roomId].users) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'userList', room: roomId, users: userList }));
            }
        }
    }
}


console.log('WebSocket server is running on port 4000');

                                                

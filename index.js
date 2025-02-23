// server.js

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

                // Send room population update to all clients in the room

                sendRoomPopulation(roomId);

            } else if (parsedMessage.type === 'message') {

                const roomId = parsedMessage.room;

                const content = parsedMessage.content;

                if (!roomId || !content) {

                    console.error("Room ID and content are required");

                    return;

                }

                if (rooms[roomId]) {

                    for (let client of rooms[roomId].values()) {

                        if (client.readyState === WebSocket.OPEN) {

                            client.send(JSON.stringify({ room: roomId, content: content }));

                        }

                    }

                } else {

                    console.log(`Room ${roomId} does not exist.`);

                }

            } else if (parsedMessage.type === 'leave') { // Handle leave message

                const roomId = parsedMessage.room;

                if (rooms[roomId]) {

                    rooms[roomId].delete(socket);

                    console.log(`Client left room: ${roomId}`);

                    sendRoomPopulation(roomId); // Update population count

                    if(rooms[roomId].size === 0){

                        delete rooms[roomId]; //Delete the room if it's empty

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

            sendRoomPopulation(roomId); //Update population count when someone disconnects

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

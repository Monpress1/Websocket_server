const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 4000 });

const clients = new Map(); // Store client connections and their story IDs
const stories = new Map(); // Store stories by ID

server.on('connection', (socket) => {
    console.log('A new client connected!');
    const clientId = generateClientId(); // Generate unique client ID
    clients.set(socket, { id: clientId, storyIds: new Set() });

    socket.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);

            if (parsedMessage.type === 'registerStories') {
                const storyIds = parsedMessage.storyIds;
                if (!Array.isArray(storyIds)) {
                    console.error("Invalid storyIds format");
                    return;
                }
                clients.get(socket).storyIds = new Set(storyIds);
                console.log(`Client ${clientId} registered stories: ${storyIds}`);
            } else if (parsedMessage.type === 'requestStories') {
                const requestedStoryIds = parsedMessage.storyIds;
                if (!Array.isArray(requestedStoryIds)) {
                    console.error("Invalid requestedStoryIds format");
                    return;
                }
                const requestingClient = clients.get(socket);

                if (!requestingClient) {
                    console.error("Requesting client not found");
                    return;
                }

                requestedStoryIds.forEach(storyId => {
                    if (stories.has(storyId)) {
                        socket.send(JSON.stringify({ type: 'storyData', storyId: storyId, story: stories.get(storyId) }));
                    } else {
                        // Find other clients that have this story
                        server.clients.forEach(otherClient => {
                            if (otherClient !== socket && clients.get(otherClient).storyIds.has(storyId) && otherClient.readyState === WebSocket.OPEN) {
                                otherClient.send(JSON.stringify({ type: 'requestStoryData', storyId: storyId, targetClientId: requestingClient.id }));
                            }
                        });
                    }
                });
            } else if (parsedMessage.type === 'storyDataRequestResponse') {
                const storyId = parsedMessage.storyId;
                const storyData = parsedMessage.story;
                const targetClientId = parsedMessage.targetClientId;

                server.clients.forEach(otherClient => {
                    if (clients.get(otherClient).id === targetClientId && otherClient.readyState === WebSocket.OPEN) {
                        otherClient.send(JSON.stringify({ type: 'storyData', storyId: storyId, story: storyData }));
                    }
                });
            } else if (parsedMessage.type === 'storeStory') {
                const storyId = parsedMessage.storyId;
                const story = parsedMessage.story;
                stories.set(storyId, story);
                clients.get(socket).storyIds.add(storyId);

                server.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN && client !== socket) {
                        client.send(JSON.stringify({ type: 'newStory', storyId: storyId, story: story }));
                    }
                });
            } else {
                console.log("Unknown message type:", parsedMessage.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    socket.on('close', () => {
        clients.delete(socket);
        console.log(`Client ${clientId} disconnected!`);
    });
});

function generateClientId() {
    return Math.random().toString(36).substr(2, 9);
}

console.log('WebSocket server is running on port 4000');

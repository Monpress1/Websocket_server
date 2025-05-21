const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const http = require('http'); // Required for creating an HTTP server
const express = require('express'); // Required for serving static files (images)
const WebSocket = require('ws');

// --- Configuration ---
const CHAT_DATA_DIR = path.join(__dirname, 'chat_data');
const MESSAGES_FILE = path.join(CHAT_DATA_DIR, 'messages.json');
const IMAGES_DIR = path.join(CHAT_DATA_DIR, 'images');

// --- In-memory storage (will be loaded from file) ---
let chatMessages = []; // This will now hold all messages loaded from MESSAGES_FILE
const rooms = {}; // Tracks active WebSocket connections per room
const userConnections = new Map(); // Associates each socket with its user profile

// --- Ensure directories and load messages on startup ---
async function ensureDataDirectories() {
    await fs.mkdir(IMAGES_DIR, { recursive: true });
    await fs.mkdir(CHAT_DATA_DIR, { recursive: true });
    console.log('Chat data directories ensured.');
}

async function loadMessagesFromFile() {
    try {
        const data = await fs.readFile(MESSAGES_FILE, 'utf8');
        chatMessages = JSON.parse(data);
        console.log(`Loaded ${chatMessages.length} messages from ${MESSAGES_FILE}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(MESSAGES_FILE, '[]', 'utf8');
            chatMessages = [];
            console.log('No messages file found, created a new one.');
        } else {
            console.error('Failed to load messages:', error);
            chatMessages = [];
        }
    }
}

async function saveMessagesToFile() {
    try {
        await fs.writeFile(MESSAGES_FILE, JSON.stringify(chatMessages, null, 2), 'utf8');
        // console.log('Messages saved to file.'); // Log less frequently
    } catch (error) {
        console.error('Error saving messages:', error);
    }
}

// Initialize data directories and load messages when the server starts
(async () => {
    await ensureDataDirectories();
    await loadMessagesFromFile();
})();

// --- Express server setup (for serving images) ---
const app = express();
// Serve static images from the /images route
app.use('/images', express.static(IMAGES_DIR));

// Create a standard HTTP server to host the WebSocket server
const httpServer = http.createServer(app);

// --- WebSocket server setup ---
const wss = new WebSocket.Server({ server: httpServer });

httpServer.listen(process.env.PORT || 4000, () => { // Use process.env.PORT for Render
    console.log(`HTTP and WebSocket server running on port ${process.env.PORT || 4000}`);
    console.log(`Images served from /images/`);
});

// --- WebSocket logic ---
wss.on('connection', (socket) => {
    console.log('Client connected!');

    socket.on('message', async (message) => { // Made async to await fs operations
        try {
            const parsed = JSON.parse(message);

            if (parsed.type === 'join') {
                const room = parsed.room || 'anonymous';
                const username = parsed.user;
                const profile = parsed.profile;

                if (!username) {
                    console.error("Username is required for join, closing socket.");
                    return socket.close();
                }

                userConnections.set(socket, { username, profile, room }); // Store current room for user

                if (!rooms[room]) rooms[room] = new Set();
                rooms[room].add(socket);

                console.log(`Client ${username} joined room: ${room}`);

                // Send chat history for the joined room
                const roomHistory = chatMessages.filter(m => m.room === room);
                if (roomHistory.length > 0) {
                    // Send history as a single 'history' message
                    socket.send(JSON.stringify({ type: 'history', room: room, messages: roomHistory }));
                    console.log(`Sent ${roomHistory.length} history messages to ${username} in room ${room}`);
                }

                sendRoomPopulation(room);
                sendUserList(room);

            } else if (parsed.type === 'message') {
                const room = parsed.room;
                const content = parsed.content;
                const senderInfo = userConnections.get(socket);
                const sender = senderInfo?.username || 'Anonymous';
                const senderProfile = senderInfo?.profile || null;
                const id = parsed.id || uuidv4(); // Ensure ID even if client doesn't send it
                const timestamp = parsed.timestamp || new Date().toISOString();

                if (!room || !content) {
                    console.error("Room ID and content are required for message.");
                    return;
                }

                const newMessage = {
                    type: 'message',
                    room,
                    content,
                    sender,
                    profile: senderProfile, // Use 'profile' to match client's expectation
                    id,
                    timestamp
                };

                chatMessages.push(newMessage);
                await saveMessagesToFile(); // Save message to file
                broadcastToRoom(room, newMessage); // Broadcast to all connected clients in the room

            } else if (parsed.type === 'image') {
                const room = parsed.room;
                const base64Image = parsed.data; // Raw base64 from client
                const filename = parsed.filename || 'image.png'; // Client should send filename, default if not
                const senderInfo = userConnections.get(socket);
                const sender = senderInfo?.username || 'Anonymous';
                const senderProfile = senderInfo?.profile || null;
                const id = parsed.id || uuidv4();
                const timestamp = parsed.timestamp || new Date().toISOString();

                if (!room || !base64Image) {
                    console.error("Room ID and image data are required for image message.");
                    return;
                }

                // Save image to disk
                const imageBuffer = Buffer.from(base64Image, 'base64');
                const ext = path.extname(filename);
                const uniqueName = `${uuidv4()}${ext || '.png'}`; // Fallback .png if no extension
                const filePath = path.join(IMAGES_DIR, uniqueName);
                const imageUrl = `/images/${uniqueName}`; // URL for client to fetch image

                try {
                    await fs.writeFile(filePath, imageBuffer);
                    console.log(`Image saved: ${filePath}`);
                } catch (error) {
                    console.error('Failed to save image:', error);
                    // Inform client about the error
                    socket.send(JSON.stringify({ type: 'error', message: 'Failed to save image on server.' }));
                    return;
                }

                const imageMessage = {
                    type: 'image',
                    room,
                    imageUrl, // Send the URL, not base64, to clients
                    sender,
                    profile: senderProfile, // Use 'profile'
                    id,
                    timestamp,
                    content: `[Image: ${filename}]` // A text representation for display
                };

                chatMessages.push(imageMessage);
                await saveMessagesToFile(); // Save image message metadata
                broadcastToRoom(room, imageMessage);

            } else if (parsed.type === 'leave') {
                const room = parsed.room;
                const info = userConnections.get(socket);
                const username = info?.username || 'Anonymous';

                if (rooms[room]) {
                    rooms[room].delete(socket);
                    userConnections.delete(socket); // Remove connection from map
                    if (rooms[room].size === 0) delete rooms[room]; // Remove room if empty
                    sendRoomPopulation(room);
                    sendUserList(room);
                    console.log(`${username} left room ${room}`);
                }
            } else {
                console.log("Unknown message type received:", parsed.type);
                socket.send(JSON.stringify({ type: 'error', message: 'Unknown message type.' }));
            }
        } catch (err) {
            console.error('Error handling WebSocket message:', err);
            socket.send(JSON.stringify({ type: 'error', message: 'Server internal error.' }));
        }
    });

    socket.on('close', () => {
        const info = userConnections.get(socket);
        const username = info?.username || 'Anonymous';
        const roomJoined = info?.room; // Get the room the user was in

        if (roomJoined && rooms[roomJoined]) {
            rooms[roomJoined].delete(socket);
            if (rooms[roomJoined].size === 0) {
                delete rooms[roomJoined];
            }
            sendRoomPopulation(roomJoined);
            sendUserList(roomJoined);
        }
        userConnections.delete(socket);
        console.log(`Client ${username} disconnected from room ${roomJoined || 'unknown'}.`);
    });

    socket.on('error', (err) => {
        console.error(`WebSocket error for client ${userConnections.get(socket)?.username || 'Unknown'}:`, err);
    });
});

// --- Utility functions ---
function broadcastToRoom(room, data) {
    if (!rooms[room]) return;
    const message = JSON.stringify(data);
    for (const client of rooms[room]) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

function sendRoomPopulation(room) {
    if (!rooms[room]) return;
    const count = rooms[room].size;
    const message = JSON.stringify({ type: 'population', room, count });
    for (const client of rooms[room]) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

function sendUserList(room) {
    if (!rooms[room]) return;
    const users = Array.from(rooms[room]).map(socket => {
        const info = userConnections.get(socket);
        return info?.username || 'Anonymous';
    });
    const message = JSON.stringify({ type: 'userList', room, users });
    for (const client of rooms[room]) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

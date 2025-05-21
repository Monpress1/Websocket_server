 const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const express = require('express');
const WebSocket = require('ws');

// --- Configuration ---
const CHAT_DATA_DIR = path.join(__dirname, 'chat_data');
const MESSAGES_FILE = path.join(CHAT_DATA_DIR, 'messages.json');
const IMAGES_DIR = path.join(CHAT_DATA_DIR, 'images');

// --- In-memory storage ---
let chatMessages = [];
const rooms = {};
const userConnections = new Map();

// --- Ensure directories and load messages ---
async function ensureDataDirectories() {
    await fs.mkdir(IMAGES_DIR, { recursive: true });
    await fs.mkdir(CHAT_DATA_DIR, { recursive: true });
}

async function loadMessagesFromFile() {
    try {
        const data = await fs.readFile(MESSAGES_FILE, 'utf8');
        chatMessages = JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(MESSAGES_FILE, '[]', 'utf8');
            chatMessages = [];
        } else {
            console.error('Failed to load messages:', error);
            chatMessages = [];
        }
    }
}

async function saveMessagesToFile() {
    try {
        await fs.writeFile(MESSAGES_FILE, JSON.stringify(chatMessages, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving messages:', error);
    }
}

(async () => {
    await ensureDataDirectories();
    await loadMessagesFromFile();
})();

// --- Express server setup ---
const app = express();
app.use('/images', express.static(IMAGES_DIR));

const httpServer = http.createServer(app);
const wss = new WebSocket.Server({ server: httpServer });

httpServer.listen(4000, () => {
    console.log('HTTP and WebSocket server running on port 4000');
    console.log(`Images available at http://localhost:4000/images/`);
});

// --- WebSocket logic ---
wss.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('message', async (message) => {
        try {
            const parsed = JSON.parse(message);

            if (parsed.type === 'join') {
                const room = parsed.room || 'anonymous';
                const username = parsed.user;
                const profile = parsed.profile;

                if (!username) return socket.close();

                userConnections.set(socket, { username, profile });

                if (!rooms[room]) rooms[room] = new Set();
                rooms[room].add(socket);

                const roomHistory = chatMessages.filter(m => m.room === room);
                if (roomHistory.length > 0) {
                    socket.send(JSON.stringify({ type: 'history', messages: roomHistory }));
                }

                sendRoomPopulation(room);
                sendUserList(room);
            }

            else if (parsed.type === 'message') {
                const room = parsed.room;
                const content = parsed.content;
                const senderInfo = userConnections.get(socket);
                const sender = senderInfo?.username || 'Anonymous';
                const senderProfile = senderInfo?.profile || null;
                const id = parsed.id || uuidv4();
                const timestamp = parsed.timestamp || new Date().toISOString();

                if (!room || !content) return;

                const newMessage = {
                    type: 'message',
                    room,
                    content,
                    sender,
                    senderProfile,
                    id,
                    timestamp
                };

                chatMessages.push(newMessage);
                await saveMessagesToFile();

                broadcastToRoom(room, newMessage);
            }

            else if (parsed.type === 'image') {
                const room = parsed.room;
                const base64Image = parsed.data;
                const filename = parsed.filename;
                const senderInfo = userConnections.get(socket);
                const sender = senderInfo?.username || 'Anonymous';
                const senderProfile = senderInfo?.profile || null;
                const id = parsed.id || uuidv4();
                const timestamp = parsed.timestamp || new Date().toISOString();

                if (!room || !base64Image) return;

                const imageBuffer = Buffer.from(base64Image, 'base64');
                const ext = path.extname(filename || '.png');
                const uniqueName = `${uuidv4()}${ext}`;
                const filePath = path.join(IMAGES_DIR, uniqueName);
                const imageUrl = `/images/${uniqueName}`;

                try {
                    await fs.writeFile(filePath, imageBuffer);
                } catch (error) {
                    console.error('Failed to save image:', error);
                    return;
                }

                const imageMessage = {
                    type: 'image',
                    room,
                    imageUrl,
                    sender,
                    senderProfile,
                    id,
                    timestamp,
                    content: `[Image: ${filename || 'image'}]`
                };

                chatMessages.push(imageMessage);
                await saveMessagesToFile();
                broadcastToRoom(room, imageMessage);
            }

            else if (parsed.type === 'leave') {
                const room = parsed.room;
                const info = userConnections.get(socket);
                const username = info?.username || 'Anonymous';

                if (rooms[room]) {
                    rooms[room].delete(socket);
                    userConnections.delete(socket);
                    if (rooms[room].size === 0) delete rooms[room];
                    sendRoomPopulation(room);
                    sendUserList(room);
                    console.log(`${username} left room ${room}`);
                }
            }

            else {
                socket.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
            }
        } catch (err) {
            console.error('Message handling error:', err);
            socket.send(JSON.stringify({ type: 'error', message: 'Server error' }));
        }
    });

    socket.on('close', () => {
        const info = userConnections.get(socket);
        const username = info?.username || 'Anonymous';

        for (const roomId in rooms) {
            if (rooms[roomId].has(socket)) {
                rooms[roomId].delete(socket);
                if (rooms[roomId].size === 0) delete rooms[roomId];
                sendRoomPopulation(roomId);
                sendUserList(roomId);
            }
        }

        userConnections.delete(socket);
        console.log(`${username} disconnected`);
    });

    socket.on('error', (err) => {
        console.error(`WebSocket error:`, err);
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

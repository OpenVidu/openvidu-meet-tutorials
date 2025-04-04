import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Configuration
const SERVER_PORT = process.env.SERVER_PORT || 5080;
const OV_MEET_URL = process.env.OV_MEET_URL || 'http://localhost:6080/meet/api/v1';
const OV_MEET_API_KEY = process.env.OV_MEET_API_KEY || 'meet-api-key';

const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../public')));

// Map to store room names and their corresponding MeetRoom objects
const roomNameToMeetRoomMap = new Map();

// Create a new room
app.post('/rooms', async (req, res) => {
    try {
        // Extract values from request body
        const { roomName, expirationDate } = req.body;

        // Request to create a new MeetRoom
        const room = await httpRequest('POST', 'rooms', {
            roomIdPrefix: roomName,
            expirationDate: new Date(expirationDate).getTime()
        });

        // Store the room name and MeetRoom object in the map
        room.name = roomName;
        roomNameToMeetRoomMap.set(roomName, room);

        console.log('Room created:', room);
        res.status(200).json({ message: 'Room created successfully', room });
    } catch (error) {
        console.error('Room creation error:', error);
        res.status(500).json({ message: 'Error creating new room' });
    }
});

// List all rooms
app.get('/rooms', (_req, res) => {
    const rooms = Array.from(roomNameToMeetRoomMap.values());
    res.status(200).json({ rooms });
});

// Get room details
app.get('/rooms/:roomName', (req, res) => {
    const { roomName } = req.params;

    const room = roomNameToMeetRoomMap.get(roomName);
    if (!room) {
        res.status(404).json({ message: 'Room not found' });
        return;
    }

    res.status(200).json({ room });
});

// Receive webhook events
app.post('/webhook', (req, res) => {
    console.log('Webhook received:', req.body);
    res.status(200).send('Webhook received');
});

// Start the server
app.listen(SERVER_PORT, () => {
    console.log(`Server listening on http://localhost:${SERVER_PORT}`);
});

// Function to make HTTP requests to OpenVidu Meet API
const httpRequest = async (method, path, body) => {
    const response = await fetch(`${OV_MEET_URL}/${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': OV_MEET_API_KEY // Include the API key in the header for authentication
        },
        body: method !== 'GET' ? JSON.stringify(body) : undefined
    });

    const responseBody = await response.json();

    if (!response.ok) {
        throw new Error('Failed to fetch data from OpenVidu Meet API: ' + responseBody.errorMessage);
    }

    return responseBody;
};

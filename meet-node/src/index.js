import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Configuration
const SERVER_PORT = process.env.SERVER_PORT || 5080;
const OV_MEET_SERVER_URL = process.env.OV_MEET_SERVER_URL || 'http://localhost:6080';
const OV_MEET_WEBCOMPONENT_URL = `${OV_MEET_SERVER_URL}/meet/v1/openvidu-meet.js`;
const OV_MEET_API_URL = `${OV_MEET_SERVER_URL}/meet/api/v1`;
const OV_MEET_API_KEY = process.env.OV_MEET_API_KEY || 'meet-api-key';

const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../public')));

// OpenVidu Meet rooms indexed by name
const rooms = new Map();

// Get the OpenVidu Meet WebComponent URL
app.get('/config', (_req, res) => {
    res.status(200).json({
        ovMeetWebcomponentUrl: OV_MEET_WEBCOMPONENT_URL
    });
});

// Create a new room
app.post('/rooms', async (req, res) => {
    try {
        const { roomName } = req.body;

        if (!roomName) {
            res.status(400).json({ message: 'Room name is required' });
            return;
        }

        // Check if the room name already exists
        if (rooms.has(roomName)) {
            res.status(400).json({ message: 'Room name already exists' });
            return;
        }

        // Create a new OpenVidu Meet room using the API
        const room = await httpRequest('POST', 'rooms', {
            roomIdPrefix: roomName,
            preferences: {
                chatPreferences: {
                    enabled: true // Enable chat for this room
                },
                recordingPreferences: {
                    enabled: false // Disable recording for this room
                },
                virtualBackgroundPreferences: {
                    enabled: true // Enable virtual background for this room
                }
            }
        });

        // Add the room name to the OpenVidu Meet room object for easier access
        room.name = roomName;

        console.log('Room created:', room);
        rooms.set(roomName, room);
        res.status(201).json({ message: 'Room created successfully', room });
    } catch (error) {
        console.error('Room creation error:', error);
        res.status(500).json({ message: 'Error creating new room' });
    }
});

// List all rooms
app.get('/rooms', (_req, res) => {
    const roomsArray = Array.from(rooms.values());
    res.status(200).json({ rooms: roomsArray });
});

// Delete a room
app.delete('/rooms/:roomName', async (req, res) => {
    try {
        const { roomName } = req.params;

        // Check if the room exists
        const room = rooms.get(roomName);
        if (!room) {
            res.status(404).json({ message: 'Room not found' });
            return;
        }

        // Delete the OpenVidu Meet room using the API
        await httpRequest('DELETE', `rooms/${room.roomId}`);

        rooms.delete(roomName);
        res.status(200).json({ message: 'Room deleted successfully' });
    } catch (error) {
        console.error('Room deletion error:', error);
        res.status(500).json({ message: 'Error deleting room' });
    }
});

// Start the server
app.listen(SERVER_PORT, () => {
    console.log(`Server listening on http://localhost:${SERVER_PORT}`);
});

// Function to make HTTP requests to OpenVidu Meet API
const httpRequest = async (method, path, body) => {
    const response = await fetch(`${OV_MEET_API_URL}/${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': OV_MEET_API_KEY // Include the API key in the header for authentication
        },
        body: body ? JSON.stringify(body) : undefined
    });

    // Check if the response status is 204 (No Content)
    if (response.status === 204) {
        return;
    }

    const responseBody = await response.json();

    if (!response.ok) {
        throw new Error('Failed to fetch data from OpenVidu Meet API: ' + responseBody.message);
    }

    return responseBody;
};

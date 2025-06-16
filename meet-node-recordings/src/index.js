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
                    enabled: true, // Enable recording for this room
                    allowAccessTo: 'admin-moderator-publisher' // Allow access to recordings for admin, moderator and publisher roles
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

// List all recordings
app.get('/recordings', async (req, res) => {
    const { room: roomName } = req.query;
    const roomsArray = [];

    if (roomName) {
        // If a room is specified, filter recordings by room
        // Check if the room exists
        const room = rooms.get(roomName);
        if (!room) {
            res.status(404).json({ message: 'Room not found' });
            return;
        }

        roomsArray.push(room);
    } else {
        // If no room is specified, fetch recordings from all rooms
        roomsArray.push(...Array.from(rooms.values()));
    }

    const recordings = [];

    try {
        // Fetch recordings for each room
        for (const room of roomsArray) {
            const recordingsUrl = `recordings?maxItems=100&roomId=${room.roomId}`;
            const { recordings: roomRecordings } = await httpRequest('GET', recordingsUrl);
            recordings.push(...roomRecordings);
        }

        res.status(200).json({ recordings });
    } catch (error) {
        console.error('Error fetching recordings:', error);
        res.status(500).json({ message: 'Error fetching recordings' });
    }
});

// Delete a recording
app.delete('/recordings/:recordingId', async (req, res) => {
    const { recordingId } = req.params;

    try {
        // Delete the recording using OpenVidu Meet API
        await httpRequest('DELETE', `recordings/${recordingId}`);
        res.status(200).json({ message: 'Recording deleted successfully' });
    } catch (error) {
        console.error('Error deleting recording:', error);
        res.status(500).json({ message: 'Error deleting recording' });
    }
});

// Get recording URL
app.get('/recordings/:recordingId/url', async (req, res) => {
    const { recordingId } = req.params;

    try {
        // Fetch the recording URL using OpenVidu Meet API
        const { url } = await httpRequest('GET', `recordings/${recordingId}/url`);
        res.status(200).json({ url });
    } catch (error) {
        console.error('Error fetching recording URL:', error);
        res.status(500).json({ message: 'Error fetching recording URL' });
    }
});

// Start the server
app.listen(SERVER_PORT, () => {
    console.log(`Server listening on http://localhost:${SERVER_PORT}`);
});

// Function to make HTTP requests to OpenVidu Meet API
const httpRequest = async (method, path, body) => {
    const response = await fetch(`${OV_MEET_SERVER_URL}/meet/api/v1/${path}`, {
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
        throw new Error('Failed to perform request to OpenVidu Meet API: ' + responseBody.message);
    }

    return responseBody;
};

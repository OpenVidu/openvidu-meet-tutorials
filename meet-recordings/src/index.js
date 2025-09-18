import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Configuration
const SERVER_PORT = process.env.SERVER_PORT || 6080;
const OV_MEET_SERVER_URL = process.env.OV_MEET_SERVER_URL || 'http://localhost:9080';
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
    const { roomName } = req.body;

    if (!roomName) {
        res.status(400).json({ message: `'roomName' is required` });
        return;
    }

    // Check if the room name already exists
    if (rooms.has(roomName)) {
        res.status(400).json({ message: `Room '${roomName}' already exists` });
        return;
    }

    try {
        // Create a new OpenVidu Meet room using the API
        const room = await httpRequest('POST', 'rooms', {
            roomName,
            config: {
                // Default room configuration
                chat: {
                    enabled: true // Enable chat for this room
                },
                recording: {
                    enabled: true, // Enable recording for this room
                    allowAccessTo: 'admin_moderator_speaker' // Allow access to recordings for admin, moderator and speaker roles
                },
                virtualBackground: {
                    enabled: true // Enable virtual background for this room
                }
            }
        });

        console.log('Room created:', room);
        rooms.set(roomName, room);
        res.status(201).json({ message: `Room '${roomName}' created successfully`, room });
    } catch (error) {
        handleApiError(res, error, `Error creating room '${roomName}'`);
    }
});

// List all rooms
app.get('/rooms', (_req, res) => {
    const roomsArray = Array.from(rooms.values());
    res.status(200).json({ rooms: roomsArray });
});

// Delete a room
app.delete('/rooms/:roomName', async (req, res) => {
    const { roomName } = req.params;

    // Check if the room exists
    const room = rooms.get(roomName);
    if (!room) {
        res.status(404).json({ message: `Room '${roomName}' not found` });
        return;
    }

    try {
        // Delete the OpenVidu Meet room using the API
        await httpRequest('DELETE', `rooms/${room.roomId}`);

        rooms.delete(roomName);
        res.status(200).json({ message: `Room '${roomName}' deleted successfully` });
    } catch (error) {
        handleApiError(res, error, `Error deleting room '${roomName}'`);
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
        handleApiError(res, error, 'Error fetching recordings');
    }
});

// Delete a recording
app.delete('/recordings/:recordingId', async (req, res) => {
    const { recordingId } = req.params;

    try {
        // Delete the recording using OpenVidu Meet API
        await httpRequest('DELETE', `recordings/${recordingId}`);
        res.status(200).json({ message: `Recording '${recordingId}' deleted successfully` });
    } catch (error) {
        handleApiError(res, error, `Error deleting recording '${recordingId}'`);
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
        handleApiError(res, error, `Error fetching URL for recording '${recordingId}'`);
    }
});

// Start the server
app.listen(SERVER_PORT, () => {
    console.log(`Server listening on http://localhost:${SERVER_PORT}`);
});

// Function to make HTTP requests to OpenVidu Meet API
const httpRequest = async (method, path, body) => {
    const response = await fetch(`${OV_MEET_SERVER_URL}/api/v1/${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': OV_MEET_API_KEY // Include the API key in the header for authentication
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const responseBody = await response.json();

    if (!response.ok) {
        console.error('Error while performing request to OpenVidu Meet API:', responseBody);
        // Create an error object that includes the HTTP status code from the API
        const error = new Error(responseBody.message || 'Failed to perform request to OpenVidu Meet API');
        error.statusCode = response.status;
        throw error;
    }

    return responseBody;
};

// Helper function to handle API errors consistently
const handleApiError = (res, error, message) => {
    console.error(`${message}: ${error.message}`);
    const statusCode = error.statusCode || 500;
    const errorMessage = error.statusCode ? error.message : message;
    res.status(statusCode).json({ message: errorMessage });
};

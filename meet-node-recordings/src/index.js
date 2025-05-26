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
                    allowAccessTo: 'public' // Allow public access to recordings
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

// Stream recording media
// app.get('/recordings/:recordingId/media', async (req, res) => {
//     const { recordingId } = req.params;

//     try {
//         // Fetch the media file for the recording
//         const response = await fetch(`${OV_MEET_SERVER_URL}/meet/api/v1/recordings/${recordingId}/media`, {
//             headers: {
//                 'X-API-KEY': OV_MEET_API_KEY // Include the API key in the header for authentication
//             }
//         });

//         if (!response.ok) {
//             const responseBody = await response.json();
//             throw new Error('Failed to perform request to OpenVidu Meet API: ' + responseBody.message);
//         }

//         // Set the appropriate headers for streaming
//         res.setHeader('Content-Type', 'video/mp4');
//         res.setHeader('Content-Disposition', `attachment; filename="${recordingId}.mp4"`);

//         // Pipe the response to the client
//         response.body.pipe(res);
//     } catch (error) {
//         console.error('Error fetching recording media:', error);
//         res.status(500).json({ message: 'Error fetching recording media' });
//     }
// });

// Get recording media URL
app.get('/recordings/:recordingId/media', async (req, res) => {
    const { recordingId } = req.params;
    const recordingMediaUrl = `${OV_MEET_SERVER_URL}/meet/api/v1/recordings/${recordingId}/media`;
    res.status(200).json({ recordingMediaUrl });
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

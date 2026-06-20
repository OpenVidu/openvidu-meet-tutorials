import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Configuration
const SERVER_PORT = process.env.SERVER_PORT || 6080;
const OV_MEET_SERVER_URL = process.env.OV_MEET_SERVER_URL || 'http://localhost:9080/meet';
const OV_MEET_API_KEY = process.env.OV_MEET_API_KEY || 'meet-api-key';

const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../public')));

// --- ROOMS ---

// Create a new room
app.post('/rooms', async (req, res) => {
	const { roomName } = req.body;

	if (!roomName) {
		res.status(400).json({ message: `'roomName' is required` });
		return;
	}

	try {
		// Create a new OpenVidu Meet room using the API
		const room = await httpRequest('POST', 'rooms', {
			roomName
		});

		console.log('Room created:', room);
		res.status(201).json({ message: `Room '${roomName}' created successfully`, room });
	} catch (error) {
		handleApiError(res, error, `Error creating room '${roomName}'`);
	}
});

// List all rooms
app.get('/rooms', async (_req, res) => {
	try {
		// List all OpenVidu Meet rooms using the API (100 max)
		const { rooms } = await httpRequest('GET', 'rooms?maxItems=100');
		res.status(200).json({ rooms });
	} catch (error) {
		handleApiError(res, error, 'Error fetching rooms');
	}
});

// Delete a room
app.delete('/rooms/:roomId', async (req, res) => {
	const { roomId } = req.params;

	try {
		// Delete the OpenVidu Meet room using the API
		// We use the 'force' parameters to ensure that the room is deleted even if there are active meetings or recordings
		await httpRequest('DELETE', `rooms/${roomId}?withMeeting=force&withRecordings=force`);
		res.status(200).json({ message: `Room '${roomId}' deleted successfully` });
	} catch (error) {
		handleApiError(res, error, `Error deleting room '${roomId}'`);
	}
});

// --- ROOM MEMBERS (IDENTIFIED GUESTS) ---

// Add an identified guest to a room
app.post('/rooms/:roomId/members', async (req, res) => {
	const { roomId } = req.params;
	const { name, baseRole } = req.body;

	if (!name || !baseRole) {
		res.status(400).json({ message: `'name' and 'baseRole' are required` });
		return;
	}

	try {
		// Add an identified guest to the room.
		// Providing 'name' (and no 'userId') creates a member of type 'identified_guest':
		// the API generates a unique 'memberId' (guest-XXXX) and a unique 'accessUrl'
		// that grants access to the room without any authentication.
		const member = await httpRequest('POST', `rooms/${roomId}/members`, {
			name,
			baseRole
		});

		console.log('Identified guest added:', member);
		res.status(201).json({ message: `Identified guest '${name}' added to room '${roomId}'`, member });
	} catch (error) {
		handleApiError(res, error, `Error adding identified guest '${name}' to room '${roomId}'`);
	}
});

// List the identified guests of a room
app.get('/rooms/:roomId/members', async (req, res) => {
	const { roomId } = req.params;

	try {
		// List the identified guests of the room using the API (100 max)
		const { members } = await httpRequest('GET', `rooms/${roomId}/members?type=identified_guest&maxItems=100`);
		res.status(200).json({ members });
	} catch (error) {
		handleApiError(res, error, `Error fetching members of room '${roomId}'`);
	}
});

// Remove a member from a room
app.delete('/rooms/:roomId/members/:memberId', async (req, res) => {
	const { roomId, memberId } = req.params;

	try {
		// Removing a member revokes their access immediately
		// (they are expelled if currently in a meeting)
		await httpRequest('DELETE', `rooms/${roomId}/members/${memberId}`);
		res.status(200).json({ message: `Member '${memberId}' removed from room '${roomId}'` });
	} catch (error) {
		handleApiError(res, error, `Error removing member '${memberId}' from room '${roomId}'`);
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

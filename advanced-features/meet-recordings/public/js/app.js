const rooms = new Map();
const recordings = new Map();

document.addEventListener('DOMContentLoaded', async () => {
	await fetchRooms();
});

async function fetchRooms() {
	try {
		const { rooms: roomsList } = await httpRequest('GET', '/rooms');

		roomsList.forEach((room) => {
			rooms.set(room.roomId, room);
		});
		renderRooms();
	} catch (error) {
		console.error('Error fetching rooms:', error.message);

		// Show error message
		const roomsErrorElement = document.querySelector('#no-rooms-or-error');
		roomsErrorElement.textContent = 'Error loading rooms';
		roomsErrorElement.hidden = false;
	}
}

function renderRooms() {
	// Clear the previous list of rooms
	const roomsList = document.querySelector('#rooms-list ul');
	roomsList.innerHTML = '';

	// Show or remove the "No rooms found" message
	const noRoomsElement = document.querySelector('#no-rooms-or-error');
	if (rooms.size === 0) {
		noRoomsElement.textContent = 'No rooms found. Please create a new room.';
		noRoomsElement.hidden = false;
		return;
	} else {
		noRoomsElement.textContent = '';
		noRoomsElement.hidden = true;
	}

	// Add rooms to the list element
	Array.from(rooms.values()).forEach((room) => {
		const roomItem = getRoomListItemTemplate(room);
		roomsList.innerHTML += roomItem;
	});
}

function getRoomListItemTemplate(room) {
	return `
        <li class="ov-list-item">
            <span class="ov-list-item__name">${room.roomName}</span>
            <div class="ov-list-item__actions">
                <button
                    title="Access as moderator"
                    class="ov-btn ov-btn--primary ov-btn--sm"
                    onclick="accessRoom(
                        '${room.roomName}',
                        '${room.access.anonymous.moderator.url}',
                        'moderator'
                    );"
                >
                    <span class="material-symbols-outlined">shield_person</span>
                    Moderator
                </button>
                <button
                    title="Access as speaker"
                    class="ov-btn ov-btn--secondary ov-btn--sm"
                    onclick="accessRoom(
                        '${room.roomName}',
                        '${room.access.anonymous.speaker.url}',
                        'speaker'
                    );"
                >
                    <span class="material-symbols-outlined">record_voice_over</span>
                    Speaker
                </button>
                <button
                    class="ov-btn ov-btn--recordings ov-btn--sm"
                    onclick="listRecordingsByRoom('${room.roomName}');"
                >
                    <span class="material-symbols-outlined">video_library</span>
                    View Recordings
                </button>
                <button
                    title="Delete room"
                    class="ov-icon-btn ov-icon-btn--danger"
                    onclick="deleteRoom('${room.roomId}');"
                >
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        </li>
    `;
}

async function createRoom(e) {
	// Prevent the default form submission
	e.preventDefault();

	// Clear previous error message
	const errorDiv = document.querySelector('#create-room-error');
	errorDiv.textContent = '';
	errorDiv.hidden = true;

	try {
		const roomName = document.querySelector('#room-name').value;

		const { room } = await httpRequest('POST', '/rooms', {
			roomName
		});

		// Add the new room to the start (the API returns rooms newest first)
		prependToMap(rooms, room.roomId, room);
		renderRooms();

		// Reset the form
		const createRoomForm = document.querySelector('#create-room form');
		createRoomForm.reset();
	} catch (error) {
		console.error('Error creating room:', error.message);

		// Show error message
		errorDiv.textContent = 'Error creating room';
		errorDiv.hidden = false;
	}
}

async function deleteRoom(roomId) {
	try {
		await httpRequest('DELETE', `/rooms/${roomId}`);

		// Remove the room from the list
		rooms.delete(roomId);
		renderRooms();
	} catch (error) {
		console.error('Error deleting room:', error.message);
	}
}

function accessRoom(roomName, roomUrl, role) {
	console.log(`Accessing room as ${role}`);

	// Hide the home screen and show the room screen
	const homeScreen = document.querySelector('#home');
	homeScreen.hidden = true;
	const roomScreen = document.querySelector('#room');
	roomScreen.hidden = false;

	// Hide the room header until the local participant joins the meeting
	const roomHeader = document.querySelector('#room-header');
	roomHeader.hidden = true;

	// Inject the OpenVidu Meet component into the meet container specifying the room URL
	const meetContainer = document.querySelector('#meet-container');
	meetContainer.innerHTML = `
        <openvidu-meet 
            room-url="${roomUrl}"
        >
        </openvidu-meet>
    `;

	// Add event listeners for the OpenVidu Meet component
	const meet = document.querySelector('openvidu-meet');

	// Event listener for when the local participant joins the meeting
	meet.once('joined', () => {
		console.log('Local participant joined the meeting');

		// Show the room header with the room name
		roomHeader.hidden = false;
		const roomNameHeader = document.querySelector('#room-name-header');
		roomNameHeader.textContent = roomName;

		// Show end meeting button only for moderators
		const endMeetingButton = document.querySelector('#end-meeting-btn');
		if (role === 'moderator') {
			endMeetingButton.hidden = false;
		} else {
			endMeetingButton.hidden = true;
		}

		// Event listener for ending the meeting
		if (role === 'moderator') {
			endMeetingButton.addEventListener('click', () => {
				console.log('Ending meeting');
				meet.endMeeting();
			});
		}
	});

	// Event listener for when the local participant leaves the room
	meet.once('left', (event) => {
		console.log('Local participant left the room. Reason:', event.reason);

		// Hide the room header
		roomHeader.hidden = true;
	});

	// Event listener for when the OpenVidu Meet component is closed
	meet.once('closed', () => {
		console.log('OpenVidu Meet component closed');

		// Hide the room screen and show the home screen
		roomScreen.hidden = true;
		homeScreen.hidden = false;
	});
}

async function listRecordingsByRoom(roomName) {
	// Hide the home screen and show the recordings screen
	const homeScreen = document.querySelector('#home');
	homeScreen.hidden = true;
	const recordingsScreen = document.querySelector('#recordings');
	recordingsScreen.hidden = false;

	// Set the room name in the search input
	const roomNameInput = document.querySelector('#recordings-room-search');
	roomNameInput.value = roomName;

	await listRecordings();
}

function backToHome() {
	// Hide the recordings screen and show the home screen
	const recordingsScreen = document.querySelector('#recordings');
	recordingsScreen.hidden = true;
	const homeScreen = document.querySelector('#home');
	homeScreen.hidden = false;
}

async function listRecordings(e) {
	if (e) {
		// Prevent the default form submission
		e.preventDefault();
	}

	// Filter recordings by room name if provided
	const roomName = document.querySelector('#recordings-room-search').value;
	const recordingsUrl = '/recordings' + (roomName ? `?room=${roomName}` : '');

	try {
		const { recordings: recordingsList } = await httpRequest('GET', recordingsUrl);

		// Clear the previous recordings and populate the new ones
		recordings.clear();
		recordingsList.forEach((recording) => {
			recordings.set(recording.recordingId, recording);
		});
		renderRecordings();
	} catch (error) {
		console.error('Error listing recordings:', error.message);

		// Show error message
		const recordingsErrorElement = document.querySelector('#no-recordings-or-error');
		recordingsErrorElement.textContent = 'Error loading recordings';
		recordingsErrorElement.hidden = false;
	}
}

function renderRecordings() {
	// Clear the previous list of recordings
	const recordingsList = document.querySelector('#recordings-list ul');
	recordingsList.innerHTML = '';

	// Show or remove the "No recordings found" message
	const noRecordingsElement = document.querySelector('#no-recordings-or-error');
	if (recordings.size === 0) {
		noRecordingsElement.textContent = 'No recordings found for the filters applied.';
		noRecordingsElement.hidden = false;
		return;
	} else {
		noRecordingsElement.textContent = '';
		noRecordingsElement.hidden = true;
	}

	// Add recordings to the list element
	Array.from(recordings.values()).forEach((recording) => {
		const recordingItem = getRecordingListItemTemplate(recording);
		recordingsList.innerHTML += recordingItem;
	});
}

function getRecordingListItemTemplate(recording) {
	const recordingId = recording.recordingId;
	const roomName = recording.roomName;
	const startDate = recording.startDate ? new Date(recording.startDate).toLocaleString() : '-';
	const duration = recording.duration ? secondsToHms(recording.duration) : '-';
	const size = recording.size ? formatBytes(recording.size ?? 0) : '-';

	return `
        <li class="ov-recording">
            <span class="material-symbols-outlined ov-recording__icon">video_file</span>
            <div class="ov-recording__info">
                <p class="ov-recording__name">${roomName}</p>
                <p><span class="ov-recording__tag">Start date: </span><span class="ov-recording__value">${startDate}</span></p>
                <p><span class="ov-recording__tag">Duration: </span><span class="ov-recording__value">${duration}</span></p>
                <p><span class="ov-recording__tag">Size: </span><span class="ov-recording__value">${size}</span></p>
            </div>
            <div class="ov-recording__actions">
                <button title="Play" class="ov-icon-btn" onclick="displayRecording('${recordingId}')">
                    <span class="material-symbols-outlined">play_arrow</span>
                </button>
                <button title="Delete recording" class="ov-icon-btn ov-icon-btn--danger" onclick="deleteRecording('${recordingId}')">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        </li>
    `;
}

async function displayRecording(recordingId) {
	// Hide the recordings screen and show the display recording screen
	const recordingsScreen = document.querySelector('#recordings');
	recordingsScreen.hidden = true;
	const displayRecordingScreen = document.querySelector('#display-recording');
	displayRecordingScreen.hidden = false;

	// Get the recording media URL and set it to the source of the video element
	const recordingUrl = await getRecordingUrl(recordingId);

	// Inject the OpenVidu Meet component into the display recording container specifying the recording URL
	displayRecordingScreen.innerHTML = `
        <openvidu-meet 
            recording-url="${recordingUrl}"
        >
        </openvidu-meet>
    `;

	// Add event listener for when the OpenVidu Meet component is closed
	const meet = document.querySelector('openvidu-meet');
	meet.once('closed', () => {
		// Hide the display recording screen and show the recordings screen
		displayRecordingScreen.hidden = true;
		recordingsScreen.hidden = false;
	});
}

async function getRecordingUrl(recordingId) {
	try {
		const { url } = await httpRequest('GET', `/recordings/${recordingId}/url`);
		return url;
	} catch (error) {
		console.error('Error fetching recording URL:', error.message);
		return null;
	}
}

async function deleteRecording(recordingId) {
	try {
		await httpRequest('DELETE', `/recordings/${recordingId}`);

		// Remove the recording from the list
		recordings.delete(recordingId);
		renderRecordings();
	} catch (error) {
		console.error('Error deleting recording:', error.message);
	}
}

// Adds an entry to the start of a Map so newly created items appear first,
// matching the OpenVidu Meet API order (items are returned newest first)
function prependToMap(map, key, value) {
	const entries = [[key, value], ...map];
	map.clear();
	entries.forEach(([k, v]) => map.set(k, v));
}

// Function to make HTTP requests to the backend
async function httpRequest(method, path, body) {
	const response = await fetch(path, {
		method,
		headers: {
			'Content-Type': 'application/json'
		},
		body: body ? JSON.stringify(body) : undefined
	});

	const responseBody = await response.json();

	if (!response.ok) {
		throw new Error(responseBody.message || 'Failed to perform request to backend');
	}

	return responseBody;
}

function secondsToHms(seconds) {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor((seconds % 3600) % 60);

	const hDisplay = h > 0 ? h + 'h ' : '';
	const mDisplay = m > 0 ? m + 'm ' : '';
	const sDisplay = s + 's';
	return hDisplay + mDisplay + sDisplay;
}

function formatBytes(bytes) {
	if (bytes === 0) {
		return '0Bytes';
	}

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	const decimals = i < 2 ? 0 : 1;

	return (bytes / Math.pow(k, i)).toFixed(decimals) + sizes[i];
}

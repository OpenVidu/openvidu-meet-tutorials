const rooms = new Map();

document.addEventListener('DOMContentLoaded', async () => {
	await fetchRooms();
});

// --- ROOMS ---

async function fetchRooms() {
	try {
		const { rooms: roomsList } = await httpRequest('GET', '/rooms');

		rooms.clear();
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
	roomsList.innerHTML = Array.from(rooms.values())
		.map((room) => getRoomListItemTemplate(room))
		.join('');
}

function getRoomListItemTemplate(room) {
	return `
        <li class="ov-list-item">
            <span class="ov-list-item__name">${room.roomName}</span>
            <div class="ov-list-item__actions">
                <button
                    type="button"
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
                    type="button"
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
                    type="button"
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
		e.target.reset();
	} catch (error) {
		console.error('Error creating room:', error.message);

		// Show error message
		errorDiv.textContent = error.message || 'Error creating room';
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

// --- ACCESS ---

// Embed the OpenVidu Meet component and react to its events. 'roomName' and 'role' fill the
// custom room header shown once the local participant joins the meeting.
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

		// Show the participant's role as a badge
		const roleBadge = document.querySelector('#room-role-badge');
		const roleIcon = role === 'moderator' ? 'shield_person' : 'record_voice_over';
		roleBadge.className = `ov-badge ov-badge--${role === 'moderator' ? 'moderator' : 'speaker'}`;
		roleBadge.innerHTML = `<span class="material-symbols-outlined">${roleIcon}</span>${role}`;

		// The "End meeting" command is available only to moderators
		const endMeetingButton = document.querySelector('#end-meeting-btn');
		endMeetingButton.hidden = role !== 'moderator';
		endMeetingButton.onclick = role === 'moderator' ? () => meet.endMeeting() : null;
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

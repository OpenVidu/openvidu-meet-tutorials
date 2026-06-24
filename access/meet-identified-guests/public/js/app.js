const rooms = new Map();
const members = new Map();

// The room whose members are currently being managed
let currentRoom = null;

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
                    onclick="accessRoom('${room.access.anonymous.moderator.url}', '#home');"
                >
                    <span class="material-symbols-outlined">shield_person</span>
                    Moderator
                </button>
                <button
                    type="button"
                    title="Access as speaker"
                    class="ov-btn ov-btn--secondary ov-btn--sm"
                    onclick="accessRoom('${room.access.anonymous.speaker.url}', '#home');"
                >
                    <span class="material-symbols-outlined">record_voice_over</span>
                    Speaker
                </button>
                <button
                    type="button"
                    class="ov-btn ov-btn--users ov-btn--sm"
                    onclick="manageMembers('${room.roomId}');"
                >
                    <span class="material-symbols-outlined">group</span>
                    Members
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

// --- ROOM MEMBERS (IDENTIFIED GUESTS) ---

async function manageMembers(roomId) {
	currentRoom = rooms.get(roomId);
	if (!currentRoom) {
		return;
	}

	// Hide the home screen and show the members screen
	const homeScreen = document.querySelector('#home');
	homeScreen.hidden = true;
	const membersScreen = document.querySelector('#members');
	membersScreen.hidden = false;

	// Set the room name in the header
	const membersRoomName = document.querySelector('#members-room-name');
	membersRoomName.textContent = currentRoom.roomName;

	await fetchMembers();
}

function backToHome() {
	currentRoom = null;
	const membersScreen = document.querySelector('#members');
	membersScreen.hidden = true;
	const homeScreen = document.querySelector('#home');
	homeScreen.hidden = false;
}

async function fetchMembers() {
	try {
		const { members: membersList } = await httpRequest('GET', `/rooms/${currentRoom.roomId}/members`);

		members.clear();
		membersList.forEach((member) => {
			members.set(member.memberId, member);
		});
		renderMembers();
	} catch (error) {
		console.error('Error fetching members:', error.message);

		// Show error message
		const membersErrorElement = document.querySelector('#no-members-or-error');
		membersErrorElement.textContent = 'Error loading members';
		membersErrorElement.hidden = false;
	}
}

function renderMembers() {
	// Clear the previous list of members
	const membersList = document.querySelector('#members-list ul');
	membersList.innerHTML = '';

	// Show or remove the "No members found" message
	const noMembersElement = document.querySelector('#no-members-or-error');
	if (members.size === 0) {
		noMembersElement.textContent = 'No members yet. Add an identified guest to this room.';
		noMembersElement.hidden = false;
		return;
	} else {
		noMembersElement.textContent = '';
		noMembersElement.hidden = true;
	}

	// Add members to the list element
	membersList.innerHTML = Array.from(members.values())
		.map((member) => getMemberListItemTemplate(member))
		.join('');
}

function getMemberListItemTemplate(member) {
	// In this tutorial every member is an identified guest, so each one has a unique
	// access link and buttons to copy it, access the room through it and remove the member.
	return `
        <li class="ov-member">
            <div class="ov-member__info">
                <p class="ov-member__name">
                    ${member.name}
                    <span class="ov-badge ov-badge--${member.baseRole === 'moderator' ? 'moderator' : 'speaker'}">
                        <span class="material-symbols-outlined">${member.baseRole === 'moderator' ? 'shield_person' : 'record_voice_over'}</span>
                        ${member.baseRole}
                    </span>
                </p>
                <p class="ov-member__url" title="${member.accessUrl}">${member.accessUrl}</p>
            </div>
            <div class="ov-member__actions">
                <button
					type="button"
					title="Copy access link"
					class="ov-icon-btn"
					onclick="copyAccessUrl('${member.memberId}', this)"
				>
                    <span class="material-symbols-outlined">content_copy</span>
                </button>
                <button
					type="button"
					title="Access as ${member.name}"
					class="ov-icon-btn"
					onclick="accessRoom('${member.accessUrl}', '#members')"
				>
                    <span class="material-symbols-outlined">login</span>
                </button>
                <button
					type="button"
					title="Remove member"
					class="ov-icon-btn ov-icon-btn--danger"
					onclick="removeMember('${member.memberId}')"
				>
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        </li>
    `;
}

async function addGuest(e) {
	// Prevent the default form submission
	e.preventDefault();

	// Clear previous error message
	const errorDiv = document.querySelector('#add-member-error');
	errorDiv.textContent = '';
	errorDiv.hidden = true;

	try {
		const name = document.querySelector('#guest-name').value;
		const baseRole = document.querySelector('#guest-role').value;

		// Providing 'name' adds an identified guest (member of type 'identified_guest')
		const { member } = await httpRequest('POST', `/rooms/${currentRoom.roomId}/members`, {
			name,
			baseRole
		});

		// Add the new member to the start (the API returns members newest first)
		prependToMap(members, member.memberId, member);
		renderMembers();

		// Reset the form
		e.target.reset();
	} catch (error) {
		console.error('Error adding guest:', error.message);

		// Show error message
		errorDiv.textContent = error.message || 'Error adding guest';
		errorDiv.hidden = false;
	}
}

async function removeMember(memberId) {
	try {
		await httpRequest('DELETE', `/rooms/${currentRoom.roomId}/members/${memberId}`);

		// Remove the member from the list
		members.delete(memberId);
		renderMembers();
	} catch (error) {
		console.error('Error removing member:', error.message);
	}
}

async function copyAccessUrl(memberId, button) {
	const member = members.get(memberId);
	if (!member) {
		return;
	}

	try {
		await navigator.clipboard.writeText(member.accessUrl);

		// Briefly show a confirmation icon
		const icon = button.querySelector('.material-symbols-outlined');
		icon.textContent = 'check';
		setTimeout(() => {
			icon.textContent = 'content_copy';
		}, 1500);
	} catch (error) {
		console.error('Error copying access link:', error.message);
	}
}

// --- ACCESS ---

// Embed the OpenVidu Meet component for the given room URL.
// 'returnViewId' is the view to show again when the meeting is closed
// (the home screen for anonymous access, the members screen for an identified guest).
function accessRoom(roomUrl, returnViewId) {
	// Hide the home and members screens and show the room screen
	const homeScreen = document.querySelector('#home');
	homeScreen.hidden = true;
	const membersScreen = document.querySelector('#members');
	membersScreen.hidden = true;
	const roomScreen = document.querySelector('#room');
	roomScreen.hidden = false;

	// Inject the OpenVidu Meet component into the meet container specifying the room URL
	const meetContainer = document.querySelector('#meet-container');
	meetContainer.innerHTML = `
        <openvidu-meet
            room-url="${roomUrl}"
        >
        </openvidu-meet>
    `;

	// Add event listener for when the OpenVidu Meet component is closed
	const meet = document.querySelector('openvidu-meet');
	meet.once('closed', () => {
		console.log('OpenVidu Meet component closed');

		// Clear the component and go back to the view we came from
		meetContainer.innerHTML = '';
		roomScreen.hidden = true;
		const returnView = document.querySelector(returnViewId);
		returnView.hidden = false;
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

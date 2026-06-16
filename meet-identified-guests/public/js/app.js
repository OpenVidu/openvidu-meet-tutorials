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
	Array.from(rooms.values()).forEach((room) => {
		const roomItem = getRoomListItemTemplate(room);
		roomsList.innerHTML += roomItem;
	});
}

function getRoomListItemTemplate(room) {
	return `
        <li class="list-group-item">
            <span>${room.roomName}</span>
            <div class="room-actions">
                <button
                    class="btn btn-primary btn-sm"
                    onclick="joinRoom('${room.access.anonymous.moderator.url}', '#home');"
                >
                    Join as Moderator
                </button>
                <button
                    class="btn btn-secondary btn-sm"
                    onclick="joinRoom('${room.access.anonymous.speaker.url}', '#home');"
                >
                    Join as Speaker
                </button>
                <button class="btn btn-success btn-sm" onclick="manageMembers('${room.roomId}');">
                    Members
                </button>
                <button
                    title="Delete room"
                    class="icon-button delete-button"
                    onclick="deleteRoom('${room.roomId}');"
                >
                    <i class="fa-solid fa-trash"></i>
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

		// Add new room to the list
		rooms.set(room.roomId, room);
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
	document.querySelector('#home').hidden = true;
	document.querySelector('#members').hidden = false;

	// Set the room name in the header
	document.querySelector('#members-room-name').textContent = currentRoom.roomName;

	await fetchMembers();
}

function backToHome() {
	currentRoom = null;
	document.querySelector('#members').hidden = true;
	document.querySelector('#home').hidden = false;
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
	Array.from(members.values()).forEach((member) => {
		const memberItem = getMemberListItemTemplate(member);
		membersList.innerHTML += memberItem;
	});
}

function getMemberListItemTemplate(member) {
	// In this tutorial every member is an identified guest, so each one has a unique
	// access link and buttons to copy it, join through it and remove the member.
	return `
        <li class="member-container">
            <div class="member-info">
                <p class="member-name">
                    ${member.name}
                    <span class="badge ${member.baseRole === 'moderator' ? 'bg-primary' : 'bg-secondary'}">
                        ${member.baseRole}
                    </span>
                </p>
                <p class="member-url" title="${member.accessUrl}">${member.accessUrl}</p>
            </div>
            <div class="member-actions">
                <button 
					title="Copy access link"
					class="icon-button"
					onclick="copyAccessUrl('${member.memberId}', this)"
				>
                    <i class="fa-solid fa-copy"></i>
                </button>
                <button 
					title="Join as ${member.name}"
					class="icon-button"
					onclick="joinRoom('${member.accessUrl}', '#members')"
				>
                    <i class="fa-solid fa-right-to-bracket"></i>
                </button>
                <button
					title="Remove member"
					class="icon-button delete-button"
					onclick="removeMember('${member.memberId}')"
				>
                    <i class="fa-solid fa-trash"></i>
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

		// Add new member to the list
		members.set(member.memberId, member);
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
		const icon = button.querySelector('i');
		const previousClass = icon.className;
		icon.className = 'fa-solid fa-check';
		setTimeout(() => {
			icon.className = previousClass;
		}, 1500);
	} catch (error) {
		console.error('Error copying access link:', error.message);
	}
}

// --- JOIN ---

// Embed the OpenVidu Meet component for the given room URL.
// 'returnViewId' is the view to show again when the meeting is closed
// (the home screen for anonymous access, the members screen for an identified guest).
function joinRoom(roomUrl, returnViewId) {
	// Hide the home and members screens and show the room screen
	document.querySelector('#home').hidden = true;
	document.querySelector('#members').hidden = true;
	const roomScreen = document.querySelector('#room');
	roomScreen.hidden = false;

	// Inject the OpenVidu Meet component into the meeting container specifying the room URL
	const meetingContainer = document.querySelector('#meeting-container');
	meetingContainer.innerHTML = `
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
		meetingContainer.innerHTML = '';
		roomScreen.hidden = true;
		document.querySelector(returnViewId).hidden = false;
	});
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

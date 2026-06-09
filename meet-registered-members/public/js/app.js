const users = new Map();
const rooms = new Map();
const members = new Map();

// The room whose members are currently being managed
let currentRoom = null;

document.addEventListener('DOMContentLoaded', async () => {
	await Promise.all([fetchUsers(), fetchRooms()]);
});

// --- USERS ---

async function fetchUsers() {
	try {
		const { users: usersList } = await httpRequest('GET', '/users');

		users.clear();
		usersList.forEach((user) => {
			users.set(user.userId, user);
		});
		renderUsers();
	} catch (error) {
		console.error('Error fetching users:', error.message);

		// Show error message
		const usersErrorElement = document.querySelector('#no-users-or-error');
		usersErrorElement.textContent = 'Error loading users';
		usersErrorElement.hidden = false;
	}
}

function renderUsers() {
	// Clear the previous list of users
	const usersList = document.querySelector('#users-list');
	usersList.innerHTML = '';

	// Show or remove the "No users found" message
	const noUsersElement = document.querySelector('#no-users-or-error');
	if (users.size === 0) {
		noUsersElement.textContent = 'No users found. Please create a new user.';
		noUsersElement.hidden = false;
		return;
	} else {
		noUsersElement.textContent = '';
		noUsersElement.hidden = true;
	}

	// Add users to the list element
	Array.from(users.values()).forEach((user) => {
		const userItem = getUserListItemTemplate(user);
		usersList.innerHTML += userItem;
	});
}

function getUserListItemTemplate(user) {
	return `
        <li class="list-group-item">
            <span><strong>${user.userId}</strong> · ${user.name}</span>
            <button
                title="Delete user"
                class="icon-button delete-button"
                onclick="deleteUser('${user.userId}');"
            >
                <i class="fa-solid fa-trash"></i>
            </button>
        </li>
    `;
}

async function createUser(e) {
	// Prevent the default form submission
	e.preventDefault();

	// Clear previous error message
	const errorDiv = document.querySelector('#create-user-error');
	errorDiv.textContent = '';
	errorDiv.hidden = true;

	try {
		const userId = document.querySelector('#user-id').value;
		const name = document.querySelector('#user-name').value;
		const password = document.querySelector('#user-password').value;

		const { user } = await httpRequest('POST', '/users', {
			userId,
			name,
			password
		});

		// Add new user to the list
		users.set(user.userId, user);
		renderUsers();

		// Reset the form
		e.target.reset();
	} catch (error) {
		console.error('Error creating user:', error.message);

		// Show error message
		errorDiv.textContent = error.message || 'Error creating user';
		errorDiv.hidden = false;
	}
}

async function deleteUser(userId) {
	try {
		await httpRequest('DELETE', `/users/${userId}`);

		// Remove the user from the list
		users.delete(userId);
		renderUsers();
	} catch (error) {
		console.error('Error deleting user:', error.message);
	}
}

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
	const roomsList = document.querySelector('#rooms-list');
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
					onclick="manageMembers('${room.roomId}');"
				>
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

// --- ROOM MEMBERS ---

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
	// Refresh the list of users that can still be added as members
	renderMemberUserOptions();

	// Clear the previous list of members
	const membersList = document.querySelector('#members-list ul');
	membersList.innerHTML = '';

	// Show or remove the "No members found" message
	const noMembersElement = document.querySelector('#no-members-or-error');
	if (members.size === 0) {
		noMembersElement.textContent = 'No members yet. Add a user as a member of this room.';
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

// Populate the "add member" select with the users that are not already members of the room
function renderMemberUserOptions() {
	const select = document.querySelector('#member-user');
	const availableUsers = Array.from(users.values()).filter((user) => !members.has(user.userId));

	if (availableUsers.length === 0) {
		select.innerHTML = `<option value="" disabled selected>No users available</option>`;
		return;
	}

	select.innerHTML =
		`<option value="" disabled selected>Select a user</option>` +
		availableUsers.map((user) => `<option value="${user.userId}">${user.userId} · ${user.name}</option>`).join('');
}

function getMemberListItemTemplate(member) {
	return `
        <li class="member-container">
            <div class="member-info">
                <p class="member-name">
                    ${member.name}
                    <span class="badge ${member.baseRole === 'moderator' ? 'bg-primary' : 'bg-secondary'}">
                        ${member.baseRole}
                    </span>
                </p>
                <p class="member-id" title="${member.memberId}">${member.memberId}</p>
            </div>
            <div class="member-actions">
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

async function addMember(e) {
	// Prevent the default form submission
	e.preventDefault();

	// Clear previous error message
	const errorDiv = document.querySelector('#add-member-error');
	errorDiv.textContent = '';
	errorDiv.hidden = true;

	try {
		const userId = document.querySelector('#member-user').value;
		const baseRole = document.querySelector('#member-role').value;

		const { member } = await httpRequest('POST', `/rooms/${currentRoom.roomId}/members`, {
			userId,
			baseRole
		});

		// Add new member to the list
		members.set(member.memberId, member);
		renderMembers();
	} catch (error) {
		console.error('Error adding member:', error.message);

		// Show error message
		errorDiv.textContent = error.message || 'Error adding member';
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

// --- JOIN ---

function joinRoom() {
	// All registered members share the same authenticated access URL for the room.
	// Each member proves their identity by logging in with their OpenVidu Meet credentials.
	const roomUrl = currentRoom.access.registered.url;
	console.log(`Joining room through URL: ${roomUrl}`);

	// Hide the members screen and show the room screen
	const membersScreen = document.querySelector('#members');
	membersScreen.hidden = true;
	const roomScreen = document.querySelector('#room');
	roomScreen.hidden = false;

	// Inject the OpenVidu Meet component into the meeting container specifying the room URL.
	// Since this URL requires authentication, OpenVidu Meet will show its own login form
	// inside the component until the member logs in.
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

		// Clear the component and go back to the members screen
		meetingContainer.innerHTML = '';
		roomScreen.hidden = true;
		membersScreen.hidden = false;
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

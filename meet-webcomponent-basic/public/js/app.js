const rooms = new Map();

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
        console.error('Error fetching rooms:', error);

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
                    onclick="joinRoom('${room.moderatorUrl}');"
                >
                    Join as Moderator
                </button>
                <button
                    class="btn btn-secondary btn-sm"
                    onclick="joinRoom('${room.speakerUrl}');"
                >
                    Join as Speaker
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

async function createRoom() {
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
        const createRoomForm = document.querySelector('#create-room form');
        createRoomForm.reset();
    } catch (error) {
        console.error('Error creating room:', error);

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
        console.error('Error deleting room:', error);
    }
}

function joinRoom(roomUrl) {
    // Hide the home screen and show the room screen
    const homeScreen = document.querySelector('#home');
    homeScreen.hidden = true;
    const roomScreen = document.querySelector('#room');
    roomScreen.hidden = false;

    // Inject the OpenVidu Meet component into the meeting container specifying the room URL
    const meetingContainer = document.querySelector('#meeting-container');
    meetingContainer.innerHTML = `
        <openvidu-meet
            room-url="${roomUrl}"
            leave-redirect-url="/"
        >
        </openvidu-meet>
    `;
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
        throw new Error('Failed to perform request to backend: ' + responseBody.message);
    }

    return responseBody;
}

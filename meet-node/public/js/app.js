const rooms = new Map();

document.addEventListener('DOMContentLoaded', async () => {
    await fetchRooms();
});

async function fetchRooms() {
    try {
        const { rooms: roomsList } = await httpRequest('GET', '/rooms');

        roomsList.forEach((room) => {
            rooms.set(room.name, room);
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
            <span>${room.name}</span>
            <div class="room-actions">
                <button
                    class="btn btn-primary btn-sm"
                    onclick="joinRoom(
                        '${room.name}', 
                        '${room.moderatorRoomUrl}', 
                        'moderator'
                    );"
                >
                    Join as Moderator
                </button>
                <button
                    class="btn btn-secondary btn-sm"
                    onclick="joinRoom(
                        '${room.name}', 
                        '${room.publisherRoomUrl}', 
                        'publisher',
                    );"
                >
                    Join as Publisher
                </button>
                <button title="Delete room" class="icon-button delete-button" onclick="deleteRoom('${room.name}');">
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
        rooms.set(roomName, room);
        renderRooms();

        // Reset the form
        const createRoomForm = document.querySelector('#create-room form');
        createRoomForm.reset();
    } catch (error) {
        console.error('Error creating room:', error);

        // Show error message
        if (error.message.includes('already exists')) {
            errorDiv.textContent = 'Room name already exists';
        } else {
            errorDiv.textContent = 'Error creating room';
        }

        errorDiv.hidden = false;
    }
}

async function deleteRoom(roomName) {
    try {
        await httpRequest('DELETE', `/rooms/${roomName}`);

        // Remove the room from the list
        rooms.delete(roomName);
        renderRooms();
    } catch (error) {
        console.error('Error deleting room:', error);
    }
}

function joinRoom(roomName, roomUrl, role) {
    console.log(`Joining room as ${role}`);

    // Hide the home screen and show the room screen
    const homeScreen = document.querySelector('#home');
    homeScreen.hidden = true;
    const roomScreen = document.querySelector('#room');
    roomScreen.hidden = false;

    // Hide the room header until the local participant joins
    const roomHeader = document.querySelector('#room-header');
    roomHeader.hidden = true;

    // Inject the OpenVidu Meet component into the meeting container specifying the room URL
    const meetingContainer = document.querySelector('#meeting-container');
    meetingContainer.innerHTML = `
        <openvidu-meet 
            room-url="${roomUrl}"
        >
        </openvidu-meet>
    `;

    // Add event listeners for the OpenVidu Meet component
    const meet = document.querySelector('openvidu-meet');

    // Event listener for when the local participant joins the room
    meet.once('JOIN', () => {
        console.log('Local participant connected to the room');

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
    meet.once('LEFT', (event) => {
        console.log('Local participant left the room');
        displayDisconnectedScreen(event.reason);
    });

    // Event listener for when the meeting ends
    meet.once('MEETING_ENDED', () => {
        console.log('Meeting ended');
        displayDisconnectedScreen('meeting-ended');
    });
}

function displayDisconnectedScreen(reason) {
    // Hide the room screen and show the disconnected screen
    const roomScreen = document.querySelector('#room');
    roomScreen.hidden = true;
    const disconnectedScreen = document.querySelector('#disconnected');
    disconnectedScreen.hidden = false;

    // Set the disconnected screen message and reason
    const disconnectedMessage = document.querySelector('#disconnected-title');
    const disconnectedReason = document.querySelector('#disconnected-reason');
    const participantLeft = reason === 'LEAVE';

    if (participantLeft) {
        disconnectedMessage.textContent = 'You have left the meeting';
        disconnectedReason.hidden = true;
    } else {
        disconnectedMessage.textContent = 'You have been disconnected from the meeting';
        disconnectedReason.hidden = false;

        let reasonText;
        switch (reason) {
            case 'meeting-ended':
                reasonText = 'The meeting has ended';
                break;
            case 'participant_removed':
                reasonText = 'A moderator removed you from the meeting';
                break;
            default:
                reasonText = 'Connection problem';
        }

        disconnectedReason.textContent = `Reason: ${reasonText}`;
    }

    // Reset the meeting container
    const meetingContainer = document.querySelector('#meeting-container');
    meetingContainer.innerHTML = '';

    // Return to the home screen
    const homeButton = document.querySelector('#home-btn');
    homeButton.addEventListener('click', () => {
        disconnectedScreen.hidden = true;
        const homeScreen = document.querySelector('#home');
        homeScreen.hidden = false;
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
        throw new Error('Failed to fetch data from backend: ' + responseBody.message);
    }

    return responseBody;
}

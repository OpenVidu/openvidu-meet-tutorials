document.addEventListener('DOMContentLoaded', async function () {
    const roomsListContainer = document.querySelector('.rooms-list');
    const homeScreen = document.querySelector('#home');
    const roomScreen = document.querySelector('#room');

    async function fetchRooms() {
        try {
            const { rooms } = await httpRequest('GET', '/rooms');
            renderRooms(rooms);
        } catch (error) {
            console.error('Error fetching rooms:', error);
            roomsListContainer.innerHTML = '<p class="text-muted text-center">Error loading rooms</p>';
        }
    }

    function renderRooms(rooms) {
        if (rooms.length === 0) {
            roomsListContainer.innerHTML = '<p class="text-muted text-center">No rooms available</p>';
            return;
        }

        const ul = document.createElement('ul');
        ul.classList.add('list-group');

        rooms.forEach((room) => {
            const li = createRoomListItem(room);
            ul.appendChild(li);
        });

        roomsListContainer.innerHTML = '';
        roomsListContainer.appendChild(ul);
    }

    function createRoomListItem(room) {
        const li = document.createElement('li');
        li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');

        li.innerHTML = `
            <span>${room.name}</span>
            <div class="dropdown">
                <button class="btn btn-primary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
                    Join as
                </button>
                <ul class="dropdown-menu">
                    <li>
                        <form onsubmit="joinRoom(event, '${room.name}', '${room.moderatorRoomUrl}', 'moderator');">
                            <button type="submit" class="dropdown-item">Moderator</button>
                        </form>
                    </li>
                    <li>
                        <form onsubmit="joinRoom(event, '${room.name}', '${room.publisherRoomUrl}', 'publisher');">
                            <button type="submit" class="dropdown-item">Publisher</button>
                        </form>
                    </li>
                </ul>
            </div>
        `;
        return li;
    }

    window.createRoom = async function () {
        const createRoomForm = document.querySelector('.create-room form');
        const roomName = document.querySelector('#room-name').value;
        const expirationDate = document.querySelector('#expiration-date').value;
        const errorDiv = document.querySelector('#create-room-error');

        // Clear previous error message
        errorDiv.classList.add('d-none');
        errorDiv.textContent = '';

        try {
            const { room: newRoom } = await httpRequest('POST', '/rooms', {
                roomName,
                expirationDate
            });

            // Add new room to the list
            const ul = roomsListContainer.querySelector('ul') || document.createElement('ul');
            ul.classList.add('list-group');
            ul.appendChild(createRoomListItem(newRoom));

            roomsListContainer.innerHTML = '';
            roomsListContainer.appendChild(ul);

            // Reset the form
            createRoomForm.reset();
        } catch (error) {
            console.error('Error creating room:', error);
            errorDiv.classList.remove('d-none');

            if (error.message.includes('already exists')) {
                errorDiv.textContent = 'Room name already exists';
            } else {
                errorDiv.textContent = 'Error creating room';
            }
        }
    };

    window.joinRoom = function (event, roomName, roomUrl, role) {
        event.preventDefault();
        console.log(`Joining room as ${role}`);

        const endMeetingButton = document.querySelector('#end-meeting-btn');
        const meetingContainer = document.querySelector('#meeting-container');

        // Set the room name in the header
        const roomNameHeader = document.querySelector('#room-name-header');
        roomNameHeader.textContent = roomName;

        // Show end meeting button only for moderators
        if (role === 'moderator') {
            endMeetingButton.classList.remove('d-none');
        } else {
            endMeetingButton.classList.add('d-none');
        }

        // Inject the OpenVidu Meet component into the meeting container specifying the room URL
        meetingContainer.innerHTML = `
            <openvidu-meet 
                room-url="${roomUrl}">
            </openvidu-meet>
        `;

        // Add event listeners for the OpenVidu Meet component
        const meet = document.querySelector('openvidu-meet');

        // Event listener for when the local participant left the room
        meet.addEventListener('left', () => {
            console.log('Local participant left the room');

            // Hide the room screen and show the home screen
            homeScreen.hidden = false;
            roomScreen.hidden = true;

            // Reset the meeting container
            meetingContainer.innerHTML = '';
        });

        // Event listener for ending the meeting
        if (role === 'moderator') {
            endMeetingButton.addEventListener('click', () => {
                console.log('Ending meeting');
                meet.endMeeting();
            });
        }

        // Hide the home screen and show the room screen
        homeScreen.hidden = true;
        roomScreen.hidden = false;
    };

    fetchRooms();
});

// Function to make HTTP requests to the backend
async function httpRequest(method, path, body) {
    const response = await fetch(path, {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: method !== 'GET' ? JSON.stringify(body) : undefined
    });

    const responseBody = await response.json();

    if (!response.ok) {
        throw new Error('Failed to fetch data from backend: ' + responseBody.message);
    }

    return responseBody;
}

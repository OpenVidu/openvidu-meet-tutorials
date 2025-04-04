document.getElementById('end-meeting-btn')?.addEventListener('click', () => {
    const meet = document.querySelector('openvidu-meet');
    meet.endMeeting();
});

document.addEventListener('DOMContentLoaded', async function () {
    const roomsListContainer = document.querySelector('.rooms-list');
    const createRoomForm = document.querySelector('.create-room form');

    const homeScreen = document.querySelector('#home');
    const roomScreen = document.querySelector('#room');

    const controlPanel = document.querySelector('#control-panel');
    const meetingContainer = document.querySelector('#meeting-container');

    async function fetchRooms() {
        try {
            const response = await fetch('/rooms');
            if (!response.ok) throw new Error('Failed to fetch rooms');

            const { rooms } = await response.json();
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
                        <form onsubmit="joinRoom(event, '${room.moderatorRoomUrl}', 'moderator');">
                            <button type="submit" class="dropdown-item">Moderator</button>
                        </form>
                    </li>
                    <li>
                        <form onsubmit="joinRoom(event, '${room.publisherRoomUrl}', 'publisher');">
                            <button type="submit" class="dropdown-item">Publisher</button>
                        </form>
                    </li>
                </ul>
            </div>
        `;
        return li;
    }

    window.createRoom = async function () {
        const roomName = document.querySelector('#room-name').value;
        const expirationDate = document.querySelector('#expiration-date').value;

        try {
            const response = await fetch('/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName, expirationDate })
            });

            if (!response.ok) throw new Error('Failed to create room');
            const { room: newRoom } = await response.json();

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
        }
    };

    window.joinRoom = function (event, roomUrl, role) {
        event.preventDefault();
        console.log(`Joining room as ${role}:`, roomUrl);

        // Hide the home screen and show the room screen
        homeScreen.hidden = true;
        roomScreen.hidden = false;

        // Inject the OpenVidu Meet component into the meeting container specifying the room URL
        meetingContainer.innerHTML = `
			<openvidu-meet 
				room-url="${roomUrl}" 
				leave-redirect-url="http://localhost:5080">
			</openvidu-meet>
		`;

        // Show commands only for moderators
        if (role === 'moderator') {
            controlPanel.hidden = false;
        } else {
            controlPanel.hidden = true;
        }
    };

    fetchRooms();
});

const rooms = new Map();
const recordings = new Map();

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
                        'publisher'
                    );"
                >
                    Join as Publisher
                </button>
                <button class="btn btn-success btn-sm" onclick="listRecordingsByRoom('${room.name}');">View Recordings</button>
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

    // Set the room name in the header
    const roomNameHeader = document.querySelector('#room-name-header');
    roomNameHeader.textContent = roomName;

    // Show end meeting button only for moderators
    const endMeetingButton = document.querySelector('#end-meeting-btn');
    if (role === 'moderator') {
        endMeetingButton.hidden = false;
    } else {
        endMeetingButton.hidden = true;
    }

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

    // Event listener for ending the meeting
    if (role === 'moderator') {
        endMeetingButton.addEventListener('click', () => {
            console.log('Ending meeting');
            meet.endMeeting();
        });
    }
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

async function listRecordings() {
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
        console.error('Error listing recordings:', error);

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

    // Sort recordings by start date in ascending order
    const recordingsArray = Array.from(recordings.values());
    const sortedRecordings = sortRecordingsByDate(recordingsArray);

    // Add recordings to the list element
    sortedRecordings.forEach((recording) => {
        const recordingItem = getRecordingListItemTemplate(recording);
        recordingsList.innerHTML += recordingItem;
    });
}

function sortRecordingsByDate(recordings) {
    return recordings.sort((a, b) => {
        const dateA = new Date(a.startDate || -1);
        const dateB = new Date(b.startDate || -1);
        return dateA.getTime() - dateB.getTime();
    });
}

function getRecordingListItemTemplate(recording) {
    const recordingId = recording.recordingId;
    const name = recording.filename;
    const startDate = recording.startDate ? new Date(recording.startDate).toLocaleString() : '-';
    const endDate = recording.endDate ? new Date(recording.endDate).toLocaleString() : '-';
    const duration = recording.duration ? secondsToHms(recording.duration) : '-';
    const size = recording.size ? formatBytes(recording.size ?? 0) : '-';
    const status = recording.status;

    // Determine which buttons to show based on the recording status
    const showPlayButton = status === 'COMPLETE';
    const showDeleteButton = !['STARTING', 'ACTIVE', 'ENDING'].includes(status);

    return `
        <li class="recording-container">
            <i class="fa-solid fa-file-video"></i>
            <div class="recording-info">
                <p class="recording-name">${name}</p>
                <p><span class="recording-info-tag">Start date: </span><span class="recording-info-value">${startDate}</span></p>
                <p><span class="recording-info-tag">End date: </span><span class="recording-info-value">${endDate}</span></p>
                <p><span class="recording-info-tag">Duration: </span><span class="recording-info-value">${duration}</span></p>
                <p><span class="recording-info-tag">Size: </span><span class="recording-info-value">${size}</span></p>
                <p><span class="recording-info-tag">Status: </span><span class="recording-info-value">${status}</span></p>
            </div>
            <div class="recording-actions">
                ${
                    showPlayButton
                        ? `
                <button title="Play" class="icon-button" onclick="displayRecording('${recordingId}')">
                    <i class="fa-solid fa-play"></i>
                </button>`
                        : ''
                }
                ${
                    showDeleteButton
                        ? `
                <button title="Delete recording" class="icon-button delete-button" onclick="deleteRecording('${recordingId}')">
                    <i class="fa-solid fa-trash"></i>
                </button>`
                        : ''
                }
            </div>
        </li>
    `;
}

async function displayRecording(recordingName) {
    // Open the recording video dialog
    const recordingVideoDialog = document.querySelector('#recording-video-dialog');
    recordingVideoDialog.showModal();

    // Get the recording media URL and set it to the source of the video element
    const recordingUrl = await getRecordingMediaUrl(recordingName);
    const recordingVideo = document.querySelector('#recording-video');
    recordingVideo.src = recordingUrl;
}

async function getRecordingMediaUrl(recordingId) {
    try {
        const { recordingMediaUrl } = await httpRequest('GET', `/recordings/${recordingId}/media`);
        return recordingMediaUrl;
    } catch (error) {
        console.error('Error fetching recording media URL:', error);
        return null;
    }
}

function closeRecording() {
    // Stop the video playback
    const recordingVideo = document.querySelector('#recording-video');
    recordingVideo.pause();
    recordingVideo.src = '';

    // Close the recording video dialog
    const recordingVideoDialog = document.querySelector('#recording-video-dialog');
    recordingVideoDialog.close();
}

async function deleteRecording(recordingId) {
    try {
        await httpRequest('DELETE', `/recordings/${recordingId}`);

        // Remove the recording from the list
        recordings.delete(recordingId);
        renderRecordings();
    } catch (error) {
        console.error('Error deleting recording:', error);
    }
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

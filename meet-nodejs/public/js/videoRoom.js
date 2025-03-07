
document.getElementById('end-meeting-btn')?.addEventListener('click', () => {
	const meet = document.querySelector('openvidu-meet');
	meet.endMeeting();
});

document.getElementById('leave-room-btn')?.addEventListener('click', () => {
	const meet = document.querySelector('openvidu-meet');
	meet.leaveRoom();
});

document.getElementById('toggle-chat-btn')?.addEventListener('click', () => {
	const meet = document.querySelector('openvidu-meet');
	meet.toggleChat();
});

document.addEventListener('DOMContentLoaded', () => {
	console.log('DOM loaded');
	const meet = document.querySelector('openvidu-meet');

	// Event listener for when the local participant joined the room
	meet.addEventListener('join', (event) => {
		addEventToLog(event.type, `${JSON.stringify(event.detail)}`);
	});

	// Event listener for when the local participant left the room
	meet.addEventListener('left', (event) => {
		addEventToLog(event.type, `${JSON.stringify(event.detail)}`);
	});
});

function addEventToLog(eventType, eventMessage) {
	const eventsList = document.getElementById('events-list');
	const li = document.createElement('li');
	li.textContent = `[ ${eventType} ] : ${eventMessage}`;
	eventsList.appendChild(li);
}

// Example of adding a webhook to the webhook log
function addWebhookToLog(webhook) {
	const webhookLogList = document.getElementById('webhook-log-list');
	const li = document.createElement('li');
	li.textContent = `[${new Date().toLocaleTimeString()}] ${JSON.stringify(
		webhook
	)}`;
	webhookLogList.appendChild(li);
}



import { expect, test } from '../../../.tests/harness/fixtures.js';
import { joinMeeting } from '../../../.tests/harness/meet-ui.js';
import { MEET_WEBHOOK_PORT, ROOM_STATUSES, uniqueName } from '../../../.tests/harness/meet.js';
import { describeBootsAndServes, describeRoomLifecycle } from '../../../.tests/harness/suites.js';
import { tutorialById } from '../../../.tests/harness/tutorials.js';

/**
 * Tests for the Webhooks tutorial, against a real OpenVidu Meet server.
 *
 * This tutorial is the one exception to "every test gets its own free port": webhooks are pushed *to* the
 * application, so it has to listen exactly where the deployment posts them. That port cannot be
 * discovered through the API, so it is given explicitly:
 *
 *   MEET_WEBHOOK_PORT=6080 npm test advanced-features/meet-webhooks
 *
 * (`6080` is what OpenVidu Local Deployment uses out of the box —
 * `MEET_INITIAL_WEBHOOK_URL=http://host.docker.internal:6080/webhook`. When Meet itself runs from source
 * on 6080, configure the deployment to post somewhere else and set this variable to match.)
 *
 * Without it, only the tests that need inbound events are skipped; everything else still runs.
 */
const tutorial = tutorialById('webhooks');
const INBOUND_EVENTS_CONFIGURED = Number.isInteger(MEET_WEBHOOK_PORT);
const INBOUND_SKIP_REASON =
	'Receiving real webhooks needs the tutorial to listen on the port the deployment posts to. ' +
	'Set MEET_WEBHOOK_PORT to that port (6080 in a default OpenVidu Local Deployment).';

test.use({
	tutorialId: tutorial.id,
	// Only pinned when configured; otherwise a free port is used and the inbound tests skip.
	fixedPort: INBOUND_EVENTS_CONFIGURED ? MEET_WEBHOOK_PORT : undefined
});

// Every test in this file boots its own copy of the tutorial, but all of them share the one fixed port
// above — two of them alive at once would race to bind it. `fullyParallel` runs tests from the same file
// across different workers, so this file must opt back out of that and run its tests one at a time.
test.describe.configure({ mode: 'serial' });

// The tutorial logs SSE reconnect attempts through console.error; that is normal operation.
describeBootsAndServes(tutorial, { allowConsoleErrors: [/SSE connection error/i] });
describeRoomLifecycle(tutorial);

test.describe('Webhooks: live updates', () => {
	/** Reloads and resolves once the browser is subscribed, so no event can be missed. */
	const connectSse = async (ui) => {
		const connected = ui.page.waitForResponse(
			(response) => response.url().endsWith('/events') && response.status() === 200,
			{ timeout: 30_000 }
		);
		await ui.reload();
		await connected;
	};

	test('renders a status badge for every documented room status', async ({ ui, meet, cleanup }) => {
		const room = await meet.createRoom(uniqueName('e2e-hooks'));
		cleanup.room(room.roomId);
		await ui.reload();

		// A fresh room is open; the other two states are reached through real meetings below.
		await expect(ui.roomStatus(room.roomName)).toContainText('OPEN');
		expect(ROOM_STATUSES, 'a new status in the API would need a new badge in the tutorial').toEqual([
			'open',
			'active_meeting',
			'closed'
		]);
	});

	test('serves the SSE stream the browser subscribes to', async ({ app, ui }) => {
		const controller = new AbortController();

		try {
			const response = await fetch(`${app.baseURL}/events`, { signal: controller.signal });

			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toContain('text/event-stream');
		} finally {
			controller.abort();
		}

		// And the browser really connects to it on load.
		await connectSse(ui);
	});

	test('refuses an unsigned webhook', async ({ app }) => {
		const response = await fetch(`${app.baseURL}/webhook`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ event: 'meetingStarted', data: {} })
		});

		// The endpoint must exist — a 404 here would mean the deployment could never deliver anything —
		// and it must reject whatever is not signed by the Meet server.
		expect(response.status, 'POST /webhook must exist and verify the signature').toBe(401);
	});

	test('a real meetingStarted event updates the room status live', async ({ ui, page, meet, cleanup }) => {
		test.skip(!INBOUND_EVENTS_CONFIGURED, INBOUND_SKIP_REASON);

		const room = await meet.createRoom(uniqueName('e2e-hooks'));
		cleanup.room(room.roomId);
		await connectSse(ui);
		await expect(ui.roomStatus(room.roomName)).toContainText('OPEN');

		// Join from a second context so the rooms list stays on screen while the meeting starts.
		const participant = await page.context().browser().newContext({ permissions: ['camera', 'microphone'] });
		const participantPage = await participant.newPage();

		try {
			await participantPage.goto(room.access.anonymous.moderator.url);
			await joinMeeting(participantPage, 'E2E Participant');

			// The tutorial never polls, so the badge can only change because a webhook arrived.
			await expect(
				ui.roomStatus(room.roomName),
				'a real meetingStarted webhook must reach the application and refresh the list'
			).toContainText('ACTIVE MEETING', { timeout: 90_000 });
		} finally {
			await participant.close();
		}
	});

	test('a real meetingEnded event updates the room status again', async ({ ui, page, meet, cleanup }) => {
		test.skip(!INBOUND_EVENTS_CONFIGURED, INBOUND_SKIP_REASON);

		const room = await meet.createRoom(uniqueName('e2e-hooks'));
		cleanup.room(room.roomId);
		await connectSse(ui);

		const participant = await page.context().browser().newContext({ permissions: ['camera', 'microphone'] });
		const participantPage = await participant.newPage();

		try {
			await participantPage.goto(room.access.anonymous.moderator.url);
			await joinMeeting(participantPage, 'E2E Participant');
			await expect(ui.roomStatus(room.roomName)).toContainText('ACTIVE MEETING', { timeout: 90_000 });

			// Closing the last participant's page ends the meeting.
			await participantPage.close();

			await expect(ui.roomStatus(room.roomName), 'meetingEnded must arrive too').not.toContainText(
				'ACTIVE MEETING',
				{ timeout: 120_000 }
			);
		} finally {
			await participant.close();
		}
	});

	test('the application stays usable while listening for events', async ({ ui, meet, cleanup }) => {
		const roomName = uniqueName('e2e-hooks');
		await connectSse(ui);

		await ui.createRoom(roomName);

		await expect(ui.room(roomName)).toBeVisible();
		const { rooms } = await meet.listRooms();
		const created = rooms.find((room) => room.roomName === roomName);

		expect(created).toBeDefined();
		cleanup.room(created.roomId);

		await ui.openRecordings(roomName);
		await expect(ui.recordingsMessage).toHaveText('No recordings found for the filters applied.');
	});
});

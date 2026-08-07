import { expect, test } from '../../../.tests/harness/fixtures.js';
import { MEET_UI, joinMeeting, waitForLobby } from '../../../.tests/harness/meet-ui.js';
import { uniqueName } from '../../../.tests/harness/meet.js';
import { describeBootsAndServes, describeRoomLifecycle } from '../../../.tests/harness/suites.js';
import { tutorialById } from '../../../.tests/harness/tutorials.js';

/**
 * Tests for the WebComponent tutorial, against a real OpenVidu Meet server.
 *
 * This is the first tutorial that embeds the meeting, so it is where the real `<openvidu-meet>` bundle
 * gets exercised: it must load from the Meet server, upgrade the element, render Meet's own UI inside the
 * host page, and let a participant into a real meeting.
 */
const tutorial = tutorialById('webcomponent-basic');

test.use({ tutorialId: tutorial.id });

describeBootsAndServes(tutorial);
describeRoomLifecycle(tutorial);

test.describe('WebComponent: embedding a real meeting', () => {
	test('the real bundle loads and upgrades the element', async ({ ui, meet, cleanup }) => {
		const room = await meet.createRoom(uniqueName('e2e-wc'));
		cleanup.room(room.roomId);
		await ui.reload();

		await ui.moderatorAccess(room.roomName).click();

		await expect(ui.home).toBeHidden();
		await expect(ui.roomView).toBeVisible();
		await expect(ui.meetElement).toHaveCount(1);

		// A real custom element has a shadow root and the event API the next tutorial relies on.
		const upgraded = await ui.meetElement.evaluate((element) => ({
			hasShadowRoot: Boolean(element.shadowRoot),
			hasOnce: typeof element.once === 'function',
			hasOn: typeof element.on === 'function'
		}));

		expect(upgraded.hasShadowRoot, 'the component must have rendered its shadow DOM').toBe(true);
		expect(upgraded.hasOnce, 'the tutorials subscribe with once()').toBe(true);
		expect(upgraded.hasOn).toBe(true);
	});

	test('the component is given the room URL and the redirect back to the application', async ({
		ui,
		meet,
		cleanup
	}) => {
		const room = await meet.createRoom(uniqueName('e2e-wc'));
		cleanup.room(room.roomId);
		await ui.reload();

		await ui.moderatorAccess(room.roomName).click();

		await expect(ui.meetElement).toHaveAttribute('room-url', room.access.anonymous.moderator.url);
		// This tutorial delegates leaving to the component instead of handling events itself; reacting to
		// events is what the next tutorial adds.
		await expect(ui.meetElement).toHaveAttribute('leave-redirect-url', '/');
	});

	test('a moderator joins a real meeting inside the host application', async ({ ui, page, meet, cleanup }) => {
		const room = await meet.createRoom(uniqueName('e2e-wc'));
		cleanup.room(room.roomId);
		await ui.reload();

		await ui.moderatorAccess(room.roomName).click();
		await joinMeeting(page, 'E2E Moderator');

		// The meeting runs inside the embedded component, not in a separate tab.
		await expect(ui.roomView).toBeVisible();
		await expect(ui.meetElement).toHaveCount(1);

		// And the server agrees there is a meeting going on.
		await expect
			.poll(async () => (await meet.getRoom(room.roomId)).status, { timeout: 45_000 })
			.toBe('active_meeting');
	});

	test('a speaker joins the same room through the speaker link', async ({ ui, page, meet, cleanup }) => {
		const room = await meet.createRoom(uniqueName('e2e-wc'));
		cleanup.room(room.roomId);
		await ui.reload();

		await ui.speakerAccess(room.roomName).click();
		await expect(ui.meetElement).toHaveAttribute('room-url', room.access.anonymous.speaker.url);

		await joinMeeting(page, 'E2E Speaker');

		await expect(ui.meetElement).toHaveCount(1);
	});

	test('anonymous access asks for a participant name', async ({ ui, page, meet, cleanup }) => {
		const room = await meet.createRoom(uniqueName('e2e-wc'));
		cleanup.room(room.roomId);
		await ui.reload();

		await ui.moderatorAccess(room.roomName).click();

		// An anonymous link carries no identity, so Meet asks who is joining.
		await waitForLobby(page);
		await expect(page.locator(MEET_UI.nameInput)).toBeEditable();
	});
});

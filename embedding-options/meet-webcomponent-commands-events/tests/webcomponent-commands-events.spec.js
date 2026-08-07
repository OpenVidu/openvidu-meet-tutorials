import { expect, test } from '../../../.tests/harness/fixtures.js';
import { MEET_UI, dismissMeetingEndedPanel, joinMeeting } from '../../../.tests/harness/meet-ui.js';
import { uniqueName } from '../../../.tests/harness/meet.js';
import { describeBootsAndServes, describeRoomLifecycle } from '../../../.tests/harness/suites.js';
import { tutorialById } from '../../../.tests/harness/tutorials.js';

/**
 * Tests for the Commands & Events tutorial, against a real OpenVidu Meet server.
 *
 * This tutorial builds its own room header out of the component's events and sends it commands, so the
 * tests watch that contract from both directions through the tutorial's visible reaction:
 *
 *   joined  → the custom room header appears
 *   left    → the header disappears
 *   closed  → the application returns to its rooms list
 *   endMeeting command → the meeting really ends, for everyone
 */
const tutorial = tutorialById('webcomponent-commands-events');

test.use({ tutorialId: tutorial.id });

describeBootsAndServes(tutorial);
describeRoomLifecycle(tutorial);

test.describe('WebComponent Commands & Events: reacting to the real component', () => {
	test("'joined' shows the room header, and a moderator gets the End meeting button", async ({
		ui,
		page,
		meet,
		cleanup
	}) => {
		const room = await meet.createRoom(uniqueName('e2e-events'));
		cleanup.room(room.roomId);
		await ui.reload();

		await ui.moderatorAccess(room.roomName).click();
		// The header is driven entirely by the component's 'joined' event.
		await expect(ui.roomHeader).toBeHidden();
		// Unlike the previous tutorial, leaving is handled through events, not through an attribute.
		await expect(ui.meetElement).not.toHaveAttribute('leave-redirect-url', /.*/);

		await joinMeeting(page, 'E2E Moderator');

		await expect(ui.roomHeader, "the component must still emit 'joined'").toBeVisible();
		await expect(ui.roomHeaderName).toHaveText(room.roomName);
		await expect(ui.roomRoleBadge).toContainText('moderator');
		await expect(ui.endMeetingButton).toBeVisible();
	});

	test('a speaker gets the header but no End meeting button', async ({ ui, page, meet, cleanup }) => {
		const room = await meet.createRoom(uniqueName('e2e-events'));
		cleanup.room(room.roomId);
		await ui.reload();

		await ui.speakerAccess(room.roomName).click();
		await joinMeeting(page, 'E2E Speaker');

		await expect(ui.roomHeader).toBeVisible();
		await expect(ui.roomRoleBadge).toContainText('speaker');
		await expect(ui.endMeetingButton, 'ending the meeting is a moderator-only command').toBeHidden();
		// Hidden is not enough on its own: the handler must be unwired too.
		expect(await ui.endMeetingButton.evaluate((button) => button.onclick)).toBeNull();
	});

	test('the endMeeting command ends the meeting and closes the component', async ({
		ui,
		page,
		meet,
		cleanup
	}) => {
		const room = await meet.createRoom(uniqueName('e2e-events'));
		cleanup.room(room.roomId);
		await ui.reload();
		await ui.moderatorAccess(room.roomName).click();
		await joinMeeting(page, 'E2E Moderator');
		await expect(ui.endMeetingButton).toBeVisible();

		await ui.endMeetingButton.click();

		// 'left' fires as soon as the meeting is over, and the tutorial hides its header.
		await expect(ui.roomHeader, "the component must still emit 'left'").toBeHidden({ timeout: 45_000 });
		// Meet then shows its own "Meeting Ended" panel and waits to be acknowledged: leaving a meeting is
		// not the same as closing the component, so the application is still showing the room view here.
		await expect(ui.roomView).toBeVisible();
		const reason = await dismissMeetingEndedPanel(page);

		expect(reason).toContain('Meeting Ended');

		// Only now does 'closed' arrive and the application take its view back.
		await expect(ui.home, "the component must still emit 'closed' once the end is acknowledged").toBeVisible({
			timeout: 45_000
		});
		await expect(ui.meetElement, 'the component must be removed so it releases its resources').toHaveCount(0);
		await expect(ui.room(room.roomName)).toBeVisible();

		// And the server saw the meeting end, not just this browser leave.
		await expect
			.poll(async () => (await meet.getRoom(room.roomId)).status, { timeout: 45_000 })
			.not.toBe('active_meeting');
	});

	test('ending the meeting ejects the other participants too', async ({ ui, page, browser, meet, cleanup }) => {
		const room = await meet.createRoom(uniqueName('e2e-events'));
		cleanup.room(room.roomId);
		await ui.reload();

		// A speaker joins Meet directly, in a separate browser context.
		const speakerContext = await browser.newContext({ permissions: ['camera', 'microphone'] });
		const speakerPage = await speakerContext.newPage();

		try {
			await speakerPage.goto(room.access.anonymous.speaker.url);
			await joinMeeting(speakerPage, 'E2E Speaker');

			await ui.moderatorAccess(room.roomName).click();
			await joinMeeting(page, 'E2E Moderator');
			await ui.endMeetingButton.click();

			// endMeeting is room-wide: the speaker's meeting layout goes away as well.
			await expect(speakerPage.locator(MEET_UI.layout)).toBeHidden({ timeout: 60_000 });
		} finally {
			await speakerContext.close();
		}
	});

	test('the header always reflects the current access, not the previous one', async ({
		ui,
		page,
		meet,
		cleanup
	}) => {
		const room = await meet.createRoom(uniqueName('e2e-events'));
		cleanup.room(room.roomId);
		await ui.reload();

		await ui.moderatorAccess(room.roomName).click();
		await joinMeeting(page, 'E2E Moderator');
		await expect(ui.roomRoleBadge).toContainText('moderator');

		await ui.endMeetingButton.click();
		await dismissMeetingEndedPanel(page);
		await expect(ui.home).toBeVisible({ timeout: 45_000 });

		await ui.speakerAccess(room.roomName).click();
		await joinMeeting(page, 'E2E Speaker');

		await expect(ui.roomRoleBadge).toContainText('speaker');
		await expect(ui.endMeetingButton).toBeHidden();
	});
});

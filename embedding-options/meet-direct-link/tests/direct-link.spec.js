import { expect, test } from '../../../.tests/harness/fixtures.js';
import { MEET_UI, waitForLobby } from '../../../.tests/harness/meet-ui.js';
import { uniqueName } from '../../../.tests/harness/meet.js';
import { describeBootsAndServes, describeRoomLifecycle } from '../../../.tests/harness/suites.js';
import { tutorialById } from '../../../.tests/harness/tutorials.js';

/**
 * Tests for the Direct Link tutorial, against a real OpenVidu Meet server.
 * See ../../../.tests/harness/README.md.
 */
const tutorial = tutorialById('direct-link');

test.use({ tutorialId: tutorial.id });

describeBootsAndServes(tutorial);
describeRoomLifecycle(tutorial);

test.describe('Direct Link: accessing through a plain link', () => {
	test('the access URLs are ordinary links, with no WebComponent involved', async ({
		ui,
		app,
		page,
		meet,
		cleanup
	}) => {
		const room = await meet.createRoom(uniqueName('e2e-direct'));
		cleanup.room(room.roomId);
		await ui.reload();

		const moderator = ui.moderatorAccess(room.roomName);

		// The whole point of this tutorial: a link straight to the Meet interface.
		expect(await moderator.evaluate((element) => element.tagName)).toBe('A');
		await expect(moderator).toHaveAttribute('href', room.access.anonymous.moderator.url);

		// Nothing is embedded, and the page never loads the WebComponent bundle.
		await expect(page.locator('openvidu-meet')).toHaveCount(0);
		expect(await (await fetch(`${app.baseURL}/`)).text()).not.toContain('openvidu-meet.js');
		await expect(ui.roomView).toHaveCount(0);
	});

	test('the moderator link opens the real OpenVidu Meet interface', async ({ ui, page, meet, cleanup }) => {
		const room = await meet.createRoom(uniqueName('e2e-direct'));
		cleanup.room(room.roomId);
		await ui.reload();

		await ui.moderatorAccess(room.roomName).click();

		// The browser leaves the tutorial and lands on Meet's own lobby.
		await waitForLobby(page);
		expect(page.url()).toContain(room.roomId);
	});

	test('the speaker link opens the real OpenVidu Meet interface', async ({ ui, page, meet, cleanup }) => {
		const room = await meet.createRoom(uniqueName('e2e-direct'));
		cleanup.room(room.roomId);
		await ui.reload();

		await ui.speakerAccess(room.roomName).click();

		await waitForLobby(page);
		expect(page.url()).toContain(room.roomId);
	});

	test('a deleted room no longer grants access', async ({ page, meet }) => {
		const room = await meet.createRoom(uniqueName('e2e-direct'));
		const accessUrl = room.access.anonymous.moderator.url;
		await meet.deleteRoom(room.roomId);

		await page.goto(accessUrl);

		// Whatever Meet shows, it must not be a usable lobby for a room that no longer exists.
		await expect(page.locator(MEET_UI.nameInput)).toHaveCount(0, { timeout: 45_000 });
	});
});

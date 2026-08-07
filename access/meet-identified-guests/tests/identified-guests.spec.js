import { expect, test } from '../../../.tests/harness/fixtures.js';
import { MEET_UI, dismissMeetingEndedPanel, joinMeeting, waitForLobby } from '../../../.tests/harness/meet-ui.js';
import { uniqueName } from '../../../.tests/harness/meet.js';
import { describeBootsAndServes, describeRoomLifecycle } from '../../../.tests/harness/suites.js';
import { tutorialById } from '../../../.tests/harness/tutorials.js';

/**
 * Tests for the Identified Guests tutorial, against a real OpenVidu Meet server.
 *
 * The documentation makes two promises about an identified guest, and neither can be verified without a
 * real server: the guest joins under their assigned name with no login and nothing to type, and removing
 * the member revokes that link immediately.
 */
const tutorial = tutorialById('identified-guests');

test.use({ tutorialId: tutorial.id });

describeBootsAndServes(tutorial);
describeRoomLifecycle(tutorial);

test.describe('Identified Guests: managing guests', () => {
	/** Creates a room and opens its members view. */
	const openMembersOf = async ({ ui, meet, cleanup }) => {
		const room = await meet.createRoom(uniqueName('e2e-guests'));
		cleanup.room(room.roomId);
		await ui.reload();
		await ui.openMembers(room.roomName);

		return room;
	};

	test('adding a guest creates a real member with its own access link', async ({ ui, meet, cleanup }) => {
		const room = await openMembersOf({ ui, meet, cleanup });
		await expect(ui.membersMessage).toContainText('No members yet');

		await ui.addGuest('Charlie', 'moderator');

		await expect(ui.member('Charlie')).toBeVisible();
		await expect(ui.member('Charlie')).toContainText('moderator');
		await expect(ui.guestNameInput, 'the form is reset for the next guest').toHaveValue('');

		const { members } = await meet.listMembers(room.roomId, { type: 'identified_guest' });
		const charlie = members.find((member) => member.name === 'Charlie');

		expect(charlie, 'the guest added through the tutorial must exist in OpenVidu Meet').toBeDefined();
		expect(charlie.type, 'adding a member by name must create an identified guest').toBe('identified_guest');
		expect(charlie.baseRole).toBe('moderator');
		expect(String(charlie.accessUrl)).toMatch(/^https?:\/\//);
		// The link shown is the one the API generated.
		await expect(ui.memberSubtitle('Charlie')).toHaveText(charlie.accessUrl);
	});

	test('every guest of the same room gets a different link', async ({ ui, meet, cleanup }) => {
		const room = await openMembersOf({ ui, meet, cleanup });

		await ui.addGuest('Charlie');
		await ui.addGuest('Dana');

		await expect(ui.memberItems).toHaveCount(2);
		const { members } = await meet.listMembers(room.roomId, { type: 'identified_guest' });
		const urls = members.map((member) => member.accessUrl);

		expect(members).toHaveLength(2);
		expect(new Set(urls).size, 'each link must be individually revocable, so it must be unique').toBe(2);
		// And it is not the shared anonymous link either.
		expect(urls).not.toContain(room.access.anonymous.speaker.url);
	});

	test('the guest link joins the meeting under the assigned name, with no login', async ({
		ui,
		page,
		meet,
		cleanup
	}) => {
		await openMembersOf({ ui, meet, cleanup });
		await ui.addGuest('Charlie', 'speaker');

		await ui.accessAsMember('Charlie');

		await expect(ui.membersView).toBeHidden();
		await expect(ui.roomView).toBeVisible();
		await waitForLobby(page);

		// The link carries the identity: no credentials, and the name is fixed rather than chosen.
		await expect(page.locator(MEET_UI.loginButton)).toHaveCount(0);
		await expect(page.locator(MEET_UI.nameInput)).toHaveValue('Charlie');

		await joinMeeting(page, 'Charlie');
		await expect(ui.roomView).toBeVisible();
	});

	test('closing after guest access returns to the members view, not to the rooms list', async ({
		ui,
		page,
		meet,
		cleanup
	}) => {
		await openMembersOf({ ui, meet, cleanup });
		await ui.addGuest('Charlie');
		await ui.accessAsMember('Charlie');
		await joinMeeting(page, 'Charlie');

		// Leave the meeting from Meet's own toolbar, then acknowledge the end.
		await page.locator('#leave-btn').click();
		await dismissMeetingEndedPanel(page);

		// Back to where the guest was accessed from: this tutorial tracks which view it came from.
		await expect(ui.membersView).toBeVisible({ timeout: 45_000 });
		await expect(ui.home).toBeHidden();
		await expect(ui.member('Charlie')).toBeVisible();
	});

	test('copying a guest link puts it on the clipboard', async ({ ui, page, meet, cleanup, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await openMembersOf({ ui, meet, cleanup });
		await ui.addGuest('Charlie');
		const accessUrl = await ui.memberSubtitle('Charlie').textContent();

		await ui.copyMemberLink('Charlie');

		await expect(ui.member('Charlie').locator('[title="Copy access link"] span')).toHaveText('check');
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(accessUrl);
	});

	test('removing the member revokes that guest link immediately', async ({ ui, page, meet, cleanup }) => {
		const room = await openMembersOf({ ui, meet, cleanup });
		await ui.addGuest('Charlie');
		const { members } = await meet.listMembers(room.roomId, { type: 'identified_guest' });
		const accessUrl = members[0].accessUrl;

		await ui.removeMember('Charlie');

		await expect(ui.memberItems).toHaveCount(0);
		await expect(ui.membersMessage).toContainText('No members yet');

		const after = await meet.listMembers(room.roomId, { type: 'identified_guest' });

		expect(after.members).toHaveLength(0);

		// The link is dead for anyone who still has it.
		await page.goto(accessUrl);
		await expect(page.locator(MEET_UI.nameInput)).toHaveCount(0, { timeout: 45_000 });
	});

	test('anonymous access still works alongside identified guests', async ({ ui, page, meet, cleanup }) => {
		const room = await meet.createRoom(uniqueName('e2e-guests'));
		cleanup.room(room.roomId);
		await meet.addGuestMember(room.roomId, 'Charlie');
		await ui.reload();

		await ui.moderatorAccess(room.roomName).click();
		await waitForLobby(page);

		// An anonymous link carries no identity, so the name is empty and editable.
		await expect(page.locator(MEET_UI.nameInput)).toBeEditable();
		await expect(page.locator(MEET_UI.nameInput)).toHaveValue('');
	});

	test('going back from the members view returns to the rooms list', async ({ ui, meet, cleanup }) => {
		const room = await openMembersOf({ ui, meet, cleanup });

		await ui.backFromSubscreen();

		await expect(ui.membersView).toBeHidden();
		await expect(ui.home).toBeVisible();
		await expect(ui.room(room.roomName)).toBeVisible();
	});
});

import { expect, test } from '../../../.tests/harness/fixtures.js';
import { MEET_UI, joinMeeting, loginToMeet, waitForLobby } from '../../../.tests/harness/meet-ui.js';
import { uniqueName, uniqueUserId } from '../../../.tests/harness/meet.js';
import { describeBootsAndServes, describeRoomLifecycle } from '../../../.tests/harness/suites.js';
import { tutorialById } from '../../../.tests/harness/tutorials.js';

/**
 * Tests for the Users tutorial, against a real OpenVidu Meet server.
 *
 * What only a real server can show: a user created through the tutorial is a genuine Meet account that
 * can log in, logging in through the room's shared URL is what identifies them, and a `room_member`
 * really cannot reach rooms they are not a member of.
 */
const tutorial = tutorialById('users');
const PASSWORD = 'e2e-password';

test.use({ tutorialId: tutorial.id });

describeBootsAndServes(tutorial);
describeRoomLifecycle(tutorial);

test.describe('Users: Meet accounts as room members', () => {
	test('a user created through the tutorial is a real room_member account', async ({ ui, meet, cleanup }) => {
		const userId = uniqueUserId();
		cleanup.user(userId);

		await ui.createUser({ userId, name: 'E2E User', password: PASSWORD });

		const row = ui.user(userId);
		await expect(row).toBeVisible();
		await expect(row.locator('.ov-user__name')).toHaveText('E2E User');
		// Two uppercase initials built from the name.
		await expect(row.locator('.ov-user__avatar')).toHaveText('EU');

		const { users } = await meet.listUsers('room_member');
		const created = users.find((user) => user.userId === userId);

		expect(created, 'the user created through the tutorial must exist in OpenVidu Meet').toBeDefined();
		expect(created.role, 'the tutorial must not create users able to manage rooms').toBe('room_member');
	});

	test('deleting a user through the tutorial deletes the account', async ({ ui, meet }) => {
		const userId = uniqueUserId();
		await meet.createUser({ userId, name: 'E2E User', password: PASSWORD });
		await ui.reload();
		await expect(ui.user(userId)).toBeVisible();

		await ui.deleteUser(userId);

		await expect(ui.user(userId)).toHaveCount(0);
		const { users } = await meet.listUsers('room_member');

		expect(users.some((user) => user.userId === userId)).toBe(false);
	});

	test('a user added to a room becomes a member of type user', async ({ ui, meet, cleanup }) => {
		const userId = uniqueUserId();
		const room = await meet.createRoom(uniqueName('e2e-users'));
		cleanup.room(room.roomId);
		cleanup.user(userId);
		await meet.createUser({ userId, name: 'E2E User', password: PASSWORD });
		await ui.reload();
		await ui.openMembers(room.roomName);

		await ui.addUserMember(userId, 'moderator');

		const member = ui.member('E2E User');
		await expect(member).toBeVisible();
		await expect(member.locator('.ov-badge').first()).toContainText('User');
		await expect(member.locator('.ov-badge').nth(1)).toContainText('moderator');
		// A user member is identified by its user id, not by a personal link.
		await expect(ui.memberSubtitle('E2E User')).toHaveText(userId);

		const { members } = await meet.listMembers(room.roomId);
		const created = members.find((candidate) => candidate.memberId === userId);

		expect(created, 'the member created through the tutorial must exist in OpenVidu Meet').toBeDefined();
		expect(created.type, 'adding a member by userId must create a member of type user').toBe('user');
		expect(created.baseRole).toBe('moderator');
	});

	test('every user member shares the room authenticated URL', async ({ ui, meet, cleanup }) => {
		const alice = uniqueUserId('alice');
		const bob = uniqueUserId('bob');
		const room = await meet.createRoom(uniqueName('e2e-users'));
		cleanup.room(room.roomId);
		cleanup.user(alice);
		cleanup.user(bob);
		await meet.createUser({ userId: alice, name: 'Alice Smith', password: PASSWORD });
		await meet.createUser({ userId: bob, name: 'Bob Stone', password: PASSWORD });
		await ui.reload();
		await ui.openMembers(room.roomName);

		await ui.addUserMember(alice);
		await ui.addUserMember(bob);

		await expect(ui.memberItems).toHaveCount(2);
		const { members } = await meet.listMembers(room.roomId);

		// Users identify themselves by logging in, so they do not need a personal link.
		expect(members[0].accessUrl).toBe(members[1].accessUrl);
		expect(members[0].accessUrl).toBe(room.access.user.url);
	});

	test('only users who are not members yet are offered', async ({ ui, meet, cleanup }) => {
		const userId = uniqueUserId();
		const room = await meet.createRoom(uniqueName('e2e-users'));
		cleanup.room(room.roomId);
		cleanup.user(userId);
		await meet.createUser({ userId, name: 'E2E User', password: PASSWORD });
		await ui.reload();
		await ui.openMembers(room.roomName);

		await expect(ui.memberUserSelect.locator(`option[value="${userId}"]`)).toHaveCount(1);

		await ui.addUserMember(userId);

		await expect(ui.member('E2E User')).toBeVisible();
		await expect(
			ui.memberUserSelect.locator(`option[value="${userId}"]`),
			'a user who is already a member must not be offered again'
		).toHaveCount(0);
	});

	test('a user member logs in through the room URL and joins the meeting', async ({ ui, page, meet, cleanup }) => {
		const userId = uniqueUserId();
		const room = await meet.createRoom(uniqueName('e2e-users'));
		cleanup.room(room.roomId);
		cleanup.user(userId);
		await meet.createUser({ userId, name: 'E2E User', password: PASSWORD });
		await ui.reload();
		await ui.openMembers(room.roomName);
		await ui.addUserMember(userId, 'moderator');

		await ui.accessAsUserButton.click();

		await expect(ui.roomView).toBeVisible();
		await expect(ui.meetElement).toHaveAttribute('room-url', room.access.user.url);
		// All users share that URL, so Meet asks them to identify themselves.
		await expect(page.locator(MEET_UI.loginButton)).toBeVisible({ timeout: 60_000 });

		await loginToMeet(page, { userId, password: PASSWORD });

		await waitForLobby(page);
		await joinMeeting(page, 'E2E User');
		await expect(ui.roomView).toBeVisible();
	});

	test('a user who is not a member cannot access the room', async ({ page, meet, cleanup }) => {
		const userId = uniqueUserId();
		const room = await meet.createRoom(uniqueName('e2e-users'));
		cleanup.room(room.roomId);
		cleanup.user(userId);
		await meet.createUser({ userId, name: 'E2E Outsider', password: PASSWORD });

		// Straight to the room's authenticated URL, without ever being added as a member.
		await page.goto(room.access.user.url);
		await expect(page.locator(MEET_UI.loginButton)).toBeVisible({ timeout: 60_000 });
		await loginToMeet(page, { userId, password: PASSWORD });

		// A room_member only reaches rooms they belong to, so no lobby appears.
		await expect(page.locator(MEET_UI.nameInput)).toHaveCount(0, { timeout: 45_000 });
	});

	test('users and identified guests coexist, with different kinds of access', async ({ ui, meet, cleanup }) => {
		const userId = uniqueUserId();
		const room = await meet.createRoom(uniqueName('e2e-users'));
		cleanup.room(room.roomId);
		cleanup.user(userId);
		await meet.createUser({ userId, name: 'E2E User', password: PASSWORD });
		await ui.reload();
		await ui.openMembers(room.roomName);

		await ui.addUserMember(userId);
		await ui.addGuest('Charlie');

		await expect(ui.memberItems).toHaveCount(2);
		await expect(ui.member('Charlie').locator('.ov-badge').first()).toContainText('Guest');
		await expect(ui.member('E2E User').locator('.ov-badge').first()).toContainText('User');
		// Only the guest has a personal link, so only the guest gets the link actions.
		await expect(ui.member('Charlie').locator('[title="Copy access link"]')).toHaveCount(1);
		await expect(ui.member('E2E User').locator('[title="Copy access link"]')).toHaveCount(0);

		const { members } = await meet.listMembers(room.roomId);
		const byType = Object.fromEntries(members.map((member) => [member.type, member]));

		expect(byType.user.memberId).toBe(userId);
		expect(byType.identified_guest.name).toBe('Charlie');
		expect(byType.identified_guest.accessUrl).not.toBe(byType.user.accessUrl);
	});

	test('removing a user member revokes their membership', async ({ ui, meet, cleanup }) => {
		const userId = uniqueUserId();
		const room = await meet.createRoom(uniqueName('e2e-users'));
		cleanup.room(room.roomId);
		cleanup.user(userId);
		await meet.createUser({ userId, name: 'E2E User', password: PASSWORD });
		await ui.reload();
		await ui.openMembers(room.roomName);
		await ui.addUserMember(userId);

		await ui.removeMember('E2E User');

		await expect(ui.member('E2E User')).toHaveCount(0);
		const { members } = await meet.listMembers(room.roomId);

		expect(members.some((member) => member.memberId === userId)).toBe(false);
	});
});

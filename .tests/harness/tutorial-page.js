import { expect } from '@playwright/test';

/**
 * Locators for the UI every tutorial shares.
 *
 * The tutorials were written independently but converged on the same markup, with two variations this
 * class hides:
 *
 *  - `#rooms-list` is a `<div>` wrapping a `<ul>` in most tutorials but the `<ul>` itself in
 *    access/meet-users. Items are therefore located as `#rooms-list li`, which matches both.
 *  - access/meet-users puts its create forms inside a collapsed `<details>`, so `openCreateForms()`
 *    expands them when needed.
 *
 * Row actions are located by their `title` attribute rather than by tag, because meet-direct-link
 * renders anchors where the others render buttons.
 */
export class TutorialPage {
	constructor(page) {
		this.page = page;

		// Views
		this.home = page.locator('#home');
		this.roomView = page.locator('#room');
		this.membersView = page.locator('#members');
		this.recordingsView = page.locator('#recordings');
		this.recordingPlayerView = page.locator('#display-recording');

		// Rooms
		this.roomItems = page.locator('#rooms-list li');
		this.roomsMessage = page.locator('#no-rooms-or-error');
		this.roomNameInput = page.locator('#room-name');
		this.createRoomError = page.locator('#create-room-error');

		// Embedded component
		this.meetElement = page.locator('openvidu-meet');

		// Room header (tutorials that react to events)
		this.roomHeader = page.locator('#room-header');
		this.roomHeaderName = page.locator('#room-name-header');
		this.roomRoleBadge = page.locator('#room-role-badge');
		this.endMeetingButton = page.locator('#end-meeting-btn');

		// Members
		this.memberItems = page.locator('#members-list li');
		this.membersMessage = page.locator('#no-members-or-error');
		this.guestNameInput = page.locator('#guest-name');
		this.guestRoleSelect = page.locator('#guest-role');
		this.memberUserSelect = page.locator('#member-user');
		this.memberUserRoleSelect = page.locator('#member-user-role');
		this.addMemberError = page.locator('#add-member-error');
		this.accessAsUserButton = page.locator('#access-as-user-btn');

		// Users
		this.userItems = page.locator('#users-list li');
		this.usersMessage = page.locator('#no-users-or-error');
		this.userIdInput = page.locator('#user-id');
		this.userNameInput = page.locator('#user-name');
		this.userPasswordInput = page.locator('#user-password');
		this.createUserError = page.locator('#create-user-error');

		// Recordings
		this.recordingItems = page.locator('#recordings-list li');
		this.recordingsMessage = page.locator('#no-recordings-or-error');
		this.recordingsRoomFilter = page.locator('#recordings-room-search');
	}

	// ─── Loading ─────────────────────────────────────────────────────────────

	/**
	 * Waits until the tutorial has finished loading its data from the Meet API: the rooms list shows
	 * either rows or its empty-state message.
	 *
	 * The tutorials fetch from `DOMContentLoaded` handlers, so a navigation "finishing" does not mean the
	 * data arrived.
	 */
	async settle() {
		await expect
			.poll(async () => (await this.roomItems.count()) > 0 || (await this.roomsMessage.isVisible()), {
				timeout: 30_000
			})
			.toBe(true);
	}

	/** Reloads the page and waits for the data again. Always prefer this over `page.reload()`. */
	async reload() {
		await this.page.reload();
		await this.settle();
	}

	// ─── Rooms ───────────────────────────────────────────────────────────────

	/** Row of the room with the given name. */
	room(roomName) {
		return this.roomItems.filter({ has: this.page.locator('.ov-list-item__name', { hasText: roomName }) });
	}

	roomNames() {
		return this.roomItems.locator('.ov-list-item__name').allTextContents();
	}

	async createRoom(roomName) {
		await this.openCollapsedForm(this.roomNameInput);
		await this.roomNameInput.fill(roomName);
		await this.submitAndWait(this.roomNameInput, this.createRoomError);
	}

	moderatorAccess(roomName) {
		return this.room(roomName).locator('[title="Access as moderator"]');
	}

	speakerAccess(roomName) {
		return this.room(roomName).locator('[title="Access as speaker"]');
	}

	async deleteRoom(roomName) {
		await this.room(roomName).locator('[title="Delete room"]').click();
	}

	async openMembers(roomName) {
		await this.room(roomName).getByRole('button', { name: 'Members' }).click();
		await expect(this.membersView).toBeVisible();
	}

	async openRecordings(roomName) {
		await this.room(roomName).getByRole('button', { name: 'View Recordings' }).click();
		await expect(this.recordingsView).toBeVisible();
	}

	/** Status badge text of a room row (meet-webhooks renders one). */
	roomStatus(roomName) {
		return this.room(roomName).locator('.ov-badge');
	}

	// ─── Members ─────────────────────────────────────────────────────────────

	member(name) {
		return this.memberItems.filter({ has: this.page.locator('.ov-member__name', { hasText: name }) });
	}

	/** The access URL shown under a member's name. */
	memberSubtitle(name) {
		return this.member(name).locator('.ov-member__url');
	}

	async addGuest(name, role = 'speaker') {
		await this.guestNameInput.fill(name);
		await this.guestRoleSelect.selectOption(role);
		await this.submitAndWait(this.guestNameInput, this.addMemberError);
	}

	async addUserMember(userId, role = 'speaker') {
		await this.memberUserSelect.selectOption(userId);
		await this.memberUserRoleSelect.selectOption(role);
		await this.submitAndWait(this.memberUserSelect, this.addMemberError);
	}

	async accessAsMember(name) {
		await this.member(name).locator('[title^="Access as"]').click();
	}

	async copyMemberLink(name) {
		await this.member(name).locator('[title="Copy access link"]').click();
	}

	async removeMember(name) {
		await this.member(name).locator('[title="Remove member"]').click();
	}

	async backFromSubscreen() {
		await this.page.locator('[title="Back"]').click();
	}

	// ─── Users ───────────────────────────────────────────────────────────────

	user(userId) {
		return this.userItems.filter({ has: this.page.locator('.ov-user__id', { hasText: userId }) });
	}

	async createUser({ userId, name, password }) {
		await this.openCollapsedForm(this.userIdInput);
		await this.userIdInput.fill(userId);
		await this.userNameInput.fill(name);
		await this.userPasswordInput.fill(password);
		await this.submitAndWait(this.userIdInput, this.createUserError);
	}

	async deleteUser(userId) {
		await this.user(userId).locator('[title="Delete user"]').click();
	}

	// ─── Recordings ──────────────────────────────────────────────────────────

	recording(roomName) {
		return this.recordingItems.filter({ has: this.page.locator('.ov-recording__name', { hasText: roomName }) });
	}

	/**
	 * Starts playback and waits until the player is really embedded. The tutorials fetch a signed media
	 * URL from the API first, so the component appears one round-trip after the click.
	 */
	async playRecording(roomName, index = 0) {
		await this.recording(roomName).nth(index).locator('[title="Play"]').click();
		await expect(this.recordingPlayerView).toBeVisible();
		await expect(this.recordingPlayerView.locator('openvidu-meet')).toHaveCount(1);
	}

	async deleteRecording(roomName, index = 0) {
		await this.recording(roomName).nth(index).locator('[title="Delete recording"]').click();
	}

	async filterRecordingsByRoom(roomName) {
		await this.recordingsRoomFilter.fill(roomName);
		await this.submitFormOf(this.recordingsRoomFilter);
	}

	// ─── Helpers ─────────────────────────────────────────────────────────────

	/** access/meet-users hides its create forms inside a `<details>`; expand it when collapsed. */
	async openCollapsedForm(input) {
		if (await input.isVisible()) {
			return;
		}

		const summary = input.locator('xpath=ancestor::details[1]/summary');

		if ((await summary.count()) > 0) {
			await summary.click();
		}

		await expect(input).toBeVisible();
	}

	/** Submits the form the given control belongs to, through its own submit button. */
	async submitFormOf(control) {
		await control.locator('xpath=ancestor::form[1]').locator('[type="submit"]').click();
	}

	/**
	 * Submits a form and waits until the tutorial has finished handling it.
	 *
	 * The tutorials reset the form *after* the API call resolves, so a test that submits twice in a row
	 * would have its second input cleared mid-flight and silently blocked by the `required` attribute.
	 * Completion is either "the form was reset" (success) or "an error message appeared" (failure), so
	 * this works for both paths.
	 */
	async submitAndWait(control, errorLocator) {
		await this.submitFormOf(control);

		await expect
			.poll(
				async () => {
					if (errorLocator && (await errorLocator.isVisible())) {
						return 'failed';
					}

					return (await control.inputValue()) === '' ? 'reset' : null;
				},
				{ timeout: 15_000 }
			)
			.not.toBeNull();
	}
}

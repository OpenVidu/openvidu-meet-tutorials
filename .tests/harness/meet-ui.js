import { expect } from '@playwright/test';

/**
 * Driving the real OpenVidu Meet interface.
 *
 * These are the stable element ids Meet's own end-to-end suite uses. They are listed in one place so a
 * change in the Meet UI is a one-line fix here rather than a hunt across seven tutorials.
 *
 * The WebComponent renders inside a shadow root. Playwright's CSS engine pierces shadow DOM, so the same
 * selectors work whether the tutorial embeds the component or links straight to the Meet interface.
 */
export const MEET_UI = {
	nameInput: '#participant-name-input',
	nameSubmit: '#participant-name-submit',
	joinButton: '#join-button',
	layout: '#layout-container',
	mediaButtons: '#media-buttons-container',
	loginButton: '#login-button',
	userIdInput: '#userId-input',
	passwordInput: '#password-input',
	newPasswordInput: 'input[formcontrolname="newPassword"]',
	currentPasswordInput: 'input[formcontrolname="currentPassword"]',
	confirmPasswordInput: 'input[formcontrolname="confirmPassword"]',
	moreOptionsButton: '#more-options-btn',
	recordingButton: '#recording-btn',
	stopRecordingButton: '#stop-recording-btn',
	recordingActivity: '#recording-activity',
	recordingStatus: '#recording-status',
	endedTitle: '#disconnect-title',
	endedAcceptButton: '#back-btn'
};

/**
 * Generous on purpose: this gates on "Meet has booted and shown its lobby", which for the WebComponent
 * means downloading the bundle and bootstrapping Angular inside the host page.
 */
const LOBBY_TIMEOUT = 60_000;

/** Waits for the Meet lobby (the participant name form) to be ready. */
export const waitForLobby = async (page, { timeout = LOBBY_TIMEOUT } = {}) => {
	await expect(page.locator(MEET_UI.nameInput)).toBeVisible({ timeout });
};

/**
 * Logs a Meet user in, completing the forced password change when the server asks for one on a first
 * login. Returns the password in effect afterwards, which is the new one when a change was required.
 *
 * The replacement must actually differ from the current password — Meet keeps the submit button disabled
 * otherwise — so it defaults to a derived value rather than to the same string.
 */
export const loginToMeet = async (page, { userId, password, newPassword = `${password}-changed` }) => {
	await expect(page.locator(MEET_UI.loginButton)).toBeVisible({ timeout: LOBBY_TIMEOUT });
	await page.locator(MEET_UI.userIdInput).fill(userId);
	await page.locator(MEET_UI.passwordInput).fill(password);
	await page.locator(MEET_UI.loginButton).click();

	const changePassword = page.locator(MEET_UI.newPasswordInput);

	// Either the lobby appears, or Meet requires a new password first.
	await Promise.race([
		changePassword.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined),
		page.locator(MEET_UI.nameInput).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined)
	]);

	if (await changePassword.isVisible()) {
		await page.locator(MEET_UI.currentPasswordInput).fill(password);
		await changePassword.fill(newPassword);
		await page.locator(MEET_UI.confirmPasswordInput).fill(newPassword);

		const submit = page.locator('button[type="submit"].primary-button');
		await expect(submit, 'the new password must be accepted by the form').toBeEnabled({ timeout: 15_000 });
		await submit.click();

		return newPassword;
	}

	return password;
};

/** Fills the lobby name form and moves on to the prejoin screen. */
const completeLobby = async (page, name) => {
	const nameInput = page.locator(MEET_UI.nameInput);
	await waitForLobby(page);

	// Identified guests and users arrive with a fixed name, which must not be overwritten.
	if (await nameInput.isEditable()) {
		await nameInput.fill(name);
	}

	await page.locator(MEET_UI.nameSubmit).click();
	await expect(page.locator(MEET_UI.joinButton)).toBeVisible({ timeout: 45_000 });
};

/** Goes all the way into a meeting: lobby, prejoin, join, and waits for the meeting layout. */
export const joinMeeting = async (page, name) => {
	await completeLobby(page, name);
	await page.locator(MEET_UI.joinButton).click();
	await expect(page.locator(MEET_UI.layout)).toBeVisible({ timeout: 60_000 });
	await expect(page.locator(MEET_UI.mediaButtons)).toBeVisible({ timeout: 45_000 });
};

/**
 * Dismisses the panel Meet shows once a meeting is over ("Meeting Ended" / "You left the meeting").
 *
 * This step is what makes the component emit `closed`: leaving a meeting is not the same as closing the
 * component, and Meet waits for the participant to acknowledge the end before handing control back to the
 * host application. Tutorials that react to `closed` therefore only return to their own view after this.
 *
 * @returns The panel title, so a test can assert *why* the meeting ended.
 */
export const dismissMeetingEndedPanel = async (page, { timeout = 45_000 } = {}) => {
	const title = page.locator(MEET_UI.endedTitle);
	await expect(title).toBeVisible({ timeout });

	const reason = (await title.innerText()).trim();
	const accept = page.locator(MEET_UI.endedAcceptButton);

	await expect(accept, 'the embedded component always offers a way back to the host application').toBeVisible({
		timeout: 15_000
	});
	await accept.click();

	return reason;
};

/** Current recording status as Meet displays it, uppercased. */
export const recordingStatus = async (page) =>
	(await page.locator(MEET_UI.recordingStatus).first().innerText()).trim().toUpperCase();

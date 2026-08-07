import { expect, test } from '../../../.tests/harness/fixtures.js';
import {
	MEET_UI,
	dismissMeetingEndedPanel,
	joinMeeting,
	recordingStatus
} from '../../../.tests/harness/meet-ui.js';
import { uniqueName } from '../../../.tests/harness/meet.js';
import { describeBootsAndServes, describeRoomLifecycle } from '../../../.tests/harness/suites.js';
import { tutorialById } from '../../../.tests/harness/tutorials.js';

/**
 * Tests for the Recordings tutorial, against a real OpenVidu Meet server.
 *
 * Capturing a recording needs a working egress and takes a couple of minutes, so the test that does the
 * full circle — record inside the embedded component, then list, play and delete from the host
 * application — is opt-in:
 *
 *   MEET_E2E_RECORDINGS=1 npm test advanced-features/meet-recordings
 *
 * It is the only test that covers the feature end to end, so it is worth running before a release. The
 * rest work with whatever the server already has.
 */
const tutorial = tutorialById('recordings');
const CAPTURE_ENABLED = process.env.MEET_E2E_RECORDINGS === '1';

test.use({ tutorialId: tutorial.id });

describeBootsAndServes(tutorial);
describeRoomLifecycle(tutorial);

test.describe('Recordings: self-managing recordings', () => {
	test('shows an empty state for a room with no recordings', async ({ ui, meet, cleanup }) => {
		const room = await meet.createRoom(uniqueName('e2e-rec'));
		cleanup.room(room.roomId);
		await ui.reload();

		await ui.openRecordings(room.roomName);

		await expect(ui.recordingsRoomFilter, 'the room is prefilled as the filter').toHaveValue(room.roomName);
		await expect(ui.recordingItems).toHaveCount(0);
		await expect(ui.recordingsMessage).toHaveText('No recordings found for the filters applied.');

		const { recordings } = await meet.listRecordings({ status: 'complete', roomName: room.roomName });

		expect(recordings).toHaveLength(0);
	});

	test('the unfiltered list matches what the API returns', async ({ ui, meet, cleanup }) => {
		const room = await meet.createRoom(uniqueName('e2e-rec'));
		cleanup.room(room.roomId);
		await ui.reload();
		await ui.openRecordings(room.roomName);

		await ui.filterRecordingsByRoom('');

		const { recordings } = await meet.listRecordings({ status: 'complete' });

		await expect(ui.recordingItems).toHaveCount(recordings.length);

		// The tutorial only ever lists what can actually be played.
		for (const recording of recordings) {
			expect(recording.status).toBe('complete');
		}
	});

	test('goes back to the rooms list', async ({ ui, meet, cleanup }) => {
		const room = await meet.createRoom(uniqueName('e2e-rec'));
		cleanup.room(room.roomId);
		await ui.reload();
		await ui.openRecordings(room.roomName);

		await ui.backFromSubscreen();

		await expect(ui.recordingsView).toBeHidden();
		await expect(ui.home).toBeVisible();
		await expect(ui.room(room.roomName)).toBeVisible();
	});

	test('plays a recording that already exists on the server', async ({ ui, page, meet }) => {
		// The recordings view is only reachable from a room row, so the recording's room must still exist.
		const [{ rooms }, { recordings }] = await Promise.all([
			meet.listRooms(),
			meet.listRecordings({ status: 'complete' })
		]);
		const recording = recordings.find((candidate) => rooms.some((room) => room.roomName === candidate.roomName));

		test.skip(
			!recording,
			'This server has no completed recording belonging to a room that still exists. ' +
				'Run with MEET_E2E_RECORDINGS=1 to capture one first.'
		);

		await ui.reload();
		await ui.openRecordings(recording.roomName);
		await expect(ui.recordingItems.first()).toBeVisible();

		await ui.playRecording(recording.roomName);

		await expect(ui.recordingsView).toBeHidden();
		await expect(ui.recordingPlayerView).toBeVisible();
		// Playback goes through the same component, driven by a signed media URL from the API.
		const recordingUrl = await ui.meetElement.getAttribute('recording-url');

		expect(recordingUrl).toContain(recording.recordingId);
		await expect(ui.meetElement).not.toHaveAttribute('room-url', /.*/);
		await expect(page.locator('video').first()).toBeVisible({ timeout: 60_000 });
	});

	test.describe('capturing a new recording', () => {
		test.skip(
			!CAPTURE_ENABLED,
			'Needs a working egress and takes a couple of minutes. Enable with MEET_E2E_RECORDINGS=1.'
		);

		test('records inside the component, then lists, plays and deletes it from the application', async ({
			ui,
			page,
			meet,
			cleanup
		}) => {
			test.setTimeout(420_000);

			const room = await meet.createRoom(uniqueName('e2e-rec'));
			cleanup.room(room.roomId);
			await ui.reload();

			// 1. Join as moderator and start recording from Meet's own toolbar.
			await ui.moderatorAccess(room.roomName).click();
			await joinMeeting(page, 'E2E Recorder');
			await page.locator(MEET_UI.moreOptionsButton).click();
			await page.locator(MEET_UI.recordingButton).first().click();
			await expect(page.locator(MEET_UI.recordingActivity)).toBeVisible({ timeout: 45_000 });
			await expect.poll(() => recordingStatus(page), { timeout: 90_000 }).toBe('STARTED');

			// 2. Record for a few seconds, then stop.
			await page.waitForTimeout(5_000);
			await page.locator(MEET_UI.stopRecordingButton).click();
			await expect.poll(() => recordingStatus(page), { timeout: 90_000 }).toBe('STOPPED');

			// 3. The API reports it complete, with the metadata the tutorial renders.
			const completed = () => meet.listRecordings({ status: 'complete', roomName: room.roomName });
			await expect
				.poll(async () => (await completed()).recordings.length, {
					timeout: 180_000,
					intervals: [3_000],
					message: 'waiting for the recording to be finalised'
				})
				.toBe(1);
			const [recording] = (await completed()).recordings;

			expect(recording.duration, 'the tutorial renders the duration in seconds').toBeGreaterThan(0);
			expect(recording.size, 'the tutorial renders the size in bytes').toBeGreaterThan(0);

			// 4. Leave the meeting and manage the recording from the host application.
			await ui.endMeetingButton.click();
			await dismissMeetingEndedPanel(page);
			await expect(ui.home).toBeVisible({ timeout: 60_000 });

			await ui.openRecordings(room.roomName);
			const row = ui.recording(room.roomName);
			await expect(row).toBeVisible({ timeout: 45_000 });
			// Rendered in a readable form, not as raw seconds and bytes.
			await expect(row).toContainText('s');

			// 5. Play it back through the component.
			await ui.playRecording(room.roomName);
			await expect(ui.recordingPlayerView).toBeVisible();
			await expect(page.locator('video').first()).toBeVisible({ timeout: 60_000 });

			// 6. Delete it, in the application and on the server. Reloading is the shortest way back to
			//    the list from the player.
			await ui.reload();
			await ui.openRecordings(room.roomName);
			await ui.deleteRecording(room.roomName);

			await expect(ui.recordingItems).toHaveCount(0);
			const after = await meet.listRecordings({ status: 'complete', roomName: room.roomName });

			expect(after.recordings, 'the recording must be gone from the server too').toHaveLength(0);
		});
	});
});

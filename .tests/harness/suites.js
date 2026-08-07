import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { expect, test } from './fixtures.js';
import { ROOM_STATUSES, WEB_COMPONENT_BUNDLE_PATH, uniqueName } from './meet.js';
import { tutorialPath } from './tutorials.js';

/**
 * Behaviour shared by every tutorial, written once here and composed by each tutorial's spec.
 *
 * The tutorials build on each other, so most of what one does is also true of the next. Each spec then
 * only contains what is specific to that tutorial — which is exactly what you want to read when it
 * fails. Titles are prefixed with the tutorial name so a failure in here still says which one broke.
 */

/**
 * "The tutorial still builds, boots and serves itself."
 *
 * The baseline every tutorial gets: its dependencies resolve, its sources parse, `npm start` brings up a
 * server, the page and its assets are served, and the browser reaches an interactive home view that has
 * successfully talked to the real Meet API.
 *
 * @param options.allowConsoleErrors  Regexes for browser errors that are expected (the webhooks tutorial
 *                                    logs SSE reconnects, for instance).
 */
export const describeBootsAndServes = (tutorial, { allowConsoleErrors = [] } = {}) => {
	test.describe(`${tutorial.name}: builds, boots and serves its pages`, () => {
		test('dependencies are installed in the tutorial itself', async () => {
			const manifest = JSON.parse(fs.readFileSync(tutorialPath(tutorial, 'package.json'), 'utf8'));

			expect(manifest.scripts?.start, 'the README tells readers to run `npm start`').toBeTruthy();
			expect(manifest.type, 'the sources use ESM `import`').toBe('module');

			// Resolved inside the tutorial, never hoisted from the repository root: a reader who copies
			// only this folder must get the same result.
			for (const dependency of Object.keys(manifest.dependencies ?? {})) {
				const installed = tutorialPath(tutorial, 'node_modules', dependency, 'package.json');

				expect(
					fs.existsSync(installed),
					`'${dependency}' is missing from ${tutorial.dir}/node_modules`
				).toBe(true);
			}
		});

		test('sources parse', async () => {
			for (const source of ['src/index.js', 'public/js/app.js']) {
				const file = tutorialPath(tutorial, source);

				expect(fs.existsSync(file), `${tutorial.dir}/${source} is missing`).toBe(true);

				const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });

				expect(result.status, `node --check failed for ${tutorial.dir}/${source}:\n${result.stderr}`).toBe(0);
			}
		});

		test('serves its page and assets', async ({ app }) => {
			const home = await fetch(`${app.baseURL}/`);

			expect(home.status).toBe(200);
			expect(home.headers.get('content-type')).toContain('text/html');
			expect(await home.text()).toContain(`<title>${tutorial.title}</title>`);

			for (const asset of ['css/styles.css', 'js/app.js', 'images/meet_logo.png', 'images/favicon.ico']) {
				const response = await fetch(`${app.baseURL}/${asset}`);

				expect(response.status, `GET /${asset}`).toBe(200);
			}

			expect((await fetch(`${app.baseURL}/definitely-not-a-route`)).status).toBe(404);
		});

		test('reaches the Meet API and renders the home view', async ({ ui, page }) => {
			const consoleErrors = [];
			page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
			page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

			await ui.reload();

			await expect(page).toHaveTitle(tutorial.title);
			await expect(page.locator('.ov-appbar__tag')).toHaveText(tutorial.tag);
			await expect(ui.home).toBeVisible();

			// Views that only appear after an interaction must start hidden.
			for (const hidden of [ui.roomView, ui.membersView, ui.recordingsView, ui.recordingPlayerView]) {
				if ((await hidden.count()) > 0) {
					await expect(hidden).toBeHidden();
				}
			}

			// The rooms list resolved against the real API: "Error loading rooms" would mean it did not.
			await expect(ui.roomsMessage).not.toHaveText('Error loading rooms');

			const unexpected = consoleErrors.filter(
				(error) => !allowConsoleErrors.some((allowed) => allowed.test(error))
			);

			expect(unexpected, 'unexpected browser console errors').toEqual([]);
		});

		if (tutorial.embedsWebComponent) {
			test('loads the WebComponent bundle from the Meet server', async ({ app }) => {
				const html = await (await fetch(`${app.baseURL}/`)).text();
				const bundlePath = WEB_COMPONENT_BUNDLE_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				const match = html.match(new RegExp(`<script src="([^"]*${bundlePath})"`));

				expect(
					match,
					`the page must load the WebComponent bundle from <meet server>${WEB_COMPONENT_BUNDLE_PATH}`
				).not.toBeNull();
			});
		}
	});
};

/**
 * "Room management works against the real API."
 *
 * Every tutorial exposes the same room lifecycle: list on load, create, access, delete. Alongside the
 * visible outcome, this asserts the payload still carries every field the tutorial reads — that is what
 * turns a silent rename in the Meet API into a clear failure.
 */
export const describeRoomLifecycle = (tutorial) => {
	test.describe(`${tutorial.name}: rooms`, () => {
		test('creates a room that really exists, with the fields the tutorial reads', async ({
			ui,
			meet,
			cleanup
		}) => {
			const roomName = uniqueName('e2e-room');

			await ui.createRoom(roomName);

			await expect(ui.room(roomName)).toBeVisible();

			const { rooms } = await meet.listRooms();
			const created = rooms.find((room) => room.roomName === roomName);

			expect(created, 'the room created through the tutorial must exist in OpenVidu Meet').toBeDefined();
			cleanup.room(created.roomId);

			// roomId is what every tutorial uses afterwards for DELETE /rooms/:roomId and member management.
			expect(created.roomId, 'roomId is missing from the room the API returned').toBeTruthy();
			expect(ROOM_STATUSES, `room.status was '${created.status}'`).toContain(created.status);

			// The two links every tutorial renders as its "Moderator"/"Speaker" access buttons.
			expect(
				created.access?.anonymous?.moderator?.url,
				'access.anonymous.moderator.url must be an absolute URL'
			).toMatch(/^https?:\/\//);
			expect(
				created.access?.anonymous?.speaker?.url,
				'access.anonymous.speaker.url must be an absolute URL'
			).toMatch(/^https?:\/\//);

			// The form is reset so the next room can be typed straight away.
			await expect(ui.roomNameInput).toHaveValue('');
		});

		test('lists the rooms the API returns, newest first', async ({ ui, meet, cleanup }) => {
			const older = await meet.createRoom(uniqueName('e2e-older'));
			const newer = await meet.createRoom(uniqueName('e2e-newer'));
			cleanup.room(older.roomId);
			cleanup.room(newer.roomId);

			await ui.reload();

			await expect(ui.room(older.roomName)).toBeVisible();
			await expect(ui.room(newer.roomName)).toBeVisible();

			// The API returns newest first and the tutorials preserve that order.
			const names = await ui.roomNames();

			expect(names.indexOf(newer.roomName)).toBeLessThan(names.indexOf(older.roomName));
		});

		test('offers moderator and speaker access with the URLs the API generated', async ({
			ui,
			meet,
			cleanup
		}) => {
			const room = await meet.createRoom(uniqueName('e2e-access'));
			cleanup.room(room.roomId);
			await ui.reload();

			const moderator = ui.moderatorAccess(room.roomName);
			const speaker = ui.speakerAccess(room.roomName);

			await expect(moderator).toBeVisible();
			await expect(speaker).toBeVisible();

			// The URLs must come from the API, not be built by the tutorial.
			if (!tutorial.embedsWebComponent) {
				await expect(moderator).toHaveAttribute('href', room.access.anonymous.moderator.url);
				await expect(speaker).toHaveAttribute('href', room.access.anonymous.speaker.url);
			} else {
				expect(await moderator.getAttribute('onclick')).toContain(room.access.anonymous.moderator.url);
				expect(await speaker.getAttribute('onclick')).toContain(room.access.anonymous.speaker.url);
			}

			expect(room.access.anonymous.speaker.url, 'the two roles must not share a link').not.toBe(
				room.access.anonymous.moderator.url
			);
		});

		test('deletes a room, forcing meetings and recordings out of the way', async ({ ui, meet }) => {
			const room = await meet.createRoom(uniqueName('e2e-doomed'));
			await ui.reload();
			await expect(ui.room(room.roomName)).toBeVisible();

			await ui.deleteRoom(room.roomName);

			await expect(ui.room(room.roomName)).toHaveCount(0);
			const { rooms } = await meet.listRooms();

			expect(
				rooms.some((candidate) => candidate.roomId === room.roomId),
				'the room must be gone from the server too'
			).toBe(false);
		});
	});
};

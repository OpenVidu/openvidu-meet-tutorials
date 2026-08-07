import { expect, test as base } from '@playwright/test';
import { MEET_API_KEY, MEET_URL, MeetApi, rewriteBundleOrigin } from './meet.js';
import { startTutorial } from './tutorial-server.js';
import { TutorialPage } from './tutorial-page.js';
import { tutorialById } from './tutorials.js';

/**
 * Test object every tutorial's spec builds on.
 *
 * Each test boots its own copy of the tutorial, on its own port, pointed at the real Meet server. That
 * matters: every tutorial hardcodes `SERVER_PORT=6080` in its `.env`, which would collide both with the
 * other tutorials and — when Meet runs from source — with Meet itself.
 *
 * A spec declares which tutorial it covers:
 *
 *   test.use({ tutorialId: 'direct-link' })
 *
 * Fixtures:
 *   tutorial   Entry from the tutorial catalogue.
 *   app        The booted tutorial: `baseURL`, `port`, `output()`.
 *   ui         `TutorialPage` on the tutorial home view, ready to interact with.
 *   meet       Meet API client, for setting things up and asserting the server agrees.
 *   cleanup    Registers rooms and users to remove afterwards, whatever the outcome.
 */
export const test = base.extend({
	tutorialId: ['', { option: true }],
	/**
	 * Forces the tutorial onto a specific port. Only the webhooks tutorial needs it: webhooks are pushed
	 * *to* the tutorial, so it must listen exactly where the deployment posts.
	 */
	fixedPort: [undefined, { option: true }],

	tutorial: async ({ tutorialId }, use) => {
		if (!tutorialId) {
			throw new Error("Add test.use({ tutorialId: '<id>' }) to this spec file.");
		}

		await use(tutorialById(tutorialId));
	},

	meet: async ({}, use) => {
		await use(new MeetApi());
	},

	cleanup: async ({ meet }, use) => {
		const rooms = [];
		const users = [];

		await use({
			room: (roomId) => rooms.push(roomId),
			user: (userId) => users.push(userId)
		});

		// Never leave anything behind on a shared deployment, even when the test failed.
		for (const roomId of rooms) {
			await meet.deleteRoomIfExists(roomId).catch(() => undefined);
		}

		for (const userId of users) {
			await meet.deleteUserIfExists(userId).catch(() => undefined);
		}
	},

	app: async ({ tutorial, fixedPort }, use, testInfo) => {
		const app = await startTutorial(tutorial, {
			env: { OV_MEET_SERVER_URL: MEET_URL, OV_MEET_API_KEY: MEET_API_KEY },
			port: fixedPort
		});

		await use(app);

		// The tutorial's own logs are the fastest way to understand a backend-side failure.
		if (testInfo.status !== testInfo.expectedStatus) {
			await testInfo.attach(`${tutorial.id}-server-output.txt`, {
				body: app.output(),
				contentType: 'text/plain'
			});
		}

		await app.stop();
	},

	ui: async ({ page, app }, use) => {
		await rewriteBundleOrigin(page);

		const ui = new TutorialPage(page);
		await page.goto(`${app.baseURL}/`);
		await ui.settle();
		await use(ui);
	}
});

export { expect };

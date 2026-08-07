import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the OpenVidu Meet tutorials.
 *
 * Every tutorial owns its tests, in its own `tests/` folder next to the code they cover. They are all
 * end-to-end: each one boots the tutorial exactly as its README says (`node src/index.js`), points it at
 * a real OpenVidu Meet server and drives it in a browser, joining real meetings through the real
 * WebComponent.
 *
 * A Meet server is therefore required. Point the suite at whichever one you want, running from the
 * repository root with `--prefix .tests` (or `cd .tests` first):
 *
 *   # OpenVidu Local Deployment (default)
 *   npm --prefix .tests test
 *
 *   # OpenVidu Meet running from source (./meet.sh dev)
 *   MEET_URL=http://localhost:6080/meet npm --prefix .tests test
 *
 * Environment:
 *   MEET_URL              Meet server, base path included. Default: http://localhost:9080/meet
 *   MEET_API_KEY          Sent as X-API-KEY. Default: meet-api-key
 *   MEET_WEBHOOK_PORT     Port the deployment is configured to post webhooks to. The webhooks tutorial
 *                         runs on this port so real events arrive; the tests that need inbound events
 *                         skip themselves (with a reason) when it is unset or already in use.
 *   MEET_E2E_RECORDINGS   Set to 1 to also run the recording-capture test, which needs a working egress.
 */
export default defineConfig({
	// This config lives in .tests/, kept out of the way of the tutorial folders; the specs themselves
	// stay next to the tutorials they cover, one level up.
	testDir: '..',
	testMatch: '**/tests/*.spec.js',
	testIgnore: ['**/node_modules/**'],
	// Each test boots its own tutorial instance on its own port, so order never matters.
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// Real meetings are heavy: a browser, a node server and LiveKit tracks per test.
	workers: process.env.CI ? 2 : 3,
	reporter: process.env.CI
		? [['github'], ['html', { open: 'never' }], ['list']]
		: [['html', { open: 'never' }], ['list']],
	globalSetup: './harness/global-setup.js',
	timeout: 120_000,
	expect: { timeout: 15_000 },
	use: {
		...devices['Desktop Chrome'],
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'off',
		actionTimeout: 20_000,
		navigationTimeout: 45_000,
		// Tutorial servers bind to 127.0.0.1 on a free port, so each test builds its own baseURL.
		permissions: ['camera', 'microphone'],
		launchOptions: {
			args: [
				'--use-fake-ui-for-media-stream',
				'--use-fake-device-for-media-stream',
				'--autoplay-policy=no-user-gesture-required'
			]
		}
	}
});

/**
 * Everything the tests need to talk to a real OpenVidu Meet server: how to reach it, how to call it, and
 * which fields the tutorials read from its responses.
 *
 * The server is chosen entirely through the environment, so the same suite runs against an
 * OpenVidu Local Deployment or against OpenVidu Meet started from source:
 *
 *   npm test                                          # http://localhost:9080/meet (local deployment)
 *   MEET_URL=http://localhost:6080/meet npm test      # ./meet.sh dev
 */

/** Meet server under test, base path included, without a trailing slash. */
export const MEET_URL = (process.env.MEET_URL ?? 'http://localhost:9080/meet').replace(/\/+$/, '');
export const MEET_API_KEY = process.env.MEET_API_KEY ?? 'meet-api-key';
const MEET_API_BASE = `${MEET_URL}/api/v1`;

/**
 * Port the Meet deployment is configured to post webhooks to. Only the webhooks tutorial cares: since
 * events are pushed *to* the tutorial, it has to listen exactly where the deployment sends them.
 */
export const MEET_WEBHOOK_PORT = process.env.MEET_WEBHOOK_PORT
	? Number.parseInt(process.env.MEET_WEBHOOK_PORT, 10)
	: null;

/**
 * The Meet server the tutorials hardcode in their HTML:
 * `<script src="http://localhost:9080/meet/v1/openvidu-meet.js">`.
 *
 * When MEET_URL points somewhere else, those requests are rewritten in the browser instead of editing
 * the tutorials — see `rewriteBundleOrigin`.
 */
const HARDCODED_MEET_URL = 'http://localhost:9080/meet';

/**
 * Redirects the WebComponent bundle requests to the server actually under test.
 *
 * The whole `<meet url>/v1/**` prefix is rewritten, not just the entry file: the bundle is a small
 * loader that dynamically imports a sibling chunk, and that import resolves relative to wherever the
 * browser believes the loader came from. Fulfilling only the entry point would leave the chunk pointing
 * at a server that is not running.
 *
 * Does nothing when MEET_URL already is the hardcoded one.
 */
export const rewriteBundleOrigin = async (page) => {
	if (MEET_URL === HARDCODED_MEET_URL) {
		return;
	}

	await page.route(`${HARDCODED_MEET_URL}/**`, async (route) => {
		const rewritten = route.request().url().replace(HARDCODED_MEET_URL, MEET_URL);

		try {
			await route.fulfill({ response: await route.fetch({ url: rewritten }) });
		} catch {
			// Never throw from a route handler: the component keeps loading chunks while a test is
			// finishing, so a request in flight during teardown would fail the whole worker. Letting the
			// request fail leaves the failure to whichever assertion actually depended on it.
			await route.abort().catch(() => undefined);
		}
	});
};

/**
 * Probes the server the way the tutorials use it: an authenticated API call. Returns a diagnostic
 * instead of throwing, so the global setup can explain what is wrong.
 */
export const probeMeetServer = async () => {
	try {
		const response = await fetch(`${MEET_API_BASE}/rooms?maxItems=1`, {
			headers: { 'X-API-KEY': MEET_API_KEY },
			signal: AbortSignal.timeout(5_000)
		});

		if (response.status === 401 || response.status === 403) {
			return { available: false, reason: `${MEET_URL} rejected MEET_API_KEY (HTTP ${response.status})` };
		}

		if (!response.ok) {
			return { available: false, reason: `${MEET_URL} answered HTTP ${response.status}` };
		}

		return { available: true, reason: `${MEET_URL} is reachable` };
	} catch (error) {
		return { available: false, reason: `${MEET_URL} is unreachable: ${error.message}` };
	}
};

/** Client for the endpoints the tutorials use, for test setup, teardown and assertions. */
export class MeetApi {
	constructor({ baseUrl = MEET_API_BASE, apiKey = MEET_API_KEY } = {}) {
		this.baseUrl = baseUrl;
		this.apiKey = apiKey;
	}

	async request(method, path, body) {
		const response = await fetch(`${this.baseUrl}/${path}`, {
			method,
			headers: { 'Content-Type': 'application/json', 'X-API-KEY': this.apiKey },
			body: body === undefined ? undefined : JSON.stringify(body)
		});

		const text = await response.text();
		let payload;

		try {
			payload = text ? JSON.parse(text) : undefined;
		} catch {
			payload = text;
		}

		if (!response.ok) {
			const error = new Error(
				`${method} ${path} failed with HTTP ${response.status}: ${payload?.message ?? text}`
			);
			error.status = response.status;
			error.payload = payload;
			throw error;
		}

		return payload;
	}

	// ── Rooms ────────────────────────────────────────────────────────────────
	createRoom(roomName) {
		return this.request('POST', 'rooms', { roomName });
	}

	listRooms(maxItems = 100) {
		return this.request('GET', `rooms?maxItems=${maxItems}`);
	}

	getRoom(roomId) {
		return this.request('GET', `rooms/${roomId}`);
	}

	/** The exact deletion the tutorials perform: forcing meetings and recordings out of the way. */
	deleteRoom(roomId) {
		return this.request('DELETE', `rooms/${roomId}?withMeeting=force&withRecordings=force`);
	}

	async deleteRoomIfExists(roomId) {
		try {
			await this.deleteRoom(roomId);
		} catch (error) {
			if (error.status !== 404) {
				throw error;
			}
		}
	}

	// ── Members ──────────────────────────────────────────────────────────────
	addGuestMember(roomId, name, baseRole = 'speaker') {
		return this.request('POST', `rooms/${roomId}/members`, { name, baseRole });
	}

	addUserMember(roomId, userId, baseRole = 'speaker') {
		return this.request('POST', `rooms/${roomId}/members`, { userId, baseRole });
	}

	listMembers(roomId, { type } = {}) {
		const typeQuery = type ? `type=${type}&` : '';

		return this.request('GET', `rooms/${roomId}/members?${typeQuery}maxItems=100`);
	}

	deleteMember(roomId, memberId) {
		return this.request('DELETE', `rooms/${roomId}/members/${memberId}`);
	}

	// ── Users ────────────────────────────────────────────────────────────────
	createUser({ userId, name, password, role = 'room_member' }) {
		return this.request('POST', 'users', { userId, name, password, role });
	}

	listUsers(role = 'room_member') {
		return this.request('GET', `users?role=${role}&maxItems=100`);
	}

	deleteUser(userId) {
		return this.request('DELETE', `users/${userId}`);
	}

	async deleteUserIfExists(userId) {
		try {
			await this.deleteUser(userId);
		} catch (error) {
			if (error.status !== 404) {
				throw error;
			}
		}
	}

	// ── Recordings ───────────────────────────────────────────────────────────
	listRecordings({ status = 'complete', roomName } = {}) {
		const roomQuery = roomName ? `&roomName=${encodeURIComponent(roomName)}` : '';

		return this.request('GET', `recordings?maxItems=100&status=${status}${roomQuery}`);
	}

	getRecordingUrl(recordingId) {
		return this.request('GET', `recordings/${recordingId}/url`);
	}

	deleteRecording(recordingId) {
		return this.request('DELETE', `recordings/${recordingId}`);
	}
}

/** Unique-enough name so parallel workers and repeated runs never collide. */
export const uniqueName = (prefix) =>
	`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Same, restricted to what a Meet userId accepts: lowercase letters, digits and underscores. */
export const uniqueUserId = (prefix = 'e2e') =>
	`${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.slice(0, 20);

/** Values `room.status` may take. The webhooks tutorial maps exactly these to its badges. */
export const ROOM_STATUSES = ['open', 'active_meeting', 'closed'];

/** The `<script>` tag every WebComponent tutorial hardcodes in its HTML. */
export const WEB_COMPONENT_BUNDLE_PATH = '/v1/openvidu-meet.js';

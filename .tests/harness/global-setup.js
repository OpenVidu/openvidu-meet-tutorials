import { MEET_API_KEY, MEET_URL, probeMeetServer } from './meet.js';
import { installMissing } from './install-tutorials.js';
import { TUTORIALS } from './tutorials.js';

/**
 * Runs once before any test.
 *
 *  1. Makes sure every tutorial has its dependencies installed, so a fresh clone can run the suite with
 *     nothing more than `npm install && npm test`. This doubles as the "the tutorial still installs"
 *     check: a lockfile that no longer matches its package.json fails here, loudly.
 *  2. Requires a reachable Meet server. Every test needs one, so this fails fast with an actionable
 *     message rather than letting the run finish as "all skipped", which reads like success.
 */
export default async () => {
	const installed = installMissing();

	if (installed.length > 0) {
		console.log(`[tests] Installed dependencies for: ${installed.join(', ')}`);
	}

	const { available, reason } = await probeMeetServer();

	if (!available) {
		throw new Error(
			[
				'',
				`No OpenVidu Meet server available: ${reason}`,
				'',
				'These tests drive the tutorials against a real Meet server. Start one and point the suite at it:',
				'',
				'  # OpenVidu Local Deployment',
				'  MEET_URL=http://localhost:9080/meet npm test',
				'',
				'  # OpenVidu Meet from source (./meet.sh dev)',
				'  MEET_URL=http://localhost:6080/meet npm test',
				'',
				`Currently MEET_URL=${MEET_URL} and MEET_API_KEY=${MEET_API_KEY ? '<set>' : '<empty>'}.`,
				''
			].join('\n')
		);
	}

	console.log(`[tests] ${TUTORIALS.length} tutorials discovered.`);
	console.log(`[tests] Meet server: ${reason}`);
};

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import { tutorialPath } from './tutorials.js';

const BOOT_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 5_000;

/**
 * Boots a tutorial exactly the way its README tells a reader to (`npm start` runs `node src/index.js`)
 * and waits until it answers HTTP.
 *
 * Every tutorial hardcodes `SERVER_PORT=6080` in its `.env`, so running several of them in parallel
 * would collide. `dotenv` never overrides variables that are already present in the environment,
 * which lets us hand each instance its own free port without touching the tutorial's files.
 *
 * @param tutorial              Entry from the TUTORIALS catalogue.
 * @param options.env           Extra environment for the child. Wins over the tutorial's `.env`.
 * @param options.port          Force a specific port (the webhooks e2e needs the port the Meet
 *                              deployment is configured to post to). A free port is picked otherwise.
 * @returns A handle with `baseURL`, `port`, `output()` and `stop()`.
 */
export const startTutorial = async (tutorial, { env = {}, port: fixedPort } = {}) => {
	const cwd = tutorialPath(tutorial);

	if (!fs.existsSync(cwd)) {
		throw new Error(`Tutorial directory not found: ${cwd}`);
	}

	if (!fs.existsSync(tutorialPath(tutorial, 'node_modules'))) {
		throw new Error(
			`Dependencies are not installed for '${tutorial.id}'. Run 'npm run install:tutorials' from the repository root.`
		);
	}

	// One retry covers the rare race between probing a free port and the child binding it.
	const attempts = fixedPort ? 1 : 2;
	let lastError;

	for (let attempt = 0; attempt < attempts; attempt++) {
		const port = fixedPort ?? (await getFreePort());

		try {
			return await spawnTutorial(tutorial, cwd, port, env);
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError;
};

const spawnTutorial = async (tutorial, cwd, port, env) => {
	const chunks = [];
	const child = spawn(process.execPath, ['src/index.js'], {
		cwd,
		env: { ...process.env, ...env, SERVER_PORT: String(port) },
		stdio: ['ignore', 'pipe', 'pipe']
	});

	const collect = (stream, label) => {
		stream.setEncoding('utf8');
		stream.on('data', (chunk) => chunks.push(`[${label}] ${chunk}`));
	};

	collect(child.stdout, 'out');
	collect(child.stderr, 'err');

	const output = () => chunks.join('');
	let exit = null;
	child.on('exit', (code, signal) => {
		exit = { code, signal };
	});

	const baseURL = `http://127.0.0.1:${port}`;

	try {
		await waitForHttp(`${baseURL}/`, {
			timeoutMs: BOOT_TIMEOUT_MS,
			shouldAbort: () =>
				exit && `'${tutorial.id}' exited before serving (code ${exit.code}, signal ${exit.signal}).\n${output()}`
		});
	} catch (error) {
		await terminate(child);
		throw error;
	}

	return {
		tutorial,
		port,
		baseURL,
		output,
		/** Resolves once the process is gone. Safe to call more than once. */
		stop: () => terminate(child)
	};
};

const terminate = async (child) => {
	if (child.exitCode !== null || child.signalCode !== null) {
		return;
	}

	const exited = new Promise((resolve) => child.once('exit', resolve));
	child.kill('SIGTERM');

	const timer = setTimeout(() => child.kill('SIGKILL'), STOP_TIMEOUT_MS);

	try {
		await exited;
	} finally {
		clearTimeout(timer);
	}
};

// ─── Plumbing ───────────────────────────────────────────────────────────────

/**
 * Asks the OS for a free TCP port on the loopback interface.
 *
 * There is an unavoidable gap between closing this probe socket and the tutorial binding the port.
 * `startTutorial` handles the (rare) collision by detecting the child's EADDRINUSE exit and retrying
 * with a fresh port, so the gap never surfaces as a flaky test.
 */
const getFreePort = () =>
	new Promise((resolve, reject) => {
		const server = net.createServer();
		server.unref();
		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const { port } = server.address();
			server.close(() => resolve(port));
		});
	});

/** Resolves once `url` answers anything, or rejects when `shouldAbort()` returns a reason. */
const waitForHttp = async (url, { timeoutMs = 20_000, intervalMs = 100, shouldAbort } = {}) => {
	const deadline = Date.now() + timeoutMs;
	let lastError;

	while (Date.now() < deadline) {
		const abortReason = shouldAbort?.();

		if (abortReason) {
			throw new Error(abortReason);
		}

		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
			// Any HTTP answer proves the server is listening; the status itself is asserted by tests.
			return response;
		} catch (error) {
			lastError = error;
			await sleep(intervalMs);
		}
	}

	throw new Error(`Timed out after ${timeoutMs}ms waiting for ${url}: ${lastError?.message ?? 'unknown error'}`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { TUTORIALS, tutorialPath } from './tutorials.js';

/**
 * Installs the dependencies of every tutorial, the same way a reader following a README would.
 *
 * `npm ci` is used because each tutorial ships a `package-lock.json`: it fails when the lockfile and
 * `package.json` disagree, which is itself a regression worth catching.
 *
 * Run directly (`npm run install:tutorials`) or through the Playwright global setup, which calls
 * `installMissing()` so a normal test run bootstraps a fresh clone by itself.
 */

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const isInstalled = (tutorial) => fs.existsSync(tutorialPath(tutorial, 'node_modules'));

const install = (tutorial) => {
	const cwd = tutorialPath(tutorial);
	const command = fs.existsSync(tutorialPath(tutorial, 'package-lock.json')) ? 'ci' : 'install';
	const result = spawnSync(npm, [command, '--no-audit', '--no-fund'], { cwd, stdio: 'inherit' });

	if (result.error) {
		throw new Error(`Failed to run 'npm ${command}' in ${tutorial.dir}: ${result.error.message}`);
	}

	if (result.status !== 0) {
		throw new Error(`'npm ${command}' failed in ${tutorial.dir} with exit code ${result.status}`);
	}
};

/** Installs only the tutorials that have no node_modules yet. Returns the ids it installed. */
export const installMissing = () => {
	const installed = [];

	for (const tutorial of TUTORIALS) {
		if (!isInstalled(tutorial)) {
			console.log(`[tests] Installing dependencies for ${tutorial.dir}`);
			install(tutorial);
			installed.push(tutorial.id);
		}
	}

	return installed;
};

const runAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (runAsScript) {
	for (const tutorial of TUTORIALS) {
		console.log(`\n[tests] npm install — ${tutorial.dir}`);
		install(tutorial);
	}

	console.log(`\n[tests] Installed ${TUTORIALS.length} tutorials.`);
}

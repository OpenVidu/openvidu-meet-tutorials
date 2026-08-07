import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Every tutorial in this repository, in documentation order.
 *
 * `id`        Stable short name used in test titles.
 * `dir`       Path relative to the repository root.
 * `title`     Exact <title> of the tutorial page.
 * `tag`       Text of the badge in the top app bar.
 * `embedsWebComponent`  True when it embeds `<openvidu-meet>`; false when it links to the Meet
 *             interface instead. The shared suites branch on it, because it changes what "accessing a
 *             room" means.
 * `docs`      Official documentation page, handy when a test fails.
 */
export const TUTORIALS = [
	{
		id: 'direct-link',
		name: 'Direct Link',
		dir: 'embedding-options/meet-direct-link',
		title: 'OpenVidu Meet | Direct Link Tutorial',
		tag: 'Direct Link Tutorial',
		embedsWebComponent: false,
		docs: 'https://openvidu.io/latest/meet/embedded/tutorials/embedding-options/direct-link/'
	},
	{
		id: 'webcomponent-basic',
		name: 'WebComponent',
		dir: 'embedding-options/meet-webcomponent-basic',
		title: 'OpenVidu Meet | WebComponent Tutorial',
		tag: 'WebComponent Tutorial',
		embedsWebComponent: true,
		docs: 'https://openvidu.io/latest/meet/embedded/tutorials/embedding-options/webcomponent/'
	},
	{
		id: 'webcomponent-commands-events',
		name: 'WebComponent Commands & Events',
		dir: 'embedding-options/meet-webcomponent-commands-events',
		title: 'OpenVidu Meet | Commands & Events Tutorial',
		tag: 'Commands & Events Tutorial',
		embedsWebComponent: true,
		docs: 'https://openvidu.io/latest/meet/embedded/tutorials/embedding-options/webcomponent-advanced/'
	},
	{
		id: 'identified-guests',
		name: 'Identified Guests',
		dir: 'access/meet-identified-guests',
		title: 'OpenVidu Meet | Identified Guests Tutorial',
		tag: 'Identified Guests Tutorial',
		embedsWebComponent: true,
		docs: 'https://openvidu.io/latest/meet/embedded/tutorials/access/identified-guests/'
	},
	{
		id: 'users',
		name: 'Users',
		dir: 'access/meet-users',
		title: 'OpenVidu Meet | Users Tutorial',
		tag: 'Users Tutorial',
		embedsWebComponent: true,
		docs: 'https://openvidu.io/latest/meet/embedded/tutorials/access/users/'
	},
	{
		id: 'recordings',
		name: 'Recordings',
		dir: 'advanced-features/meet-recordings',
		title: 'OpenVidu Meet | Recordings Tutorial',
		tag: 'Recordings Tutorial',
		embedsWebComponent: true,
		docs: 'https://openvidu.io/latest/meet/embedded/tutorials/advanced-features/recordings/'
	},
	{
		id: 'webhooks',
		name: 'Webhooks',
		dir: 'advanced-features/meet-webhooks',
		title: 'OpenVidu Meet | Webhooks Tutorial',
		tag: 'Webhooks Tutorial',
		embedsWebComponent: true,
		docs: 'https://openvidu.io/latest/meet/embedded/tutorials/advanced-features/webhooks/'
	}
];

/** Absolute path of a tutorial directory. */
export const tutorialPath = (tutorial, ...segments) => path.join(REPO_ROOT, tutorial.dir, ...segments);

/** Look a tutorial up by its id; throws when the id is unknown so typos fail loudly. */
export const tutorialById = (id) => {
	const tutorial = TUTORIALS.find((candidate) => candidate.id === id);

	if (!tutorial) {
		throw new Error(`Unknown tutorial id '${id}'. Known ids: ${TUTORIALS.map((t) => t.id).join(', ')}`);
	}

	return tutorial;
};

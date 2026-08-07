# Tutorial tests

The test runner, its Playwright config and the machinery shared by the tutorials' tests. **The tests
themselves do not live here** — each tutorial owns its spec, next to the code it covers:

```
embedding-options/meet-direct-link/
├── src/                              the tutorial
├── public/
└── tests/
    └── direct-link.spec.js           its tests
```

Everything in `.tests/` is CI/development tooling, not a tutorial — hence the leading dot, the same
convention `.github/` uses. Every directory at the repository root that a reader would actually copy
(`access/`, `advanced-features/`, `embedding-options/`) contains only tutorials. `harness/`, in here,
holds what all seven tutorials share: the launcher, the Meet client, the UI helpers and the suites they
compose. Nothing in it is a dependency of any tutorial — every tutorial stays a self-contained npm
project that a reader can copy on its own.

## What the tests do

They are all end-to-end. Each one boots the tutorial exactly as its README tells a reader to
(`node src/index.js`), points it at a **real OpenVidu Meet server**, and drives it in a browser —
creating rooms, embedding the real WebComponent, joining real meetings, recording, receiving webhooks.

Beyond the visible behaviour, the shared room-lifecycle suite asserts the fields every tutorial
depends on directly against the API response (`roomId`, `access.anonymous.*.url`, `room.status`), so a
rename shows up as a named assertion failure instead of a tutorial quietly rendering `undefined`. Each
spec does the same for the fields specific to it (a member's `type`/`baseRole`, a recording's
`duration`/`size`) right where the test already needs that value — there is no separate field registry
to keep in sync.

The suites also confirm **the component still emits the events and accepts the commands** the
tutorials rely on (`joined`, `left`, `closed`, `endMeeting`), observed through the tutorial's own
reaction to them.

## Running

Run from the repository root with `--prefix .tests`, or `cd .tests` first and drop it — both are used
interchangeably below.

```bash
npm --prefix .tests install                  # the runner (Playwright) — once
npm --prefix .tests run install:browsers     # Chromium — once

npm --prefix .tests test                     # everything
npm --prefix .tests run test:headed          # watch it happen
npm --prefix .tests run test:ui              # interactive
npm --prefix .tests run report               # open the HTML report of the last run
```

Tutorial dependencies install themselves on the first run (`npm ci` per tutorial), so a fresh clone
needs nothing else. `npm --prefix .tests run install:tutorials` does it up front.

Narrow a run the usual Playwright way:

```bash
cd .tests
npx playwright test ../embedding-options/meet-direct-link    # one tutorial
npx playwright test -g "identified guests"                   # by title
```

## Pointing at a Meet server

A Meet server is required — that is the whole point of the suite. Which one is entirely up to you:

```bash
# OpenVidu Local Deployment (the default)
npm --prefix .tests test

# OpenVidu Meet running from source (./meet.sh dev)
MEET_URL=http://localhost:6080/meet npm --prefix .tests test
```

| Variable              | Default                      | What it is                                                        |
| --------------------- | ---------------------------- | ----------------------------------------------------------------- |
| `MEET_URL`            | `http://localhost:9080/meet` | Meet server, base path included                                   |
| `MEET_API_KEY`        | `meet-api-key`               | Sent as `X-API-KEY`                                               |
| `MEET_WEBHOOK_PORT`   | unset                        | Port the deployment posts webhooks to (see below)                 |
| `MEET_E2E_RECORDINGS` | unset                        | `1` also runs the recording-capture test, which needs an egress    |

When no server answers, the run **stops immediately** with a message telling you how to start one. That
is deliberate: with a single test layer, a run that quietly reports "all skipped" reads like success.

### The tutorials hardcode a Meet URL — and it still works

Every WebComponent tutorial has this in its HTML:

```html
<script src="http://localhost:9080/meet/v1/openvidu-meet.js"></script>
```

When `MEET_URL` points elsewhere, the harness rewrites those requests in the browser rather than editing
the tutorials. The whole `/meet/**` prefix is rewritten, not just the entry file: the bundle is a small
loader that dynamically imports a sibling chunk, and that import resolves relative to wherever the
browser believes the loader came from.

Everything else already points at the right server, because the URLs come from the API responses.

### Two ports to know about

**Every tutorial hardcodes `SERVER_PORT=6080`** in its `.env`, which would collide between tutorials and,
when Meet runs from source, with Meet itself. `dotenv` never overrides variables already in the
environment, so the launcher hands each instance its own free port without touching any tutorial file.

**The webhooks tutorial is the exception.** Webhooks are pushed *to* the application, so it has to listen
exactly where the deployment posts them, and that cannot be discovered through the API. Set
`MEET_WEBHOOK_PORT` to that port (`6080` in a default OpenVidu Local Deployment). Without it, only the two
tests that need inbound events skip — with an explanation — and everything else still runs.

## What is in here

| File                          | Role                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `package.json`                | The runner's own dependencies (`@playwright/test`) and `npm` scripts.            |
| `playwright.config.js`        | Points Playwright one level up (`testDir: '..'`) so it finds every tutorial's `tests/` folder. |
| `harness/tutorials.js`        | The catalogue: path, page title, app-bar tag and docs link, per tutorial.         |
| `harness/tutorial-server.js`  | Boots a tutorial with `node src/index.js` on a free port and waits for HTTP.      |
| `harness/tutorial-page.js`    | Locators and actions for the UI all tutorials share.                             |
| `harness/meet.js`             | Everything about the Meet server: configuration, API client, bundle-URL rewriting.|
| `harness/meet-ui.js`          | Selectors and helpers for driving the real Meet interface (lobby, join, login).   |
| `harness/fixtures.js`         | The `test` object: `app`, `ui`, `meet`, `cleanup`.                                |
| `harness/suites.js`           | Behaviour shared by every tutorial, composed by each spec.                        |
| `harness/global-setup.js`     | Installs missing tutorial dependencies, requires a reachable Meet server.         |
| `harness/install-tutorials.js`| `npm ci` per tutorial, also runnable as `npm run install:tutorials`.              |

### Shared suites

The tutorials build on each other, so most of what one does is also true of the next. Two suites cover
that common ground and each spec composes them, then adds only what is specific to it:

```js
// access/meet-users/tests/users.spec.js
const tutorial = tutorialById('users');

test.use({ tutorialId: tutorial.id });

describeBootsAndServes(tutorial);   // installs, boots, serves, reaches the API
describeRoomLifecycle(tutorial);    // create / list / access / delete, and the payload fields

test.describe('Users: Meet accounts as room members', () => {
    /* only what is unique to this tutorial */
});
```

Titles are prefixed with the tutorial name, so a failure inside a shared suite still says which tutorial
broke.

## Adding a tutorial

1. Add an entry to `TUTORIALS` in `harness/tutorials.js` (path, page title, app-bar tag, whether it
   embeds the WebComponent, docs link).
2. Create `<category>/<tutorial>/tests/<id>.spec.js`, declare `test.use({ tutorialId })`, compose the two
   shared suites, and write what is specific to it.
3. If it reads an API field no other tutorial reads, assert it is present right where the test already
   uses that value — see how `describeRoomLifecycle` checks `roomId` and the access URLs, or how
   `recordings.spec.js` checks `duration`/`size`.

## Writing tests here

- **Use `ui.reload()`, never `page.reload()`.** The tutorials fetch from `DOMContentLoaded`, so a bare
  reload returns while requests are still in flight.
- **Use the page object's actions** (`ui.createRoom`, `ui.addGuest`, `ui.playRecording`) rather than raw
  clicks. They wait for the operation to actually finish — the tutorials reset their forms *after* the API
  call resolves, so two quick submissions in a row would silently lose the second one.
- **Register everything you create with `cleanup`**, so a failed run never leaves rooms or users behind on
  a shared deployment.
- **Leaving a meeting is not closing the component.** Meet shows a "Meeting Ended" panel and waits for it
  to be acknowledged before the component emits `closed`; use `dismissMeetingEndedPanel(page)`.
- **Assert against the API, not only the page.** `meet.listRooms()`, `meet.listMembers()` and friends are
  what prove the tutorial really did something rather than just rendering optimistically.

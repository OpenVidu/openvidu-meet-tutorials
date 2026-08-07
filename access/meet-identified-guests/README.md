# OpenVidu Meet Identified Guests

This example extends the [meet-webcomponent-basic](../../embedding-options/meet-webcomponent-basic) tutorial. On top of the shared anonymous access links (access as moderator or speaker), it shows how to add **identified guests** to an OpenVidu Meet room. An identified guest is a room member with a fixed name and a **unique** access link that grants access to the room without any login. Each link is meant to be delivered privately to a single person and can be revoked individually. It is built using Node.js and Express for the backend and plain HTML/CSS/JavaScript for the frontend.

## Prerequisites

- [Node](https://nodejs.org/en/download)

## Run

> [!NOTE]
> Before running the application, you must also run [OpenVidu Local Deployment](https://github.com/OpenVidu/openvidu-local-deployment).

1. Download repository

```bash
git clone https://github.com/OpenVidu/openvidu-meet-tutorials.git
cd openvidu-meet-tutorials/access/meet-identified-guests
```

2. Install dependencies

```bash
npm install
```

3. Run the application

```bash
npm start
```

## Tests

This tutorial has its own [Playwright](https://playwright.dev) tests in [`tests/`](tests). They boot it
against a real OpenVidu Meet server and drive it in a browser. Run them from the repository root:

```bash
cd ../..
npm install                                            # the test runner, once
npm run install:browsers                               # Chromium, once

npx playwright test access/meet-identified-guests
```

Point them at whichever Meet server you use:

```bash
MEET_URL=http://localhost:6080/meet npx playwright test access/meet-identified-guests
```

See [`../../.tests/README.md`](../../.tests/README.md) for the details.

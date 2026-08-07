# OpenVidu Meet Direct Link

This is a simple example of how to use OpenVidu Meet in a Node.js application by creating a direct link to a meeting room. It is built using Node.js and Express for the backend and plain HTML/CSS/JavaScript for the frontend.

## Prerequisites

- [Node](https://nodejs.org/en/download)

## Run

> [!NOTE]
> Before running the application, you must also run [OpenVidu Local Deployment](https://github.com/OpenVidu/openvidu-local-deployment).

1. Download repository

```bash
git clone https://github.com/OpenVidu/openvidu-meet-tutorials.git
cd openvidu-meet-tutorials/embedding-options/meet-direct-link
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

npx playwright test embedding-options/meet-direct-link
```

Point them at whichever Meet server you use:

```bash
MEET_URL=http://localhost:6080/meet npx playwright test embedding-options/meet-direct-link
```

See [`../../.tests/README.md`](../../.tests/README.md) for the details.

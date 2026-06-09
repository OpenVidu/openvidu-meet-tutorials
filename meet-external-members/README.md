# OpenVidu Meet External Members

This example shows how to add **external members** to an OpenVidu Meet room. An external member is a participant with a fixed name and a **unique** access link that grants access to the room without any login. Each link is meant to be delivered privately to a single person and can be revoked individually. It is built using Node.js and Express for the backend and plain HTML/CSS/JavaScript for the frontend.

## Prerequisites

- [Node](https://nodejs.org/en/download)

## Run

> [!NOTE]
> Before running the application, you must also run [OpenVidu Local Deployment](https://github.com/OpenVidu/openvidu-local-deployment).

1. Download repository

```bash
git clone https://github.com/OpenVidu/openvidu-meet-tutorials.git
cd openvidu-meet-tutorials/meet-external-members
```

2. Install dependencies

```bash
npm install
```

3. Run the application

```bash
npm start
```

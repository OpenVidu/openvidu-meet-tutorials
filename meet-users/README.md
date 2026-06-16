# OpenVidu Meet Users

This example extends the [meet-identified-guests](../meet-identified-guests) tutorial. On top of the anonymous access links and identified guests, it shows how to create **OpenVidu Meet users** with the Users API and add them to a room as **members**. A user is a real OpenVidu Meet account: all user members share the room's authenticated access URL and identify themselves by logging in with their own OpenVidu Meet credentials. A room can therefore admit both users and identified guests as members. It is built using Node.js and Express for the backend and plain HTML/CSS/JavaScript for the frontend.

## Prerequisites

- [Node](https://nodejs.org/en/download)

## Run

> [!NOTE]
> Before running the application, you must also run [OpenVidu Local Deployment](https://github.com/OpenVidu/openvidu-local-deployment).

1. Download repository

```bash
git clone https://github.com/OpenVidu/openvidu-meet-tutorials.git
cd openvidu-meet-tutorials/meet-users
```

2. Install dependencies

```bash
npm install
```

3. Run the application

```bash
npm start
```

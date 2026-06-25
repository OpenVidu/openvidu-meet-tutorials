# OpenVidu Meet Tutorials

A collection of sample applications that show how to embed [OpenVidu Meet](https://openvidu.io/latest/meet/) into your own web application. Each tutorial is a self-contained project built with **Node.js** and **Express** for the backend and plain **HTML/CSS/JavaScript** for the frontend.

The tutorials are designed to be followed in order: each one builds on the concepts introduced by the previous ones, starting from a simple direct link to a meeting room and progressing to advanced features such as access management, recordings and webhooks.

> [!NOTE]
> Each tutorial folder contains its own `README.md` with the specific instructions to run it. To run any tutorial you need [Node.js](https://nodejs.org/en/download) installed and a running [OpenVidu Local Deployment](https://github.com/OpenVidu/openvidu-local-deployment).

## Tutorials

### Embedding options

How to embed OpenVidu Meet into your application.

| Tutorial | Description | Documentation |
| --- | --- | --- |
| [Direct Link](embedding-options/meet-direct-link) | Create and delete rooms with the OpenVidu Meet API and access the video call through a direct link to the OpenVidu Meet interface. | [📖 Read the docs](https://openvidu.io/latest/meet/embedded/tutorials/embedding-options/direct-link/) |
| [WebComponent](embedding-options/meet-webcomponent-basic) | Embed OpenVidu Meet directly into your application using its WebComponent instead of external links. | [📖 Read the docs](https://openvidu.io/latest/meet/embedded/tutorials/embedding-options/webcomponent/) |
| [WebComponent Commands & Events](embedding-options/meet-webcomponent-commands-events) | Interact with the embedded WebComponent by sending commands and listening to events for enhanced room management. | [📖 Read the docs](https://openvidu.io/latest/meet/embedded/tutorials/embedding-options/webcomponent-advanced/) |

### Access

How to manage who can access a room and with which permissions.

| Tutorial | Description | Documentation |
| --- | --- | --- |
| [Identified Guests](access/meet-identified-guests) | Add identified guests as room members, each with a fixed name and a unique, individually revocable access link that grants access without any login. | [📖 Read the docs](https://openvidu.io/latest/meet/embedded/tutorials/access/identified-guests/) |
| [Users](access/meet-users) | Create OpenVidu Meet users with the Users API and add them as members who access the room by logging in with their own credentials. | [📖 Read the docs](https://openvidu.io/latest/meet/embedded/tutorials/access/users/) |

### Advanced features

How to take advantage of the more advanced capabilities of OpenVidu Meet.

| Tutorial | Description | Documentation |
| --- | --- | --- |
| [Recordings](advanced-features/meet-recordings) | Self-manage room recordings: list, play, download and delete them from your own application. | [📖 Read the docs](https://openvidu.io/latest/meet/embedded/tutorials/advanced-features/recordings/) |
| [Webhooks](advanced-features/meet-webhooks) | Receive live room and recording status updates through OpenVidu Meet webhooks and Server-Sent Events (SSE). | [📖 Read the docs](https://openvidu.io/latest/meet/embedded/tutorials/advanced-features/webhooks/) |

## Resources

- [OpenVidu Meet documentation](https://openvidu.io/latest/meet/)
- [OpenVidu Meet embedded tutorials index](https://openvidu.io/latest/meet/embedded/tutorials/)
- [OpenVidu Local Deployment](https://github.com/OpenVidu/openvidu-local-deployment)
- [OpenVidu Meet repository](https://github.com/OpenVidu/openvidu-meet)

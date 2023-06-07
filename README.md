# NoseBook Socket Server

This is the second server for NoseBook app to maintain socket.io operations

## Running Locally

To run the front-end and socket server locally, follow the instructions on the [Front-end Repository](https://github.com/ShirshoDipto/social-media-client) and [Socket repository](https://github.com/ShirshoDipto/nosebook-socket) respectively.

### Clone repository

```
git clone git@github.com:ShirshoDipto/nosebook-socket.git
```

```
cd nosebook-socket
```

### Set up environment variables

```
NODE_ENV = production

PORT = <A port for local address, e.g 4000>

CLIENT_ORIGINAL = <Address of the client. https://nosebook-social.netlify.app or local address, e.g http://localhost:3000>

SERVER_ROOT = <Address of the socket server. https://nosebook-api.fly.dev or local address, e.g http://localhost:5000>
```

### Install packages and start server

```
npm install
```

```
npm start
```

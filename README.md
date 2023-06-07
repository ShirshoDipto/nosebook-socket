# NoseBook Socket Server

This is the second server for NoseBook app to maintain socket.io operations.

[Front-end repository](https://github.com/ShirshoDipto/social-media-client)

[API repository](https://github.com/ShirshoDipto/social-media-api)

The server is mainly hosted on Render. To prevent Render from going to sleep after 15 minutes of inactivity, a ping method is used in which the server will receive a request after every 10 minutes. In that way, the server will never go to sleep, giving users a smooth, bug free real time functionalities.

```javascript
setInterval(async () => {
  const res = await fetch("https://nosebook-socket.onrender.com/wakeup");
}, 10 * 60 * 1000);
```

## Running Locally

To run the front-end and api server locally, follow the instructions on the [Front-end Repository](https://github.com/ShirshoDipto/social-media-client) and [API repository](https://github.com/ShirshoDipto/social-media-api) respectively.

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

SERVER_ROOT = <Address of the api server. https://nosebook-api.fly.dev or local address, e.g http://localhost:5000>
```

### Install packages and start server

```
npm install
```

```
npm start
```

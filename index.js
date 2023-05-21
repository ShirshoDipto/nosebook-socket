const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const db = require("./db");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: [process.env.CLIENTLOCAL, process.env.CLIENTORIGINAL],
  },
});

const users = {};

async function sendActiveStatus(userObj, status) {
  try {
    userObj.userInfo.friends.forEach(async (fnd) => {
      const onlineFnd = users[fnd];
      if (onlineFnd) {
        io.to(onlineFnd.socketId).emit("receiveUserStatus", {
          userId: userObj.userInfo._id,
          status,
        });
      }
    });
  } catch (error) {
    console.log(error);
  }
}

async function postEventHelper(fnd, sender) {
  // console.log(fnd);
  // console.log(sender);
  const receiver = users[fnd];
  const notif = await db.createNotification(
    fnd,
    sender.token,
    sender.userInfo,
    3
  );

  if (receiver) {
    // console.log("sending post event");
    io.to(receiver.socketId).emit("getPost", notif);
  }
}

io.use(async (socket, next) => {
  const user = socket.handshake.auth.user;
  if (!user) {
    return next(new Error("User must be provided."));
  }

  socket.userId = user.userInfo._id;
  socket.userName = user.userInfo.firstName + " " + user.userInfo.lastName;
  const userObj = {
    userInfo: user.userInfo,
    token: user.token,
    socketId: socket.id,
    currentChat: null,
    isOnMessenger: false,
  };

  if (!users[user.userInfo._id]) {
    users[user.userInfo._id] = userObj;
    sendActiveStatus({ ...userObj }, true); // asynchronous
  }

  next();
});

io.on("connection", (socket) => {
  // console.log(`${socket.userName} is connected...`);

  socket.on("sendMsg", async ({ receiverId, msg }) => {
    const receiver = users[receiverId];
    const sender = users[msg.sender._id];

    try {
      if (!receiver || !receiver.isOnMessenger) {
        const isNotifExist = await db.checkExistingNotif(
          receiverId,
          sender.token
        );

        if (isNotifExist) {
          await db.createMsg(msg, msg.seenBy, sender.token);
        } else {
          const [newMsg, notif] = await Promise.all([
            db.createMsg(msg, msg.seenBy, sender.token),
            db.createNotification(receiverId, sender.token, sender.userInfo, 2),
          ]);

          io.to(receiver?.socketId).emit("newMsg", notif);
        }
      } else if (
        receiver.currentChat?._id !== msg.conversationId &&
        receiver.isOnMessenger
      ) {
        io.to(receiver.socketId).emit("getMsg", msg);

        await db.createMsg(msg, msg.seenBy, sender.token);
      } else if (receiver.currentChat._id === msg.conversationId) {
        msg.seenBy.push(receiver.userInfo._id);
        io.to(receiver.socketId).emit("getMsg", msg);

        await db.createMsg(msg, msg.seenBy, sender.token);
      }
    } catch (error) {
      socket.emit("internalError", error);
    }
  });

  socket.on("sendPost", async (userId) => {
    try {
      const sender = users[userId];

      await Promise.all(
        sender.userInfo.friends.map((fnd) => postEventHelper(fnd, sender))
      );
    } catch (error) {
      socket.emit("internalError", error);
    }
  });

  socket.on("sendFndReq", async (notif) => {
    const sender = users[notif.sender];
    const receiver = users[notif.receiver];

    if (receiver) {
      const senderInfos = {
        _id: notif.sender,
        firstName: sender.userInfo.firstName,
        lastName: sender.userInfo.lastName,
        profilePic: sender.userInfo.profilePic,
      };

      notif.sender = senderInfos;
      io.to(receiver.socketId).emit("getFndReq", notif);
    }
  });

  socket.on("acceptedFndReq", async (notif) => {
    socket.emit("deleteNotif", notif._id);
  });

  socket.on("getUserStatus", (theUser) => {
    const user = users[theUser._id];
    if (user) {
      socket.emit("receiveUserStatus", { userId: theUser._id, status: true });
    } else {
      socket.emit("receiveUserStatus", { userId: theUser._id, status: false });
    }
  });

  socket.on("getFndsStatus", async (user) => {
    const online = [];
    const offline = [];
    user.friends.forEach(async (fnd) => {
      const activeFnd = users[fnd._id];
      if (activeFnd) {
        online.push(fnd);
      } else {
        offline.push(fnd);
      }
    });

    socket.emit("receiveFndsStatus", { online, offline });
  });

  socket.on("sendTyping", ({ receiverId, chatId }) => {
    const receiver = users[receiverId];
    if (receiver?.currentChat?._id === chatId) {
      io.to(receiver.socketId).emit("getTyping");
    }
  });

  socket.on("stopTyping", ({ receiverId, chatId }) => {
    const receiver = users[receiverId];
    if (receiver?.currentChat?._id === chatId) {
      io.to(receiver.socketId).emit("stoppedTyping");
    }
  });

  socket.on("messengerActive", (userId) => {
    if (users[userId]) {
      users[userId].isOnMessenger = true;
    }
  });

  socket.on("messengerDeactive", (userId) => {
    const user = users[userId];
    if (user) {
      user.isOnMessenger = false;
      user.currentChat = null;
    }
  });

  socket.on("currentChatActive", ({ userId, activeChat }) => {
    const user = users[userId];
    if (user) {
      user.currentChat = activeChat;
    }
  });

  socket.on("disconnect", async () => {
    // console.log(`${socket.userName} is disconnected...`);
    let user;
    if (users[socket.userId]) {
      user = JSON.parse(JSON.stringify(users[socket.userId]));
      delete users[socket.userId];
      sendActiveStatus(user, false); // asynchronous
    }
  });
});

httpServer.listen(process.env.PORT, () => {
  console.log(`Socket server listening on port ${process.env.PORT}`);
});

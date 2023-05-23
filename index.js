const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const apiCalls = require("./apiCalls");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: [process.env.CLIENT_LOCAL, process.env.CLIENT_ORIGINAL],
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
        const isNotifExist = await apiCalls.checkExistingNotif(
          receiverId,
          sender.token
        );

        if (isNotifExist) {
          await apiCalls.createMsg(msg, msg.seenBy, sender.token);
        } else {
          const [newMsg, notif] = await Promise.all([
            apiCalls.createMsg(msg, msg.seenBy, sender.token),
            apiCalls.createNotification(
              receiverId,
              sender.token,
              sender.userInfo,
              2
            ),
          ]);

          io.to(receiver?.socketId).emit("newMsg", notif);
        }
      } else if (
        receiver.currentChat?._id !== msg.conversationId &&
        receiver.isOnMessenger
      ) {
        io.to(receiver.socketId).emit("getMsg", msg);

        await apiCalls.createMsg(msg, msg.seenBy, sender.token);
      } else if (receiver.currentChat._id === msg.conversationId) {
        msg.seenBy.push(receiver.userInfo._id);
        io.to(receiver.socketId).emit("getMsg", msg);

        await apiCalls.createMsg(msg, msg.seenBy, sender.token);
      }
    } catch (error) {
      socket.emit("internalError", error);
    }
  });

  socket.on("sendPost", async (userId) => {
    try {
      const sender = users[userId];
      sender.userInfo.friends.forEach(async (fnd) => {
        const receiver = users[fnd];
        const notif = await apiCalls.createNotification(
          fnd,
          sender.token,
          sender.userInfo,
          3
        );

        if (receiver) {
          io.to(receiver.socketId).emit("getPost", notif);
        }
      });
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

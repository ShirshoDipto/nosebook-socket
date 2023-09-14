const { createServer } = require("http");
const { Server } = require("socket.io");
const fetch = require("cross-fetch");
require("dotenv").config();
const apiCalls = require("./apiCalls");

const httpServer = createServer((req, res) => {
  if (req.url === "/wakeup") {
    console.log("Server is running...");
    res.end();
  } else {
    res.end();
  }
}).listen(process.env.PORT, () => {
  console.log(`Socket server listening on port ${process.env.PORT}`);
});

setInterval(async () => {
  const res = await fetch("https://nosebook-socket.onrender.com/wakeup");
}, 10 * 60 * 1000);

const io = new Server(httpServer, {
  cors: {
    origin: [
      process.env.CLIENT_LOCAL,
      process.env.CLIENT_ORIGINAL,
      process.env.SERVER_ROOT,
    ],
  },
});

const users = {};

function sendEvent(receiverId, eventName, data) {
  const receiverInstances = users[receiverId];
  if (!receiverInstances) return;

  receiverInstances.forEach((instance) => {
    io.to(instance.socketId).emit(eventName, data);
  });
}

async function sendActiveStatus(userObj, status) {
  try {
    userObj.userInfo.friends.forEach(async (fnd) => {
      sendEvent(fnd, "receiveUserStatus", {
        userId: userObj.userInfo._id,
        status,
      });
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

  const currUser = users[user.userInfo._id];
  if (!currUser) {
    users[user.userInfo._id] = [userObj];
    sendActiveStatus(JSON.parse(JSON.stringify(userObj)), true); // asynchronous
  } else {
    currUser.push(userObj);
  }

  next();
});

io.on("connection", (socket) => {
  console.log(`${socket.userName} is connected...`);

  socket.on("sendMsg", async ({ receiverId, msg }) => {
    const receivers = users[receiverId];
    const senders = users[msg.sender._id];
    if (!receivers || !senders) return;
    const sender = senders[0];

    const homepageUsers = receivers.filter((r) => !r.isOnMessenger);
    const diffChatUsers = receivers.filter(
      (r) =>
        r.isOnMessenger &&
        (!r.currentChat || r.currentChat?._id !== msg.conversationId)
    );
    const sameChatUsers = receivers.filter(
      (r) => r.currentChat?._id === msg.conversationId
    );

    try {
      if (sameChatUsers.length > 0) {
        msg.seenBy.push(receiverId);
        sendEvent(receiverId, "getMsg", msg);
        await apiCalls.createMsg(msg, msg.seenBy, sender.token);
      } else if (diffChatUsers.length > 0) {
        sendEvent(receiverId, "getMsg", msg);
        await apiCalls.createMsg(msg, msg.seenBy, sender.token);
      } else if (homepageUsers.length > 0) {
        const [isNotifExist, newMsg] = await Promise.all([
          apiCalls.checkExistingNotif(receiverId, sender.token),
          apiCalls.createMsg(msg, msg.seenBy, sender.token),
        ]);
        if (!isNotifExist) {
          const notif = await apiCalls.createNotification(
            receiverId,
            sender.token,
            sender.userInfo,
            2
          );
          sendEvent(receiverId, "newMsg", notif);
        }
      }
    } catch (error) {
      console.log(error);
      socket.emit("internalError", error);
    }
  });

  socket.on("sendPost", async (userId) => {
    try {
      const sender = users[userId];
      if (!sender) return;
      sender[0].userInfo.friends.forEach(async (fnd) => {
        const notif = await apiCalls.createNotification(
          fnd,
          sender[0].token,
          sender[0].userInfo,
          3
        );

        sendEvent(fnd, "getPost", notif);
      });
    } catch (error) {
      console.log(error);
      socket.emit("internalError", error);
    }
  });

  socket.on("sendFndReq", async (notif) => {
    const sender = users[notif.sender];
    if (!sender) return;

    const senderInfos = {
      _id: notif.sender[0],
      firstName: sender[0].userInfo.firstName,
      lastName: sender[0].userInfo.lastName,
      profilePic: sender[0].userInfo.profilePic,
    };

    notif.sender = senderInfos;
    sendEvent(notif.receiver, "getFndReq", notif);
    if (notif.notificationType === 1) {
      sendEvent(sender[0].userInfo._id, "deleteNotif", notif._id);
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
    const receivers = users[receiverId];
    if (!receivers) return;

    receivers.forEach((receiver) => {
      if (receiver.currentChat && receiver.currentChat._id === chatId) {
        io.to(receiver.socketId).emit("getTyping");
      }
    });
  });

  socket.on("stopTyping", ({ receiverId, chatId }) => {
    const receivers = users[receiverId];
    if (!receivers) return;

    receivers.forEach((receiver) => {
      if (receiver.currentChat && receiver.currentChat._id === chatId) {
        io.to(receiver.socketId).emit("stoppedTyping");
      }
    });
  });

  socket.on("messengerActive", (userId) => {
    const allUserInstances = users[userId];
    if (!allUserInstances) return;

    const currUser = allUserInstances.find(
      (user) => user.socketId === socket.id
    );

    currUser.isOnMessenger = true;
  });

  socket.on("messengerDeactive", (userId) => {
    const allUserInstances = users[userId];
    if (!allUserInstances) return;

    const currUser = allUserInstances.find(
      (user) => user.socketId === socket.id
    );

    currUser.isOnMessenger = false;
    currUser.currentChat = null;
  });

  socket.on("currentChatActive", ({ userId, activeChat }) => {
    const allUserInstances = users[userId];
    if (!allUserInstances) return;

    const currUser = allUserInstances.find(
      (user) => user.socketId === socket.id
    );

    currUser.currentChat = activeChat;
  });

  socket.on("disconnect", async () => {
    console.log(`${socket.userName} is disconnected...`);
    const userInstances = JSON.parse(JSON.stringify(users[socket.userId]));

    if (userInstances && userInstances.length === 1) {
      delete users[socket.userId];
      sendActiveStatus(userInstances[0], false); // asynchronous
    } else {
      const newUserInstances = userInstances.filter(
        (i) => i.socketId !== socket.id
      );
      users[socket.userId] = newUserInstances;
    }
  });
});

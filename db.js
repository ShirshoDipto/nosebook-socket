const mongoose = require("mongoose");

mongoose.set("strictQuery", false);
const mongoDB = process.env.MONGODB_URI;

main().catch((err) => console.log(err));
async function main() {
  await mongoose.connect(mongoDB);
  console.log("Connected to the database. ");
}

const serverRoot = process.env.SERVERROOT;

exports.createMsg = async (msg, seenBy, token) => {
  const res = await fetch(
    `${serverRoot}/api/messenger/conversations/${msg.conversationId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId: msg.conversationId,
        sender: msg.sender._id,
        content: msg.content,
        seenBy,
      }),
    }
  );

  const resData = await res.json();
  if (!res.ok) {
    throw resData;
  }

  return resData.message;
};

exports.checkExistingNotif = async (receiverId, token) => {
  const res = await fetch(
    `${serverRoot}/api/notifications/existingMsgNotif?receiverId=${receiverId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const resData = await res.json();

  return resData.existingNotif;
};

exports.createNotification = async (receiverId, token, userInfo, type) => {
  const res = await fetch(`${serverRoot}/api/notifications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      receiverId,
      type,
    }),
  });

  const resData = await res.json();
  if (!res.ok) {
    throw resData;
  }

  resData.notification.sender = userInfo;

  return resData.notification;
};

const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const ConversationSchema = new Schema(
  {
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMsg: {
      type: String,
      default: "",
    },
    unseenMsgs: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        numUnseen: { type: Number, default: 0 },
      },
    ],
    isTemp: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", ConversationSchema);

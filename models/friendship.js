const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const FriendshipSchema = new Schema(
  {
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: Number,
      enums: [
        0, //'pending',
        1, //'friends',
      ],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Friendship", FriendshipSchema);

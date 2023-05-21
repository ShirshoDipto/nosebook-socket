const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const PostSchema = new Schema(
  {
    content: { type: String, required: true },
    image: { type: String, default: "" },
    author: { type: Schema.Types.ObjectId, ref: "User" },
    numComments: { type: Number, default: 0 },
    numLikes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", PostSchema);

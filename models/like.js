const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const LikeSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, required: true },
    referenceId: { type: Schema.Types.ObjectId, required: true },
  },
  { timeStamp: true }
);

module.exports = mongoose.model("Like", LikeSchema);

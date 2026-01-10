import mongoose, { Schema } from "mongoose";

const readPostSchema = new Schema(
  {
    // ১. কোন পোস্ট?
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },

    // ২. কে দেখেছে?
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// 🔥 ইউনিক ইনডেক্স: একজন ইউজার একটা পোস্টের জন্য একবারই এন্ট্রি পাবে
readPostSchema.index({ post: 1, user: 1 }, { unique: true });

export const ReadPost = mongoose.model("ReadPost", readPostSchema);

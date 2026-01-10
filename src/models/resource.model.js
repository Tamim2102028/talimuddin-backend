import mongoose, { Schema } from "mongoose";
import { POST_TARGET_MODELS, ATTACHMENT_TYPES } from "../constants/index.js";

const resourceSchema = new Schema(
  {
    // ১. ফাইলের ডিটেইলস
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(ATTACHMENT_TYPES), // IMAGE, PDF, DOC, etc.
      required: true,
    },
    size: {
      type: Number, // বাইটে সাইজ (Frontend e MB তে কনভার্ট করে দেখাবেন)
      default: 0,
    },

    // ২. কে আপলোড করেছে?
    uploader: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 🎯 ৩. ফাইলটা কোন জায়গার? (সবচেয়ে গুরুত্বপূর্ণ)
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "targetModel",
      index: true,
    },
    targetModel: {
      type: String,
      required: true,
      enum: Object.values(POST_TARGET_MODELS), // Group, Room, CrCorner...
      default: POST_TARGET_MODELS.ROOM,
    },

    // অপশনাল: কোন পোস্টের সাথে লিংকড কিনা
    relatedPost: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
  },
  { timestamps: true }
);

// ইনডেক্সিং (ফাস্ট কুয়েরির জন্য)
resourceSchema.index({ targetId: 1, targetModel: 1, createdAt: -1 });

export const Resource = mongoose.model("Resource", resourceSchema);

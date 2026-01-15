import mongoose, { Schema } from "mongoose";
import { BRANCH_TYPES } from "../constants/index.js";

const branchSchema = new Schema(
  {
    // --- 1. Basic Info ---
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: { type: String, trim: true },
    coverImage: {
      type: String,
      required: true,
    },

    // --- 2. Branch Type ---
    branchType: {
      type: String,
      enum: Object.values(BRANCH_TYPES),
      required: true,
    },

    // --- 3. Access ---
    joinCode: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },

    // --- 4. Management ---
    creator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // --- 5. Status Flags ---
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    // --- 6. Config ---
    settings: {
      allowStudentPosting: { type: Boolean, default: true },
      allowComments: { type: Boolean, default: true },
    },

    membersCount: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Branch = mongoose.model("Branch", branchSchema);

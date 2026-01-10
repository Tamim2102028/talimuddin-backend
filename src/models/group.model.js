import mongoose, { Schema } from "mongoose";
// ✅ Imports from Constants
import { GROUP_TYPES, GROUP_PRIVACY } from "../constants/index.js";

const groupSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
      maxLength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String, trim: true, maxLength: 500 },

    avatar: { type: String },
    coverImage: { type: String },

    institution: {
      type: Schema.Types.ObjectId,
      ref: "Institution",
      index: true,
    },

    type: {
      type: String,
      enum: Object.values(GROUP_TYPES),
      required: true,
      index: true,
    },
    privacy: {
      type: String,
      enum: Object.values(GROUP_PRIVACY),
      index: true,
    },

    settings: {
      allowMemberPosting: { type: Boolean, default: true },
      requirePostApproval: { type: Boolean, default: false },
    },

    membersCount: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 },

    creator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ✅ Search Indexes for Text Search
groupSchema.index(
  {
    name: "text",
    description: "text",
  },
  {
    weights: {
      name: 10, // Higher priority for name matches
      description: 3, // Lower priority for description matches
    },
    name: "group_search_text_index",
  }
);

// ✅ Compound Indexes for Filtered Search
groupSchema.index({ institution: 1, type: 1 });
groupSchema.index({ privacy: 1, institution: 1 });
groupSchema.index({ name: 1, privacy: 1 });

export const Group = mongoose.model("Group", groupSchema);

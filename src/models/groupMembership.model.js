import mongoose, { Schema } from "mongoose";
// ✅ Imports from Constants
import {
  GROUP_ROLES,
  GROUP_MEMBERSHIP_STATUS,
  GROUP_JOIN_METHOD,
} from "../constants/index.js";

const groupMembershipSchema = new Schema(
  {
    group: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ✅ Using Constants
    role: {
      type: String,
      enum: Object.values(GROUP_ROLES),
      default: GROUP_ROLES.MEMBER,
    },

    // ✅ Using Constants (Includes JOINED, INVITED etc.)
    status: {
      type: String,
      enum: Object.values(GROUP_MEMBERSHIP_STATUS),
      index: true,
    },

    // ✅ Using Constants
    joinMethod: {
      type: String,
      enum: Object.values(GROUP_JOIN_METHOD),
      default: GROUP_JOIN_METHOD.DIRECT_JOIN,
    },

    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    joinedAt: {
      type: Date,
    },

    // ✅ Membership Settings
    settings: {
      isMuted: { type: Boolean, default: false },
      isFollowing: { type: Boolean, default: true },
      isPinned: { type: Boolean, default: false },
    },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

groupMembershipSchema.index({ group: 1, user: 1 }, { unique: true });
groupMembershipSchema.index({ group: 1, status: 1 });
groupMembershipSchema.index({ user: 1, status: 1 });

export const GroupMembership = mongoose.model(
  "GroupMembership",
  groupMembershipSchema
);

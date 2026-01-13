import mongoose, { Schema } from "mongoose";
import { Room } from "./room.model.js";

const roomMembershipSchema = new Schema(
  {
    room: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Join Request Status
    isPending: {
      type: Boolean,
      default: true,
      index: true,
    },

    // CR (Class Representative): Student can be promoted to CR
    isCR: {
      type: Boolean,
      default: false,
    },

    // Admin: Can manage room (archive, edit settings)
    isAdmin: {
      type: Boolean,
      default: false,
    },

    // Personal Preference: Hide Room
    isHidden: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Unique Constraint
roomMembershipSchema.index({ room: 1, user: 1 }, { unique: true });
roomMembershipSchema.index({ user: 1, isHidden: 1 });
roomMembershipSchema.index({ room: 1, isPending: 1 });

export const RoomMembership = mongoose.model(
  "RoomMembership",
  roomMembershipSchema
);

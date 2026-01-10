import mongoose, { Schema } from "mongoose";
import { User } from "./user.model.js";
import { FOLLOW_TARGET_MODELS } from "../constants/index.js";

const followSchema = new Schema(
  {
    follower: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    following: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "followingModel",
    },
    followingModel: {
      type: String,
      required: true,
      enum: ["User", "Page", "Institution", "Department"],
      default: "User",
    },
  },
  { timestamps: true }
);

// Prevent duplicate follows
followSchema.index(
  { follower: 1, following: 1, followingModel: 1 },
  { unique: true }
);

// Middleware to update counts
followSchema.post("save", async function (doc) {
  try {
    // Update follower's following count (always a User for now)
    await User.findByIdAndUpdate(doc.follower, {
      $inc: { followingCount: 1 },
    });

    // Update following's followers count based on model type
    if (doc.followingModel === FOLLOW_TARGET_MODELS.USER) {
      await User.findByIdAndUpdate(doc.following, {
        $inc: { followersCount: 1 },
      });
    }
    // TODO: Add cases for Page, Institution, Department when those models are ready
  } catch (error) {
    console.error("Error updating follow counts on save:", error);
  }
});

followSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    try {
      await User.findByIdAndUpdate(doc.follower, {
        $inc: { followingCount: -1 },
      });

      if (doc.followingModel === FOLLOW_TARGET_MODELS.USER) {
        await User.findByIdAndUpdate(doc.following, {
          $inc: { followersCount: -1 },
        });
      }
    } catch (error) {
      console.error("Error updating follow counts on delete:", error);
    }
  }
});

export const Follow = mongoose.model("Follow", followSchema);

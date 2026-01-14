import mongoose, { Schema } from "mongoose";

const branchMembershipSchema = new Schema(
  {
    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
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

    // Admin: Can manage branch (archive, edit settings)
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Unique Constraint
branchMembershipSchema.index({ branch: 1, user: 1 }, { unique: true });
branchMembershipSchema.index({ branch: 1, isPending: 1 });

export const BranchMembership = mongoose.model(
  "BranchMembership",
  branchMembershipSchema
);

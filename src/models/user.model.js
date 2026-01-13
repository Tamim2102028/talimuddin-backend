import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import {
  USER_TYPES,
  GENDERS,
  RELIGIONS,
  ACCOUNT_STATUS,
} from "../constants/index.js";

const userSchema = new Schema(
  {
    // --- Identity ---
    fullName: { type: String, required: true, trim: true, index: true },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: [true, "Password is required"] },
    passwordChangedAt: { type: Date },
    userName: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true, // Allow multiple null values but unique if provided
    },

    // --- Profile ---
    avatar: {
      type: String,
    },
    coverImage: {
      type: String,
    },

    gender: { type: String, enum: Object.values(GENDERS) },
    religion: { type: String, enum: Object.values(RELIGIONS) },

    socialLinks: {
      linkedin: { type: String },
      github: { type: String },
      website: { type: String },
      facebook: { type: String },
    },
    skills: [{ type: String, trim: true }],
    interests: [{ type: String, trim: true }],

    // --- Social Stats ---
    // Note: connectionsCount, followersCount, followingCount kept for data integrity
    // but features are removed. Can be cleaned up in future migration.
    connectionsCount: { type: Number, default: 0 },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 },
    publicFilesCount: { type: Number, default: 0 },

    // --- User Type ---
    userType: {
      type: String,
      enum: Object.values(USER_TYPES),
      default: USER_TYPES.NORMAL, // All new users start as "normal"
      index: true,
    },

    // --- Status ---
    accountStatus: {
      type: String,
      enum: Object.values(ACCOUNT_STATUS),
      default: ACCOUNT_STATUS.ACTIVE,
    },
    bannedAt: {
      type: Date,
      default: null,
    },
    bannedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    bannedReason: {
      type: String,
      default: null,
      trim: true,
      maxLength: 500,
    },
    deletedAt: {
      type: Date,
      default: null,
    },

    // --- Activity Restrictions ---
    restrictions: {
      isCommentBlocked: { type: Boolean, default: false },
      isPostBlocked: { type: Boolean, default: false },
      isMessageBlocked: { type: Boolean, default: false },
      commentRestriction: {
        reason: { type: String, trim: true },
        restrictedAt: { type: Date },
        restrictedBy: { type: Schema.Types.ObjectId, ref: "User" },
      },
      postRestriction: {
        reason: { type: String, trim: true },
        restrictedAt: { type: Date },
        restrictedBy: { type: Schema.Types.ObjectId, ref: "User" },
      },
      messageRestriction: {
        reason: { type: String, trim: true },
        restrictedAt: { type: Date },
        restrictedBy: { type: Schema.Types.ObjectId, ref: "User" },
      },
    },

    // --- Legal Consent ---
    agreedToTerms: {
      type: Boolean,
      required: true,
    },
    termsAgreedAt: {
      type: Date,
      default: Date.now,
    },
    refreshToken: { type: String },
  },
  { timestamps: true }
);

// ✅ Search Indexes for Text Search
userSchema.index(
  {
    fullName: "text",
    userName: "text",
    email: "text",
  },
  {
    weights: {
      fullName: 10,
      userName: 5,
      email: 1,
    },
    name: "user_search_text_index",
  }
);

// ✅ Compound Indexes
userSchema.index({ fullName: 1 });
userSchema.index({ userName: 1, userType: 1 });
userSchema.index({ userType: 1 });
userSchema.index({ skills: 1 });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      phoneNumber: this.phoneNumber,
      userName: this.userName,
      userType: this.userType,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
  });
};

export const User = mongoose.model("User", userSchema);

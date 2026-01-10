import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import {
  INSTITUTION_TYPES,
  USER_TYPES,
  TEACHER_RANKS,
  GENDERS,
  RELIGIONS,
  ACCOUNT_STATUS,
  FRIEND_REQUEST_POLICY,
  CONNECTION_VISIBILITY,
} from "../constants/index.js";

const userSchema = new Schema(
  {
    // --- Identity ---
    fullName: { type: String, required: true, trim: true, index: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
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
    phoneNumber: {
      type: String,
      trim: true,
    },

    // --- Profile ---
    avatar: {
      type: String,
      default: "https://api.dicebear.com/6.x/bottts/svg?seed=tamim",
    },
    coverImage: {
      type: String,
      default: "https://api.dicebear.com/6.x/bottts/svg?seed=coverimage",
    },
    bio: { type: String, trim: true, maxLength: 300 },

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

    // --- Social Stats (✅ ADDED) ---
    connectionsCount: { type: Number, default: 0 }, // Friends Count
    followersCount: { type: Number, default: 0 }, // Followers Count
    followingCount: { type: Number, default: 0 }, // Following Count
    postsCount: { type: Number, default: 0 }, // Posts Count
    publicFilesCount: { type: Number, default: 0 }, // Public Files Count

    // --- Institutional Data ---
    userType: {
      type: String,
      enum: Object.values(USER_TYPES),
      default: USER_TYPES.STUDENT,
      index: true,
    },
    institution: {
      type: Schema.Types.ObjectId,
      ref: "Institution",
      index: true,
    },
    institutionType: { type: String, enum: Object.values(INSTITUTION_TYPES) },

    // --- Academic Info ---
    academicInfo: {
      department: { type: Schema.Types.ObjectId, ref: "Department" },
      studentId: { type: String },
      session: { type: String },
      currentSemester: { type: Number },
      section: { type: String, trim: true },
      teacherId: { type: String },
      rank: { type: String, enum: Object.values(TEACHER_RANKS) },
      officeHours: [
        {
          day: { type: String },
          timeRange: { type: String },
          room: { type: String },
        },
      ],
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
    privacySettings: {
      friendRequestPolicy: {
        type: String,
        enum: Object.values(FRIEND_REQUEST_POLICY),
        default: FRIEND_REQUEST_POLICY.EVERYONE,
      },
      connectionVisibility: {
        type: String,
        default: CONNECTION_VISIBILITY.ONLY_ME, // সব সময় ONLY_ME থাকবে, কেউ অন্যের ফ্রেন্ডলিস্ট দেখবে না
      },
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

    isStudentEmail: {
      type: Boolean,
      default: false,
      index: true,
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

// Indexes & Methods (Unchanged)
userSchema.index(
  { institution: 1, "academicInfo.studentId": 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      userType: USER_TYPES.STUDENT,
      "academicInfo.studentId": { $exists: true },
    },
  }
);
userSchema.index(
  { institution: 1, "academicInfo.teacherId": 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      userType: USER_TYPES.TEACHER,
      "academicInfo.teacherId": { $exists: true },
    },
  }
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
      fullName: 10, // Highest priority for full name matches
      userName: 5, // Medium priority for username matches
      email: 1, // Lowest priority for email matches
    },
    name: "user_search_text_index",
  }
);

// ✅ Compound Indexes for Filtered Search
userSchema.index({ fullName: 1, institution: 1 });
userSchema.index({ userName: 1, userType: 1 });
userSchema.index({ institution: 1, "academicInfo.department": 1, userType: 1 });

// ✅ Existing Indexes (keeping for compatibility)
userSchema.index({ nickName: 1, fullName: 1 });
userSchema.index({ skills: 1 });
userSchema.index({ institution: 1, "academicInfo.department": 1 });

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
      email: this.email,
      userName: this.userName, // nickName এর বদলে userName
      userType: this.userType,
      institution: this.institution || null,
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

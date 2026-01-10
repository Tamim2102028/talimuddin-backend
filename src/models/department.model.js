import mongoose, { Schema } from "mongoose";
import { DEPT_STATUS } from "../constants/index.js";

const departmentSchema = new Schema(
  {
    // ১. নাম: এডমিন যেটা সেট করে দেবে (e.g. "Computer Science & Engineering")
    name: { type: String, required: true, trim: true },

    // ২. কোড: শর্ট ফর্ম (e.g. "CSE") - ইউজারদের চিনতে সুবিধা হবে
    code: { type: String, required: true, uppercase: true, trim: true },

    institution: {
      type: Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
      index: true,
    },

    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    moderators: [{ type: Schema.Types.ObjectId, ref: "User" }],

    description: { type: String },
    coverImage: { type: String },
    logo: { type: String },
    establishedYear: { type: Number },

    contactEmails: [{ type: String, lowercase: true, trim: true }],
    contactPhones: [{ type: String, trim: true }],
    location: { type: String },

    status: {
      type: String,
      enum: Object.values(DEPT_STATUS),
      default: DEPT_STATUS.ACTIVE,
      index: true,
    },
    postsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ✅ Search Indexes for Text Search
departmentSchema.index(
  {
    name: "text",
    code: "text",
  },
  {
    weights: {
      name: 10, // Higher priority for name matches
      code: 8, // High priority for code matches (CSE, EEE, etc.)
    },
    name: "department_search_text_index",
  }
);

// ✅ Compound Indexes for Filtered Search and Performance
departmentSchema.index({ institution: 1, name: 1 }, { unique: true });
departmentSchema.index({ institution: 1, code: 1 }, { unique: true });
departmentSchema.index({ institution: 1, status: 1 });

export const Department = mongoose.model("Department", departmentSchema);

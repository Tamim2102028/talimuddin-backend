import mongoose, { Schema } from "mongoose";
import {
  POST_TYPES,
  ATTACHMENT_TYPES,
  POST_TARGET_MODELS,
  POST_VISIBILITY,
  POST_STATUS,
} from "../constants/index.js";

const postSchema = new Schema(
  {
    content: {
      type: String,
      trim: true,
      required: true,
      maxLength: 5000,
    },

    attachments: [
      {
        // (image, video, pdf, doc, link)
        type: {
          type: String,
          enum: Object.values(ATTACHMENT_TYPES),
          required: true,
        },
        // url from cloudinary
        url: { type: String, required: true },
        name: { type: String },
        size: { type: Number },
      },
    ],

    // (general, event, poll, link, image, video, pdf, doc)
    type: {
      type: String,
      enum: Object.values(POST_TYPES),
      required: true,
      index: true,
    },

    // Model on which the post is made
    // (User, Group, Page, Branch, Institution, Department, CrCorner)
    postOnModel: {
      type: String,
      required: true,
      enum: Object.values(POST_TARGET_MODELS),
      required: true,
      index: true,
    },
    // Id of the Model where the post is made
    postOnId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "postOnModel",
      index: true,
    },

    // Id of the User who made the post
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // (public, connections, internal, only_me)
    visibility: {
      type: String,
      enum: Object.values(POST_VISIBILITY),
      default: POST_VISIBILITY.PUBLIC,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(POST_STATUS),
      default: POST_STATUS.APPROVED,
      index: true,
    },

    pollOptions: [
      {
        text: { type: String },
        votes: { type: Number, default: 0 },
        voters: [{ type: Schema.Types.ObjectId, ref: "User" }],
      },
    ],
    tags: [{ type: String, trim: true }],

    // Stats
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },

    // Edited status
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },

    // Flags
    isArchived: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ✅ Search Indexes for Text Search
postSchema.index(
  {
    content: "text",
    tags: "text",
  },
  {
    weights: {
      content: 10, // Higher priority for content matches
      tags: 5, // Medium priority for tag matches
    },
    name: "post_search_text_index",
  }
);

// ✅ Compound Indexes for Filtered Search and Performance
postSchema.index({ postOnId: 1, postOnModel: 1, createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1 });
postSchema.index({ author: 1, visibility: 1, isDeleted: 1 });
postSchema.index({ postOnId: 1, status: 1, createdAt: -1 });

export const Post = mongoose.model("Post", postSchema);

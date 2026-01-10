import mongoose, { Schema } from "mongoose";

const commentSchema = new Schema(
  {
    content: { type: String, required: true, trim: true, maxLength: 1000 },
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // Stats
    likesCount: { type: Number, default: 0 },

    // Edit status
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ✅ Search Indexes for Text Search
commentSchema.index(
  {
    content: "text",
  },
  {
    name: "comment_search_text_index",
  }
);

// ✅ Compound Indexes for Performance
commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ post: 1, isDeleted: 1 });

export const Comment = mongoose.model("Comment", commentSchema);

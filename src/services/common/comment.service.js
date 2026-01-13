import { Comment } from "../../models/comment.model.js";
import { Post } from "../../models/post.model.js";
import { ApiError } from "../../utils/ApiError.js";

export const getPostCommentsService = async (
  postId,
  page = 1,
  limit = 10,
  userId
) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // কমেন্ট লিস্ট ফেচ করা (পপুলেট সহ)
  const comments = await Comment.find({
    post: postId,
    isDeleted: false,
  })
    .populate("author", "fullName userName avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const totalComments = await Comment.countDocuments({
    post: postId,
    isDeleted: false,
  });

  // Check if current user liked these comments
  const commentIds = comments.map((c) => c._id);
  const userReactions = await Reaction.find({
    targetId: { $in: commentIds },
    targetModel: REACTION_TARGET_MODELS.COMMENT,
    user: userId,
  });
  const likedCommentIds = new Set(
    userReactions.map((r) => r.targetId.toString())
  );

  // ফরম্যাট করা ডাটা (ফ্রন্টএন্ডের জন্য)
  const formattedComments = comments.map((comment) => ({
    comment: comment,
    meta: {
      isMine: comment.author._id.toString() === userId.toString(),
      isLiked: likedCommentIds.has(comment._id.toString()),
    },
  }));

  return {
    comments: formattedComments,
    pagination: {
      totalDocs: totalComments,
      limit: parseInt(limit),
      page: parseInt(page),
      totalPages: Math.ceil(totalComments / limit),
      hasNextPage: parseInt(page) < Math.ceil(totalComments / limit),
      hasPrevPage: parseInt(page) > 1,
    },
  };
};

export const addCommentService = async (postId, content, userId) => {
  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  const newComment = await Comment.create({
    content,
    post: postId,
    author: userId,
  });

  const comment = await Comment.findById(newComment._id).populate(
    "author",
    "fullName userName avatar"
  );

  // Increment post comment count
  await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

  return {
    comment,
    meta: {
      isMine: true,
      isLiked: false,
    },
  };
};

export const deleteCommentService = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }
  if (comment.isDeleted) {
    throw new ApiError(404, "Comment already deleted");
  }

  // চেক করা যে ইউজার নিজের কমেন্ট ডিলিট করছে কিনা
  if (comment.author.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to delete this comment");
  }

  // Soft Delete
  comment.isDeleted = true;
  await comment.save();

  // Delete all reactions associated with this comment
  await Reaction.deleteMany({
    targetId: commentId,
    targetModel: REACTION_TARGET_MODELS.COMMENT,
  });

  // Decrement post comment count
  await Post.findByIdAndUpdate(comment.post, { $inc: { commentsCount: -1 } });

  return { commentId };
};

export const updateCommentService = async (commentId, content, userId) => {
  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }
  if (comment.isDeleted) {
    throw new ApiError(404, "Comment already deleted");
  }

  if (comment.author.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to update this comment");
  }

  comment.content = content;
  comment.isEdited = true;
  comment.editedAt = new Date();
  await comment.save();

  const updatedComment = await Comment.findById(commentId).populate(
    "author",
    "fullName userName avatar"
  );

  // Check if liked by current user
  const existingReaction = await Reaction.findOne({
    targetId: commentId,
    targetModel: REACTION_TARGET_MODELS.COMMENT,
    user: userId,
  });

  return {
    comment: updatedComment,
    meta: {
      isMine: true,
      isLiked: !!existingReaction,
    },
  };
};

export const toggleCommentLikeService = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }
  if (comment.isDeleted) {
    throw new ApiError(404, "Comment already deleted");
  }

  const existingReaction = await Reaction.findOne({
    targetId: commentId,
    targetModel: REACTION_TARGET_MODELS.COMMENT,
    user: userId,
  });

  let isLiked = false;

  if (existingReaction) {
    await Reaction.findByIdAndDelete(existingReaction._id);
    isLiked = false;
  } else {
    await Reaction.create({
      targetId: commentId,
      targetModel: REACTION_TARGET_MODELS.COMMENT,
      user: userId,
    });
    isLiked = true;
  }

  return { isLiked };
};

import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { User } from "../../models/user.model.js";
import {
  getPostCommentsService,
  addCommentService,
  deleteCommentService,
  updateCommentService,
  toggleCommentLikeService,
} from "../../services/common/comment.service.js";

// Get comments for a post
const getPostComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const { comments, pagination } = await getPostCommentsService(
    postId,
    page,
    limit,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { comments, pagination }, "Comments fetched"));
});

// Add comment
const createComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;

  // Check if user is comment blocked
  const user = await User.findById(req.user._id).select("restrictions");
  if (user?.restrictions?.isCommentBlocked) {
    throw new ApiError(403, "You are restricted from commenting", [
      {
        restrictionType: "comment",
        reason: user.restrictions.commentRestriction?.reason,
        restrictedAt: user.restrictions.commentRestriction?.restrictedAt,
      },
    ]);
  }

  if (!content?.trim()) {
    throw new ApiError(400, "Comment content is required");
  }

  const { comment, meta } = await addCommentService(
    postId,
    content,
    req.user._id
  );

  return res
    .status(201)
    .json(new ApiResponse(201, { comment, meta }, "Comment added"));
});

// Delete comment
const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const { commentId: deletedId } = await deleteCommentService(
    commentId,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { commentId: deletedId }, "Comment deleted"));
});

// Update comment
const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    throw new ApiError(400, "Content is required");
  }

  const { comment, meta } = await updateCommentService(
    commentId,
    content,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { comment, meta }, "Comment updated"));
});

// Toggle Like
const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const { isLiked } = await toggleCommentLikeService(commentId, req.user._id);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isLiked },
        isLiked ? "Comment liked" : "Comment unliked"
      )
    );
});

export {
  getPostComments,
  createComment,
  deleteComment,
  updateComment,
  toggleCommentLike,
};

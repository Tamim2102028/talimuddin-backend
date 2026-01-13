import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  createPostService,
  toggleLikePostService,
  toggleMarkAsReadService,
  deletePostService,
  updatePostService,
  togglePinPostService,
} from "../../services/common/post.service.js";
import { User } from "../../models/user.model.js";
import { Room } from "../../models/room.model.js";
import { POST_TARGET_MODELS } from "../../constants/index.js";

const createPost = asyncHandler(async (req, res) => {
  const { postOnModel, postOnId } = req.body;
  const userId = req.user._id;

  // Check if user is post blocked
  const currentUser = await User.findById(userId).select("restrictions");
  if (currentUser?.restrictions?.isPostBlocked) {
    throw new ApiError(403, "You are restricted from posting", [
      {
        restrictionType: "post",
        reason: currentUser.restrictions.postRestriction?.reason,
        restrictedAt: currentUser.restrictions.postRestriction?.restrictedAt,
      },
    ]);
  }

  if (!postOnModel || !postOnId) {
    throw new ApiError(400, "postOnModel and postOnId are required");
  }

  let result;

  switch (postOnModel) {
    case POST_TARGET_MODELS.USER: {
      // 1. Validation
      if (postOnId.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only post on your own profile");
      }

      // 2. Create Post
      result = await createPostService(req.body, userId);

      // 3. Post-Creation Side Effects
      const userUpdate = await User.findByIdAndUpdate(postOnId, {
        $inc: { postsCount: 1 },
      });
      if (!userUpdate) {
        throw new ApiError(500, "Failed to update user profile posts count");
      }
      break;
    }

    case POST_TARGET_MODELS.GROUP: {
      // 1. Validation (Group Existence & Membership)
      const group = await Group.findById(postOnId);
      if (!group) {
        throw new ApiError(404, "Group not found");
      }

      const membership = await GroupMembership.findOne({
        group: postOnId,
        user: userId,
        status: GROUP_MEMBERSHIP_STATUS.JOINED,
      });

      if (!membership) {
        throw new ApiError(403, "You must be a member to post in this group");
      }

      if (
        membership.role === GROUP_ROLES.MEMBER &&
        group.settings?.allowMemberPosting === false
      ) {
        throw new ApiError(
          403,
          "Posting is disabled for members in this group"
        );
      }

      // 2. Create Post
      result = await createPostService(req.body, userId);

      // 3. Post-Creation Side Effects
      const groupUpdate = await Group.findByIdAndUpdate(postOnId, {
        $inc: { postsCount: 1 },
      });
      if (!groupUpdate) {
        throw new ApiError(500, "Failed to update group posts count");
      }
      break;
    }

    case POST_TARGET_MODELS.DEPARTMENT: {
      // 1. TODO: Department specific validation (if any)

      // 2. Create Post
      result = await createPostService(req.body, userId);

      // 3. Post-Creation Side Effects
      const deptUpdate = await Department.findByIdAndUpdate(postOnId, {
        $inc: { postsCount: 1 },
      });
      if (!deptUpdate) {
        throw new ApiError(500, "Failed to update department posts count");
      }
      break;
    }

    case POST_TARGET_MODELS.INSTITUTION: {
      // 1. TODO: Institution specific validation (if any)

      // 2. Create Post
      result = await createPostService(req.body, userId);

      // 3. Post-Creation Side Effects
      const instUpdate = await Institution.findByIdAndUpdate(postOnId, {
        $inc: { postsCount: 1 },
      });
      if (!instUpdate) {
        throw new ApiError(500, "Failed to update institution posts count");
      }
      break;
    }

    case POST_TARGET_MODELS.ROOM: {
      // 1. TODO: Room specific validation

      // 2. Create Post
      result = await createPostService(req.body, userId);

      // 3. Post-Creation Side Effects (if any)
      break;
    }

    default:
      throw new ApiError(400, "Invalid postOnModel");
  }

  const { post, meta } = result;

  return res
    .status(201)
    .json(new ApiResponse(201, { post, meta }, "Post created successfully"));
});

// Toggle Like
const togglePostLike = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { isLiked, likesCount } = await toggleLikePostService(
    postId,
    req.user._id
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isLiked, likesCount },
        isLiked ? "Post liked" : "Post unliked"
      )
    );
});

// Toggle Mark as Read
const togglePostRead = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { isRead } = await toggleMarkAsReadService(postId, req.user._id);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isRead },
        isRead ? "Marked as read" : "Marked as unread"
      )
    );
});

// Delete Post
const deletePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { postId: deletedPostId } = await deletePostService(
    postId,
    req.user._id
  );

  if (!deletedPostId) {
    throw new ApiError(500, "Deletion failed at service layer");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { postId: deletedPostId },
        "Post deleted successfully"
      )
    );
});

// Update Post
const updatePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { post, meta } = await updatePostService(
    postId,
    req.user._id,
    req.body
  );

  if (!post) {
    throw new ApiError(404, "Post not found or update failed");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { post, meta }, "Post updated successfully"));
});

// Toggle Pin
const togglePostPin = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { post, meta } = await togglePinPostService(postId, req.user._id);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { post, meta },
        post.isPinned ? "Post pinned" : "Post unpinned"
      )
    );
});

export {
  createPost,
  togglePostLike,
  togglePostRead,
  deletePost,
  updatePost,
  togglePostPin,
};

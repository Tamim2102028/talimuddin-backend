import { Post } from "../../models/post.model.js";
import { Comment } from "../../models/comment.model.js";
import { ReadPost } from "../../models/readPost.model.js";
import { User } from "../../models/user.model.js";
import {
  POST_TARGET_MODELS,
  POST_TYPES,
  POST_VISIBILITY,
  POST_STATUS,
} from "../../constants/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { Branch } from "../../models/branch.model.js";

export const createPostService = async (postData, authorId) => {
  const {
    content,
    attachments,
    type,
    postOnModel,
    postOnId,
    visibility,
    pollOptions,
    tags,
  } = postData;

  if (!content || !type || !postOnModel || !postOnId) {
    throw new ApiError(400, "All fields are required");
  }

  if (!Object.values(POST_TYPES).includes(type)) {
    throw new ApiError(400, "Invalid post type");
  }

  if (!Object.values(POST_TARGET_MODELS).includes(postOnModel)) {
    throw new ApiError(400, "Invalid target model");
  }

  if (type === POST_TYPES.POLL) {
    if (!pollOptions || pollOptions.length < 2) {
      throw new ApiError(400, "Poll must have at least 2 options");
    }
  }

  if (postOnModel === POST_TARGET_MODELS.USER) {
    if (visibility === POST_VISIBILITY.INTERNAL) {
      throw new ApiError(
        400,
        `Internal visibility is not allowed for Profile posts`
      );
    }
  } else if (postOnModel === POST_TARGET_MODELS.BRANCH) {
    if (
      visibility !== POST_VISIBILITY.CONNECTIONS &&
      visibility !== POST_VISIBILITY.ONLY_ME
    ) {
      throw new ApiError(
        400,
        `Only "Branch Members" (CONNECTIONS) and "Only me" (ONLY_ME) visibility are allowed for Branch posts`
      );
    }
  } else if (postOnModel === POST_TARGET_MODELS.PAGE) {
    if (visibility === POST_VISIBILITY.INTERNAL) {
      throw new ApiError(
        400,
        `Internal visibility is not allowed for Page posts`
      );
    }
  } else if (postOnModel === POST_TARGET_MODELS.GROUP) {
    if (visibility === POST_VISIBILITY.INTERNAL) {
      throw new ApiError(
        400,
        `Internal visibility is not allowed for Group posts`
      );
    }
  } else if (postOnModel === POST_TARGET_MODELS.CR_CORNER) {
    if (visibility !== POST_VISIBILITY.PUBLIC) {
      throw new ApiError(
        400,
        `Only public visibility is allowed for CR Corner posts`
      );
    }
  }

  // Determine status for group posts
  let initialStatus = POST_STATUS.APPROVED;
  if (postOnModel === POST_TARGET_MODELS.GROUP) {
    const group = await Group.findById(postOnId);
    if (!group) throw new ApiError(404, "Group not found");

    // Check if user is admin/owner (they don't need approval)
    const membership = await GroupMembership.findOne({
      group: postOnId,
      user: authorId,
    });

    const isAdminOrOwner =
      membership &&
      [GROUP_ROLES.OWNER, GROUP_ROLES.ADMIN].includes(membership.role);

    if (group.settings?.requirePostApproval && !isAdminOrOwner) {
      initialStatus = POST_STATUS.PENDING;
    }
  }

  // Create post
  const post = await Post.create({
    content,
    attachments: attachments || [],
    type,
    postOnModel,
    postOnId,
    author: authorId,
    visibility: visibility || POST_VISIBILITY.PUBLIC,
    status: initialStatus,
    pollOptions: pollOptions || [],
    tags: tags || [],
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    isArchived: false,
    isPinned: false,
    isDeleted: false,
  });

  // Only increment post count if approved
  if (initialStatus === POST_STATUS.APPROVED) {
    if (postOnModel === POST_TARGET_MODELS.GROUP) {
      await Group.findByIdAndUpdate(postOnId, { $inc: { postsCount: 1 } });
    } else if (postOnModel === POST_TARGET_MODELS.USER) {
      await User.findByIdAndUpdate(postOnId, { $inc: { postsCount: 1 } });
    } else if (postOnModel === POST_TARGET_MODELS.DEPARTMENT) {
      await Department.findByIdAndUpdate(postOnId, { $inc: { postsCount: 1 } });
    } else if (postOnModel === POST_TARGET_MODELS.INSTITUTION) {
      await Institution.findByIdAndUpdate(postOnId, {
        $inc: { postsCount: 1 },
      });
    } else if (postOnModel === POST_TARGET_MODELS.BRANCH) {
      await Branch.findByIdAndUpdate(postOnId, { $inc: { postsCount: 1 } });
    }
  }

  // Populate author details
  const populatedPost = await Post.findById(post._id).populate(
    "author",
    "fullName avatar userName"
  );

  // Mark as read for author
  await ReadPost.create({
    post: post._id,
    user: authorId,
  });

  // Format response
  const formattedPost = {
    post: populatedPost,
    meta: {
      isLiked: false,
      isSaved: false,
      isMine: true,
      isRead: true,
    },
  };

  return formattedPost;
};

// === Toggle Like Service ===
export const toggleLikePostService = async (postId, userId) => {
  if (!postId) throw new ApiError(400, "Post ID is required to toggle like");

  // Check if post exists
  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(404, `Post with ID ${postId} not found`);
  }
  if (post.isDeleted) {
    throw new ApiError(410, "Cannot like a deleted post");
  }

  // Check if already liked
  const existingReaction = await Reaction.findOne({
    targetId: postId,
    targetModel: REACTION_TARGET_MODELS.POST,
    user: userId,
  });

  let isLiked = false;

  if (existingReaction) {
    // Unlike
    const deletedReaction = await Reaction.findByIdAndDelete(
      existingReaction._id
    );
    if (!deletedReaction) {
      throw new ApiError(500, "Failed to unlike the post. Please try again.");
    }
    isLiked = false;
  } else {
    // Like
    const newReaction = await Reaction.create({
      targetId: postId,
      targetModel: REACTION_TARGET_MODELS.POST,
      user: userId,
    });
    if (!newReaction) {
      throw new ApiError(500, "Failed to like the post. Please try again.");
    }
    isLiked = true;
  }

  // Get updated stats
  const updatedPost = await Post.findById(postId).select("likesCount");
  if (!updatedPost) {
    throw new ApiError(404, "Post was removed during the operation");
  }

  return {
    postId,
    isLiked,
    likesCount: updatedPost.likesCount,
  };
};

// === Toggle Mark as Read Service ===
export const toggleMarkAsReadService = async (postId, userId) => {
  if (!postId)
    throw new ApiError(400, "Post ID is required to toggle read status");

  const post = await Post.exists({ _id: postId, isDeleted: false });
  if (!post) {
    throw new ApiError(404, "Post not found or has been deleted");
  }

  // Check if already read
  const existingRead = await ReadPost.findOne({
    post: postId,
    user: userId,
  });

  if (existingRead) {
    // Mark as unread
    const deletedRead = await existingRead.deleteOne();
    if (!deletedRead) {
      throw new ApiError(500, "Failed to mark post as unread");
    }
    return {
      targetId: postId,
      isRead: false,
    };
  } else {
    // Mark as read
    const newRead = await ReadPost.create({
      post: postId,
      user: userId,
    });
    if (!newRead) {
      throw new ApiError(500, "Failed to mark post as read");
    }
    return {
      targetId: postId,
      isRead: true,
    };
  }
};

// === Delete Post Service ===
export const deletePostService = async (postId, userId) => {
  const post = await Post.findById(postId);

  if (!post) {
    throw new ApiError(404, `Post not found with ID: ${postId}`);
  }
  if (post.isDeleted) {
    throw new ApiError(410, "Post has already been deleted.");
  }

  // Check authorization
  const isAuthor = post.author.toString() === userId.toString();

  // For group posts, check if user is owner or admin
  let isGroupAdminOrOwner = false;
  if (post.postOnModel === POST_TARGET_MODELS.GROUP) {
    const membership = await GroupMembership.findOne({
      group: post.postOnId,
      user: userId,
      role: { $in: [GROUP_ROLES.OWNER, GROUP_ROLES.ADMIN] },
    });
    isGroupAdminOrOwner = !!membership;
  }

  // Allow delete if user is author OR (for group posts) if user is admin/owner
  if (!isAuthor && !isGroupAdminOrOwner) {
    throw new ApiError(403, "You are not authorized to delete this post");
  }

  // 1. Soft delete all comments of this post
  const comments = await Comment.find({ post: postId });
  const commentIds = comments.map((c) => c._id);

  if (commentIds.length > 0) {
    // Soft delete comments
    await Comment.updateMany(
      { _id: { $in: commentIds } },
      { $set: { isDeleted: true } }
    );

    // 2. Delete reactions on these comments
    await Reaction.deleteMany({
      targetId: { $in: commentIds },
      targetModel: REACTION_TARGET_MODELS.COMMENT,
    });
  }

  // 3. Delete reactions on the post itself
  await Reaction.deleteMany({
    targetId: postId,
    targetModel: REACTION_TARGET_MODELS.POST,
  });

  // 4. Update postsCount for the target model
  if (post.postOnId) {
    try {
      if (post.postOnModel === POST_TARGET_MODELS.GROUP) {
        await Group.findByIdAndUpdate(post.postOnId, {
          $inc: { postsCount: -1 },
        });
      } else if (post.postOnModel === POST_TARGET_MODELS.USER) {
        await User.findByIdAndUpdate(post.postOnId, {
          $inc: { postsCount: -1 },
        });
      } else if (post.postOnModel === POST_TARGET_MODELS.DEPARTMENT) {
        await Department.findByIdAndUpdate(post.postOnId, {
          $inc: { postsCount: -1 },
        });
      } else if (post.postOnModel === POST_TARGET_MODELS.INSTITUTION) {
        await Institution.findByIdAndUpdate(post.postOnId, {
          $inc: { postsCount: -1 },
        });
      } else if (post.postOnModel === POST_TARGET_MODELS.BRANCH) {
        await Branch.findByIdAndUpdate(post.postOnId, {
          $inc: { postsCount: -1 },
        });
      }
    } catch (error) {
      throw new ApiError(
        500,
        error?.message || "Failed to update postsCount for the target model"
      );
    }
  }

  // Soft delete post
  post.isDeleted = true;
  await post.save();

  return { postId };
};

// === Update Post Service ===
export const updatePostService = async (postId, userId, updateData) => {
  const { content, visibility, tags } = updateData;

  const post = await Post.findById(postId);

  if (!post) {
    throw new ApiError(404, `Post not found with ID: ${postId}`);
  }

  // Check authorization
  if (post.author.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to update this post");
  }

  if (post.isDeleted) {
    throw new ApiError(
      410,
      "This post has been deleted and cannot be updated."
    );
  }

  // For group posts, check if user is still a member
  if (post.postOnModel === POST_TARGET_MODELS.GROUP) {
    const membership = await GroupMembership.findOne({
      group: post.postOnId,
      user: userId,
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
    });

    if (!membership) {
      throw new ApiError(
        403,
        "You must be a member of this group to edit your post"
      );
    }
  }

  // Validate visibility if provided (before checking if it changed)
  if (visibility !== undefined) {
    // Validate visibility based on post target model
    if (post.postOnModel === POST_TARGET_MODELS.USER) {
      if (visibility === POST_VISIBILITY.INTERNAL) {
        throw new ApiError(
          400,
          `Internal visibility is not allowed for Profile posts`
        );
      }
    } else if (post.postOnModel === POST_TARGET_MODELS.BRANCH) {
      if (
        visibility !== POST_VISIBILITY.CONNECTIONS &&
        visibility !== POST_VISIBILITY.ONLY_ME
      ) {
        throw new ApiError(
          400,
          `Only "Branch Members" (CONNECTIONS) and "Only me" (ONLY_ME) visibility are allowed for Branch posts`
        );
      }
    } else if (post.postOnModel === POST_TARGET_MODELS.PAGE) {
      if (visibility === POST_VISIBILITY.INTERNAL) {
        throw new ApiError(
          400,
          `Internal visibility is not allowed for Page posts`
        );
      }
    } else if (post.postOnModel === POST_TARGET_MODELS.GROUP) {
      if (visibility === POST_VISIBILITY.INTERNAL) {
        throw new ApiError(
          400,
          `Internal visibility is not allowed for Group posts`
        );
      }
    } else if (post.postOnModel === POST_TARGET_MODELS.CR_CORNER) {
      if (visibility !== POST_VISIBILITY.PUBLIC) {
        throw new ApiError(
          400,
          `Only public visibility is allowed for CR Corner posts`
        );
      }
    }
  }

  // Update fields
  let isContentChanged = false;

  if (content !== undefined && content !== post.content) {
    post.content = content;
    isContentChanged = true;
  }
  if (visibility !== undefined && visibility !== post.visibility) {
    post.visibility = visibility;
    // Visibility change shouldn't mark post as edited
  }
  if (
    tags !== undefined &&
    JSON.stringify(tags) !== JSON.stringify(post.tags)
  ) {
    post.tags = tags;
    // Tags change shouldn't mark post as edited
  }

  if (isContentChanged) {
    post.isEdited = true;
    post.editedAt = new Date();
  }

  await post.save();

  // Return updated post with author details
  const updatedPostObj = await Post.findById(postId).populate(
    "author",
    "fullName avatar userName"
  );

  if (!updatedPostObj) {
    throw new ApiError(404, "Post was lost during update operation");
  }

  // Check like status
  const existingReaction = await Reaction.findOne({
    targetId: postId,
    targetModel: REACTION_TARGET_MODELS.POST,
    user: userId,
  });

  return {
    post: updatedPostObj,
    meta: {
      isLiked: !!existingReaction,
      isSaved: false,
      isMine: true,
      isRead: true,
    },
  };
};

// === Toggle Pin Post Service (Group only, Admin/Owner only) ===
export const togglePinPostService = async (postId, userId) => {
  const post = await Post.findById(postId);

  if (!post) {
    throw new ApiError(404, `Post not found for pinning (ID: ${postId})`);
  }

  if (post.isDeleted) {
    throw new ApiError(410, "Cannot pin a deleted post.");
  }

  // Only group posts can be pinned in this implementation
  if (post.postOnModel !== POST_TARGET_MODELS.GROUP) {
    throw new ApiError(400, "Pinning is only supported for group posts");
  }

  // Check authorization based on model
  if (post.postOnModel === POST_TARGET_MODELS.GROUP) {
    const membership = await GroupMembership.findOne({
      group: post.postOnId,
      user: userId,
      role: { $in: [GROUP_ROLES.OWNER, GROUP_ROLES.ADMIN] },
    });
    if (!membership) {
      throw new ApiError(
        403,
        "You are not authorized to pin/unpin posts in this group"
      );
    }
  } else if (post.postOnModel === POST_TARGET_MODELS.USER) {
    // Only profile owner can pin their own posts
    if (post.postOnId.toString() !== userId.toString()) {
      throw new ApiError(403, "You can only pin posts on your own profile");
    }
  } else if (
    [POST_TARGET_MODELS.DEPARTMENT, POST_TARGET_MODELS.INSTITUTION].includes(
      post.postOnModel
    )
  ) {
    // TODO: Add admin check for Dept/Institution if needed
    // For now, allow pinning if it's the post author or we can add specific admin logic later
    if (post.author.toString() !== userId.toString()) {
      throw new ApiError(403, "Unauthorized to pin this post");
    }
  }

  // Toggle pinned flag
  post.isPinned = !post.isPinned;
  const savedPost = await post.save();
  if (!savedPost) {
    throw new ApiError(500, "Failed to save the pinned status");
  }

  // Return updated post with author populated and minimal meta
  const updatedPostObj = await Post.findById(postId).populate(
    "author",
    "fullName avatar userName"
  );

  // Check like status
  const existingReaction = await Reaction.findOne({
    targetId: postId,
    targetModel: REACTION_TARGET_MODELS.POST,
    user: userId,
  });

  return {
    post: updatedPostObj,
    meta: {
      isLiked: !!existingReaction,
      isSaved: false,
      isMine: post.author.toString() === userId.toString(),
      isRead: false,
    },
  };
};

import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { ReadPost } from "../models/readPost.model.js";
import { POST_TARGET_MODELS, POST_VISIBILITY } from "../constants/index.js";
import { ApiError } from "../utils/ApiError.js";

// === Get User Profile Posts Service ===
export const getUserProfilePostsService = async (
  username,
  currentUserId,
  queryParams
) => {
  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 10;
  const skip = (page - 1) * limit;

  // Find target user
  const targetUser = await User.findOne({ userName: username }).select("_id");
  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  const isOwnProfile = currentUserId?.toString() === targetUser._id.toString();

  // Build visibility query
  let visibilityQuery = {
    postOnId: targetUser._id,
    postOnModel: POST_TARGET_MODELS.USER,
    isDeleted: false,
    isArchived: false,
  };

  if (isOwnProfile) {
    // Own Profile: See everything
  } else {
    // Visitor: See only Public posts
    visibilityQuery.visibility = POST_VISIBILITY.PUBLIC;
  }

  // Fetch posts with pagination
  const posts = await Post.find(visibilityQuery)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("author", "fullName avatar userName")
    .lean();

  // Add context (isLiked, isSaved, isRead)
  let viewedPostIds = new Set();
  let likedPostIds = new Set();
  const postIds = posts.map((p) => p._id);

  if (currentUserId && posts.length > 0) {
    // Fetch read status
    const viewedPosts = await ReadPost.find({
      user: currentUserId,
      post: { $in: postIds },
    }).select("post");

    viewedPostIds = new Set(viewedPosts.map((vp) => vp.post.toString()));
  }

  // Format posts with context
  const postsWithContext = posts.map((post) => ({
    post,
    meta: {
      isSaved: false, // TODO: Check if currentUser saved this post
      isMine: isOwnProfile,
      isRead: viewedPostIds.has(post._id.toString()),
    },
  }));

  // Count total documents for pagination
  const totalDocs = await Post.countDocuments(visibilityQuery);
  const totalPages = Math.ceil(totalDocs / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    posts: postsWithContext,
    pagination: {
      totalDocs,
      limit,
      page,
      totalPages,
      hasNextPage,
      hasPrevPage,
    },
  };
};

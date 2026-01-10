import { Post } from "../models/post.model.js";
import { ReadPost } from "../models/readPost.model.js";
import { Reaction } from "../models/reaction.model.js";
import { POST_TARGET_MODELS, REACTION_TARGET_MODELS } from "../constants/index.js";

export const getCrFeedService = async (
  crCornerId,
  userId,
  page = 1,
  limit = 10
) => {
  const skip = (page - 1) * limit;

  // Query Posts
  const query = {
    postOnModel: POST_TARGET_MODELS.CR_CORNER,
    postOnId: crCornerId,
    isDeleted: false,
    isArchived: false,
  };

  const posts = await Post.find(query)
    .sort({ createdAt: -1 }) // Latest first
    .skip(skip)
    .limit(Number(limit))
    .populate("author", "fullName avatar userName")
    .lean();

  // Add Context (Like, Read, Mine)
  let viewedPostIds = new Set();
  let likedPostIds = new Set();
  const postIds = posts.map((p) => p._id);

  if (userId && posts.length > 0) {
    const viewedPosts = await ReadPost.find({
      user: userId,
      post: { $in: postIds },
    }).select("post");
    viewedPostIds = new Set(viewedPosts.map((vp) => vp.post.toString()));

    const likedPosts = await Reaction.find({
      user: userId,
      targetModel: REACTION_TARGET_MODELS.POST,
      targetId: { $in: postIds },
    }).select("targetId");
    likedPostIds = new Set(likedPosts.map((r) => r.targetId.toString()));
  }

  const postsWithContext = posts.map((post) => ({
    post,
    meta: {
      isLiked: likedPostIds.has(post._id.toString()),
      isSaved: false,
      isMine: post.author._id.toString() === userId.toString(),
      isRead: viewedPostIds.has(post._id.toString()),
    },
  }));

  const totalDocs = await Post.countDocuments(query);
  const totalPages = Math.ceil(totalDocs / limit);

  return {
    posts: postsWithContext,
    pagination: {
      totalDocs,
      limit: Number(limit),
      page: Number(page),
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { POST_TARGET_MODELS, POST_TYPES } from "../constants/index.js";
import { createPostService } from "../services/common/post.service.js";
import { getCrFeedService } from "../services/cr.service.js";

// 🚀 1. GET CR FEED
const getCrFeed = asyncHandler(async (req, res) => {
  // CR Corner is based on user's department
  const crCornerId = req.user.academicInfo?.department;

  if (!crCornerId) {
    throw new ApiError(400, "User does not belong to any department");
  }

  const { page = 1, limit = 10 } = req.query;

  const { posts, pagination } = await getCrFeedService(
    crCornerId,
    req.user._id,
    page,
    limit
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, { posts, pagination }, "CR Corner feed fetched")
    );
});

// 🚀 2. CREATE CR NOTICE
const createCrPost = asyncHandler(async (req, res) => {
  const { content } = req.body;

  const crCornerId = req.user.academicInfo?.department;

  if (!crCornerId) {
    throw new ApiError(400, "User does not belong to any department");
  }

  const postData = {
    ...req.body,
    content,
    type: POST_TYPES.NOTICE, // CR posts are notices
    postOnModel: POST_TARGET_MODELS.CR_CORNER,
    postOnId: crCornerId,
  };

  const { post, meta } = await createPostService(postData, req.user._id);

  return res
    .status(201)
    .json(new ApiResponse(201, { post, meta }, "Notice posted in CR Corner"));
});

export { getCrFeed, createCrPost };

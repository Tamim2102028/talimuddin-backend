import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getUserProfilePostsService } from "../services/profile.service.js";
import {
  updateUserAvatarService,
  updateUserCoverImageService,
  updateAccountDetailsService,
  getUserProfileHeaderService,
  getUserDetailsService,
} from "../services/auth.service.js";

// -----------------------------
// Profile Posts
// -----------------------------
const getUserProfilePosts = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const { posts, pagination } = await getUserProfilePostsService(
    username,
    req.user?._id,
    req.query
  );
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { posts, pagination },
        "User posts fetched successfully"
      )
    );
});

// -----------------------------
// Profile Updates / Onboarding (moved)
// -----------------------------

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  const { user } = await updateUserAvatarService(req.user._id, avatarLocalPath);
  return res
    .status(200)
    .json(new ApiResponse(200, { user }, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  const { user } = await updateUserCoverImageService(
    req.user._id,
    coverImageLocalPath
  );
  return res
    .status(200)
    .json(new ApiResponse(200, { user }, "Cover image updated successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { user } = await updateAccountDetailsService(req.user._id, req.body);
  return res
    .status(200)
    .json(
      new ApiResponse(200, { user }, "Account details updated successfully")
    );
});

// -----------------------------
// Public Profile Views (moved)
// -----------------------------
const getUserProfileHeader = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const { user, meta } = await getUserProfileHeaderService(
    username,
    req.user?._id
  );
  return res
    .status(200)
    .json(
      new ApiResponse(200, { user, meta }, "User profile fetched successfully")
    );
});

const getUserDetails = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const { user } = await getUserDetailsService(username);
  return res
    .status(200)
    .json(new ApiResponse(200, { user }, "User details fetched successfully"));
});

export {
  getUserProfilePosts,
  updateUserAvatar,
  updateUserCoverImage,
  updateAccountDetails,
  getUserProfileHeader,
  getUserDetails,
};

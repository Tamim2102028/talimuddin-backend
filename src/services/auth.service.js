import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadFile, deleteFile } from "../utils/cloudinaryFileUpload.js";
import {
  USER_TYPES,
  POST_TARGET_MODELS,
  POST_VISIBILITY,
  GENDERS,
} from "../constants/index.js";
import jwt from "jsonwebtoken";

// --- Utility: Token Generator ---
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("JWT Generation Error:", error);
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

// ==========================================
// 🚀 1. REGISTER USER SERVICE
// ==========================================
export const registerUserService = async (userData) => {
  const { fullName, phoneNumber, password, userName, gender, agreeToTerms } =
    userData;

  const existedUser = await User.findOne({
    $or: [{ phoneNumber }, { userName }],
  });

  if (existedUser) {
    throw new ApiError(
      409,
      "User with this phone number or username already exists"
    );
  }

  // Gender-based default avatar
  const defaultAvatar =
    gender === GENDERS.FEMALE
      ? "https://res.cloudinary.com/dr7xx5ch4/image/upload/v1768286667/girl_rok2ob.png"
      : "https://res.cloudinary.com/dr7xx5ch4/image/upload/v1768285953/u6eqtyialvxv1oaaymti.png";

  const defultCoverImage =
    "https://res.cloudinary.com/dr7xx5ch4/image/upload/v1768286305/e7hunutkggs4ewvvfuzk.png";

  const userPayload = {
    fullName,
    phoneNumber,
    password,
    userName,
    gender,
    userType: USER_TYPES.NORMAL, // Always set to "normal" by default
    avatar: defaultAvatar,
    coverImage: defultCoverImage,
    agreedToTerms: agreeToTerms,
    termsAgreedAt: new Date(),
  };

  const user = await User.create(userPayload);
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // Token generation
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  return { user: createdUser, accessToken, refreshToken };
};

// ==========================================
// 🚀 2. LOGIN USER SERVICE
// ==========================================
export const loginUserService = async ({ phoneNumber, password }) => {
  if (!phoneNumber) {
    throw new ApiError(400, "Phone number is required");
  }

  const user = await User.findOne({ phoneNumber });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return { user: loggedInUser, accessToken, refreshToken };
};

// ==========================================
// 🚀 3. LOGOUT USER SERVICE
// ==========================================
export const logoutUserService = async (userId) => {
  await User.findByIdAndUpdate(
    userId,
    { $unset: { refreshToken: 1 } },
    { new: true }
  );
  return {};
};

// ==========================================
// 🚀 4. REFRESH TOKEN SERVICE
// ==========================================
export const refreshAccessTokenService = async (incomingRefreshToken) => {
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);

    if (!user || incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return { accessToken, refreshToken: newRefreshToken };
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
};

// ==========================================
// 🚀 5. CHANGE PASSWORD SERVICE
// ==========================================
export const changePasswordService = async (
  userId,
  oldPassword,
  newPassword
) => {
  const user = await User.findById(userId);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  user.passwordChangedAt = Date.now();
  await user.save({ validateBeforeSave: false });

  return {};
};

// ==========================================
// 🚀 8. UPDATE AVATAR SERVICE
// ==========================================
export const updateUserAvatarService = async (userId, avatarLocalPath) => {
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  // Get user to check old avatar
  const existingUser = await User.findById(userId);
  if (!existingUser) {
    throw new ApiError(404, "User not found");
  }

  const avatar = await uploadFile(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(500, "Error uploading avatar");
  }

  // Delete old avatar from Cloudinary if exists
  if (existingUser.avatar && existingUser.avatar.includes("cloudinary")) {
    const publicId = existingUser.avatar.split("/").pop().split(".")[0];
    await deleteFile(publicId);
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { avatar: avatar.url } },
    { new: true }
  ).select("-password");

  return { user };
};

// ==========================================
// 🚀 9. UPDATE COVER IMAGE SERVICE
// ==========================================
export const updateUserCoverImageService = async (
  userId,
  coverImageLocalPath
) => {
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }

  // Get user to check old cover image
  const existingUser = await User.findById(userId);
  if (!existingUser) {
    throw new ApiError(404, "User not found");
  }

  const coverImage = await uploadFile(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(500, "Error uploading cover image");
  }

  // Delete old cover image from Cloudinary if exists
  if (
    existingUser.coverImage &&
    existingUser.coverImage.includes("cloudinary")
  ) {
    const publicId = existingUser.coverImage.split("/").pop().split(".")[0];
    await deleteFile(publicId);
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { coverImage: coverImage.url } },
    { new: true }
  ).select("-password");

  return { user };
};

// ==========================================
// 🚀 10. UPDATE ACCOUNT DETAILS SERVICE
// ==========================================
export const updateAccountDetailsService = async (userId, updateData) => {
  if (updateData.userName) {
    throw new ApiError(400, "Username cannot be changed.");
  }

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, "At least one field is required to update");
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true }
  ).select("-password -refreshToken");

  return { user };
};

// ==========================================
// 🚀 11. GET USER PROFILE HEADER SERVICE
// ==========================================
export const getUserProfileHeaderService = async (
  targetUsername,
  currentUserId
) => {
  if (!targetUsername) {
    throw new ApiError(400, "Username is required");
  }

  const user = await User.findOne({ userName: targetUsername }).select(
    "-password -refreshToken"
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isSelf =
    currentUserId && currentUserId.toString() === user._id.toString();

  return {
    user,
    meta: {
      isOwnProfile: isSelf,
    },
  };
};

// ==========================================
// 🚀 12. GET USER DETAILS SERVICE
// ==========================================
export const getUserDetailsService = async (username) => {
  const user = await User.findOne({ userName: username }).select(
    "-password -refreshToken"
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return { user };
};

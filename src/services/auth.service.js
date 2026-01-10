import { User } from "../models/user.model.js";
import { Friendship } from "../models/friendship.model.js";
import { Follow } from "../models/follow.model.js";
import { Post } from "../models/post.model.js";
import { Institution } from "../models/institution.model.js";
import { Department } from "../models/department.model.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadFile, deleteFile } from "../utils/cloudinaryFileUpload.js";
import { findInstitutionByEmailDomain } from "./academic.service.js";
import {
  USER_TYPES,
  PROFILE_RELATION_STATUS,
  POST_TARGET_MODELS,
  POST_VISIBILITY,
  FRIENDSHIP_STATUS,
  FOLLOW_TARGET_MODELS,
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
  const { fullName, email, password, userName, userType, agreeToTerms } =
    userData;

  const existedUser = await User.findOne({ $or: [{ email }, { userName }] });
  if (existedUser) {
    throw new ApiError(409, "User with this email or username already exists");
  }

  if ([USER_TYPES.ADMIN, USER_TYPES.OWNER].includes(userType)) {
    throw new ApiError(403, "Restricted user type.");
  }

  // 3. Check for institution using email domain
  const institution = await findInstitutionByEmailDomain(email);

  // 5. Create User Payload with conditional institution linking
  const userPayload = {
    fullName,
    email,
    password,
    userName,
    userType,
    agreedToTerms: agreeToTerms, // Backend এ সেভ করছি
    termsAgreedAt: new Date(), // রাজি হওয়ার সঠিক সময় টি সেভ করে রাখছি
    // Default values
    isStudentEmail: false,
  };

  // If an institution was found, link it to the user

  if (institution) {
    userPayload.isStudentEmail = true;
    userPayload.institution = institution._id;
    userPayload.institutionType = institution.type;
  }

  const user = await User.create(userPayload);
  const createdUser = await User.findById(user._id)
    .select("-password -refreshToken")
    .populate("institution", "name code logo")
    .populate("academicInfo.department", "name code logo");

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
export const loginUserService = async ({ email, userName, password }) => {
  if (!email && !userName) {
    throw new ApiError(400, "Username or email is required");
  }

  const user = await User.findOne({
    $or: [{ email }, { userName }],
  });

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

  const loggedInUser = await User.findById(user._id)
    .select("-password -refreshToken")
    .populate("institution", "name code logo")
    .populate("academicInfo.department", "name code logo");

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
// 🚀 7. UPDATE ACADEMIC PROFILE SERVICE
// ==========================================
export const updateAcademicProfileService = async (
  userId,
  userType,
  updateData
) => {
  const {
    institution: institutionId,
    department: departmentId,
    session,
    section,
    studentId,
    teacherId,
    rank,
    officeHours,
  } = updateData;

  const existingUser = await User.findById(userId);
  if (!existingUser) throw new ApiError(404, "User not found");

  // Verify and set Institution
  let effectiveInstitution = existingUser.institution;
  if (institutionId) {
    const inst = await Institution.findById(institutionId);
    if (!inst)
      throw new ApiError(404, "Institution not found with provided ID");
    effectiveInstitution = institutionId;
  }

  // Verify and set Department
  let effectiveDepartment = existingUser.academicInfo?.department;
  if (departmentId) {
    const dept = await Department.findById(departmentId);
    if (!dept) throw new ApiError(404, "Department not found with provided ID");
    effectiveDepartment = departmentId;
  }

  if (!effectiveInstitution || !effectiveDepartment) {
    throw new ApiError(400, "Institution and Department are required");
  }

  let academicInfoPayload = {
    ...(existingUser.academicInfo ? existingUser.academicInfo.toObject() : {}),
    department: effectiveDepartment,
  };

  if (userType === USER_TYPES.STUDENT) {
    if (session) academicInfoPayload.session = session;
    if (section !== undefined) academicInfoPayload.section = section;
    if (studentId !== undefined) academicInfoPayload.studentId = studentId;
  } else if (userType === USER_TYPES.TEACHER) {
    if (teacherId !== undefined) academicInfoPayload.teacherId = teacherId;
    if (rank !== undefined) academicInfoPayload.rank = rank;
    if (officeHours !== undefined)
      academicInfoPayload.officeHours = officeHours;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        institution: effectiveInstitution,
        academicInfo: academicInfoPayload,
      },
    },
    { new: true }
  )
    .populate("institution", "name code logo")
    .populate("academicInfo.department", "name code logo")
    .select("-password -refreshToken");

  return { user };
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
  )
    .populate("institution", "name code logo")
    .populate("academicInfo.department", "name code logo")
    .select("-password");

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
  )
    .populate("institution", "name code logo")
    .populate("academicInfo.department", "name code logo")
    .select("-password");

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
  )
    .populate("institution", "name code logo")
    .populate("academicInfo.department", "name code logo")
    .select("-password -refreshToken");

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

  const user = await User.findOne({ userName: targetUsername })
    .select("-password -refreshToken")
    .populate("institution", "name code logo")
    .populate("academicInfo.department", "name code logo");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isSelf =
    currentUserId && currentUserId.toString() === user._id.toString();
  let relationStatus = null;
  let isFollowing = false;
  let isBlockedByMe = false;
  let isBlockedByTarget = false;

  if (isSelf) {
  } else if (currentUserId) {
    // Friendship Status
    const friendship = await Friendship.findOne({
      $or: [
        { requester: currentUserId, recipient: user._id },
        { requester: user._id, recipient: currentUserId },
      ],
    });

    if (friendship) {
      if (friendship.status === FRIENDSHIP_STATUS.ACCEPTED) {
        relationStatus = PROFILE_RELATION_STATUS.FRIEND;
      } else if (friendship.status === FRIENDSHIP_STATUS.BLOCKED) {
        relationStatus = PROFILE_RELATION_STATUS.BLOCKED;
        if (friendship.requester.toString() === currentUserId.toString()) {
          isBlockedByMe = true;
        } else {
          isBlockedByTarget = true;
        }
      } else if (friendship.status === FRIENDSHIP_STATUS.PENDING) {
        if (friendship.requester.toString() === currentUserId.toString()) {
          relationStatus = PROFILE_RELATION_STATUS.REQUEST_SENT;
        } else {
          relationStatus = PROFILE_RELATION_STATUS.REQUEST_RECEIVED;
        }
      }
    }

    // Follow Status
    const follow = await Follow.findOne({
      follower: currentUserId,
      following: user._id,
      followingModel: FOLLOW_TARGET_MODELS.USER,
    });
    if (follow) isFollowing = true;
  }

  return {
    user,
    meta: {
      profile_relation_status: relationStatus,
      isFollowing,
      isBlockedByMe,
      isBlockedByTarget,
      isOwnProfile: isSelf,
    },
  };
};

// ==========================================
// 🚀 12. GET USER DETAILS SERVICE
// ==========================================
export const getUserDetailsService = async (username) => {
  const user = await User.findOne({ userName: username })
    .select("-password -refreshToken")
    .populate([
      { path: "institution", select: "name code logo" },
      { path: "academicInfo.department", select: "name code logo" },
    ]);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return { user };
};

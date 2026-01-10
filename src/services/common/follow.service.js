import { Follow } from "../../models/follow.model.js";
import { User } from "../../models/user.model.js";
import { Institution } from "../../models/institution.model.js";
import { Department } from "../../models/department.model.js";
import { Friendship } from "../../models/friendship.model.js";
import {
  FOLLOW_TARGET_MODELS,
  FRIENDSHIP_STATUS,
} from "../../constants/index.js";
import { ApiError } from "../../utils/ApiError.js";

export const toggleFollowService = async (
  targetId,
  targetModel,
  currentUserId
) => {
  // 1. Validate Target Model
  if (!Object.values(FOLLOW_TARGET_MODELS).includes(targetModel)) {
    throw new ApiError(400, "Invalid target model");
  }

  // 2. Prevent Self-Follow (Only for User)
  if (
    targetModel === FOLLOW_TARGET_MODELS.USER &&
    targetId === currentUserId.toString()
  ) {
    throw new ApiError(400, "You cannot follow yourself");
  }

  // 2.1 Block Check (Only for User)
  if (targetModel === FOLLOW_TARGET_MODELS.USER) {
    const blockRelation = await Friendship.findOne({
      $or: [
        { requester: currentUserId, recipient: targetId },
        { requester: targetId, recipient: currentUserId },
      ],
      status: FRIENDSHIP_STATUS.BLOCKED,
    });

    if (blockRelation) {
      if (blockRelation.requester.toString() === currentUserId.toString()) {
        throw new ApiError(400, "You have blocked this user. Unblock first.");
      } else {
        throw new ApiError(400, "You are blocked by this user");
      }
    }
  }

  // 3. Check if Target Exists
  let targetExists = null;

  switch (targetModel) {
    case FOLLOW_TARGET_MODELS.USER:
      targetExists = await User.findById(targetId);
      break;
    case FOLLOW_TARGET_MODELS.INSTITUTION:
      targetExists = await Institution.findById(targetId);
      break;
    case FOLLOW_TARGET_MODELS.DEPARTMENT:
      targetExists = await Department.findById(targetId);
      break;
    // TODO: Add Page model check when ready
    case FOLLOW_TARGET_MODELS.PAGE:
      // targetExists = await Page.findById(targetId);
      break;
    default:
      throw new ApiError(400, "Invalid model type");
  }

  if (!targetExists) {
    throw new ApiError(404, `${targetModel} not found`);
  }

  // 4. Check Existing Follow
  const existingFollow = await Follow.findOne({
    follower: currentUserId,
    following: targetId,
    followingModel: targetModel,
  });

  // 5. Toggle Logic (Follow/Unfollow)
  if (existingFollow) {
    // UNFOLLOW
    await Follow.findByIdAndDelete(existingFollow._id);

    // ✅ Update counts only if target is a User
    if (targetModel === FOLLOW_TARGET_MODELS.USER) {
      const followingUpdate = await User.findByIdAndUpdate(currentUserId, {
        $inc: { followingCount: -1 },
      });
      if (!followingUpdate) {
        throw new ApiError(500, "Failed to update your following count");
      }
      const followerUpdate = await User.findByIdAndUpdate(targetId, {
        $inc: { followersCount: -1 },
      });
      if (!followerUpdate) {
        throw new ApiError(500, "Failed to update target's followers count");
      }
    }

    return { isFollowing: false };
  } else {
    // FOLLOW
    await Follow.create({
      follower: currentUserId,
      following: targetId,
      followingModel: targetModel,
    });

    // ✅ Update counts only if target is a User
    if (targetModel === FOLLOW_TARGET_MODELS.USER) {
      const followingUpdate = await User.findByIdAndUpdate(currentUserId, {
        $inc: { followingCount: 1 },
      });
      if (!followingUpdate) {
        throw new ApiError(500, "Failed to update your following count");
      }
      const followerUpdate = await User.findByIdAndUpdate(targetId, {
        $inc: { followersCount: 1 },
      });
      if (!followerUpdate) {
        throw new ApiError(500, "Failed to update target's followers count");
      }
    }

    return { isFollowing: true };
  }
};

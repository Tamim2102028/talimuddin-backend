import { Friendship } from "../models/friendship.model.js";
import { User } from "../models/user.model.js";
import { Follow } from "../models/follow.model.js";
import { ApiError } from "../utils/ApiError.js";
import {
  FRIENDSHIP_STATUS,
  PROFILE_RELATION_STATUS,
  FOLLOW_TARGET_MODELS,
} from "../constants/index.js";
import { mapUserToResponse } from "../utils/responseMappers.js";

// ==========================================
// 🚀 1. GET FRIENDS LIST SERVICE
// ==========================================
export const getFriendsListService = async (currentUserId, queryParams) => {
  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 10;
  const skip = (page - 1) * limit;

  const query = {
    $or: [{ requester: currentUserId }, { recipient: currentUserId }],
    status: FRIENDSHIP_STATUS.ACCEPTED,
  };

  const totalDocs = await Friendship.countDocuments(query);
  const friendships = await Friendship.find(query)
    .populate({
      path: "requester recipient",
      select: "fullName userName avatar academicInfo userType institution",
      populate: [
        { path: "institution", select: "name" },
        { path: "academicInfo.department", select: "name" },
      ],
    })
    .skip(skip)
    .limit(limit);

  const friends = friendships
    .map((f) => {
      if (!f.requester || !f.recipient) return null;

      const isRequester =
        f.requester._id.toString() === currentUserId.toString();
      const friend = isRequester ? f.recipient : f.requester;
      return mapUserToResponse(friend, PROFILE_RELATION_STATUS.FRIEND, f._id);
    })
    .filter(Boolean);

  const totalPages = Math.ceil(totalDocs / limit);

  return {
    users: friends,
    pagination: {
      totalDocs,
      limit,
      page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

// ==========================================
// 🚀 2. GET RECEIVED REQUESTS SERVICE
// ==========================================
export const getReceivedRequestsService = async (
  currentUserId,
  queryParams
) => {
  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 10;
  const skip = (page - 1) * limit;

  const query = {
    recipient: currentUserId,
    status: FRIENDSHIP_STATUS.PENDING,
  };

  const totalDocs = await Friendship.countDocuments(query);
  const requests = await Friendship.find(query)
    .populate({
      path: "requester",
      select: "fullName userName avatar academicInfo userType institution",
      populate: [
        { path: "institution", select: "name" },
        { path: "academicInfo.department", select: "name" },
      ],
    })
    .skip(skip)
    .limit(limit);

  const formattedRequests = requests
    .map((req) => {
      if (!req.requester) return null;
      return mapUserToResponse(
        req.requester,
        PROFILE_RELATION_STATUS.REQUEST_RECEIVED,
        req._id
      );
    })
    .filter(Boolean);

  const totalPages = Math.ceil(totalDocs / limit);

  return {
    users: formattedRequests,
    pagination: {
      totalDocs,
      limit,
      page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

// ==========================================
// 🚀 3. GET SENT REQUESTS SERVICE
// ==========================================
export const getSentRequestsService = async (currentUserId, queryParams) => {
  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 10;
  const skip = (page - 1) * limit;

  const query = {
    requester: currentUserId,
    status: FRIENDSHIP_STATUS.PENDING,
  };

  const totalDocs = await Friendship.countDocuments(query);
  const requests = await Friendship.find(query)
    .populate({
      path: "recipient",
      select: "fullName userName avatar academicInfo userType institution",
      populate: [
        { path: "institution", select: "name" },
        { path: "academicInfo.department", select: "name" },
      ],
    })
    .skip(skip)
    .limit(limit);

  const formattedRequests = requests
    .map((req) => {
      if (!req.recipient) return null;
      return mapUserToResponse(
        req.recipient,
        PROFILE_RELATION_STATUS.REQUEST_SENT,
        req._id
      );
    })
    .filter(Boolean);

  const totalPages = Math.ceil(totalDocs / limit);

  return {
    users: formattedRequests,
    pagination: {
      totalDocs,
      limit,
      page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

// ==========================================
// 🚀 4. GET SUGGESTIONS SERVICE
// ==========================================
export const getSuggestionsService = async (currentUserId, queryParams) => {
  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 10;
  const skip = (page - 1) * limit;

  const friendships = await Friendship.find({
    $or: [{ requester: currentUserId }, { recipient: currentUserId }],
  }).select("requester recipient");

  const existingRelationIds = friendships.map((f) =>
    f.requester.toString() === currentUserId.toString()
      ? f.recipient
      : f.requester
  );

  const excludedIds = [...existingRelationIds, currentUserId];

  const query = {
    _id: { $nin: excludedIds },
  };

  const totalDocs = await User.countDocuments(query);
  const suggestions = await User.find(query)
    .select("fullName userName avatar academicInfo userType institution")
    .populate([
      { path: "institution", select: "name" },
      { path: "academicInfo.department", select: "name" },
    ])
    .skip(skip)
    .limit(limit);

  const formattedSuggestions = suggestions.map((user) =>
    mapUserToResponse(user, null)
  );

  const totalPages = Math.ceil(totalDocs / limit);

  return {
    users: formattedSuggestions,
    pagination: {
      totalDocs,
      limit,
      page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

// ==========================================
// 🚀 5. SEND FRIEND REQUEST SERVICE
// ==========================================
export const sendFriendRequestService = async (currentUserId, targetUserId) => {
  if (targetUserId === currentUserId.toString()) {
    throw new ApiError(400, "You cannot send friend request to yourself");
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  const existingFriendship = await Friendship.findOne({
    $or: [
      { requester: currentUserId, recipient: targetUserId },
      { requester: targetUserId, recipient: currentUserId },
    ],
  });

  if (existingFriendship) {
    if (existingFriendship.status === FRIENDSHIP_STATUS.ACCEPTED) {
      throw new ApiError(400, "You are already friends");
    }
    if (existingFriendship.status === FRIENDSHIP_STATUS.PENDING) {
      if (
        existingFriendship.requester.toString() === currentUserId.toString()
      ) {
        throw new ApiError(400, "Friend request already sent");
      } else {
        throw new ApiError(400, "You have a pending request from this user");
      }
    }
    if (existingFriendship.status === FRIENDSHIP_STATUS.BLOCKED) {
      if (
        existingFriendship.requester.toString() === currentUserId.toString()
      ) {
        throw new ApiError(400, "You have blocked this user. Unblock first.");
      } else {
        throw new ApiError(400, "You are blocked by this user");
      }
    }
  }

  const newFriendship = await Friendship.create({
    requester: currentUserId,
    recipient: targetUserId,
    status: FRIENDSHIP_STATUS.PENDING,
  });

  return {
    status: FRIENDSHIP_STATUS.PENDING,
    recipientId: targetUserId,
    friendshipId: newFriendship._id,
  };
};

// ==========================================
// 🚀 6. ACCEPT FRIEND REQUEST SERVICE
// ==========================================
export const acceptFriendRequestService = async (
  currentUserId,
  requesterId
) => {
  const friendship = await Friendship.findOne({
    requester: requesterId,
    recipient: currentUserId,
    status: FRIENDSHIP_STATUS.PENDING,
  });

  if (!friendship) {
    throw new ApiError(404, "Friend request not found");
  }

  friendship.status = FRIENDSHIP_STATUS.ACCEPTED;
  await friendship.save();

  return {
    status: FRIENDSHIP_STATUS.ACCEPTED,
    requesterId,
    friendshipId: friendship._id,
  };
};

// ==========================================
// 🚀 7. REJECT RECEIVED REQUEST SERVICE
// ==========================================
export const rejectReceivedRequestService = async (
  currentUserId,
  requesterId
) => {
  const friendship = await Friendship.findOneAndDelete({
    requester: requesterId,
    recipient: currentUserId,
    status: FRIENDSHIP_STATUS.PENDING,
  });

  if (!friendship) {
    throw new ApiError(404, "Friend request not found");
  }

  return { requesterId };
};

// ==========================================
// 🚀 8. CANCEL SENT REQUEST SERVICE
// ==========================================
export const cancelSentRequestService = async (currentUserId, recipientId) => {
  const friendship = await Friendship.findOneAndDelete({
    requester: currentUserId,
    recipient: recipientId,
    status: FRIENDSHIP_STATUS.PENDING,
  });

  if (!friendship) {
    throw new ApiError(404, "Sent request not found");
  }

  return { recipientId };
};

// ==========================================
// 🚀 9. UNFRIEND USER SERVICE
// ==========================================
export const unfriendUserService = async (currentUserId, targetUserId) => {
  const friendship = await Friendship.findOneAndDelete({
    $or: [
      { requester: currentUserId, recipient: targetUserId },
      { requester: targetUserId, recipient: currentUserId },
    ],
    status: FRIENDSHIP_STATUS.ACCEPTED,
  });

  if (!friendship) {
    throw new ApiError(404, "Friendship not found");
  }

  return { userId: targetUserId };
};

// ==========================================
// 🚀 10. BLOCK USER SERVICE
// ==========================================
export const blockUserService = async (currentUserId, targetUserId) => {
  if (targetUserId === currentUserId.toString()) {
    throw new ApiError(400, "You cannot block yourself");
  }

  const existingBlock = await Friendship.findOne({
    $or: [
      { requester: currentUserId, recipient: targetUserId },
      { requester: targetUserId, recipient: currentUserId },
    ],
    status: FRIENDSHIP_STATUS.BLOCKED,
  });

  if (existingBlock) {
    if (existingBlock.requester.toString() === currentUserId.toString()) {
      return { blockRelation: existingBlock, alreadyBlocked: true };
    } else {
      throw new ApiError(400, "You are blocked by this user");
    }
  }

  await Friendship.findOneAndDelete({
    $or: [
      { requester: currentUserId, recipient: targetUserId },
      { requester: targetUserId, recipient: currentUserId },
    ],
    status: { $ne: FRIENDSHIP_STATUS.BLOCKED },
  });

  await Follow.deleteMany({
    $or: [
      { follower: currentUserId, following: targetUserId },
      { follower: targetUserId, following: currentUserId },
    ],
  });

  const blockRelation = await Friendship.create({
    requester: currentUserId,
    recipient: targetUserId,
    status: FRIENDSHIP_STATUS.BLOCKED,
  });

  return { blockRelation };
};

// ==========================================
// 🚀 11. UNBLOCK USER SERVICE
// ==========================================
export const unblockUserService = async (currentUserId, targetUserId) => {
  const blockRelation = await Friendship.findOneAndDelete({
    requester: currentUserId,
    recipient: targetUserId,
    status: FRIENDSHIP_STATUS.BLOCKED,
  });

  if (!blockRelation) {
    throw new ApiError(404, "Block relationship not found");
  }

  return { userId: targetUserId };
};

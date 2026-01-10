import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import * as friendshipService from "../services/friendship.service.js";

// ==============================================================================
// 🤝 1. GET FRIENDS LIST
// ==============================================================================
const getFriendsList = asyncHandler(async (req, res) => {
  const { users, pagination } = await friendshipService.getFriendsListService(
    req.user._id,
    req.query
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { users, pagination }, "Friends list fetched"));
});

// ==============================================================================
// 📥 2. GET RECEIVED FRIEND REQUESTS
// ==============================================================================
const getReceivedRequests = asyncHandler(async (req, res) => {
  const { users, pagination } =
    await friendshipService.getReceivedRequestsService(req.user._id, req.query);

  return res
    .status(200)
    .json(
      new ApiResponse(200, { users, pagination }, "Received requests fetched")
    );
});

// ==============================================================================
// 📤 3. GET SENT FRIEND REQUESTS
// ==============================================================================
const getSentRequests = asyncHandler(async (req, res) => {
  const { users, pagination } = await friendshipService.getSentRequestsService(
    req.user._id,
    req.query
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { users, pagination }, "Sent requests fetched"));
});

// ==============================================================================
// 💡 4. GET SUGGESTIONS
// ==============================================================================
const getSuggestions = asyncHandler(async (req, res) => {
  const { users, pagination } = await friendshipService.getSuggestionsService(
    req.user._id,
    req.query
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { users, pagination }, "Suggestions fetched"));
});

// ==============================================================================
// ⚡ ACTIONS
// ==============================================================================

// ACTION 1: SEND FRIEND REQUEST (auto follow)
const sendFriendRequest = asyncHandler(async (req, res) => {
  const { status, recipientId, friendshipId } =
    await friendshipService.sendFriendRequestService(
      req.user._id,
      req.params.userId
    );

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { status, recipientId, friendshipId },
        "Friend request sent"
      )
    );
});

// ACTION 2: ACCEPT FRIEND REQUEST
const acceptFriendRequest = asyncHandler(async (req, res) => {
  const { status, requesterId, friendshipId } =
    await friendshipService.acceptFriendRequestService(
      req.user._id,
      req.params.userId
    );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { status, requesterId, friendshipId },
        "Friend request accepted"
      )
    );
});

// ACTION 3: REJECT A RECEIVED REQUEST
const rejectReceivedRequest = asyncHandler(async (req, res) => {
  const { requesterId } = await friendshipService.rejectReceivedRequestService(
    req.user._id,
    req.params.userId
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { requesterId }, "Friend request rejected"));
});

// ACTION 4: CANCEL A SENT REQUEST
const cancelSentRequest = asyncHandler(async (req, res) => {
  const { recipientId } = await friendshipService.cancelSentRequestService(
    req.user._id,
    req.params.userId
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { recipientId }, "Friend request cancelled"));
});

// ACTION 5: UNFRIEND A USER
const unfriendUser = asyncHandler(async (req, res) => {
  const { userId } = await friendshipService.unfriendUserService(
    req.user._id,
    req.params.userId
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { userId }, "Unfriended successfully"));
});

// ACTION 6: BLOCK USER
const blockUser = asyncHandler(async (req, res) => {
  const { blockRelation, alreadyBlocked } =
    await friendshipService.blockUserService(req.user._id, req.params.userId);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { blockRelation },
        alreadyBlocked ? "User already blocked" : "User blocked successfully"
      )
    );
});

// ACTION 7: UNBLOCK USER
const unblockUser = asyncHandler(async (req, res) => {
  const { userId } = await friendshipService.unblockUserService(
    req.user._id,
    req.params.userId
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { userId }, "User unblocked successfully"));
});

export {
  getFriendsList,
  getReceivedRequests,
  getSentRequests,
  getSuggestions,
  sendFriendRequest,
  acceptFriendRequest,
  rejectReceivedRequest,
  cancelSentRequest,
  unfriendUser,
  blockUser,
  unblockUser,
};

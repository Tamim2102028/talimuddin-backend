import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import {
  roomActions,
  roomServices,
  roomPostsAndMembers,
} from "../services/room.service.js";

// ==========================================
// 🚀 1. CREATE ROOM
// ==========================================
const createRoom = asyncHandler(async (req, res) => {
  const { room, meta } = await roomActions.createRoomService(
    req.body,
    req.user._id
  );

  return res
    .status(201)
    .json(new ApiResponse(201, { room, meta }, "Room created successfully"));
});

// ==========================================
// 🚀 2. GET ALL ROOMS (Public)
// ==========================================
const getAllRooms = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { rooms, pagination } = await roomServices.getAllRoomsService(
    page,
    limit
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { rooms, pagination },
        "All rooms fetched successfully"
      )
    );
});

// ==========================================
// 🚀 3. GET MY ROOMS (Joined rooms only)
// ==========================================
const getMyRooms = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { rooms, pagination } = await roomServices.getMyRoomsService(
    req.user._id,
    page,
    limit
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { rooms, pagination },
        "My rooms fetched successfully"
      )
    );
});

// ==========================================
// 🚀 4. GET ROOM DETAILS
// ==========================================
const getRoomDetails = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { room, meta } = await roomServices.getRoomDetailsService(
    roomId,
    req.user._id
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, { room, meta }, "Room details fetched successfully")
    );
});

// ==========================================
// 🚀 5. JOIN ROOM (by join code)
// ==========================================
const joinRoom = asyncHandler(async (req, res) => {
  const { joinCode } = req.body;

  if (!joinCode) {
    throw new ApiError(400, "Join code is required");
  }

  const result = await roomActions.joinRoomService(req.user._id, joinCode);

  return res.status(200).json(new ApiResponse(200, result, result.message));
});

// ==========================================
// 🚀 6. LEAVE ROOM
// ==========================================
const leaveRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  const result = await roomActions.leaveRoomService(roomId, req.user._id);

  return res.status(200).json(new ApiResponse(200, result, result.message));
});

// ==========================================
// 🚀 7. DELETE ROOM (Owner only)
// ==========================================
const deleteRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  const { roomId: id } = await roomActions.deleteRoomService(
    roomId,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { roomId: id }, "Room deleted successfully"));
});

// ==========================================
// 🚀 8. UPDATE ROOM
// ==========================================
const updateRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  const { room } = await roomActions.updateRoomService(
    roomId,
    req.user._id,
    req.body
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { room }, "Room updated successfully"));
});

// ==========================================
// 🚀 9. UPDATE ROOM COVER IMAGE
// ==========================================
const updateRoomCoverImage = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is required");
  }

  const { room } = await roomActions.updateRoomCoverImageService(
    roomId,
    req.user._id,
    coverImageLocalPath
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, { room }, "Room cover image updated successfully")
    );
});

// ==========================================
// 🚀 10. GET ROOM POSTS
// ==========================================
const getRoomPosts = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { page, limit } = req.query;

  const { posts, pagination } = await roomPostsAndMembers.getRoomPostsService(
    roomId,
    req.user._id,
    page,
    limit
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { posts, pagination },
        "Room posts fetched successfully"
      )
    );
});

// ==========================================
// 🚀 11. GET ROOM MEMBERS
// ==========================================
const getRoomMembers = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { page, limit } = req.query;

  const { members, pagination, meta } =
    await roomPostsAndMembers.getRoomMembersService(
      roomId,
      req.user._id,
      page,
      limit
    );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { members, pagination, meta },
        "Room members fetched successfully"
      )
    );
});

// ==========================================
// 🚀 12. GET PENDING JOIN REQUESTS
// ==========================================
const getPendingJoinRequests = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { page, limit } = req.query;

  const { requests, pagination } =
    await roomPostsAndMembers.getPendingJoinRequestsService(
      roomId,
      req.user._id,
      page,
      limit
    );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { requests, pagination },
        "Pending join requests fetched successfully"
      )
    );
});

// ==========================================
// 🚀 13. ACCEPT JOIN REQUEST
// ==========================================
const acceptJoinRequest = asyncHandler(async (req, res) => {
  const { roomId, membershipId } = req.params;

  const result = await roomActions.acceptJoinRequestService(
    roomId,
    membershipId,
    req.user._id
  );

  return res.status(200).json(new ApiResponse(200, result, result.message));
});

// ==========================================
// 🚀 14. REJECT JOIN REQUEST
// ==========================================
const rejectJoinRequest = asyncHandler(async (req, res) => {
  const { roomId, membershipId } = req.params;

  const result = await roomActions.rejectJoinRequestService(
    roomId,
    membershipId,
    req.user._id
  );

  return res.status(200).json(new ApiResponse(200, result, result.message));
});

export {
  createRoom,
  getAllRooms,
  getMyRooms,
  getRoomDetails,
  joinRoom,
  leaveRoom,
  deleteRoom,
  updateRoom,
  updateRoomCoverImage,
  getRoomPosts,
  getRoomMembers,
  getPendingJoinRequests,
  acceptJoinRequest,
  rejectJoinRequest,
};

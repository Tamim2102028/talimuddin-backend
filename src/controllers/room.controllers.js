import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { roomActions, roomServices } from "../services/room.service.js";

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
// 🚀 2. GET MY ROOMS
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
// 🚀 2.1. GET HIDDEN ROOMS
// ==========================================
const getHiddenRooms = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { rooms, pagination } = await roomServices.getHiddenRoomsService(
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
        "Hidden rooms fetched successfully"
      )
    );
});

// ==========================================
// 🚀 2.2. GET ARCHIVED ROOMS
// ==========================================
const getArchivedRooms = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { rooms, pagination } = await roomServices.getArchivedRoomsService(
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
        "Archived rooms fetched successfully"
      )
    );
});

// ==========================================
// 🚀 3. GET ROOM DETAILS
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
// 🚀 4. JOIN ROOM (by join code only)
// ==========================================
const joinRoom = asyncHandler(async (req, res) => {
  const { joinCode } = req.body;

  if (!joinCode) {
    throw new ApiError(400, "Join code is required");
  }

  const { roomId, roomName } = await roomActions.joinRoomService(
    req.user._id,
    joinCode
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, { roomId, roomName }, "Joined room successfully")
    );
});

// ==========================================
// 🚀 5. TOGGLE ARCHIVE ROOM (Creator or Admin)
// ==========================================
const toggleArchiveRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  const { roomId: id, isArchived } = await roomActions.toggleArchiveRoomService(
    roomId,
    req.user._id
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { roomId: id, isArchived },
        isArchived
          ? "Room archived successfully"
          : "Room unarchived successfully"
      )
    );
});

// ==========================================
// 🚀 6. DELETE ROOM (Creator only)
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
// 🚀 7. HIDE ROOM (Member only)
// ==========================================
const hideRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  const { roomId: id, isHidden } = await roomActions.hideRoomService(
    roomId,
    req.user._id
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { roomId: id, isHidden },
        isHidden ? "Room hidden from your list" : "Room unhidden"
      )
    );
});

// ==========================================
// 🚀 8. UPDATE ROOM (Creator or Admin)
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
// 🚀 9. UPDATE ROOM COVER IMAGE (Creator or Admin)
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

  const { roomPostsAndMembers } = await import("../services/room.service.js");
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

  const { roomPostsAndMembers } = await import("../services/room.service.js");
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

export {
  createRoom,
  getMyRooms,
  getHiddenRooms,
  getArchivedRooms,
  getRoomDetails,
  joinRoom,
  toggleArchiveRoom,
  deleteRoom,
  hideRoom,
  updateRoom,
  updateRoomCoverImage,
  getRoomPosts,
  getRoomMembers,
};

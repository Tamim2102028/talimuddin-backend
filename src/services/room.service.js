import { Room } from "../models/room.model.js";
import { RoomMembership } from "../models/roomMembership.model.js";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { ReadPost } from "../models/readPost.model.js";
import { ApiError } from "../utils/ApiError.js";
import { USER_TYPES, POST_TARGET_MODELS } from "../constants/index.js";
import { uploadFile, deleteFile } from "../utils/cloudinaryFileUpload.js";
import { createPostService } from "./common/post.service.js";

// ==========================================
// ROOM ACTIONS
// ==========================================
const roomActions = {
  // 🚀 CREATE ROOM (Owner only)
  createRoomService: async (roomData, userId) => {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Only owner can create rooms
    if (user.userType !== USER_TYPES.OWNER) {
      throw new ApiError(403, "Only owner can create rooms");
    }

    // Generate unique 6-character alphanumeric join code
    const generateJoinCode = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars: 0,O,1,I
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let joinCode = generateJoinCode();
    let isUnique = false;

    while (!isUnique) {
      const existing = await Room.findOne({ joinCode });
      if (!existing) {
        isUnique = true;
      } else {
        joinCode = generateJoinCode();
      }
    }

    // Create Room
    const room = await Room.create({
      name: roomData.name,
      description: roomData.description || "",
      roomType: roomData.roomType,
      coverImage:
        "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&h=400&fit=crop",
      creator: userId,
      joinCode,
      isDeleted: false,
      membersCount: 0,
      postsCount: 0,
      settings: {
        allowStudentPosting: roomData.allowStudentPosting ?? true,
        allowComments: roomData.allowComments ?? true,
      },
    });

    if (!room) {
      throw new ApiError(500, "Failed to create room");
    }

    // Owner doesn't become a member, but has full access

    const meta = {
      isMember: false,
      isCreator: true,
      joinCode,
    };

    return { room, meta };
  },

  // 🚀 JOIN ROOM (via join code only) - Creates PENDING request
  joinRoomService: async (userId, joinCode) => {
    // Find room by join code
    const room = await Room.findOne({ joinCode });

    if (!room) {
      throw new ApiError(404, "Invalid join code");
    }

    if (room.isDeleted) {
      throw new ApiError(404, "Room not found");
    }

    // Check if already has a membership
    const existing = await RoomMembership.findOne({
      room: room._id,
      user: userId,
    });

    if (existing) {
      if (existing.isPending) {
        throw new ApiError(400, "Join request already pending");
      } else {
        throw new ApiError(400, "Already a member of this room");
      }
    }

    // Create PENDING membership request
    await RoomMembership.create({
      room: room._id,
      user: userId,
      isPending: true,
      isCR: false,
      isAdmin: false,
    });

    return {
      roomId: room._id,
      roomName: room.name,
      message: "Join request sent successfully. Waiting for approval.",
    };
  },

  // 🚀 DELETE ROOM (Creator only)
  deleteRoomService: async (roomId, userId) => {
    const room = await Room.findById(roomId);

    if (!room) {
      throw new ApiError(404, "Room not found");
    }

    if (room.isDeleted) {
      throw new ApiError(404, "Room already deleted");
    }

    // Only creator can delete
    if (room.creator.toString() !== userId.toString()) {
      throw new ApiError(403, "Only room creator can delete room");
    }

    room.isDeleted = true;
    await room.save();

    return {
      roomId: room._id,
    };
  },

  // 🚀 UPDATE ROOM (Creator or Admin)
  updateRoomService: async (roomId, userId, updateData) => {
    const room = await Room.findById(roomId);

    if (!room) {
      throw new ApiError(404, "Room not found");
    }

    if (room.isDeleted) {
      throw new ApiError(404, "Room not found");
    }

    // Check if user is creator or admin
    const isCreator = room.creator.toString() === userId.toString();
    const membership = await RoomMembership.findOne({
      room: roomId,
      user: userId,
    });

    if (!isCreator && !membership?.isAdmin) {
      throw new ApiError(
        403,
        "Only room creator or admin can update room details"
      );
    }

    // Update allowed fields
    if (updateData.name) room.name = updateData.name;
    if (updateData.description !== undefined)
      room.description = updateData.description;
    if (updateData.roomType) room.roomType = updateData.roomType;
    if (updateData.settings) {
      room.settings = {
        ...room.settings,
        ...updateData.settings,
      };
    }

    await room.save();

    return { room };
  },

  // 🚀 UPDATE ROOM COVER IMAGE (Creator or Admin)
  updateRoomCoverImageService: async (roomId, userId, localFilePath) => {
    if (!localFilePath) throw new ApiError(400, "Cover image missing");

    const room = await Room.findById(roomId);
    if (!room) throw new ApiError(404, "Room not found");

    if (room.isDeleted) {
      throw new ApiError(404, "Room not found");
    }

    // Check if user is creator or admin
    const isCreator = room.creator.toString() === userId.toString();
    const membership = await RoomMembership.findOne({
      room: roomId,
      user: userId,
    });

    if (!isCreator && !membership?.isAdmin) {
      throw new ApiError(403, "Permission denied");
    }

    const cover = await uploadFile(localFilePath);
    if (!cover?.url) throw new ApiError(500, "Failed to upload cover image");

    // Extract old public ID and delete if exists
    if (room.coverImage && room.coverImage.includes("cloudinary")) {
      const publicId = room.coverImage.split("/").pop().split(".")[0];
      await deleteFile(publicId);
    }

    room.coverImage = cover.url;
    await room.save();

    return { room };
  },

  // 🚀 ACCEPT JOIN REQUEST (Teacher/Admin/Owner)
  acceptJoinRequestService: async (roomId, membershipId, userId) => {
    const room = await Room.findById(roomId);
    if (!room) throw new ApiError(404, "Room not found");
    if (room.isDeleted) throw new ApiError(404, "Room not found");

    // Get current user info
    const currentUser = await User.findById(userId);
    if (!currentUser) throw new ApiError(404, "User not found");

    // Check if user has permission: OWNER, ADMIN, or TEACHER (who is member)
    const isOwner = currentUser.userType === USER_TYPES.OWNER;
    const isAdmin = currentUser.userType === USER_TYPES.ADMIN;

    let isTeacher = false;
    if (currentUser.userType === USER_TYPES.TEACHER) {
      const userMembership = await RoomMembership.findOne({
        room: roomId,
        user: userId,
        isPending: false,
      });
      isTeacher = !!userMembership;
    }

    if (!isOwner && !isAdmin && !isTeacher) {
      throw new ApiError(
        403,
        "Only teachers (who are members), admins, or owners can accept join requests"
      );
    }

    // Find the pending membership
    const membership = await RoomMembership.findById(membershipId);
    if (!membership) {
      throw new ApiError(404, "Join request not found");
    }

    if (membership.room.toString() !== roomId.toString()) {
      throw new ApiError(400, "Invalid request");
    }

    if (!membership.isPending) {
      throw new ApiError(400, "This request has already been accepted");
    }

    // Accept the request
    membership.isPending = false;
    await membership.save();

    // Increment members count
    await Room.findByIdAndUpdate(roomId, { $inc: { membersCount: 1 } });

    return {
      membershipId: membership._id,
      message: "Join request accepted successfully",
    };
  },

  // 🚀 REJECT JOIN REQUEST (Teacher/Admin/Owner) - Deletes the request
  rejectJoinRequestService: async (roomId, membershipId, userId) => {
    const room = await Room.findById(roomId);
    if (!room) throw new ApiError(404, "Room not found");
    if (room.isDeleted) throw new ApiError(404, "Room not found");

    // Get current user info
    const currentUser = await User.findById(userId);
    if (!currentUser) throw new ApiError(404, "User not found");

    // Check if user has permission: OWNER, ADMIN, or TEACHER (who is member)
    const isOwner = currentUser.userType === USER_TYPES.OWNER;
    const isAdmin = currentUser.userType === USER_TYPES.ADMIN;

    let isTeacher = false;
    if (currentUser.userType === USER_TYPES.TEACHER) {
      const userMembership = await RoomMembership.findOne({
        room: roomId,
        user: userId,
        isPending: false,
      });
      isTeacher = !!userMembership;
    }

    if (!isOwner && !isAdmin && !isTeacher) {
      throw new ApiError(
        403,
        "Only teachers (who are members), admins, or owners can reject join requests"
      );
    }

    // Find the pending membership
    const membership = await RoomMembership.findById(membershipId);
    if (!membership) {
      throw new ApiError(404, "Join request not found");
    }

    if (membership.room.toString() !== roomId.toString()) {
      throw new ApiError(400, "Invalid request");
    }

    if (!membership.isPending) {
      throw new ApiError(400, "This request has already been accepted");
    }

    // Delete the request
    await RoomMembership.findByIdAndDelete(membershipId);

    return {
      membershipId,
      message: "Join request rejected",
    };
  },
};

// ==========================================
// ROOM SERVICES
// ==========================================
const roomServices = {
  // 🚀 GET MY ROOMS
  getMyRoomsService: async (userId, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    // Get all room IDs that are not deleted
    const validRooms = await Room.find({
      isDeleted: false,
    }).distinct("_id");

    // Find memberships for valid rooms only
    const memberships = await RoomMembership.find({
      user: userId,
      isPending: false,
      room: { $in: validRooms },
    })
      .populate({
        path: "room",
        populate: {
          path: "creator",
          select: "fullName userName avatar",
        },
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const rooms = memberships.map((membership) => {
      const room = membership.room;
      return {
        _id: room._id,
        name: room.name,
        description: room.description,
        coverImage: room.coverImage,
        roomType: room.roomType,
        creator: {
          _id: room.creator._id,
          fullName: room.creator.fullName,
          userName: room.creator.userName,
          avatar: room.creator.avatar,
        },
        membersCount: room.membersCount,
        postsCount: room.postsCount,
        joinCode: room.joinCode,
        isCR: membership.isCR,
        createdAt: room.createdAt,
      };
    });

    // Get total count
    const totalDocs = await RoomMembership.countDocuments({
      user: userId,
      isPending: false,
      room: { $in: validRooms },
    });

    const pagination = {
      totalDocs,
      limit: parseInt(limit),
      page: parseInt(page),
      totalPages: Math.ceil(totalDocs / limit),
      hasNextPage: parseInt(page) < Math.ceil(totalDocs / limit),
      hasPrevPage: parseInt(page) > 1,
    };

    return { rooms, pagination };
  },

  // 🚀 GET ROOM DETAILS
  getRoomDetailsService: async (roomId, userId) => {
    const room = await Room.findById(roomId).populate(
      "creator",
      "fullName userName avatar"
    );

    if (!room) {
      throw new ApiError(404, "Room not found");
    }

    if (room.isDeleted) {
      throw new ApiError(404, "Room not found");
    }

    // Check membership
    const membership = await RoomMembership.findOne({
      room: roomId,
      user: userId,
    });

    const user = await User.findById(userId);

    const isCreator = room.creator._id.toString() === userId.toString();
    const isOwner = user?.userType === USER_TYPES.OWNER;
    const isAdmin = user?.userType === USER_TYPES.ADMIN;

    const meta = {
      isMember: !!membership,
      isOwner,
      isAdmin,
      isCreator,
      isRoomAdmin: membership?.isAdmin || false,
      isCR: membership?.isCR || false,
      joinCode: membership ? room.joinCode : null, // Only show to members
      // Button visibility logic:
      // - Owner: Can create rooms (show create button on room list)
      // - Admin: Already member of all rooms (no join button needed)
      // - Normal/Teacher: Show join button if not member
      canJoin: !isOwner && !isAdmin && !membership,
      canCreate: isOwner,
    };

    return { room, meta };
  },
};

// ==========================================
// ROOM POSTS & MEMBERS
// ==========================================
const roomPostsAndMembers = {
  // 🚀 CREATE ROOM POST
  createRoomPostService: async (roomId, userId, postData) => {
    const room = await Room.findById(roomId);
    if (!room) throw new ApiError(404, "Room not found");
    if (room.isDeleted) throw new ApiError(404, "Room not found");

    // Check membership
    const membership = await RoomMembership.findOne({
      room: roomId,
      user: userId,
    });
    if (!membership) {
      throw new ApiError(403, "You must be a member to post in this room");
    }

    const user = await User.findById(userId);

    // Check if student posting is allowed
    if (
      user.userType === "STUDENT" &&
      room.settings?.allowStudentPosting === false
    ) {
      throw new ApiError(403, "Student posting is disabled in this room");
    }

    // Prepare post data
    const newPostData = {
      ...postData,
      postOnModel: POST_TARGET_MODELS.ROOM,
      postOnId: roomId,
    };

    // Create post using common service (handles postsCount increment)
    const formattedPost = await createPostService(newPostData, userId);

    return formattedPost;
  },

  // 🚀 GET ROOM POSTS
  getRoomPostsService: async (roomId, userId, page = 1, limit = 10) => {
    const room = await Room.findById(roomId);
    if (!room) throw new ApiError(404, "Room not found");
    if (room.isDeleted) throw new ApiError(404, "Room not found");

    // Check membership
    const membership = await RoomMembership.findOne({
      room: roomId,
      user: userId,
    });
    if (!membership) {
      throw new ApiError(403, "You are not a member of this room");
    }

    const skip = (page - 1) * limit;

    const posts = await Post.find({
      postOnModel: POST_TARGET_MODELS.ROOM,
      postOnId: roomId,
      isDeleted: false,
    })
      .populate("author", "fullName userName avatar")
      .populate("attachments")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const postIds = posts.map((p) => p._id);

    const readStatuses = await ReadPost.find({
      post: { $in: postIds },
      user: userId,
    });

    const readMap = new Map(readStatuses.map((r) => [r.post.toString(), true]));

    const isCreator = room.creator.toString() === userId.toString();
    const isAdmin = membership.isAdmin;

    const postsWithMeta = posts.map((post) => ({
      post: post,
      meta: {
        isSaved: false, // Bookmark feature not implemented yet
        isRead: readMap.has(post._id.toString()),
        isMine: post.author._id.toString() === userId.toString(),
        canDelete:
          isCreator ||
          isAdmin ||
          post.author._id.toString() === userId.toString(),
      },
    }));

    const total = await Post.countDocuments({
      postOnModel: POST_TARGET_MODELS.ROOM,
      postOnId: roomId,
      isDeleted: false,
    });

    const pagination = {
      totalDocs: total,
      limit: parseInt(limit),
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      hasNextPage: parseInt(page) < Math.ceil(total / limit),
      hasPrevPage: parseInt(page) > 1,
    };

    return { posts: postsWithMeta, pagination };
  },

  // 🚀 GET ROOM MEMBERS
  getRoomMembersService: async (roomId, userId, page = 1, limit = 10) => {
    const room = await Room.findById(roomId);
    if (!room) throw new ApiError(404, "Room not found");
    if (room.isDeleted) throw new ApiError(404, "Room not found");

    // Check membership
    const currentUserMembership = await RoomMembership.findOne({
      room: roomId,
      user: userId,
    });
    if (!currentUserMembership) {
      throw new ApiError(403, "You are not a member of this room");
    }

    const skip = (page - 1) * limit;

    const memberships = await RoomMembership.find({ room: roomId })
      .populate("user", "fullName userName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const isCreator = room.creator.toString() === userId.toString();
    const isAdmin = currentUserMembership.isAdmin;

    const members = memberships.map((membership) => {
      const user = membership.user;
      const userIdStr = user._id.toString();
      const isSelf = userIdStr === userId.toString();

      // Determine role
      let role = "MEMBER";
      if (room.creator.toString() === userIdStr) {
        role = "CREATOR";
      } else if (membership.isAdmin) {
        role = "ADMIN";
      } else if (membership.isCR) {
        role = "CR";
      }

      return {
        user: {
          _id: user._id,
          fullName: user.fullName,
          userName: user.userName,
          avatar: user.avatar,
        },
        meta: {
          memberId: membership._id,
          role,
          isSelf,
          isCR: membership.isCR,
          isAdmin: membership.isAdmin,
          isCreator: room.creator.toString() === userIdStr,
        },
      };
    });

    const total = await RoomMembership.countDocuments({ room: roomId });

    const pagination = {
      totalDocs: total,
      limit: parseInt(limit),
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      hasNextPage: parseInt(page) < Math.ceil(total / limit),
      hasPrevPage: parseInt(page) > 1,
    };

    const meta = {
      currentUserRole: isCreator ? "CREATOR" : isAdmin ? "ADMIN" : "MEMBER",
    };

    return { members, pagination, meta };
  },

  // 🚀 GET PENDING JOIN REQUESTS (Creator or Admin only)
  getPendingJoinRequestsService: async (
    roomId,
    userId,
    page = 1,
    limit = 10
  ) => {
    const room = await Room.findById(roomId);
    if (!room) throw new ApiError(404, "Room not found");
    if (room.isDeleted) throw new ApiError(404, "Room not found");

    // Get current user info
    const currentUser = await User.findById(userId);
    if (!currentUser) throw new ApiError(404, "User not found");

    // Check if user has permission: OWNER, ADMIN, or TEACHER (who is member)
    const isOwner = currentUser.userType === USER_TYPES.OWNER;
    const isAdmin = currentUser.userType === USER_TYPES.ADMIN;

    let isTeacher = false;
    if (currentUser.userType === USER_TYPES.TEACHER) {
      const userMembership = await RoomMembership.findOne({
        room: roomId,
        user: userId,
        isPending: false,
      });
      isTeacher = !!userMembership;
    }

    if (!isOwner && !isAdmin && !isTeacher) {
      throw new ApiError(
        403,
        "Only teachers (who are members), admins, or owners can view join requests"
      );
    }

    const skip = (page - 1) * limit;

    const requests = await RoomMembership.find({
      room: roomId,
      isPending: true,
    })
      .populate("user", "fullName userName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const formattedRequests = requests.map((request) => ({
      _id: request._id,
      user: {
        _id: request.user._id,
        fullName: request.user.fullName,
        userName: request.user.userName,
        avatar: request.user.avatar,
      },
      requestedAt: request.createdAt,
    }));

    const total = await RoomMembership.countDocuments({
      room: roomId,
      isPending: true,
    });

    const pagination = {
      totalDocs: total,
      limit: parseInt(limit),
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      hasNextPage: parseInt(page) < Math.ceil(total / limit),
      hasPrevPage: parseInt(page) > 1,
    };

    return { requests: formattedRequests, pagination };
  },
};

export { roomActions, roomServices, roomPostsAndMembers };

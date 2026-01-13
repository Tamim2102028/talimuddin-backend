import { Room } from "../models/room.model.js";
import { RoomMembership } from "../models/roomMembership.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";

// ==========================================
// ROOM ACTIONS
// ==========================================
const roomActions = {
  // 🚀 CREATE ROOM (Teachers only)
  createRoomService: async (roomData, userId) => {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Only teachers can create rooms
    if (user.userType !== "TEACHER") {
      throw new ApiError(403, "Only teachers can create rooms");
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
      isArchived: false,
      isDeleted: false,
      membersCount: 1,
      postsCount: 0,
      settings: {
        allowStudentPosting: roomData.allowStudentPosting ?? true,
        allowComments: roomData.allowComments ?? true,
      },
    });

    if (!room) {
      throw new ApiError(500, "Failed to create room");
    }

    // Add Creator as Member
    await RoomMembership.create({
      room: room._id,
      user: userId,
      isCR: false,
      isAdmin: false,
      isHidden: false,
    });

    const meta = {
      isMember: true,
      isCreator: true,
      joinCode,
    };

    return { room, meta };
  },

  // 🚀 JOIN ROOM (via join code only)
  joinRoomService: async (userId, joinCode) => {
    // Find room by join code
    const room = await Room.findOne({ joinCode });

    if (!room) {
      throw new ApiError(404, "Invalid join code");
    }

    if (room.isDeleted) {
      throw new ApiError(404, "Room not found");
    }

    if (room.isArchived) {
      throw new ApiError(403, "Cannot join archived room");
    }

    // Check if already member
    const existing = await RoomMembership.findOne({
      room: room._id,
      user: userId,
    });

    if (existing) {
      throw new ApiError(400, "Already a member of this room");
    }

    // Add as member
    await RoomMembership.create({
      room: room._id,
      user: userId,
      isCR: false,
      isAdmin: false,
      isHidden: false,
    });

    return {
      roomId: room._id,
      roomName: room.name,
    };
  },

  // 🚀 ARCHIVE/UNARCHIVE ROOM (Creator or Admin)
  toggleArchiveRoomService: async (roomId, userId) => {
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
        "Only room creator or admin can archive/unarchive room"
      );
    }

    room.isArchived = !room.isArchived;
    await room.save();

    return {
      roomId: room._id,
      isArchived: room.isArchived,
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

  // 🚀 HIDE ROOM (Member only - personal action)
  hideRoomService: async (roomId, userId) => {
    const room = await Room.findById(roomId);

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

    if (!membership) {
      throw new ApiError(403, "You are not a member of this room");
    }

    // Toggle hide status
    membership.isHidden = !membership.isHidden;
    await membership.save();

    return {
      roomId: room._id,
      isHidden: membership.isHidden,
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

    const { uploadFile, deleteFile } = await import(
      "../utils/cloudinaryFileUpload.js"
    );

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
};

// ==========================================
// ROOM SERVICES
// ==========================================
const roomServices = {
  // 🚀 GET MY ROOMS
  getMyRoomsService: async (userId, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    // Get all room IDs that are not deleted and not archived
    const validRooms = await Room.find({
      isDeleted: false,
      isArchived: false,
    }).distinct("_id");

    // Find memberships for valid rooms only
    const memberships = await RoomMembership.find({
      user: userId,
      isHidden: false,
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
        isArchived: room.isArchived,
        createdAt: room.createdAt,
      };
    });

    // Get total count
    const totalDocs = await RoomMembership.countDocuments({
      user: userId,
      isHidden: false,
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

  // 🚀 GET HIDDEN ROOMS
  getHiddenRoomsService: async (userId, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    // Get all room IDs that are not deleted and not archived
    const validRooms = await Room.find({
      isDeleted: false,
      isArchived: false, // Only non-archived rooms
    }).distinct("_id");

    // Find memberships for valid rooms only
    const memberships = await RoomMembership.find({
      user: userId,
      isHidden: true,
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
        isArchived: room.isArchived,
        createdAt: room.createdAt,
      };
    });

    // Get total count
    const totalDocs = await RoomMembership.countDocuments({
      user: userId,
      isHidden: true,
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

  // 🚀 GET ARCHIVED ROOMS
  getArchivedRoomsService: async (userId, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    // Get all room IDs that are not deleted and are archived
    const validRooms = await Room.find({
      isDeleted: false,
      isArchived: true,
    }).distinct("_id");

    // Find memberships for valid rooms (both hidden and non-hidden)
    const memberships = await RoomMembership.find({
      user: userId,
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
        isArchived: room.isArchived,
        createdAt: room.createdAt,
      };
    });

    // Get total count
    const totalDocs = await RoomMembership.countDocuments({
      user: userId,
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

    const meta = {
      isMember: !!membership,
      isTeacher: user?.userType === "TEACHER",
      isCreator: room.creator._id.toString() === userId.toString(),
      isAdmin: membership?.isAdmin || false,
      isCR: membership?.isCR || false,
      isHidden: membership?.isHidden || false,
      joinCode: membership ? room.joinCode : null, // Only show to members
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
    if (room.isArchived)
      throw new ApiError(403, "Cannot post in archived room");

    // Check membership
    const membership = await RoomMembership.findOne({
      room: roomId,
      user: userId,
    });
    if (!membership) {
      throw new ApiError(403, "You must be a member to post in this room");
    }

    const { User } = await import("../models/user.model.js");
    const user = await User.findById(userId);

    // Check if student posting is allowed
    if (
      user.userType === "STUDENT" &&
      room.settings?.allowStudentPosting === false
    ) {
      throw new ApiError(403, "Student posting is disabled in this room");
    }

    const { POST_TARGET_MODELS } = await import("../constants/index.js");
    const { createPostService } = await import("./common/post.service.js");

    // Prepare post data
    const newPostData = {
      ...postData,
      postOnModel: POST_TARGET_MODELS.ROOM,
      postOnId: roomId,
    };

    // Create post using common service
    const formattedPost = await createPostService(newPostData, userId);

    // Update room stats
    await Room.findByIdAndUpdate(roomId, { $inc: { postsCount: 1 } });

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

    const { Post } = await import("../models/post.model.js");
    const { Reaction } = await import("../models/reaction.model.js");
    const { ReadPost } = await import("../models/readPost.model.js");
    const { REACTION_TARGET_MODELS, POST_TARGET_MODELS } = await import(
      "../constants/index.js"
    );

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

    const [likes, readStatuses] = await Promise.all([
      Reaction.find({
        targetModel: REACTION_TARGET_MODELS.POST,
        targetId: { $in: postIds },
        user: userId,
      }),
      ReadPost.find({ post: { $in: postIds }, user: userId }),
    ]);

    const likeMap = new Map(likes.map((l) => [l.targetId.toString(), true]));
    const readMap = new Map(readStatuses.map((r) => [r.post.toString(), true]));

    const isCreator = room.creator.toString() === userId.toString();
    const isAdmin = membership.isAdmin;

    const postsWithMeta = posts.map((post) => ({
      post: post,
      meta: {
        isLiked: likeMap.has(post._id.toString()),
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
};

export { roomActions, roomServices, roomPostsAndMembers };

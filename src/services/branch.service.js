import { Branch } from "../models/branch.model.js";
import { BranchMembership } from "../models/branchMembership.model.js";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { ReadPost } from "../models/readPost.model.js";
import { ApiError } from "../utils/ApiError.js";
import { USER_TYPES, POST_TARGET_MODELS } from "../constants/index.js";
import { uploadFile, deleteFile } from "../utils/cloudinaryFileUpload.js";
import { createPostService } from "./common/post.service.js";

// ==========================================
// Branch ACTIONS
// ==========================================
const roomActions = {
  // 🚀 CREATE Branch (Owner only)
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
      const existing = await Branch.findOne({ joinCode });
      if (!existing) {
        isUnique = true;
      } else {
        joinCode = generateJoinCode();
      }
    }

    // Create Branch
    const Branch = await Branch.create({
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

    if (!Branch) {
      throw new ApiError(500, "Failed to create Branch");
    }

    // Owner doesn't become a member, but has full access

    const meta = {
      isMember: false,
      isCreator: true,
      joinCode,
    };

    return { Branch, meta };
  },

  // 🚀 JOIN Branch (via join code only) - Creates PENDING request
  // User can only be in ONE Branch at a time
  joinRoomService: async (userId, joinCode) => {
    // Find Branch by join code
    const Branch = await Branch.findOne({ joinCode });

    if (!Branch) {
      throw new ApiError(404, "Invalid join code");
    }

    if (Branch.isDeleted) {
      throw new ApiError(404, "Branch not found");
    }

    // Check if user is already in ANY Branch (accepted or pending)
    const existingMembership = await BranchMembership.findOne({
      user: userId,
    });

    if (existingMembership) {
      const existingRoom = await Branch.findById(existingMembership.Branch);
      throw new ApiError(
        400,
        `You are already ${existingMembership.isPending ? "requesting to join" : "a member of"} "${existingRoom?.name}". Please leave that Branch first.`
      );
    }

    // Create PENDING membership request
    await BranchMembership.create({
      Branch: Branch._id,
      user: userId,
      isPending: true,
      isCR: false,
      isAdmin: false,
    });

    return {
      roomId: Branch._id,
      roomName: Branch.name,
      message: "Join request sent successfully. Waiting for approval.",
    };
  },

  // 🚀 LEAVE Branch - Deletes membership document
  leaveRoomService: async (roomId, userId) => {
    const Branch = await Branch.findById(roomId);
    if (!Branch) throw new ApiError(404, "Branch not found");
    if (Branch.isDeleted) throw new ApiError(404, "Branch not found");

    // Find membership
    const membership = await BranchMembership.findOne({
      Branch: roomId,
      user: userId,
    });

    if (!membership) {
      throw new ApiError(400, "You are not a member of this Branch");
    }

    // Delete membership document
    await BranchMembership.findByIdAndDelete(membership._id);

    // Decrement members count only if was accepted member
    if (!membership.isPending) {
      await Branch.findByIdAndUpdate(roomId, { $inc: { membersCount: -1 } });
    }

    return {
      roomId: Branch._id,
      message: "Successfully left the Branch",
    };
  },

  // 🚀 DELETE Branch (Creator only)
  deleteRoomService: async (roomId, userId) => {
    const Branch = await Branch.findById(roomId);

    if (!Branch) {
      throw new ApiError(404, "Branch not found");
    }

    if (Branch.isDeleted) {
      throw new ApiError(404, "Branch already deleted");
    }

    // Only creator can delete
    if (Branch.creator.toString() !== userId.toString()) {
      throw new ApiError(403, "Only Branch creator can delete Branch");
    }

    Branch.isDeleted = true;
    await Branch.save();

    return {
      roomId: Branch._id,
    };
  },

  // 🚀 UPDATE Branch (Creator or Admin)
  updateRoomService: async (roomId, userId, updateData) => {
    const Branch = await Branch.findById(roomId);

    if (!Branch) {
      throw new ApiError(404, "Branch not found");
    }

    if (Branch.isDeleted) {
      throw new ApiError(404, "Branch not found");
    }

    // Check if user is creator or admin
    const isCreator = Branch.creator.toString() === userId.toString();
    const membership = await BranchMembership.findOne({
      Branch: roomId,
      user: userId,
    });

    if (!isCreator && !membership?.isAdmin) {
      throw new ApiError(
        403,
        "Only Branch creator or admin can update Branch details"
      );
    }

    // Update allowed fields
    if (updateData.name) Branch.name = updateData.name;
    if (updateData.description !== undefined)
      Branch.description = updateData.description;
    if (updateData.roomType) Branch.roomType = updateData.roomType;
    if (updateData.settings) {
      Branch.settings = {
        ...Branch.settings,
        ...updateData.settings,
      };
    }

    await Branch.save();

    return { Branch };
  },

  // 🚀 UPDATE Branch COVER IMAGE (Creator or Admin)
  updateRoomCoverImageService: async (roomId, userId, localFilePath) => {
    if (!localFilePath) throw new ApiError(400, "Cover image missing");

    const Branch = await Branch.findById(roomId);
    if (!Branch) throw new ApiError(404, "Branch not found");

    if (Branch.isDeleted) {
      throw new ApiError(404, "Branch not found");
    }

    // Check if user is creator or admin
    const isCreator = Branch.creator.toString() === userId.toString();
    const membership = await BranchMembership.findOne({
      Branch: roomId,
      user: userId,
    });

    if (!isCreator && !membership?.isAdmin) {
      throw new ApiError(403, "Permission denied");
    }

    const cover = await uploadFile(localFilePath);
    if (!cover?.url) throw new ApiError(500, "Failed to upload cover image");

    // Extract old public ID and delete if exists
    if (Branch.coverImage && Branch.coverImage.includes("cloudinary")) {
      const publicId = Branch.coverImage.split("/").pop().split(".")[0];
      await deleteFile(publicId);
    }

    Branch.coverImage = cover.url;
    await Branch.save();

    return { Branch };
  },

  // 🚀 ACCEPT JOIN REQUEST (Teacher/Admin/Owner)
  acceptJoinRequestService: async (roomId, membershipId, userId) => {
    const Branch = await Branch.findById(roomId);
    if (!Branch) throw new ApiError(404, "Branch not found");
    if (Branch.isDeleted) throw new ApiError(404, "Branch not found");

    // Get current user info
    const currentUser = await User.findById(userId);
    if (!currentUser) throw new ApiError(404, "User not found");

    // Check if user has permission: OWNER, ADMIN, or TEACHER (who is member)
    const isOwner = currentUser.userType === USER_TYPES.OWNER;
    const isAdmin = currentUser.userType === USER_TYPES.ADMIN;

    let isTeacher = false;
    if (currentUser.userType === USER_TYPES.TEACHER) {
      const userMembership = await BranchMembership.findOne({
        Branch: roomId,
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
    const membership = await BranchMembership.findById(membershipId);
    if (!membership) {
      throw new ApiError(404, "Join request not found");
    }

    if (membership.Branch.toString() !== roomId.toString()) {
      throw new ApiError(400, "Invalid request");
    }

    if (!membership.isPending) {
      throw new ApiError(400, "This request has already been accepted");
    }

    // Accept the request
    membership.isPending = false;
    await membership.save();

    // Increment members count
    await Branch.findByIdAndUpdate(roomId, { $inc: { membersCount: 1 } });

    return {
      membershipId: membership._id,
      message: "Join request accepted successfully",
    };
  },

  // 🚀 REJECT JOIN REQUEST (Teacher/Admin/Owner) - Deletes the request
  rejectJoinRequestService: async (roomId, membershipId, userId) => {
    const Branch = await Branch.findById(roomId);
    if (!Branch) throw new ApiError(404, "Branch not found");
    if (Branch.isDeleted) throw new ApiError(404, "Branch not found");

    // Get current user info
    const currentUser = await User.findById(userId);
    if (!currentUser) throw new ApiError(404, "User not found");

    // Check if user has permission: OWNER, ADMIN, or TEACHER (who is member)
    const isOwner = currentUser.userType === USER_TYPES.OWNER;
    const isAdmin = currentUser.userType === USER_TYPES.ADMIN;

    let isTeacher = false;
    if (currentUser.userType === USER_TYPES.TEACHER) {
      const userMembership = await BranchMembership.findOne({
        Branch: roomId,
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
    const membership = await BranchMembership.findById(membershipId);
    if (!membership) {
      throw new ApiError(404, "Join request not found");
    }

    if (membership.Branch.toString() !== roomId.toString()) {
      throw new ApiError(400, "Invalid request");
    }

    if (!membership.isPending) {
      throw new ApiError(400, "This request has already been accepted");
    }

    // Delete the request
    await BranchMembership.findByIdAndDelete(membershipId);

    return {
      membershipId,
      message: "Join request rejected",
    };
  },
};

// ==========================================
// Branch SERVICES
// ==========================================
const roomServices = {
  // 🚀 GET ALL ROOMS (Public - anyone can see)
  getAllRoomsService: async (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    const rooms = await Branch.find({
      isDeleted: false,
    })
      .populate("creator", "fullName userName avatar")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const formattedRooms = rooms.map((Branch) => ({
      _id: Branch._id,
      name: Branch.name,
      description: Branch.description,
      coverImage: Branch.coverImage,
      roomType: Branch.roomType,
      creator: {
        _id: Branch.creator._id,
        fullName: Branch.creator.fullName,
        userName: Branch.creator.userName,
        avatar: Branch.creator.avatar,
      },
      membersCount: Branch.membersCount,
      postsCount: Branch.postsCount,
      createdAt: Branch.createdAt,
    }));

    const totalDocs = await Branch.countDocuments({
      isDeleted: false,
    });

    const pagination = {
      totalDocs,
      limit: parseInt(limit),
      page: parseInt(page),
      totalPages: Math.ceil(totalDocs / limit),
      hasNextPage: parseInt(page) < Math.ceil(totalDocs / limit),
      hasPrevPage: parseInt(page) > 1,
    };

    return { rooms: formattedRooms, pagination };
  },

  // 🚀 GET MY ROOMS (User's joined rooms only)
  getMyRoomsService: async (userId, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    // Get all Branch IDs that are not deleted
    const validRooms = await Branch.find({
      isDeleted: false,
    }).distinct("_id");

    // Find memberships for valid rooms only
    const memberships = await BranchMembership.find({
      user: userId,
      isPending: false,
      Branch: { $in: validRooms },
    })
      .populate({
        path: "Branch",
        populate: {
          path: "creator",
          select: "fullName userName avatar",
        },
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const rooms = memberships.map((membership) => {
      const Branch = membership.Branch;
      return {
        _id: Branch._id,
        name: Branch.name,
        description: Branch.description,
        coverImage: Branch.coverImage,
        roomType: Branch.roomType,
        creator: {
          _id: Branch.creator._id,
          fullName: Branch.creator.fullName,
          userName: Branch.creator.userName,
          avatar: Branch.creator.avatar,
        },
        membersCount: Branch.membersCount,
        postsCount: Branch.postsCount,
        joinCode: Branch.joinCode,
        isCR: membership.isCR,
        createdAt: Branch.createdAt,
      };
    });

    // Get total count
    const totalDocs = await BranchMembership.countDocuments({
      user: userId,
      isPending: false,
      Branch: { $in: validRooms },
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

  // 🚀 GET Branch DETAILS
  getRoomDetailsService: async (roomId, userId) => {
    const Branch = await Branch.findById(roomId).populate(
      "creator",
      "fullName userName avatar"
    );

    if (!Branch) {
      throw new ApiError(404, "Branch not found");
    }

    if (Branch.isDeleted) {
      throw new ApiError(404, "Branch not found");
    }

    // Check membership
    const membership = await BranchMembership.findOne({
      Branch: roomId,
      user: userId,
    });

    const user = await User.findById(userId);

    const isCreator = Branch.creator._id.toString() === userId.toString();
    const isOwner = user?.userType === USER_TYPES.OWNER;
    const isAdmin = user?.userType === USER_TYPES.ADMIN;

    const meta = {
      isMember: !!membership,
      isOwner,
      isAdmin,
      isCreator,
      isRoomAdmin: membership?.isAdmin || false,
      isCR: membership?.isCR || false,
      joinCode: membership ? Branch.joinCode : null, // Only show to members
      // Button visibility logic:
      // - Owner: Can create rooms (show create button on Branch list)
      // - Admin: Already member of all rooms (no join button needed)
      // - Normal/Teacher: Show join button if not member
      canJoin: !isOwner && !isAdmin && !membership,
      canCreate: isOwner,
    };

    return { Branch, meta };
  },
};

// ==========================================
// Branch POSTS & MEMBERS
// ==========================================
const roomPostsAndMembers = {
  // 🚀 CREATE Branch POST
  createRoomPostService: async (roomId, userId, postData) => {
    const Branch = await Branch.findById(roomId);
    if (!Branch) throw new ApiError(404, "Branch not found");
    if (Branch.isDeleted) throw new ApiError(404, "Branch not found");

    // Check membership
    const membership = await BranchMembership.findOne({
      Branch: roomId,
      user: userId,
    });
    if (!membership) {
      throw new ApiError(403, "You must be a member to post in this Branch");
    }

    const user = await User.findById(userId);

    // Check if student posting is allowed
    if (
      user.userType === "STUDENT" &&
      Branch.settings?.allowStudentPosting === false
    ) {
      throw new ApiError(403, "Student posting is disabled in this Branch");
    }

    // Prepare post data
    const newPostData = {
      ...postData,
      postOnModel: POST_TARGET_MODELS.Branch,
      postOnId: roomId,
    };

    // Create post using common service (handles postsCount increment)
    const formattedPost = await createPostService(newPostData, userId);

    return formattedPost;
  },

  // 🚀 GET Branch POSTS
  getRoomPostsService: async (roomId, userId, page = 1, limit = 10) => {
    const Branch = await Branch.findById(roomId);
    if (!Branch) throw new ApiError(404, "Branch not found");
    if (Branch.isDeleted) throw new ApiError(404, "Branch not found");

    // Check membership
    const membership = await BranchMembership.findOne({
      Branch: roomId,
      user: userId,
    });
    if (!membership) {
      throw new ApiError(403, "You are not a member of this Branch");
    }

    const skip = (page - 1) * limit;

    const posts = await Post.find({
      postOnModel: POST_TARGET_MODELS.Branch,
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

    const isCreator = Branch.creator.toString() === userId.toString();
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
      postOnModel: POST_TARGET_MODELS.Branch,
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

  // 🚀 GET Branch MEMBERS
  getRoomMembersService: async (roomId, userId, page = 1, limit = 10) => {
    const Branch = await Branch.findById(roomId);
    if (!Branch) throw new ApiError(404, "Branch not found");
    if (Branch.isDeleted) throw new ApiError(404, "Branch not found");

    // Check membership
    const currentUserMembership = await BranchMembership.findOne({
      Branch: roomId,
      user: userId,
    });
    if (!currentUserMembership) {
      throw new ApiError(403, "You are not a member of this Branch");
    }

    const skip = (page - 1) * limit;

    const memberships = await BranchMembership.find({ Branch: roomId })
      .populate("user", "fullName userName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const isCreator = Branch.creator.toString() === userId.toString();
    const isAdmin = currentUserMembership.isAdmin;

    const members = memberships.map((membership) => {
      const user = membership.user;
      const userIdStr = user._id.toString();
      const isSelf = userIdStr === userId.toString();

      // Determine role
      let role = "MEMBER";
      if (Branch.creator.toString() === userIdStr) {
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
          isCreator: Branch.creator.toString() === userIdStr,
        },
      };
    });

    const total = await BranchMembership.countDocuments({ Branch: roomId });

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
    const Branch = await Branch.findById(roomId);
    if (!Branch) throw new ApiError(404, "Branch not found");
    if (Branch.isDeleted) throw new ApiError(404, "Branch not found");

    // Get current user info
    const currentUser = await User.findById(userId);
    if (!currentUser) throw new ApiError(404, "User not found");

    // Check if user has permission: OWNER, ADMIN, or TEACHER (who is member)
    const isOwner = currentUser.userType === USER_TYPES.OWNER;
    const isAdmin = currentUser.userType === USER_TYPES.ADMIN;

    let isTeacher = false;
    if (currentUser.userType === USER_TYPES.TEACHER) {
      const userMembership = await BranchMembership.findOne({
        Branch: roomId,
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

    const requests = await BranchMembership.find({
      Branch: roomId,
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

    const total = await BranchMembership.countDocuments({
      Branch: roomId,
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

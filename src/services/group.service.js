import mongoose from "mongoose";
import { Group } from "../models/group.model.js";
import { GroupMembership } from "../models/groupMembership.model.js";
import { Friendship } from "../models/friendship.model.js"; // Import Friendship
import {
  GROUP_TYPES,
  GROUP_ROLES,
  GROUP_MEMBERSHIP_STATUS,
  GROUP_PRIVACY,
  GROUP_JOIN_METHOD,
  POST_TARGET_MODELS,
  REACTION_TARGET_MODELS,
  PROFILE_RELATION_STATUS, // Import Profile Status
  FRIENDSHIP_STATUS, // Import Friendship Status
  POST_VISIBILITY,
  POST_TYPES,
  POST_STATUS,
} from "../constants/index.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadFile, deleteFile } from "../utils/cloudinaryFileUpload.js";
import { Post } from "../models/post.model.js";
import { ReadPost } from "../models/readPost.model.js";
import { Reaction } from "../models/reaction.model.js";
import { Comment } from "../models/comment.model.js";
import { createPostService } from "./common/post.service.js";
import { mapUserToResponse } from "../utils/responseMappers.js"; // Import Mapper

const groupActions = {
  createGroupService: async (groupData, userId) => {
    // Handle settings (could be JSON string from FormData or Object from JSON request)
    let parsedSettings = groupData.settings;
    if (typeof groupData.settings === "string") {
      try {
        parsedSettings = JSON.parse(groupData.settings);
      } catch (error) {
        parsedSettings = {
          allowMemberPosting: true,
          requirePostApproval: false,
        };
      }
    } else if (!parsedSettings) {
      // Default settings if missing
      parsedSettings = {
        allowMemberPosting: true,
        requirePostApproval: false,
      };
    }

    // Generate unique slug
    const baseSlug = groupData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    let slug = baseSlug;
    let isSlugUnique = false;

    // First check with base slug
    let existingGroup = await Group.findOne({ slug });
    if (!existingGroup) {
      isSlugUnique = true;
    }

    // If base slug exists, append timestamp
    if (!isSlugUnique) {
      slug = `${baseSlug}-${Date.now()}`;
      existingGroup = await Group.findOne({ slug });
      if (!existingGroup) {
        isSlugUnique = true;
      }
    }

    // If even with timestamp it exists (extremely unlikely), loop to find one
    while (!isSlugUnique) {
      slug = `${baseSlug}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      existingGroup = await Group.findOne({ slug });
      if (!existingGroup) {
        isSlugUnique = true;
      }
    }

    // Create Group
    const group = await Group.create({
      name: groupData.name,
      slug,
      description: groupData.description || "",
      type: groupData.type || GROUP_TYPES.GENERAL,
      privacy: groupData.privacy || GROUP_PRIVACY.PUBLIC,
      creator: userId,
      owner: userId,
      membersCount: 1,
      avatar:
        "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=500&auto=format&fit=crop&q=60", // Open Book on White Background
      settings: parsedSettings || {},
      coverImage:
        "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&auto=format&fit=crop&q=60", // Study Desk/Books
    });

    if (!group) {
      throw new ApiError(500, "Failed to create group");
    }

    // Add Creator as Member (OWNER)
    await GroupMembership.create({
      group: group._id,
      user: userId,
      role: GROUP_ROLES.OWNER,
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
      joinedAt: new Date(),
      joinMethod: GROUP_JOIN_METHOD.CREATOR,
    });

    const meta = {
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
      isMember: true,
      isAdmin: true, // Owner is admin
      isOwner: true,
    };

    return { group, meta };
  },

  deleteGroupService: async (groupId, userId) => {
    // 1. Find Group
    const group = await Group.findById(groupId);
    if (!group) {
      throw new ApiError(404, "Group not found");
    }

    // 2. Verify Owner
    const ownerMembership = await GroupMembership.findOne({
      group: groupId,
      user: userId,
      role: GROUP_ROLES.OWNER,
    });

    if (!ownerMembership) {
      throw new ApiError(403, "Only the owner can delete the group");
    }

    // 3. Soft Delete Group
    await Group.findByIdAndUpdate(groupId, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId,
    });

    // 4. Soft Delete All Memberships
    await GroupMembership.updateMany({ group: groupId }, { isDeleted: true });

    // 5. Find all posts of this group
    const groupPosts = await Post.find({
      postOnModel: POST_TARGET_MODELS.GROUP,
      postOnId: groupId,
      isDeleted: false,
    }).select("_id");

    const postIds = groupPosts.map((p) => p._id);

    // 6. Soft Delete All Posts and their Comments
    if (postIds.length > 0) {
      // Soft delete posts
      await Post.updateMany({ _id: { $in: postIds } }, { isDeleted: true });

      // Soft delete comments
      await Comment.updateMany({ post: { $in: postIds } }, { isDeleted: true });
    }

    return { groupId };
  },

  inviteMembersService: async (groupId, userId, targetUserIds) => {
    // 1. Find Group
    const group = await Group.findById(groupId);
    if (!group) {
      throw new ApiError(404, "Group not found");
    }

    // 2. Verify Inviter is a Member
    const inviterMembership = await GroupMembership.findOne({
      group: groupId,
      user: userId,
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
    });

    if (!inviterMembership) {
      throw new ApiError(403, "You must be a member to invite others");
    }

    // 3. Process Invites
    const results = [];
    for (const targetId of targetUserIds) {
      // Check if already related
      const existing = await GroupMembership.findOne({
        group: groupId,
        user: targetId,
      });

      if (existing) {
        // Check if user is banned
        if (existing.status === GROUP_MEMBERSHIP_STATUS.BANNED) {
          results.push({ userId: targetId, status: "BANNED" });
          continue;
        }
        results.push({ userId: targetId, status: "ALREADY_ASSOCIATED" });
        continue;
      }

      // Create Invite
      await GroupMembership.create({
        group: groupId,
        user: targetId,
        status: GROUP_MEMBERSHIP_STATUS.INVITED,
        role: GROUP_ROLES.MEMBER,
        inviter: userId, // Assuming schema supports inviter field, if not it's fine
      });

      results.push({ userId: targetId, status: "INVITED" });
    }

    return { results };
  },

  leaveGroupService: async (groupId, userId) => {
    // 1. Check if group exists (including deleted ones)
    // We use findOne instead of findById to potentially include deleted documents if your schema supports soft delete
    // Assuming standard Mongoose behavior, findById only returns non-deleted docs if a global plugin is used.
    // If you are using soft delete with 'isDeleted' field:
    let group = await Group.findOne({ _id: groupId });

    if (!group) {
      // If absolutely no record found
      throw new ApiError(404, "Group not found");
    }

    // Check for soft deleted group
    if (group.isDeleted) {
      throw new ApiError(404, "This group has been deleted");
    }

    // 2. Check membership
    const membership = await GroupMembership.findOne({
      group: groupId,
      user: userId,
    });

    if (!membership) {
      throw new ApiError(404, "You are not a member of this group");
    }

    // 3. Check if Owner
    if (membership.role === GROUP_ROLES.OWNER) {
      throw new ApiError(
        400,
        "Owner cannot leave the group. Please transfer ownership first."
      );
    }

    // 4. Remove membership (Admin or Member)
    // If Admin leaves, they lose admin rights automatically as membership is gone
    await GroupMembership.findByIdAndDelete(membership._id);

    // 5. Decrement member count only if they were a joined member
    if (membership.status === GROUP_MEMBERSHIP_STATUS.JOINED) {
      await Group.findByIdAndUpdate(groupId, {
        $inc: { membersCount: -1 },
      });
    }

    return {
      status: null,
    };
  },

  joinGroupService: async (groupId, userId) => {
    const group = await Group.findById(groupId);
    if (!group) {
      throw new ApiError(404, "Group not found");
    }

    // Check if already a member or pending
    const existingMembership = await GroupMembership.findOne({
      group: groupId,
      user: userId,
    });

    if (existingMembership) {
      if (existingMembership.status === GROUP_MEMBERSHIP_STATUS.JOINED) {
        throw new ApiError(400, "Already a member of this group");
      }
      if (existingMembership.status === GROUP_MEMBERSHIP_STATUS.PENDING) {
        throw new ApiError(400, "Join request already sent");
      }
      if (existingMembership.status === GROUP_MEMBERSHIP_STATUS.BANNED) {
        throw new ApiError(403, "You are banned from this group");
      }
      if (existingMembership.status === GROUP_MEMBERSHIP_STATUS.INVITED) {
        // If invited, auto-accept
        existingMembership.status = GROUP_MEMBERSHIP_STATUS.JOINED;
        existingMembership.joinedAt = new Date();
        existingMembership.joinMethod = GROUP_JOIN_METHOD.INVITE;
        await existingMembership.save();
        await Group.findByIdAndUpdate(groupId, { $inc: { membersCount: 1 } });
        return { status: GROUP_MEMBERSHIP_STATUS.JOINED };
      }
    }

    // Logic for Public vs Private Group
    let status = GROUP_MEMBERSHIP_STATUS.PENDING;
    let joinedAt = undefined;
    let joinMethod = GROUP_JOIN_METHOD.REQUEST_APPROVAL;

    if (group.privacy === GROUP_PRIVACY.PUBLIC) {
      status = GROUP_MEMBERSHIP_STATUS.JOINED;
      joinedAt = new Date();
      joinMethod = GROUP_JOIN_METHOD.DIRECT_JOIN;
      await Group.findByIdAndUpdate(groupId, { $inc: { membersCount: 1 } });
    }

    await GroupMembership.create({
      group: groupId,
      user: userId,
      status,
      role: GROUP_ROLES.MEMBER,
      joinedAt,
      joinMethod,
    });

    return { status };
  },

  cancelJoinRequestService: async (groupId, userId) => {
    const group = await Group.findById(groupId);
    if (!group) {
      throw new ApiError(404, "Group not found");
    }

    const membership = await GroupMembership.findOneAndDelete({
      group: groupId,
      user: userId,
      status: GROUP_MEMBERSHIP_STATUS.PENDING,
    });

    if (!membership) {
      throw new ApiError(404, "No pending request found to cancel");
    }

    return { status: null };
  },

  acceptJoinRequestService: async (groupId, adminId, targetUserId) => {
    // 1. Find Group
    const group = await Group.findById(groupId);
    if (!group) {
      throw new ApiError(404, "Group not found");
    }

    // 2. Validate Admin Permissions
    const adminMembership = await GroupMembership.findOne({
      group: groupId,
      user: adminId,
      role: {
        $in: [GROUP_ROLES.OWNER, GROUP_ROLES.ADMIN, GROUP_ROLES.MODERATOR],
      },
    });

    if (!adminMembership) {
      throw new ApiError(403, "You do not have permission to accept requests");
    }

    // 3. Find Request
    const membership = await GroupMembership.findOne({
      group: groupId,
      user: targetUserId,
      status: GROUP_MEMBERSHIP_STATUS.PENDING,
    });

    if (!membership) {
      throw new ApiError(404, "Join request not found or not pending");
    }

    // 4. Accept Request
    membership.status = GROUP_MEMBERSHIP_STATUS.JOINED;
    membership.joinedAt = new Date();
    await membership.save();

    // 5. Update Group Count
    await Group.findByIdAndUpdate(groupId, {
      $inc: { membersCount: 1 },
    });

    return { status: GROUP_MEMBERSHIP_STATUS.JOINED };
  },

  rejectJoinRequestService: async (groupId, adminId, targetUserId) => {
    // 1. Find Group
    const group = await Group.findById(groupId);
    if (!group) {
      throw new ApiError(404, "Group not found");
    }

    // 2. Validate Admin Permissions
    const adminMembership = await GroupMembership.findOne({
      group: groupId,
      user: adminId,
      role: {
        $in: [GROUP_ROLES.OWNER, GROUP_ROLES.ADMIN, GROUP_ROLES.MODERATOR],
      },
    });

    if (!adminMembership) {
      throw new ApiError(403, "You do not have permission to reject requests");
    }

    // 3. Find Request
    const membership = await GroupMembership.findOne({
      group: groupId,
      user: targetUserId,
      status: GROUP_MEMBERSHIP_STATUS.PENDING,
    });

    if (!membership) {
      throw new ApiError(404, "Join request not found or not pending");
    }

    // 4. Reject (Delete) Request
    await GroupMembership.findByIdAndDelete(membership._id);

    return { status: null };
  },

  removeMemberService: async (groupId, memberId, adminId) => {
    // 1. Validate Group
    const group = await Group.findById(groupId);
    if (!group) throw new ApiError(404, "Group not found");

    // 2. Validate Admin Permissions
    const adminMembership = await GroupMembership.findOne({
      group: groupId,
      user: adminId,
      role: { $in: [GROUP_ROLES.OWNER, GROUP_ROLES.ADMIN] },
    });
    if (!adminMembership) {
      throw new ApiError(403, "You do not have permission to remove members");
    }

    // 3. Validate Target Member
    const targetMembership = await GroupMembership.findOne({
      group: groupId,
      user: memberId,
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
    });
    if (!targetMembership)
      throw new ApiError(404, "Member not found or not joined");

    // 4. Prevent removing Owner
    if (targetMembership.role === GROUP_ROLES.OWNER) {
      throw new ApiError(400, "Cannot remove the group owner");
    }

    // 5. Prevent Admin removing another Admin (Only Owner can)
    if (
      targetMembership.role === GROUP_ROLES.ADMIN &&
      adminMembership.role !== GROUP_ROLES.OWNER
    ) {
      throw new ApiError(403, "Only the owner can remove admins");
    }

    // 6. Remove Member
    await GroupMembership.findByIdAndDelete(targetMembership._id);
    await Group.findByIdAndUpdate(groupId, { $inc: { membersCount: -1 } });

    return { memberId };
  },

  assignAdminService: async (groupId, memberId, ownerId) => {
    // 1. Verify Group
    const group = await Group.findById(groupId);
    if (!group) throw new ApiError(404, "Group not found");

    // 2. Verify Owner
    const ownerMembership = await GroupMembership.findOne({
      group: groupId,
      user: ownerId,
      role: GROUP_ROLES.OWNER,
    });
    if (!ownerMembership)
      throw new ApiError(403, "Only owner can assign admins");

    // 2. Update Role
    const member = await GroupMembership.findOneAndUpdate(
      {
        group: groupId,
        user: memberId,
        status: GROUP_MEMBERSHIP_STATUS.JOINED,
      },
      { role: GROUP_ROLES.ADMIN },
      { new: true }
    );

    if (!member) throw new ApiError(404, "Member not found or not joined");

    return { role: GROUP_ROLES.ADMIN };
  },

  revokeAdminService: async (groupId, memberId, ownerId) => {
    // 1. Verify Owner
    const ownerMembership = await GroupMembership.findOne({
      group: groupId,
      user: ownerId,
      role: GROUP_ROLES.OWNER,
    });
    if (!ownerMembership)
      throw new ApiError(403, "Only owner can revoke admins");

    // 2. Update Role
    const member = await GroupMembership.findOneAndUpdate(
      {
        group: groupId,
        user: memberId,
        status: GROUP_MEMBERSHIP_STATUS.JOINED,
      },
      { role: GROUP_ROLES.MEMBER },
      { new: true }
    );

    if (!member) throw new ApiError(404, "Member not found or not joined");

    return { role: GROUP_ROLES.MEMBER };
  },

  // ==========================================
  // PROMOTE MEMBER TO MODERATOR (Owner Only)
  // ==========================================
  promoteToModeratorService: async (groupId, memberId, ownerId) => {
    // 1. Verify Owner
    const ownerMembership = await GroupMembership.findOne({
      group: groupId,
      user: ownerId,
      role: GROUP_ROLES.OWNER,
    });
    if (!ownerMembership)
      throw new ApiError(403, "Only owner can promote members");

    // 2. Find target member
    const targetMembership = await GroupMembership.findOne({
      group: groupId,
      user: memberId,
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
    });
    if (!targetMembership) throw new ApiError(404, "Member not found");

    // 3. Verify target is a MEMBER
    if (targetMembership.role !== GROUP_ROLES.MEMBER) {
      throw new ApiError(400, "Can only promote members to moderator");
    }

    // 4. Update Role
    targetMembership.role = GROUP_ROLES.MODERATOR;
    await targetMembership.save();

    return { role: GROUP_ROLES.MODERATOR };
  },

  // ==========================================
  // PROMOTE MODERATOR TO ADMIN (Owner Only)
  // ==========================================
  promoteToAdminService: async (groupId, memberId, ownerId) => {
    // 1. Verify Owner
    const ownerMembership = await GroupMembership.findOne({
      group: groupId,
      user: ownerId,
      role: GROUP_ROLES.OWNER,
    });
    if (!ownerMembership)
      throw new ApiError(403, "Only owner can promote to admin");

    // 2. Find target member
    const targetMembership = await GroupMembership.findOne({
      group: groupId,
      user: memberId,
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
    });
    if (!targetMembership) throw new ApiError(404, "Member not found");

    // 3. Verify target is a MODERATOR
    if (targetMembership.role !== GROUP_ROLES.MODERATOR) {
      throw new ApiError(400, "Can only promote moderators to admin");
    }

    // 4. Update Role
    targetMembership.role = GROUP_ROLES.ADMIN;
    await targetMembership.save();

    return { role: GROUP_ROLES.ADMIN };
  },

  // ==========================================
  // DEMOTE ADMIN TO MODERATOR (Owner Only)
  // ==========================================
  demoteToModeratorService: async (groupId, memberId, ownerId) => {
    // 1. Verify Owner
    const ownerMembership = await GroupMembership.findOne({
      group: groupId,
      user: ownerId,
      role: GROUP_ROLES.OWNER,
    });
    if (!ownerMembership)
      throw new ApiError(403, "Only owner can demote admins");

    // 2. Find target member
    const targetMembership = await GroupMembership.findOne({
      group: groupId,
      user: memberId,
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
    });
    if (!targetMembership) throw new ApiError(404, "Member not found");

    // 3. Verify target is an ADMIN
    if (targetMembership.role !== GROUP_ROLES.ADMIN) {
      throw new ApiError(400, "Can only demote admins to moderator");
    }

    // 4. Update Role
    targetMembership.role = GROUP_ROLES.MODERATOR;
    await targetMembership.save();

    return { role: GROUP_ROLES.MODERATOR };
  },

  // ==========================================
  // DEMOTE MODERATOR TO MEMBER (Owner Only)
  // ==========================================
  demoteToMemberService: async (groupId, memberId, ownerId) => {
    // 1. Verify Owner
    const ownerMembership = await GroupMembership.findOne({
      group: groupId,
      user: ownerId,
      role: GROUP_ROLES.OWNER,
    });
    if (!ownerMembership)
      throw new ApiError(403, "Only owner can demote moderators");

    // 2. Find target member
    const targetMembership = await GroupMembership.findOne({
      group: groupId,
      user: memberId,
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
    });
    if (!targetMembership) throw new ApiError(404, "Member not found");

    // 3. Verify target is a MODERATOR
    if (targetMembership.role !== GROUP_ROLES.MODERATOR) {
      throw new ApiError(400, "Can only demote moderators to member");
    }

    // 4. Update Role
    targetMembership.role = GROUP_ROLES.MEMBER;
    await targetMembership.save();

    return { role: GROUP_ROLES.MEMBER };
  },

  // ==========================================
  // TRANSFER OWNERSHIP (Owner Only, to Admin)
  // ==========================================
  transferOwnershipService: async (groupId, newOwnerId, currentOwnerId) => {
    // 1. Verify current owner
    const currentOwnerMembership = await GroupMembership.findOne({
      group: groupId,
      user: currentOwnerId,
      role: GROUP_ROLES.OWNER,
    });
    if (!currentOwnerMembership)
      throw new ApiError(403, "Only owner can transfer ownership");

    // 2. Find new owner (must be ADMIN)
    const newOwnerMembership = await GroupMembership.findOne({
      group: groupId,
      user: newOwnerId,
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
    });
    if (!newOwnerMembership) throw new ApiError(404, "Member not found");

    // 3. Verify new owner is an ADMIN
    if (newOwnerMembership.role !== GROUP_ROLES.ADMIN) {
      throw new ApiError(400, "Can only transfer ownership to an admin");
    }

    // 4. Update roles
    currentOwnerMembership.role = GROUP_ROLES.ADMIN;
    newOwnerMembership.role = GROUP_ROLES.OWNER;

    await currentOwnerMembership.save();
    await newOwnerMembership.save();

    return {
      previousOwnerRole: GROUP_ROLES.ADMIN,
      newOwnerRole: GROUP_ROLES.OWNER,
    };
  },

  // ==========================================
  // BAN MEMBER (Owner/Admin/Moderator can ban lower roles)
  // ==========================================
  banMemberService: async (groupId, targetUserId, actorId) => {
    // Role hierarchy: OWNER > ADMIN > MODERATOR > MEMBER
    const roleHierarchy = {
      [GROUP_ROLES.OWNER]: 4,
      [GROUP_ROLES.ADMIN]: 3,
      [GROUP_ROLES.MODERATOR]: 2,
      [GROUP_ROLES.MEMBER]: 1,
    };

    // 1. Get actor's membership
    const actorMembership = await GroupMembership.findOne({
      group: groupId,
      user: actorId,
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
    });
    if (!actorMembership) throw new ApiError(403, "You are not a member");

    // 2. Check actor has permission (at least MODERATOR)
    if (
      roleHierarchy[actorMembership.role] < roleHierarchy[GROUP_ROLES.MODERATOR]
    ) {
      throw new ApiError(403, "You don't have permission to ban members");
    }

    // 3. Get target's membership
    const targetMembership = await GroupMembership.findOne({
      group: groupId,
      user: targetUserId,
      status: {
        $in: [GROUP_MEMBERSHIP_STATUS.JOINED, GROUP_MEMBERSHIP_STATUS.PENDING],
      },
    });
    if (!targetMembership)
      throw new ApiError(404, "Member or request not found");

    // 4. Check actor's role is higher than target's role
    if (
      roleHierarchy[actorMembership.role] <=
      roleHierarchy[targetMembership.role]
    ) {
      throw new ApiError(403, "Cannot ban someone with same or higher role");
    }

    // 5. Ban the member (change status to BANNED)
    targetMembership.status = GROUP_MEMBERSHIP_STATUS.BANNED;
    await targetMembership.save();

    // 6. Decrement member count
    await Group.findByIdAndUpdate(groupId, { $inc: { membersCount: -1 } });

    return { memberId: targetMembership._id };
  },

  createGroupPostService: async (groupId, userId, postData) => {
    // 1. Find Group
    const group = await Group.findById(groupId);
    if (!group) {
      throw new ApiError(404, "Group not found");
    }

    // 2. Check Membership
    const membership = await GroupMembership.findOne({
      group: groupId,
      user: userId,
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
    });

    if (!membership) {
      throw new ApiError(403, "You must be a member to post in this group");
    }

    // 3. Check Settings (Allow Member Posting)
    if (
      membership.role === GROUP_ROLES.MEMBER &&
      group.settings?.allowMemberPosting === false
    ) {
      throw new ApiError(403, "Posting is disabled for members");
    }

    // 4. Prepare Post Data
    const newPostData = {
      ...postData,
      postOnModel: POST_TARGET_MODELS.GROUP,
      postOnId: groupId,
    };

    // 5. Create Post using common service
    const formattedPost = await createPostService(newPostData, userId);

    // 6. Update Group Stats
    await Group.findByIdAndUpdate(groupId, { $inc: { postsCount: 1 } });

    return formattedPost;
  },

  updateGroupDetailsService: async (groupId, userId, updateData) => {
    const { name, description, privacy, settings } = updateData;

    // 1. Find group
    const group = await Group.findById(groupId);
    if (!group) throw new ApiError(404, "Group not found");

    // 2. Permission check
    const membership = await GroupMembership.findOne({
      group: groupId,
      user: userId,
      role: { $in: [GROUP_ROLES.OWNER, GROUP_ROLES.ADMIN] },
    });
    if (!membership)
      throw new ApiError(403, "Only owners or admins can update group details");

    // 3. Update fields
    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (privacy) group.privacy = privacy;
    if (settings) {
      group.settings = { ...group.settings, ...settings };
    }

    await group.save();
    return group;
  },

  updateGroupAvatarService: async (groupId, userId, localFilePath) => {
    if (!localFilePath) throw new ApiError(400, "Avatar file missing");

    const group = await Group.findById(groupId);
    if (!group) throw new ApiError(404, "Group not found");

    const membership = await GroupMembership.findOne({
      group: groupId,
      user: userId,
      role: { $in: [GROUP_ROLES.OWNER, GROUP_ROLES.ADMIN] },
    });
    if (!membership) throw new ApiError(403, "Permission denied");

    const avatar = await uploadFile(localFilePath);
    if (!avatar?.url) throw new ApiError(500, "Failed to upload avatar");

    // Extract old public ID and delete if exists
    if (group.avatar && group.avatar.includes("cloudinary")) {
      const publicId = group.avatar.split("/").pop().split(".")[0];
      await deleteFile(publicId);
    }

    group.avatar = avatar.url;
    await group.save();

    return group;
  },

  updateGroupCoverImageService: async (groupId, userId, localFilePath) => {
    if (!localFilePath) throw new ApiError(400, "Cover image missing");

    const group = await Group.findById(groupId);
    if (!group) throw new ApiError(404, "Group not found");

    const membership = await GroupMembership.findOne({
      group: groupId,
      user: userId,
      role: { $in: [GROUP_ROLES.OWNER, GROUP_ROLES.ADMIN] },
    });
    if (!membership) throw new ApiError(403, "Permission denied");

    const cover = await uploadFile(localFilePath);
    if (!cover?.url) throw new ApiError(500, "Failed to upload cover image");

    // Extract old public ID and delete if exists
    if (group.coverImage && group.coverImage.includes("cloudinary")) {
      const publicId = group.coverImage.split("/").pop().split(".")[0];
      await deleteFile(publicId);
    }

    group.coverImage = cover.url;
    await group.save();

    return group;
  },

  updateMemberSettingsService: async (groupId, userId, settings) => {
    const membership = await GroupMembership.findOne({
      group: groupId,
      user: userId,
    });
    if (!membership) throw new ApiError(404, "Membership not found");

    if (!membership.settings) {
      membership.settings = {};
    }

    if (settings.isMuted !== undefined)
      membership.settings.isMuted = settings.isMuted;
    if (settings.isFollowing !== undefined)
      membership.settings.isFollowing = settings.isFollowing;
    if (settings.isPinned !== undefined)
      membership.settings.isPinned = settings.isPinned;

    await membership.save();
    return { settings: membership.settings };
  },
};

const groupServices = {
  getMyGroupsService: async (userId, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    // Find groups where the user is a member (JOINED) AND membership is NOT deleted
    // Note: When a group is deleted, all its memberships are also soft deleted
    const memberships = await GroupMembership.find({
      user: userId,
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
      isDeleted: { $ne: true },
    })
      .sort({ "settings.isPinned": -1, createdAt: -1, _id: 1 })
      .select("group status settings")
      .skip(skip)
      .limit(Number(limit))
      .populate({
        path: "group",
        select:
          "name slug description avatar coverImage type privacy membersCount postsCount",
      })
      .lean();

    // Get total count for pagination
    const totalDocs = await GroupMembership.countDocuments({
      user: userId,
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
      isDeleted: { $ne: true },
    });

    const totalPages = Math.ceil(totalDocs / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Format the response
    const groups = memberships.map((membership) => {
      return {
        group: membership.group,
        meta: {
          status: membership.status,
          settings: membership.settings,
        },
      };
    });

    return {
      groups,
      pagination: {
        totalDocs,
        limit: Number(limit),
        page: Number(page),
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    };
  },

  getUniversityGroupsService: async (userId, page = 1, limit = 10) => {
    const parsedPage = Number(page) || 1;
    const parsedLimit = Number(limit) || 10;
    const skip = (parsedPage - 1) * parsedLimit;

    const [bannedGroupIds, joinedGroupIds] = await Promise.all([
      GroupMembership.distinct("group", {
        user: userId,
        status: GROUP_MEMBERSHIP_STATUS.BANNED,
      }),
      GroupMembership.distinct("group", {
        user: userId,
        status: GROUP_MEMBERSHIP_STATUS.JOINED,
        isDeleted: { $ne: true },
      }),
    ]);

    const query = {
      type: GROUP_TYPES.OFFICIAL_INSTITUTION,
      isDeleted: { $ne: true },
      _id: { $nin: bannedGroupIds },
      $or: [
        { privacy: { $in: [GROUP_PRIVACY.PUBLIC, GROUP_PRIVACY.PRIVATE] } },
        { privacy: GROUP_PRIVACY.CLOSED, _id: { $in: joinedGroupIds } },
      ],
    };

    const [groupsData, totalDocs] = await Promise.all([
      Group.aggregate([
        // STEP 1: Filter groups based on type/privacy
        { $match: query },

        // STEP 2: Join with GroupMembership to get user-specific settings (Pin status)
        {
          $lookup: {
            from: "groupmemberships", // SQL Join-er moto Group settings khuje ana
            let: { groupId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$group", "$$groupId"] },
                      {
                        $eq: [
                          "$user",
                          new mongoose.Types.ObjectId(String(userId)),
                        ],
                      },
                      { $eq: ["$isDeleted", false] },
                    ],
                  },
                },
              },
            ],
            as: "userMembership",
          },
        },

        // STEP 3: Membership settings gulo easy access-er jonno top-level fields-e niye asha
        {
          $addFields: {
            isPinned: {
              $ifNull: [
                { $arrayElemAt: ["$userMembership.settings.isPinned", 0] },
                false,
              ],
            },
            status: {
              $ifNull: [{ $arrayElemAt: ["$userMembership.status", 0] }, null],
            },
            settings: {
              $ifNull: [
                { $arrayElemAt: ["$userMembership.settings", 0] },
                null,
              ],
            },
          },
        },

        // STEP 4: Sorting - Pinned groups always at the top
        { $sort: { isPinned: -1, createdAt: -1, _id: 1 } },

        // STEP 5: Pagination logic
        { $skip: skip },
        { $limit: parsedLimit },
      ]),
      Group.countDocuments(query),
    ]);

    const groups = groupsData.map((group) => {
      const { status, settings, isPinned, userMembership, ...groupData } =
        group;
      return {
        group: groupData,
        meta: {
          status,
          settings,
        },
      };
    });

    const totalPages = Math.ceil(totalDocs / parsedLimit);
    const hasNextPage = parsedPage < totalPages;
    const hasPrevPage = parsedPage > 1;

    return {
      groups,
      pagination: {
        totalDocs,
        limit: parsedLimit,
        page: parsedPage,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    };
  },

  getCareerGroupsService: async (userId, page = 1, limit = 10) => {
    const parsedPage = Number(page) || 1;
    const parsedLimit = Number(limit) || 10;
    const skip = (parsedPage - 1) * parsedLimit;

    const [bannedGroupIds, joinedGroupIds] = await Promise.all([
      GroupMembership.distinct("group", {
        user: userId,
        status: GROUP_MEMBERSHIP_STATUS.BANNED,
      }),
      GroupMembership.distinct("group", {
        user: userId,
        status: GROUP_MEMBERSHIP_STATUS.JOINED,
        isDeleted: { $ne: true },
      }),
    ]);

    const query = {
      type: GROUP_TYPES.JOBS_CAREERS,
      isDeleted: { $ne: true },
      _id: { $nin: bannedGroupIds },
      $or: [
        { privacy: { $in: [GROUP_PRIVACY.PUBLIC, GROUP_PRIVACY.PRIVATE] } },
        { privacy: GROUP_PRIVACY.CLOSED, _id: { $in: joinedGroupIds } },
      ],
    };

    const [groupsData, totalDocs] = await Promise.all([
      Group.aggregate([
        // STEP 1: Filter groups based on type/privacy
        { $match: query },

        // STEP 2: Join with GroupMembership to get user-specific settings (Pin status)
        {
          $lookup: {
            from: "groupmemberships", // SQL Join-er moto Group settings khuje ana
            let: { groupId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$group", "$$groupId"] },
                      {
                        $eq: [
                          "$user",
                          new mongoose.Types.ObjectId(String(userId)),
                        ],
                      },
                      { $eq: ["$isDeleted", false] },
                    ],
                  },
                },
              },
            ],
            as: "userMembership",
          },
        },

        // STEP 3: Membership settings gulo easy access-er jonno top-level fields-e niye asha
        {
          $addFields: {
            isPinned: {
              $ifNull: [
                { $arrayElemAt: ["$userMembership.settings.isPinned", 0] },
                false,
              ],
            },
            status: {
              $ifNull: [{ $arrayElemAt: ["$userMembership.status", 0] }, null],
            },
            settings: {
              $ifNull: [
                { $arrayElemAt: ["$userMembership.settings", 0] },
                null,
              ],
            },
          },
        },

        // STEP 4: Sorting - Pinned groups always at the top
        { $sort: { isPinned: -1, createdAt: -1, _id: 1 } },

        // STEP 5: Pagination logic
        { $skip: skip },
        { $limit: parsedLimit },
      ]),
      Group.countDocuments(query),
    ]);

    const groups = groupsData.map((group) => {
      const { status, settings, isPinned, userMembership, ...groupData } =
        group;
      return {
        group: groupData,
        meta: {
          status,
          settings,
        },
      };
    });

    const totalPages = Math.ceil(totalDocs / parsedLimit);
    const hasNextPage = parsedPage < totalPages;
    const hasPrevPage = parsedPage > 1;

    return {
      groups,
      pagination: {
        totalDocs,
        limit: parsedLimit,
        page: parsedPage,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    };
  },

  getSuggestedGroupsService: async (userId, page = 1, limit = 10) => {
    const parsedPage = Number(page) || 1;
    const parsedLimit = Number(limit) || 10;
    const skip = (parsedPage - 1) * parsedLimit;

    const [relatedGroupIds, bannedGroupIds] = await Promise.all([
      GroupMembership.distinct("group", {
        user: userId,
        isDeleted: { $ne: true },
      }),
      GroupMembership.distinct("group", {
        user: userId,
        status: GROUP_MEMBERSHIP_STATUS.BANNED,
      }),
    ]);

    const excludedGroupIdMap = new Map();
    for (const id of [...relatedGroupIds, ...bannedGroupIds]) {
      excludedGroupIdMap.set(id.toString(), id);
    }
    const excludedGroupIds = Array.from(excludedGroupIdMap.values());

    const query = {
      _id: { $nin: excludedGroupIds },
      privacy: { $ne: GROUP_PRIVACY.CLOSED },
      isDeleted: { $ne: true },
    };

    const [groupsData, totalDocs] = await Promise.all([
      Group.find(query)
        .sort({ membersCount: -1, createdAt: -1, _id: 1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      Group.countDocuments(query),
    ]);

    // All returned groups have no membership for this user by definition
    const groups = groupsData.map((group) => ({
      group,
      meta: { status: null },
    }));

    const totalPages = Math.ceil(totalDocs / parsedLimit);
    const hasNextPage = parsedPage < totalPages;
    const hasPrevPage = parsedPage > 1;

    return {
      groups,
      pagination: {
        totalDocs,
        limit: parsedLimit,
        page: parsedPage,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    };
  },

  getSentRequestsGroupsService: async (userId, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    const memberships = await GroupMembership.find({
      user: userId,
      status: GROUP_MEMBERSHIP_STATUS.PENDING,
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1, _id: 1 })
      .select("group")
      .skip(skip)
      .limit(Number(limit))
      .populate({
        path: "group",
        match: { isDeleted: { $ne: true } },
      });

    // Filter out memberships where group is null (deleted groups)
    const validMemberships = memberships.filter((m) => m.group !== null);

    const allMemberships = await GroupMembership.find({
      user: userId,
      status: GROUP_MEMBERSHIP_STATUS.PENDING,
      isDeleted: { $ne: true },
    })
      .select("group")
      .populate({
        path: "group",
        match: { isDeleted: { $ne: true } },
        select: "_id",
      });

    const totalDocs = allMemberships.filter((m) => m.group !== null).length;

    const totalPages = Math.ceil(totalDocs / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const groups = validMemberships.map((m) => {
      const groupObj = m.group.toObject ? m.group.toObject() : m.group;

      return {
        group: groupObj,
        meta: {
          status: GROUP_MEMBERSHIP_STATUS.PENDING,
        },
      };
    });

    return {
      groups,
      pagination: {
        totalDocs,
        limit: Number(limit),
        page: Number(page),
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    };
  },

  getInvitedGroupsService: async (userId, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    const memberships = await GroupMembership.find({
      user: userId,
      status: GROUP_MEMBERSHIP_STATUS.INVITED,
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1, _id: 1 })
      .select("group")
      .skip(skip)
      .limit(Number(limit))
      .populate({
        path: "group",
        match: { isDeleted: { $ne: true } },
      });

    // Filter out memberships where group is null (deleted groups)
    const validMemberships = memberships.filter((m) => m.group !== null);

    const allMemberships = await GroupMembership.find({
      user: userId,
      status: GROUP_MEMBERSHIP_STATUS.INVITED,
      isDeleted: { $ne: true },
    })
      .select("group")
      .populate({
        path: "group",
        match: { isDeleted: { $ne: true } },
        select: "_id",
      });

    const totalDocs = allMemberships.filter((m) => m.group !== null).length;

    const totalPages = Math.ceil(totalDocs / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const groups = validMemberships.map((m) => {
      const groupObj = m.group.toObject ? m.group.toObject() : m.group;

      return {
        group: groupObj,
        meta: {
          status: GROUP_MEMBERSHIP_STATUS.INVITED,
        },
      };
    });

    return {
      groups,
      pagination: {
        totalDocs,
        limit: Number(limit),
        page: Number(page),
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    };
  },

  getGroupDetailsService: async (slug, userId) => {
    const group = await Group.findOne({ slug }).lean();

    if (!group) {
      throw new ApiError(404, "Group not found");
    }

    // Check if group is soft deleted
    if (group.isDeleted) {
      throw new ApiError(404, "This group has been deleted");
    }

    // Get user's membership status
    const membership = await GroupMembership.findOne({
      group: group._id,
      user: userId,
      isDeleted: { $ne: true },
    }).lean();

    const status = membership ? membership.status : null;

    // Metadata
    const isMember = status === GROUP_MEMBERSHIP_STATUS.JOINED;
    const isAdmin = membership?.role === GROUP_ROLES.ADMIN;
    const isOwner = membership?.role === GROUP_ROLES.OWNER;
    const isModerator = membership?.role === GROUP_ROLES.MODERATOR;
    const isBanned = status === GROUP_MEMBERSHIP_STATUS.BANNED;

    const isRestricted =
      !isMember &&
      !isAdmin &&
      !isOwner &&
      !isModerator &&
      (group.privacy === GROUP_PRIVACY.PRIVATE ||
        group.privacy === GROUP_PRIVACY.CLOSED);

    const meta = {
      status,
      isAdmin,
      isOwner,
      isModerator,
      isMember,
      isBanned,
      isRestricted,
      settings: membership?.settings,
    };

    return { group, meta };
  },

  // ==========================================
  // 🚀 POST MODERATION SERVICES
  // ==========================================

  getPendingPostsService: async (groupId, userId, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    // 1. Verify Management Permission
    const membership = await GroupMembership.findOne({
      group: groupId,
      user: userId,
      role: {
        $in: [GROUP_ROLES.OWNER, GROUP_ROLES.ADMIN, GROUP_ROLES.MODERATOR],
      },
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
    });
    if (!membership) {
      throw new ApiError(
        403,
        "Only owner, admins and moderators can view pending posts"
      );
    }

    const query = {
      postOnModel: POST_TARGET_MODELS.GROUP,
      postOnId: groupId,
      status: POST_STATUS.PENDING,
      isDeleted: false,
    };

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("author", "fullName avatar userName")
      .lean();

    const totalDocs = await Post.countDocuments(query);
    const totalPages = Math.ceil(totalDocs / limit);

    return {
      posts,
      pagination: {
        totalDocs,
        limit: Number(limit),
        page: Number(page),
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  },

  approvePostService: async (groupId, postId, adminId) => {
    // 1. Verify Permission
    const membership = await GroupMembership.findOne({
      group: groupId,
      user: adminId,
      role: {
        $in: [GROUP_ROLES.OWNER, GROUP_ROLES.ADMIN, GROUP_ROLES.MODERATOR],
      },
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
    });
    if (!membership) {
      throw new ApiError(403, "Unauthorized to approve posts");
    }

    const post = await Post.findOne({
      _id: postId,
      postOnId: groupId,
      status: POST_STATUS.PENDING,
    });
    if (!post) throw new ApiError(404, "Pending post not found");

    post.status = POST_STATUS.APPROVED;
    await post.save();

    // Increment group post count
    await Group.findByIdAndUpdate(groupId, { $inc: { postsCount: 1 } });

    return { status: POST_STATUS.APPROVED };
  },

  rejectPostService: async (groupId, postId, adminId) => {
    // 1. Verify Permission
    const membership = await GroupMembership.findOne({
      group: groupId,
      user: adminId,
      role: {
        $in: [GROUP_ROLES.OWNER, GROUP_ROLES.ADMIN, GROUP_ROLES.MODERATOR],
      },
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
    });
    if (!membership) {
      throw new ApiError(403, "Unauthorized to reject posts");
    }

    const post = await Post.findOne({
      _id: postId,
      postOnId: groupId,
      status: POST_STATUS.PENDING,
    });
    if (!post) throw new ApiError(404, "Pending post not found");

    post.status = POST_STATUS.REJECTED;
    // Or we could delete it, but marking as rejected is safer for audit
    await post.save();

    return { status: POST_STATUS.REJECTED };
  },

  // Get unread counts for group tabs (lightweight API)
  getGroupUnreadCountsService: async (slug, userId) => {
    const group = await Group.findOne({ slug }).select("_id").lean();

    if (!group) {
      throw new ApiError(404, "Group not found");
    }

    // Get all posts user has read
    const readPostIds = await ReadPost.find({ user: userId })
      .select("post")
      .lean()
      .then((docs) => docs.map((d) => d.post));

    // Count unread pinned posts
    const unreadPinnedCount = await Post.countDocuments({
      postOnId: group._id,
      postOnModel: "Group",
      isPinned: true,
      isDeleted: false,
      _id: { $nin: readPostIds },
    });

    // Count unread marketplace posts
    const unreadMarketplaceCount = await Post.countDocuments({
      postOnId: group._id,
      postOnModel: "Group",
      type: POST_TYPES.BUY_SELL,
      isDeleted: false,
      _id: { $nin: readPostIds },
    });

    // Count pending join requests (Owner/Admin/Moderator only)
    const adminMembership = await GroupMembership.findOne({
      group: group._id,
      user: userId,
      role: {
        $in: [GROUP_ROLES.OWNER, GROUP_ROLES.ADMIN, GROUP_ROLES.MODERATOR],
      },
    }).select("role");

    let pendingRequestsCount = 0;
    let pendingPostsCount = 0;
    if (adminMembership) {
      // 1. Pending members
      pendingRequestsCount = await GroupMembership.countDocuments({
        group: group._id,
        status: GROUP_MEMBERSHIP_STATUS.PENDING,
      });

      // 2. Pending posts (Moderation)
      pendingPostsCount = await Post.countDocuments({
        postOnId: group._id,
        postOnModel: POST_TARGET_MODELS.GROUP,
        status: POST_STATUS.PENDING,
        isDeleted: false,
      });
    }

    const meta = {
      unreadPinnedCount,
      unreadMarketplaceCount,
      pendingRequestsCount,
      pendingPostsCount,
    };

    return { group: { _id: group._id }, meta };
  },

  getGroupMembersService: async (
    groupId,
    currentUserId,
    page = 1,
    limit = 10,
    status
  ) => {
    const skip = (page - 1) * limit;

    // Verify group exists
    const group = await Group.findById(groupId);
    if (!group) {
      throw new ApiError(404, "Group not found");
    }

    // Check if group is deleted
    if (group.isDeleted) {
      throw new ApiError(404, "This group has been deleted");
    }

    // Get current user's membership for role info
    const currentUserMembership = await GroupMembership.findOne({
      group: groupId,
      user: currentUserId,
      status: GROUP_MEMBERSHIP_STATUS.JOINED,
    });

    // Fetch members with proper nested populate
    const membersData = await GroupMembership.find({
      group: groupId,
      status: status || GROUP_MEMBERSHIP_STATUS.JOINED,
    })
      .populate({
        path: "user",
        select: "fullName userName avatar academicInfo userType institution",
        populate: [
          { path: "institution", select: "name" },
          { path: "academicInfo.department", select: "name" },
        ],
      })
      .sort({ joinedAt: -1 }) // Newest members first (by join date)
      .skip(skip)
      .limit(Number(limit));

    const totalDocs = await GroupMembership.countDocuments({
      group: groupId,
      status: status || GROUP_MEMBERSHIP_STATUS.JOINED,
    });

    // Get all member user IDs for friendship lookup
    const memberUserIds = membersData.map((m) => m.user._id);

    // Find all friendships between current user and members
    const friendships = await Friendship.find({
      $or: [
        { requester: currentUserId, recipient: { $in: memberUserIds } },
        { requester: { $in: memberUserIds }, recipient: currentUserId },
      ],
    });

    // Build friendship map with detailed status
    const friendshipMap = {};
    friendships.forEach((f) => {
      const isRequester = f.requester.toString() === currentUserId.toString();
      const otherUserId = isRequester
        ? f.recipient.toString()
        : f.requester.toString();

      friendshipMap[otherUserId] = {
        friendshipId: f._id,
        isFriend: f.status === FRIENDSHIP_STATUS.ACCEPTED,
        isSentRequest: f.status === FRIENDSHIP_STATUS.PENDING && isRequester,
        hasPendingRequest:
          f.status === FRIENDSHIP_STATUS.PENDING && !isRequester,
        isBlockedByMe: f.status === FRIENDSHIP_STATUS.BLOCKED && isRequester,
        isBlockedByThem: f.status === FRIENDSHIP_STATUS.BLOCKED && !isRequester,
      };
    });

    // Format members response
    const members = membersData
      .map((m) => {
        if (!m.user) return null;

        const userId = m.user._id.toString();
        const isSelf = userId === currentUserId.toString();
        const fsInfo = friendshipMap[userId] || {};

        return {
          user: {
            _id: m.user._id,
            userName: m.user.userName,
            fullName: m.user.fullName,
            avatar: m.user.avatar,
            userType: m.user.userType,
            institution: m.user.institution
              ? { _id: m.user.institution._id, name: m.user.institution.name }
              : null,
            department: m.user.academicInfo?.department
              ? {
                  _id: m.user.academicInfo.department._id,
                  name: m.user.academicInfo.department.name,
                }
              : null,
          },
          meta: {
            // Group role info
            role: m.role,
            status: m.status,
            memberId: m._id,
            joinedAt: m.joinedAt || m.createdAt,
            // Friendship info
            friendshipId: fsInfo.friendshipId || null,
            isFriend: isSelf ? false : fsInfo.isFriend || false,
            isSentRequest: isSelf ? false : fsInfo.isSentRequest || false,
            hasPendingRequest: isSelf
              ? false
              : fsInfo.hasPendingRequest || false,
            isBlockedByMe: isSelf ? false : fsInfo.isBlockedByMe || false,
            isBlockedByThem: isSelf ? false : fsInfo.isBlockedByThem || false,
            isSelf,
          },
        };
      })
      .filter(Boolean);

    const totalPages = Math.ceil(totalDocs / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      data: {
        members,
      },
      meta: {
        currentUserRole: currentUserMembership?.role || null,
      },
      pagination: {
        totalDocs,
        limit: Number(limit),
        page: Number(page),
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    };
  },

  getGroupFeedService: async (groupId, userId, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    // 1. Find Group
    const group = await Group.findById(groupId).select(
      "_id privacy settings isDeleted"
    );
    if (!group) {
      throw new ApiError(404, "Group not found");
    }

    // Check if group is deleted
    if (group.isDeleted) {
      throw new ApiError(404, "This group has been deleted");
    }

    // 2. Check Permission (If Private, must be member)
    // Fetch membership first for visibility filtering
    let userMembership = null;
    if (userId) {
      userMembership = await GroupMembership.findOne({
        group: groupId,
        user: userId,
      });
    }

    if (group.privacy === GROUP_PRIVACY.PRIVATE) {
      if (
        !userMembership ||
        userMembership.status !== GROUP_MEMBERSHIP_STATUS.JOINED
      ) {
        throw new ApiError(403, "You must be a member to view posts");
      }
    }

    // 3. Query Posts with visibility filter
    // Check if current user is a member
    const isMember =
      !!userMembership &&
      userMembership.status === GROUP_MEMBERSHIP_STATUS.JOINED;

    let visibilityFilter;
    if (isMember) {
      // Members can see: PUBLIC, CONNECTIONS, and their own ONLY_ME posts
      visibilityFilter = {
        $or: [
          { visibility: POST_VISIBILITY.PUBLIC },
          { visibility: POST_VISIBILITY.CONNECTIONS },
          { visibility: POST_VISIBILITY.ONLY_ME, author: userId },
        ],
      };
    } else {
      // Non-members can only see PUBLIC posts (if group is public)
      visibilityFilter = {
        $or: [
          { visibility: POST_VISIBILITY.PUBLIC },
          { visibility: POST_VISIBILITY.ONLY_ME, author: userId }, // Their own ONLY_ME if somehow they posted before leaving
        ],
      };
    }

    const query = {
      postOnModel: POST_TARGET_MODELS.GROUP,
      postOnId: groupId,
      isDeleted: false,
      isArchived: false,
      status: POST_STATUS.APPROVED,
      ...visibilityFilter,
    };

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("author", "fullName avatar userName")
      .lean();

    // 4. Add Context (Like, Read, Mine, Role)
    let viewedPostIds = new Set();
    let likedPostIds = new Set();
    const postIds = posts.map((p) => p._id);

    if (userId && posts.length > 0) {
      const viewedPosts = await ReadPost.find({
        user: userId,
        post: { $in: postIds },
      }).select("post");
      viewedPostIds = new Set(viewedPosts.map((vp) => vp.post.toString()));

      const likedPosts = await Reaction.find({
        user: userId,
        targetModel: REACTION_TARGET_MODELS.POST,
        targetId: { $in: postIds },
      }).select("targetId");
      likedPostIds = new Set(likedPosts.map((r) => r.targetId.toString()));
    }

    const postsWithContext = posts.map((post) => {
      const isMine = post.author._id.toString() === (userId || "").toString();
      const isAdmin =
        !!userMembership &&
        [GROUP_ROLES.ADMIN, GROUP_ROLES.OWNER].includes(userMembership.role);
      const isOwner =
        !!userMembership && userMembership.role === GROUP_ROLES.OWNER;

      return {
        post,
        meta: {
          isLiked: likedPostIds.has(post._id.toString()),
          isSaved: false,
          isMine,
          isRead: viewedPostIds.has(post._id.toString()),
          isAdmin,
          isOwner,
          isModerator:
            !!userMembership && userMembership.role === GROUP_ROLES.MODERATOR,
          canDelete: isMine || isAdmin || isOwner,
        },
      };
    });

    const totalDocs = await Post.countDocuments(query);
    const totalPages = Math.ceil(totalDocs / limit);

    return {
      posts: postsWithContext,
      pagination: {
        totalDocs,
        limit: Number(limit),
        page: Number(page),
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  },

  getGroupPinnedPostsService: async (groupId, userId, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    // 1. Find Group
    const group = await Group.findById(groupId).select(
      "_id privacy settings isDeleted"
    );
    if (!group) {
      throw new ApiError(404, "Group not found");
    }

    // Check if group is deleted
    if (group.isDeleted) {
      throw new ApiError(404, "This group has been deleted");
    }

    // 2. Check Permission (If Private, must be member)
    // Fetch membership first for visibility filtering
    let userMembership = null;
    if (userId) {
      userMembership = await GroupMembership.findOne({
        group: groupId,
        user: userId,
      });
    }

    if (group.privacy === GROUP_PRIVACY.PRIVATE) {
      if (
        !userMembership ||
        userMembership.status !== GROUP_MEMBERSHIP_STATUS.JOINED
      ) {
        throw new ApiError(403, "You must be a member to view posts");
      }
    }

    // 3. Query Pinned Posts with visibility filter
    const isMember =
      !!userMembership &&
      userMembership.status === GROUP_MEMBERSHIP_STATUS.JOINED;

    let visibilityFilter;
    if (isMember) {
      visibilityFilter = {
        $or: [
          { visibility: POST_VISIBILITY.PUBLIC },
          { visibility: POST_VISIBILITY.CONNECTIONS },
          { visibility: POST_VISIBILITY.ONLY_ME, author: userId },
        ],
      };
    } else {
      visibilityFilter = {
        $or: [
          { visibility: POST_VISIBILITY.PUBLIC },
          { visibility: POST_VISIBILITY.ONLY_ME, author: userId },
        ],
      };
    }

    const query = {
      postOnModel: POST_TARGET_MODELS.GROUP,
      postOnId: groupId,
      isDeleted: false,
      isArchived: false,
      isPinned: true,
      status: POST_STATUS.APPROVED,
      ...visibilityFilter,
    };

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("author", "fullName avatar userName")
      .lean();

    // 4. Add Context (Like, Read, Mine)
    let viewedPostIds = new Set();
    let likedPostIds = new Set();
    const postIds = posts.map((p) => p._id);

    if (userId && posts.length > 0) {
      const viewedPosts = await ReadPost.find({
        user: userId,
        post: { $in: postIds },
      }).select("post");
      viewedPostIds = new Set(viewedPosts.map((vp) => vp.post.toString()));

      const likedPosts = await Reaction.find({
        user: userId,
        targetModel: REACTION_TARGET_MODELS.POST,
        targetId: { $in: postIds },
      }).select("targetId");
      likedPostIds = new Set(likedPosts.map((r) => r.targetId.toString()));
    }

    const postsWithContext = posts.map((post) => {
      const isMine = post.author._id.toString() === userId.toString();
      const isAdmin =
        !!userMembership &&
        [GROUP_ROLES.ADMIN, GROUP_ROLES.OWNER].includes(userMembership.role);
      const isOwner =
        !!userMembership && userMembership.role === GROUP_ROLES.OWNER;

      return {
        post,
        meta: {
          isLiked: likedPostIds.has(post._id.toString()),
          isSaved: false,
          isMine,
          isRead: viewedPostIds.has(post._id.toString()),
          isAdmin,
          isOwner,
          isModerator:
            !!userMembership && userMembership.role === GROUP_ROLES.MODERATOR,
          canDelete: isMine || isAdmin || isOwner,
        },
      };
    });

    const totalDocs = await Post.countDocuments(query);
    const totalPages = Math.ceil(totalDocs / limit);

    return {
      posts: postsWithContext,
      pagination: {
        totalDocs,
        limit: Number(limit),
        page: Number(page),
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  },

  // Marketplace Posts (BUY_SELL type only)
  getGroupMarketplacePostsService: async (
    groupId,
    userId,
    page = 1,
    limit = 10
  ) => {
    const skip = (page - 1) * limit;

    // 1. Find Group
    const group = await Group.findById(groupId).select(
      "_id privacy settings isDeleted"
    );
    if (!group) {
      throw new ApiError(404, "Group not found");
    }

    if (group.isDeleted) {
      throw new ApiError(404, "This group has been deleted");
    }

    // 2. Fetch membership for visibility filtering
    let userMembership = null;
    if (userId) {
      userMembership = await GroupMembership.findOne({
        group: groupId,
        user: userId,
      });
    }

    if (group.privacy === GROUP_PRIVACY.PRIVATE) {
      if (
        !userMembership ||
        userMembership.status !== GROUP_MEMBERSHIP_STATUS.JOINED
      ) {
        throw new ApiError(403, "You must be a member to view marketplace");
      }
    }

    // 3. Query BUY_SELL posts with visibility filter
    const isMember =
      !!userMembership &&
      userMembership.status === GROUP_MEMBERSHIP_STATUS.JOINED;

    let visibilityFilter;
    if (isMember) {
      visibilityFilter = {
        $or: [
          { visibility: POST_VISIBILITY.PUBLIC },
          { visibility: POST_VISIBILITY.CONNECTIONS },
          { visibility: POST_VISIBILITY.ONLY_ME, author: userId },
        ],
      };
    } else {
      visibilityFilter = {
        $or: [
          { visibility: POST_VISIBILITY.PUBLIC },
          { visibility: POST_VISIBILITY.ONLY_ME, author: userId },
        ],
      };
    }

    const query = {
      postOnModel: POST_TARGET_MODELS.GROUP,
      postOnId: groupId,
      type: POST_TYPES.BUY_SELL,
      isDeleted: false,
      isArchived: false,
      status: POST_STATUS.APPROVED,
      ...visibilityFilter,
    };

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("author", "fullName avatar userName")
      .lean();

    // 4. Add Context
    let viewedPostIds = new Set();
    let likedPostIds = new Set();
    const postIds = posts.map((p) => p._id);

    if (userId && posts.length > 0) {
      const viewedPosts = await ReadPost.find({
        user: userId,
        post: { $in: postIds },
      }).select("post");
      viewedPostIds = new Set(viewedPosts.map((vp) => vp.post.toString()));

      const likedPosts = await Reaction.find({
        user: userId,
        targetModel: REACTION_TARGET_MODELS.POST,
        targetId: { $in: postIds },
      }).select("targetId");
      likedPostIds = new Set(likedPosts.map((r) => r.targetId.toString()));
    }

    const postsWithContext = posts.map((post) => {
      const isMine = post.author._id.toString() === (userId || "").toString();
      const isAdmin =
        !!userMembership &&
        [GROUP_ROLES.ADMIN, GROUP_ROLES.OWNER].includes(userMembership.role);
      const isOwner =
        !!userMembership && userMembership.role === GROUP_ROLES.OWNER;

      return {
        post,
        meta: {
          isLiked: likedPostIds.has(post._id.toString()),
          isSaved: false,
          isMine,
          isRead: viewedPostIds.has(post._id.toString()),
          isAdmin,
          isOwner,
          isModerator:
            !!userMembership && userMembership.role === GROUP_ROLES.MODERATOR,
          canDelete: isMine || isAdmin || isOwner,
        },
      };
    });

    const totalDocs = await Post.countDocuments(query);
    const totalPages = Math.ceil(totalDocs / limit);

    return {
      posts: postsWithContext,
      pagination: {
        totalDocs,
        limit: Number(limit),
        page: Number(page),
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  },
};

export { groupServices, groupActions };

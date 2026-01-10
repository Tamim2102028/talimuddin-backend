import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { groupServices, groupActions } from "../services/group.service.js";
import { GROUP_MEMBERSHIP_STATUS } from "../constants/index.js";
import { Group } from "../models/group.model.js";

// ==========================================
// 🚀 1. CREATE GROUP
// ==========================================
const createGroup = asyncHandler(async (req, res) => {
  const { group, meta } = await groupActions.createGroupService(
    req.body,
    req.user._id
  );

  return res
    .status(201)
    .json(new ApiResponse(201, { group, meta }, "Group created successfully"));
});

// ==========================================
// 🚀 2. GET MY GROUPS
// ==========================================
const getMyGroups = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { groups, pagination } = await groupServices.getMyGroupsService(
    req.user._id,
    page,
    limit
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { groups, pagination },
        "My groups fetched successfully"
      )
    );
});

// ==========================================
// 🚀 3. GET UNIVERSITY GROUPS
// ==========================================
const getUniversityGroups = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { groups, pagination } = await groupServices.getUniversityGroupsService(
    req.user._id,
    page,
    limit
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { groups, pagination },
        "University groups fetched successfully"
      )
    );
});

// ==========================================
// 🚀 4. GET CAREER GROUPS
// ==========================================
const getCareerGroups = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { groups, pagination } = await groupServices.getCareerGroupsService(
    req.user._id,
    page,
    limit
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { groups, pagination },
        "Career groups fetched successfully"
      )
    );
});

// ==========================================
// 🚀 5. GET SUGGESTED GROUPS
// ==========================================
const getSuggestedGroups = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { groups, pagination } = await groupServices.getSuggestedGroupsService(
    req.user._id,
    page,
    limit
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { groups, pagination },
        "Suggested groups fetched successfully"
      )
    );
});

// ==========================================
// 🚀 2. DELETE GROUP (Owner Only)
// ==========================================
const deleteGroup = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { groupId: deletedGroupId } = await groupActions.deleteGroupService(
    group._id,
    req.user._id
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { groupId: deletedGroupId },
        "Group deleted successfully"
      )
    );
});

// ==========================================
// 🚀 3. INVITE MEMBERS
// ==========================================
const inviteMembers = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { targetUserIds } = req.body; // Array of user IDs

  if (
    !targetUserIds ||
    !Array.isArray(targetUserIds) ||
    targetUserIds.length === 0
  ) {
    throw new ApiError(400, "targetUserIds array is required");
  }

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { results } = await groupActions.inviteMembersService(
    group._id,
    req.user._id,
    targetUserIds
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { results }, "Invitations sent successfully"));
});

// ==========================================
// 🚀 4. GET MY GROUPS
// ==========================================
const getSentRequestsGroups = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { groups, pagination } =
    await groupServices.getSentRequestsGroupsService(req.user._id, page, limit);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { groups, pagination },
        "Sent requests fetched successfully"
      )
    );
});

// ==========================================
// 🚀 7. GET INVITED GROUPS
// ==========================================
const getInvitedGroups = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { groups, pagination } = await groupServices.getInvitedGroupsService(
    req.user._id,
    page,
    limit
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { groups, pagination },
        "Invited groups fetched successfully"
      )
    );
});

// ==========================================
// 🚀 8. JOIN GROUP
// ==========================================
const joinGroup = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { status } = await groupActions.joinGroupService(
    group._id,
    req.user._id
  );

  // Choose an appropriate message depending on the resulting membership status
  let message = "Joined / request sent successfully";
  if (status === GROUP_MEMBERSHIP_STATUS.JOINED) {
    message = "You have joined the group";
  } else if (status === GROUP_MEMBERSHIP_STATUS.PENDING) {
    message = "Join request sent successfully";
  }

  return res.status(200).json(new ApiResponse(200, { status }, message));
});

// ==========================================
// 🚀 9. LEAVE GROUP
// ==========================================
const leaveGroup = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { status } = await groupActions.leaveGroupService(
    group._id,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { status }, "Left group successfully"));
});

// ==========================================
// 🚀 10. CANCEL JOIN REQUEST
// ==========================================
const cancelJoinRequest = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { status } = await groupActions.cancelJoinRequestService(
    group._id,
    req.user._id
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, { status }, "Join request cancelled successfully")
    );
});

// ==========================================
// 🚀 11. ACCEPT JOIN REQUEST (Admin Only)
// ==========================================
const acceptJoinRequest = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { userId } = req.body;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { status } = await groupActions.acceptJoinRequestService(
    group._id,
    req.user._id,
    userId
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { status }, "User request accepted"));
});

// ==========================================
// 🚀 12. REJECT JOIN REQUEST (Admin Only)
// ==========================================
const rejectJoinRequest = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { userId } = req.body;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { status } = await groupActions.rejectJoinRequestService(
    group._id,
    req.user._id,
    userId
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { status }, "User request rejected"));
});

// ==========================================
// 🚀 12.1 GET PENDING POSTS FOR APPROVAL
// ==========================================
const getPendingPosts = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { page, limit } = req.query;

  const group = await Group.findOne({ slug }).select("_id");
  if (!group) throw new ApiError(404, "Group not found");

  const { posts, pagination } = await groupServices.getPendingPostsService(
    group._id,
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
        "Pending posts fetched successfully"
      )
    );
});

// ==========================================
// 🚀 12.2 APPROVE POST
// ==========================================
const approvePost = asyncHandler(async (req, res) => {
  const { slug, postId } = req.params;

  const group = await Group.findOne({ slug }).select("_id");
  if (!group) throw new ApiError(404, "Group not found");

  const { status } = await groupServices.approvePostService(
    group._id,
    postId,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { status }, "Post approved successfully"));
});

// ==========================================
// 🚀 12.3 REJECT POST
// ==========================================
const rejectPost = asyncHandler(async (req, res) => {
  const { slug, postId } = req.params;

  const group = await Group.findOne({ slug }).select("_id");
  if (!group) throw new ApiError(404, "Group not found");

  const { status } = await groupServices.rejectPostService(
    group._id,
    postId,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { status }, "Post rejected successfully"));
});

// ==========================================
// 🚀 13. GET GROUP DETAILS
// ==========================================
const getGroupDetails = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { group, meta } = await groupServices.getGroupDetailsService(
    slug,
    req.user._id
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { group, meta },
        "Group details fetched successfully"
      )
    );
});

// ==========================================
// 🚀 13.1 GET GROUP UNREAD COUNTS
// ==========================================
const getGroupUnreadCounts = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { group, meta } = await groupServices.getGroupUnreadCountsService(
    slug,
    req.user._id
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { group, meta },
        "Unread counts fetched successfully"
      )
    );
});

// ==========================================
// 🚀 14. GET GROUP MEMBERS
// ==========================================
const getGroupMembers = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { page, limit } = req.query;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { data, meta, pagination } = await groupServices.getGroupMembersService(
    group._id,
    req.user._id,
    page,
    limit,
    req.query.status
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { ...data, meta, pagination },
        "Group members fetched successfully"
      )
    );
});

// ==========================================
// 🚀 15. REMOVE MEMBER (Admin Only)
// ==========================================
const removeMember = asyncHandler(async (req, res) => {
  const { slug, userId } = req.params;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { memberId } = await groupActions.removeMemberService(
    group._id,
    userId,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { memberId }, "Member removed successfully"));
});

// ==========================================
// 🚀 16. ASSIGN ADMIN (Owner/Admin Only)
// ==========================================
const assignAdmin = asyncHandler(async (req, res) => {
  const { slug, userId } = req.params;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { role } = await groupActions.assignAdminService(
    group._id,
    userId,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { role }, "Member promoted to admin"));
});

// ==========================================
// 🚀 17. REVOKE ADMIN (Owner Only)
// ==========================================
const revokeAdmin = asyncHandler(async (req, res) => {
  const { slug, userId } = req.params;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { role } = await groupActions.revokeAdminService(
    group._id,
    userId,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { role }, "Admin privileges revoked"));
});

// ==========================================
// 🚀 18. GET GROUP FEED
// ==========================================
const getGroupFeed = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { posts, pagination } = await groupServices.getGroupFeedService(
    group._id,
    req.user._id,
    page,
    limit
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { posts, pagination }, "Group feed fetched"));
});

// ==========================================
// 🚀 GET GROUP PINNED POSTS
// ==========================================
const getGroupPinnedPosts = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { posts, pagination } = await groupServices.getGroupPinnedPostsService(
    group._id,
    req.user._id,
    page,
    limit
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, { posts, pagination }, "Group pinned posts fetched")
    );
});

// ==========================================
// 🚀 GET GROUP MARKETPLACE POSTS (BUY_SELL)
// ==========================================
const getGroupMarketplacePosts = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { posts, pagination } =
    await groupServices.getGroupMarketplacePostsService(
      group._id,
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
        "Group marketplace posts fetched"
      )
    );
});

// ==========================================
// 🚀 PROMOTE TO MODERATOR (Owner Only)
// ==========================================
const promoteToModerator = asyncHandler(async (req, res) => {
  const { slug, userId } = req.params;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { role } = await groupActions.promoteToModeratorService(
    group._id,
    userId,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { role }, "Member promoted to moderator"));
});

// ==========================================
// 🚀 PROMOTE TO ADMIN (Owner Only)
// ==========================================
const promoteToAdmin = asyncHandler(async (req, res) => {
  const { slug, userId } = req.params;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { role } = await groupActions.promoteToAdminService(
    group._id,
    userId,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { role }, "Moderator promoted to admin"));
});

// ==========================================
// 🚀 DEMOTE TO MODERATOR (Owner Only)
// ==========================================
const demoteToModerator = asyncHandler(async (req, res) => {
  const { slug, userId } = req.params;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { role } = await groupActions.demoteToModeratorService(
    group._id,
    userId,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { role }, "Admin demoted to moderator"));
});

// ==========================================
// 🚀 DEMOTE TO MEMBER (Owner Only)
// ==========================================
const demoteToMember = asyncHandler(async (req, res) => {
  const { slug, userId } = req.params;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { role } = await groupActions.demoteToMemberService(
    group._id,
    userId,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { role }, "Moderator demoted to member"));
});

// ==========================================
// 🚀 TRANSFER OWNERSHIP (Owner Only)
// ==========================================
const transferOwnership = asyncHandler(async (req, res) => {
  const { slug, userId } = req.params;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const result = await groupActions.transferOwnershipService(
    group._id,
    userId,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Ownership transferred successfully"));
});

// ==========================================
// 🚀 BAN MEMBER
// ==========================================
const banMember = asyncHandler(async (req, res) => {
  const { slug, userId } = req.params;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const { memberId } = await groupActions.banMemberService(
    group._id,
    userId,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { memberId }, "Member banned successfully"));
});

// ==========================================
// 🚀 19. UPDATE GROUP DETAILS
// ==========================================
const updateGroupDetails = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const updatedGroup = await groupActions.updateGroupDetailsService(
    group._id,
    req.user._id,
    req.body
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { group: updatedGroup },
        "Group details updated successfully"
      )
    );
});

// ==========================================
// 🚀 20. UPDATE GROUP AVATAR
// ==========================================
const updateGroupAvatar = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const avatarLocalPath = req.file?.path;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const updatedGroup = await groupActions.updateGroupAvatarService(
    group._id,
    req.user._id,
    avatarLocalPath
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { group: updatedGroup },
        "Group avatar updated successfully"
      )
    );
});

// ==========================================
// 🚀 21. UPDATE GROUP COVER IMAGE
// ==========================================
const updateGroupCoverImage = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const coverImageLocalPath = req.file?.path;

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const updatedGroup = await groupActions.updateGroupCoverImageService(
    group._id,
    req.user._id,
    coverImageLocalPath
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { group: updatedGroup },
        "Group cover image updated successfully"
      )
    );
});

// ==========================================
// 🚀 22. UPDATE MEMBER SETTINGS (Mute, etc.)
// ==========================================
const updateMemberSettings = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const settings = req.body; // { isMuted: boolean, isFollowing: boolean, ... }

  const group = await Group.findOne({ slug });
  if (!group) throw new ApiError(404, "Group not found");

  const result = await groupActions.updateMemberSettingsService(
    group._id,
    req.user._id,
    settings
  );

  let message = "Membership settings updated successfully";

  if (settings.isMuted !== undefined) {
    message = settings.isMuted
      ? "Notifications muted for this group"
      : "Notifications enabled for this group";
  } else if (settings.isFollowing !== undefined) {
    message = settings.isFollowing
      ? "You are now following this group"
      : "You have unfollowed this group";
  } else if (settings.isPinned !== undefined) {
    message = settings.isPinned ? "Group pinned" : "Group unpinned";
  }

  return res.status(200).json(new ApiResponse(200, result, message));
});

export {
  createGroup,
  getMyGroups,
  getUniversityGroups,
  getCareerGroups,
  getSuggestedGroups,
  getSentRequestsGroups,
  getInvitedGroups,
  joinGroup,
  leaveGroup,
  cancelJoinRequest,
  acceptJoinRequest,
  rejectJoinRequest,
  getPendingPosts,
  approvePost,
  rejectPost,
  getGroupDetails,
  getGroupUnreadCounts,
  getGroupMembers,
  removeMember,
  assignAdmin,
  revokeAdmin,
  promoteToModerator,
  promoteToAdmin,
  demoteToModerator,
  demoteToMember,
  transferOwnership,
  banMember,
  getGroupFeed,
  getGroupPinnedPosts,
  getGroupMarketplacePosts,
  deleteGroup,
  inviteMembers,
  updateGroupDetails,
  updateGroupAvatar,
  updateGroupCoverImage,
  updateMemberSettings,
};

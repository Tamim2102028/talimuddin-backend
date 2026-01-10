import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getGroupFeed,
  createGroup,
  deleteGroup,
  inviteMembers,
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
  getGroupPinnedPosts,
  getGroupMarketplacePosts,
  updateGroupDetails,
  updateGroupAvatar,
  updateGroupCoverImage,
  updateMemberSettings,
  getPendingPosts,
  approvePost,
  rejectPost,
} from "../controllers/group.controllers.js";
import { uploadImage } from "../middlewares/multer.middleware.js";

const router = Router();
router.use(verifyJWT);

// Group Page Routes
router.post("/", createGroup);

router.get("/myGroups", getMyGroups);
router.get("/universityGroups", getUniversityGroups);
router.get("/careerGroups", getCareerGroups);
router.get("/suggestedGroups", getSuggestedGroups);
router.get("/sentRequests", getSentRequestsGroups);
router.get("/invitedGroups", getInvitedGroups);

// Group Card Action Routes
router.post("/:slug/join", joinGroup);
router.post("/:slug/cancel", cancelJoinRequest);
router.post("/:slug/accept", acceptJoinRequest);
router.post("/:slug/reject", rejectJoinRequest);

// Group Details page Routes
router.get("/:slug/unread-counts", getGroupUnreadCounts);
router.get("/:slug/members", getGroupMembers);
router.get("/:slug/feed", getGroupFeed);
router.get("/:slug/pinned", getGroupPinnedPosts);
router.get("/:slug/marketplace", getGroupMarketplacePosts);
router.get("/:slug", getGroupDetails);

// Group Details page Action Routes
router.patch("/:slug/membership/settings", updateMemberSettings); // 👈 New Route
router.delete("/:slug/leave", leaveGroup);
router.delete("/:slug", deleteGroup);
router.post("/:slug/invite", inviteMembers);

// Admin Action Routes
router.delete("/:slug/members/:userId", removeMember);
router.patch("/:slug/members/:userId/assign-admin", assignAdmin);
router.patch("/:slug/members/:userId/revoke-admin", revokeAdmin);
router.patch("/:slug/members/:userId/promote-moderator", promoteToModerator);
router.patch("/:slug/members/:userId/promote-admin", promoteToAdmin);
router.patch("/:slug/members/:userId/demote-moderator", demoteToModerator);
router.patch("/:slug/members/:userId/demote-member", demoteToMember);
router.patch("/:slug/members/:userId/transfer-ownership", transferOwnership);
router.patch("/:slug/members/:userId/ban", banMember);

// Post Moderation Routes
router.get("/:slug/pending-posts", getPendingPosts);
router.patch("/:slug/posts/:postId/approve", approvePost);
router.patch("/:slug/posts/:postId/reject", rejectPost);

// Group Edit Routes
router.patch("/:slug/details", updateGroupDetails);
router.patch("/:slug/avatar", uploadImage.single("avatar"), updateGroupAvatar);
router.patch(
  "/:slug/cover-image",
  uploadImage.single("coverImage"),
  updateGroupCoverImage
);

export default router;

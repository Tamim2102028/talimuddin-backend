import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
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
} from "../controllers/Branch.controllers.js";
import { uploadImage } from "../middlewares/multer.middleware.js";

const router = Router();
router.use(verifyJWT);

// Branch Routes
router.post("/", createRoom);
router.get("/all", getAllRooms); // All rooms (public)
router.get("/my", getMyRooms); // My joined rooms
router.post("/join", joinRoom);
router.post("/:roomId/leave", leaveRoom);

// Branch Details & Content
router.get("/:roomId", getRoomDetails);
router.get("/:roomId/posts", getRoomPosts);
router.get("/:roomId/members", getRoomMembers);
router.patch("/:roomId", updateRoom);
router.patch(
  "/:roomId/cover-image",
  uploadImage.single("coverImage"),
  updateRoomCoverImage
);
router.delete("/:roomId", deleteRoom);

// Join Request Management
router.get("/:roomId/requests/pending", getPendingJoinRequests);
router.post("/:roomId/requests/:membershipId/accept", acceptJoinRequest);
router.post("/:roomId/requests/:membershipId/reject", rejectJoinRequest);

export default router;

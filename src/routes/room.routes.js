import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
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
} from "../controllers/room.controllers.js";
import { uploadImage } from "../middlewares/multer.middleware.js";

const router = Router();
router.use(verifyJWT);

// Room Routes
router.post("/", createRoom);
router.get("/myRooms", getMyRooms);
router.get("/hiddenRooms", getHiddenRooms);
router.get("/archivedRooms", getArchivedRooms);
router.post("/join", joinRoom);
router.get("/:roomId", getRoomDetails);
router.get("/:roomId/posts", getRoomPosts);
router.get("/:roomId/members", getRoomMembers);
router.patch("/:roomId", updateRoom);
router.patch(
  "/:roomId/cover-image",
  uploadImage.single("coverImage"),
  updateRoomCoverImage
);
router.patch("/:roomId/archive", toggleArchiveRoom);
router.delete("/:roomId", deleteRoom);
router.patch("/:roomId/hide", hideRoom);

export default router;

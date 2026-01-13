import { Router } from "express";

// Middlewares
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { uploadImage } from "../middlewares/multer.middleware.js";

// Controllers
import {
  getUserProfilePosts,
  getUserProfileHeader,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
} from "../controllers/profile.controllers.js";

const router = Router();

// All profile routes require authenticated user (router-level)
router.use(verifyJWT);

// GET /profile/:username
router.get("/:username", getUserProfileHeader);

// update general details
router.patch("/update-general", updateAccountDetails);

// update avatar
router.patch("/avatar", uploadImage.single("avatar"), updateUserAvatar);

// update cover image
router.patch(
  "/cover-image",
  uploadImage.single("coverImage"),
  updateUserCoverImage
);

// get profile posts
router.get("/:username/posts", getUserProfilePosts);

export default router;

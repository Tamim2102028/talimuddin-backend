import { Router } from "express";
import { verifyJWT } from "../../middlewares/auth.middleware.js";
import {
  togglePostPin,
  togglePostRead,
  togglePostLike,
  createPost,
  updatePost,
  deletePost,
} from "../../controllers/common/post.controllers.js";

const router = Router();

// All post routes require authentication
router.use(verifyJWT);

// Create Post: POST /api/v1/posts
router.post("/", createPost);

// Actions on a specific post
router.post("/:postId/toggle-like", togglePostLike);
router.post("/:postId/toggle-read", togglePostRead);
router.post("/:postId/toggle-pin", togglePostPin);

// CRUD on post itself
router.patch("/:postId", updatePost);
router.delete("/:postId", deletePost);

export default router;

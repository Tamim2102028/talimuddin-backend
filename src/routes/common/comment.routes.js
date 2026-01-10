import { Router } from "express";
import { verifyJWT } from "../../middlewares/auth.middleware.js";
import {
  toggleCommentLike,
  createComment,
  updateComment,
  deleteComment,
  getPostComments,
} from "../../controllers/common/comment.controllers.js";

const router = Router();

router.use(verifyJWT);

// GET/POST on a specific post
router.get("/:postId", getPostComments);
router.post("/:postId", createComment);

// CRUD on specific comment
router.patch("/:commentId", updateComment);
router.delete("/:commentId", deleteComment);

// Actions on specific comment
router.post("/:commentId/toggle-like", toggleCommentLike);

export default router;

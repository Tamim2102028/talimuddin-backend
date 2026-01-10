import { Router } from "express";
import { verifyJWT } from "../../middlewares/auth.middleware.js";
import { toggleFollow } from "../../controllers/common/follow.controllers.js";

const router = Router();

router.use(verifyJWT);

// POST /api/v1/follows/:targetId/toggle
router.post("/:targetId/toggle", toggleFollow);

export default router;

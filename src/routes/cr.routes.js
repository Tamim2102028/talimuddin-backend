import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getCrFeed, createCrPost } from "../controllers/cr.controllers.js";

const router = Router();
router.use(verifyJWT);

router.get("/feed", getCrFeed);
router.post("/post", createCrPost);

export default router;

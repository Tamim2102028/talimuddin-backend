import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getDeptFeed,
  createDeptPost,
  getDeptDetails,
  getTeachers,
  searchDepartments,
} from "../controllers/dept.controllers.js";

const router = Router();
router.use(verifyJWT);

// (Moved to unified follow router)

router.get("/search", searchDepartments);
router.get("/:deptId", getDeptDetails);
router.get("/:deptId/feed", getDeptFeed);
router.get("/:deptId/teachers", getTeachers);
router.post("/:deptId/post", createDeptPost);

// ==========================================
// 🚀 POST & COMMENT ACTIONS
// ==========================================
// (Moved to unified post router)

// (Moved to unified comment router)

export default router;

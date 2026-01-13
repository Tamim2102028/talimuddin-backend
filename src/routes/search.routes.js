import { Router } from "express";
import {
  globalSearch,
  searchUsers,
  searchPosts,
  searchComments,
  getSearchSuggestions,
} from "../controllers/search.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

/**
 * ====================================
 * SEARCH ROUTES
 * ====================================
 *
 * All search-related routes with authentication middleware.
 * Rate limiting can be added here for production use.
 */

const router = Router();

// Apply authentication middleware to all search routes
router.use(verifyJWT);

/**
 * Global Search Routes
 */

// Global search across all content types
// GET /api/v1/search/global?q=javascript&type=all&page=1&limit=20
router.route("/global").get(globalSearch);

/**
 * Category-Specific Search Routes
 */

// Search users
// GET /api/v1/search/users?q=tamim&page=1&limit=20
router.route("/users").get(searchUsers);

// Search posts
// GET /api/v1/search/posts?q=programming&page=1&limit=15
router.route("/posts").get(searchPosts);

// Search comments
// GET /api/v1/search/comments?q=helpful&page=1&limit=10
router.route("/comments").get(searchComments);

/**
 * Search Utility Routes
 */

// Get search suggestions for autocomplete
// GET /api/v1/search/suggestions?q=tam
router.route("/suggestions").get(getSearchSuggestions);

export default router;

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import SearchService from "../services/search.service.js";

/**
 * ====================================
 * SEARCH CONTROLLERS
 * ====================================
 *
 * Handles all search-related HTTP requests and responses.
 * Validates input, calls search service, and formats responses.
 */

/**
 * Global search across all content types
 * GET /api/v1/search/global?q={query}&type={type}&page={page}&limit={limit}
 */
const globalSearch = asyncHandler(async (req, res) => {
  const {
    q: query,
    type = "all",
    page = 1,
    limit = 20,
    sortBy = "relevance",
  } = req.query;
  const currentUserId = req.user._id;

  // Input validation
  if (!query || typeof query !== "string") {
    throw new ApiError(400, "Search query is required");
  }

  if (query.trim().length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters long");
  }

  const validTypes = [
    "all",
    "users",
    "posts",
    "groups",
    "institutions",
    "departments",
    "comments",
    "hashtags",
  ];
  if (!validTypes.includes(type)) {
    throw new ApiError(
      400,
      `Invalid search type. Must be one of: ${validTypes.join(", ")}`
    );
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (isNaN(pageNum) || pageNum < 1) {
    throw new ApiError(400, "Page must be a positive integer");
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new ApiError(400, "Limit must be between 1 and 100");
  }

  try {
    const startTime = Date.now();

    const searchResults = await SearchService.performGlobalSearch(
      query,
      { type, sortBy, currentUserId },
      { page: pageNum, limit: limitNum }
    );

    const searchTime = Date.now() - startTime;
    searchResults.searchTime = searchTime;

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          searchResults,
          `Search completed in ${searchTime}ms`
        )
      );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Search failed: ${error.message}`);
  }
});

/**
 * Search users specifically
 * GET /api/v1/search/users?q={query}&page={page}&limit={limit}
 */
const searchUsers = asyncHandler(async (req, res) => {
  const { q: query, page = 1, limit = 20 } = req.query;
  const currentUserId = req.user._id;

  // Input validation
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters long");
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (isNaN(pageNum) || pageNum < 1) {
    throw new ApiError(400, "Page must be a positive integer");
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  try {
    const startTime = Date.now();

    const result = await SearchService.searchUsersByQuery(
      query,
      currentUserId,
      { page: pageNum, limit: limitNum }
    );

    const searchTime = Date.now() - startTime;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          users: result.users,
          pagination: {
            currentPage: pageNum,
            hasMore: result.hasMore,
            totalCount: result.totalCount,
          },
          query,
          searchTime,
        },
        `Found ${result.users.length} users`
      )
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `User search failed: ${error.message}`);
  }
});

/**
 * Search posts specifically
 * GET /api/v1/search/posts?q={query}&page={page}&limit={limit}
 */
const searchPosts = asyncHandler(async (req, res) => {
  const { q: query, page = 1, limit = 15 } = req.query;
  const currentUserId = req.user._id;

  // Input validation
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters long");
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (isNaN(pageNum) || pageNum < 1) {
    throw new ApiError(400, "Page must be a positive integer");
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 30) {
    throw new ApiError(400, "Limit must be between 1 and 30");
  }

  try {
    const startTime = Date.now();

    const result = await SearchService.searchPostsByQuery(
      query,
      currentUserId,
      { page: pageNum, limit: limitNum }
    );

    const searchTime = Date.now() - startTime;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          posts: result.posts,
          pagination: {
            currentPage: pageNum,
            hasMore: result.hasMore,
            totalCount: result.totalCount,
          },
          query,
          searchTime,
        },
        `Found ${result.posts.length} posts`
      )
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Post search failed: ${error.message}`);
  }
});

/**
 * Search groups specifically
 * GET /api/v1/search/groups?q={query}&page={page}&limit={limit}
 */
const searchGroups = asyncHandler(async (req, res) => {
  const { q: query, page = 1, limit = 20 } = req.query;
  const currentUserId = req.user._id;

  // Input validation
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters long");
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (isNaN(pageNum) || pageNum < 1) {
    throw new ApiError(400, "Page must be a positive integer");
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  try {
    const startTime = Date.now();

    const result = await SearchService.searchGroupsByQuery(
      query,
      currentUserId,
      { page: pageNum, limit: limitNum }
    );

    const searchTime = Date.now() - startTime;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          groups: result.groups,
          pagination: {
            currentPage: pageNum,
            hasMore: result.hasMore,
            totalCount: result.totalCount,
          },
          query,
          searchTime,
        },
        `Found ${result.groups.length} groups`
      )
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Group search failed: ${error.message}`);
  }
});

/**
 * Search institutions specifically
 * GET /api/v1/search/institutions?q={query}&page={page}&limit={limit}
 */
const searchInstitutions = asyncHandler(async (req, res) => {
  const { q: query, page = 1, limit = 15 } = req.query;

  // Input validation
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters long");
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (isNaN(pageNum) || pageNum < 1) {
    throw new ApiError(400, "Page must be a positive integer");
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 30) {
    throw new ApiError(400, "Limit must be between 1 and 30");
  }

  try {
    const startTime = Date.now();

    const result = await SearchService.searchInstitutionsByQuery(query, {
      page: pageNum,
      limit: limitNum,
    });

    const searchTime = Date.now() - startTime;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          institutions: result.institutions,
          pagination: {
            currentPage: pageNum,
            hasMore: result.hasMore,
            totalCount: result.totalCount,
          },
          query,
          searchTime,
        },
        `Found ${result.institutions.length} institutions`
      )
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Institution search failed: ${error.message}`);
  }
});

/**
 * Search departments specifically
 * GET /api/v1/search/departments?q={query}&page={page}&limit={limit}
 */
const searchDepartments = asyncHandler(async (req, res) => {
  const { q: query, page = 1, limit = 20 } = req.query;

  // Input validation
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters long");
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (isNaN(pageNum) || pageNum < 1) {
    throw new ApiError(400, "Page must be a positive integer");
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  try {
    const startTime = Date.now();

    const result = await SearchService.searchDepartmentsByQuery(query, {
      page: pageNum,
      limit: limitNum,
    });

    const searchTime = Date.now() - startTime;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          departments: result.departments,
          pagination: {
            currentPage: pageNum,
            hasMore: result.hasMore,
            totalCount: result.totalCount,
          },
          query,
          searchTime,
        },
        `Found ${result.departments.length} departments`
      )
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Department search failed: ${error.message}`);
  }
});

/**
 * Search comments specifically
 * GET /api/v1/search/comments?q={query}&page={page}&limit={limit}
 */
const searchComments = asyncHandler(async (req, res) => {
  const { q: query, page = 1, limit = 10 } = req.query;
  const currentUserId = req.user._id;

  // Input validation
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters long");
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (isNaN(pageNum) || pageNum < 1) {
    throw new ApiError(400, "Page must be a positive integer");
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 20) {
    throw new ApiError(400, "Limit must be between 1 and 20");
  }

  try {
    const startTime = Date.now();

    const result = await SearchService.searchCommentsByQuery(
      query,
      currentUserId,
      { page: pageNum, limit: limitNum }
    );

    const searchTime = Date.now() - startTime;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          comments: result.comments,
          pagination: {
            currentPage: pageNum,
            hasMore: result.hasMore,
            totalCount: result.totalCount,
          },
          query,
          searchTime,
        },
        `Found ${result.comments.length} comments`
      )
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Comment search failed: ${error.message}`);
  }
});

/**
 * Get search suggestions
 * GET /api/v1/search/suggestions?q={query}
 */
const getSearchSuggestions = asyncHandler(async (req, res) => {
  const { q: query } = req.query;
  const currentUserId = req.user._id;

  // Input validation
  if (!query || typeof query !== "string") {
    return res
      .status(200)
      .json(new ApiResponse(200, { suggestions: [] }, "No query provided"));
  }

  if (query.trim().length < 1) {
    return res
      .status(200)
      .json(new ApiResponse(200, { suggestions: [] }, "Query too short"));
  }

  try {
    const result = await SearchService.generateSearchSuggestions(
      query,
      currentUserId
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          result,
          `Generated ${result.suggestions.length} suggestions`
        )
      );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Suggestion generation failed: ${error.message}`);
  }
});

export {
  globalSearch,
  searchUsers,
  searchPosts,
  searchGroups,
  searchInstitutions,
  searchDepartments,
  searchComments,
  getSearchSuggestions,
};

import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Comment } from "../models/comment.model.js";
import { Room } from "../models/room.model.js";
import { ApiError } from "../utils/ApiError.js";
import { POST_VISIBILITY, ACCOUNT_STATUS } from "../constants/index.js";

class SearchService {
  /**
   * Perform global search across all content types
   */
  async performGlobalSearch(query, filters = {}, pagination = {}) {
    const { type = "all", sortBy = "relevance" } = filters;
    const { page = 1, limit = 20 } = pagination;

    if (!query || query.trim().length < 2) {
      throw new ApiError(
        400,
        "Search query must be at least 2 characters long"
      );
    }

    const searchQuery = query.trim();
    const results = {};
    const counts = {};

    try {
      const searchPromises = [];
      const isAll = type === "all";
      const resultsLimit = isAll ? 5 : limit; // Optimized limit for 'all' results

      if (isAll || type === "users") {
        searchPromises.push(
          this.searchUsersByQuery(searchQuery, filters.currentUserId, {
            page: isAll ? 1 : page,
            limit: Math.min(resultsLimit, 20),
          }).then((data) => {
            results.users = data.users;
            counts.users = data.totalCount;
          })
        );
      }

      if (isAll || type === "posts") {
        searchPromises.push(
          this.searchPostsByQuery(searchQuery, filters.currentUserId, {
            page: isAll ? 1 : page,
            limit: Math.min(resultsLimit, 15),
          }).then((data) => {
            results.posts = data.posts;
            counts.posts = data.totalCount;
          })
        );
      }

      // Groups, institutions, and departments removed

      if (isAll || type === "comments") {
        searchPromises.push(
          this.searchCommentsByQuery(searchQuery, filters.currentUserId, {
            page: isAll ? 1 : page,
            limit: Math.min(resultsLimit, 10),
          }).then((data) => {
            results.comments = data.comments;
            counts.comments = data.totalCount;
          })
        );
      }

      if (isAll || type === "hashtags") {
        results.hashtags = [];
        counts.hashtags = 0;
      }

      await Promise.all(searchPromises);

      // Calculate total count
      counts.total = Object.values(counts).reduce(
        (sum, count) => sum + count,
        0
      );

      // Determine if there are more results
      const hasMore = isAll
        ? Object.values(results).some(
            (arr) => arr && arr.length >= resultsLimit
          )
        : results[type] && results[type].length >= limit;

      return {
        results,
        counts,
        pagination: {
          currentPage: page,
          hasMore,
          totalPages: isAll
            ? undefined
            : Math.ceil((counts[type] || 0) / limit),
        },
        query: searchQuery,
        searchTime: Date.now(),
      };
    } catch (error) {
      throw new ApiError(500, `Search failed: ${error.message}`);
    }
  }

  /**
   * Search users by query with privacy controls
   */
  async searchUsersByQuery(query, currentUserId, pagination = {}) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    try {
      // Build search criteria
      const searchCriteria = {
        $text: { $search: query },
        accountStatus: ACCOUNT_STATUS.ACTIVE,
        _id: { $ne: currentUserId }, // Exclude current user
      };

      // Execute search with text score for relevance
      const users = await User.find(searchCriteria, {
        score: { $meta: "textScore" },
      })
        .sort({ score: { $meta: "textScore" }, fullName: 1 })
        .skip(skip)
        .limit(limit)
        .select("fullName userName email avatar userType")
        .lean();

      // Get total count for pagination
      const totalCount = await User.countDocuments(searchCriteria);

      return {
        users,
        totalCount,
        hasMore: skip + users.length < totalCount,
      };
    } catch (error) {
      throw new ApiError(500, `User search failed: ${error.message}`);
    }
  }

  /**
   * Search posts by query with privacy and visibility controls
   */
  async searchPostsByQuery(query, currentUserId, pagination = {}) {
    const { page = 1, limit = 15 } = pagination;
    const skip = (page - 1) * limit;

    try {
      // Build search criteria with privacy controls
      const searchCriteria = {
        $text: { $search: query },
        isDeleted: false,
        $or: [
          { visibility: POST_VISIBILITY.PUBLIC },
          {
            visibility: POST_VISIBILITY.CONNECTIONS,
            // TODO: Add friend/connection check logic here
          },
          {
            visibility: POST_VISIBILITY.INTERNAL,
            // TODO: Add institution/group member check logic here
          },
          {
            author: currentUserId,
            visibility: POST_VISIBILITY.ONLY_ME,
          },
        ],
      };

      // Execute search with text score for relevance
      const posts = await Post.find(searchCriteria, {
        score: { $meta: "textScore" },
      })
        .sort({ score: { $meta: "textScore" }, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "fullName userName avatar")
        .populate("postOnId", "name") // For groups, institutions, etc.
        .select(
          "content tags attachments type postOnModel postOnId author visibility createdAt likesCount commentsCount"
        )
        .lean();

      // Get total count for pagination
      const totalCount = await Post.countDocuments(searchCriteria);

      return {
        posts,
        totalCount,
        hasMore: skip + posts.length < totalCount,
      };
    } catch (error) {
      throw new ApiError(500, `Post search failed: ${error.message}`);
    }
  }

  /**
   * Search groups, institutions, and departments - REMOVED
   * These features are not part of the Islamic academy platform
   */

  /**
   * Search comments by query with post context
   */
  async searchCommentsByQuery(query, currentUserId, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    try {
      // First, find comments that match the search
      const searchCriteria = {
        $text: { $search: query },
        isDeleted: false,
      };

      // Execute search with text score for relevance
      const comments = await Comment.find(searchCriteria, {
        score: { $meta: "textScore" },
      })
        .sort({ score: { $meta: "textScore" }, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "fullName userName avatar")
        .populate({
          path: "post",
          select: "content author visibility postOnModel postOnId",
          populate: {
            path: "author",
            select: "fullName userName",
          },
        })
        .select("content post author createdAt likesCount")
        .lean();

      // Filter comments based on post visibility (privacy control)
      const visibleComments = comments.filter((comment) => {
        if (!comment.post) return false;

        const post = comment.post;

        // Check post visibility
        if (post.visibility === POST_VISIBILITY.PUBLIC) return true;
        if (
          post.visibility === POST_VISIBILITY.ONLY_ME &&
          post.author._id.toString() === currentUserId
        )
          return true;

        // TODO: Add more sophisticated privacy checks for connections and internal posts

        return false;
      });

      // Get total count (approximate, since we're filtering after query)
      const totalCount = await Comment.countDocuments(searchCriteria);

      return {
        comments: visibleComments,
        totalCount,
        hasMore: skip + comments.length < totalCount,
      };
    } catch (error) {
      throw new ApiError(500, `Comment search failed: ${error.message}`);
    }
  }

  /**
   * Generate search suggestions based on query
   */
  async generateSearchSuggestions(query, currentUserId) {
    if (!query || query.trim().length < 1) {
      return { suggestions: [] };
    }

    const searchQuery = query.trim();
    const suggestions = [];

    try {
      // Get top user suggestions
      const userSuggestions = await User.find({
        $or: [
          { fullName: { $regex: searchQuery, $options: "i" } },
          { userName: { $regex: searchQuery, $options: "i" } },
        ],
        accountStatus: ACCOUNT_STATUS.ACTIVE,
        _id: { $ne: currentUserId },
      })
        .limit(3)
        .select("fullName userName avatar")
        .lean();

      userSuggestions.forEach((user) => {
        suggestions.push({
          type: "user",
          text: user.fullName,
          subtitle: `@${user.userName}`,
          avatar: user.avatar,
          id: user._id,
        });
      });

      return { suggestions: suggestions.slice(0, 6) }; // Limit to 6 total suggestions
    } catch (error) {
      throw new ApiError(500, `Suggestion generation failed: ${error.message}`);
    }
  }
}

export default new SearchService();

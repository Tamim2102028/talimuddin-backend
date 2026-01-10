import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { toggleFollowService } from "../../services/common/follow.service.js";

const toggleFollow = asyncHandler(async (req, res) => {
  const { targetId } = req.params;
  const { targetModel } = req.body;

  if (!targetModel) {
    throw new ApiError(400, "targetModel is required");
  }

  const { isFollowing } = await toggleFollowService(
    targetId,
    targetModel,
    req.user._id
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isFollowing },
        isFollowing ? "Followed successfully" : "Unfollowed successfully"
      )
    );
});

export { toggleFollow };

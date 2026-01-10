/**
 * Maps a user object to a standardized response structure.
 * @param {Object} user - The user object from the database.
 * @param {string|null} friendshipStatus - The relationship status with the current user.
 * @param {string|null} friendshipId - The ID of the friendship document (optional).
 * @returns {Object|null} - The formatted user object with meta data.
 */
export const mapUserToResponse = (
  user,
  friendshipStatus = null,
  friendshipId = null
) => {
  if (!user) return null;
  return {
    user: {
      _id: user._id,
      userName: user.userName,
      fullName: user.fullName,
      avatar: user.avatar,
      institution: user.institution
        ? { _id: user.institution._id, name: user.institution.name }
        : null,
      userType: user.userType,
      department: user.academicInfo?.department
        ? {
            _id: user.academicInfo.department._id,
            name: user.academicInfo.department.name,
          }
        : null,
    },
    meta: {
      friendshipStatus,
      friendshipId,
    },
  };
};

/**
 * Maps a user object to a standardized response structure.
 * @param {Object} user - The user object from the database.
 * @returns {Object|null} - The formatted user object.
 */
export const mapUserToResponse = (user) => {
  if (!user) return null;
  return {
    user: {
      _id: user._id,
      userName: user.userName,
      fullName: user.fullName,
      avatar: user.avatar,
      userType: user.userType,
    },
  };
};

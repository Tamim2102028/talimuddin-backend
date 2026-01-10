// 📦 Database State: Used in Friendship Collection (DB)
export const FRIENDSHIP_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  BLOCKED: "BLOCKED",
};

export const CONNECTION_VISIBILITY = {
  PUBLIC: "PUBLIC",
  CONNECTIONS: "CONNECTIONS",
  ONLY_ME: "ONLY_ME",
};

export const FRIEND_REQUEST_POLICY = {
  EVERYONE: "EVERYONE",
  NOBODY: "NOBODY",
};

// 🎨 Frontend/UI State: Used for Profile Buttons & Logic (Computed)
export const PROFILE_RELATION_STATUS = {
  FRIEND: "FRIEND", // DB status: ACCEPTED
  REQUEST_SENT: "REQUEST_SENT", // DB status: PENDING (Requester = Me)
  REQUEST_RECEIVED: "REQUEST_RECEIVED", // DB status: PENDING (Recipient = Me)
  BLOCKED: "BLOCKED", // DB status: BLOCKED
};

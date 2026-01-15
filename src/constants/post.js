// 📝 পোস্টের ধরন (Updated: ANNOUNCEMENT -> NOTICE)
export const POST_TYPES = {
  GENERAL: "GENERAL",
  NOTICE: "NOTICE", // ✅ Updated
  RESOURCE: "RESOURCE",
  POLL: "POLL",
  QUESTION: "QUESTION",
  ASSIGNMENT: "ASSIGNMENT", // ✅ Added
  VIDEO: "VIDEO", // ✅ Added
  BUY_SELL: "BUY_SELL", // ✅ Added for marketplace
};

export const ATTACHMENT_TYPES = {
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  PDF: "PDF",
  DOC: "DOC",
  LINK: "LINK",
};

// 🎯 পোস্ট কোথায় হচ্ছে? (Location)
export const POST_TARGET_MODELS = {
  GROUP: "Group",
  BRANCH: "Branch",
  PAGE: "Page",
  USER: "User",
  INSTITUTION: "Institution",
  DEPARTMENT: "Department",
  CR_CORNER: "CrCorner", // ✅ Added specifically for CR Corner
};

export const POST_VISIBILITY = {
  PUBLIC: "PUBLIC",
  CONNECTIONS: "CONNECTIONS",
  ONLY_ME: "ONLY_ME",
  INTERNAL: "INTERNAL",
};

export const POST_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

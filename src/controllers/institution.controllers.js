import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { POST_TARGET_MODELS, POST_TYPES } from "../constants/index.js";
import { createPostService } from "../services/common/post.service.js";
import { Institution } from "../models/institution.model.js";
import mongoose from "mongoose";

const _objectId = () => new mongoose.Types.ObjectId().toString();

// 🏛️ GET INSTITUTION FEED
const getInstitutionFeed = asyncHandler(async (req, res) => {
  const { instId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  // TODO: Replace with actual service call when ready
  const posts = [
    {
      _id: "inst_post_1",
      content:
        "আগামী ১৬ই ডিসেম্বর মহান বিজয় দিবস উপলক্ষে বিশ্ববিদ্যালয় বন্ধ থাকিবে।",
      type: POST_TYPES.NOTICE,
      postOnModel: POST_TARGET_MODELS.INSTITUTION,
      postOnId: instId,
      author: {
        _id: "u_admin_1",
        fullName: "Registrar Office",
        userName: "registrar",
        avatar: "https://ui-avatars.com/api/?name=Registrar",
        userType: "ADMIN", // অথবা STAFF
      },
      stats: { likes: 500, comments: 20, shares: 150 },
      context: { isLiked: false, isSaved: true, isRead: false, isMine: false },
      createdAt: new Date().toISOString(),
    },
    {
      _id: "inst_post_2",
      content: "Convocation 2025 এর রেজিস্ট্রেশন শুরু হয়েছে।",
      type: "EVENT", // অথবা GENERAL
      postOnModel: POST_TARGET_MODELS.INSTITUTION,
      postOnId: instId,
      author: {
        _id: "u_vc_1",
        fullName: "Vice Chancellor",
        avatar: "https://ui-avatars.com/api/?name=VC",
      },
      stats: { likes: 1200, comments: 300, shares: 400 },
      context: { isLiked: true, isSaved: false, isRead: true, isMine: false },
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  return res
    .status(200)
    .json(new ApiResponse(200, { posts }, "Institution updates fetched"));
});

// 🏛️ CREATE INSTITUTION POST (Admin Only)
const createInstitutionPost = asyncHandler(async (req, res) => {
  const { instId } = req.params;
  const { content, type = POST_TYPES.NOTICE } = req.body;

  const postData = {
    content,
    type,
    postOnModel: POST_TARGET_MODELS.INSTITUTION,
    postOnId: instId,
    ...req.body,
  };

  const { post, meta } = await createPostService(postData, req.user._id);

  return res
    .status(201)
    .json(new ApiResponse(201, { post, meta }, "Official announcement posted"));
});

// 🚀 3. GET INSTITUTION DETAILS
const getInstitutionDetails = asyncHandler(async (req, res) => {
  const { instId } = req.params;

  const institution = {
    _id: instId,
    name: "Dhaka University",
    address: "Nilkhet, Dhaka",
    website: "https://du.ac.bd",
    logo: "https://placehold.co/200x200?text=DU+Logo",
    coverImage: "https://placehold.co/1200x400?text=Dhaka+University",
    established: 1921,
    contactEmail: "registrar@du.ac.bd",
  };

  return res
    .status(200)
    .json(new ApiResponse(200, { institution }, "Institution details fetched"));
});

// 🚀 4. GET DEPARTMENTS LIST
const getDepartmentsList = asyncHandler(async (req, res) => {
  const { instId } = req.params;

  const departments = [
    {
      _id: "dept_cse",
      name: "Computer Science & Engineering",
      shortName: "CSE",
      headName: "Dr. Anisul Islam",
    },
    {
      _id: "dept_eee",
      name: "Electrical & Electronic Engineering",
      shortName: "EEE",
      headName: "Dr. Rahim Uddin",
    },
    {
      _id: "dept_bba",
      name: "Business Administration",
      shortName: "BBA",
      headName: "Prof. Jamal Khan",
    },
  ];

  return res
    .status(200)
    .json(new ApiResponse(200, { departments }, "Departments list fetched"));
});

// 🚀 5. SEARCH INSTITUTIONS
const searchInstitutions = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res
      .status(200)
      .json(new ApiResponse(200, { institutions: [] }, "Query is required"));
  }

  const query = {
    $or: [
      { name: { $regex: q, $options: "i" } },
      { code: { $regex: q, $options: "i" } },
    ],
    isActive: true,
  };

  const institutions = await Institution.find(query)
    .select("name code logo type")
    .limit(20);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { institutions },
        "Institutions searched successfully"
      )
    );
});

export {
  getInstitutionFeed,
  createInstitutionPost,
  getInstitutionDetails,
  getDepartmentsList,
  searchInstitutions,
};

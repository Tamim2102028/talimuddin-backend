import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { POST_TARGET_MODELS, POST_TYPES } from "../constants/index.js";
import { createPostService } from "../services/common/post.service.js";
import { Department } from "../models/department.model.js";

// 🚀 1. GET DEPT FEED
const getDeptFeed = asyncHandler(async (req, res) => {
  const { deptId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const { posts, pagination } = await getDeptFeedService(
    deptId,
    req.user._id,
    page,
    limit
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { posts, pagination }, "Dept feed fetched"));
});

// 🚀 2. CREATE DEPT POST (Only for Admin/Head)
const createDeptPost = asyncHandler(async (req, res) => {
  const { deptId } = req.params;
  const { content } = req.body;

  // Prepare post data for generic service
  const postData = {
    content,
    type: POST_TYPES.NOTICE, // Default to NOTICE for dept posts
    postOnModel: POST_TARGET_MODELS.DEPARTMENT,
    postOnId: deptId,
    // Add other fields if necessary, e.g., attachments
    ...req.body,
  };

  const { post, meta } = await createPostService(postData, req.user._id);

  return res
    .status(201)
    .json(new ApiResponse(201, { post, meta }, "Official notice posted"));
});

// 🚀 3. GET DEPT DETAILS
const getDeptDetails = asyncHandler(async (req, res) => {
  const { deptId } = req.params;

  const department = {
    _id: deptId,
    name: "Computer Science & Engineering",
    shortName: "CSE",
    coverImage: "https://placehold.co/800x200?text=CSE+Department",
    headOfDept: {
      fullName: "Dr. Anisul Islam",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=anisul",
    },
    contactEmail: "cse@university.edu",
    location: "Building 3, 4th Floor",
  };

  return res
    .status(200)
    .json(new ApiResponse(200, { department }, "Department details fetched"));
});

// 🚀 4. GET TEACHERS LIST
const getTeachers = asyncHandler(async (req, res) => {
  const { deptId } = req.params;

  const teachers = [
    {
      _id: "t_1",
      fullName: "Dr. Anisul Islam",
      designation: "Professor & Head",
      email: "anisul@uni.edu",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=anisul",
    },
    {
      _id: "t_2",
      fullName: "Ms. Farhana Ahmed",
      designation: "Lecturer",
      email: "farhana@uni.edu",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=farhana",
    },
  ];

  return res
    .status(200)
    .json(new ApiResponse(200, { teachers }, "Teachers list fetched"));
});

// 🚀 5. SEARCH DEPARTMENTS
const searchDepartments = asyncHandler(async (req, res) => {
  const { instId, q } = req.query;

  if (!instId) {
    return res
      .status(400)
      .json(new ApiResponse(400, {}, "Institution ID is required"));
  }

  const query = {
    institution: instId,
  };

  if (q) {
    query.$or = [
      { name: { $regex: q, $options: "i" } },
      { code: { $regex: q, $options: "i" } },
    ];
  }

  const departments = await Department.find(query)
    .select("name code")
    .limit(20);

  return res
    .status(200)
    .json(
      new ApiResponse(200, { departments }, "Departments searched successfully")
    );
});

export {
  getDeptFeed,
  createDeptPost,
  getDeptDetails,
  getTeachers,
  searchDepartments,
};

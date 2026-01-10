import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Group } from "../models/group.model.js";
import { Institution } from "../models/institution.model.js";
import { Department } from "../models/department.model.js";
import { Comment } from "../models/comment.model.js";

dotenv.config({ path: "./.env" });

/**
 * ====================================
 * SEARCH INDEX SETUP SCRIPT
 * ====================================
 *
 * This script creates optimized indexes for search functionality.
 * Run this script after deploying to ensure search performance.
 *
 * Usage: node src/scripts/setupSearchIndexes.js
 */

const setupSearchIndexes = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.DB_URL);
    console.log("✅ Connected to MongoDB");

    console.log("\n🔄 Setting up search indexes...");

    // 1. User Search Indexes
    console.log("📝 Creating User search indexes...");
    await User.collection.createIndex(
      {
        fullName: "text",
        userName: "text",
        email: "text",
      },
      {
        weights: {
          fullName: 10,
          userName: 5,
          email: 1,
        },
        name: "user_search_text_index",
      }
    );

    await User.collection.createIndex({ fullName: 1, institution: 1 });
    await User.collection.createIndex({ userName: 1, userType: 1 });
    await User.collection.createIndex({
      institution: 1,
      "academicInfo.department": 1,
      userType: 1,
    });
    console.log("✅ User indexes created");

    // 2. Post Search Indexes
    console.log("📝 Creating Post search indexes...");
    await Post.collection.createIndex(
      {
        content: "text",
        tags: "text",
      },
      {
        weights: {
          content: 10,
          tags: 5,
        },
        name: "post_search_text_index",
      }
    );

    await Post.collection.createIndex({ visibility: 1, createdAt: -1 });
    await Post.collection.createIndex({
      author: 1,
      visibility: 1,
      isDeleted: 1,
    });
    console.log("✅ Post indexes created");

    // 3. Group Search Indexes
    console.log("📝 Creating Group search indexes...");
    await Group.collection.createIndex(
      {
        name: "text",
        description: "text",
      },
      {
        weights: {
          name: 10,
          description: 3,
        },
        name: "group_search_text_index",
      }
    );

    await Group.collection.createIndex({ privacy: 1, institution: 1 });
    await Group.collection.createIndex({ name: 1, privacy: 1 });
    console.log("✅ Group indexes created");

    // 4. Institution Search Indexes
    console.log("📝 Creating Institution search indexes...");
    await Institution.collection.createIndex(
      {
        name: "text",
        location: "text",
        code: "text",
      },
      {
        weights: {
          name: 10,
          code: 8,
          location: 3,
        },
        name: "institution_search_text_index",
      }
    );

    await Institution.collection.createIndex({ type: 1, category: 1 });
    await Institution.collection.createIndex({ location: 1, type: 1 });
    console.log("✅ Institution indexes created");

    // 5. Department Search Indexes
    console.log("📝 Creating Department search indexes...");
    await Department.collection.createIndex(
      {
        name: "text",
        code: "text",
      },
      {
        weights: {
          name: 10,
          code: 8,
        },
        name: "department_search_text_index",
      }
    );

    await Department.collection.createIndex({ institution: 1, status: 1 });
    console.log("✅ Department indexes created");

    // 6. Comment Search Indexes
    console.log("📝 Creating Comment search indexes...");
    await Comment.collection.createIndex(
      {
        content: "text",
      },
      {
        name: "comment_search_text_index",
      }
    );

    await Comment.collection.createIndex({ post: 1, createdAt: -1 });
    await Comment.collection.createIndex({ author: 1, createdAt: -1 });
    await Comment.collection.createIndex({ post: 1, isDeleted: 1 });
    console.log("✅ Comment indexes created");

    console.log("\n🎉 All search indexes created successfully!");

    // Display index information
    console.log("\n📊 Index Summary:");
    const collections = [
      { name: "Users", model: User },
      { name: "Posts", model: Post },
      { name: "Groups", model: Group },
      { name: "Institutions", model: Institution },
      { name: "Departments", model: Department },
      { name: "Comments", model: Comment },
    ];

    for (const collection of collections) {
      const indexes = await collection.model.collection.getIndexes();
      console.log(`${collection.name}: ${Object.keys(indexes).length} indexes`);
    }
  } catch (error) {
    console.error("❌ Error setting up search indexes:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  }
};

// Run the script
setupSearchIndexes();

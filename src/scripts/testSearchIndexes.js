import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Group } from "../models/group.model.js";

dotenv.config({ path: "./.env" });

/**
 * ====================================
 * SEARCH INDEX TEST SCRIPT
 * ====================================
 *
 * This script tests the search indexes with sample queries
 * to ensure they're working correctly.
 */

const testSearchIndexes = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.DB_URL);
    console.log("✅ Connected to MongoDB");

    console.log("\n🧪 Testing search indexes...");

    // Test 1: User Text Search
    console.log("\n1️⃣ Testing User text search...");
    const startTime1 = Date.now();
    const userResults = await User.find(
      { $text: { $search: "tamim" } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(5)
      .select("fullName userName email");

    const endTime1 = Date.now();
    console.log(
      `   Found ${userResults.length} users in ${endTime1 - startTime1}ms`
    );
    if (userResults.length > 0) {
      console.log(
        `   Sample result: ${userResults[0].fullName} (@${userResults[0].userName})`
      );
    }

    // Test 2: Post Text Search
    console.log("\n2️⃣ Testing Post text search...");
    const startTime2 = Date.now();
    const postResults = await Post.find(
      { $text: { $search: "javascript programming" } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(5)
      .populate("author", "fullName userName")
      .select("content author createdAt");

    const endTime2 = Date.now();
    console.log(
      `   Found ${postResults.length} posts in ${endTime2 - startTime2}ms`
    );
    if (postResults.length > 0) {
      console.log(
        `   Sample result: "${postResults[0].content.substring(0, 50)}..."`
      );
    }

    // Test 3: Group Text Search
    console.log("\n3️⃣ Testing Group text search...");
    const startTime3 = Date.now();
    const groupResults = await Group.find(
      { $text: { $search: "programming computer" } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(5)
      .select("name description membersCount");

    const endTime3 = Date.now();
    console.log(
      `   Found ${groupResults.length} groups in ${endTime3 - startTime3}ms`
    );
    if (groupResults.length > 0) {
      console.log(`   Sample result: ${groupResults[0].name}`);
    }

    // Test 4: Compound Index Performance
    console.log("\n4️⃣ Testing compound index performance...");
    const startTime4 = Date.now();
    const compoundResults = await User.find({
      fullName: { $regex: "tamim", $options: "i" },
      userType: "student",
    })
      .limit(10)
      .select("fullName userName userType");

    const endTime4 = Date.now();
    console.log(
      `   Found ${compoundResults.length} users with compound query in ${endTime4 - startTime4}ms`
    );

    console.log("\n🎉 Search index tests completed!");

    // Performance Summary
    console.log("\n📊 Performance Summary:");
    console.log(`   User search: ${endTime1 - startTime1}ms`);
    console.log(`   Post search: ${endTime2 - startTime2}ms`);
    console.log(`   Group search: ${endTime3 - startTime3}ms`);
    console.log(`   Compound query: ${endTime4 - startTime4}ms`);

    const avgTime =
      (endTime1 -
        startTime1 +
        (endTime2 - startTime2) +
        (endTime3 - startTime3) +
        (endTime4 - startTime4)) /
      4;
    console.log(`   Average response time: ${avgTime.toFixed(2)}ms`);

    if (avgTime < 100) {
      console.log("✅ Excellent performance! Indexes are working well.");
    } else if (avgTime < 500) {
      console.log("⚠️  Good performance, but could be optimized further.");
    } else {
      console.log("❌ Poor performance. Check index configuration.");
    }
  } catch (error) {
    console.error("❌ Error testing search indexes:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  }
};

// Run the test
testSearchIndexes();

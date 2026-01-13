import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../db/index.js";
import { User } from "../models/user.model.js";
import { USER_TYPES } from "../constants/index.js";

dotenv.config({ path: "./.env" });

/**
 * Seed script to create the platform owner account
 * This should be run once during initial setup
 *
 * Owner credentials:
 * - Email: owner@talimuddin.com
 * - Password: TalimuddinOwner@2026
 * - Username: talimuddin_owner
 *
 * IMPORTANT: Change the password after first login!
 */

const seedOwner = async () => {
  try {
    await connectDB();

    // Check if owner already exists
    const existingOwner = await User.findOne({ userType: USER_TYPES.OWNER });

    if (existingOwner) {
      console.log("⚠️  Owner account already exists!");
      console.log(`   Email: ${existingOwner.email}`);
      console.log(`   Username: ${existingOwner.userName}`);
      console.log(
        "\n   If you need to reset the owner account, please delete it manually first."
      );
      process.exit(0);
    }

    // Create owner account
    const ownerData = {
      fullName: "Talimuddin Academy",
      userName: "talimuddin_tamim",
      email: "owner@gmail.com",
      password: "qqqqqqQ1",
      userType: USER_TYPES.OWNER,
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=owner",
      bio: "Platform Owner - Technical Administrator",
      agreedToTerms: true,
    };

    const owner = await User.create(ownerData);
    console.log(`Done owner craete`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Owner Seeding Failed:", error);
    process.exit(1);
  }
};

seedOwner();

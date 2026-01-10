import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../db/index.js";
import { User } from "../models/user.model.js";
import { Institution } from "../models/institution.model.js";
import { Department } from "../models/department.model.js";
import { USER_TYPES, GENDERS, RELIGIONS } from "../constants/index.js";

dotenv.config({ path: "./.env" });

const seedUsers = async () => {
  try {
    await connectDB();

    // 1. Get some institutions and departments to link
    const institutions = await Institution.find().limit(3);
    const departments = await Department.find().limit(5);

    if (institutions.length === 0 || departments.length === 0) {
      console.error(
        "❌ No institutions or departments found. Please run dataSeed.js first."
      );
      process.exit(1);
    }

    // 2. Clear existing dummy users (optional, but good for clean seeding)
    // Only delete users with 'dummy' in their email to avoid deleting real users
    await User.deleteMany({ email: /dummy/ });

    const users = [];

    for (let i = 1; i <= 10; i++) {
      const inst = institutions[i % institutions.length];
      const dept = departments[i % departments.length];

      users.push({
        fullName: `User ${i} FullName`,
        userName: `user${i}_test`,
        email: `user${i}.dummy@example.com`,
        password: "password123", // Will be hashed by pre-save hook
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=user${i}`,
        gender: i % 2 === 0 ? GENDERS.MALE : GENDERS.FEMALE,
        religion: RELIGIONS.ISLAM,
        userType: i === 1 ? USER_TYPES.TEACHER : USER_TYPES.STUDENT,
        institution: inst._id,
        academicInfo: {
          department: dept._id,
          studentId: i > 1 ? `1000${i}` : undefined,
          teacherId: i === 1 ? `T-200${i}` : undefined,
          session: "2023-24",
          currentSemester: (i % 8) + 1,
        },
        isStudentEmail: true,
      });
    }

    // Use loop to ensure pre-save hooks (bcrypt) run
    for (const userData of users) {
      await User.create(userData);
      console.log(`👤 Created user: ${userData.userName}`);
    }

    console.log("✅ 10 users seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ User Seeding Failed:", error);
    process.exit(1);
  }
};

seedUsers();

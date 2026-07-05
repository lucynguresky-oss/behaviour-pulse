import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { MongooseSchool } from '../models/School.js';
import { MongooseUser } from '../models/User.js';
import { MongooseBehaviorLog } from '../models/BehaviorLog.js';

dotenv.config();

let isConnected = false;
let useLocalDb = false;

async function seedMongooseDb() {
  try {
    const schoolCount = await MongooseSchool.countDocuments();
    if (schoolCount === 0) {
      console.log("🌱 MongoDB is empty. Seeding initial production/demo records...");
      
      const school = await MongooseSchool.create({
        _id: new mongoose.Types.ObjectId("648000000000000000000001"),
        name: "Oakridge High School",
        subdomain: "oakridge",
        status: "active"
      });
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("BarakaNgureNjihia", salt);
      
      await MongooseUser.insertMany([
        { _id: new mongoose.Types.ObjectId("648000000000000000000002"), schoolId: school._id.toString(), name: "Mr. Henderson", email: "teacher@pulse.com", password: hashedPassword, role: "teacher", pointsBalance: 0 },
        { _id: new mongoose.Types.ObjectId("648000000000000000000003"), schoolId: school._id.toString(), name: "Deputy Harris", email: "deputy@pulse.com", password: hashedPassword, role: "deputy", pointsBalance: 0 },
        { _id: new mongoose.Types.ObjectId("648000000000000000000004"), schoolId: school._id.toString(), name: "Principal Skinner", email: "principal@pulse.com", password: hashedPassword, role: "principal", pointsBalance: 0 },
        { _id: new mongoose.Types.ObjectId("648000000000000000000005"), schoolId: "global", name: "System Director", email: "superadmin@pulse.com", password: hashedPassword, role: "super_admin", pointsBalance: 0 },
        { _id: new mongoose.Types.ObjectId("648000000000000000000006"), schoolId: school._id.toString(), name: "Alice Smith", email: "student1@pulse.com", password: hashedPassword, role: "student", pointsBalance: 120 },
        { _id: new mongoose.Types.ObjectId("648000000000000000000007"), schoolId: school._id.toString(), name: "Bob Jones", email: "student2@pulse.com", password: hashedPassword, role: "student", pointsBalance: 85 }
      ]);
      
      await MongooseBehaviorLog.insertMany([
        { schoolId: school._id.toString(), studentId: new mongoose.Types.ObjectId("648000000000000000000006"), teacherId: new mongoose.Types.ObjectId("648000000000000000000002"), pointsChange: 15, reason: "Outstanding participation in Science Lab and helping peers set up equipment.", parentNotified: true, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        { schoolId: school._id.toString(), studentId: new mongoose.Types.ObjectId("648000000000000000000006"), teacherId: new mongoose.Types.ObjectId("648000000000000000000002"), pointsChange: -10, reason: "Repeatedly interrupting others during group reading, despite warnings.", parentNotified: true, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
      ]);
      
      console.log("🌱 MongoDB database seeding completed successfully!");
    }
  } catch (error) {
    console.error("❌ Failed to seed Mongoose database:", error.message);
  }
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("⚠️ MONGODB_URI not defined. Using local JSON-file database for development.");
    useLocalDb = true;
    return { isConnected: false, useLocalDb: true };
  }

  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    isConnected = true;
    useLocalDb = false;
    await seedMongooseDb();
    return { isConnected: true, useLocalDb: false };
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    console.log("👉 Falling back to local JSON-file database.");
    useLocalDb = true;
    return { isConnected: false, useLocalDb: true };
  }
}

export function shouldExpressUseLocalDb() {
  return !isConnected || useLocalDb;
}

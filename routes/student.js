import express from 'express';
import bcrypt from 'bcryptjs';
import User, { MongooseUser } from '../models/User.js';
import BehaviorLog from '../models/BehaviorLog.js';
import { verifyToken, requireRole, requireAnyRole } from './auth.js';
import { shouldExpressUseLocalDb } from '../config/db.js';

const router = express.Router();

// GET /api/students (Teachers, Deputies, Principals)
// Fetches all students and their current point balances
router.get('/students', verifyToken, requireAnyRole(['teacher', 'deputy', 'principal']), async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin';
    const schoolId = isSuperAdmin 
      ? req.query.schoolId 
      : (req.user.schoolId || 'school-main');

    const search = (req.query.search || '').trim();
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10) || 20;

    const query = { role: 'student' };
    if (schoolId) {
      query.schoolId = schoolId;
    }
    if (req.query.className) {
      query.className = req.query.className;
    }

    if (shouldExpressUseLocalDb()) {
      // Retrieve students
      const allUsers = await User.find(query);
      let students = allUsers.map(s => ({
        id: s._id,
        name: s.name,
        email: s.email,
        pointsBalance: s.pointsBalance,
        schoolId: s.schoolId,
        className: s.className || ''
      }));

      // Filter by search query if provided
      if (search) {
        const searchLower = search.toLowerCase();
        students = students.filter(s => 
          s.name.toLowerCase().includes(searchLower) || 
          s.email.toLowerCase().includes(searchLower)
        );
      }

      // Support paginated output if requested
      if (!isNaN(page)) {
        const skip = (page - 1) * limit;
        const paginated = students.slice(skip, skip + limit);
        return res.json({
          students: paginated,
          page,
          pages: Math.ceil(students.length / limit),
          total: students.length
        });
      }

      return res.json(students);
    } else {
      // High-performance MongoDB query using Mongoose
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      if (!isNaN(page)) {
        const skip = (page - 1) * limit;
        const [docs, total] = await Promise.all([
          MongooseUser.find(query)
            .skip(skip)
            .limit(limit)
            .select('name email pointsBalance schoolId className')
            .lean(),
          MongooseUser.countDocuments(query)
        ]);

        const students = docs.map(s => ({
          id: s._id,
          name: s.name,
          email: s.email,
          pointsBalance: s.pointsBalance,
          schoolId: s.schoolId,
          className: s.className || ''
        }));

        return res.json({
          students,
          page,
          pages: Math.ceil(total / limit),
          total
        });
      } else {
        const docs = await MongooseUser.find(query)
          .select('name email pointsBalance schoolId className')
          .lean();
        const students = docs.map(s => ({
          id: s._id,
          name: s.name,
          email: s.email,
          pointsBalance: s.pointsBalance,
          schoolId: s.schoolId,
          className: s.className || ''
        }));
        return res.json(students);
      }
    }
  } catch (err) {
    console.error("Error fetching students:", err.message);
    return res.status(500).json({ error: "Failed to load students roster." });
  }
});

// POST /api/students (Teachers, Deputies, Principals)
// Manually registers a new student
router.post('/students', verifyToken, requireAnyRole(['teacher', 'deputy', 'principal']), async (req, res) => {
  const { name, email, pointsBalance, password } = req.body;
  const schoolId = req.user.schoolId || 'school-main';
  
  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required to create a student." });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existing = await User.findOne({ schoolId, email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ error: `A student with the email "${email}" already exists in this school.` });
    }

    const rawPassword = password || 'password123';
    let finalPassword = rawPassword;

    // Hash password if MongoDB is used directly (local dbStore handles hashing inside localUser.create)
    if (!shouldExpressUseLocalDb()) {
      const salt = await bcrypt.genSalt(10);
      finalPassword = await bcrypt.hash(rawPassword, salt);
    }

    const newUser = await User.create({
      schoolId,
      name: name.trim(),
      email: normalizedEmail,
      password: finalPassword,
      role: 'student',
      pointsBalance: parseInt(pointsBalance, 10) || 0,
      className: req.body.className ? req.body.className.trim() : ''
    });

    return res.json({
      success: true,
      message: `Student account for ${name} has been created successfully.`,
      student: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        pointsBalance: newUser.pointsBalance,
        className: newUser.className || ''
      }
    });

  } catch (err) {
    console.error("Error creating student manually:", err.message);
    return res.status(500).json({ error: "Failed to create student account profile." });
  }
});

// POST /api/students/seed-demo (Teachers, Deputies, Principals)
// Safely resets or populates the roster with 50 students so testing performance at scale is seamless
router.post('/students/seed-demo', verifyToken, requireAnyRole(['teacher', 'deputy', 'principal']), async (req, res) => {
  try {
    const schoolId = req.user.schoolId || 'school-main';
    const allUsers = await User.find({ schoolId });
    
    // Realistic students list (to guarantee exactly 50 students in rotation)
    const seedNames = [
      "Alice Smith", "Bob Jones", "Charlie Brown", "Diana Prince",
      "Evelyn Carter", "Liam Davies", "Sophia Martinez", "Jackson Taylor",
      "Olivia Thompson", "Lucas Jenkins", "Ava Robinson", "Noah Clark",
      "Mia Rodriguez", "Oliver Wright", "Isabella Walker", "Ethan Hall",
      "Sophia Young", "Mason King", "Charlotte Baker", "Logan Green",
      "Amelia Evans", "Jacob Turner", "Harper Hill", "Michael Campbell",
      "Emily Mitchell", "Elijah Carter", "Madison Roberts", "Daniel Gomez",
      "Avery Phillips", "William Evans", "Abigail Davis", "Lucas Parker",
      "Ella Miller", "James Moore", "Chloe Taylor", "Henry Thomas",
      "Penelope Jackson", "Sebastian White", "Layla Harris", "Carter Martin",
      "Aria Thompson", "Wyatt Garcia", "Lily Martinez", "Caleb Robinson",
      "Zoey Clark", "Ryan Lewis", "Hazel Lee", "Gabriel Walker",
      "Stella Allen", "Samuel Young"
    ];

    let createdCount = 0;
    
    for (let i = 0; i < seedNames.length; i++) {
      const name = seedNames[i];
      const email = `student${i + 1}@pulse.com`;
      
      const found = allUsers.find(u => u.email === email || u.name === name);
      if (!found) {
        // Generate random points balance between 40 and 190 for realistic visual dispersion
        const randomPoints = Math.floor(Math.random() * (190 - 40 + 1)) + 40;
        await User.create({
          schoolId,
          name,
          email,
          password: 'password123',
          role: 'student',
          pointsBalance: randomPoints
        });
        createdCount++;
      }
    }

    return res.json({ 
      success: true, 
      message: `Roster populated successfully! Assured full classroom of 50 student slots. Created ${createdCount} additional profiles.`,
      totalStudents: 50
    });
  } catch (err) {
    console.error("Error seeding students:", err.message);
    return res.status(500).json({ error: "Failed to automatically seed roster." });
  }
});

// GET /api/student/dashboard (Student/Parent view)
// Fetches the logged-in student's current points and their specific behavioral timeline logs
router.get('/student/dashboard', verifyToken, async (req, res) => {
  try {
    const studentId = req.user.id;
    
    // Safety check: ensure user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: "Dashboard is only accessible for Student/Parent logins." });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student record was not found." });
    }

    const schoolId = req.user.schoolId || 'school-main';
    // Fetch logs relating to student
    const logs = await BehaviorLog.find({ schoolId, studentId });

    // Join teacher names onto logs for high quality UX
    const teachers = await User.find({ schoolId });
    const teacherMap = teachers.reduce((acc, t) => {
      acc[t._id] = t.name;
      return acc;
    }, {});

    const enrichedLogs = logs.map(log => ({
      id: log._id,
      pointsChange: log.pointsChange,
      reason: log.reason,
      parentNotified: log.parentNotified,
      createdAt: log.createdAt,
      teacherName: teacherMap[log.teacherId] || "School Teacher"
    }));

    return res.json({
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        pointsBalance: student.pointsBalance
      },
      logs: enrichedLogs
    });
  } catch (err) {
    console.error("Error loading dashboard details:", err.message);
    return res.status(500).json({ error: "Failed to assemble student dashboard details." });
  }
});

export default router;

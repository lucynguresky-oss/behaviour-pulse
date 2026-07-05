import express from 'express';
import bcrypt from 'bcryptjs';
import School from '../models/School.js';
import User, { MongooseUser } from '../models/User.js';
import { verifyToken, requireRole } from './auth.js';
import { shouldExpressUseLocalDb } from '../config/db.js';

const router = express.Router();

// GET /api/admin/schools
// Super admin only - returns all schools and counts of users
router.get('/schools', verifyToken, requireRole('super_admin'), async (req, res) => {
  try {
    const schools = await School.find({});
    let schoolStats;

    if (shouldExpressUseLocalDb()) {
      /*
       * Local Sandbox Memory Mode
       * -------------------------
       * In the local file database sandbox, we query all records and process
       * mappings in-memory. This mimics the production counts securely.
       */
      const users = await User.find({});
      schoolStats = schools.map(school => {
        const schoolUsers = users.filter(u => u.schoolId === school._id.toString() || u.schoolId === school.subdomain);
        const studentCount = schoolUsers.filter(u => u.role === 'student').length;
        const teacherCount = schoolUsers.filter(u => u.role === 'teacher').length;
        const adminCount = schoolUsers.filter(u => u.role === 'principal' || u.role === 'deputy').length;

        return {
          id: school._id,
          name: school.name,
          subdomain: school.subdomain,
          status: school.status,
          settings: school.settings,
          createdAt: school.createdAt,
          stats: {
            students: studentCount,
            teachers: teacherCount,
            admins: adminCount
          }
        };
      });
    } else {
      /*
       * High-Performance MongoDB Production Mode
       * ----------------------------------------
       * Instead of pulling all user records into Express memory (which scales O(N) 
       * and would crash the server at high volumes), we execute a single aggregation 
       * query. The DB engine aggregates counts grouped by school and role, resolving
       * the stats in O(1) memory complexity on the API thread.
       */
      const statsAgg = await MongooseUser.aggregate([
        {
          $group: {
            _id: { schoolId: "$schoolId", role: "$role" },
            count: { $sum: 1 }
          }
        }
      ]);

      // Map group results to a nested map: schoolId -> { student: X, teacher: Y, admin: Z }
      const statsMap = {};
      statsAgg.forEach(item => {
        const sId = item._id.schoolId;
        const role = item._id.role;
        if (sId) {
          if (!statsMap[sId]) {
            statsMap[sId] = { students: 0, teachers: 0, admins: 0 };
          }
          if (role === 'student') {
            statsMap[sId].students += item.count;
          } else if (role === 'teacher') {
            statsMap[sId].teachers += item.count;
          } else if (role === 'principal' || role === 'deputy') {
            statsMap[sId].admins += item.count;
          }
        }
      });

      schoolStats = schools.map(school => {
        const sIdStr = school._id.toString();
        const subdomain = school.subdomain;
        
        // Users might be registered with school._id or school.subdomain as schoolId
        const statsObj1 = statsMap[sIdStr] || { students: 0, teachers: 0, admins: 0 };
        const statsObj2 = subdomain ? (statsMap[subdomain] || { students: 0, teachers: 0, admins: 0 }) : { students: 0, teachers: 0, admins: 0 };

        return {
          id: school._id,
          name: school.name,
          subdomain: subdomain,
          status: school.status,
          settings: school.settings,
          createdAt: school.createdAt,
          stats: {
            students: statsObj1.students + statsObj2.students,
            teachers: statsObj1.teachers + statsObj2.teachers,
            admins: statsObj1.admins + statsObj2.admins
          }
        };
      });
    }

    return res.json({ success: true, schools: schoolStats });
  } catch (err) {
    console.error("Error loading schools list:", err.message);
    return res.status(500).json({ error: "Failed to load school tenant records." });
  }
});

// POST /api/admin/schools
// Super admin only - registers a new school and provisions a Principal admin user
router.post('/schools', verifyToken, requireRole('super_admin'), async (req, res) => {
  const { name, subdomain, principalName, principalEmail, principalPassword } = req.body;

  if (!name || !subdomain || !principalName || !principalEmail || !principalPassword) {
    return res.status(400).json({ error: "All fields are required (School Name, Subdomain, Principal Name, Principal Email, Principal Password)." });
  }

  const normalizedSubdomain = subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
  const normalizedEmail = principalEmail.toLowerCase().trim();

  try {
    // 1. Verify subdomain uniqueness
    const existingSchool = await School.findOne({ subdomain: normalizedSubdomain });
    if (existingSchool) {
      return res.status(400).json({ error: `The subdomain "${normalizedSubdomain}" is already registered by another school.` });
    }

    // 2. Verify principal email uniqueness
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: `The email "${principalEmail}" is already in use by another user profile.` });
    }

    // 3. Create the School record
    const newSchool = await School.create({
      name: name.trim(),
      subdomain: normalizedSubdomain,
      status: 'active'
    });

    // Hash principal password for MongoDB (local DB wrapper handles hashing)
    let finalPassword = principalPassword;
    if (!shouldExpressUseLocalDb()) {
      const salt = await bcrypt.genSalt(10);
      finalPassword = await bcrypt.hash(principalPassword, salt);
    }

    // 4. Create the Principal user associated with the new school
    const newPrincipal = await User.create({
      schoolId: newSchool._id.toString(),
      name: principalName.trim(),
      email: normalizedEmail,
      password: finalPassword,
      role: 'principal',
      pointsBalance: 0
    });

    return res.json({
      success: true,
      message: `School "${name}" registered successfully. Principal account created.`,
      school: newSchool,
      principal: {
        id: newPrincipal._id,
        name: newPrincipal.name,
        email: newPrincipal.email,
        role: newPrincipal.role
      }
    });
  } catch (err) {
    console.error("Error creating school account:", err.message);
    return res.status(500).json({ error: "Failed to register new school tenant." });
  }
});

// PUT /api/admin/schools/:id
// Super admin only - updates school status or settings
router.put('/schools/:id', verifyToken, requireRole('super_admin'), async (req, res) => {
  const { id } = req.params;
  const { name, status, settings } = req.body;

  try {
    const school = await School.findById(id);
    if (!school) {
      return res.status(404).json({ error: "School record not found." });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (status) updates.status = status;
    if (settings) updates.settings = { ...school.settings, ...settings };

    const updatedSchool = await School.findByIdAndUpdate(id, { $set: updates });

    return res.json({
      success: true,
      message: "School settings updated successfully.",
      school: updatedSchool
    });
  } catch (err) {
    console.error("Error updating school:", err.message);
    return res.status(500).json({ error: "Failed to update school settings." });
  }
});

export default router;

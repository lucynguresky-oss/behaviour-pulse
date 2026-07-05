import express from 'express';
import bcrypt from 'bcryptjs';
import School from '../models/School.js';
import User, { MongooseUser } from '../models/User.js';
import { verifyToken, requireRole } from './auth.js';
import { shouldExpressUseLocalDb } from '../config/db.js';

const router = express.Router();

// GET /api/admin/schools
router.get('/schools', verifyToken, requireRole('super_admin'), async (req, res) => {
  try {
    const schools = await School.find({});
    let schoolStats;

    if (shouldExpressUseLocalDb()) {
      const users = await User.find({});
      schoolStats = schools.map(school => {
        const schoolUsers = users.filter(u => u.schoolId === school._id.toString() || u.schoolId === school.subdomain);
        return {
          id: school._id, name: school.name, subdomain: school.subdomain,
          status: school.status, settings: school.settings, createdAt: school.createdAt,
          stats: {
            students: schoolUsers.filter(u => u.role === 'student').length,
            teachers: schoolUsers.filter(u => u.role === 'teacher').length,
            admins: schoolUsers.filter(u => u.role === 'principal' || u.role === 'deputy').length
          }
        };
      });
    } else {
      /*
       * High-Performance MongoDB Aggregation Mode
       * Executes a single aggregation instead of loading all users into memory.
       * Resolves stats in O(1) memory complexity on the API thread.
       */
      const statsAgg = await MongooseUser.aggregate([{ $group: { _id: { schoolId: "$schoolId", role: "$role" }, count: { $sum: 1 } } }]);
      const statsMap = {};
      statsAgg.forEach(item => {
        const sId = item._id.schoolId;
        const role = item._id.role;
        if (sId) {
          if (!statsMap[sId]) statsMap[sId] = { students: 0, teachers: 0, admins: 0 };
          if (role === 'student') statsMap[sId].students += item.count;
          else if (role === 'teacher') statsMap[sId].teachers += item.count;
          else if (role === 'principal' || role === 'deputy') statsMap[sId].admins += item.count;
        }
      });
      schoolStats = schools.map(school => {
        const sIdStr = school._id.toString();
        const s1 = statsMap[sIdStr] || { students: 0, teachers: 0, admins: 0 };
        const s2 = school.subdomain ? (statsMap[school.subdomain] || { students: 0, teachers: 0, admins: 0 }) : { students: 0, teachers: 0, admins: 0 };
        return { id: school._id, name: school.name, subdomain: school.subdomain, status: school.status, settings: school.settings, createdAt: school.createdAt, stats: { students: s1.students + s2.students, teachers: s1.teachers + s2.teachers, admins: s1.admins + s2.admins } };
      });
    }

    return res.json({ success: true, schools: schoolStats });
  } catch (err) {
    console.error("Error loading schools:", err.message);
    return res.status(500).json({ error: "Failed to load school records." });
  }
});

// POST /api/admin/schools
router.post('/schools', verifyToken, requireRole('super_admin'), async (req, res) => {
  const { name, subdomain, principalName, principalEmail, principalPassword } = req.body;
  if (!name || !subdomain || !principalName || !principalEmail || !principalPassword) {
    return res.status(400).json({ error: "All fields required (School Name, Subdomain, Principal Name, Principal Email, Principal Password)." });
  }
  const normalizedSubdomain = subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
  const normalizedEmail = principalEmail.toLowerCase().trim();
  try {
    const existingSchool = await School.findOne({ subdomain: normalizedSubdomain });
    if (existingSchool) return res.status(400).json({ error: `Subdomain "${normalizedSubdomain}" already registered.` });
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(400).json({ error: `Email "${principalEmail}" already in use.` });
    const newSchool = await School.create({ name: name.trim(), subdomain: normalizedSubdomain, status: 'active' });
    let finalPassword = principalPassword;
    if (!shouldExpressUseLocalDb()) {
      const salt = await bcrypt.genSalt(10);
      finalPassword = await bcrypt.hash(principalPassword, salt);
    }
    const newPrincipal = await User.create({ schoolId: newSchool._id.toString(), name: principalName.trim(), email: normalizedEmail, password: finalPassword, role: 'principal', pointsBalance: 0 });
    return res.json({ success: true, message: `School "${name}" registered. Principal account created.`, school: newSchool, principal: { id: newPrincipal._id, name: newPrincipal.name, email: newPrincipal.email, role: newPrincipal.role } });
  } catch (err) {
    console.error("Error creating school:", err.message);
    return res.status(500).json({ error: "Failed to register new school." });
  }
});

// PUT /api/admin/schools/:id
router.put('/schools/:id', verifyToken, requireRole('super_admin'), async (req, res) => {
  const { id } = req.params;
  const { name, status, settings } = req.body;
  try {
    const school = await School.findById(id);
    if (!school) return res.status(404).json({ error: "School not found." });
    const updates = {};
    if (name) updates.name = name.trim();
    if (status) updates.status = status;
    if (settings) updates.settings = { ...school.settings, ...settings };
    const updatedSchool = await School.findByIdAndUpdate(id, { $set: updates });
    return res.json({ success: true, message: "School settings updated.", school: updatedSchool });
  } catch (err) {
    console.error("Error updating school:", err.message);
    return res.status(500).json({ error: "Failed to update school settings." });
  }
});

export default router;

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.resolve('database.json');

const starterUsers = [
  { _id: "teacher-henderson", schoolId: "school-main", name: "Mr. Henderson", email: "teacher@pulse.com", password: "BarakaNgureNjihia", role: "teacher", pointsBalance: 0 },
  { _id: "deputy-harris", schoolId: "school-main", name: "Deputy Harris", email: "deputy@pulse.com", password: "BarakaNgureNjihia", role: "deputy", pointsBalance: 0 },
  { _id: "principal-skinner", schoolId: "school-main", name: "Principal Skinner", email: "principal@pulse.com", password: "BarakaNgureNjihia", role: "principal", pointsBalance: 0 },
  { _id: "student-alice", schoolId: "school-main", name: "Alice Smith", email: "student1@pulse.com", password: "BarakaNgureNjihia", role: "student", pointsBalance: 120 },
  { _id: "student-bob", schoolId: "school-main", name: "Bob Jones", email: "student2@pulse.com", password: "BarakaNgureNjihia", role: "student", pointsBalance: 85 },
  { _id: "student-charlie", schoolId: "school-main", name: "Charlie Brown", email: "student3@pulse.com", password: "BarakaNgureNjihia", role: "student", pointsBalance: 150 },
  { _id: "student-diana", schoolId: "school-main", name: "Diana Prince", email: "student4@pulse.com", password: "BarakaNgureNjihia", role: "student", pointsBalance: 200 },
  { _id: "super-admin-global", schoolId: "global", name: "System Director", email: "superadmin@pulse.com", password: "BarakaNgureNjihia", role: "super_admin", pointsBalance: 0 }
];

const starterSchools = [
  { _id: "school-main", name: "Oakridge High School", subdomain: "oakridge", status: "active", settings: { pointsCap: 500, allowedEmailDomains: [], enableAiSuggestions: true }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

const starterLogs = [
  { _id: "log-1", schoolId: "school-main", studentId: "student-alice", teacherId: "teacher-henderson", pointsChange: 15, reason: "Outstanding participation in Science Lab and helping peers set up equipment.", parentNotified: true, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: "log-2", schoolId: "school-main", studentId: "student-alice", teacherId: "teacher-henderson", pointsChange: -10, reason: "Repeatedly interrupting others during group reading, despite warnings.", parentNotified: true, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: "log-3", schoolId: "school-main", studentId: "student-bob", teacherId: "teacher-henderson", pointsChange: 20, reason: "Showing remarkable persistence and kindness in solving a complex Math riddle.", parentNotified: true, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: "log-4", schoolId: "school-main", studentId: "student-charlie", teacherId: "teacher-henderson", pointsChange: 10, reason: "Cooperated exceptionally well with team members during field study project.", parentNotified: false, createdAt: new Date().toISOString() }
];

export function initLocalDb() {
  if (!fs.existsSync(DB_PATH)) {
    console.log("💾 Initializing new database.json with demo records...");
    const preppedUsers = starterUsers.map(user => {
      const salt = bcrypt.genSaltSync(10);
      return { ...user, password: bcrypt.hashSync(user.password, salt) };
    });
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: preppedUsers, logs: starterLogs, schools: starterSchools, emailLogs: [] }, null, 2));
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      if (!data.users || !data.logs) throw new Error("Invalid structure");
      let migrationNeeded = false;
      if (!data.schools) { data.schools = starterSchools; migrationNeeded = true; }
      if (!data.users.some(u => u.role === 'super_admin')) {
        const salt = bcrypt.genSaltSync(10);
        data.users.push({ _id: "super-admin-global", schoolId: "global", name: "System Director", email: "superadmin@pulse.com", password: bcrypt.hashSync("BarakaNgureNjihia", salt), role: "super_admin", pointsBalance: 0 });
        migrationNeeded = true;
      }
      data.users.forEach(u => { if (!u.schoolId) { u.schoolId = 'school-main'; migrationNeeded = true; } });
      data.logs.forEach(l => { if (!l.schoolId) { l.schoolId = 'school-main'; migrationNeeded = true; } });
      if (!data.emailLogs) { data.emailLogs = []; migrationNeeded = true; }
      if (migrationNeeded) {
        console.log("💾 Migrating database.json to support new features...");
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.warn("⚠️ Resetting corrupted database.json...");
      const preppedUsers = starterUsers.map(user => {
        const salt = bcrypt.genSaltSync(10);
        return { ...user, password: bcrypt.hashSync(user.password, salt) };
      });
      fs.writeFileSync(DB_PATH, JSON.stringify({ users: preppedUsers, logs: starterLogs, schools: starterSchools, emailLogs: [] }, null, 2));
    }
  }
}

function getData() {
  initLocalDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function saveData(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export const localUser = {
  find: async (query = {}) => {
    const data = getData();
    let filtered = data.users;
    for (const key in query) { if (query[key] !== undefined) filtered = filtered.filter(u => u[key] === query[key]); }
    return filtered;
  },
  findOne: async (query) => {
    const data = getData();
    return data.users.find(u => { for (const key in query) { if (u[key] !== query[key]) return false; } return true; });
  },
  findById: async (id) => { const data = getData(); return data.users.find(u => u._id === id); },
  create: async (userData) => {
    const data = getData();
    const newUser = { _id: `user-${Date.now()}`, schoolId: 'school-main', pointsBalance: 0, ...userData };
    if (newUser.password) { const salt = bcrypt.genSaltSync(10); newUser.password = bcrypt.hashSync(newUser.password, salt); }
    data.users.push(newUser); saveData(data); return newUser;
  },
  findByIdAndUpdate: async (id, update) => {
    const data = getData();
    const index = data.users.findIndex(u => u._id === id);
    if (index === -1) return null;
    let updatedUser = { ...data.users[index] };
    if (update.$inc) { for (const key in update.$inc) { updatedUser[key] = (updatedUser[key] || 0) + update.$inc[key]; } }
    for (const key in update) { if (key !== '$inc' && key !== '$set') updatedUser[key] = update[key]; }
    if (update.$set) { for (const key in update.$set) { updatedUser[key] = update.$set[key]; } }
    data.users[index] = updatedUser; saveData(data); return updatedUser;
  }
};

export const localLog = {
  find: async (query = {}) => {
    const data = getData();
    let filtered = data.logs;
    if (query._id) filtered = filtered.filter(l => l._id === query._id);
    if (query.schoolId) filtered = filtered.filter(l => l.schoolId === query.schoolId);
    if (query.studentId) filtered = filtered.filter(l => l.studentId === query.studentId);
    if (query.teacherId) filtered = filtered.filter(l => l.teacherId === query.teacherId);
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  create: async (logData) => {
    const data = getData();
    const newLog = { _id: `log-${Date.now()}`, schoolId: 'school-main', createdAt: new Date().toISOString(), ...logData };
    data.logs.push(newLog); saveData(data); return newLog;
  },
  findByIdAndUpdate: async (id, update) => {
    const data = getData();
    const index = data.logs.findIndex(l => l._id === id);
    if (index === -1) return null;
    const updated = { ...data.logs[index] };
    if (update.$set) { Object.assign(updated, update.$set); }
    else { for (const key in update) { if (!key.startsWith('$')) updated[key] = update[key]; } }
    data.logs[index] = updated; saveData(data); return updated;
  }
};

export const localSchool = {
  find: async (query = {}) => {
    const data = getData();
    let filtered = data.schools || [];
    for (const key in query) { if (query[key] !== undefined) filtered = filtered.filter(s => s[key] === query[key]); }
    return filtered;
  },
  findOne: async (query) => {
    const data = getData();
    const schools = data.schools || [];
    return schools.find(s => { for (const key in query) { if (s[key] !== query[key]) return false; } return true; });
  },
  findById: async (id) => { const data = getData(); return (data.schools || []).find(s => s._id === id); },
  create: async (schoolData) => {
    const data = getData();
    if (!data.schools) data.schools = [];
    const newSchool = { _id: `school-${Date.now()}`, status: 'active', settings: { pointsCap: 500, allowedEmailDomains: [], enableAiSuggestions: true }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...schoolData };
    data.schools.push(newSchool); saveData(data); return newSchool;
  },
  findByIdAndUpdate: async (id, update) => {
    const data = getData();
    if (!data.schools) data.schools = [];
    const index = data.schools.findIndex(s => s._id === id);
    if (index === -1) return null;
    const updated = { ...data.schools[index], updatedAt: new Date().toISOString() };
    if (update.$set) { Object.assign(updated, update.$set); }
    else { for (const key in update) { if (!key.startsWith('$')) updated[key] = update[key]; } }
    data.schools[index] = updated; saveData(data); return updated;
  }
};

/**
 * Local file-based mock driver for EmailLog operations.
 */
export const localEmailLog = {
  /**
   * Queries local email log records.
   * @param {Object} query - Key-value pair filters
   * @returns {Promise<Array<Object>>} Filtered and date-sorted email log objects
   */
  find: async (query = {}) => {
    const data = getData();
    let filteredLogs = data.emailLogs || [];
    if (query._id) filteredLogs = filteredLogs.filter(log => log._id === query._id);
    if (query.schoolId) filteredLogs = filteredLogs.filter(log => log.schoolId === query.schoolId);
    if (query.studentEmail) filteredLogs = filteredLogs.filter(log => log.studentEmail === query.studentEmail);
    return filteredLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /**
   * Appends a new email log record.
   * @param {Object} logData - Initial log details
   * @returns {Promise<Object>} Newly created log object
   */
  create: async (logData) => {
    const data = getData();
    if (!data.emailLogs) data.emailLogs = [];
    const newLog = { _id: `email-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`, schoolId: 'school-main', createdAt: new Date().toISOString(), status: 'pending', ...logData };
    data.emailLogs.push(newLog); saveData(data); return newLog;
  },

  /**
   * Finds an email log by ID and updates its properties.
   * @param {String} id - Unique log ID
   * @param {Object} update - Partial update fields
   * @returns {Promise<Object|null>} Updated log record
   */
  findByIdAndUpdate: async (id, update) => {
    const data = getData();
    if (!data.emailLogs) data.emailLogs = [];
    const logIndex = data.emailLogs.findIndex(log => log._id === id);
    if (logIndex === -1) return null;
    const updatedLog = { ...data.emailLogs[logIndex] };
    if (update.$set) { Object.assign(updatedLog, update.$set); }
    else { for (const key in update) { if (!key.startsWith('$')) updatedLog[key] = update[key]; } }
    data.emailLogs[logIndex] = updatedLog; saveData(data); return updatedLog;
  }
};

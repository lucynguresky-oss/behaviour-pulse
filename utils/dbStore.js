import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.resolve('database.json');

// Initialize starter users
const starterUsers = [
  {
    _id: "teacher-henderson",
    schoolId: "school-main",
    name: "Mr. Henderson",
    email: "teacher@pulse.com",
    password: "BarakaNgureNjihia", // Will be hashed on startup
    role: "teacher",
    pointsBalance: 0
  },
  {
    _id: "deputy-harris",
    schoolId: "school-main",
    name: "Deputy Harris",
    email: "deputy@pulse.com",
    password: "BarakaNgureNjihia", // Will be hashed on startup
    role: "deputy",
    pointsBalance: 0
  },
  {
    _id: "principal-skinner",
    schoolId: "school-main",
    name: "Principal Skinner",
    email: "principal@pulse.com",
    password: "BarakaNgureNjihia", // Will be hashed on startup
    role: "principal",
    pointsBalance: 0
  },
  {
    _id: "student-alice",
    schoolId: "school-main",
    name: "Alice Smith",
    email: "student1@pulse.com",
    password: "BarakaNgureNjihia", // Will be hashed on startup
    role: "student",
    pointsBalance: 120
  },
  {
    _id: "student-bob",
    schoolId: "school-main",
    name: "Bob Jones",
    email: "student2@pulse.com",
    password: "BarakaNgureNjihia", // Will be hashed on startup
    role: "student",
    pointsBalance: 85
  },
  {
    _id: "student-charlie",
    schoolId: "school-main",
    name: "Charlie Brown",
    email: "student3@pulse.com",
    password: "BarakaNgureNjihia", // Will be hashed on startup
    role: "student",
    pointsBalance: 150
  },
  {
    _id: "student-diana",
    schoolId: "school-main",
    name: "Diana Prince",
    email: "student4@pulse.com",
    password: "BarakaNgureNjihia", // Will be hashed on startup
    role: "student",
    pointsBalance: 200
  },
  {
    _id: "super-admin-global",
    schoolId: "global",
    name: "System Director",
    email: "superadmin@pulse.com",
    password: "BarakaNgureNjihia", // Will be hashed on startup
    role: "super_admin",
    pointsBalance: 0
  }
];

// Initialize starter schools
const starterSchools = [
  {
    _id: "school-main",
    name: "Oakridge High School",
    subdomain: "oakridge",
    status: "active",
    settings: {
      pointsCap: 500,
      allowedEmailDomains: [],
      enableAiSuggestions: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Initialize starter logs
const starterLogs = [
  {
    _id: "log-1",
    schoolId: "school-main",
    studentId: "student-alice",
    teacherId: "teacher-henderson",
    pointsChange: 15,
    reason: "Outstanding participation in Science Lab and helping peers set up equipment.",
    parentNotified: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
  },
  {
    _id: "log-2",
    schoolId: "school-main",
    studentId: "student-alice",
    teacherId: "teacher-henderson",
    pointsChange: -10,
    reason: "Repeatedly interrupting others during group reading, despite warnings.",
    parentNotified: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
  },
  {
    _id: "log-3",
    schoolId: "school-main",
    studentId: "student-bob",
    teacherId: "teacher-henderson",
    pointsChange: 20,
    reason: "Showing remarkable persistence and kindness in solving a complex Math riddle.",
    parentNotified: true,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
  },
  {
    _id: "log-4",
    schoolId: "school-main",
    studentId: "student-charlie",
    teacherId: "teacher-henderson",
    pointsChange: 10,
    reason: "Cooperated exceptionally well with team members during field study project.",
    parentNotified: false,
    createdAt: new Date().toISOString()
  }
];

export function initLocalDb() {
  if (!fs.existsSync(DB_PATH)) {
    console.log("💾 Initializing a new database.json file with demo records...");
    
    // Hash passwords of starter users
    const preppedUsers = starterUsers.map(user => {
      const salt = bcrypt.genSaltSync(10);
      return {
        ...user,
        password: bcrypt.hashSync(user.password, salt)
      };
    });

    const initialData = {
      users: preppedUsers,
      logs: starterLogs,
      schools: starterSchools,
      emailLogs: []
    };

    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
  } else {
    // Read and verify everything is fine, migrate existing records
    try {
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      if (!data.users || !data.logs) {
        throw new Error("Invalid structure");
      }
      
      let migrationNeeded = false;
      
      // Ensure schools array exists
      if (!data.schools) {
        data.schools = starterSchools;
        migrationNeeded = true;
      }
      
      // Ensure super_admin starter user exists
      const superAdminExists = data.users.some(u => u.role === 'super_admin');
      if (!superAdminExists) {
        const salt = bcrypt.genSaltSync(10);
        data.users.push({
          _id: "super-admin-global",
          schoolId: "global",
          name: "System Director",
          email: "superadmin@pulse.com",
          password: bcrypt.hashSync("BarakaNgureNjihia", salt),
          role: "super_admin",
          pointsBalance: 0
        });
        migrationNeeded = true;
      }

      data.users.forEach(u => {
        if (!u.schoolId) {
          u.schoolId = 'school-main';
          migrationNeeded = true;
        }
      });
      data.logs.forEach(l => {
        if (!l.schoolId) {
          l.schoolId = 'school-main';
          migrationNeeded = true;
        }
      });
      
      // Ensure emailLogs array exists
      if (!data.emailLogs) {
        data.emailLogs = [];
        migrationNeeded = true;
      }
      
      if (migrationNeeded) {
        console.log("💾 Migrating existing database.json to support multi-tenancy, super_admin, and email logs...");
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.warn("⚠️ Resetting corrupted database.json...");
      const preppedUsers = starterUsers.map(user => {
        const salt = bcrypt.genSaltSync(10);
        return {
          ...user,
          password: bcrypt.hashSync(user.password, salt)
        };
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

// User methods
export const localUser = {
  find: async (query = {}) => {
    const data = getData();
    let filtered = data.users;
    for (const key in query) {
      if (query[key] !== undefined) {
        filtered = filtered.filter(u => u[key] === query[key]);
      }
    }
    return filtered;
  },

  findOne: async (query) => {
    const data = getData();
    return data.users.find(u => {
      for (const key in query) {
        if (u[key] !== query[key]) return false;
      }
      return true;
    });
  },

  findById: async (id) => {
    const data = getData();
    return data.users.find(u => u._id === id);
  },

  create: async (userData) => {
    const data = getData();
    const newUser = {
      _id: `user-${Date.now()}`,
      schoolId: 'school-main',
      pointsBalance: 0,
      ...userData
    };
    if (newUser.password) {
      const salt = bcrypt.genSaltSync(10);
      newUser.password = bcrypt.hashSync(newUser.password, salt);
    }
    data.users.push(newUser);
    saveData(data);
    return newUser;
  },

  findByIdAndUpdate: async (id, update) => {
    const data = getData();
    const index = data.users.findIndex(u => u._id === id);
    if (index === -1) return null;
    
    let updatedUser = { ...data.users[index] };
    
    if (update.$inc) {
      for (const key in update.$inc) {
        updatedUser[key] = (updatedUser[key] || 0) + update.$inc[key];
      }
    }
    
    // Support normal updates too
    for (const key in update) {
      if (key !== '$inc' && key !== '$set') {
        updatedUser[key] = update[key];
      }
    }
    
    if (update.$set) {
      for (const key in update.$set) {
        updatedUser[key] = update.$set[key];
      }
    }

    data.users[index] = updatedUser;
    saveData(data);
    return updatedUser;
  }
};

// BehaviorLog methods
export const localLog = {
  find: async (query = {}) => {
    const data = getData();
    let filtered = data.logs;
    
    if (query._id) {
      filtered = filtered.filter(l => l._id === query._id);
    }
    if (query.schoolId) {
      filtered = filtered.filter(l => l.schoolId === query.schoolId);
    }
    if (query.studentId) {
      filtered = filtered.filter(l => l.studentId === query.studentId);
    }
    if (query.teacherId) {
      filtered = filtered.filter(l => l.teacherId === query.teacherId);
    }
    
    // Sort descending by date
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  create: async (logData) => {
    const data = getData();
    const newLog = {
      _id: `log-${Date.now()}`,
      schoolId: 'school-main',
      createdAt: new Date().toISOString(),
      ...logData
    };
    data.logs.push(newLog);
    saveData(data);
    return newLog;
  },

  findByIdAndUpdate: async (id, update) => {
    const data = getData();
    const index = data.logs.findIndex(l => l._id === id);
    if (index === -1) return null;
    const current = data.logs[index];
    const updated = { ...current };
    
    if (update.$set) {
      Object.assign(updated, update.$set);
    } else {
      for (const key in update) {
        if (key.startsWith('$')) continue;
        updated[key] = update[key];
      }
    }
    
    data.logs[index] = updated;
    saveData(data);
    return updated;
  }
};

// School methods
export const localSchool = {
  find: async (query = {}) => {
    const data = getData();
    let filtered = data.schools || [];
    for (const key in query) {
      if (query[key] !== undefined) {
        filtered = filtered.filter(s => s[key] === query[key]);
      }
    }
    return filtered;
  },

  findOne: async (query) => {
    const data = getData();
    const schools = data.schools || [];
    return schools.find(s => {
      for (const key in query) {
        if (s[key] !== query[key]) return false;
      }
      return true;
    });
  },

  findById: async (id) => {
    const data = getData();
    const schools = data.schools || [];
    return schools.find(s => s._id === id);
  },

  create: async (schoolData) => {
    const data = getData();
    if (!data.schools) data.schools = [];
    const newSchool = {
      _id: `school-${Date.now()}`,
      status: 'active',
      settings: {
        pointsCap: 500,
        allowedEmailDomains: [],
        enableAiSuggestions: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...schoolData
    };
    data.schools.push(newSchool);
    saveData(data);
    return newSchool;
  },

  findByIdAndUpdate: async (id, update) => {
    const data = getData();
    if (!data.schools) data.schools = [];
    const index = data.schools.findIndex(s => s._id === id);
    if (index === -1) return null;
    const current = data.schools[index];
    const updated = { ...current, updatedAt: new Date().toISOString() };
    
    if (update.$set) {
      Object.assign(updated, update.$set);
    } else {
      for (const key in update) {
        if (key.startsWith('$')) continue;
        updated[key] = update[key];
      }
    }
    
    data.schools[index] = updated;
    saveData(data);
    return updated;
  }
};

// EmailLog methods
/**
 * Local file-based mock driver for EmailLog operations.
 * Simulates standard database collections using JSON reads and writes.
 */
export const localEmailLog = {
  /**
   * Queries local email log records from the JSON database file.
   * @param {Object} query - Key-value pair filters
   * @returns {Promise<Array<Object>>} Filtered and date-sorted array of email log objects
   */
  find: async (query = {}) => {
    const data = getData();
    let filteredLogs = data.emailLogs || [];
    
    if (query._id) {
      filteredLogs = filteredLogs.filter(log => log._id === query._id);
    }
    if (query.schoolId) {
      filteredLogs = filteredLogs.filter(log => log.schoolId === query.schoolId);
    }
    if (query.studentEmail) {
      filteredLogs = filteredLogs.filter(log => log.studentEmail === query.studentEmail);
    }
    
    // Sort descending by date (newest logs first)
    return filteredLogs.sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
  },

  /**
   * Appends a new email log record to the local JSON database file.
   * @param {Object} logData - Initial log details
   * @returns {Promise<Object>} The newly created local log object
   */
  create: async (logData) => {
    const data = getData();
    if (!data.emailLogs) data.emailLogs = [];
    const newLog = {
      _id: `email-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      schoolId: 'school-main',
      createdAt: new Date().toISOString(),
      status: 'pending',
      ...logData
    };
    data.emailLogs.push(newLog);
    saveData(data);
    return newLog;
  },

  /**
   * Finds an email log record by ID and updates its properties.
   * @param {String} id - Unique log ID
   * @param {Object} update - Partial update fields or Mongoose-style set operators
   * @returns {Promise<Object|null>} The updated log record, or null if not found
   */
  findByIdAndUpdate: async (id, update) => {
    const data = getData();
    if (!data.emailLogs) data.emailLogs = [];
    const logIndex = data.emailLogs.findIndex(log => log._id === id);
    if (logIndex === -1) return null;
    const currentLog = data.emailLogs[logIndex];
    const updatedLog = { ...currentLog };
    
    // Apply updates, supporting both plain fields and $set operator structures
    if (update.$set) {
      Object.assign(updatedLog, update.$set);
    } else {
      for (const key in update) {
        if (key.startsWith('$')) continue;
        updatedLog[key] = update[key];
      }
    }
    
    data.emailLogs[logIndex] = updatedLog;
    saveData(data);
    return updatedLog;
  }
};

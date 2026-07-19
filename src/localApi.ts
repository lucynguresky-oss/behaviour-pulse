/**
 * localApi.ts — Full in-browser API for BehaviorPulse
 *
 * Intercepts every /api/* fetch call and serves it from localStorage when
 * the app is on a static host (GitHub Pages) without a live backend.
 *
 * Data lives in localStorage under "bp_db_v3" so it survives page refreshes.
 */

// ─── Types ────────────────────────────────────────────────────────────────────
interface DbUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'teacher' | 'student' | 'deputy' | 'principal' | 'super_admin';
  pointsBalance: number;
  schoolId: string;
  className?: string;
}

interface DbBehaviorLog {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  pointsChange: number;
  reason: string;
  parentNotified: boolean;
  escalatedToAdmin: boolean;
  adminStatus?: 'pending_review' | 'action_taken' | 'archived';
  adminAction?: string;
  adminNotes?: string;
  adminReviewedBy?: string;
  adminReviewedAt?: string;
  createdAt: string;
}

interface DbEmailLog {
  id: string;
  status: 'delivered' | 'failed' | 'pending';
  deliveryMode: 'simulated_debug' | 'ethereal' | 'smtp_delivered';
  subject: string;
  recipientEmails: string[];
  targetLabel: string;
  previewUrl?: string;
  error?: string;
  createdAt: string;
}

interface DbSchool {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'suspended';
  settings: {
    pointsCap: number;
    allowedEmailDomains: string[];
    enableAiSuggestions: boolean;
  };
  createdAt: string;
}

interface Database {
  users: DbUser[];
  behaviorLogs: DbBehaviorLog[];
  emailLogs: DbEmailLog[];
  schools: DbSchool[];
}

// ─── Seed data ────────────────────────────────────────────────────────────────
const SEED_NAMES = [
  'Alice Smith', 'Bob Jones', 'Charlie Brown', 'Diana Prince',
  'Evelyn Carter', 'Liam Davies', 'Sophia Martinez', 'Jackson Taylor',
  'Olivia Thompson', 'Lucas Jenkins', 'Ava Robinson', 'Noah Clark',
  'Mia Rodriguez', 'Oliver Wright', 'Isabella Walker', 'Ethan Hall',
  'Sophia Young', 'Mason King', 'Charlotte Baker', 'Logan Green',
  'Amelia Evans', 'Jacob Turner', 'Harper Hill', 'Michael Campbell',
  'Emily Mitchell', 'Elijah Carter', 'Madison Roberts', 'Daniel Gomez',
  'Avery Phillips', 'William Evans', 'Abigail Davis', 'Lucas Parker',
  'Ella Miller', 'James Moore', 'Chloe Taylor', 'Henry Thomas',
  'Penelope Jackson', 'Sebastian White', 'Layla Harris', 'Carter Martin',
  'Aria Thompson', 'Wyatt Garcia', 'Lily Martinez', 'Caleb Robinson',
  'Zoey Clark', 'Ryan Lewis', 'Hazel Lee', 'Gabriel Walker',
  'Stella Allen', 'Samuel Young',
];

/** Build the full roster of 50 demo students */
function buildDefaultStudents(): DbUser[] {
  return SEED_NAMES.map((name, i) => ({
    id: `u-student-${i + 1}`,
    name,
    email: `student${i + 1}@pulse.com`,
    password: 'BarakaNgureNjihia',
    role: 'student' as const,
    pointsBalance: Math.floor(Math.random() * 150) + 40,
    schoolId: 'school-main',
    className: '',
  }));
}

const DEFAULT_USERS: DbUser[] = [
  {
    id: 'u-teacher-1',
    name: 'Mr. Henderson',
    email: 'teacher@pulse.com',
    password: 'BarakaNgureNjihia',
    role: 'teacher',
    pointsBalance: 0,
    schoolId: 'school-main',
  },
  {
    id: 'u-principal-1',
    name: 'Principal Skinner',
    email: 'principal@pulse.com',
    password: 'BarakaNgureNjihia',
    role: 'principal',
    pointsBalance: 0,
    schoolId: 'school-main',
  },
  {
    id: 'u-deputy-1',
    name: 'Deputy Harris',
    email: 'deputy@pulse.com',
    password: 'BarakaNgureNjihia',
    role: 'deputy',
    pointsBalance: 0,
    schoolId: 'school-main',
  },
  {
    id: 'u-superadmin-1',
    name: 'Super Admin',
    email: 'superadmin@pulse.com',
    password: 'BarakaNgureNjihia',
    role: 'super_admin',
    pointsBalance: 0,
    schoolId: 'school-main',
  },
  // 50 demo students included at first boot
  ...buildDefaultStudents(),
];

const DEFAULT_SCHOOLS: DbSchool[] = [
  {
    id: 'school-main',
    name: 'BehaviorPulse Demo School',
    subdomain: 'demo',
    status: 'active',
    settings: { pointsCap: 500, allowedEmailDomains: ['pulse.com'], enableAiSuggestions: true },
    createdAt: new Date().toISOString(),
  },
];

// ─── Database helpers ─────────────────────────────────────────────────────────
const DB_KEY = 'bp_db_v3';

function loadDb(): Database {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure schools array exists (migration from older DB versions)
      if (!parsed.schools) parsed.schools = DEFAULT_SCHOOLS;
      return parsed;
    }
  } catch { /* fall through */ }

  // First boot — seed defaults
  const db: Database = {
    users: DEFAULT_USERS,
    behaviorLogs: [],
    emailLogs: [],
    schools: DEFAULT_SCHOOLS,
  };
  saveDb(db);
  return db;
}

function saveDb(db: Database): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function uid(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Token helpers (base64 — not cryptographically secure, demo-only) ─────────
function makeToken(user: DbUser): string {
  const payload = { id: user.id, role: user.role, email: user.email, name: user.name, schoolId: user.schoolId };
  return `local.${btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}`;
}

function decodeToken(token: string): { id: string; role: string; email: string; name: string; schoolId: string } | null {
  try {
    if (!token.startsWith('local.')) return null;
    return JSON.parse(decodeURIComponent(escape(atob(token.slice(6)))));
  } catch { return null; }
}

// ─── Response helpers ─────────────────────────────────────────────────────────
function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────
async function handleLocalRequest(
  url: string,
  method: string,
  body: any,
  authToken: string | null,
): Promise<Response | null> {
  const db = loadDb();

  // ── Auth: Login ──────────────────────────────────────────────────────────────
  if (url === '/api/auth/login' && method === 'POST') {
    const { email, password } = body || {};
    const user = db.users.find(u => u.email === (email || '').toLowerCase().trim());
    if (!user || user.password !== password) {
      return err('Invalid email or password', 401);
    }
    return ok({
      token: makeToken(user),
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, schoolId: user.schoolId, pointsBalance: user.pointsBalance,
      },
    });
  }

  // All other routes require a valid token
  const decoded = decodeToken(authToken || '');
  if (!decoded) {
    return err('Unauthorized — please log in again.', 401);
  }

  // ── Students: List ──────────────────────────────────────────────────────────
  if (url === '/api/students' && method === 'GET') {
    const students = db.users.filter(
      u => u.role === 'student' && u.schoolId === decoded.schoolId,
    );
    return ok(
      students.map(s => ({
        id: s.id, name: s.name, email: s.email,
        pointsBalance: s.pointsBalance, schoolId: s.schoolId, className: s.className || '',
      })),
    );
  }

  // ── Students: Create ───────────────────────────────────────────────────────
  if (url === '/api/students' && method === 'POST') {
    const { name, email, pointsBalance, className } = body || {};
    if (!name || !email) return err('Name and email are required.');
    const norm = (email as string).toLowerCase().trim();
    if (db.users.find(u => u.email === norm && u.schoolId === decoded.schoolId)) {
      return err(`A student with the email "${email}" already exists.`);
    }
    const newUser: DbUser = {
      id: uid(), name: (name as string).trim(), email: norm,
      password: 'password123', role: 'student',
      pointsBalance: parseInt(pointsBalance, 10) || 0,
      schoolId: decoded.schoolId, className: ((className || '') as string).trim(),
    };
    db.users.push(newUser);
    saveDb(db);
    return ok({
      success: true,
      message: `Student account for ${name} has been created.`,
      student: { id: newUser.id, name: newUser.name, email: newUser.email, pointsBalance: newUser.pointsBalance, className: newUser.className },
    });
  }

  // ── Students: Seed demo ────────────────────────────────────────────────────
  if (url === '/api/students/seed-demo' && method === 'POST') {
    let created = 0;
    SEED_NAMES.forEach((name, i) => {
      const email = `student${i + 1}@pulse.com`;
      if (!db.users.find(u => u.email === email && u.schoolId === decoded.schoolId)) {
        db.users.push({
          id: uid(), name, email, password: 'BarakaNgureNjihia', role: 'student',
          pointsBalance: Math.floor(Math.random() * 150) + 40,
          schoolId: decoded.schoolId, className: '',
        });
        created++;
      }
    });
    saveDb(db);
    return ok({
      success: true,
      message: `Roster synced! ${created} new student profiles created. All 50 slots filled.`,
      totalStudents: SEED_NAMES.length,
    });
  }

  // ── Student: Dashboard ─────────────────────────────────────────────────────
  if (url === '/api/student/dashboard' && method === 'GET') {
    // Refresh student from DB to get latest pointsBalance
    const student = db.users.find(u => u.id === decoded.id);
    if (!student) return err('Student not found.', 404);

    const logs = db.behaviorLogs
      .filter(l => l.studentId === decoded.id && l.schoolId === decoded.schoolId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(l => ({
        id: l.id, pointsChange: l.pointsChange, reason: l.reason,
        parentNotified: l.parentNotified, createdAt: l.createdAt, teacherName: l.teacherName,
      }));

    return ok({
      student: { id: student.id, name: student.name, email: student.email, pointsBalance: student.pointsBalance },
      logs,
    });
  }

  // ── Behavior: Single log ───────────────────────────────────────────────────
  if (url === '/api/behavior/log' && method === 'POST') {
    const { studentId, pointsChange, reason, sendEmail, notificationTarget, escalatedToAdmin } = body || {};
    const student = db.users.find(u => u.id === studentId && u.schoolId === decoded.schoolId);
    if (!student) return err('Student not found.', 404);

    const pts = parseInt(pointsChange, 10) || 0;
    student.pointsBalance += pts;

    const log: DbBehaviorLog = {
      id: uid(), schoolId: decoded.schoolId,
      studentId, studentName: student.name,
      teacherId: decoded.id, teacherName: decoded.name,
      pointsChange: pts,
      reason: ((reason || '') as string).trim(),
      parentNotified: !!sendEmail, escalatedToAdmin: !!escalatedToAdmin,
      adminStatus: escalatedToAdmin ? 'pending_review' : undefined,
      createdAt: new Date().toISOString(),
    };
    db.behaviorLogs.push(log);

    if (sendEmail) {
      db.emailLogs.unshift({
        id: uid(), status: 'delivered', deliveryMode: 'simulated_debug',
        subject: `Behaviour Update for ${student.name}`,
        recipientEmails: ['parent@example.com'],
        targetLabel: notificationTarget || 'parents',
        createdAt: new Date().toISOString(),
      });
    }

    saveDb(db);
    return ok({ success: true, message: `Points adjusted by ${pts > 0 ? '+' : ''}${pts} for ${student.name}.`, log });
  }

  // ── Behavior: Bulk log ─────────────────────────────────────────────────────
  if (url === '/api/behavior/bulk-log' && method === 'POST') {
    const { studentIds, pointsChange, reason, sendEmail, notificationTarget, escalatedToAdmin } = body || {};
    const pts = parseInt(pointsChange, 10) || 0;
    let count = 0;

    ((studentIds || []) as string[]).forEach(sid => {
      const student = db.users.find(u => u.id === sid && u.schoolId === decoded.schoolId);
      if (!student) return;
      student.pointsBalance += pts;
      db.behaviorLogs.push({
        id: uid(), schoolId: decoded.schoolId,
        studentId: sid, studentName: student.name,
        teacherId: decoded.id, teacherName: decoded.name,
        pointsChange: pts, reason: ((reason || '') as string).trim(),
        parentNotified: !!sendEmail, escalatedToAdmin: !!escalatedToAdmin,
        adminStatus: escalatedToAdmin ? 'pending_review' : undefined,
        createdAt: new Date().toISOString(),
      });
      if (sendEmail) {
        db.emailLogs.unshift({
          id: uid(), status: 'delivered', deliveryMode: 'simulated_debug',
          subject: `Group Behaviour Update for ${student.name}`,
          recipientEmails: ['parent@example.com'],
          targetLabel: notificationTarget || 'parents',
          createdAt: new Date().toISOString(),
        });
      }
      count++;
    });

    saveDb(db);
    return ok({ success: true, message: `Group adjustment of ${pts > 0 ? '+' : ''}${pts} applied to ${count} students.` });
  }

  // ── Behavior: Admin review (resolve escalated report) ─────────────────────
  // Matches: POST /api/behavior/review/:id
  if (url.startsWith('/api/behavior/review/') && method === 'POST') {
    const logId = url.split('/').pop();
    const log = db.behaviorLogs.find(l => l.id === logId);
    if (!log) return err('Log record not found.', 404);

    const { adminAction, adminNotes, adminStatus } = body || {};
    log.adminStatus = adminStatus || 'action_taken';
    log.adminAction = (adminAction || '').trim();
    log.adminNotes = (adminNotes || '').trim();
    log.adminReviewedBy = decoded.name;
    log.adminReviewedAt = new Date().toISOString();

    saveDb(db);
    return ok({ success: true, message: 'Executive review recorded on the audit ledger.', log });
  }

  // ── Behavior: All logs (teacher / admin view) ──────────────────────────────
  if (url === '/api/behavior/all-logs' && method === 'GET') {
    const logs = db.behaviorLogs
      .filter(l => l.schoolId === decoded.schoolId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return ok({ success: true, logs });
  }

  // ── Email logs ──────────────────────────────────────────────────────────────
  if (url === '/api/behavior/email-logs' && method === 'GET') {
    return ok({
      success: true,
      logs: db.emailLogs,
      smtpSettings: { isConfigured: false, host: 'smtp.ethereal.email', port: '587', user: '' },
    });
  }

  if (url === '/api/behavior/email-logs/retry-all' && method === 'POST') {
    db.emailLogs.forEach(l => { if (l.status === 'failed') l.status = 'delivered'; });
    saveDb(db);
    return ok({ success: true, message: 'All failed emails retried successfully.' });
  }

  if (url.startsWith('/api/behavior/email-logs/retry-single/') && method === 'POST') {
    const id = url.split('/').pop();
    const log = db.emailLogs.find(l => l.id === id);
    if (log) { log.status = 'delivered'; saveDb(db); }
    return ok({ success: true, message: 'Email resent successfully.' });
  }

  // ── AI: Refine observation text ────────────────────────────────────────────
  if (url === '/api/ai/refine' && method === 'POST') {
    const { reason, studentName, pointsChange } = body || {};
    const raw = ((reason || '') as string).trim();
    const pts = Number(pointsChange) || 0;
    const name = (studentName as string || '').trim();

    // Detect sentiment from word signals and points direction
    const positiveSignals = ['active', 'help', 'assist', 'volunteer', 'excel', 'great', 'good',
      'kind', 'leader', 'participat', 'respect', 'effort', 'focus', 'improv', 'achiev',
      'polite', 'cooperat', 'support', 'contribut', 'honest', 'punctual', 'creative',
      'outstanding', 'fantastic', 'praise', 'calm', 'listen', 'motivat', 'pass', 'succeed'];
    const negativeSignals = ['disrupt', 'fight', 'argue', 'late', 'absent', 'rude', 'bully',
      'cheat', 'phone', 'distract', 'ignore', 'refuse', 'fail', 'aggressive', 'disrespect',
      'misbehav', 'shout', 'threw', 'broke', 'damage', 'sleep', 'miss', 'skip', 'absent'];

    const rawLower = raw.toLowerCase();
    const posHits = positiveSignals.filter(w => rawLower.includes(w)).length;
    const negHits = negativeSignals.filter(w => rawLower.includes(w)).length;
    const isPositive = posHits > negHits || (posHits === negHits && pts >= 0);

    // Capitalise first letter of the raw observation
    const capitalised = raw.charAt(0).toUpperCase() + raw.slice(1);
    // Ensure it ends with a period
    const sentence = capitalised.endsWith('.') || capitalised.endsWith('!') || capitalised.endsWith('?')
      ? capitalised : `${capitalised}.`;

    let polished: string;
    if (isPositive) {
      const closings = [
        `This commendable behaviour reflects positively on ${name || 'the student'}'s character and sets an excellent example for the class.`,
        `${name || 'The student'}'s positive conduct is acknowledged and greatly appreciated by the school community.`,
        `This demonstrates the kind of responsibility and initiative that BehaviorPulse recognises and rewards.`,
        `Such positive engagement is a strong reflection of ${name || 'the student'}'s commitment to their academic growth.`,
      ];
      polished = `${sentence} ${closings[Math.floor(Math.random() * closings.length)]}`;
    } else {
      const closings = [
        `This matter has been formally recorded and the school will follow up with appropriate intervention and guidance to support ${name || 'the student'}'s behavioural development.`,
        `Parents and guardians will be informed as appropriate. The school remains committed to helping ${name || 'the student'} reach their full potential through structured support.`,
        `A constructive improvement plan will be discussed with ${name || 'the student'} to address this and encourage more positive engagement going forward.`,
        `This record serves as a formal note on the student's conduct. The school will provide the necessary guidance to facilitate positive behavioural change.`,
      ];
      polished = `${sentence} ${closings[Math.floor(Math.random() * closings.length)]}`;
    }

    return ok({ success: true, refined: polished });
  }


  // ── AI: Parse roster text ──────────────────────────────────────────────────
  if (url === '/api/ai/parse-roster' && method === 'POST') {
    const { rawText } = body || {};
    const lines = ((rawText || '') as string).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const students: Array<{ name: string; email: string; pointsBalance: number }> = [];
    lines.forEach(line => {
      const parts = line.split(/[\s,;|]+/);
      if (parts.length >= 2) {
        const possibleEmail = parts.find(p => p.includes('@'));
        if (possibleEmail) {
          const nameParts = parts.filter(p => !p.includes('@'));
          if (nameParts.length > 0) {
            students.push({ name: nameParts.join(' '), email: possibleEmail.toLowerCase(), pointsBalance: 67 });
          }
        } else {
          // Treat the whole line as a name, generate an email
          const safeName = parts[0].toLowerCase();
          const safeSurname = (parts[parts.length - 1] || 'student').toLowerCase();
          students.push({ name: parts.join(' '), email: `${safeName}.${safeSurname}@pulse.com`, pointsBalance: 67 });
        }
      }
    });
    return ok({ success: true, students });
  }

  // ── AI: Student reflection advisor ────────────────────────────────────────
  if (url === '/api/ai/reflection' && method === 'POST') {
    const { name, pointsBalance, logs } = body || {};
    const pts = Number(pointsBalance) || 0;
    const tier =
      pts >= 200 ? 'Paragon' :
      pts >= 120 ? 'Leadership' :
      pts >= 80  ? 'Active Contributor' :
      pts >= 0   ? 'Developing' : 'Needs Support';

    const advice =
      `${name}, you currently have ${pts} points placing you in the "${tier}" tier. ` +
      (pts >= 100
        ? 'Your consistent positive behaviour is setting a wonderful example for your peers. Keep up the excellent work and continue to lead by example!'
        : pts >= 50
        ? 'You are making good progress! Focus on being attentive, participating actively in class discussions, and showing respect for your teachers and classmates to increase your standing.'
        : 'There is a great opportunity for growth ahead. Work on staying focused during lessons, completing your assignments on time, and engaging positively with your school community. Small daily improvements lead to big results!') +
      (Array.isArray(logs) && logs.length > 0 ? ` You have ${logs.length} recorded behaviour entries — each one is a learning opportunity.` : '');

    return ok({ success: true, advice });
  }

  // ── Super Admin: List schools ──────────────────────────────────────────────
  if (url === '/api/admin/schools' && method === 'GET') {
    const schoolsWithStats = db.schools.map(school => {
      const schoolUsers = db.users.filter(u => u.schoolId === school.id);
      return {
        ...school,
        stats: {
          students: schoolUsers.filter(u => u.role === 'student').length,
          teachers: schoolUsers.filter(u => u.role === 'teacher').length,
          admins: schoolUsers.filter(u => u.role === 'principal' || u.role === 'deputy').length,
        },
      };
    });
    return ok({ success: true, schools: schoolsWithStats });
  }

  // ── Super Admin: Create school ─────────────────────────────────────────────
  if (url === '/api/admin/schools' && method === 'POST') {
    const { name, subdomain, principalName, principalEmail, principalPassword } = body || {};
    if (!name || !subdomain || !principalName || !principalEmail || !principalPassword) {
      return err('All provisioning fields are required.');
    }
    const normSubdomain = (subdomain as string).toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    const normEmail = (principalEmail as string).toLowerCase().trim();

    if (db.schools.find(s => s.subdomain === normSubdomain)) {
      return err(`The subdomain "${normSubdomain}" is already registered.`);
    }
    if (db.users.find(u => u.email === normEmail)) {
      return err(`The email "${principalEmail}" is already in use.`);
    }

    const newSchool: DbSchool = {
      id: uid(),
      name: (name as string).trim(),
      subdomain: normSubdomain,
      status: 'active',
      settings: { pointsCap: 500, allowedEmailDomains: [], enableAiSuggestions: true },
      createdAt: new Date().toISOString(),
    };

    const newPrincipal: DbUser = {
      id: uid(), name: (principalName as string).trim(), email: normEmail,
      password: (principalPassword as string).trim(), role: 'principal',
      pointsBalance: 0, schoolId: newSchool.id,
    };

    db.schools.push(newSchool);
    db.users.push(newPrincipal);
    saveDb(db);

    return ok({
      success: true,
      message: `School "${name}" registered. Principal account created for ${principalName}.`,
      school: { ...newSchool, stats: { students: 0, teachers: 0, admins: 1 } },
      principal: { id: newPrincipal.id, name: newPrincipal.name, email: newPrincipal.email, role: 'principal' },
    });
  }

  // ── Super Admin: Update school (toggle status / rename) ───────────────────
  // Matches: PUT /api/admin/schools/:id
  if (url.startsWith('/api/admin/schools/') && method === 'PUT') {
    const schoolId = url.split('/').pop();
    const school = db.schools.find(s => s.id === schoolId);
    if (!school) return err('School not found.', 404);

    const { name, status, settings } = body || {};
    if (name) school.name = (name as string).trim();
    if (status) school.status = status;
    if (settings) school.settings = { ...school.settings, ...settings };

    saveDb(db);
    return ok({ success: true, message: 'School settings updated.', school });
  }

  // ── Fallthrough ────────────────────────────────────────────────────────────
  return null;
}

// ─── Public install ───────────────────────────────────────────────────────────
/**
 * Call installLocalApi() BEFORE React renders.
 *
 * When VITE_API_URL is empty (static GitHub Pages deploy with no backend) →
 * ALL /api/* calls are handled instantly from localStorage.
 *
 * When VITE_API_URL points to a real server → calls go to that server first,
 * with automatic transparent fallback to localStorage if the server is down.
 */
export function installLocalApi(): void {
  const API_BASE: string = ((import.meta as any).env.VITE_API_URL ?? '').trim();
  const _fetch = window.fetch.bind(window);

  window.fetch = async function patchedFetch(input, init): Promise<Response> {
    // Only intercept relative /api/* requests
    if (typeof input !== 'string' || !input.startsWith('/api/')) {
      return _fetch(input, init);
    }

    const path = input as string;
    const method = ((init?.method || 'GET') as string).toUpperCase();
    const authHeader = ((init?.headers || {}) as Record<string, string>)['Authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let bodyData: any = null;
    if (init?.body) {
      try { bodyData = JSON.parse(init.body as string); } catch { bodyData = {}; }
    }

    // ── Pure local mode (no backend configured) ────────────────────────────
    if (!API_BASE) {
      const result = await handleLocalRequest(path, method, bodyData, token);
      if (result) {
        console.info(`[LocalAPI] ${method} ${path} → ${result.status}`);
        return result;
      }
      console.warn(`[LocalAPI] No handler for ${method} ${path}`);
      return new Response(
        JSON.stringify({ error: `No handler for ${method} ${path}` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── Backend mode with localStorage fallback ────────────────────────────
    try {
      const response = await _fetch(`${API_BASE}${path}`, init);

      // Patch .json() to detect HTML error pages (e.g. GitHub Pages 404)
      const clone = response.clone();
      response.json = async () => {
        const text = await clone.text();
        if (text.trimStart().startsWith('<')) {
          throw new Error('Server returned an error page instead of JSON. It may be offline.');
        }
        try { return JSON.parse(text); }
        catch { throw new Error(`Invalid server response: ${text.slice(0, 120)}`); }
      };
      return response;
    } catch (networkError: any) {
      // Backend unreachable — silently fall back to localStorage
      console.warn(`[LocalAPI] Backend unreachable (${networkError?.message}). Using localStorage fallback.`);
      const result = await handleLocalRequest(path, method, bodyData, token);
      if (result) return result;
      throw networkError;
    }
  };
}

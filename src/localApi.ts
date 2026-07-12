/**
 * localApi.ts — Full in-browser API for BehaviorPulse
 *
 * This module intercepts every /api/* fetch call and handles it using
 * localStorage when the app is hosted on a static host (GitHub Pages)
 * without a live backend server.
 *
 * Data lives in localStorage under the "bp_db" key so it survives page
 * refreshes and is scoped to the browser.
 */

// ─── Types ────────────────────────────────────────────────────────────────────
interface DbUser {
  id: string;
  name: string;
  email: string;
  password: string; // plain-text (demo only, never real creds)
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
  adminStatus?: string;
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

interface Database {
  users: DbUser[];
  behaviorLogs: DbBehaviorLog[];
  emailLogs: DbEmailLog[];
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
    id: 'u-student-1',
    name: 'Alice Smith',
    email: 'student1@pulse.com',
    password: 'BarakaNgureNjihia',
    role: 'student',
    pointsBalance: 67,
    schoolId: 'school-main',
  },
  {
    id: 'u-student-2',
    name: 'Bob Jones',
    email: 'student2@pulse.com',
    password: 'BarakaNgureNjihia',
    role: 'student',
    pointsBalance: 84,
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
];

// ─── Database helpers ─────────────────────────────────────────────────────────
const DB_KEY = 'bp_db_v2';

function loadDb(): Database {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* fall through */ }

  // First boot — seed defaults
  const db: Database = {
    users: DEFAULT_USERS,
    behaviorLogs: [],
    emailLogs: [],
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

// ─── JWT-like token helpers (base64 only — not cryptographically secure) ──────
function makeToken(user: DbUser): string {
  const payload = { id: user.id, role: user.role, email: user.email, name: user.name, schoolId: user.schoolId };
  return `local.${btoa(JSON.stringify(payload))}`;
}

function decodeToken(token: string): { id: string; role: string; email: string; name: string; schoolId: string } | null {
  try {
    if (!token.startsWith('local.')) return null;
    return JSON.parse(atob(token.slice(6)));
  } catch { return null; }
}

// ─── Response factory ─────────────────────────────────────────────────────────
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
async function handleLocalRequest(url: string, method: string, body: any, authToken: string | null): Promise<Response | null> {
  const db = loadDb();

  // ── Auth ────────────────────────────────────────────────────────────────────
  if (url === '/api/auth/login' && method === 'POST') {
    const { email, password } = body || {};
    const user = db.users.find(u => u.email === email?.toLowerCase().trim());
    if (!user || user.password !== password) {
      return err('Invalid email or password', 401);
    }
    return ok({
      token: makeToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, schoolId: user.schoolId, pointsBalance: user.pointsBalance },
    });
  }

  // All other routes require a valid token
  const decoded = decodeToken(authToken || '');
  if (!decoded && !url.startsWith('/api/auth')) {
    return err('Unauthorized', 401);
  }

  // ── Students ────────────────────────────────────────────────────────────────
  if (url === '/api/students' && method === 'GET') {
    const students = db.users.filter(u => u.role === 'student' && u.schoolId === decoded!.schoolId);
    return ok(students.map(s => ({
      id: s.id, name: s.name, email: s.email, pointsBalance: s.pointsBalance,
      schoolId: s.schoolId, className: s.className || '',
    })));
  }

  if (url === '/api/students' && method === 'POST') {
    const { name, email, pointsBalance, className } = body || {};
    if (!name || !email) return err('Name and email are required.');
    const norm = email.toLowerCase().trim();
    if (db.users.find(u => u.email === norm && u.schoolId === decoded!.schoolId)) {
      return err(`A student with the email "${email}" already exists.`);
    }
    const newUser: DbUser = {
      id: uid(), name: name.trim(), email: norm,
      password: 'password123', role: 'student',
      pointsBalance: parseInt(pointsBalance, 10) || 0,
      schoolId: decoded!.schoolId, className: (className || '').trim(),
    };
    db.users.push(newUser);
    saveDb(db);
    return ok({ success: true, message: `Student account for ${name} has been created.`, student: { id: newUser.id, name: newUser.name, email: newUser.email, pointsBalance: newUser.pointsBalance, className: newUser.className } });
  }

  if (url === '/api/students/seed-demo' && method === 'POST') {
    let created = 0;
    SEED_NAMES.forEach((name, i) => {
      const email = `student${i + 1}@pulse.com`;
      if (!db.users.find(u => u.email === email && u.schoolId === decoded!.schoolId)) {
        db.users.push({
          id: uid(), name, email, password: 'BarakaNgureNjihia', role: 'student',
          pointsBalance: Math.floor(Math.random() * 150) + 40,
          schoolId: decoded!.schoolId, className: '',
        });
        created++;
      }
    });
    saveDb(db);
    return ok({ success: true, message: `Roster synced! Created ${created} new student profiles.`, totalStudents: SEED_NAMES.length });
  }

  // ── Student dashboard ────────────────────────────────────────────────────────
  if (url === '/api/student/dashboard' && method === 'GET') {
    const student = db.users.find(u => u.id === decoded!.id);
    if (!student) return err('Student not found.', 404);

    const logs = db.behaviorLogs
      .filter(l => l.studentId === decoded!.id && l.schoolId === decoded!.schoolId)
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

  // ── Behavior log ─────────────────────────────────────────────────────────────
  if (url === '/api/behavior/log' && method === 'POST') {
    const { studentId, pointsChange, reason, sendEmail, notificationTarget, escalatedToAdmin } = body || {};
    const student = db.users.find(u => u.id === studentId && u.schoolId === decoded!.schoolId);
    if (!student) return err('Student not found.', 404);

    // Update balance
    student.pointsBalance += parseInt(pointsChange, 10) || 0;

    const teacher = db.users.find(u => u.id === decoded!.id);
    const log: DbBehaviorLog = {
      id: uid(), schoolId: decoded!.schoolId,
      studentId, studentName: student.name,
      teacherId: decoded!.id, teacherName: decoded!.name,
      pointsChange: parseInt(pointsChange, 10),
      reason: (reason || '').trim(),
      parentNotified: !!sendEmail, escalatedToAdmin: !!escalatedToAdmin,
      adminStatus: escalatedToAdmin ? 'pending_review' : undefined,
      createdAt: new Date().toISOString(),
    };
    db.behaviorLogs.push(log);

    // Simulate email log
    if (sendEmail) {
      const emailLog: DbEmailLog = {
        id: uid(), status: 'delivered', deliveryMode: 'simulated_debug',
        subject: `Behaviour Update for ${student.name}`,
        recipientEmails: ['parent@example.com'],
        targetLabel: notificationTarget || 'parents',
        previewUrl: undefined, createdAt: new Date().toISOString(),
      };
      db.emailLogs.unshift(emailLog);
    }

    saveDb(db);
    return ok({ success: true, message: `Points adjusted by ${pointsChange} for ${student.name}.`, log });
  }

  // ── Bulk behavior log ────────────────────────────────────────────────────────
  if (url === '/api/behavior/bulk-log' && method === 'POST') {
    const { studentIds, pointsChange, reason, sendEmail, notificationTarget, escalatedToAdmin } = body || {};
    const pts = parseInt(pointsChange, 10) || 0;
    let count = 0;

    (studentIds || []).forEach((sid: string) => {
      const student = db.users.find(u => u.id === sid && u.schoolId === decoded!.schoolId);
      if (!student) return;
      student.pointsBalance += pts;
      db.behaviorLogs.push({
        id: uid(), schoolId: decoded!.schoolId,
        studentId: sid, studentName: student.name,
        teacherId: decoded!.id, teacherName: decoded!.name,
        pointsChange: pts, reason: (reason || '').trim(),
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

  // ── Teacher all-logs ─────────────────────────────────────────────────────────
  if (url === '/api/behavior/all-logs' && method === 'GET') {
    const logs = db.behaviorLogs
      .filter(l => l.schoolId === decoded!.schoolId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return ok({ success: true, logs });
  }

  // ── Email logs ───────────────────────────────────────────────────────────────
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
    return ok({ success: true, message: 'All failed emails have been retried successfully.' });
  }

  if (url.startsWith('/api/behavior/email-logs/retry-single/') && method === 'POST') {
    const id = url.split('/').pop();
    const log = db.emailLogs.find(l => l.id === id);
    if (log) { log.status = 'delivered'; saveDb(db); }
    return ok({ success: true, message: 'Email resent successfully.' });
  }

  // ── AI endpoints ─────────────────────────────────────────────────────────────
  if (url === '/api/ai/refine' && method === 'POST') {
    const { reason, studentName } = body || {};
    // Return a polished version without calling Gemini (no API key in static mode)
    const polished = `${studentName ? `Regarding ${studentName}: ` : ''}${(reason || '').trim()}. This has been noted and will be followed up with appropriate support and guidance to encourage positive development.`;
    return ok({ success: true, refined: polished });
  }

  if (url === '/api/ai/parse-roster' && method === 'POST') {
    const { rawText } = body || {};
    // Simple heuristic parser — one student per line, "Name Email" or "Name, Email"
    const lines = (rawText || '').split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
    const students: Array<{ name: string; email: string; pointsBalance: number }> = [];
    lines.forEach((line: string) => {
      const parts = line.split(/[\s,;|]+/);
      if (parts.length >= 2) {
        const possibleEmail = parts.find((p: string) => p.includes('@'));
        if (possibleEmail) {
          const nameParts = parts.filter((p: string) => !p.includes('@'));
          students.push({ name: nameParts.join(' '), email: possibleEmail.toLowerCase(), pointsBalance: 67 });
        } else if (parts.length >= 2) {
          students.push({ name: parts.join(' '), email: `${parts[0].toLowerCase()}.${parts[parts.length - 1].toLowerCase()}@pulse.com`, pointsBalance: 67 });
        }
      }
    });
    return ok({ success: true, students });
  }

  if (url === '/api/ai/reflection' && method === 'POST') {
    const { name, pointsBalance, logs } = body || {};
    const tier = pointsBalance >= 200 ? 'Paragon' : pointsBalance >= 120 ? 'Leadership' : pointsBalance >= 80 ? 'Active Contributor' : pointsBalance >= 0 ? 'Developing' : 'Needs Support';
    const advice = `${name}, you currently have ${pointsBalance} points placing you in the ${tier} tier. ${
      pointsBalance >= 100
        ? 'Your consistent positive behaviour is setting a wonderful example for your peers. Keep up the excellent work and continue to lead by example!'
        : pointsBalance >= 50
        ? 'You are making good progress! Focus on being attentive, participating actively in class discussions, and showing respect for your teachers and classmates to increase your standing.'
        : 'There is a great opportunity for growth ahead. Work on staying focused during lessons, completing your assignments on time, and engaging positively with your school community. Small daily improvements lead to big results!'
    } ${logs?.length > 0 ? `You have ${logs.length} recorded behaviour entries. Each entry is a learning opportunity.` : ''}`;
    return ok({ success: true, advice });
  }

  // ── Fallthrough — not handled locally ────────────────────────────────────────
  return null;
}

// ─── Public install function ──────────────────────────────────────────────────
/**
 * Call installLocalApi() before React renders.
 * It wraps window.fetch so that all /api/* calls are served from localStorage
 * when VITE_API_URL is not configured (i.e., GitHub Pages without a live backend).
 */
export function installLocalApi(): void {
  const API_BASE: string = (import.meta as any).env.VITE_API_URL ?? '';

  // If a real backend is configured we still patch fetch so that relative /api/*
  // calls get the correct absolute URL; we only fall back to local if the real
  // backend request fails.
  const _originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedFetch(input, init): Promise<Response> {
    const isRelativeApi = typeof input === 'string' && input.startsWith('/api/');

    if (!isRelativeApi) {
      return _originalFetch(input, init);
    }

    const path = input as string;

    // ── Local-only mode (no backend configured) ────────────────────────────────
    if (!API_BASE) {
      const method = (init?.method || 'GET').toUpperCase();
      let body: any = null;
      if (init?.body) {
        try { body = JSON.parse(init.body as string); } catch { body = {}; }
      }
      const authHeader = (init?.headers as Record<string, string>)?.['Authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      const result = await handleLocalRequest(path, method, body, token);
      if (result) {
        console.info(`[LocalAPI] ${method} ${path} → ${result.status}`);
        return result;
      }
      // If no local handler matched, return a friendly 404
      return new Response(JSON.stringify({ error: `No local handler for ${method} ${path}` }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Real backend mode ──────────────────────────────────────────────────────
    // Redirect relative /api/* to the configured backend URL
    const absoluteUrl = `${API_BASE}${path}`;
    try {
      const response = await _originalFetch(absoluteUrl, init);
      // Intercept HTML error pages from the server
      const clone = response.clone();
      const originalJson = response.json.bind(response);
      response.json = async () => {
        const text = await clone.text();
        if (text.trimStart().startsWith('<')) {
          throw new Error('Server is unreachable. Please check your connection or try again.');
        }
        try { return JSON.parse(text); }
        catch { throw new Error(`Invalid server response: ${text.slice(0, 120)}`); }
      };
      return response;
    } catch (networkError: any) {
      // Backend is down — fall back to local API
      console.warn(`[LocalAPI] Backend unreachable (${networkError.message}), falling back to localStorage.`);
      const method = (init?.method || 'GET').toUpperCase();
      let body: any = null;
      if (init?.body) {
        try { body = JSON.parse(init.body as string); } catch { body = {}; }
      }
      const authHeader = (init?.headers as Record<string, string>)?.['Authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      const result = await handleLocalRequest(path, method, body, token);
      if (result) return result;
      throw networkError;
    }
  };
}

/**
 * BehaviorPulse Email Delivery Test Script
 * =========================================
 * Logs in as teacher, then fires behavior logs with email notifications
 * for multiple students and all 3 notification targets.
 * Run with:  node test_email_send.js
 */

const BASE_URL = 'http://localhost:5174';

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher@pulse.com', password: 'BarakaNgureNjihia' })
  });
  const data = await res.json();
  if (!data.token) throw new Error('Login failed: ' + JSON.stringify(data));
  console.log(`✅ Logged in as ${data.user.name} (${data.user.role})`);
  return data.token;
}

async function getStudents(token) {
  const res = await fetch(`${BASE_URL}/api/students`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data.students || []);
  console.log(`📋 Found ${list.length} students in roster`);
  return list;
}

async function sendBehaviorLog(token, studentId, studentName, pointsChange, reason, notificationTarget) {
  const res = await fetch(`${BASE_URL}/api/behavior/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      studentId,
      pointsChange,
      reason,
      sendEmail: true,
      notificationTarget
    })
  });
  const data = await res.json();
  return data;
}

async function getEmailLogs(token) {
  const res = await fetch(`${BASE_URL}/api/behavior/email-logs`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

async function run() {
  console.log('\n🚀 BehaviorPulse Email Delivery Test');
  console.log('=====================================\n');

  const token = await login();
  const students = await getStudents(token);

  if (students.length === 0) {
    console.error('❌ No students found. Cannot run email test.');
    process.exit(1);
  }

  // Pick up to 3 students to test with
  const testStudents = students.slice(0, 3);

  const testCases = [
    {
      studentIndex: 0,
      pointsChange: 20,
      reason: 'Demonstrated outstanding leadership during the science project, guided the team brilliantly.',
      target: 'parents',
      label: '👨‍👩‍👧 Parents Only'
    },
    {
      studentIndex: 1 % testStudents.length,
      pointsChange: -15,
      reason: 'Was disruptive during quiet reading time and repeatedly disturbed classmates.',
      target: 'deputy_principal_only',
      label: '🏫 Deputy & Principal Only'
    },
    {
      studentIndex: 2 % testStudents.length,
      pointsChange: 25,
      reason: 'Won the inter-school debate competition and brought pride to the entire class.',
      target: 'deputy_principal_parents',
      label: '🌟 All Recipients (Parents + Deputy + Principal)'
    }
  ];

  console.log(`\n📧 Firing ${testCases.length} email notification test cases...\n`);

  for (const tc of testCases) {
    const student = testStudents[tc.studentIndex];
    console.log(`─────────────────────────────────────────`);
    console.log(`📨 Test: ${tc.label}`);
    console.log(`   Student : ${student.name} (${student.email})`);
    console.log(`   Points  : ${tc.pointsChange > 0 ? '+' : ''}${tc.pointsChange}`);
    console.log(`   Reason  : "${tc.reason.slice(0, 70)}..."`);
    console.log(`   Sending to: ${tc.target}`);

    try {
      const result = await sendBehaviorLog(token, student.id, student.name, tc.pointsChange, tc.reason, tc.target);
      if (result.success) {
        console.log(`   ✅ Behavior logged & email queued: ${result.message}`);
      } else {
        console.log(`   ❌ Failed: ${JSON.stringify(result)}`);
      }
    } catch (err) {
      console.log(`   ❌ Request error: ${err.message}`);
    }

    // Wait 1.5s between sends to avoid rate limits
    await new Promise(r => setTimeout(r, 1500));
  }

  // Wait for background email dispatch to complete
  console.log(`\n⏳ Waiting 8 seconds for background email dispatch to complete...\n`);
  await new Promise(r => setTimeout(r, 8000));

  // Fetch and display email logs
  console.log(`📬 Fetching Email Dispatch Audit Log...\n`);
  try {
    const logData = await getEmailLogs(token);
    const logs = logData.logs || [];
    const recent = logs.slice(0, 6); // show the 6 most recent

    console.log(`─────────────────────────────────────────`);
    console.log(`Found ${logs.length} total email log entries. Showing ${recent.length} most recent:\n`);

    for (const log of recent) {
      const status = log.status === 'delivered' ? '✅' : log.status === 'failed' ? '❌' : '⏳';
      console.log(`${status} [${log.status?.toUpperCase()}] ${log.targetLabel}`);
      console.log(`   Student  : ${log.studentName}`);
      console.log(`   Subject  : ${log.subject}`);
      console.log(`   Mode     : ${log.deliveryMode || 'pending'}`);
      if (log.previewUrl && log.previewUrl.startsWith('http')) {
        console.log(`   Preview  : ${log.previewUrl}`);
      }
      console.log();
    }

    const delivered = logs.filter(l => l.status === 'delivered').length;
    const failed = logs.filter(l => l.status === 'failed').length;
    const pending = logs.filter(l => l.status === 'pending').length;
    console.log(`─────────────────────────────────────────`);
    console.log(`📊 Summary: ${delivered} delivered | ${failed} failed | ${pending} pending`);

    if (!logData.smtpSettings?.isConfigured) {
      console.log(`\n⚠️  SMTP not configured with real credentials.`);
      console.log(`   Emails are being sent via Ethereal sandbox (test catcher).`);
      console.log(`   Check preview URLs above to read the emails in browser.`);
      console.log(`   To send REAL emails to mb4reals@gmail.com & lucynguresky@gmail.com:`);
      console.log(`   → Set SMTP_USER and SMTP_PASS in .env.local with a Gmail App Password`);
    } else {
      console.log(`\n🟢 SMTP configured! Real emails dispatched to test accounts.`);
    }
  } catch (err) {
    console.error('Failed to fetch email logs:', err.message);
  }

  console.log('\n✅ Email test complete.\n');
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});

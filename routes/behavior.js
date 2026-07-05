import express from 'express';
import User, { MongooseUser } from '../models/User.js';
import BehaviorLog, { MongooseBehaviorLog } from '../models/BehaviorLog.js';
import { sendAdvancedBehaviorEmails, retryEmailLog } from '../utils/emailService.js';
import { getEmailLogs } from '../utils/emailLogStore.js';
import { verifyToken, requireRole, requireAnyRole } from './auth.js';
import { shouldExpressUseLocalDb } from '../config/db.js';

const router = express.Router();

// POST /api/behavior/log (Teachers only)
router.post('/log', verifyToken, requireRole('teacher'), async (req, res) => {
  const { studentId, pointsChange, reason, sendEmail, notificationTarget, escalatedToAdmin } = req.body;
  const teacherId = req.user.id;
  const schoolId = req.user.schoolId || 'school-main';

  if (!studentId || pointsChange === undefined || !reason) {
    return res.status(400).json({ error: "Missing required parameters: studentId, pointsChange, and reason are mandatory." });
  }

  const parsedChange = parseInt(pointsChange, 10);
  if (isNaN(parsedChange) || parsedChange === 0) {
    return res.status(400).json({ error: "pointsChange must be a valid non-zero positive or negative number." });
  }

  try {
    // 1. Fetch student and confirm record validity and school isolation
    const student = await User.findOne({ _id: studentId, schoolId });
    if (!student) {
      return res.status(404).json({ error: "Target student record not found in your school." });
    }

    // Update their Points Balance in database
    await User.findByIdAndUpdate(studentId, {
      $inc: { pointsBalance: parsedChange }
    });

    // 2. Save a new BehaviorLog document
    const finalLog = await BehaviorLog.create({
      schoolId,
      studentId,
      teacherId,
      pointsChange: parsedChange,
      reason: reason.trim(),
      parentNotified: !!sendEmail,
      escalatedToAdmin: !!escalatedToAdmin,
      adminStatus: escalatedToAdmin ? 'pending_review' : undefined
    });

    /*
     * Design Decision: Fire-and-Forget Asynchronous Background Task
     * -------------------------------------------------------------
     * We trigger the SMTP connection handshakes and Gemini AI text polish requests
     * inside a background callback queue. This guarantees that the main request
     * thread is unblocked instantly, keeping database record updates under 30ms 
     * and shielding end-users from network SMTP latency or rate-limiting delays.
     */
    if (sendEmail) {
      sendAdvancedBehaviorEmails({
        targetOption: notificationTarget || 'parents',
        student,
        pointsChange: parsedChange,
        reason: reason.trim()
      }).catch(err => {
        console.error("Background behavior email logging failed:", err.message);
      });
    }

    return res.json({
      success: true,
      message: `Points successfully adjusted by ${parsedChange}. Behavior archived.${sendEmail ? ' Email notification is being processed in the background.' : ''}`,
      log: finalLog
    });
  } catch (err) {
    console.error("Failed logging student behavior:", err.message);
    return res.status(500).json({ error: "Internal error recording behavioral action." });
  }
});

// POST /api/behavior/bulk-log (Teachers only)
// Processes adjustments for multiple students simultaneously
router.post('/bulk-log', verifyToken, requireRole('teacher'), async (req, res) => {
  const { studentIds, pointsChange, reason, sendEmail, notificationTarget, escalatedToAdmin } = req.body;
  const teacherId = req.user.id;
  const schoolId = req.user.schoolId || 'school-main';

  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0 || pointsChange === undefined || !reason) {
    return res.status(400).json({ error: "Missing required parameters: studentIds (array), pointsChange, and reason are mandatory." });
  }

  const parsedChange = parseInt(pointsChange, 10);
  if (isNaN(parsedChange) || parsedChange === 0) {
    return res.status(400).json({ error: "pointsChange must be a valid non-zero positive or negative number." });
  }

  try {
    const results = [];
    const emailStatuses = [];

    for (const studentId of studentIds) {
      const student = await User.findOne({ _id: studentId, schoolId });
      if (!student) continue;

      // Update Points Balance
      await User.findByIdAndUpdate(studentId, {
        $inc: { pointsBalance: parsedChange }
      });

      // Save BehaviorLog
      const finalLog = await BehaviorLog.create({
        schoolId,
        studentId,
        teacherId,
        pointsChange: parsedChange,
        reason: reason.trim(),
        parentNotified: !!sendEmail,
        escalatedToAdmin: !!escalatedToAdmin,
        adminStatus: escalatedToAdmin ? 'pending_review' : undefined
      });

      results.push({ studentId, studentName: student.name, logId: finalLog._id });
    }

    /*
     * Design Decision: Asynchronous Sequential Background Dispatch
     * -------------------------------------------------------------
     * For bulk updates (potentially updating 50+ students at once), executing
     * simultaneous email and AI requests would immediately hit Gemini 429 quota
     * limits and saturate Node's outgoing network connections. 
     * We offload the loop to the background and dispatch each student's email
     * sequentially, ensuring reliability and keeping API rates safe.
     */
    if (sendEmail && studentIds.length > 0) {
      (async () => {
        for (const studentId of studentIds) {
          try {
            const student = await User.findOne({ _id: studentId, schoolId });
            if (!student) continue;
            await sendAdvancedBehaviorEmails({
              targetOption: notificationTarget || 'parents',
              student,
              pointsChange: parsedChange,
              reason: reason.trim()
            });
          } catch (emailErr) {
            console.error(`Background bulk email failed for student ${studentId}:`, emailErr.message);
          }
        }
      })();
    }

    return res.json({
      success: true,
      message: `Successfully updated ${results.length} students by ${parsedChange > 0 ? '+' : ''}${parsedChange} points.${sendEmail ? ' Email notifications are being processed in the background.' : ''}`,
      results
    });
  } catch (err) {
    console.error("Failed processing bulk student behaviors:", err.message);
    return res.status(500).json({ error: "Internal error recording bulk behavioral actions." });
  }
});

// GET /api/behavior/all-logs (Teachers, Deputies, Principals)
router.get('/all-logs', verifyToken, requireAnyRole(['teacher', 'deputy', 'principal']), async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin';
    const schoolId = isSuperAdmin 
      ? req.query.schoolId 
      : (req.user.schoolId || 'school-main');

    const search = (req.query.search || '').trim();
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10) || 10;

    const query = {};
    if (schoolId) {
      query.schoolId = schoolId;
    }

    if (shouldExpressUseLocalDb()) {
      const logs = await BehaviorLog.find(query);
      const allUsers = await User.find(schoolId ? { schoolId } : {});
      const userMap = allUsers.reduce((acc, u) => {
        acc[u._id] = u.name;
        return acc;
      }, {});

      let enrichedLogs = logs.map(log => ({
        id: log._id,
        studentId: log.studentId,
        studentName: userMap[log.studentId] || "Unknown Student",
        teacherId: log.teacherId,
        teacherName: userMap[log.teacherId] || "School Teacher",
        pointsChange: log.pointsChange,
        reason: log.reason,
        parentNotified: log.parentNotified,
        escalatedToAdmin: log.escalatedToAdmin || false,
        adminStatus: log.adminStatus || 'pending_review',
        adminAction: log.adminAction || '',
        adminNotes: log.adminNotes || '',
        adminReviewedBy: log.adminReviewedBy || '',
        adminReviewedAt: log.adminReviewedAt || '',
        createdAt: log.createdAt || log.updatedAt || new Date().toISOString()
      }));

      // Sort newest first
      enrichedLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Filter by search query if provided
      if (search) {
        const searchLower = search.toLowerCase();
        enrichedLogs = enrichedLogs.filter(log =>
          log.studentName.toLowerCase().includes(searchLower) ||
          log.teacherName.toLowerCase().includes(searchLower) ||
          log.reason.toLowerCase().includes(searchLower)
        );
      }

      // Support paginated output if requested
      if (!isNaN(page)) {
        const skip = (page - 1) * limit;
        const paginated = enrichedLogs.slice(skip, skip + limit);
        return res.json({
          success: true,
          logs: paginated,
          page,
          pages: Math.ceil(enrichedLogs.length / limit),
          total: enrichedLogs.length
        });
      }

      return res.json({
        success: true,
        logs: enrichedLogs
      });
    } else {
      // High-performance MongoDB query using Mongoose
      const query = { schoolId };
      if (search) {
        // Find matching users by name to filter logs by student/teacher
        const matchingUsers = await MongooseUser.find({
          schoolId,
          name: { $regex: search, $options: 'i' }
        }).select('_id').lean();
        const userIds = matchingUsers.map(u => u._id);

        query.$or = [
          { studentId: { $in: userIds } },
          { teacherId: { $in: userIds } },
          { reason: { $regex: search, $options: 'i' } }
        ];
      }

      if (!isNaN(page)) {
        const skip = (page - 1) * limit;
        const [docs, total] = await Promise.all([
          MongooseBehaviorLog.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('studentId', 'name')
            .populate('teacherId', 'name')
            .lean(),
          MongooseBehaviorLog.countDocuments(query)
        ]);

        const enrichedLogs = docs.map(log => ({
          id: log._id,
          studentId: log.studentId ? log.studentId._id : null,
          studentName: log.studentId ? log.studentId.name : "Unknown Student",
          teacherId: log.teacherId ? log.teacherId._id : null,
          teacherName: log.teacherId ? log.teacherId.name : "School Teacher",
          pointsChange: log.pointsChange,
          reason: log.reason,
          parentNotified: log.parentNotified,
          escalatedToAdmin: log.escalatedToAdmin || false,
          adminStatus: log.adminStatus || 'pending_review',
          adminAction: log.adminAction || '',
          adminNotes: log.adminNotes || '',
          adminReviewedBy: log.adminReviewedBy || '',
          adminReviewedAt: log.adminReviewedAt || '',
          createdAt: log.createdAt || log.updatedAt || new Date().toISOString()
        }));

        return res.json({
          success: true,
          logs: enrichedLogs,
          page,
          pages: Math.ceil(total / limit),
          total
        });
      } else {
        const docs = await MongooseBehaviorLog.find(query)
          .sort({ createdAt: -1 })
          .populate('studentId', 'name')
          .populate('teacherId', 'name')
          .lean();

        const enrichedLogs = docs.map(log => ({
          id: log._id,
          studentId: log.studentId ? log.studentId._id : null,
          studentName: log.studentId ? log.studentId.name : "Unknown Student",
          teacherId: log.teacherId ? log.teacherId._id : null,
          teacherName: log.teacherId ? log.teacherId.name : "School Teacher",
          pointsChange: log.pointsChange,
          reason: log.reason,
          parentNotified: log.parentNotified,
          escalatedToAdmin: log.escalatedToAdmin || false,
          adminStatus: log.adminStatus || 'pending_review',
          adminAction: log.adminAction || '',
          adminNotes: log.adminNotes || '',
          adminReviewedBy: log.adminReviewedBy || '',
          adminReviewedAt: log.adminReviewedAt || '',
          createdAt: log.createdAt || log.updatedAt || new Date().toISOString()
        }));

        return res.json({
          success: true,
          logs: enrichedLogs
        });
      }
    }
  } catch (err) {
    console.error("Failed to fetch all logs:", err.message);
    return res.status(500).json({ error: "Failed to retrieve behavior history logs." });
  }
});

// POST /api/behavior/review/:id (Deputies & Principals only)
// Review and log administrative actions for escalated reports
router.post('/review/:id', verifyToken, requireAnyRole(['deputy', 'principal']), async (req, res) => {
  const { id } = req.params;
  const { adminAction, adminNotes, adminStatus } = req.body;
  const schoolId = req.user.schoolId || 'school-main';
  
  if (!adminAction) {
    return res.status(400).json({ error: "Please enter or select an Administrative Action to resolve this report." });
  }

  try {
    // Verify that the log belongs to this school
    const logCheck = await BehaviorLog.find({ _id: id, schoolId });
    if (!logCheck || logCheck.length === 0) {
      return res.status(404).json({ error: "Escalated report entry not found in your school." });
    }

    const updated = await BehaviorLog.findByIdAndUpdate(id, {
      $set: {
        adminAction,
        adminNotes: adminNotes || '',
        adminStatus: adminStatus || 'action_taken',
        adminReviewedBy: req.user.name,
        adminReviewedAt: new Date().toISOString()
      }
    });

    if (!updated) {
      return res.status(404).json({ error: "Escalated report entry not found." });
    }

    return res.json({
      success: true,
      message: "Administrative report processed successfully. Official action logged.",
      log: updated
    });
  } catch (err) {
    console.error("Administrative review processing error:", err.message);
    return res.status(500).json({ error: "Failed to save administrative action logs." });
  }
});

// GET /api/behavior/email-logs (Teachers only)
router.get('/email-logs', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const logs = await getEmailLogs({ schoolId: req.user.schoolId || 'school-main' });
    const isLiveSmtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
    const smtpSettings = {
      isConfigured: isLiveSmtpConfigured,
      host: process.env.SMTP_HOST || '',
      port: process.env.SMTP_PORT || '587',
      user: process.env.SMTP_USER || '',
    };
    return res.json({
      success: true,
      logs,
      smtpSettings
    });
  } catch (err) {
    console.error("Failed to fetch email delivery status:", err.message);
    return res.status(500).json({ error: "Failed to retrieve email logs." });
  }
});

// GET /api/behavior/email-logs/preview/:id (Public sandboxed viewer)
router.get('/email-logs/preview/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const logs = await getEmailLogs({ _id: id });
    const log = logs[0];
    if (!log) {
      return res.status(404).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px; color: #475569;">
          <h2>⚠️ Email Log Not Found</h2>
          <p>The requested email notification dispatch record was not found or has been clear indexed.</p>
        </div>
      `);
    }

    const isPositive = log.pointsChange > 0;
    const pointsText = isPositive ? `+${log.pointsChange}` : `${log.pointsChange}`;
    const bannerColor = isPositive ? "#4f46e5" : "#e11d48";

    const previewHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${log.subject || 'BehaviorPulse Hub Bulletin'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 10px; color: #0f172a; }
            .container { max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #edf2f7; }
            .header { background-color: ${bannerColor}; color: #ffffff; padding: 32px 24px; text-align: center; }
            .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
            .points-badge { display: inline-block; padding: 6px 16px; border-radius: 9999px; font-size: 14px; font-weight: 800; background-color: rgba(255, 255, 255, 0.18); margin-top: 12px; border: 1px solid rgba(255,255,255,0.25); text-transform: uppercase; letter-spacing: 0.05em; }
            .content { padding: 32px 28px; line-height: 1.6; }
            .ai-message-card { background-color: #fcfdfd; border-left: 4px solid ${bannerColor}; padding: 20px; border-radius: 8px; margin: 24px 0; font-style: italic; color: #1e293b; border-top: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; }
            .info-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; color: #475569; }
            .info-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
            .info-table td.label-cell { font-weight: bold; width: 140px; color: #1e293b; }
            .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; font-size: 12px; color: #64748b; }
            .meta-p { margin-top: 4px; font-size: 10px; color: #94a3b8; }
            .sandbox-banner { background-color: #eff6ff; border-bottom: 1px solid #bfdbfe; color: #1e40af; padding: 10px; text-align: center; font-size: 11px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="sandbox-banner">
            🖥️ BehaviorPulse System Sandbox: Interactive Email Delivery Log Preview
          </div>
          <div class="container">
            <div class="header">
              <h1>BehaviorPulse Hub</h1>
              <div class="points-badge">${pointsText} Points Standing</div>
            </div>
            
            <div class="content">
              <p style="font-size: 15px; margin-top: 0; font-weight: 500;">This official behavioral standing update is customized for the **${log.targetLabel}**.</p>
              
              <div class="ai-message-card">
                "${log.aiGeneratedContext}"
              </div>

              <h4 style="margin: 28px 0 10px 0; font-size: 12px; text-transform: uppercase; tracking-wider; color: #4f46e5;">Behavior Audit Trails</h4>
              <table class="info-table">
                <tr>
                  <td class="label-cell">Target Student:</td>
                  <td>${log.studentName}</td>
                </tr>
                <tr>
                  <td class="label-cell">Audience Track:</td>
                  <td>${log.targetLabel}</td>
                </tr>
                <tr>
                  <td class="label-cell">Points Adjusted:</td>
                  <td style="font-weight: bold; color: ${bannerColor};">${pointsText} pts</td>
                </tr>
                <tr>
                  <td class="label-cell">Original Logs:</td>
                  <td>${log.reason}</td>
                </tr>
              </table>

              <p style="margin-top: 30px; font-size: 13px; color: #64748b;">Visit the parent portal tab to review complete character trajectory profiles. Thank you for championing classroom community values.</p>
            </div>
            
            <div class="footer">
              <p>&copy; 2026 BehaviorPulse System Office. Automated delivery engine.</p>
              <p class="meta-p">Dispatched targets: ${log.recipientEmails.join(", ")}</p>
            </div>
          </div>
        </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    return res.send(previewHtml);
  } catch (err) {
    console.error("Failed to generate log preview HTML:", err.message);
    return res.status(500).send("Internal Server error rendering log preview.");
  }
});

// POST /api/behavior/email-logs/retry-all (Teachers only)
router.post('/email-logs/retry-all', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const logs = await getEmailLogs({ schoolId: req.user.schoolId || 'school-main' });
    const failedLogs = logs.filter(l => l.status === 'failed');
    if (failedLogs.length === 0) {
      return res.json({ success: true, message: "No failed email dispatches found to retry." });
    }

    const results = [];
    for (const log of failedLogs) {
      try {
        const sendResult = await retryEmailLog(log.id);
        results.push({ id: log.id, success: true, ...sendResult });
      } catch (err) {
        results.push({ id: log.id, success: false, error: err.message });
      }
    }
    return res.json({
      success: true,
      message: `Retried ${failedLogs.length} emails. ${results.filter(r => r.success).length} succeeded, ${results.filter(r => !r.success).length} failed.`,
      results
    });
  } catch (err) {
    console.error("Failed to batch retry failed email dispatches:", err.message);
    return res.status(500).json({ error: "Failed to retry email dispatches." });
  }
});

// POST /api/behavior/email-logs/retry-single/:id (Teachers only)
router.post('/email-logs/retry-single/:id', verifyToken, requireRole('teacher'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await retryEmailLog(id);
    return res.json({
      success: true,
      message: "Resent successfully.",
      result
    });
  } catch (err) {
    console.error(`Failed to retry email dispatch ${id}:`, err.message);
    return res.status(500).json({ error: err.message || "Failed to retry email dispatch." });
  }
});

export default router;

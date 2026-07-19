import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart
} from 'recharts';
import AdminDashboard from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { 
  Shield, 
  Award, 
  Sparkles, 
  Clock, 
  Search, 
  LogOut, 
  Send, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  User, 
  BrainCircuit, 
  TrendingUp, 
  AlertCircle, 
  Mail, 
  FileText, 
  UserCheck,
  ChevronRight,
  BookOpen,
  Server,
  ExternalLink,
  Calendar,
  Filter,
  Users,
  CheckSquare,
  Square,
  ArrowUpDown,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronDown,
  Plus,
  UserPlus,
  Bot,
  Moon,
  Sun,
  Download
} from 'lucide-react';

interface Student {
  id: string;
  name: string;
  email: string;
  pointsBalance: number;
}

interface BehaviorLog {
  id: string;
  pointsChange: number;
  reason: string;
  parentNotified: boolean;
  createdAt: string;
  teacherName: string;
}

interface TeacherBehaviorLog {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  pointsChange: number;
  reason: string;
  parentNotified: boolean;
  createdAt: string;
  escalatedToAdmin?: boolean;
  adminStatus?: 'pending_review' | 'action_taken' | 'archived';
  adminAction?: string;
  adminNotes?: string;
  adminReviewedBy?: string;
  adminReviewedAt?: string;
}

interface UserSession {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'student' | 'deputy' | 'principal' | 'super_admin';
  pointsBalance: number;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('behavior_pulse_token'));
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    const raw = localStorage.getItem('behavior_pulse_user');
    return raw ? JSON.parse(raw) : null;
  });

  // ── Dark Mode ────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('bp_theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('bp_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('bp_theme', 'light');
    }
  }, [isDark]);

  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // General App States
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Teacher Dashboard States
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [adjustments, setAdjustments] = useState<Record<string, { amt: string; reason: string; notify: boolean; notificationTarget?: 'parents' | 'deputy_principal_parents' | 'deputy_principal_only'; aiLoading?: boolean }>>({});
  const [recentMails, setRecentMails] = useState<any[] | null>(null);
  
  // Email Status and Logs States
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [smtpSettings, setSmtpSettings] = useState<{ isConfigured: boolean; host: string; port: string; user: string } | null>(null);
  const [isRetryingLogs, setIsRetryingLogs] = useState(false);
  const [isEmailLogsLoading, setIsEmailLogsLoading] = useState(false);

  // Teacher Behavior Logs and Date Filter States
  const [teacherLogs, setTeacherLogs] = useState<TeacherBehaviorLog[]>([]);
  const [teacherFilterPeriod, setTeacherFilterPeriod] = useState<'all' | 'week' | 'month' | 'custom'>('all');
  const [teacherStartDate, setTeacherStartDate] = useState('');
  const [teacherEndDate, setTeacherEndDate] = useState('');

  // Layout and High Density Scale States for 50 student classes
  const [teacherLayoutMode, setTeacherLayoutMode] = useState<'grid' | 'compact-list'>('grid');
  const [studentsSortBy, setStudentsSortBy] = useState<'name' | 'points' | 'period-change'>('name');
  const [studentsSortOrder, setStudentsSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [bulkAmt, setBulkAmt] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkRawReason, setBulkRawReason] = useState('');
  const [isBulkPolished, setIsBulkPolished] = useState(false);
  const [bulkNotify, setBulkNotify] = useState(false);
  const [bulkNotificationTarget, setBulkNotificationTarget] = useState<'parents' | 'deputy_principal_parents' | 'deputy_principal_only'>('parents');
  const [bulkEscalate, setBulkEscalate] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isBulkAiLoading, setIsBulkAiLoading] = useState(false);
  const [teacherPage, setTeacherPage] = useState(1);
  const [teacherPageSize, setTeacherPageSize] = useState<number>(12); // options: 12, 24, 50, 100
  const [logsPage, setLogsPage] = useState(1);
  const [logsSearchQuery, setLogsSearchQuery] = useState('');
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);

  // Add/Import Student Roster States
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentPoints, setNewStudentPoints] = useState('0');
  const [isAddStudentSaving, setIsAddStudentSaving] = useState(false);
  
  const [aiRosterText, setAiRosterText] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiParsedStudents, setAiParsedStudents] = useState<any[]>([]);
  const [isAiImportSaving, setIsAiImportSaving] = useState(false);
  const [showAiPreview, setShowAiPreview] = useState(false);
  const [newStudentClass, setNewStudentClass] = useState('');
  const [aiRosterClass, setAiRosterClass] = useState('');
  const [classFilter, setClassFilter] = useState('All');

  // Student Dashboard States
  const [studentProfile, setStudentProfile] = useState<Student | null>(null);
  const [studentLogs, setStudentLogs] = useState<BehaviorLog[]>([]);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isAdviceLoading, setIsAdviceLoading] = useState(false);

  // Student Date Filter States
  const [studentFilterPeriod, setStudentFilterPeriod] = useState<'all' | 'week' | 'month' | 'custom'>('all');
  const [studentStartDate, setStudentStartDate] = useState('');
  const [studentEndDate, setStudentEndDate] = useState('');

  // Show status toasts
  const triggerToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ title, message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Check and boot dashboard
  useEffect(() => {
    if (token && currentUser) {
      if (currentUser.role === 'teacher') {
        fetchStudents();
        fetchEmailLogs();
        fetchTeacherBehaviorLogs();
      } else if (currentUser.role === 'principal' || currentUser.role === 'deputy') {
        // Admin roles need the full roster + all behavior logs
        fetchStudents();
        fetchTeacherBehaviorLogs();
      } else if (currentUser.role === 'super_admin') {
        // Super admin does not need to fetch student dashboard
      } else {
        fetchStudentDashboard();
      }
    }
  }, [token, currentUser?.role]);

  const handleDownloadCSV = () => {
    if (filteredTeacherLogs.length === 0) {
      triggerToast("No Logs to Download", "The current filter period has no behavior logs.");
      return;
    }
    
    const headers = ["Timestamp", "Student Name", "Points Adjustment", "Observation Reason", "Parent Notified", "Instructor"];
    const rows = filteredTeacherLogs.map(log => {
      const date = new Date(log.createdAt).toLocaleString('en-US').replace(/,/g, '');
      const student = `"${log.studentName || 'Unknown'}"`;
      const pts = `${log.pointsChange > 0 ? '+' : ''}${log.pointsChange}`;
      const reason = `"${(log.reason || '').replace(/"/g, '""')}"`;
      const notified = log.parentNotified ? "Yes" : "No";
      const instructor = `"${log.teacherName || 'Unknown'}"`;
      
      return [date, student, pts, reason, notified, instructor].join(",");
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `behavior_logs_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    // Only remove the auth session — do NOT wipe the database (bp_db_v3)
    // or all student point changes will be lost when users switch accounts!
    localStorage.removeItem('behavior_pulse_token');
    localStorage.removeItem('behavior_pulse_user');
    setToken(null);
    setCurrentUser(null);
    setStudents([]);
    setStudentProfile(null);
    setStudentLogs([]);
    setAiAdvice(null);
    triggerToast("Logged Out Successfully", "You have signed out of BehaviorPulse.");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      localStorage.setItem('behavior_pulse_token', data.token);
      localStorage.setItem('behavior_pulse_user', JSON.stringify(data.user));

      setToken(data.token);
      setCurrentUser(data.user);
      triggerToast(`Welcome, ${data.user.name}!`, "Account authenticated successfully.");
    } catch (err: any) {
      setLoginError(err.message || "Invalid credentials.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Demo auto-fill tool
  const fillSandboxUser = (selectedEmail: string) => {
    setEmail(selectedEmail);
    setPassword('BarakaNgureNjihia');
    setLoginError(null);
  };

  // Teacher actions
  const fetchStudents = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/students', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Could not load student roster.");
      const data = await res.json();
      setStudents(data);
    } catch (err: any) {
      triggerToast("Failed to sync", err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentEmail.trim()) {
      triggerToast("Missing Fields", "Please specify both name and email to create a student.", "error");
      return;
    }
    setIsAddStudentSaving(true);
    try {
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newStudentName.trim(),
          email: newStudentEmail.trim(),
          pointsBalance: parseInt(newStudentPoints, 10) || 0,
          className: newStudentClass.trim()
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create student.");
      }
      triggerToast("Student Created", data.message, "success");
      setNewStudentName('');
      setNewStudentEmail('');
      setNewStudentPoints('0');
      setNewStudentClass('');
      setIsAddStudentOpen(false);
      fetchStudents();
    } catch (err: any) {
      triggerToast("Creation Failed", err.message, "error");
    } finally {
      setIsAddStudentSaving(false);
    }
  };

  const handleAiParseRoster = async () => {
    if (!aiRosterText.trim()) {
      triggerToast("Empty Text", "Please paste or write some freeform roster text for the AI to parse.", "error");
      return;
    }
    setIsAiParsing(true);
    try {
      const response = await fetch('/api/ai/parse-roster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rawText: aiRosterText.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Roster parsing failed.");
      }
      
      if (data.students && data.students.length > 0) {
        setAiParsedStudents(data.students);
        setShowAiPreview(true);
        triggerToast("AI Parsed Roster", `Successfully extracted ${data.students.length} profile(s). Review below to import.`, "success");
      } else {
        triggerToast("No students found", "The AI was unable to extract any student profiles. Check the text format.", "info");
      }
    } catch (err: any) {
      triggerToast("AI Parser Error", err.message, "error");
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleCommitAiImport = async () => {
    if (aiParsedStudents.length === 0) return;
    setIsAiImportSaving(true);
    let successCount = 0;
    let failedCount = 0;
    
    // Process registrations sequentially to handle conflicts/duplication elegantly
    for (const student of aiParsedStudents) {
      try {
        const res = await fetch('/api/students', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: student.name,
            email: student.email,
            pointsBalance: student.pointsBalance,
            className: aiRosterClass.trim()
          })
        });
        if (res.ok) {
          successCount++;
        } else {
          failedCount++;
        }
      } catch (e) {
        failedCount++;
      }
    }

    setIsAiImportSaving(false);
    fetchStudents();
    
    if (successCount > 0) {
      triggerToast(
        "Import Complete", 
        `Successfully imported ${successCount} student profiles.${failedCount > 0 ? ` (${failedCount} skipped / already existing)` : ''}`, 
        "success"
      );
      setAiRosterText('');
      setAiParsedStudents([]);
      setShowAiPreview(false);
      setIsAddStudentOpen(false);
      setAiRosterClass('');
    } else {
      triggerToast("Import Failed", "All parsed students failed to import (likely they already exist in the roster).", "error");
    }
  };

  const fetchEmailLogs = async () => {
    if (!token) return;
    setIsEmailLogsLoading(true);
    try {
      const res = await fetch('/api/behavior/email-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Could not load email delivery status details.");
      const data = await res.json();
      if (data.success) {
        setEmailLogs(data.logs);
        setSmtpSettings(data.smtpSettings);
      }
    } catch (err: any) {
      console.error("Failed to load email logs:", err.message);
    } finally {
      setIsEmailLogsLoading(false);
    }
  };

  const retryFailedEmails = async () => {
    if (!token) return;
    setIsRetryingLogs(true);
    try {
      const res = await fetch('/api/behavior/email-logs/retry-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retry failed.");
      triggerToast("Retry Executed", data.message || "Attempted resending all failed items.", "success");
      fetchEmailLogs();
    } catch (err: any) {
      triggerToast("Retry Error", err.message, "error");
    } finally {
      setIsRetryingLogs(false);
    }
  };

  const retrySingleEmail = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/behavior/email-logs/retry-single/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retry failed.");
      triggerToast("Email Dispatched", "The email has been resent.", "success");
      fetchEmailLogs();
    } catch (err: any) {
      triggerToast("Dispatch Error", err.message, "error");
    }
  };

  const fetchTeacherBehaviorLogs = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/behavior/all-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Could not load teacher behavior logs.");
      const data = await res.json();
      if (data.success) {
        setTeacherLogs(data.logs);
      }
    } catch (err: any) {
      console.error("Failed to fetch teacher behavior logs:", err.message);
    }
  };

  const handleUpdateAmtChange = (studentId: string, value: string) => {
    setAdjustments(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        amt: value,
        reason: prev[studentId]?.reason || '',
        notify: prev[studentId]?.notify ?? false
      }
    }));
  };

  const handleUpdateReasonChange = (studentId: string, value: string) => {
    setAdjustments(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        amt: prev[studentId]?.amt || '',
        reason: value,
        rawReason: value,
        isPolished: false,
        notify: prev[studentId]?.notify ?? false
      }
    }));
  };

  const handleUpdateNotifyChange = (studentId: string, checked: boolean) => {
    setAdjustments(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        amt: prev[studentId]?.amt || '',
        reason: prev[studentId]?.reason || '',
        notify: checked
      }
    }));
  };

  const handleUpdateTargetChange = (studentId: string, value: 'parents' | 'deputy_principal_parents' | 'deputy_principal_only') => {
    setAdjustments(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        amt: prev[studentId]?.amt || '',
        reason: prev[studentId]?.reason || '',
        notify: prev[studentId]?.notify ?? false,
        notificationTarget: value
      }
    }));
  };

  const handleUpdateEscalateChange = (studentId: string, checked: boolean) => {
    setAdjustments(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        amt: prev[studentId]?.amt || '',
        reason: prev[studentId]?.reason || '',
        notify: prev[studentId]?.notify ?? false,
        escalatedToAdmin: checked
      }
    }));
  };

  const setShortcutVal = (studentId: string, val: number) => {
    handleUpdateAmtChange(studentId, String(val));
    triggerToast("Shortcut Applied", `Balance shift: ${val > 0 ? '+' : ''}${val}`, "info");
  };

  // AI Polish Teacher observations
  const polishObservationWithAI = async (studentId: string) => {
    const stateVal = adjustments[studentId];
    
    // If it is already polished, clicking acts as an Undo toggle
    if (stateVal?.isPolished) {
      setAdjustments(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          reason: stateVal.rawReason || '',
          isPolished: false
        }
      }));
      triggerToast("AI Polish Undone", "Restored your original raw observation notes.", "info");
      return;
    }

    const rawObservation = stateVal?.reason?.trim();
    const pointsAmt = stateVal?.amt;
    const student = students.find(s => s.id === studentId);
    const studentName = student ? student.name : '';

    if (!rawObservation) {
      triggerToast("Observation Required", "Please record short drafts of observation notes first, then click polish.", "error");
      return;
    }

    setAdjustments(prev => ({
      ...prev,
      [studentId]: { 
        ...prev[studentId], 
        rawReason: rawObservation, // Save original unpolished draft
        aiLoading: true 
      }
    }));

    try {
      const response = await fetch('/api/ai/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: rawObservation, pointsChange: pointsAmt || "0", studentName })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI stalled.");

      setAdjustments(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          reason: data.refined,
          isPolished: true,
          aiLoading: false
        }
      }));
      triggerToast("AI Refined Draft", "Successfully formatted log drafts constructively for parents.", "success");
    } catch (err: any) {
      triggerToast("AI Assistance Idle", err.message, "error");
      setAdjustments(prev => ({
        ...prev,
        [studentId]: { ...prev[studentId], aiLoading: false }
      }));
    }
  };

  const submitBehaviorLog = async (studentId: string, studentName: string) => {
    const stateVal = adjustments[studentId];
    const pointsChange = parseInt(stateVal?.amt || '', 10);
    const reason = stateVal?.reason?.trim();
    const sendEmail = stateVal?.notify || false;
    const notificationTarget = stateVal?.notificationTarget || 'parents';
    const escalatedToAdmin = stateVal?.escalatedToAdmin || false;

    if (!pointsChange || isNaN(pointsChange) || pointsChange === 0) {
      triggerToast("Invalid Points", "Please report a positive or negative adjustment number.", "error");
      return;
    }
    if (!reason) {
      triggerToast("Observation Empty", "Please submit notes for tracking records.", "error");
      return;
    }

    try {
      const res = await fetch('/api/behavior/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ studentId, pointsChange, reason, sendEmail, notificationTarget, escalatedToAdmin })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Execution error.");

      // Success
      triggerToast(
        pointsChange > 0 ? "Points Dispatched" : "Deduction Logged",
        `Successfully annotated ${pointsChange > 0 ? '+' : ''}${pointsChange} points for ${studentName}.${escalatedToAdmin ? ' Escalated to School Administration.' : ''}`,
        pointsChange > 0 ? 'success' : 'info'
      );

      if (data.emailStatus) {
        setRecentMails(data.emailStatus);
      }
      
      // Sync email status logs
      fetchEmailLogs();
      fetchTeacherBehaviorLogs();

      // Reset card inputs
      setAdjustments(prev => ({
        ...prev,
        [studentId]: { amt: '', reason: '', notify: false, notificationTarget: 'parents', escalatedToAdmin: false }
      }));

      // Update local state reactive changes
      setStudents(prev => prev.map(s => {
        if (s.id === studentId) {
          return { ...s, pointsBalance: s.pointsBalance + pointsChange };
        }
        return s;
      }));

    } catch (err: any) {
      triggerToast("Process Error", err.message, "error");
    }
  };

  const seedDemoRoster = async () => {
    if (!token) return;
    setIsSeedingDemo(true);
    try {
      const res = await fetch('/api/students/seed-demo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Seeding failed.");
      
      triggerToast("Roster Dynamic Synced", data.message, "success");
      await fetchStudents();
      await fetchTeacherBehaviorLogs();
    } catch (err: any) {
      triggerToast("Seeding Failed", err.message, "error");
    } finally {
      setIsSeedingDemo(false);
    }
  };

  const polishBulkObservationWithAI = async () => {
    if (isBulkPolished) {
      setBulkReason(bulkRawReason);
      setIsBulkPolished(false);
      triggerToast("Bulk Polish Undone", "Restored your original raw bulk observation notes.", "info");
      return;
    }

    const rawObservation = bulkReason?.trim();
    if (!rawObservation) {
      triggerToast("Observation Required", "Please drafts short bulk observation notes first, then click polish.", "error");
      return;
    }

    setBulkRawReason(rawObservation);
    setIsBulkAiLoading(true);
    try {
      const response = await fetch('/api/ai/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: rawObservation, pointsChange: bulkAmt || "0" })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI stalled.");

      setBulkReason(data.refined);
      setIsBulkPolished(true);
      triggerToast("AI Refined Notice", "Constructive parent-facing text successfully updated for bulk dispatch.", "success");
    } catch (err: any) {
      triggerToast("Polish Failed", err.message, "error");
    } finally {
      setIsBulkAiLoading(false);
    }
  };

  const submitBulkBehaviorLog = async () => {
    if (selectedStudentIds.length === 0) {
      triggerToast("Selection Needed", "Please check-mark one or more students from your Class list below first.", "error");
      return;
    }
    const pointsChange = parseInt(bulkAmt || '', 10);
    const reason = bulkReason.trim();
    if (!pointsChange || isNaN(pointsChange) || pointsChange === 0) {
      triggerToast("Invalid Points", "Please choose a non-zero score adjustment value (e.g. +10 or -5).", "error");
      return;
    }
    if (!reason) {
      triggerToast("Observations Needed", "Please dictate behavior logs for audit trails.", "error");
      return;
    }

    setIsBulkUpdating(true);
    try {
      const res = await fetch('/api/behavior/bulk-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studentIds: selectedStudentIds,
          pointsChange,
          reason,
          sendEmail: bulkNotify,
          notificationTarget: bulkNotificationTarget,
          escalatedToAdmin: bulkEscalate
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk dispatch failed.");

      triggerToast("Standing Dispatched", data.message + (bulkEscalate ? ' Escalated to School Administration.' : ''), "success");
      
      // Clear forms
      setBulkAmt('');
      setBulkReason('');
      setBulkNotify(false);
      setBulkEscalate(false);
      setSelectedStudentIds([]);
      
      // Update local state reactive changes
      setStudents(prev => prev.map(s => {
        if (selectedStudentIds.includes(s.id)) {
          return { ...s, pointsBalance: s.pointsBalance + pointsChange };
        }
        return s;
      }));
      
      await fetchEmailLogs();
      await fetchTeacherBehaviorLogs();
    } catch (err: any) {
      triggerToast("Bulk Action Failure", err.message, "error");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Student Actions
  const fetchStudentDashboard = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/student/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Dashboard metrics failed to resolve.");
      const data = await res.json();
      setStudentProfile(data.student);
      setStudentLogs(data.logs);
    } catch (err: any) {
      triggerToast("Synchronize failed", err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const askPulseReflectionAdvisor = async () => {
    if (!studentProfile) return;
    setIsAdviceLoading(true);
    setAiAdvice(null);

    try {
      const response = await fetch('/api/ai/reflection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: studentProfile.name,
          pointsBalance: studentProfile.pointsBalance,
          logs: studentLogs
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAiAdvice(data.advice);
      triggerToast("Counselor Ready", "Weekly AI reflection guidance successfully compiled.", "success");
    } catch (err: any) {
      triggerToast("Advisor Delayed", err.message, "error");
    } finally {
      setIsAdviceLoading(false);
    }
  };

  const availableClasses = useMemo(() => {
    const classes = new Set<string>();
    students.forEach(s => {
      if (s.className && s.className.trim()) {
        classes.add(s.className.trim());
      }
    });
    return Array.from(classes).sort();
  }, [students]);

  /*
   * Performance Optimization: Memoized Student Searching
   * ---------------------------------------------------
   * Filtering students on every keystroke can cause significant keyboard lag
   * when the roster scales (e.g. 1000+ students). Wrapping this logic in 
   * useMemo ensures that search operations only run when the list of students,
   * the searchQuery, or the classFilter actually changes.
   */
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            s.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClass = classFilter === 'All' || 
                           (classFilter === 'Unassigned' && (!s.className || s.className.trim() === '')) ||
                           (s.className && s.className.trim().toLowerCase() === classFilter.trim().toLowerCase());
      return matchesSearch && matchesClass;
    });
  }, [students, searchQuery, classFilter]);

  // Helper to filter logs by a selected period
  const filterLogsByPeriod = (logs: any[], period: 'all' | 'week' | 'month' | 'custom', sDate: string, eDate: string) => {
    if (period === 'all') return logs;
    
    const now = new Date();
    let startLimit: Date | null = null;
    let endLimit: Date | null = null;
    
    if (period === 'week') {
      startLimit = new Date();
      startLimit.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      startLimit = new Date();
      startLimit.setDate(now.getDate() - 30);
    } else if (period === 'custom') {
      if (sDate) {
        startLimit = new Date(sDate);
        startLimit.setHours(0, 0, 0, 0);
      }
      if (eDate) {
        endLimit = new Date(eDate);
        endLimit.setHours(23, 59, 59, 999);
      }
    }
    
    return logs.filter(log => {
      const logDate = new Date(log.createdAt);
      if (startLimit && logDate < startLimit) return false;
      if (endLimit && logDate > endLimit) return false;
      return true;
    });
  };

  /*
   * Performance Optimization: Memoized Audit Log Filtering
   * ------------------------------------------------------
   * Keeps audit log period-filtering cached to prevent recalculations on unrelated
   * state updates (e.g. sidebar toggles or modal opens).
   */
  const filteredTeacherLogs = useMemo(() => {
    return filterLogsByPeriod(teacherLogs, teacherFilterPeriod, teacherStartDate, teacherEndDate);
  }, [teacherLogs, teacherFilterPeriod, teacherStartDate, teacherEndDate]);

  const filteredStudentLogs = useMemo(() => {
    return filterLogsByPeriod(studentLogs, studentFilterPeriod, studentStartDate, studentEndDate);
  }, [studentLogs, studentFilterPeriod, studentStartDate, studentEndDate]);

  /*
   * Performance Optimization: useCallback to memoize period points calculations
   */
  const getStudentPeriodPoints = React.useCallback((studentId: string) => {
    const studentPeriodLogs = filteredTeacherLogs.filter(log => log.studentId === studentId);
    return studentPeriodLogs.reduce((acc, log) => acc + log.pointsChange, 0);
  }, [filteredTeacherLogs]);

  /*
   * Performance Optimization: Memoized Sorting
   * ------------------------------------------
   * Memoizes roster sorting to ensure complex string compares and numerical calculations
   * (e.g. period-change summaries) only re-evaluate when sorting parameters change.
   */
  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (studentsSortBy === 'points') {
        valA = a.pointsBalance;
        valB = b.pointsBalance;
      } else if (studentsSortBy === 'period-change') {
        valA = getStudentPeriodPoints(a.id);
        valB = getStudentPeriodPoints(b.id);
      } else {
        valA = a.name;
        valB = b.name;
      }

      if (typeof valA === 'string') {
        return studentsSortOrder === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return studentsSortOrder === 'asc' 
          ? valA - valB 
          : valB - valA;
      }
    });
  }, [filteredStudents, studentsSortBy, studentsSortOrder, getStudentPeriodPoints]);

  const totalSortedCount = sortedStudents.length;
  const totalPages = Math.ceil(totalSortedCount / (teacherPageSize === -1 ? totalSortedCount : teacherPageSize)) || 1;
  const activePage = Math.min(teacherPage, totalPages);
  
  const paginatedStudents = teacherPageSize === -1 
    ? sortedStudents 
    : sortedStudents.slice(
        (activePage - 1) * teacherPageSize,
        activePage * teacherPageSize
      );

  // Filter logs by search input
  const filteredTeacherLogsWithSearch = filteredTeacherLogs.filter(log =>
    log.studentName.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
    log.teacherName.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
    log.reason.toLowerCase().includes(logsSearchQuery.toLowerCase())
  );
  
  const totalLogsCount = filteredTeacherLogsWithSearch.length;
  const logsPageSize = 10;
  const totalLogsPages = Math.ceil(totalLogsCount / logsPageSize) || 1;
  const activeLogsPage = Math.min(logsPage, totalLogsPages);
  const paginatedLogs = filteredTeacherLogsWithSearch.slice(
    (activeLogsPage - 1) * logsPageSize,
    activeLogsPage * logsPageSize
  );

  return (
    <div className="min-h-screen flex flex-col justify-between antialiased font-sans bp-transition" style={{backgroundColor:'var(--bp-bg)',color:'var(--bp-text-primary)'}}>
      
      {/* Toast Alert Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl p-4 border border-slate-800 flex items-start gap-3.5"
          >
            <div className={`p-2 rounded-xl text-white ${
              toast.type === 'success' ? 'bg-emerald-500' :
              toast.type === 'error' ? 'bg-rose-500' : 'bg-indigo-500'
            }`}>
              {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
               toast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-100">{toast.title}</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header / Navigation Portal */}
      <header className="bp-header shadow-sm sticky top-0 z-40 bp-transition">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo Brand */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight font-display text-slate-800">BehaviorPulse</span>
            </div>

            {/* Profile widget bar */}
            {currentUser && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <span className="block text-sm font-bold" style={{color:'var(--bp-text-primary)'}}>{currentUser.name}</span>
                  <span className="inline-block text-[10px] uppercase font-bold py-0.5 px-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full tracking-wider mt-0.5">
                    {currentUser.role === 'teacher' ? 'Faculty Instructor' :
                     currentUser.role === 'principal' ? '🏫 Principal' :
                     currentUser.role === 'deputy' ? '🏛️ Deputy Principal' :
                     currentUser.role === 'super_admin' ? '🛡️ Super Admin' : 'Student'}
                  </span>
                </div>

                {/* ── Theme Toggle ─────────────────────── */}
                <button
                  onClick={() => setIsDark(d => !d)}
                  className="theme-toggle-btn"
                  title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  id="theme-toggle-btn"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isDark ? (
                      <motion.span
                        key="sun"
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex"
                      >
                        <Sun className="w-4 h-4" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="moon"
                        initial={{ rotate: 90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: -90, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex"
                      >
                        <Moon className="w-4 h-4" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <button 
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center p-2.5 rounded-xl border hover:bg-rose-50 text-slate-500 hover:text-red-600 transition-all cursor-pointer bp-transition"
                  style={{borderColor:'var(--bp-border)'}}
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">

        {!token ? (
          /* ========================================================
             LOGIN MODAL / GATE 
             ======================================================== */
          <div className="max-w-md w-full mx-auto my-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
            >
              {/* Login Banner Decoration */}
              <div className="bg-indigo-600 p-8 text-white text-center relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500 rounded-full opacity-30 blur-sm"></div>
                <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-indigo-500 rounded-full opacity-30 blur-sm"></div>
                
                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-2xl mb-3 backdrop-blur-md">
                    <Shield className="w-6 h-6 text-indigo-100" />
                  </div>
                  <h1 className="text-3xl font-extrabold tracking-tight font-display">BehaviorPulse</h1>
                  <p className="text-indigo-100 mt-1.5 text-sm">Gamified Classroom Growth & Points Tracker</p>
                </div>
              </div>

              {/* Login Content */}
              <div className="p-8">
                
                {loginError && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-5 bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl flex gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    <div>
                      <h5 className="text-xs font-bold text-rose-800">Verification Error</h5>
                      <p className="text-xs text-rose-700 mt-0.5">{loginError}</p>
                    </div>
                  </motion.div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">School Email</label>
                    <input 
                      type="email" 
                      required 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="teacher@pulse.com or student1@pulse.com" 
                      className="block w-full px-4 py-3 rounded-2xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Password</label>
                    <input 
                      type="password" 
                      required 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="block w-full px-4 py-3 rounded-2xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm"
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={isLoggingIn}
                    className="w-full flex justify-center items-center py-3.5 px-4 rounded-2xl shadow-lg shadow-indigo-100 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isLoggingIn ? (
                      <span className="flex items-center gap-1.5 justify-center">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Verifying Standing...
                      </span>
                    ) : "Sign In to Dashboard"}
                  </button>
                </form>

                {/* Sandbox Demo Accounts Fast Selector */}
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 text-center">Demo Sandbox Fast Track</p>
                  
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <button 
                      onClick={() => fillSandboxUser('teacher@pulse.com')}
                      className="flex flex-col items-center justify-center p-3 border border-slate-150 hover:border-indigo-200 rounded-2xl hover:bg-indigo-50/20 transition-all cursor-pointer"
                    >
                      <span className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" />
                        Teacher
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">Mr. Henderson</span>
                    </button>

                    <button 
                      onClick={() => fillSandboxUser('student1@pulse.com')}
                      className="flex flex-col items-center justify-center p-3 border border-slate-150 hover:border-emerald-200 rounded-2xl hover:bg-emerald-50/20 transition-all cursor-pointer"
                    >
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        Student
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">Alice Smith</span>
                    </button>

                    <button 
                      onClick={() => fillSandboxUser('principal@pulse.com')}
                      className="flex flex-col items-center justify-center p-3 border border-slate-150 hover:border-violet-200 rounded-2xl hover:bg-violet-50/20 transition-all cursor-pointer"
                    >
                      <span className="text-xs font-bold text-violet-700 flex items-center gap-1">
                        🏫 Principal
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">Skinner</span>
                    </button>

                    <button 
                      onClick={() => fillSandboxUser('deputy@pulse.com')}
                      className="flex flex-col items-center justify-center p-3 border border-slate-150 hover:border-amber-200 rounded-2xl hover:bg-amber-50/20 transition-all cursor-pointer"
                    >
                      <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                        🏛️ Deputy
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">Harris</span>
                    </button>

                    <button 
                      onClick={() => fillSandboxUser('superadmin@pulse.com')}
                      className="flex flex-col items-center justify-center p-3 border border-slate-150 hover:border-rose-200 rounded-2xl hover:bg-rose-50/20 transition-all cursor-pointer"
                    >
                      <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                        🛡️ Director
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">Super Admin</span>
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        ) : (
          /* ========================================================
             DASHBOARDS REGION
             ======================================================== */
          <div className="w-full space-y-8">
            
            {isLoading ? (
              /* Global Loading indicator */
              <div className="py-24 text-center">
                <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
                <h3 className="text-base font-bold text-slate-600 mt-4">Syncing Academic Ledger...</h3>
                <p className="text-xs text-slate-400 mt-1">Acquiring verified behavioral records from the system...</p>
              </div>
            ) : currentUser?.role === 'teacher' ? (
              /* ========================================================
                 TEACHER / FACULTY VIEW 
                 ======================================================== */
              <div className="space-y-8">
                
                {/* Board Metrics Welcome */}
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500 rounded-full filter blur-3xl opacity-15 pointer-events-none"></div>
                  <div className="relative z-10">
                    <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30">Faculty Board</span>
                    <h2 className="text-3xl font-extrabold font-display mt-2.5">Hello, <span className="text-indigo-400">{currentUser.name}</span></h2>
                    <p className="text-slate-300 mt-1 text-sm max-w-lg">Assess real-time standing balances, record constructive warnings or points, and generate smart parental updates with AI support.</p>
                  </div>
                  <div className="relative z-10 flex gap-4 shrink-0">
                    <div className="bg-white/10 backdrop-blur-md px-5 py-4 rounded-2xl border border-white/15">
                      <span className="block text-xs text-indigo-300 font-bold uppercase tracking-wider">Homeroom Size</span>
                      <span className="text-2xl font-black font-display mt-1 block">{students.length} Students</span>
                    </div>
                  </div>
                </div>

                {/* Real-time AI mail dispatch receipt feed */}
                {recentMails && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border-2 border-indigo-500 rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden"
                  >
                    <button 
                      onClick={() => setRecentMails(null)}
                      className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 font-black text-sm cursor-pointer"
                      title="Clear logs"
                    >
                      ✕ Clear Receipts
                    </button>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Sparkles className="w-4.5 h-4.5 animate-pulse" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 font-display">BehaviorPulse Real-Time Dispatch Office</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-5 max-w-2xl leading-relaxed">
                      Your action triggered AI-polished bulk notification dispatches. Here are the delivery reports and AI-generated message variants for each target group:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {recentMails.map((report, idx) => (
                        <div key={idx} className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100 flex flex-col justify-between text-xs space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-extrabold text-indigo-950 uppercase tracking-wide flex items-center gap-1">
                                🔔 {report.targetLabel}
                              </span>
                              <span className="text-[9px] uppercase font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-150 rounded">
                                {report.deliveryMode === 'simulated_debug' ? '🖥️ Mock Logged' : report.deliveryMode === 'ethereal' ? '📬 Sandbox Inbox Delivered' : '📧 SMTP Sent'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">
                              <strong>Recipients:</strong> {report.recipientEmails?.join(', ')}
                            </p>
                          </div>
                          <div className="text-slate-700 bg-white p-3 rounded-xl border border-slate-100 italic leading-relaxed text-[11px] selection:bg-indigo-100">
                            "{report.aiGeneratedContext}"
                          </div>
                          
                          {report.previewUrl && (
                            <a 
                              href={report.previewUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="mt-1 flex items-center justify-center gap-1.5 py-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all text-[10px] select-none text-center shadow-sm cursor-pointer"
                            >
                              👁️ Click to Read Sent HTML Email
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Main list segment */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm">
                  
                  {/* Header filters */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                      <h3 className="text-2xl font-extrabold text-slate-800 font-display">Student Performance Ledger</h3>
                      <p className="text-xs text-slate-500 mt-1">Review student rankings, logs, and perform safe actions below.</p>
                    </div>

                    {/* Search Field + Add Student toggler */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      {/* Dynamic Class Filter Dropdown */}
                      <div className="relative w-full sm:w-48">
                        <select
                          value={classFilter}
                          onChange={(e) => setClassFilter(e.target.value)}
                          className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer"
                        >
                          <option value="All">🏫 All Classes</option>
                          {availableClasses.map(cls => (
                            <option key={cls} value={cls}>Class: {cls}</option>
                          ))}
                          <option value="Unassigned">❓ Unassigned</option>
                        </select>
                      </div>

                      <div className="relative w-full sm:w-72">
                        <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search student names or email..."
                          className="block w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm text-slate-800 placeholder-slate-400"
                        />
                      </div>
                      
                      <button
                        onClick={() => setIsAddStudentOpen(!isAddStudentOpen)}
                        className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-bold rounded-2xl shadow-sm hover:shadow transition-all cursor-pointer w-full sm:w-auto ${
                          isAddStudentOpen ? 'bg-slate-800 hover:bg-slate-950 ring-4 ring-slate-105' : ''
                        }`}
                        id="add-student-toggle-btn"
                        title="Add student manually or via AI imports"
                      >
                        <Plus className={`w-4 h-4 transition-transform duration-300 ${isAddStudentOpen ? 'rotate-45' : ''}`} />
                        <span>Add Student</span>
                      </button>
                    </div>
                  </div>

                  {/* Add / Import Student Panel */}
                  <AnimatePresence>
                    {isAddStudentOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        className="overflow-hidden mb-8"
                      >
                        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 sm:p-7 space-y-6">
                          
                          <div className="flex pb-3 justify-between items-center border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-ping"></span>
                              <h4 className="text-base font-extrabold text-slate-800 font-display">New Student Account Ingestion</h4>
                            </div>
                            <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-400">Classroom Roster Tools</span>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Manual Registration Form */}
                            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                              <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                                    <UserPlus className="w-4.5 h-4.5" />
                                  </div>
                                  <h5 className="text-sm font-extrabold text-slate-800">Add Account Manually</h5>
                                </div>
                                
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                  Instantly register a unique student profile. This allows parent credentials to sync and matches their active point metrics.
                                </p>
                                
                                <form onSubmit={handleAddStudent} className="space-y-3.5">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Student Full Name</label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="Full name (e.g. Johnathan Doe)"
                                      value={newStudentName}
                                      onChange={(e) => setNewStudentName(e.target.value)}
                                      className="block w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    />
                                  </div>
                                  
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                                    <input
                                      type="email"
                                      required
                                      placeholder="Prefix @ domain (e.g. jdoe@pulse.com)"
                                      value={newStudentEmail}
                                      onChange={(e) => setNewStudentEmail(e.target.value)}
                                      className="block w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    />
                                  </div>
                                  
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Class / Grade Section</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Class 9A or Grade 10"
                                      value={newStudentClass}
                                      onChange={(e) => setNewStudentClass(e.target.value)}
                                      className="block w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    />
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Initial Points</label>
                                      <input
                                        type="number"
                                        placeholder="0"
                                        value={newStudentPoints}
                                        onChange={(e) => setNewStudentPoints(e.target.value)}
                                        className="block w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                      />
                                    </div>
                                    <div className="flex items-end">
                                      <button
                                        type="submit"
                                        disabled={isAddStudentSaving}
                                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {isAddStudentSaving ? (
                                          <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            Saving...
                                          </>
                                        ) : (
                                          <>
                                            <CheckSquare className="w-3.5 h-3.5" />
                                            Register Student
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </form>
                              </div>
                            </div>

                            {/* AI Import Assistant */}
                            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                                      <Bot className="w-4.5 h-4.5" />
                                    </div>
                                    <h5 className="text-sm font-extrabold text-slate-800">AI Intelligent Import</h5>
                                  </div>
                                  <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold py-0.5 px-2 bg-violet-100 text-violet-800 border border-violet-150 rounded-full select-none">
                                    <Sparkles className="w-2.5 h-2.5 text-violet-600 animate-pulse" /> Gemini AI
                                  </span>
                                </div>
                                
                                <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                                  Paste student rosters, emails, lists, or conversational notes. Gemini parses student profiles and parses points balance, letting you import them at once.
                                </p>

                                <div className="space-y-3.5">
                                  <textarea
                                    placeholder="Examples:&#10;- Alice Carter (alice@school.com) starting balance 10 pts&#10;- Bob Stark evelyn@pulse.com starts with 50 points&#10;- Clara Cole..."
                                    rows={3}
                                    value={aiRosterText}
                                    onChange={(e) => setAiRosterText(e.target.value)}
                                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-250 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-505 focus:border-violet-505 font-mono leading-relaxed resize-none"
                                  />
                                  
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Class Name (Optional)</label>
                                    <input
                                      type="text"
                                      placeholder="Assign all imported students to e.g. Class 9A"
                                      value={aiRosterClass}
                                      onChange={(e) => setAiRosterClass(e.target.value)}
                                      className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    />
                                  </div>

                                  {!showAiPreview ? (
                                    <button
                                      type="button"
                                      onClick={handleAiParseRoster}
                                      disabled={isAiParsing}
                                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-950 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isAiParsing ? (
                                        <>
                                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                          Gemini parsing roster text...
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                          Analyze & extract with AI
                                        </>
                                      )}
                                    </button>
                                  ) : (
                                    <div className="space-y-4">
                                      
                                      {/* Extracted Profiles Checklist Preview */}
                                      <div className="p-3.5 bg-indigo-50/50 border-2 border-indigo-100 rounded-xl text-[11px] text-indigo-900 space-y-2">
                                        <div className="font-extrabold flex items-center gap-1.5 text-slate-800">
                                          <Users className="w-3.5 h-3.5 text-indigo-600" /> Confirm Extracted Accounts ({aiParsedStudents.length})
                                        </div>
                                        <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px] text-slate-700">
                                          {aiParsedStudents.map((st, i) => (
                                            <div key={i} className="flex justify-between items-center bg-white px-2 py-1.5 rounded-lg border border-slate-150 shadow-sm">
                                              <div className="min-w-0 flex-1 truncate pr-2">
                                                <span className="font-bold text-slate-800">{st.name}</span>
                                                <span className="text-slate-450 ml-1.5 text-[9px]">({st.email})</span>
                                                {aiRosterClass && (
                                                  <span className="bg-violet-50 text-violet-700 border border-violet-100 px-1.5 py-0.2 rounded text-[8px] font-bold uppercase ml-1.5">
                                                    {aiRosterClass}
                                                  </span>
                                                )}
                                              </div>
                                              <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-extrabold shrink-0 text-[10px]">{st.pointsBalance} pts</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      
                                      {/* Cancel/Import buttons */}
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setShowAiPreview(false);
                                            setAiParsedStudents([]);
                                          }}
                                          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
                                        >
                                          Refine Text
                                        </button>
                                        
                                        <button
                                          type="button"
                                          onClick={handleCommitAiImport}
                                          disabled={isAiImportSaving}
                                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-violet-600 hover:bg-violet-750 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                        >
                                          {isAiImportSaving ? (
                                            <>
                                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                              Saving...
                                            </>
                                          ) : (
                                            <>
                                              <UserCheck className="w-3.5 h-3.5" />
                                              Import All ({aiParsedStudents.length})
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Date Range Performance Filter */}
                  <div className="bg-slate-50/80 border border-slate-150 rounded-2xl p-4 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Calendar className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Review Performance Period</span>
                        <span className="text-sm font-extrabold text-slate-700">Filter Ledger & Behavioral History</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setTeacherFilterPeriod('all')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                          teacherFilterPeriod === 'all'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        All Time
                      </button>
                      <button
                        onClick={() => setTeacherFilterPeriod('week')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                          teacherFilterPeriod === 'week'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        This Week (7d)
                      </button>
                      <button
                        onClick={() => setTeacherFilterPeriod('month')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                          teacherFilterPeriod === 'month'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        This Month (30d)
                      </button>
                      <button
                        onClick={() => setTeacherFilterPeriod('custom')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                          teacherFilterPeriod === 'custom'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Custom Range
                      </button>

                      {teacherFilterPeriod === 'custom' && (
                        <div className="flex items-center gap-2 mt-2 sm:mt-0">
                          <input
                            type="date"
                            value={teacherStartDate}
                            onChange={(e) => setTeacherStartDate(e.target.value)}
                            className="bg-white border border-slate-250 rounded-xl px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="text-xs text-slate-400">to</span>
                          <input
                            type="date"
                            value={teacherEndDate}
                            onChange={(e) => setTeacherEndDate(e.target.value)}
                            className="bg-white border border-slate-250 rounded-xl px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scaling & Density Toolbar */}
                  <div className="bg-white border border-slate-150 rounded-2xl p-4 mb-6 space-y-4 shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: View mode toggler & Seed Class Button */}
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Roster Scale:</span>
                        
                        {/* Layout Selectors */}
                        <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
                          <button
                            onClick={() => setTeacherLayoutMode('grid')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                              teacherLayoutMode === 'grid' 
                                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50' 
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Detail Cards View"
                          >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            Cards
                          </button>
                          <button
                            onClick={() => setTeacherLayoutMode('compact-list')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                              teacherLayoutMode === 'compact-list' 
                                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50' 
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="High-Density List View"
                          >
                            <List className="w-3.5 h-3.5" />
                            Compact List (50+)
                          </button>
                        </div>

                        {/* Interactive Seeding Button */}
                        {students.length < 45 && (
                          <button
                            onClick={seedDemoRoster}
                            disabled={isSeedingDemo}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100/50 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isSeedingDemo ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Seeding...
                              </>
                            ) : (
                              <>
                                <Users className="w-3.5 h-3.5 animate-pulse" /> Seed 50 Student Class
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Right: Sorting Selectors & Page Size dropdown */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider"><ArrowUpDown className="w-3 h-3 inline mr-1" />Sort:</span>
                          <select
                            value={studentsSortBy}
                            onChange={(e) => setStudentsSortBy(e.target.value as any)}
                            className="bg-white border border-slate-250 py-1.5 px-2 text-xs font-semibold text-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="name">🔤 Student Name</option>
                            <option value="points">🏆 Standing Balance</option>
                            <option value="period-change">⏱️ Filter Period Change</option>
                          </select>

                          <button
                            onClick={() => setStudentsSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className="p-1 px-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer text-slate-600"
                            title={studentsSortOrder === 'asc' ? 'Ascending' : 'Descending'}
                          >
                            {studentsSortOrder === 'asc' ? '↑' : '↓'}
                          </button>
                        </div>

                        {/* Page Size Selectors */}
                        <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-display">Show:</span>
                          <select
                            value={teacherPageSize}
                            onChange={(e) => {
                              setTeacherPageSize(Number(e.target.value));
                              setTeacherPage(1);
                            }}
                            className="bg-white border border-slate-250 py-1.5 px-2 text-xs font-semibold text-slate-700 rounded-xl focus:outline-none"
                          >
                            <option value="12">12 / page</option>
                            <option value="24">24 / page</option>
                            <option value="50">50 / page</option>
                            <option value="-1">Show All (50+)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Multi-student selection stats & Select-All controllers */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            if (selectedStudentIds.length === paginatedStudents.length) {
                              setSelectedStudentIds([]);
                            } else {
                              setSelectedStudentIds(paginatedStudents.map(s => s.id));
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer font-bold text-slate-600"
                        >
                          {selectedStudentIds.length === paginatedStudents.length ? (
                            <>
                              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                              Deselect All
                            </>
                          ) : (
                            <>
                              <Square className="w-3.5 h-3.5 text-slate-400" />
                              Select All Page ({paginatedStudents.length})
                            </>
                          )}
                        </button>
                        
                        {selectedStudentIds.length > 0 && (
                          <span className="text-indigo-600 font-extrabold bg-indigo-50 border border-indigo-100/50 py-1 px-3 rounded-xl animate-pulse">
                            👥 {selectedStudentIds.length} students selected for bulk adjustments
                          </span>
                        )}
                      </div>
                      
                      {selectedStudentIds.length > 0 && (
                        <button
                          onClick={() => setSelectedStudentIds([])}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer font-bold shrink-0 self-start text-xs animate-fade-in"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bulk / Multi-Student Action Panel */}
                  <AnimatePresence>
                    {selectedStudentIds.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-indigo-50/40 border-2 border-indigo-100 rounded-2xl p-5 mb-6 space-y-4 overflow-hidden"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                            ✨
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-slate-800">Group standing transaction</h4>
                            <p className="text-[11px] text-slate-500">Record observations and apply balance points to all {selectedStudentIds.length} selected students at once.</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-indigo-100/60 font-sans">
                          {/* Score input */}
                          <div className="col-span-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-display">Score Swing</label>
                            
                            {/* Preset shortcuts for bulk */}
                            <div className="grid grid-cols-4 gap-0.5 mb-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                              <button onClick={() => setBulkAmt("10")} className="py-0.5 text-[9px] font-extrabold text-emerald-800 hover:bg-emerald-50 rounded cursor-pointer font-sans select-none">＋10</button>
                              <button onClick={() => setBulkAmt("5")} className="py-0.5 text-[9px] font-extrabold text-emerald-800 hover:bg-emerald-50 rounded cursor-pointer font-sans select-none">＋5</button>
                              <button onClick={() => setBulkAmt("-5")} className="py-0.5 text-[9px] font-extrabold text-rose-800 hover:bg-rose-50 rounded cursor-pointer font-sans select-none">－5</button>
                              <button onClick={() => setBulkAmt("-10")} className="py-0.5 text-[9px] font-extrabold text-rose-800 hover:bg-rose-50 rounded cursor-pointer font-sans select-none">－10</button>
                            </div>

                            <input
                              type="number"
                              value={bulkAmt}
                              onChange={(e) => setBulkAmt(e.target.value)}
                              placeholder="Preset or value"
                              className="block w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:outline-indigo-500 font-bold"
                            />
                          </div>

                          {/* Reason drafting with AI polish */}
                          <div className="md:col-span-2">
                            <div className="flex justify-between items-center mb-1.5">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-display">Observations</label>
                              <button
                                onClick={polishBulkObservationWithAI}
                                disabled={isBulkAiLoading || !bulkReason}
                                className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-600 hover:text-indigo-800 transition-all disabled:opacity-40 cursor-pointer uppercase font-sans"
                              >
                                {isBulkAiLoading ? (
                                  <>
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Polishing...
                                  </>
                                ) : isBulkPolished ? (
                                  <span className="flex items-center gap-0.5 text-emerald-600 hover:text-emerald-700">
                                    <CheckCircle className="w-2.5 h-2.5 text-emerald-500 animate-pulse" /> Undo AI Polish
                                  </span>
                                ) : (
                                  <>
                                    <BrainCircuit className="w-2.5 h-2.5 text-indigo-500 animate-pulse" /> AI Refine Constructive Notes
                                  </>
                                )}
                              </button>
                            </div>
                            <textarea
                              rows={2}
                              value={bulkReason}
                              onChange={(e) => {
                                setBulkReason(e.target.value);
                                setBulkRawReason(e.target.value);
                                setIsBulkPolished(false);
                              }}
                              placeholder="Write shared event or achievements details (e.g. 'Cooperative team focus during Science revision activity')"
                              className="block w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:outline-indigo-500 text-slate-800 placeholder-slate-400"
                            />
                          </div>

                          {/* Email notification toggle */}
                          <div className="col-span-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Email Parents</span>
                                <input
                                  type="checkbox"
                                  checked={bulkNotify}
                                  onChange={(e) => setBulkNotify(e.target.checked)}
                                  className="rounded border-slate-200 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                />
                              </div>
                              
                              {bulkNotify && (
                                <select
                                  value={bulkNotificationTarget}
                                  onChange={(e) => setBulkNotificationTarget(e.target.value as any)}
                                  className="w-full bg-white border border-slate-205 rounded-lg py-1 px-1.5 text-[10px] outline-none"
                                >
                                  <option value="parents">🏠 Home Parents Only</option>
                                  <option value="deputy_principal_parents">🎓 Deputy, Principal & Parents</option>
                                  <option value="deputy_principal_only">🏫 Principal & Deputy Only</option>
                                </select>
                              )}

                              <div className="flex items-center justify-between mb-1.5 mt-2 border-t border-slate-100 pt-2 select-none">
                                <span className="text-[10px] text-rose-700 uppercase tracking-widest font-bold">Escalate Admin</span>
                                <input
                                  type="checkbox"
                                  checked={bulkEscalate}
                                  onChange={(e) => setBulkEscalate(e.target.checked)}
                                  className="rounded border-slate-200 text-rose-600 focus:ring-rose-500 h-4 w-4 cursor-pointer"
                                />
                              </div>
                            </div>

                            <button
                              onClick={submitBulkBehaviorLog}
                              disabled={isBulkUpdating || !bulkAmt || !bulkReason}
                              className="w-full mt-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 px-1 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-sm shadow-indigo-100"
                            >
                              {isBulkUpdating ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileText className="w-3.5 h-3.5" />
                              )}
                              Dispatch Group Adjustment
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Student Grid / List Render block */}
                  {totalSortedCount === 0 ? (
                    <div className="py-16 text-center bg-slate-50/50 border border-slate-100 rounded-3xl">
                      <AlertCircle className="w-12 h-12 text-slate-300 mx-auto animate-pulse" />
                      <h4 className="text-sm font-bold text-slate-600 mt-3">No matching students found</h4>
                      <p className="text-xs text-slate-400 mt-1">Refine your queries or specify another name.</p>
                    </div>
                  ) : teacherLayoutMode === 'compact-list' ? (
                    /* COMPACT LIST MODE (High density optimized for 50+ students) */
                    <div className="overflow-x-auto border border-slate-150 rounded-2xl bg-white shadow-sm font-sans">
                      <table className="min-w-full divide-y divide-slate-150 text-left text-xs text-slate-600">
                        <tbody className="divide-y divide-slate-100 divide-y-dotted">
                          {paginatedStudents.map((student) => {
                            const isSelected = selectedStudentIds.includes(student.id);
                            const stateVal = adjustments[student.id] || { amt: '', reason: '', notify: false };
                            
                            let badgeBgTheme = "bg-slate-100 text-slate-700 border-slate-200";
                            if (student.pointsBalance >= 150) {
                              badgeBgTheme = "bg-amber-55 text-amber-900 border-amber-200 font-extrabold";
                            } else if (student.pointsBalance >= 100) {
                              badgeBgTheme = "bg-emerald-50 text-emerald-800 border-emerald-150 font-bold";
                            } else if (student.pointsBalance < 50) {
                              badgeBgTheme = "bg-rose-50 text-rose-800 border-rose-150 font-bold";
                            }

                            const periodPoints = getStudentPeriodPoints(student.id);

                            return (
                              <tr key={student.id} className={`hover:bg-slate-50/40 transition-colors ${isSelected ? 'bg-indigo-50/10' : ''}`}>
                                {/* Select checkbox */}
                                <td className="p-4 text-center">
                                  <button
                                    onClick={() => {
                                      setSelectedStudentIds(prev => 
                                        prev.includes(student.id) 
                                          ? prev.filter(mid => mid !== student.id) 
                                          : [...prev, student.id]
                                      );
                                    }}
                                    className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                                    title="Select student"
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="w-5 h-5 text-indigo-600 mx-auto" />
                                    ) : (
                                      <Square className="w-5 h-5 text-slate-250 mx-auto" />
                                    )}
                                  </button>
                                </td>
                                
                                {/* Name / email */}
                                <td className="px-4 py-3 font-semibold text-slate-800">
                                  <div className="font-bold text-slate-800">{student.name}</div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-slate-450 font-normal">{student.email}</span>
                                    {student.className && (
                                      <span className="inline-flex items-center text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded">
                                        {student.className}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Point balance */}
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs border ${badgeBgTheme}`}>
                                    {student.pointsBalance} pts
                                  </span>
                                </td>

                                {/* Period points shift */}
                                <td className="px-4 py-3 text-center">
                                  {teacherFilterPeriod !== 'all' ? (
                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                                      periodPoints > 0 
                                        ? 'bg-emerald-55 text-emerald-800 border-emerald-200' 
                                        : periodPoints < 0 
                                          ? 'bg-rose-50 text-rose-800 border-rose-200' 
                                          : 'bg-slate-50 text-slate-500 border-slate-200'
                                    }`}>
                                      {periodPoints > 0 ? '+' : ''}{periodPoints} pts
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">-</span>
                                  )}
                                </td>

                                {/* Observation textbox + AI support */}
                                <td className="px-4 py-3 w-80 font-sans">
                                  <div className="flex flex-col gap-1 text-xs">
                                    <div className="flex items-center justify-between">
                                      <input
                                        type="text"
                                        placeholder="Dictate behavior summary notes..."
                                        value={stateVal.reason}
                                        onChange={(e) => handleUpdateReasonChange(student.id, e.target.value)}
                                        className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:outline-indigo-500 rounded-lg px-2 py-1 text-xs text-slate-855 placeholder-slate-450 font-medium"
                                      />
                                      <button
                                        onClick={() => polishObservationWithAI(student.id)}
                                        disabled={stateVal.aiLoading || !stateVal.reason}
                                        className="shrink-0 ml-1.5 text-indigo-600 hover:text-indigo-800 disabled:opacity-40 cursor-pointer"
                                        title="AI Polish Row Observation"
                                      >
                                        {stateVal.aiLoading ? (
                                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <BrainCircuit className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                                        )}
                                      </button>
                                    </div>
                                    
                                    {/* Alert household email option */}
                                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-450 pt-0.5 select-none">
                                      <label className="flex items-center gap-1 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={stateVal.notify}
                                          onChange={(e) => handleUpdateNotifyChange(student.id, e.target.checked)}
                                          className="rounded border-slate-200 text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                                        />
                                        <span>Alert Parents</span>
                                      </label>
                                      
                                      {stateVal.notify && (
                                        <select
                                          value={stateVal.notificationTarget || 'parents'}
                                          onChange={(e) => handleUpdateTargetChange(student.id, e.target.value as any)}
                                          className="bg-white border border-slate-200 rounded text-[9px] font-medium outline-none py-0.5 cursor-pointer max-w-[80px]"
                                        >
                                          <option value="parents">🏠 Parents</option>
                                          <option value="deputy_principal_parents">🎓 Deputy & Principal</option>
                                          <option value="deputy_principal_only">🏫 School Exec Office</option>
                                        </select>
                                      )}
                                    </div>
                                    
                                    {/* Escalate to school administration toggle */}
                                    <div className="flex items-center justify-between text-[10px] text-slate-455 pt-1.5 border-t border-slate-100 mt-1 select-none">
                                      <label className="flex items-center gap-1 cursor-pointer" title="Send a formal report to school Principals & Deputy Principals">
                                        <input
                                          type="checkbox"
                                          checked={stateVal.escalatedToAdmin || false}
                                          onChange={(e) => handleUpdateEscalateChange(student.id, e.target.checked)}
                                          className="rounded border-slate-250 text-rose-600 focus:ring-rose-500 h-3 w-3"
                                        />
                                        <span className="text-rose-700 font-bold">⚠️ Send Admin Report</span>
                                      </label>
                                    </div>
                                  </div>
                                </td>

                                {/* Quick +/- adjusts */}
                                <td className="px-4 py-1.5 w-44">
                                  <div className="flex flex-col gap-1 max-w-[150px]">
                                    <div className="flex gap-0.5">
                                      <button onClick={() => setShortcutVal(student.id, 10)} className="py-0.5 px-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-[9px] font-bold text-emerald-800 rounded cursor-pointer">+10</button>
                                      <button onClick={() => setShortcutVal(student.id, 5)} className="py-0.5 px-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-[9px] font-bold text-emerald-800 rounded cursor-pointer">+5</button>
                                      <button onClick={() => setShortcutVal(student.id, -5)} className="py-0.5 px-1 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-[9px] font-bold text-rose-800 rounded cursor-pointer">-5</button>
                                      <button onClick={() => setShortcutVal(student.id, -10)} className="py-0.5 px-1 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-[9px] font-bold text-rose-800 rounded cursor-pointer">-10</button>
                                    </div>
                                    <input
                                      type="number"
                                      placeholder="Value"
                                      value={stateVal.amt}
                                      onChange={(e) => handleUpdateAmtChange(student.id, e.target.value)}
                                      className="w-16 bg-slate-50 focus:bg-white border border-slate-200 focus:outline-indigo-500 rounded-lg px-1.5 py-0.5 text-xs text-slate-800 font-bold"
                                    />
                                  </div>
                                </td>

                                {/* Dispatch button */}
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => submitBehaviorLog(student.id, student.name)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    Record Standing Update
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* CARDS GRID MODE */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
                      {paginatedStudents.map((student) => {
                        const isSelected = selectedStudentIds.includes(student.id);
                        const stateVal = adjustments[student.id] || { amt: '', reason: '', notify: false };
                        
                        // Decide color of reward badge
                        let badgeBgTheme = "bg-slate-100 text-slate-700 border-slate-250";
                        if (student.pointsBalance >= 150) {
                          badgeBgTheme = "bg-amber-55 text-amber-900 border-amber-200 font-black";
                        } else if (student.pointsBalance >= 100) {
                          badgeBgTheme = "bg-emerald-50 text-emerald-800 border-emerald-150 font-bold";
                        } else if (student.pointsBalance < 50) {
                          badgeBgTheme = "bg-rose-50 text-rose-800 border-rose-150 font-bold";
                        }

                        return (
                          <motion.div 
                            key={student.id}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between p-5 ${
                              isSelected ? 'border-2 border-indigo-500 bg-indigo-50/5' : 'border-slate-200'
                            }`}
                          >
                            <div>
                              
                              {/* Student name and current points header */}
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0 flex items-start gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedStudentIds(prev => 
                                        prev.includes(student.id) 
                                          ? prev.filter(mid => mid !== student.id) 
                                          : [...prev, student.id]
                                      );
                                    }}
                                    className="mt-0.5 shrink-0 text-slate-400 hover:text-indigo-600 cursor-pointer"
                                    title="Select student"
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="w-5 h-5 text-indigo-600" />
                                    ) : (
                                      <Square className="w-5 h-5 text-slate-300" />
                                    )}
                                  </button>
                                  <div className="min-w-0">
                                    <h4 className="text-base font-bold text-slate-800 truncate">{student.name}</h4>
                                    <p className="text-xs text-slate-400 truncate">{student.email}</p>
                                    {student.className && (
                                      <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        🏫 {student.className}
                                      </span>
                                    )}
                                    {(() => {
                                      const periodPoints = getStudentPeriodPoints(student.id);
                                      if (teacherFilterPeriod !== 'all') {
                                        return (
                                          <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                                            periodPoints > 0 
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                              : periodPoints < 0 
                                                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                                : 'bg-slate-50 text-slate-500 border-slate-200'
                                          }`}>
                                            Period Change: {periodPoints > 0 ? '+' : ''}{periodPoints} pts
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                </div>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs border shrink-0 ${badgeBgTheme}`}>
                                  {student.pointsBalance} pts
                                </span>
                              </div>

                              {/* Form area */}
                              <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                                
                                {/* Score input and adjustments shortcuts */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1 select-none">Adjustment Swing</label>
                                  
                                  {/* Presets Grid */}
                                  <div className="grid grid-cols-4 gap-1 mb-1.5">
                                    <button onClick={() => setShortcutVal(student.id, 10)} className="py-1 px-1 text-[11px] font-bold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors uppercase border border-emerald-100 cursor-pointer">+10</button>
                                    <button onClick={() => setShortcutVal(student.id, 5)} className="py-1 px-1 text-[11px] font-bold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors uppercase border border-emerald-100 cursor-pointer">+5</button>
                                    <button onClick={() => setShortcutVal(student.id, -5)} className="py-1 px-1 text-[11px] font-bold rounded bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors uppercase border border-rose-100 cursor-pointer">-5</button>
                                    <button onClick={() => setShortcutVal(student.id, -10)} className="py-1 px-1 text-[11px] font-bold rounded bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors uppercase border border-rose-100 cursor-pointer">-10</button>
                                  </div>

                                  <input 
                                    type="number"
                                    placeholder="Adjustment value (e.g. 15 or -10)"
                                    value={stateVal.amt}
                                    onChange={(e) => handleUpdateAmtChange(student.id, e.target.value)}
                                    className="block w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                  />
                                </div>

                                {/* Text reason area with Gemini Polish capability */}
                                <div>
                                  <div className="flex justify-between items-center mb-1">
                                    <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-widest">Observations</label>
                                    
                                    <button 
                                      onClick={() => polishObservationWithAI(student.id)}
                                      disabled={stateVal?.aiLoading || !stateVal?.reason}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-all disabled:opacity-40 cursor-pointer uppercase font-sans"
                                      title="Refine observer notes for parent distribution constructively with AI"
                                    >
                                      {stateVal?.aiLoading ? (
                                        <span className="flex items-center gap-1">
                                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Polishing...
                                        </span>
                                      ) : stateVal?.isPolished ? (
                                        <span className="flex items-center gap-0.5 text-emerald-600 hover:text-emerald-700">
                                          <CheckCircle className="w-2.5 h-2.5 text-emerald-500 animate-pulse" /> Undo AI Polish
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-0.5">
                                          <BrainCircuit className="w-2.5 h-2.5 text-indigo-500 animate-pulse" /> AI Refine Notice
                                        </span>
                                      )}
                                    </button>
                                  </div>

                                  <textarea 
                                    rows={2}
                                    value={stateVal.reason}
                                    onChange={(e) => handleUpdateReasonChange(student.id, e.target.value)}
                                    placeholder="Specify leadership activity or disruption notes here..."
                                    className="block w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                                  ></textarea>
                                </div>

                                {/* Smart alert notifications to parents */}
                                <div className="space-y-3 p-3 rounded-xl bg-slate-50 border border-slate-150">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 select-none">
                                      <Mail className="w-3.5 h-3.5 text-slate-400" /> Notify Parent Household
                                    </span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input 
                                        type="checkbox"
                                        checked={stateVal.notify}
                                        onChange={(e) => handleUpdateNotifyChange(student.id, e.target.checked)}
                                        className="sr-only peer"
                                      />
                                      <div className="w-8 h-4.5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                  </div>

                                  {stateVal.notify && (
                                    <motion.div 
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      className="space-y-1.5 pt-2 border-t border-slate-200/60"
                                    >
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alert Recipients</label>
                                      <select 
                                        value={stateVal.notificationTarget || 'parents'}
                                        onChange={(e) => handleUpdateTargetChange(student.id, e.target.value as any)}
                                        className="block w-full py-2 px-2.5 border border-slate-200 bg-white rounded-lg text-xs text-slate-700 focus:outline-[#4f46e5]/40 outline-none"
                                      >
                                        <option value="parents">🏠 Home Parents Only</option>
                                        <option value="deputy_principal_parents">🎓 Deputy, Principal & Parents</option>
                                        <option value="deputy_principal_only">🏫 Principal & Deputy Only</option>
                                      </select>
                                    </motion.div>
                                  )}
                                </div>

                                {/* Escalate to Admin option */}
                                <div className="space-y-3 p-3 rounded-xl bg-rose-50/35 border border-rose-100 select-none">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-rose-800 font-bold flex items-center gap-1.5">
                                      <span>⚠️ Send Admin Report</span>
                                    </span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input 
                                        type="checkbox"
                                        checked={stateVal.escalatedToAdmin || false}
                                        onChange={(e) => handleUpdateEscalateChange(student.id, e.target.checked)}
                                        className="sr-only peer"
                                      />
                                      <div className="w-8 h-4.5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-rose-600"></div>
                                    </label>
                                  </div>
                                </div>

                              </div>

                            </div>

                            {/* Submit updates action */}
                            <button 
                              onClick={() => submitBehaviorLog(student.id, student.name)}
                              className="mt-4 w-full bg-slate-800 hover:bg-indigo-600 text-white rounded-xl py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm hover:shadow shadow-indigo-100 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Record Standing Update
                            </button>

                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Pagination Footer Controls */}
                  {teacherPageSize !== -1 && totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-6 border-t border-slate-100 gap-4 mt-6">
                      <div className="text-slate-500 font-semibold text-xs text-center sm:text-left">
                        Showing student {Math.min((activePage - 1) * teacherPageSize + 1, totalSortedCount)} to {Math.min(activePage * teacherPageSize, totalSortedCount)} of {totalSortedCount} records
                      </div>
                      
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          disabled={activePage === 1}
                          onClick={() => setTeacherPage(prev => Math.max(prev - 1, 1))}
                          className="px-3 py-1.5 border border-slate-250 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all font-bold rounded-xl cursor-pointer inline-flex items-center gap-1 text-xs text-slate-700"
                        >
                          <ChevronLeft className="w-4 h-4" /> Prev
                        </button>

                        {(() => {
                          const pages = [];
                          const startPage = Math.max(1, activePage - 2);
                          const endPage = Math.min(totalPages, startPage + 4);

                          if (startPage > 1) {
                            pages.push(
                              <button
                                key={1}
                                onClick={() => setTeacherPage(1)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer border ${
                                  activePage === 1 
                                    ? 'bg-indigo-600 text-white border-indigo-600' 
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                1
                              </button>
                            );
                            if (startPage > 2) {
                              pages.push(<span key="dots1" className="text-slate-400 text-xs px-1">...</span>);
                            }
                          }

                          for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
                            pages.push(
                              <button
                                key={pageNum}
                                onClick={() => setTeacherPage(pageNum)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer border ${
                                  activePage === pageNum 
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100' 
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          }

                          if (endPage < totalPages) {
                            if (endPage < totalPages - 1) {
                              pages.push(<span key="dots2" className="text-slate-400 text-xs px-1">...</span>);
                            }
                            pages.push(
                              <button
                                key={totalPages}
                                onClick={() => setTeacherPage(totalPages)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer border ${
                                  activePage === totalPages 
                                    ? 'bg-indigo-600 text-white border-indigo-600' 
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {totalPages}
                              </button>
                            );
                          }

                          return pages;
                        })()}

                        <button
                          disabled={activePage === totalPages}
                          onClick={() => setTeacherPage(prev => Math.min(prev + 1, totalPages))}
                          className="px-3 py-1.5 border border-slate-250 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all font-bold rounded-xl cursor-pointer inline-flex items-center gap-1 text-xs text-slate-700"
                        >
                          Next <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                </div>

                {/* Classroom Behavior History & Auditing Logs */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-800 font-display flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-600" />
                        Classroom Behavior Logs & Auditing
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Chronological ledger of recorded behavior entries, adjustment points, and notified parent contacts.
                        {teacherFilterPeriod !== 'all' && (
                          <span className="ml-1 text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            Period Filter Active ({filteredTeacherLogs.length} items found)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                      <div className="relative w-full sm:w-60">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={logsSearchQuery}
                          onChange={(e) => {
                            setLogsSearchQuery(e.target.value);
                            setLogsPage(1);
                          }}
                          placeholder="Search behavior history..."
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs rounded-xl text-slate-800"
                        />
                      </div>
                      <button
                        onClick={handleDownloadCSV}
                        disabled={filteredTeacherLogs.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-sm transition-colors cursor-pointer shrink-0"
                      >
                        <Download className="w-4 h-4" />
                        Download Report
                      </button>
                    </div>
                  </div>

                  {filteredTeacherLogsWithSearch.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                      <Clock className="w-10 h-10 text-slate-300 mx-auto" />
                      <h4 className="text-sm font-bold text-slate-600 mt-2.5">No Behavior Entries Found</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {logsSearchQuery 
                          ? "Try adjusting your search keywords."
                          : teacherFilterPeriod === 'all' 
                            ? "Adjust student points above to log behavior observations." 
                            : "No records fall within the selected weekly or monthly performance period."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="overflow-x-auto border border-slate-150 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-150 text-left text-xs text-slate-700">
                          <thead className="bg-slate-50 font-bold text-slate-500 text-[10px] uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-3">Timestamp / Date</th>
                              <th className="px-4 py-3">Student</th>
                              <th className="px-4 py-3">Adjustment</th>
                              <th className="px-4 py-3">Observation Reason</th>
                              <th className="px-4 py-3">Parent Notified</th>
                              <th className="px-4 py-3">Instructor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 bg-white">
                            {paginatedLogs.map((log) => {
                              const isPositive = log.pointsChange > 0;
                              const formattedDate = new Date(log.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              });

                              return (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formattedDate}</td>
                                  <td className="px-4 py-3 font-bold text-slate-900">{log.studentName}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isPositive ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'
                                    }`}>
                                      {isPositive ? '+' : ''}{log.pointsChange} pts
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 max-w-xs truncate" title={log.reason}>{log.reason}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {log.parentNotified ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                        <CheckCircle className="w-3 h-3" /> Parents Dispatched
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                        Internal Only
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 italic whitespace-nowrap">{log.teacherName}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Logs Pagination Footer Controls */}
                      {totalLogsPages > 1 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-6 border-t border-slate-100 gap-4">
                          <div className="text-slate-500 font-semibold text-xs text-center sm:text-left">
                            Showing log {Math.min((activeLogsPage - 1) * logsPageSize + 1, totalLogsCount)} to {Math.min(activeLogsPage * logsPageSize, totalLogsCount)} of {totalLogsCount} entries
                          </div>
                          
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              disabled={activeLogsPage === 1}
                              onClick={() => setLogsPage(prev => Math.max(prev - 1, 1))}
                              className="px-3 py-1.5 border border-slate-250 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all font-bold rounded-xl cursor-pointer inline-flex items-center gap-1 text-xs text-slate-700"
                            >
                              <ChevronLeft className="w-4 h-4" /> Prev
                            </button>

                            {(() => {
                              const pages = [];
                              const startPage = Math.max(1, activeLogsPage - 2);
                              const endPage = Math.min(totalLogsPages, startPage + 4);

                              for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
                                pages.push(
                                  <button
                                    key={pageNum}
                                    onClick={() => setLogsPage(pageNum)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer border ${
                                      activeLogsPage === pageNum 
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100' 
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              }

                              return pages;
                            })()}

                            <button
                              disabled={activeLogsPage === totalLogsPages}
                              onClick={() => setLogsPage(prev => Math.min(prev + 1, totalLogsPages))}
                              className="px-3 py-1.5 border border-slate-250 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all font-bold rounded-xl cursor-pointer inline-flex items-center gap-1 text-xs text-slate-700"
                            >
                              Next <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Network & Email Delivery Status Panel */}
                <div id="email-network-status-panel" className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                  {/* Panel Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-800 font-display flex items-center gap-2">
                        <Server className="w-5 h-5 text-indigo-600" />
                        Network & Delivery Status
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Monitor active SMTP pipelines, inspect real-time logs, and troubleshoot undelivered parent notifications.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={fetchEmailLogs}
                        disabled={isEmailLogsLoading}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                        title="Refresh delivery reports"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isEmailLogsLoading ? 'animate-spin' : ''}`} />
                        Refresh Logs
                      </button>

                      {emailLogs.some(l => l.status === 'failed') && (
                        <button
                          onClick={retryFailedEmails}
                          disabled={isRetryingLogs}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer"
                          title="Retry dispatch for all failed logs"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRetryingLogs ? 'animate-spin' : ''}`} />
                          Retry Failed Dispatches
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Environment & SMTP configuration Status */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    
                    {/* Connection Panel */}
                    <div className="md:col-span-2 p-4.5 rounded-2xl bg-slate-50 border border-slate-150 relative overflow-hidden flex flex-col justify-between">
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${smtpSettings?.isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400 animate-pulse'}`}></span>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-505">
                            {smtpSettings?.isConfigured ? '📡 Active Live SMTP Connection' : '💡 Sandbox Testing Mode (Ethereal)'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 font-display">
                          {smtpSettings?.isConfigured ? `Connected to ${smtpSettings.host}` : 'Virtual Email Redirection Active'}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          {smtpSettings?.isConfigured 
                            ? `All behavioral alerts are being processed in real-time through custom SMTP server hosts via secure port connections.`
                            : `Private mail server credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are unconfigured. Dispatches are safely redirected to Ethereal sandbox testing.`}
                        </p>
                      </div>

                      <div className="mt-4 pt-3.5 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-4 text-[10px] text-slate-500 select-none">
                          <div>
                            <span className="font-semibold text-slate-400">HOST:</span>{' '}
                            <span className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                              {smtpSettings?.isConfigured ? smtpSettings.host : 'smtp.ethereal.email'}
                            </span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-400">PORT:</span>{' '}
                            <span className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                              {smtpSettings?.isConfigured ? smtpSettings.port : '587'}
                            </span>
                          </div>
                        </div>

                        {!smtpSettings?.isConfigured && (
                          <div className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 font-extrabold px-2.5 py-1 rounded-lg">
                            🔍 To receive physical mail, configure SMTP variables in Settings keys panel.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Delivery Queue Quick Stats */}
                    <div className="grid grid-cols-2 gap-3 shrink-0">
                      <div className="p-3.5 bg-white border border-slate-150 rounded-2xl flex flex-col justify-between shadow-xs">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Delivered</span>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-slate-800 font-display">
                            {emailLogs.filter(l => l.status === 'delivered').length}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600">Active</span>
                        </div>
                      </div>

                      <div className="p-3.5 bg-white border border-slate-150 rounded-2xl flex flex-col justify-between shadow-xs">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Failed</span>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className={`text-2xl font-black font-display ${emailLogs.some(l => l.status === 'failed') ? 'text-rose-600' : 'text-slate-800'}`}>
                            {emailLogs.filter(l => l.status === 'failed').length}
                          </span>
                          {emailLogs.some(l => l.status === 'failed') && (
                            <span className="text-[10px] font-bold text-rose-500 animate-pulse">Needs Retry</span>
                          )}
                        </div>
                      </div>

                      <div className="p-3.5 bg-white border border-slate-150 rounded-2xl flex flex-col justify-between shadow-xs">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Pending</span>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-slate-800 font-display">
                            {emailLogs.filter(l => l.status === 'pending').length}
                          </span>
                          <span className="text-[10px] font-medium text-slate-450">In Queue</span>
                        </div>
                      </div>

                      <div className="p-3.5 bg-white border border-slate-150 rounded-2xl flex flex-col justify-between shadow-xs">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Total Cards</span>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-slate-800 font-display">
                            {emailLogs.length}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400">Traced</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Mail dispatches Timeline / Logs log lists */}
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email Delivery Logs & Transports</span>
                      <span className="text-[10px] text-slate-400 italic">Showing newest dispatches first</span>
                    </div>

                    {emailLogs.length === 0 ? (
                      <div className="py-12 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                        <Mail className="w-8 h-8 text-slate-350 mx-auto opacity-60 mb-2.5" />
                        <h4 className="text-xs font-bold text-slate-600">Pristine Dispatch Queue</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Dispatched logs will stack here immediately upon submitting performance updates with email notifications enabled.</p>
                      </div>
                    ) : (
                      <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                        {emailLogs.map((log) => {
                          const formattedTime = new Date(log.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            month: 'short',
                            day: 'numeric'
                          });

                          return (
                            <div key={log.id} className="p-4 rounded-xl border border-slate-150 hover:border-slate-300 bg-white hover:bg-slate-50/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                              
                              {/* Left details */}
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                    log.status === 'delivered' 
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-150' 
                                      : log.status === 'failed' 
                                      ? 'bg-rose-50 text-rose-800 border border-rose-150' 
                                      : 'bg-slate-50 text-slate-700 border border-slate-150'
                                  }`}>
                                    {log.status === 'delivered' ? '✓ DELIVERED' : log.status === 'failed' ? '✗ FAILED' : '⚡ PENDING'}
                                  </span>
                                  
                                  <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    {log.deliveryMode === 'simulated_debug' ? '🖥️ Mock' : log.deliveryMode === 'ethereal' ? '📬 Sandbox' : log.deliveryMode === 'smtp_delivered' ? '📧 Live SMTP' : '🔄 Outbox Queue'}
                                  </span>

                                  <span className="text-[10px] text-slate-400 font-medium">{formattedTime}</span>
                                </div>

                                <div className="min-w-0">
                                  <p className="font-extrabold text-slate-800 text-xs sm:text-sm truncate">
                                    {log.subject}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                    <strong>To ({log.targetLabel}):</strong> {log.recipientEmails?.join(', ')}
                                  </p>
                                </div>

                                {/* Detailed Error Display */}
                                {log.status === 'failed' && log.error && (
                                  <div className="p-2.5 rounded-lg bg-rose-50/40 border border-rose-150 text-[10px] text-rose-800 font-mono leading-relaxed break-words">
                                    <strong>Transport Error Event:</strong> {log.error}
                                  </div>
                                )}
                              </div>

                              {/* Right interactive actions */}
                              <div className="flex items-center gap-2 shrink-0 sm:self-center self-start flex-wrap">
                                
                                {log.status === 'delivered' && log.previewUrl && (
                                  <a 
                                    href={log.previewUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-150 text-indigo-700 font-bold rounded-lg transition-all text-[10px]"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Read Outbox HTML
                                  </a>
                                )}

                                {log.status === 'failed' && (
                                  <button
                                    onClick={() => retrySingleEmail(log.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold rounded-lg transition-all text-[10px] cursor-pointer shadow-xs"
                                    title="Manually retry sending this notification"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    Retry Send Only
                                  </button>
                                )}

                              </div>

                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>

              </div>
            ) : currentUser?.role === 'super_admin' ? (
              /* ========================================================
                 SUPER ADMIN DASHBOARD — CENTRAL SAAS MANAGEMENT
                 ======================================================== */
              <SuperAdminDashboard
                currentUser={currentUser!}
                token={token}
                triggerToast={triggerToast}
                onLogout={handleLogout}
              />
            ) : (currentUser?.role === 'principal' || currentUser?.role === 'deputy') ? (
              /* ========================================================
                 ADMIN DASHBOARD — PRINCIPAL & DEPUTY PRINCIPAL VIEW
                 ======================================================== */
              <AdminDashboard
                currentUser={currentUser!}
                students={students}
                teacherLogs={teacherLogs}
                token={token}
                triggerToast={triggerToast}
                fetchTeacherBehaviorLogs={fetchTeacherBehaviorLogs}
                fetchStudents={fetchStudents}
              />
            ) : (
              /* ========================================================
                 STUDENT / PARENT VIEW
                 ======================================================== */
              <div className="space-y-8">
                
                {/* Standing Pulse Badge circle Hero */}
                {studentProfile && (
                  <div className="bg-gradient-to-b from-indigo-950 to-slate-900 text-white rounded-3xl overflow-hidden shadow-xl border border-indigo-900 p-6 sm:p-10 relative">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500 rounded-full filter blur-[100px] opacity-15 pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 sm:gap-10">
                      
                      <div className="text-center md:text-left space-y-3.5 max-w-xl">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                          Live Standing
                        </span>
                        
                        <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight text-slate-100">
                          Welcome, <span className="text-indigo-400">{studentProfile.name}</span>
                        </h1>
                        
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md">
                          "Character is who you are in the dark. Your choices build your community, log achievements, and establish peer examples."
                        </p>
                      </div>

                      {/* Giant glowing pulse ring points metrics */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className="w-40 h-40 rounded-full border-4 border-indigo-500/20 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-md relative shadow-2xl">
                          <motion.div 
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
                            className="absolute inset-0 rounded-full border-4 border-indigo-500/40 pointer-events-none opacity-30"
                          />
                          <span className="text-4xl sm:text-5xl font-black font-display text-indigo-200">{studentProfile.pointsBalance}</span>
                          <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-400 mt-1">Point Standings</span>
                        </div>

                        {/* Point tier details */}
                        <div className="mt-3.5 text-center">
                          {studentProfile.pointsBalance >= 200 ? (
                            <span className="inline-block text-[11px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">🥇 Paragon Behavior Tier</span>
                          ) : studentProfile.pointsBalance >= 120 ? (
                            <span className="inline-block text-[11px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">🥈 Leadership Role Model</span>
                          ) : studentProfile.pointsBalance >= 80 ? (
                            <span className="inline-block text-[11px] font-black text-slate-300 uppercase tracking-widest bg-slate-500/10 px-3 py-1 rounded-full border border-slate-500/20 font-semibold">🥉 Active Contributor</span>
                          ) : studentProfile.pointsBalance >= 0 ? (
                            <span className="inline-block text-[11px] font-black text-teal-400 uppercase tracking-widest bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">🌱 Developing Citizen</span>
                          ) : (
                            <span className="inline-block text-[11px] font-black text-rose-450 uppercase tracking-widest bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30 animate-pulse">⚠️ Corrective Plan Required</span>
                          )}
                        </div>

                      </div>

                    </div>
                  </div>
                )}

                {/* AI Counselor reflection advice box */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <BrainCircuit className="w-24 h-24 text-indigo-600" />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 relative z-10">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 font-display flex items-center gap-2">
                        <BrainCircuit className="w-5.5 h-5.5 text-indigo-500" /> PulseAdvisor: AI Copilot Counsel
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Obtain real-time growth indicators and roadmap recommendations mapped to your points ledger.</p>
                    </div>

                    <button
                      onClick={askPulseReflectionAdvisor}
                      disabled={isAdviceLoading}
                      className="inline-flex items-center gap-1 px-4.5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-slate-800 rounded-2xl transition-all shadow-md shadow-indigo-100 disabled:opacity-40 cursor-pointer"
                    >
                      {isAdviceLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Synthesizing reports...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" /> Analyze with PulseAdvisor
                        </>
                      )}
                    </button>
                  </div>

                  {/* AI Output Segment */}
                  <AnimatePresence>
                    {aiAdvice ? (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100 mt-3 flex gap-3.5"
                      >
                        <div className="p-1.5 bg-indigo-100 text-indigo-700 h-fit rounded-lg sm:block hidden">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold tracking-wider uppercase text-indigo-800">Weekly Advisor Insights</h4>
                          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">{aiAdvice}</p>
                          <div className="text-[10px] text-indigo-500 font-semibold pt-1">Powered by Gemini AI Guidance</div>
                        </div>
                      </motion.div>
                    ) : (
                      !isAdviceLoading && (
                        <div className="py-4 text-center rounded-2xl border border-dashed border-slate-200">
                          <p className="text-xs text-slate-400">Click the button above to synthesize private weekly reflection advice and customized reward goals with AI counselor support.</p>
                        </div>
                      )
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Points History Chart ──────────────────────────────────── */}
                {studentLogs.length >= 2 && (() => {
                  // Build cumulative running-balance series from oldest → newest
                  const sorted = [...studentLogs].sort(
                    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                  );
                  let running = (studentProfile?.pointsBalance ?? 0)
                    - sorted.reduce((acc, l) => acc + l.pointsChange, 0);
                  const chartData = sorted.map(log => {
                    running += log.pointsChange;
                    return {
                      date: new Date(log.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric' }),
                      points: running,
                      change: log.pointsChange,
                      label: log.reason.slice(0, 40) + (log.reason.length > 40 ? '…' : '')
                    };
                  });
                  const minPts = Math.min(...chartData.map(d => d.points));
                  const maxPts = Math.max(...chartData.map(d => d.points));
                  const CustomTooltip = ({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bp-card p-3 text-xs shadow-xl" style={{minWidth:180}}>
                        <p className="font-black text-indigo-500 text-base mb-1">{d.points} pts</p>
                        <p className="font-semibold" style={{color:'var(--bp-text-primary)'}}>{label}</p>
                        <p className={`mt-1 font-bold ${d.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {d.change >= 0 ? '+' : ''}{d.change} pts
                        </p>
                        <p className="mt-1" style={{color:'var(--bp-text-muted)'}}>{d.label}</p>
                      </div>
                    );
                  };
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bp-card p-6"
                    >
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h3 className="text-lg font-extrabold font-display" style={{color:'var(--bp-text-primary)'}}>Points Balance History</h3>
                          <p className="text-xs mt-0.5" style={{color:'var(--bp-text-muted)'}}>Your cumulative standing over all recorded events</p>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
                            <span style={{color:'var(--bp-text-secondary)'}}>Balance</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-0.5 bg-slate-300 inline-block border-dashed border-t-2"></span>
                            <span style={{color:'var(--bp-text-secondary)'}}>Zero line</span>
                          </span>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="pointsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--bp-border)" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: 'var(--bp-text-muted)' }}
                            tickLine={false}
                            axisLine={{ stroke: 'var(--bp-border)' }}
                          />
                          <YAxis
                            domain={[Math.min(minPts - 10, -5), maxPts + 10]}
                            tick={{ fontSize: 10, fill: 'var(--bp-text-muted)' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          {minPts < 0 || maxPts > 0 ? (
                            <ReferenceLine y={0} stroke="#e11d48" strokeDasharray="4 3" strokeWidth={1.5} />
                          ) : null}
                          <Area
                            type="monotone"
                            dataKey="points"
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            fill="url(#pointsGrad)"
                            dot={{ r: 3.5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </motion.div>
                  );
                })()}

                {/* Behavioral log timeline view */}
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-bold font-display" style={{color:'var(--bp-text-primary)'}}>Classroom Performance Logs</h3>
                      <p className="text-xs mt-1" style={{color:'var(--bp-text-muted)'}}>Chronological log of points actions, observations, and certifications issued by faculty instructors.</p>
                    </div>
                  </div>

                  {/* Student Date Range Filter */}
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-700">Filter Performance Period:</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {['all', 'week', 'month', 'custom'].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setStudentFilterPeriod(mode as any)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                            studentFilterPeriod === mode
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {mode === 'all' ? 'All Time' : mode === 'week' ? 'This Week' : mode === 'month' ? 'This Month' : 'Custom'}
                        </button>
                      ))}

                      {studentFilterPeriod === 'custom' && (
                        <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
                          <input
                            type="date"
                            value={studentStartDate}
                            onChange={(e) => setStudentStartDate(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="text-xs text-slate-400">to</span>
                          <input
                            type="date"
                            value={studentEndDate}
                            onChange={(e) => setStudentEndDate(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {filteredStudentLogs.length === 0 ? (
                    <div className="py-16 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                      <Clock className="w-12 h-12 text-slate-200 mx-auto" strokeWidth={1} />
                      <h4 className="text-sm font-bold text-slate-600 mt-3.5">Pristine Student Record Ledger</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {studentFilterPeriod === 'all'
                          ? "You have a clean history. Focus on earning bonus points for support activities!"
                          : "No observations are registered within the selected filter period."}
                      </p>
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-slate-200 pl-6 space-y-6 ml-3">
                      {filteredStudentLogs.map((log) => {
                        const isPositive = log.pointsChange > 0;
                        const formattedDate = new Date(log.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <motion.div 
                            key={log.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="relative pl-6 hover:translate-x-1 transition-transform"
                          >
                            {/* Left Dot Bullet marker */}
                            <span className={`absolute -left-[31px] top-2 h-4.5 w-4.5 rounded-full flex items-center justify-center text-white ring-4 ring-slate-100 ${
                              isPositive ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}>
                              <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                            </span>

                            {/* Timeline Item Description card */}
                            <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm hover:border-slate-300 transition-colors">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
                                
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${
                                    isPositive ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-rose-50 text-rose-800 border-rose-100'
                                  }`}>
                                    {isPositive ? '+' : ''}{log.pointsChange} pts
                                  </span>
                                  <span className="text-xs text-slate-400 font-medium">{formattedDate}</span>
                                </div>

                                <span className="text-[11px] text-slate-400 flex items-center gap-1 sm:self-center self-start">
                                  <User className="w-3.5 h-3.5" /> Instructor: <strong className="text-slate-600">{log.teacherName}</strong>
                                </span>

                              </div>

                              <p className="text-slate-700 text-sm leading-relaxed">{log.reason}</p>

                              {/* Alert details */}
                              <div className="mt-3.5 pt-3 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400">
                                <span className="flex items-center gap-1 font-semibold">
                                  {log.parentNotified ? (
                                    <>
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Parent Dispatched
                                    </>
                                  ) : (
                                    <>
                                      <FileText className="w-3.5 h-3.5 text-slate-300" /> Local Record Log
                                    </>
                                  )}
                                </span>
                              </div>

                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* Humble Footer */}
      <footer className="py-6 bg-white border-t border-slate-100 text-center text-xs text-slate-400 font-sans tracking-wide shrink-0">
        <p>&copy; 2026 BehaviorPulse Student Standings. All rights reserved.</p>
      </footer>

    </div>
  );
}

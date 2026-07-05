import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, User, Users, CheckCircle, TrendingUp, Bot, Sparkles, 
  RefreshCw, FileText, AlertTriangle, Search, Calendar, ChevronRight, 
  Filter, Plus, Trash2, Archive, CheckSquare, X, Briefcase, 
  Clock, ArrowRight, Lock, Mail, UserPlus, FileCheck, Check
} from 'lucide-react';

interface Student {
  id: string;
  name: string;
  email: string;
  pointsBalance: number;
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
  role: 'teacher' | 'student' | 'deputy' | 'principal';
  pointsBalance: number;
}

interface AdminDashboardProps {
  currentUser: UserSession;
  students: Student[];
  teacherLogs: TeacherBehaviorLog[];
  token: string | null;
  triggerToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
  fetchTeacherBehaviorLogs: () => void;
  fetchStudents: () => void;
}

export default function AdminDashboard({
  currentUser,
  students,
  teacherLogs,
  token,
  triggerToast,
  fetchTeacherBehaviorLogs,
  fetchStudents
}: AdminDashboardProps) {
  // Escalated filter periods & statuses
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Executive review form state
  const [selectedLog, setSelectedLog] = useState<TeacherBehaviorLog | null>(null);
  const [adminAction, setAdminAction] = useState('Principal Warned & Counselled');
  const [adminNotes, setAdminNotes] = useState('');
  const [adminStatus, setAdminStatus] = useState<'action_taken' | 'archived'>('action_taken');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Student Account Ingestion forms state
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPoints, setManualPoints] = useState('0');
  const [isManualSaving, setIsManualSaving] = useState(false);

  // AI extraction state
  const [aiText, setAiText] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiPreviewData, setAiPreviewData] = useState<any[]>([]);
  const [isAiImportSaving, setIsAiImportSaving] = useState(false);

  // Roster listing query
  const [rosterSearch, setRosterSearch] = useState('');

  // Extract all logs submitted as escalated administrative reports
  const escalatedReports = teacherLogs.filter(log => log.escalatedToAdmin);

  // Filter reports based on search and selected filter status
  const filteredReports = escalatedReports.filter(log => {
    // Search filter
    const matchesSearch = 
      log.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      log.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.teacherName.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter
    if (reportFilter === 'pending') {
      return matchesSearch && log.adminStatus === 'pending_review';
    } else if (reportFilter === 'resolved') {
      return matchesSearch && (log.adminStatus === 'action_taken' || log.adminStatus === 'archived');
    }
    return matchesSearch;
  });

  const pendingReportsCount = escalatedReports.filter(l => l.adminStatus === 'pending_review').length;
  const resolvedReportsCount = escalatedReports.filter(l => l.adminStatus === 'action_taken' || l.adminStatus === 'archived').length;

  // Handle lodging administrative action review
  const handleLodgeAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLog) return;
    if (!adminAction.trim()) {
      triggerToast("Missing Intervention", "Please specify or write the action log to record.", "error");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const res = await fetch(`/api/behavior/review/${selectedLog.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          adminAction: adminAction.trim(),
          adminNotes: adminNotes.trim(),
          adminStatus: adminStatus
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Review submission failed.");

      triggerToast("Incident Resolved", "The executive action has been registered on the audit ledger.", "success");
      
      // Reset forms
      setSelectedLog(null);
      setAdminNotes('');
      
      // Reload states
      fetchTeacherBehaviorLogs();
    } catch (err: any) {
      triggerToast("Submission Error", err.message, "error");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Register Student manually
  const handleRegisterManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualEmail.trim()) {
      triggerToast("Empty fields", "Name and email are strictly required.", "error");
      return;
    }

    setIsManualSaving(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: manualName.trim(),
          email: manualEmail.toLowerCase().trim(),
          pointsBalance: parseInt(manualPoints, 10) || 0
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registry failed.");

      triggerToast("Student Profile Created", `Successfully generated student credential profile for ${manualName}.`, "success");
      
      // Clean states
      setManualName('');
      setManualEmail('');
      setManualPoints('0');
      
      // Sync list
      fetchStudents();
    } catch (err: any) {
      triggerToast("Creation Error", err.message, "error");
    } finally {
      setIsManualSaving(false);
    }
  };

  // Parse roster text with AI
  const handleAiParseText = async () => {
    if (!aiText.trim()) {
      triggerToast("Form Is Blank", "Please paste or draft students text details to parse.", "error");
      return;
    }

    setIsAiParsing(true);
    try {
      const res = await fetch('/api/ai/parse-roster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rawText: aiText.trim() })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Roster extraction failed.");

      if (data.students && data.students.length > 0) {
        setAiPreviewData(data.students);
        triggerToast("AI Parse Completed", `Identified ${data.students.length} profile(s). Review list below to commit registration.`, "success");
      } else {
        triggerToast("AI Read Idle", "Could not decipher students credentials. Double check details.", "info");
      }
    } catch (err: any) {
      triggerToast("AI Parser Failed", err.message, "error");
    } finally {
      setIsAiParsing(false);
    }
  };

  // Commit AI list in backend database
  const handleAiCommitImports = async () => {
    if (aiPreviewData.length === 0) return;
    setIsAiImportSaving(true);
    let ok = 0;
    
    for (const st of aiPreviewData) {
      try {
        const res = await fetch('/api/students', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: st.name,
            email: st.email.toLowerCase().trim(),
            pointsBalance: st.pointsBalance || 0
          })
        });
        if (res.ok) ok++;
      } catch (e) {
        // Continue silently
      }
    }

    triggerToast("AI Ingestion Dynamic", `Registered ${ok} out of ${aiPreviewData.length} students correctly inside roster.`, "success");
    setAiText('');
    setAiPreviewData([]);
    setIsRosterOpen(false);
    fetchStudents();
    setIsAiImportSaving(false);
  };

  const filteredRoster = students.filter(st => {
    return st.name.toLowerCase().includes(rosterSearch.toLowerCase()) || 
           st.email.toLowerCase().includes(rosterSearch.toLowerCase());
  }).slice(0, 50);

  return (
    <div className="space-y-8" id="admin-exec-workspace">
      
      {/* Executive Welcome Board Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-7 sm:p-9 rounded-3xl shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500 rounded-full filter blur-[120px] opacity-15 pointer-events-none animate-pulse"></div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-300 text-[10px] font-bold uppercase tracking-widest border border-rose-500/25 rounded-full">
            <Shield className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            Executive Administration Suite
          </div>
          <h2 className="text-2xl sm:text-3.5xl font-black font-display tracking-tight text-slate-100">
            Welcome, <span className="text-indigo-400">{currentUser.name}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-normal leading-relaxed">
            School oversight ledger for <span className="text-indigo-300 font-bold capitalize">{currentUser.role}</span> actions. Validate behavior trends, handle logs escalated by faculty, and safely ingest student credentials.
          </p>
        </div>

        {/* Statistical Micro Badges */}
        <div className="relative z-10 flex gap-4 shrink-0 flex-wrap">
          <div className="bg-white/5 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex-col flex min-w-[120px]">
            <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Reports Active</span>
            <span className="text-xl sm:text-2xl font-black font-display mt-0.5 text-yellow-400">{pendingReportsCount} Pending</span>
          </div>
          <div className="bg-white/5 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex-col flex min-w-[120px]">
            <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Interventions</span>
            <span className="text-xl sm:text-2xl font-black font-display mt-0.5 text-emerald-400">{resolvedReportsCount} Resolved</span>
          </div>
        </div>
      </div>

      {/* Primary Section: Escalations review desk & Student accounts checklist */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Escalated reports ledger list (Takes 2 columns) */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 font-display flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  Escalated Behavior Incidents Desk
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">Official reports logged and submitted by classroom teachers for administrative review.</p>
              </div>

              {/* Toggle filters between Pending and Resolved escalated cases */}
              <div className="inline-flex p-1 bg-slate-50 border border-slate-150 rounded-xl select-none">
                <button
                  onClick={() => setReportFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reportFilter === 'pending'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Pending Action ({pendingReportsCount})
                </button>
                <button
                  onClick={() => setReportFilter('resolved')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reportFilter === 'resolved'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Resolved Reports ({resolvedReportsCount})
                </button>
              </div>
            </div>

            {/* Quick search inside escalations */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name, teacher, notes or reason..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs rounded-xl text-slate-800 placeholder-slate-450 transition-colors"
              />
            </div>

            {/* Reports Display Container */}
            <div className="space-y-4">
              {filteredReports.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                  <FileCheck className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-500 mt-3.5">Behavior ledger is completely clean</h4>
                  <p className="text-[10px] text-slate-400 mt-1">No escalated reports match the active filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredReports.map((log) => {
                    const isPending = log.adminStatus === 'pending_review';
                    const scoreShift = log.pointsChange;
                    return (
                      <div 
                        key={log.id}
                        className={`p-5 rounded-2xl border transition-all ${
                          isPending 
                            ? 'bg-amber-50/20 border-amber-150 hover:bg-amber-50/30' 
                            : 'bg-slate-50/30 border-slate-200 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                          
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border ${
                              isPending
                                ? 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}>
                              {isPending ? '⚠️ Review Pending' : '✅ Action Logged'}
                            </span>
                            <h4 className="text-sm font-extrabold text-slate-800">
                              Student: <span className="text-indigo-600">{log.studentName}</span>
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              Logged by <span className="font-bold text-slate-700">{log.teacherName}</span> &bull; {new Date(log.createdAt).toLocaleString()}
                            </p>
                          </div>

                          {/* Points balance shift indicator */}
                          <span className={`px-3 py-1.5 rounded-xl font-display font-black text-xs shrink-0 self-start sm:self-center ${
                            scoreShift > 0 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {scoreShift > 0 ? '+' : ''}{scoreShift} Points
                          </span>

                        </div>

                        <div className="mt-3.5 bg-white border border-slate-100 rounded-xl p-3 text-slate-700 text-xs leading-relaxed font-sans shadow-2xs">
                          <strong className="text-slate-500 text-[10px] block uppercase tracking-wider mb-1">Reason Logged:</strong>
                          "{log.reason}"
                        </div>

                        {/* Review actions form if pending action OR display action taken */}
                        {isPending ? (
                          <div className="mt-4 flex justify-end">
                            <button
                              onClick={() => {
                                setSelectedLog(log);
                                setAdminNotes('');
                              }}
                              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl transition-all text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              Take Executive Action
                            </button>
                          </div>
                        ) : (
                          <div className="mt-4 border-t border-slate-205/60 pt-3 space-y-2 text-[11px]">
                            <div className="flex flex-wrap items-center gap-1.5 text-slate-600">
                              <span className="font-bold text-slate-800 uppercase tracking-wider text-[9px] bg-slate-100 px-1.5 py-0.5 rounded">Action Logged:</span>
                              <span className="font-extrabold text-indigo-700 px-2 py-0.5 bg-indigo-50 border border-indigo-150 rounded">{log.adminAction}</span>
                              <span className="text-slate-400">by</span>
                              <span className="font-bold">{log.adminReviewedBy}</span>
                              <span className="text-slate-400">on</span>
                              <span className="font-bold">{new Date(log.adminReviewedAt || '').toLocaleDateString()}</span>
                            </div>
                            {log.adminNotes && (
                              <p className="p-2.5 bg-slate-100/50 rounded-lg text-slate-500 text-xs italic">
                                " {log.adminNotes} "
                              </p>
                            )}
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Administrative Quick Actions / Side menu column (Takes 1 column) */}
        <div className="space-y-6">
          
          {/* Add / Import Students Portal (The requested automatic & easy interface) */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-slate-800 text-base font-display">Student Admissions</h3>
              </div>
              <button
                onClick={() => setIsRosterOpen(!isRosterOpen)}
                className="p-1 px-2.5 rounded-lg text-[10px] font-black border border-slate-200 hover:bg-slate-50 cursor-pointer text-slate-600"
              >
                {isRosterOpen ? "Hide" : "+ Open Tools"}
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Deploy raw student lists or enter full rosters. Use our **Gemini AI Intelligent Parser** to seamlessly read lists and register accounts.
            </p>

            {isRosterOpen && (
              <div className="space-y-6 pt-2">
                {/* Manual Register Drawer */}
                <form onSubmit={handleRegisterManual} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <h4 className="text-[11px] uppercase tracking-wider font-extrabold text-slate-500">Manual Admissions Form</h4>
                  
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="Student Full Name"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      required
                      placeholder="Student Email (student@pulse.com)"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Standing"
                      value={manualPoints}
                      onChange={(e) => setManualPoints(e.target.value)}
                      className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={isManualSaving}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {isManualSaving ? "Adding..." : "Add Profile"}
                    </button>
                  </div>
                </form>

                {/* Gemini intelligent extraction system */}
                <div className="p-4 bg-indigo-50/20 border-2 border-indigo-100 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[11px] uppercase tracking-wider font-extrabold text-slate-600">Gemini AI Ingestion Desk</h4>
                    <span className="text-[8px] bg-violet-100 text-violet-800 py-0.5 px-2 rounded-full border border-violet-150 font-bold tracking-widest uppercase">Smart</span>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-normal">
                    Paste lists of emails, rosters, or descriptive student lines. Gemini will automatically extract names, initial balances, and domains.
                  </p>

                  <textarea
                    rows={4}
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    placeholder="Enter raw roster strings, for instance:&#10;- Frank Stark, frank@school.work, starting balance 10 pts&#10;- Liam Davies (liam@school.work) starts with 150 points&#10;- Grace Hall"
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-[11px] placeholder-slate-400 text-slate-700 outline-none font-mono bg-white resize-none"
                  />

                  {aiPreviewData.length === 0 ? (
                    <button
                      type="button"
                      onClick={handleAiParseText}
                      disabled={isAiParsing}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-55"
                    >
                      {isAiParsing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Gemini Deciphering...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                          Extract Profiles via AI
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-2 bg-indigo-50 text-indigo-900 rounded-lg text-[10px] space-y-1.5 font-mono max-h-36 overflow-y-auto">
                        <strong className="block text-slate-800 text-[9px] mb-1 font-sans">Extracted Extents ({aiPreviewData.length}):</strong>
                        {aiPreviewData.map((st, idx) => (
                          <div key={idx} className="flex justify-between items-center border-b border-indigo-100/50 pb-1">
                            <span className="truncate max-w-[120px] font-bold">{st.name}</span>
                            <span className="text-slate-500">[{st.pointsBalance} pts]</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setAiPreviewData([])}
                          className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 text-slate-500 cursor-pointer"
                        >
                          Reset
                        </button>
                        <button
                          onClick={handleAiCommitImports}
                          disabled={isAiImportSaving}
                          className="flex-1 py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl cursor-pointer transition-colors"
                        >
                          {isAiImportSaving ? "Syncing..." : "Commit Roster"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Standings viewer to locate any student */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 font-display flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-650" />
                Active Student Roster Accounts
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Quick lookup table for overall student balances.</p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search students list..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] rounded-lg text-slate-800 placeholder-slate-450 transition-colors"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {filteredRoster.map(st => (
                <div key={st.id} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 hover:bg-indigo-50/20 border border-slate-150 shadow-2xs font-sans text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-800 truncate">{st.name}</p>
                    <p className="text-[9px] text-slate-400 truncate">{st.email}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    st.pointsBalance >= 100 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                      : st.pointsBalance < 50 
                        ? 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  }`}>
                    {st.pointsBalance} pts
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Review Dialog Slideover / Modal Overlay */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border text-left border-slate-150 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col"
            >
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center relative overflow-hidden">
                <div className="absolute right-0 top-0 w-44 h-44 bg-indigo-600 rounded-full filter blur-[80px] opacity-25"></div>
                
                <div className="relative z-10">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-300">Executive Briefing & Action Review</p>
                  <h3 className="text-lg font-black font-display text-white mt-1">Intervention Desk File</h3>
                </div>

                <button 
                  onClick={() => setSelectedLog(null)}
                  className="relative z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border border-white/15 cursor-pointer text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleLodgeAction} className="p-6 sm:p-8 space-y-5 flex-1 max-h-[85vh] overflow-y-auto">
                <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-100 space-y-1.5 text-xs">
                  <p className="text-amber-800 font-extrabold flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Incident File details:
                  </p>
                  <p className="text-slate-700"><strong>Student:</strong> {selectedLog.studentName}</p>
                  <p className="text-slate-700"><strong>Reporter:</strong> {selectedLog.teacherName}</p>
                  <p className="text-slate-700"><strong>Assigned points balance shift:</strong> <span className={selectedLog.pointsChange > 0 ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>{selectedLog.pointsChange} pts</span></p>
                  <p className="text-slate-650 bg-white border border-slate-150/60 p-2.5 rounded-xl italic mt-1 bg-white/50">"{selectedLog.reason}"</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1.5">Official Administrative Action</label>
                    <select
                      value={adminAction}
                      onChange={(e) => setAdminAction(e.target.value)}
                      className="block w-full rounded-xl border border-slate-205 py-2.5 px-3.5 text-xs text-slate-800 bg-white focus:outline-indigo-500 font-semibold cursor-pointer"
                    >
                      <option value="Executive Principal Action Logged">👑 Executive Principal Warning issued</option>
                      <option value="Lunchtime Detention (30 Mins) logged">⏰ Lunchtime Detention scheduled</option>
                      <option value="Afterschool Detention (1 Hour) scheduled">⏱️ Afterschool Detention scheduled</option>
                      <option value="Authorized Family Mediation Met">👪 Parents called & Family mediation scheduled</option>
                      <option value="In-School Suspension (ISS) Issued">🏫 In-School Suspension logged</option>
                      <option value="Behavior Intervention Contract Enlisted">📜 Behavior intervention contract signed</option>
                      <option value="Merit Achievement Acknowledged">🥇 Merit Commendation registered</option>
                      <option value="No further intervention required">🟢 Retrajectory approved (no action)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1.5">Administrative Status</label>
                    <div className="flex gap-3 select-none text-xs">
                      <label className="flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 font-bold text-slate-600">
                        <input
                          type="radio"
                          name="adminStatus"
                          checked={adminStatus === 'action_taken'}
                          onChange={() => setAdminStatus('action_taken')}
                          className="text-indigo-650 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                        />
                        <span>Action Logged</span>
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 font-bold text-slate-600">
                        <input
                          type="radio"
                          name="adminStatus"
                          checked={adminStatus === 'archived'}
                          onChange={() => setAdminStatus('archived')}
                          className="text-slate-650 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                        />
                        <span>Archived</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1.5">Official Directives / Review Notes</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="e.g. 'Met with John. Spoke via phone with his mother. Agreed she will audit homework tracker files nightly. Student committed to restorative circles next Tuesday.'"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="block w-full rounded-xl border border-slate-205 py-2.5 px-3 text-xs focus:outline-indigo-500 text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>

                <div className="flex gap-3.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLog(null)}
                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-500 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-md transition-all flex items-center justify-center gap-1"
                  >
                    {isSubmittingReview ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Lodging...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Log Resolution
                      </>
                    )}
                  </button>
                </div>
              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

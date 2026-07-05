import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, School, Users, CheckCircle, Search, Plus, 
  Trash2, Archive, X, Lock, Mail, UserPlus, Check, 
  Settings, RefreshCw, AlertTriangle, Key, ExternalLink
} from 'lucide-react';

interface SchoolStats {
  students: number;
  teachers: number;
  admins: number;
}

interface School {
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
  stats: SchoolStats;
}

interface UserSession {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'principal' | 'deputy' | 'teacher' | 'student';
  schoolId: string;
  pointsBalance: number;
}

interface SuperAdminDashboardProps {
  currentUser: UserSession;
  token: string | null;
  triggerToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
  onLogout: () => void;
}

export default function SuperAdminDashboard({
  currentUser,
  token,
  triggerToast,
  onLogout
}: SuperAdminDashboardProps) {
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // School creation state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [principalName, setPrincipalName] = useState('');
  const [principalEmail, setPrincipalEmail] = useState('');
  const [principalPassword, setPrincipalPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchSchools = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/schools', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load schools.");
      setSchools(data.schools || []);
    } catch (err: any) {
      triggerToast("Error", err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, [token]);

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim() || !subdomain.trim() || !principalName.trim() || !principalEmail.trim() || !principalPassword.trim()) {
      triggerToast("Validation Alert", "Please fill in all provisioning fields.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: schoolName.trim(),
          subdomain: subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, ''),
          principalName: principalName.trim(),
          principalEmail: principalEmail.toLowerCase().trim(),
          principalPassword: principalPassword.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register school.");

      triggerToast("Institution Provisioned", `Successfully registered ${schoolName} and created principal account.`, "success");
      
      // Reset form
      setSchoolName('');
      setSubdomain('');
      setPrincipalName('');
      setPrincipalEmail('');
      setPrincipalPassword('');
      setIsCreateOpen(false);
      
      // Reload lists
      fetchSchools();
    } catch (err: any) {
      triggerToast("Provisioning Failed", err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (schoolId: string, currentStatus: 'active' | 'suspended') => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status.");

      triggerToast("Status Updated", `School account is now ${nextStatus}.`, "success");
      fetchSchools();
    } catch (err: any) {
      triggerToast("Status Update Failed", err.message, "error");
    }
  };

  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPrincipalPassword(pwd);
  };

  // Filter schools list
  const filteredSchools = schools.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.subdomain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute aggregated stats
  const totalSchools = schools.length;
  const totalStudents = schools.reduce((acc, s) => acc + s.stats.students, 0);
  const totalTeachers = schools.reduce((acc, s) => acc + s.stats.teachers, 0);
  const activeSchools = schools.filter(s => s.status === 'active').length;

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Super Admin Stats Overview Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl overflow-hidden shadow-xl border border-indigo-900/60 p-6 sm:p-8 relative">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500 rounded-full filter blur-[120px] opacity-15 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-widest border border-indigo-500/30">
              <Shield className="w-3.5 h-3.5" />
              SaaS Director Access
            </span>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">
              BehaviorPulse Central Ledger
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-xl">
              Hello, <span className="text-white font-semibold">{currentUser.name}</span>. You have access to global tenant records, school creation desks, and point telemetry.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-2xl shadow-lg transition-all text-xs cursor-pointer active:scale-95 border border-indigo-500/50"
            >
              <Plus className="w-4 h-4" />
              Provision School
            </button>
            <button
              onClick={onLogout}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold rounded-2xl transition-all text-xs cursor-pointer active:scale-95 border border-slate-700/60"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Numerical Metrics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Registered Schools", value: totalSchools, label: `${activeSchools} Active Tenants`, icon: School, color: "from-blue-500/10 to-indigo-500/10 text-indigo-600 border-indigo-100" },
          { title: "Total Students", value: totalStudents, label: "Enrolled globally", icon: Users, color: "from-emerald-500/10 to-teal-500/10 text-emerald-600 border-emerald-100" },
          { title: "Total Instructors", value: totalTeachers, label: "Active accounts", icon: Shield, color: "from-violet-500/10 to-fuchsia-500/10 text-violet-600 border-violet-100" },
          { title: "Licensing Status", value: "SaaS", label: "Enterprise Tier Active", icon: CheckCircle, color: "from-amber-500/10 to-orange-500/10 text-amber-600 border-amber-100" }
        ].map((stat, idx) => (
          <div key={idx} className={`bg-gradient-to-br ${stat.color} rounded-2xl border p-5 flex flex-col justify-between shadow-xs relative overflow-hidden`}>
            <div className="flex justify-between items-start">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{stat.title}</span>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">{stat.value}</h3>
              </div>
              <span className="p-2 bg-white/60 rounded-xl shadow-xs">
                <stat.icon className="w-5 h-5" />
              </span>
            </div>
            <span className="text-[10px] text-slate-600 font-medium mt-3 block">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Roster & Management Desk */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        
        {/* Table Search & Header Controls */}
        <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h2 className="text-lg font-bold text-slate-900">Registered School Institutions</h2>
            <p className="text-slate-500 text-xs">Provision, monitor, and regulate local school accounts.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search by school or domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 outline-hidden"
            />
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              Syncing global tenant records...
            </div>
          ) : filteredSchools.length === 0 ? (
            <div className="p-16 text-center text-slate-500 text-xs space-y-2">
              <School className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">No School Accounts Found</p>
              <p className="text-[10px] text-slate-400">Try modifying your search or register a new institution.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-4 px-6">School Name</th>
                  <th className="py-4 px-6">Domain / Portal Slug</th>
                  <th className="py-4 px-6">Roster Metrics</th>
                  <th className="py-4 px-6">Created On</th>
                  <th className="py-4 px-6">License Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {filteredSchools.map((school) => {
                  const isActive = school.status === 'active';
                  return (
                    <tr key={school.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="py-4.5 px-6 font-bold text-slate-900">
                        {school.name}
                      </td>
                      <td className="py-4.5 px-6 font-mono text-[10px] text-slate-500">
                        {school.subdomain}.behaviorpulse.com
                      </td>
                      <td className="py-4.5 px-6 space-y-1">
                        <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-600">
                          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" /> {school.stats.students} students</span>
                          <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-slate-400" /> {school.stats.teachers} teachers</span>
                        </div>
                      </td>
                      <td className="py-4.5 px-6 text-slate-500 text-[10px]">
                        {new Date(school.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-4.5 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider ${
                          isActive 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          {school.status}
                        </span>
                      </td>
                      <td className="py-4.5 px-6 text-right">
                        <button
                          onClick={() => handleToggleStatus(school.id, school.status)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-xs cursor-pointer ${
                            isActive 
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700' 
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isActive ? "Suspend License" : "Restore License"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Provisioning Drawer/Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center relative">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold flex items-center gap-2"><School className="w-5 h-5 text-indigo-400" /> Provision School Portal</h3>
                  <p className="text-slate-400 text-[10px]">Create the institution tenant profile and main principal credential.</p>
                </div>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSchool} className="p-6 space-y-4 text-xs">
                
                {/* School Details */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[9px] text-indigo-600">Institution Details</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">School Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Greenwood Academy"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Subdomain Prefix</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="e.g. greenwood"
                          value={subdomain}
                          onChange={(e) => setSubdomain(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 pr-20 font-mono text-[11px]"
                        />
                        <span className="absolute right-3.5 inset-y-0 flex items-center text-[10px] font-semibold text-slate-400 pointer-events-none">
                          .pulse.com
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Principal Admin Account Provisioning */}
                <div className="space-y-3 pt-2">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[9px] text-indigo-600">Principal Profile Provision</h4>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Principal Full Name</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-450 pointer-events-none">
                          <UserPlus className="w-4 h-4 text-slate-400" />
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Dr. Arthur Pendelton"
                          value={principalName}
                          onChange={(e) => setPrincipalName(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Principal School Email</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-450 pointer-events-none">
                          <Mail className="w-4 h-4 text-slate-400" />
                        </span>
                        <input
                          type="email"
                          required
                          placeholder="e.g. principal@greenwood.com"
                          value={principalEmail}
                          onChange={(e) => setPrincipalEmail(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-600 flex justify-between">
                        <span>Access Password</span>
                        <button
                          type="button"
                          onClick={generateRandomPassword}
                          className="text-[10px] text-indigo-650 hover:text-indigo-850 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Key className="w-3 h-3" /> Auto-Generate
                        </button>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-450 pointer-events-none">
                          <Lock className="w-4 h-4 text-slate-400" />
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="Specify or auto-generate password..."
                          value={principalPassword}
                          onChange={(e) => setPrincipalPassword(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Provision Buttons */}
                <div className="flex gap-3 pt-4 border-t border-slate-50">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-2xl shadow-lg transition-all text-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Provisioning System...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Confirm Provisioning
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-2xl transition-all text-xs cursor-pointer"
                  >
                    Cancel
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

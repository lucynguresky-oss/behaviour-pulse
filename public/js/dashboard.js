document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('behavior_pulse_token');
  const userJson = localStorage.getItem('behavior_pulse_user');

  // 1. Authenticate check: redirect to login if session token is missing
  if (!token || !userJson) {
    localStorage.clear();
    window.location.replace('/login.html');
    return;
  }

  const currentUser = JSON.parse(userJson);

  // 2. Render user profile banner widgets
  document.getElementById('user-display-name').textContent = currentUser.name;
  document.getElementById('user-display-role').textContent = currentUser.role === 'teacher' ? 'Faculty Instructor' : 'Student / Parent';

  // Logout Handler
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.clear();
    window.location.replace('/login.html');
  });

  // Global variables to hold teacher states
  let studentsData = [];

  // 3. Conditional initialization
  const spinner = document.getElementById('loading-spinner');
  const teacherView = document.getElementById('teacher-dashboard-view');
  const studentView = document.getElementById('student-dashboard-view');

  try {
    if (currentUser.role === 'teacher') {
      // Setup teacher greetings
      document.querySelectorAll('.teacher-greet-name').forEach(el => {
        el.textContent = currentUser.name;
      });

      // Load Students Roster
      await loadTeacherDashboard();
      
      // Hook search inputs
      const searchInput = document.getElementById('student-search-input');
      searchInput.addEventListener('input', (e) => {
        filterStudents(e.target.value);
      });

      // Show View
      spinner.classList.add('hidden');
      teacherView.classList.remove('hidden');

    } else if (currentUser.role === 'student') {
      // Load Student standing
      await loadStudentDashboard();

      // Show View
      spinner.classList.add('hidden');
      studentView.classList.remove('hidden');
    }
  } catch (err) {
    console.error("Dashboard initialization failure:", err.message);
    showToast("System Synch Failed", "Failed to compile your portfolio logs.", "red");
  }

  /* =================================_________
     TEACHER DIRECTORY METHODS
     ========================================= */

  async function loadTeacherDashboard() {
    const res = await fetch('/api/students', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.clear();
        window.location.replace('/login.html');
        return;
      }
      throw new Error("Unable to retrieve roster.");
    }

    studentsData = await res.json();
    document.getElementById('stat-student-count').textContent = `${studentsData.length} Registered`;
    renderStudentGrid(studentsData);
  }

  function renderStudentGrid(students) {
    const grid = document.getElementById('student-grid');
    grid.innerHTML = '';

    if (students.length === 0) {
      document.getElementById('empty-search-state').classList.remove('hidden');
      return;
    } else {
      document.getElementById('empty-search-state').classList.add('hidden');
    }

    students.forEach(student => {
      const card = document.createElement('div');
      card.className = "bg-white border border-slate-150 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between";
      card.id = `student-card-${student.id}`;

      // Styling badge based on points balance
      let balanceBg = "bg-slate-100 text-slate-800";
      if (student.pointsBalance > 120) {
        balanceBg = "bg-emerald-100 text-emerald-800 font-extrabold";
      } else if (student.pointsBalance > 80) {
        balanceBg = "bg-indigo-100 text-indigo-800 font-bold";
      } else if (student.pointsBalance < 50) {
        balanceBg = "bg-amber-100 text-amber-800 font-bold";
      }

      card.innerHTML = `
        <div>
          <!-- Header info -->
          <div class="flex justify-between items-start gap-3">
            <div>
              <h4 class="font-bold text-slate-800 text-lg tracking-tight">${student.name}</h4>
              <p class="text-xs text-slate-400 mt-0.5">${student.email}</p>
            </div>
            <span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${balanceBg}">
              <span class="student-balance-val">${student.pointsBalance}</span>&nbsp;pts
            </span>
          </div>

          <!-- Points Form division -->
          <form class="mt-6 pt-5 border-t border-slate-100 space-y-4" onsubmit="event.preventDefault();">
            
            <!-- Adjust numeric input fields -->
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">Adjustment Amount</label>
              
              <!-- Shortcut score blocks -->
              <div class="grid grid-cols-4 gap-1.5 mt-2">
                <button type="button" onclick="adjustInputVal('${student.id}', 10)" class="py-1 px-2 text-xs font-bold rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors uppercase pointer-events-auto cursor-pointer">+10</button>
                <button type="button" onclick="adjustInputVal('${student.id}', 5)" class="py-1 px-2 text-xs font-bold rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors uppercase pointer-events-auto cursor-pointer">+5</button>
                <button type="button" onclick="adjustInputVal('${student.id}', -5)" class="py-1 px-2 text-xs font-bold rounded bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors uppercase pointer-events-auto cursor-pointer">-5</button>
                <button type="button" onclick="adjustInputVal('${student.id}', -10)" class="py-1 px-2 text-xs font-bold rounded bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors uppercase pointer-events-auto cursor-pointer">-10</button>
              </div>

              <input type="number" id="amt-${student.id}" placeholder="e.g. 15 or -10" required
                class="mt-2 block w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800">
            </div>

            <!-- Description Reason area -->
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">Observation Notes</label>
              <textarea id="reason-${student.id}" placeholder="Specify act, support, or disruption notes here..." rows="2" required
                class="mt-1.5 block w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 placeholder-slate-400"></textarea>
            </div>

            <!-- Parent Alert Trigger option -->
            <div class="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span class="text-xs text-slate-500 font-medium">Deliver smart alert to parent</span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="notify-${student.id}" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </form>
        </div>

        <button type="button" id="btn-${student.id}" class="submit-adj-btn mt-5 w-full bg-slate-800 hover:bg-indigo-700 text-white rounded-lg py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Record Standing Update
        </button>
      `;

      // Connect button click event directly
      card.querySelector('.submit-adj-btn').addEventListener('click', () => {
        submitPointsAdjustment(student.id, student.name);
      });

      grid.appendChild(card);
    });
  }

  function filterStudents(query) {
    const q = query.trim().toLowerCase();
    const filtered = studentsData.filter(student => student.name.toLowerCase().includes(q));
    renderStudentGrid(filtered);
  }

  // Define shortcut input adjustments
  window.adjustInputVal = function(studentId, val) {
    const input = document.getElementById(`amt-${studentId}`);
    if (input) {
      input.value = val;
    }
  };

  async function submitPointsAdjustment(studentId, studentName) {
    const inputField = document.getElementById(`amt-${studentId}`);
    const reasonField = document.getElementById(`reason-${studentId}`);
    const notifyField = document.getElementById(`notify-${studentId}`);
    const actionBtn = document.getElementById(`btn-${studentId}`);

    const pointsChange = parseInt(inputField.value, 10);
    const reason = reasonField.value.trim();
    const sendEmail = notifyField.checked;

    if (!pointsChange || isNaN(pointsChange) || pointsChange === 0) {
      showToast("Validation Error", "Please provide a non-zero adjustment amount first.", "red");
      inputField.focus();
      return;
    }

    if (!reason) {
      showToast("Validation Error", "Please record observations notes before submitting.", "red");
      reasonField.focus();
      return;
    }

    // Loading State
    actionBtn.disabled = true;
    const oldText = actionBtn.innerHTML;
    actionBtn.innerHTML = `
      <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Recording standing...
    `;

    try {
      const response = await fetch('/api/behavior/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ studentId, pointsChange, reason, sendEmail })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to commit points.");
      }

      // Success feedback
      showToast(
        pointsChange > 0 ? "Points Credited" : "Points Deducted",
        `Successfully logged ${pointsChange > 0 ? '+' : ''}${pointsChange} points code for ${studentName}.`,
        pointsChange > 0 ? "emerald" : "rose"
      );

      // Reset card input elements
      inputField.value = '';
      reasonField.value = '';
      notifyField.checked = false;

      // Reactively adjust current client score in local static data block
      const stdIdx = studentsData.findIndex(s => s.id === studentId);
      if (stdIdx !== -1) {
        studentsData[stdIdx].pointsBalance += pointsChange;
        
        // Find specific card and replace balance element instantly for ultra fluid UX
        const cardNode = document.getElementById(`student-card-${studentId}`);
        if (cardNode) {
          const balNode = cardNode.querySelector('.student-balance-val');
          if (balNode) {
            balNode.textContent = studentsData[stdIdx].pointsBalance;
          }
        }
      }

    } catch (e) {
      console.warn("Adjustment commit error:", e.message);
      showToast("Error Committing Score", e.message, "red");
    } finally {
      // Re-enable button
      actionBtn.disabled = false;
      actionBtn.innerHTML = oldText;
    }
  }


  /* =================================_________
     STUDENT PORTAL METHODS
     ========================================= */

  async function loadStudentDashboard() {
    const res = await fetch('/api/student/dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.clear();
        window.location.replace('/login.html');
        return;
      }
      throw new Error("Unable to retrieve standing records.");
    }

    const data = await res.json();
    
    // Greet text
    document.getElementById('student-name-greet').textContent = data.student.name;
    
    // Glowing balance count
    document.getElementById('display-balance-points').textContent = data.student.pointsBalance;

    // Standings tier selector & customized quote
    const tierNode = document.getElementById('points-tier-text');
    const quoteNode = document.getElementById('student-quote');
    const balVal = data.student.pointsBalance;

    if (balVal >= 200) {
      tierNode.textContent = "🥇 Paragon Behavior Tier";
      tierNode.className = "text-xs text-amber-400 font-extrabold uppercase mt-4 tracking-widest";
      quoteNode.textContent = `"Your actions inspire peers and build community. Thank you for setting an incredible standard of support and cooperation."`;
    } else if (balVal >= 120) {
      tierNode.textContent = "🥈 Leadership Role Model Tier";
      tierNode.className = "text-xs text-indigo-300 font-bold uppercase mt-4 tracking-widest";
      quoteNode.textContent = `"Pinnacle behavioral consistency. You display remarkable efforts in fostering helpful discussions and teamwork."`;
    } else if (balVal >= 80) {
      tierNode.textContent = "🥉 Active Contributor Tier";
      tierNode.className = "text-xs text-slate-300 font-semibold uppercase mt-4 tracking-widest";
      quoteNode.textContent = `"Steady participation and solid cooperation. Keep logging positive choices to rise up the standings scoreboard!"`;
    } else if (balVal >= 0) {
      tierNode.textContent = "🌱 Developing Citizen Tier";
      tierNode.className = "text-xs text-teal-300 uppercase mt-4 tracking-wider";
      quoteNode.textContent = `"Every school session is an exciting blank slate. Find opportunities today to help a peer, participate, or cooperatively reset."`;
    } else {
      tierNode.textContent = "⚠️ Academic Correction Required";
      tierNode.className = "text-xs text-rose-450 font-bold uppercase mt-4 tracking-widest animate-pulse";
      quoteNode.textContent = `"A minor delay is simply fuel for a mighty self-reflection comeback. Let's partner together with instructors to rebuild points balance."`;
    }

    renderStudentTimeline(data.logs);
  }

  function renderStudentTimeline(logs) {
    const timeline = document.getElementById('timeline-container');
    timeline.innerHTML = '';

    if (!logs || logs.length === 0) {
      document.getElementById('empty-timeline-state').classList.remove('hidden');
      return;
    } else {
      document.getElementById('empty-timeline-state').classList.add('hidden');
    }

    logs.forEach(log => {
      const isPositive = log.pointsChange > 0;
      const formattedDate = new Date(log.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const entry = document.createElement('div');
      entry.className = "relative pl-8 transition-transform hover:translate-x-1 duration-300";

      // Timeline marker bullet depending on reward/penalty status
      let bulletBg = isPositive ? "bg-emerald-500 ring-emerald-100" : "bg-rose-500 ring-rose-100";
      let textTheme = isPositive ? "text-emerald-700" : "text-rose-600";
      let pillBg = isPositive ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800";

      entry.innerHTML = `
        <!-- Left bullet dot node -->
        <span class="absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full ${bulletBg} ring-4">
          <span class="h-2 w-2 rounded-full bg-white"></span>
        </span>

        <!-- Timeline description card -->
        <div class="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm relative hover:border-slate-200 transition-colors">
          
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div class="flex items-center gap-2.5">
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${pillBg}">
                ${isPositive ? '+' : ''}${log.pointsChange} pts
              </span>
              <span class="text-xs text-slate-400 font-semibold">${formattedDate}</span>
            </div>
            
            <div class="flex items-center gap-1.5 text-slate-400 text-xs">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              <span>Logged by: <strong class="text-slate-600">${log.teacherName}</strong></span>
            </div>
          </div>

          <p class="text-slate-700 text-sm leading-relaxed">${log.reason}</p>

          <!-- Email notified badge status -->
          <div class="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center text-[11px] text-slate-400">
            <span class="flex items-center gap-1">
              ${log.parentNotified 
                ? `<svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Parent Notified`
                : `<svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg> Local Observation Only`}
            </span>
          </div>

        </div>
      `;

      timeline.appendChild(entry);
    });
  }

  /* =================================_________
     TOAST POPUP WORKSPACE HELPERS
     ========================================= */

  function showToast(title, message, themeColor = "indigo") {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toast-title');
    const toastMessage = document.getElementById('toast-message');
    const iconBox = document.getElementById('toast-icon-box');

    toastTitle.textContent = title;
    toastMessage.textContent = message;

    // Dynamic coloring of toast node
    if (themeColor === "rose" || themeColor === "red") {
      iconBox.className = "w-8 h-8 rounded-lg flex items-center justify-center bg-rose-500 text-white";
      iconBox.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    } else if (themeColor === "emerald" || themeColor === "green") {
      iconBox.className = "w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500 text-white";
      iconBox.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>`;
    } else {
      iconBox.className = "w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500 text-white";
      iconBox.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>`;
    }

    // Toggle animation classes
    toast.classList.remove('translate-y-10', 'opacity-0', 'pointer-events-none');
    toast.classList.add('translate-y-0', 'opacity-100');

    // Slide out after 4 seconds
    setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
    }, 4000);
  }

});

# 🎓 BehaviorPulse Hub

<div align="center">

**A premium school behaviour tracking and communication platform powered by Gemini AI.**

Built for scale — designed for real classrooms.

</div>

---

## ✨ Features

- 📋 **Student Roster Management** — Add, import, filter, and organize students by class
- 📈 **Points-based Behavior Tracking** — Log positive and corrective behavioral adjustments
- 🤖 **AI-Powered Communication** — Gemini-powered observation polishing and email generation
- 📧 **Multi-Recipient Email Dispatch** — Notify parents, deputies, and principals simultaneously
- 🏫 **Multi-School Tenancy** — Super admin panel to manage multiple school accounts
- 📊 **Analytics Dashboard** — Charts, behavior logs, and AI counselor reflections
- 🔔 **Background Email Queue** — Non-blocking async dispatch with full audit trails
- 🔒 **Role-Based Access Control** — Teacher, Deputy, Principal, Super Admin, and Student portals

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- A [Gemini API Key](https://aistudio.google.com/app/apikey) (free tier works)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/lucynguresky-oss/behaviour-pulse.git
cd behaviour-pulse

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Then open .env.local and fill in your keys:
# GEMINI_API_KEY=your_key_here
# SMTP_HOST, SMTP_USER, SMTP_PASS (optional)

# 4. Start the dev server
npm run dev
```

Visit **http://localhost:5174** in your browser.

---

## 🔑 Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Teacher | `teacher@pulse.com` | `BarakaNgureNjihia` |
| Principal | `principal@pulse.com` | `BarakaNgureNjihia` |
| Deputy | `deputy@pulse.com` | `BarakaNgureNjihia` |
| Super Admin | `superadmin@pulse.com` | `BarakaNgureNjihia` |
| Student (Alice) | `student1@pulse.com` | `BarakaNgureNjihia` |

> **Note:** The app uses a local JSON database in development mode. No MongoDB required for local testing.

---

## 📁 Project Structure

```
├── routes/          # Express API route handlers
│   ├── auth.js      # Login & JWT
│   ├── behavior.js  # Behavior log recording, email dispatch
│   ├── student.js   # Student CRUD & roster importer
│   ├── school.js    # Multi-tenant school management
│   └── ai.js        # Gemini AI endpoints
├── models/          # Mongoose schemas & local DB wrappers
├── utils/
│   ├── emailService.js    # SMTP dispatch, Ethereal fallback
│   ├── emailLogStore.js   # Email audit log store
│   └── dbStore.js         # Local JSON database engine
├── src/             # React frontend (TypeScript + Vite)
│   └── App.tsx      # Main SPA application
├── config/
│   └── db.js        # MongoDB / local mode switcher
└── server.js        # Express entry point with Vite HMR
```

---

## 🏗️ Architecture Notes

### Background Email Queue
Email dispatch is decoupled from the behavior logging API. When a teacher records a behavioral update, the HTTP response is returned instantly (<30ms). Email composition, AI polishing, and SMTP delivery run asynchronously in the background.

### Database Strategy
- **Development:** Uses `database.json` (local JSON file). Zero config required.
- **Production:** Connect MongoDB via the `MONGODB_URI` environment variable.

### React Performance Optimizations
- `filteredStudents`, `sortedStudents`, and audit log computations are wrapped in `useMemo` and `useCallback` hooks to eliminate keystroke lag on large rosters (1000+ students).

---

## 🌐 Production Deployment

```bash
npm run build && npm start
```

Or via Docker:

```bash
docker-compose up --build
```

---

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Recommended |
| `MONGODB_URI` | MongoDB connection string | Production only |
| `JWT_SECRET` | Secret for signing JWT tokens | Yes |
| `SMTP_HOST` | SMTP server hostname | Optional |
| `SMTP_PORT` | SMTP server port (default 587) | Optional |
| `SMTP_USER` | SMTP username/email | Optional |
| `SMTP_PASS` | SMTP password/app password | Optional |

> Without SMTP credentials, emails are dispatched to an **Ethereal sandbox** — view them in the Email Dispatch Log panel inside the app.

---

## 📄 License

MIT © BehaviorPulse

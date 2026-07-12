import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { connectDB } from './config/db.js';
import { initLocalDb } from './utils/dbStore.js';

// Route Imports
import authRouter from './routes/auth.js';
import studentRouter from './routes/student.js';
import behaviorRouter from './routes/behavior.js';
import aiRouter from './routes/ai.js';
import schoolRouter from './routes/school.js';

// Load .env.local first (local dev credentials), then .env as fallback
dotenv.config({ path: '.env.local' });
dotenv.config();

const PORT = process.env.PORT || 5174;

// ─── Allowed origins ──────────────────────────────────────────────────────────
// Any additional frontend domains (e.g. custom domains) can be added here.
const ALLOWED_ORIGINS = [
  // GitHub Pages deployment
  'https://lucynguresky-oss.github.io',
  // Local development
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:3001',
  // Allow the Render domain itself (for in-page previews)
  'https://behaviour-pulse.onrender.com',
];

async function startServer() {
  const app = express();

  // ─── CORS — must be registered BEFORE all routes ────────────────────────────
  // Allows the GitHub Pages frontend to call this API without browser blocks.
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow server-to-server calls (no Origin header) and whitelisted origins
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          console.warn(`[CORS] Blocked request from origin: ${origin}`);
          callback(new Error(`Origin "${origin}" is not allowed by CORS policy.`));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  // Setup Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Seed/Initialize local fallback database files
  initLocalDb();

  // 1. Register Web API endpoints
  app.use('/api/auth', authRouter);
  app.use('/api/behavior', behaviorRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api', studentRouter);
  app.use('/api/admin', schoolRouter);

  // 2. Backward compatibility redirect to React app
  app.get('/login.html', (req, res) => {
    res.redirect('/');
  });
  app.get('/dashboard.html', (req, res) => {
    res.redirect('/');
  });

  // Serve static resources from physical public folder if requested specifically (e.g. css placeholder fallback)
  const publicPath = path.resolve('public');
  app.use(express.static(publicPath));

  // 3. Integrate Vite as middleware for development / SPA routing in production
  if (process.env.NODE_ENV !== "production") {
    console.log("🛠️  Running in DEVELOPMENT mode - Mounting Vite HMR middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("📦 Running in PRODUCTION mode - Serving pre-built static bundle...");
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Broad error handler middleware
  app.use((err, req, res, next) => {
    console.error("Unhandled Global Server Error:", err.stack);
    res.status(500).json({ error: "A server-side error occurred inside BehaviorPulse." });
  });

  // Connect database and bind port
  await connectDB();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`🔥 BehaviorPulse Core Running on Host: http://0.0.0.0:${PORT}`);
    console.log(`🚀 Single Page App router loaded. Access via browser.`);
    console.log(`=========================================`);
  });
}

startServer();

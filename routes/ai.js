import express from 'express';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import { verifyToken, requireRole, requireAnyRole } from './auth.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const router = express.Router();

// Treat placeholder/missing keys as "no key" so we fall back gracefully
const rawKey = process.env.GEMINI_API_KEY || '';
const isRealKey = rawKey.length > 10 && !rawKey.includes('your_gemini') && !rawKey.includes('MY_GEMINI');

let ai = null;
try {
  if (isRealKey) {
    ai = new GoogleGenAI({
      apiKey: rawKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  } else {
    console.warn("⚠️ GEMINI_API_KEY is not defined in backend env. AI aspects will run in Demo mode.");
  }
} catch (err) {
  console.error("❌ Failed to initialize GoogleGenAI:", err.message);
}

// Text-based sentiment detector — works correctly even before points are entered
function detectSentiment(text = '', changeNum = 0) {
  const t = text.toLowerCase();
  const positiveWords = [
    'help', 'assist', 'excellent', 'great', 'good', 'kind', 'leader', 'participat',
    'volunteer', 'respect', 'attentive', 'focus', 'effort', 'improv', 'achiev',
    'polite', 'cooperat', 'support', 'engag', 'contribut', 'honest', 'punctual',
    'creative', 'bright', 'outstanding', 'fantastic', 'wonderful', 'praise',
    'commend', 'pass', 'succeed', 'calm', 'patient', 'listen', 'motivat'
  ];
  const negativeWords = [
    'sleep', 'slept', 'caught', 'disrupt', 'fight', 'argue', 'late', 'absent',
    'miss', 'rude', 'bully', 'cheat', 'phone', 'distract', 'ignore', 'refuse',
    'fail', 'aggressive', 'disrespect', 'misbehav', 'wander', 'skip', 'tardy',
    'inattentive', 'shout', 'threw', 'broke', 'damage', 'stole', 'lied', 'left'
  ];
  const posScore = positiveWords.filter(w => t.includes(w)).length;
  const negScore = negativeWords.filter(w => t.includes(w)).length;
  if (posScore > negScore) return 'positive';
  if (negScore > posScore) return 'negative';
  return changeNum > 0 ? 'positive' : changeNum < 0 ? 'negative' : 'neutral';
}

// Robust content generation helper with automatic model fallback to handle quota limits (429) and model deprecations
async function generateContentWithFallback(prompt, config = {}) {
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'];
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`Attempting content generation using model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config
      });
      if (response && response.text) {
        return { text: response.text, model };
      }
    } catch (err) {
      console.warn(`⚠️ Model ${model} failed:`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error("All fallback models failed to generate content.");
}

// Smart local observation refiner for high-fidelity fallback when Gemini is unavailable or rate-limited
export function localRefineObservation(reason, pointsChange, studentName = '') {
  const changeNum = parseInt(pointsChange, 10) || 0;
  
  // Basic sentiment detection
  const t = reason.toLowerCase();
  const positiveWords = [
    'help', 'assist', 'excellent', 'great', 'good', 'kind', 'leader', 'participat',
    'volunteer', 'respect', 'attentive', 'focus', 'effort', 'improv', 'achiev',
    'polite', 'cooperat', 'support', 'engag', 'contribut', 'honest', 'punctual',
    'creative', 'bright', 'outstanding', 'fantastic', 'wonderful', 'praise',
    'commend', 'pass', 'succeed', 'calm', 'patient', 'listen', 'motivat', 'number 1', 'number one'
  ];
  const negativeWords = [
    'sleep', 'slept', 'caught', 'disrupt', 'fight', 'argue', 'late', 'absent',
    'miss', 'rude', 'bully', 'cheat', 'phone', 'distract', 'ignore', 'refuse',
    'fail', 'aggressive', 'disrespect', 'misbehav', 'wander', 'skip', 'tardy',
    'inattentive', 'shout', 'threw', 'broke', 'damage', 'stole', 'lied', 'left'
  ];
  const posScore = positiveWords.filter(w => t.includes(w)).length;
  const negScore = negativeWords.filter(w => t.includes(w)).length;
  const sentiment = posScore > negScore ? 'positive' : (negScore > posScore ? 'negative' : (changeNum > 0 ? 'positive' : (changeNum < 0 ? 'negative' : 'neutral')));

  const cleanReason = reason.trim().replace(/^["']|["']$/g, '');
  const nameLabel = studentName || 'the student';
  const nameLabelCap = studentName || 'The student';
  
  // Diverse vocabulary mapping to rephrase common raw phrases constructively
  const vocabulary = {
    "was caught sleeping": "struggling to remain alert during class instruction",
    "sleeping in class": "resting during active instruction time",
    "sleeping": "resting during instruction time",
    "talking": "conversing with peers during quiet study",
    "disruptive": "showing restless behavior during group work",
    "was number 1": "demonstrating outstanding peer leadership and excellence",
    "number 1": "exceptional leadership and dedication",
    "good job": "commendable effort and focus",
    "great work": "excellent dedication to the lesson task",
    "helping": "collaborating and assisting classmates",
    "helped": "providing valuable support to classmates",
    "fighting": "engaging in peer conflict",
    "late": "arriving after the morning bell"
  };
  
  let processedReason = cleanReason;
  const lowerReason = cleanReason.toLowerCase();
  
  // Rephrase common expressions if found
  for (const key in vocabulary) {
    if (lowerReason.includes(key)) {
      const regex = new RegExp(key, 'gi');
      processedReason = processedReason.replace(regex, vocabulary[key]);
      break; // apply one major rephrasing
    }
  }
  
  // Casing adjustment: if processedReason starts with uppercase but is injected, lowercase the first letter unless it's a proper noun
  let startsWithUpper = /^[A-Z]/.test(processedReason);
  let lowercaseReason = processedReason;
  if (startsWithUpper && !processedReason.startsWith("Mr.") && !processedReason.startsWith("Ms.") && !processedReason.startsWith("Dr.")) {
    lowercaseReason = processedReason.charAt(0).toLowerCase() + processedReason.slice(1);
  }

  // Grammatically clean up leading verbs to avoid "was was" or "by was" constructions
  const lowercaseReasonClean = lowercaseReason.toLowerCase();
  
  // 1. Phrasing for injecting after "was" (e.g. noting that student was <reasonAfterWas>)
  // If reason starts with "was ", strip it to prevent "was was"
  const reasonAfterWas = lowercaseReasonClean.startsWith("was ")
    ? lowercaseReason.slice(4)
    : lowercaseReason;

  // 2. Phrasing for injecting after "by" (e.g. showed commendable character today by <reasonAfterBy>)
  // If reason starts with "was ", convert to "being " to fit "by being ..."
  const reasonAfterBy = lowercaseReasonClean.startsWith("was ")
    ? "being " + lowercaseReason.slice(4)
    : lowercaseReason;

  // Positive templates
  const positiveTemplates = [
    `${nameLabelCap} showed commendable character today by ${reasonAfterBy}. This constructive contribution is highly appreciated in our classroom community.`,
    `We want to acknowledge the excellent qualities demonstrated today: "${processedReason}". This positive attitude helps build a supportive and focused learning environment for ${nameLabel}.`,
    `The teacher recorded a stellar observation today noting that ${nameLabel} was ${reasonAfterWas}. We encourage them to keep up this exemplary standard.`
  ];
  
  // Negative/Correction templates
  const negativeTemplates = [
    `A classroom observation noted that ${nameLabel} was ${reasonAfterWas}. We view this as an opportunity for constructive reflection and growth, and we are here to support them in building better habits.`,
    `Today's observation recorded that ${nameLabel} was ${reasonAfterWas}. We appreciate your partnership in encouraging them to refocus and cooperate with classroom expectations.`,
    `The teacher noted an area for guidance today: "${processedReason}". This is a valuable learning moment to help ${nameLabel} develop stronger self-management and community skills.`
  ];
  
  // Neutral templates
  const neutralTemplates = [
    `The teacher recorded the following classroom observation: "${processedReason}". This has been logged for tracking character development and progress of ${nameLabel}.`,
    `A behavioral observation has been recorded: "${processedReason}". We appreciate the continued home-school partnership in supporting ${nameLabel}'s development.`,
    `The student's behavioral record has been updated with the following observation for ${nameLabel}: "${processedReason}".`
  ];
  
  // Select a template based on sentiment
  const templates = sentiment === 'positive' ? positiveTemplates : (sentiment === 'negative' ? negativeTemplates : neutralTemplates);
  // Pick one template deterministically based on the length of the reason to keep it stable but diverse
  const templateIndex = cleanReason.length % templates.length;
  return templates[templateIndex];
}

// POST /api/ai/refine
// Polishes a raw observation reason into a pedagogically constructive parent email or report.
router.post('/refine', verifyToken, requireRole('teacher'), async (req, res) => {
  const { reason, pointsChange, studentName } = req.body;
  if (!reason) {
    return res.status(400).json({ error: "Please provide the raw observation notes to refine." });
  }

  const changeNum = parseInt(pointsChange, 10) || 0;
  const nameLabel = studentName || 'the student';

  if (!ai) {
    const refined = localRefineObservation(reason, changeNum, studentName);
    return res.json({ refined, model: 'local-fallback-refiner' });
  }

  try {
    const sentiment = detectSentiment(reason, changeNum);
    const state = sentiment === 'positive' ? "positive reinforcement reward" : "correction instruction notice";

    const prompt = `
      You are a professional school counselor and empathetic educator. 
      A teacher is submitting a behavior log for student ${nameLabel}. They wrote a raw note. 
      Polish this raw note to make it look extremely constructive, supportive, objective, and clear. 
      ${studentName ? `Refer to the student by their name "${nameLabel}" naturally.` : `Refer to the student as "${nameLabel}" naturally.`}
      Keep it professional, empathetic, and encouraging for parent-school partnerships. 
      Do NOT mention grades, only discuss character, cooperation, and participation.
      
      Observation sentiment: ${sentiment} (${state}).
      Raw teacher observations: "${reason}"
      
      Provide ONLY the polished commentary paragraph. No greetings, no signature, and no other meta text. Length: 2 to 4 sentences.
    `;

    const result = await generateContentWithFallback(prompt);

    const refinedText = result.text
      ? result.text.trim().replace(/^"|"$/g, '')
      : localRefineObservation(reason, changeNum, studentName);
      
    return res.json({ refined: refinedText, model: result.model });

  } catch (error) {
    console.error('Gemini refine query error after trying all fallbacks:', error.message);
    const fallback = localRefineObservation(reason, changeNum, studentName);
    return res.json({ refined: fallback, model: 'local-fallback-refiner' });
  }
});

// POST /api/ai/reflection
// Generates personalized coaching, reflections, and weekly guidance for students based on point history.
router.post('/reflection', verifyToken, async (req, res) => {
  const { name, pointsBalance, logs } = req.body;

  if (!ai) {
    const fallback = `Wonderful job maintaining your points at ${pointsBalance || 0} pts! Keep collaborating, participating in class, and showing kindness to everyone at school. You are on a fantastic track!`;
    return res.json({ advice: fallback, model: 'demo-simulator' });
  }

  try {
    const logsBrief = (logs || []).slice(0, 5).map(l => 
      `- ${l.pointsChange > 0 ? '+' : ''}${l.pointsChange} points: "${l.reason}"`
    ).join('\n');

    const prompt = `
      You are "PulseAdvisor", an encouraging, nonjudgmental AI school counselor. 
      Analyze the current points status and timeline of this student to generate personalized encouragement and clear actionable growth goals for the week.
      
      Student Name: ${name}
      Current Points Balance: ${pointsBalance} points
      Recent Behavioral Logs:
      ${logsBrief || "No logs recorded yet."}
      
      Tone requirements:
      - Highly positive, empathetic, psychological, and motivating.
      - Speak directly to the student or parent.
      - Identify their strengths and offer exactly 1 or 2 small constructive, positive goals to earn more rewards.
      - Keep the total response short and sweet (under 150 words). Provide ONLY the response. No headings or intro/outro signatures.
    `;

    const result = await generateContentWithFallback(prompt);

    const advice = result.text ? result.text.trim() : "Keep doing your absolute best! Your path to growth is built of minor daily steps.";
    return res.json({ advice, model: result.model });

  } catch (error) {
    console.error('Gemini reflection query error after trying all fallbacks:', error.message);
    const advice = `You're doing wonderfully, ${name || 'student'}! With ${pointsBalance || 0} points, you are on a strong path. Keep showing up with a positive attitude — your teachers and community believe in you!`;
    return res.json({ advice, model: 'fallback-template' });
  }
});

// Helper function to parse roster text locally using string parsing and regex fallbacks
function localParseRoster(rawText) {
  const lines = rawText.split('\n');
  const students = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    
    // 1. Strip leading list numbers, brackets, bullets, or dashes: e.g., "1.", "2)", "[3]", "- ", "* ", "• "
    line = line.replace(/^\s*[\[({]?\d+[\s.)\-\]]+\s*/, '').replace(/^[\s\-*+•]+\s*/, '').trim();
    if (!line) continue;
    
    // 2. Extract email using regex
    const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    let email = '';
    if (emailMatch) {
      email = emailMatch[0];
      line = line.replace(email, '').trim();
    }
    
    // 3. Extract starting points balance (e.g. "starting balance 12 pts", "starts with 45 points", "12 pts", "10 points", "starts with 50 p...")
    // This regex matches points, trailing 'p' or 'points', and any trailing dots '...'
    const pointsPhraseMatch = line.match(/(?:starting\s+balance|starts\s+with|has|balance|starting)?\s*([-+]?\d+)\s*(?:points|point|pts|pt|p)?\s*\.*$/i) || 
                             line.match(/(?:starting\s+balance|starts\s+with|has|balance|starting)?\s*([-+]?\d+)\s*(?:points|point|pts|pt|p)?/i);
    let pointsBalance = 0;
    if (pointsPhraseMatch) {
      const num = parseInt(pointsPhraseMatch[1], 10);
      if (!isNaN(num)) {
        pointsBalance = num;
        // Remove the entire points phrase from the line
        line = line.replace(pointsPhraseMatch[0], '').trim();
      }
    }
    
    // 4. Extract and clean name: remove empty parentheses, and strip leading/trailing dots, commas, dashes, spaces
    let name = line.replace(/[()]/g, '').replace(/^[,;:\-\s.]+|[,;:\-\s.]+$/g, '').trim();
    
    // Fallbacks
    if (!name) {
      if (email) {
        name = email.split('@')[0].split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
      } else {
        continue; // Skip invalid lines
      }
    }
    
    if (!email) {
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      email = `${cleanName || 'student.' + Math.floor(Math.random() * 1000)}@pulse.com`;
    }
    
    students.push({
      name,
      email,
      pointsBalance
    });
  }
  
  return students;
}

// POST /api/ai/parse-roster (Teachers, Deputies, Principals)
// Uses Gemini to parse a freeform list of students into a list of structured student profiles (name, email, pointsBalance)
router.post('/parse-roster', verifyToken, requireAnyRole(['teacher', 'deputy', 'principal']), async (req, res) => {
  const { rawText } = req.body;
  if (!rawText) {
    return res.status(400).json({ error: "Please provide a raw student or roster text to parse." });
  }

  if (!ai) {
    // Elegant simulation fallback if API key is missing
    const fallbackList = localParseRoster(rawText);
    if (fallbackList.length > 0) {
      return res.json({ 
        students: fallbackList, 
        model: 'local-fallback-parser',
        warning: "Running in Demo Mode. Used local parsing engine to extract profiles successfully." 
      });
    }
    
    const defaultList = [
      { name: "Demo Student A", email: "demo.student.a@school.com", pointsBalance: 10 },
      { name: "Demo Student B", email: "demo.student.b@school.com", pointsBalance: 20 },
    ];
    return res.json({ 
      students: defaultList, 
      model: 'demo-simulator',
      warning: "Running in Demo Mode. Connect GEMINI_API_KEY to enable full natural language roster importing." 
    });
  }

  try {
    const prompt = `
      You are an expert administrative school assistant AI. 
      The teacher has provided a raw, freeform text or list of students whom they want to add to the roster.
      Parse this text and extract all individual students with their name, email, and optionally their starting points balance.
      
      Raw text inputs:
      "${rawText}"
      
      Rules:
      1. Correct common name formatting. Ensure names are capitalized professionally.
      2. If an email is omitted or malformed, generate a clean, school-domain email like "firstname.lastname@pulse.com" or "student.[random-digits]@pulse.com".
      3. For starting points balance (pointsBalance), default to 0 if not specified. If points are mentioned (e.g. "+10", "10 points", "starting with 15 pts", "has 20 pts"), extract that integer value.
      4. Return ONLY a valid JSON array of objects.
      5. Each object in the array MUST contain EXACTLY three fields:
         - "name": string
         - "email": string
         - "pointsBalance": integer (default 0)
      6. Do NOT include markdown blocks (\`\`\`json or \`\`\`), do NOT include other explanatory text. Return ONLY raw valid JSON text.
    `;

    const result = await generateContentWithFallback(prompt, {
      responseMimeType: "application/json",
    });

    const parsedText = result.text ? result.text.trim() : "[]";
    let students = [];
    try {
      students = JSON.parse(parsedText);
      if (!Array.isArray(students)) {
        students = [];
      }
    } catch (parseErr) {
      console.error("JSON parsing error of AI response:", parseErr.message, parsedText);
      const cleaned = parsedText.replace(/```json/g, '').replace(/```/g, '').trim();
      try { students = JSON.parse(cleaned); } catch { students = []; }
    }

    return res.json({ students, model: result.model });

  } catch (error) {
    console.error('Gemini roster parsing error after trying all fallbacks:', error.message);
    
    // Fallback to local parsing engine so it never fails the user
    try {
      const students = localParseRoster(rawText);
      if (students.length > 0) {
        return res.json({ 
          students, 
          model: 'local-fallback-parser',
          warning: 'Gemini API is temporarily rate-limited. Used local parsing engine to extract profiles successfully.'
        });
      }
    } catch (fallbackErr) {
      console.error('Local fallback parser error:', fallbackErr.message);
    }

    return res.json({
      students: [],
      model: 'fallback-template',
      warning: 'AI roster parsing is temporarily unavailable. Please add students manually using the form below.'
    });
  }
});

export default router;

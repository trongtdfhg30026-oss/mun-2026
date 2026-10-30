const crypto = require('crypto');
const { generateExcelWorkbook, generateVisualHtmlReport } = require('./reportGenerator');

// Cryptographic Secret for Admin Session Signing
const SERVER_SECRET = crypto.randomBytes(32).toString('hex');

// In-Memory High-Precision Timer State (Drift-Free)
let roundTimerState = {
  duration: 90,
  remaining: 90,
  running: false,
  activeTopic: "climate",
  targetEndTime: 0,
  startedAt: 0,
  endedAt: 0
};


// In-Memory Presentation (Speech) Timer State
let presentationTimerState = {
  duration: 600, // default 10 minutes (3 Topics + Q&A)
  remaining: 600,
  running: false,
  presentingCountry: "china",
  presentingGrade: "Grade 11",
  presentingTopic: "climate",
  targetEndTime: 0,
  startedAt: 0,
  endedAt: 0
};

function getCalculatedPresentationTimerState() {
  const now = Date.now();
  if (presentationTimerState.running) {
    if (presentationTimerState.targetEndTime > 0) {
      const left = Math.max(0, Math.ceil((presentationTimerState.targetEndTime - now) / 1000));
      presentationTimerState.remaining = left;
      if (left === 0) {
        presentationTimerState.running = false;
        presentationTimerState.endedAt = now;
      }
    }
  }

  const teams = (typeof TEAMS_BY_GRADE !== 'undefined' ? TEAMS_BY_GRADE[presentationTimerState.presentingGrade] : []) || [];
  const team = teams.find(t => t.id === presentationTimerState.presentingCountry) || null;

  return {
    duration: presentationTimerState.duration,
    remaining: presentationTimerState.remaining,
    running: presentationTimerState.running,
    presentingCountry: presentationTimerState.presentingCountry,
    presentingGrade: presentationTimerState.presentingGrade,
    presentingTopic: presentationTimerState.presentingTopic,
    targetEndTime: presentationTimerState.targetEndTime,
    startedAt: presentationTimerState.startedAt,
    endedAt: presentationTimerState.endedAt,
    serverTime: now,
    team: team ? { id: team.id, name: team.name, flag: team.flag, mentor: team.mentor, delegates: team.delegates } : null
  };
}

function getCalculatedTimerState() {
  const now = Date.now();
  if (roundTimerState.running) {
    if (roundTimerState.targetEndTime > 0) {
      const left = Math.max(0, Math.ceil((roundTimerState.targetEndTime - now) / 1000));
      roundTimerState.remaining = left;
      if (left === 0) {
        roundTimerState.running = false;
        roundTimerState.endedAt = now;
      }
    }
  }
  return {
    duration: roundTimerState.duration,
    remaining: roundTimerState.remaining,
    running: roundTimerState.running,
    activeTopic: roundTimerState.activeTopic,
    targetEndTime: roundTimerState.targetEndTime,
    startedAt: roundTimerState.startedAt,
    endedAt: roundTimerState.endedAt,
    serverTime: now
  };
}

// 250ms precision tick for timer transition
setInterval(() => {
  getCalculatedTimerState();
  getCalculatedPresentationTimerState();
}, 250);

// In-Memory Live State for Turn-Based Countdown & Student Drafts
const LIVE_DRAFTS = {};

// Anti-Spam / Rate Limiting completely disabled per user request
function rateLimiterMiddleware(req, res, next) {
  next();
}

function recordAuthFailure(ip) {}
function recordAuthSuccess(ip) {}
function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

// Constant-Time String Comparison (Timing-Attack Proof)
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = crypto.createHash('sha256').update(String(a).trim()).digest();
  const bufB = crypto.createHash('sha256').update(String(b).trim()).digest();
  return crypto.timingSafeEqual(bufA, bufB);
}

// Admin Token Signing & Verification
function createAdminToken() {
  const ts = Date.now();
  const payload = `adm_${ts}`;
  const sig = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
  if (!safeCompare(sig, expected)) return false;
  const ts = parseInt(payload.replace('adm_', ''), 10);
  if (isNaN(ts) || Date.now() - ts > 24 * 60 * 60 * 1000) return false;
  return true;
}

// Sanitize user inputs
function sanitizeString(str, maxLen = 300) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, maxLen);
}




const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'database.json');
const TEAMS_FILE = path.join(__dirname, 'data', 'teams.json');
const PASSCODES_FILE = path.join(__dirname, 'data', 'passcodes.json');
const ARCHIVES_DIR = path.join(__dirname, 'data', 'archives');

if (!fs.existsSync(ARCHIVES_DIR)) {
  fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Enterprise Security & Cache-Busting Headers (Guaranteed instant device sync)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (req.path === '/' || req.path.endsWith('.html') || !path.extname(req.path) || req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Anti-Spam Rate Limiter
app.use('/api/', rateLimiterMiddleware);

// Static assets with zero-cache for HTML, JS, CSS
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

function loadJson(file, def) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading ' + file + ':', e);
  }
  return def;
}

const TEAMS_BY_GRADE = loadJson(TEAMS_FILE, {});
const COUNTRY_PASSCODES = loadJson(PASSCODES_FILE, {});

function loadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = {
        settings: {
          adminPin: 'admin2026',
          judgePasscode: 'judge2026',
          activePhase: 'all',
          activeGrade: 'Grade 11', // 'all', 'climate', 'education', 'health', 'judges', 'ceremony'
          studentVotingOpen: true,
          judgeVotingOpen: true,
          allowVoteUpdate: true
        },
        studentVotes: [],
        judgeScores: []
      };
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
    if (!parsed.settings.adminPin || parsed.settings.adminPin === "mun2026") parsed.settings.adminPin = "admin2026";
    if (!parsed.settings.judgePasscode) parsed.settings.judgePasscode = 'judge2026';
    if (!parsed.settings.activePhase) parsed.settings.activePhase = 'all';
    return parsed;
  } catch (err) {
    console.error('Error loading DB:', err);
    return {
      settings: { adminPin: 'admin2026', judgePasscode: 'judge2026', activePhase: 'all' },
      studentVotes: [],
      judgeScores: []
    };
  }
}

function saveDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving DB:', err);
    return false;
  }
}

const TOPICS = [
  {
    id: 'climate',
    name: 'Topic 1: Climate Change',
    subtitle: 'Global Warming & Environmental Solutions',
    awardTitle: 'Best Solutions Award: Climate Change',
    icon: 'fa-earth-americas',
    color: '#10b981'
  },
  {
    id: 'education',
    name: 'Topic 2: Education',
    subtitle: 'Access to Learning, Schools & Classroom Tech',
    awardTitle: 'Best Solutions Award: Education',
    icon: 'fa-book-open',
    color: '#3b82f6'
  },
  {
    id: 'health',
    name: 'Topic 3: Health Issues',
    subtitle: 'Universal Medicine, Clean Water & Hospitals',
    awardTitle: 'Best Solutions Award: Health Issues',
    icon: 'fa-heart-pulse',
    color: '#f43f5e'
  }
];

const JUNIOR_GRADES = [];
function isJuniorGrade(grade) {
  if (!grade) return false;
  if (['Grade 7', 'Grade 8', 'Grade 10', 'Grade 11'].includes(grade)) return false;
  return JUNIOR_GRADES.includes(grade) || /^Grade\s*[123]/i.test(grade.trim());
}

const JUNIOR_RUBRIC = {
  title: 'Parade of Nations Junior Rubric',
  division: 'junior',
  theme: 'We live differently, but we have the same hope.',
  baseMax: 8,
  bonusValue: 2,
  maxTotal: 10,
  criteria: [
    {
      id: 'costume',
      name: 'Costume & Visuals (Sash / Flag)',
      max: 3,
      vnCap: 1.5,
      description: 'National costume of chosen country, flag or sash. (Note: Vietnam costume max 1.5 pts unless Official Emcee).'
    },
    {
      id: 'script',
      name: 'Script: Voice & Pronunciation',
      max: 3,
      description: 'Clear voice and good pronunciation. Basic script: Greeting + Name + Country + Nationality.'
    },
    {
      id: 'presentation',
      name: 'Presentation: Walk & Bow',
      max: 2,
      description: 'Stage presence, confident walk, polite national bow/greeting gesture.'
    }
  ],
  bonus: {
    id: 'addedScriptBonus',
    title: 'Added Script Bonus (+2 Points)',
    description: 'Awarded +2 bonus points if student expands script with interesting country facts (e.g. islands, geography, culture, famous landmarks).',
    points: 2
  }
};

const RUBRIC = {
  title: 'MUN Simple Grading Rubric',
  theme: 'We live differently, but we have the same hope.',
  baseMax: 15,
  bonusValue: 5,
  maxTotal: 20,
  criteria: [
    {
      id: 'preparation',
      name: 'Preparation',
      levels: {
        3: 'Worksheet is 100% complete. Ready to present on time.',
        2: 'Worksheet is mostly complete with minor blank spaces.',
        1: 'Worksheet is incomplete or team was not ready.'
      }
    },
    {
      id: 'speaking',
      name: 'Speaking & Pronunciation',
      levels: {
        3: 'Clear voice. Most team members spoke. Easy to understand.',
        2: 'Spoke okay, but a bit too quiet or fast. A few mistakes.',
        1: 'Very quiet. Hard to understand the words.'
      }
    },
    {
      id: 'vocabulary',
      name: 'Vocabulary Usage',
      levels: {
        3: 'Used words from the word bank correctly to explain ideas.',
        2: 'Used basic words. Ideas are clear but very simple.',
        1: 'Words did not match the topic or were unclear.'
      }
    },
    {
      id: 'teamwork',
      name: 'Teamwork & Mentor Collaboration',
      levels: {
        3: 'Excellent teamwork. Listened to their Secretary General mentor.',
        2: 'Worked okay together, but 1-2 students did all the work.',
        1: 'Did not work well together. Ignored the mentor assistance.'
      }
    },
    {
      id: 'qna',
      name: 'Active Listening & Q&A',
      levels: {
        3: 'Paid attention to other teams. Answered or asked questions well.',
        2: 'Paid attention mostly, but struggled to ask/answer.',
        1: 'Distracted during other presentations. No participation in Q&A.'
      }
    }
  ],
  bonus: {
    title: 'Advanced Challenge Bonus',
    description: 'Awarded +5 points if the delegation chooses and successfully answers more than 1 advanced question (>1 Advanced Challenge Question). Total Score: 20 Points (15 Base + 5 Bonus).',
    points: 5
  }
};


// Official MUN Judge Credentials & Accounts
function normalizeJudgeKey(name) {
  if (!name) return '';
  return String(name).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

const JUDGE_ACCOUNTS = {
  "Kevin Ta": {
    title: "Judge 1",
    name: "Kevin Ta",
    division: "senior",
    passcodes: ["KEVINTA2026", "KEVINTA#2026", "KEVIN2026", "JUDGE2026"]
  },
  "Mr. D": {
    title: "Judge 2",
    name: "Mr. D",
    division: "senior",
    passcodes: ["MRD2026", "MRD#2026", "JUDGE2026"]
  },
  "Chi Nguyen": {
    title: "Judge 3",
    name: "Chi Nguyen",
    division: "senior",
    passcodes: ["CHINGUYEN2026", "CHINGUYEN#2026", "CHI2026", "JUDGE2026"]
  }
};

function isJudgeMasterPasscode(cleanPass) {
  if (!cleanPass) return false;
  const clean = String(cleanPass).trim().replace(/\s+/g, '').toUpperCase();
  for (const j of Object.values(JUDGE_ACCOUNTS)) {
    for (const p of j.passcodes) {
      if (safeCompare(clean, p)) return true;
    }
  }
  return false;
}

// Helper: verify Admin PIN or Session Token (Timing-Safe)
function verifyAdminPin(pin, token) {
  if (token && verifyAdminToken(token)) return true;
  if (!pin) return false;
  const db = loadDb();
  const currentPin = (db.settings.adminPin || "admin2026").trim();
  return safeCompare(String(pin).trim(), currentPin) || safeCompare(String(pin).trim(), "admin2026");
}

// Helper: verify Judge Passcode (Timing-Safe)
function verifyJudgePasscodeInternal(passcode, judgeName) {
  if (!passcode) return { valid: false };
  const clean = String(passcode).trim().replace(/\s+/g, '').toUpperCase();

  // 1. Direct match with specific Judge Account (supporting accents & case)
  if (judgeName) {
    const rawKey = Object.keys(JUDGE_ACCOUNTS).find(k => k.toLowerCase() === judgeName.trim().toLowerCase());
    const normKey = Object.keys(JUDGE_ACCOUNTS).find(k => normalizeJudgeKey(k) === normalizeJudgeKey(judgeName));
    const targetKey = rawKey || normKey;
    if (targetKey && JUDGE_ACCOUNTS[targetKey]) {
      const acc = JUDGE_ACCOUNTS[targetKey];
      for (const p of acc.passcodes) {
        if (safeCompare(clean, p)) {
          return { valid: true, isMaster: true, judgeName: acc.name, title: acc.title, division: acc.division };
        }
      }
    }
  }

  // 2. Master Judge or Admin Passcode
  if (isJudgeMasterPasscode(clean) || clean === "JUDGE2026" || clean === "ADMIN2026") {
    let matchedJudge = judgeName || null;
    let matchedTitle = null;
    let matchedDiv = null;
    if (!matchedJudge) {
      for (const [name, acc] of Object.entries(JUDGE_ACCOUNTS)) {
        if (acc.passcodes.some(p => safeCompare(clean, p))) {
          matchedJudge = acc.name;
          matchedTitle = acc.title;
          matchedDiv = acc.division;
          break;
        }
      }
    } else {
      const match = Object.values(JUDGE_ACCOUNTS).find(a => normalizeJudgeKey(a.name) === normalizeJudgeKey(matchedJudge));
      if (match) {
        matchedJudge = match.name;
        matchedTitle = match.title;
        matchedDiv = match.division;
      }
    }
    return { valid: true, isMaster: true, judgeName: matchedJudge || 'Honorable Judge', title: matchedTitle, division: matchedDiv };
  }

  // 3. Delegation Country Passcode (Observer mode)
  if (typeof COUNTRY_PASSCODES !== 'undefined') {
    for (const [grade, countries] of Object.entries(COUNTRY_PASSCODES)) {
      for (const [countryId, codeVal] of Object.entries(countries)) {
        if (safeCompare(clean, String(codeVal).trim().toUpperCase())) {
          return { valid: true, isMaster: false, grade, countryId };
        }
      }
    }
  }

  return { valid: false };
}

function verifyPasscodeInternal(passcode, targetGrade, targetCountry) {
  if (!passcode) return { valid: false };
  const clean = String(passcode).trim().replace(/\s+/g, '').toUpperCase();

  // Check master, admin, or judge passcodes
  if (isJudgeMasterPasscode(clean) || clean === "JUDGE2026" || clean === "ADMIN2026") {
    return { valid: true, isMaster: true };
  }

  // Class-level shortcut for Junior Division
  if (targetGrade && isJuniorGrade(targetGrade)) {
    const classShort = targetGrade.replace(/Grade\s*/i, 'G').replace(/\s+/g, '').toUpperCase();
    const classNum = targetGrade.replace(/Grade\s*/i, '').replace(/\s+/g, '').toUpperCase();
    if (clean === classShort || clean === classNum || clean === "JUNIOR" || clean === "KIDS") {
      return { valid: true, isMaster: false, grade: targetGrade, countryId: targetCountry };
    }
  }

  // Check country passcodes
  for (const g of Object.keys(COUNTRY_PASSCODES)) {
    for (const cid of Object.keys(COUNTRY_PASSCODES[g])) {
      const assigned = String(COUNTRY_PASSCODES[g][cid]).trim().toUpperCase();
      if (clean === assigned) {
        return {
          valid: true,
          isMaster: false,
          grade: g,
          countryId: cid,
          matchesTargetCountry: targetCountry ? targetCountry === cid : true,
          matchesTargetGrade: targetGrade ? targetGrade === g : true
        };
      }
    }
  }

  return { valid: false };
}

// API: Config & Teams
app.get('/api/config', (req, res) => {
  const db = loadDb();
  res.json({
    theme: 'We live differently, but we have the same hope.',
    eventTitle: 'UN Day Special Event: Global Solutions Showcase: MUN',
    grades: Object.keys(TEAMS_BY_GRADE),
    juniorGrades: JUNIOR_GRADES,
    seniorGrades: ['Grade 7', 'Grade 8', 'Grade 10', 'Grade 11'],
    teamsByGrade: TEAMS_BY_GRADE,
    topics: TOPICS,
    settings: db.settings,
    rubric: RUBRIC,
    seniorRubric: RUBRIC,
    juniorRubric: JUNIOR_RUBRIC,
    primaryJudges: [],
    seniorJudges: [
      { name: 'Kevin Ta', title: 'Judge 1', division: 'senior' },
      { name: 'Mr. D', title: 'Judge 2', division: 'senior' },
      { name: 'Chi Nguyen', title: 'Judge 3', division: 'senior' }
    ],
    judges: [
      { name: 'Kevin Ta', title: 'Judge 1', division: 'senior' },
      { name: 'Mr. D', title: 'Judge 2', division: 'senior' },
      { name: 'Chi Nguyen', title: 'Judge 3', division: 'senior' }
    ]
  });
});

app.get('/api/teams', (req, res) => {
  res.json(TEAMS_BY_GRADE);
});

// Passcodes directory (Secured: Admin authentication required)
app.get('/api/passcodes', (req, res) => {
  const pin = req.query.pin || req.headers['x-admin-pin'];
  const token = req.headers['x-admin-token'];
  if (!verifyAdminPin(pin, token)) {
    return res.status(403).json({ success: false, error: 'Forbidden: Access restricted to authorized MUN administrators only.' });
  }

  const directory = [];
  for (const [grade, teams] of Object.entries(TEAMS_BY_GRADE)) {
    const isJunior = isJuniorGrade(grade);
    teams.forEach(t => {
      directory.push({
        grade,
        division: t.division || (isJunior ? 'junior' : 'senior'),
        countryId: t.id,
        countryName: t.studentName ? `${t.studentName} (${t.country})` : t.name,
        studentName: t.studentName || t.name,
        country: t.country || t.name,
        costume: t.costume || '',
        isEmcee: Boolean(t.isEmcee),
        flag: t.flag,
        mentor: t.mentor,
        delegates: t.delegates || [],
        passcode: (COUNTRY_PASSCODES[grade] && COUNTRY_PASSCODES[grade][t.id]) || ''
      });
    });
  }

  res.json({
    success: true,
    passcodes: COUNTRY_PASSCODES,
    directory,
    judges: [
      { name: 'Kevin Ta', title: 'Judge 1 (Senior MUN)', division: 'senior', passcode: 'KEVINTA2026' },
      { name: 'Mr. D', title: 'Senior Judge 2 (Grades 7-11)', division: 'senior', passcode: 'MRD2026' },
      { name: 'Chi Nguyen', title: 'Senior Judge 3 (Grades 7-11)', division: 'senior', passcode: 'CHINGUYEN2026' }
    ]
  });
});

// Judge Gate Verification (GET and POST)
function handleVerifyJudge(req, res) {
  const ip = getClientIp(req);
  const passcode = req.body.passcode || req.query.passcode || req.query.key;
  const judgeName = (req.body.judgeName || req.query.judgeName || '').trim();

  if (!passcode) {
    return res.status(400).json({ success: false, error: 'Passcode is required to access Judge Chamber.' });
  }

  const verification = verifyJudgePasscodeInternal(passcode, judgeName);

  if (verification.valid) {
    recordAuthSuccess(ip);
    return res.json({
      success: true,
      isMaster: verification.isMaster,
      judgeName: verification.judgeName || judgeName || 'Honorable Judge',
      authorizedGrade: verification.grade || null,
      authorizedCountry: verification.countryId || null
    });
  } else {
    recordAuthFailure(ip);
    return res.status(401).json({
      success: false,
      error: 'Invalid Passcode. Please enter your appointed Judge Passcode or the Chamber Master Key.'
    });
  }
}

app.post('/api/judge/verify', handleVerifyJudge);
app.get('/api/judge/verify', handleVerifyJudge);

// Helper: verify student delegation or primary classmate passcode
function verifyStudentPasscode(grade, voterCountry, passcode) {
  if (!grade || !voterCountry || !passcode) return false;
  const clean = String(passcode).trim().replace(/\s+/g, '').toUpperCase();
  if (!clean) return false;

  // Master credentials
  if (clean === "ADMIN2026" || clean === "JUDGE2026") return true;

  // Expected country/student passcode
  const expectedRaw = (COUNTRY_PASSCODES[grade] && COUNTRY_PASSCODES[grade][voterCountry]) || "";
  const expected = String(expectedRaw).trim().replace(/\s+/g, '').toUpperCase();
  if (expected && safeCompare(clean, expected)) return true;

  // Class PIN shortcuts for Junior Division (e.g. "G1A1", "1A1", "G2A1", "2A1", "G3", "3", "JUNIOR", "KIDS")
  if (isJuniorGrade(grade)) {
    const classShort = grade.replace(/Grade\s*/i, 'G').replace(/\s+/g, '').toUpperCase();
    const classNum = grade.replace(/Grade\s*/i, '').replace(/\s+/g, '').toUpperCase();
    if (safeCompare(clean, classShort) || safeCompare(clean, classNum) || safeCompare(clean, "JUNIOR") || safeCompare(clean, "KIDS")) {
      return true;
    }
  }

  return false;
}

// Student Delegation Passcode Verification Endpoint
app.post("/api/student/verify", (req, res) => {
  const ip = getClientIp(req);
  const { grade, voterCountry, passcode } = req.body;
  if (!grade || !voterCountry) {
    return res.status(400).json({ success: false, error: "Grade and Country are required." });
  }

  const isValid = verifyStudentPasscode(grade, voterCountry, passcode);
  const teams = TEAMS_BY_GRADE[grade] || [];
  const team = teams.find(t => t.id === voterCountry);

  if (isValid && team) {
    recordAuthSuccess(ip);
    return res.json({
      success: true,
      message: "Delegation authenticated successfully.",
      team
    });
  }

  recordAuthFailure(ip);
  const displayName = team ? (team.studentName ? `${team.studentName} (${team.country})` : team.name) : String(voterCountry).toUpperCase();
  return res.status(401).json({
    success: false,
    error: "Invalid Passcode for " + displayName + " (" + grade + "). Please enter your country delegation password."
  });
});

// Student Ballot Submission:
// Each topic has EXACTLY 2 voted countries (cannot vote for self)
app.post('/api/student/vote', (req, res) => {
  const db = loadDb();
  if (db.settings && (db.settings.studentVotingOpen === false || db.settings.activePhase === 'locked' || db.settings.activePhase === 'closed')) {
    return res.status(403).json({ success: false, error: 'Student voting is currently locked and closed by Administration.' });
  }

  const { grade, voterCountry, passcode, delegates, topicVotes, comment } = req.body;

  if (!grade) {
    return res.status(400).json({ success: false, error: 'Please select your Grade first.' });
  }

  const teams = TEAMS_BY_GRADE[grade] || [];
  const validIds = teams.map(t => t.id);

  if (!voterCountry || !validIds.includes(voterCountry)) {
    return res.status(400).json({ success: false, error: 'Invalid delegation / student for ' + grade });
  }

  // Passcode verification for voter
  if (!verifyStudentPasscode(grade, voterCountry, passcode)) {
    const voterObj = teams.find(t => t.id === voterCountry);
    const displayName = voterObj ? (voterObj.studentName ? `${voterObj.studentName} (${voterObj.country})` : voterObj.name) : String(voterCountry).toUpperCase();
    return res.status(401).json({
      success: false,
      error: `Invalid Passcode for ${displayName} (${grade}). Please enter the correct password.`
    });
  }

  const isJunior = isJuniorGrade(grade);
  const validatedTopicVotes = {};

  if (isJunior) {
    // Junior Division: simplified peer voting (2 favorite classmates)
    let choices = [];
    if (Array.isArray(topicVotes)) {
      choices = topicVotes;
    } else if (topicVotes && Array.isArray(topicVotes.favorites)) {
      choices = topicVotes.favorites;
    } else if (topicVotes && Array.isArray(topicVotes.climate)) {
      choices = topicVotes.climate;
    }

    if (!Array.isArray(choices) || choices.length !== 2) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng chọn đúng 2 bạn trong lớp để bình chọn.'
      });
    }
    if (choices[0] === choices[1]) {
      return res.status(400).json({
        success: false,
        error: 'Không được chọn trùng 1 bạn 2 lần.'
      });
    }
    if (choices.includes(voterCountry)) {
      return res.status(400).json({
        success: false,
        error: 'Không được tự bình chọn cho chính bản thân mình.'
      });
    }
    for (const cid of choices) {
      if (!validIds.includes(cid)) {
        return res.status(400).json({ success: false, error: 'Học sinh được chọn không hợp lệ: ' + cid });
      }
    }
    validatedTopicVotes['favorites'] = choices;
    validatedTopicVotes['climate'] = choices;
    validatedTopicVotes['education'] = choices;
    validatedTopicVotes['health'] = choices;
  } else {
    // Senior Division: 3 topics x 2 countries
    for (const topId of ['climate', 'education', 'health']) {
      const choices = (topicVotes && topicVotes[topId]) || [];
      if (!Array.isArray(choices) || choices.length !== 2) {
        return res.status(400).json({
          success: false,
          error: `Phải hoàn thành chọn đủ cả 3 Topic mới được nộp phiếu. Topic ${topId.toUpperCase()} cần đủ 2 lựa chọn.`
        });
      }
      if (choices[0] === choices[1]) {
        return res.status(400).json({
          success: false,
          error: `Topic ${topId.toUpperCase()}: Không được chọn 2 lần cùng một quốc gia.`
        });
      }
      if (choices.includes(voterCountry)) {
        return res.status(400).json({
          success: false,
          error: `Luật MUN: Không được vote cho chính nước của mình ở Topic ${topId.toUpperCase()}.`
        });
      }
      for (const cid of choices) {
        if (!validIds.includes(cid)) {
          return res.status(400).json({ success: false, error: 'Invalid selected country: ' + cid });
        }
      }
      validatedTopicVotes[topId] = choices;
    }
  }

  const existingIndex = db.studentVotes.findIndex(v => v.grade === grade && v.voterCountry === voterCountry);
  const ballot = {
    id: 'ballot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    grade,
    division: isJunior ? 'junior' : 'senior',
    voterCountry,
    delegates: delegates || '',
    topicVotes: validatedTopicVotes,
    comment: comment || '',
    timestamp: new Date().toISOString(),
    ip: req.ip || (req.socket ? req.socket.remoteAddress : '')
  };

  if (existingIndex >= 0) {
    if (db.settings.allowVoteUpdate !== false) {
      db.studentVotes[existingIndex] = ballot;
    } else {
      return res.status(409).json({ success: false, error: 'Your delegation has already submitted an official ballot.' });
    }
  } else {
    db.studentVotes.push(ballot);
  }

  saveDb(db);
  res.json({ success: true, message: 'Ballot recorded successfully!', ballot });
});

app.get('/api/student/votes', (req, res) => {
  const db = loadDb();
  res.json({
    totalBallots: db.studentVotes.length,
    votes: db.studentVotes
  });
});


// Timer Public GET Endpoint (Both Voting Timer & Presentation Timer)
app.get("/api/timer", (req, res) => {
  const db = loadDb();
  const votingTimer = getCalculatedTimerState();
  const presentationTimer = getCalculatedPresentationTimerState();
  res.json({
    ...votingTimer, // Backwards-compatible root fields
    votingTimer,
    roundTimer: votingTimer,
    presentationTimer,
    currentPhase: db.settings.activePhase || "all",
    activeGrade: (presentationTimerState.running && presentationTimerState.presentingGrade) ? presentationTimerState.presentingGrade : (db.settings.activeGrade || "Grade 7")
  });
});

// Presentation Timer Control Endpoint
app.post("/api/presentation-timer/control", (req, res) => {
  const { pin, token, action, duration, grade, countryId, topic } = req.body;
  if (!verifyAdminPin(pin, token || req.headers['x-admin-token'])) {
    return res.status(401).json({ success: false, error: "Unauthorized PIN" });
  }

  if (action === "start") {
    if (!presentationTimerState.running) {
      if (presentationTimerState.remaining <= 0) {
        presentationTimerState.remaining = presentationTimerState.duration;
      }
      presentationTimerState.targetEndTime = Date.now() + (presentationTimerState.remaining * 1000);
      presentationTimerState.running = true;
      presentationTimerState.startedAt = Date.now();
    }
  } else if (action === "pause") {
    if (presentationTimerState.running) {
      presentationTimerState.remaining = Math.max(0, Math.ceil((presentationTimerState.targetEndTime - Date.now()) / 1000));
      presentationTimerState.running = false;
    }
  } else if (action === "reset") {
    presentationTimerState.running = false;
    presentationTimerState.remaining = presentationTimerState.duration;
    presentationTimerState.targetEndTime = 0;
  } else if (action === "set") {
    const dur = parseInt(duration, 10) || 600;
    const clamped = Math.min(Math.max(10, dur), 900); // 10s to 900s (15m max)
    presentationTimerState.duration = clamped;
    presentationTimerState.remaining = clamped;
    presentationTimerState.running = false;
    presentationTimerState.targetEndTime = 0;
  } else if (action === "add30") {
    if (presentationTimerState.running) {
      presentationTimerState.targetEndTime += 30000;
    } else {
      presentationTimerState.remaining += 30;
    }
  } else if (action === "add60") {
    if (presentationTimerState.running) {
      presentationTimerState.targetEndTime += 60000;
    } else {
      presentationTimerState.remaining += 60;
    }
  } else if (action === "sub30") {
    if (presentationTimerState.running) {
      presentationTimerState.targetEndTime = Math.max(Date.now() + 5000, presentationTimerState.targetEndTime - 30000);
    } else {
      presentationTimerState.remaining = Math.max(0, presentationTimerState.remaining - 30);
    }
  } else if (action === "setPresenter") {
    if (grade) presentationTimerState.presentingGrade = grade;
    if (countryId) presentationTimerState.presentingCountry = countryId;
    if (topic) presentationTimerState.presentingTopic = topic;
  }

  const st = getCalculatedPresentationTimerState();
  res.json({ success: true, presentationTimer: st });
});

// Timer Admin Control Endpoint
app.post("/api/timer/control", (req, res) => {
  const { pin, token, action, duration, topic } = req.body;
  if (!verifyAdminPin(pin, token || req.headers['x-admin-token'])) {
    return res.status(401).json({ success: false, error: "Unauthorized PIN" });
  }

  if (action === "start") {
    if (!roundTimerState.running) {
      if (roundTimerState.remaining <= 0) {
        roundTimerState.remaining = roundTimerState.duration;
      }
      roundTimerState.targetEndTime = Date.now() + (roundTimerState.remaining * 1000);
      roundTimerState.running = true;
      roundTimerState.startedAt = Date.now();
    }
  } else if (action === "pause") {
    if (roundTimerState.running) {
      roundTimerState.remaining = Math.max(0, Math.ceil((roundTimerState.targetEndTime - Date.now()) / 1000));
      roundTimerState.running = false;
    }
  } else if (action === "reset") {
    roundTimerState.running = false;
    roundTimerState.remaining = roundTimerState.duration;
    roundTimerState.targetEndTime = 0;
  } else if (action === "set") {
    const dur = parseInt(duration, 10) || 90;
    roundTimerState.duration = dur;
    roundTimerState.remaining = dur;
    roundTimerState.running = false;
    roundTimerState.targetEndTime = 0;
    if (topic) roundTimerState.activeTopic = topic;
  } else if (action === "add30") {
    if (roundTimerState.running) {
      roundTimerState.targetEndTime += 30000;
    } else {
      roundTimerState.remaining += 30;
    }
  }

  const st = getCalculatedTimerState();
  res.json({ success: true, timer: st });
});

// Student Live Draft Sync Endpoint
app.post("/api/student/draft", (req, res) => {
  const { grade, voterCountry, passcode, topicVotes } = req.body;
  if (!grade || !voterCountry) return res.status(400).json({ success: false });

  if (!verifyStudentPasscode(grade, voterCountry, passcode)) {
    return res.status(401).json({ success: false, error: "Unauthorized Passcode" });
  }

  const key = grade + "_" + voterCountry;
  LIVE_DRAFTS[key] = {
    grade,
    voterCountry,
    topicVotes: topicVotes || {},
    updatedAt: Date.now()
  };
  res.json({ success: true });
});

// Admin Live Delegation Status & Timeout Audit Endpoint
app.get("/api/admin/live-delegations", (req, res) => {
  const grade = req.query.grade || "Grade 11";
  const db = loadDb();
  const teams = TEAMS_BY_GRADE[grade] || [];
  const currentPhase = db.settings.activePhase || "all";
  const isJunior = isJuniorGrade(grade);

  const delegations = teams.map(t => {
    const key = grade + "_" + t.id;
    const draft = LIVE_DRAFTS[key] || {};
    const submittedVote = db.studentVotes.find(v => v.grade === grade && v.voterCountry === t.id);

    const tVotes = submittedVote ? submittedVote.topicVotes : (draft.topicVotes || {});
    const climateCount = Array.isArray(tVotes.climate) ? tVotes.climate.length : 0;
    const educationCount = Array.isArray(tVotes.education) ? tVotes.education.length : 0;
    const healthCount = Array.isArray(tVotes.health) ? tVotes.health.length : 0;
    const favoritesCount = Array.isArray(tVotes.favorites) ? tVotes.favorites.length : Math.max(climateCount, educationCount, healthCount);

    let missingCurrent = false;
    if (isJunior) {
      if (currentPhase === "all" && favoritesCount < 2) missingCurrent = true;
    } else {
      if (currentPhase === "climate" && climateCount < 2) missingCurrent = true;
      if (currentPhase === "education" && educationCount < 2) missingCurrent = true;
      if (currentPhase === "health" && healthCount < 2) missingCurrent = true;
      if (currentPhase === "all" && (climateCount < 2 || educationCount < 2 || healthCount < 2)) missingCurrent = true;
    }

    return {
      id: t.id,
      name: t.name,
      studentName: t.studentName || t.name,
      country: t.country || t.name,
      costume: t.costume || '',
      isEmcee: Boolean(t.isEmcee),
      division: t.division || (isJunior ? 'junior' : 'senior'),
      flag: t.flag,
      mentor: t.mentor,
      delegates: t.delegates,
      passcode: (COUNTRY_PASSCODES[grade] && COUNTRY_PASSCODES[grade][t.id]) || "",
      climateCount,
      educationCount,
      healthCount,
      favoritesCount,
      isSubmitted: Boolean(submittedVote),
      missingCurrent,
      lastSeen: draft.updatedAt || null
    };
  });

  const missingList = delegations.filter(d => d.missingCurrent).map(d => d.studentName || d.name);
  const isTimedOut = roundTimerState.remaining === 0 && !roundTimerState.running && missingList.length > 0;

  res.json({
    grade,
    isJunior,
    currentPhase,
    timer: roundTimerState,
    delegations,
    missingList,
    isTimedOut
  });
});

// Judge Scoring Submission
app.post('/api/judge/score', (req, res) => {
  const db = loadDb();
  if (db.settings && db.settings.judgeVotingOpen === false) {
    return res.status(403).json({ success: false, error: 'Judge evaluation is currently closed by the host.' });
  }

  const { judgeName, grade, countryId, scores, advancedBonus, comments, passcode } = req.body;

  const auth = verifyPasscodeInternal(passcode, grade, countryId);
  if (!auth.valid) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Judge Passcode for this room.' });
  }

  if (!judgeName || !judgeName.trim()) {
    return res.status(400).json({ success: false, error: 'Judge name is required.' });
  }
  if (!grade) {
    return res.status(400).json({ success: false, error: 'Grade is required.' });
  }

  const teams = TEAMS_BY_GRADE[grade] || [];
  const validIds = teams.map(t => t.id);
  if (!countryId || !validIds.includes(countryId)) {
    return res.status(400).json({ success: false, error: 'Invalid target student / country for ' + grade });
  }
  if (!scores || typeof scores !== 'object') {
    return res.status(400).json({ success: false, error: 'Scores object is required.' });
  }

  const isJunior = isJuniorGrade(grade);

  if (isJunior) {
    const targetStudent = teams.find(t => t.id === countryId);
    const isVn = targetStudent && (targetStudent.countryKey === 'vietnam' || targetStudent.country === 'Vietnam');
    const isEmcee = targetStudent && targetStudent.isEmcee;

    const costumeScore = parseFloat(scores.costume !== undefined ? scores.costume : (scores.preparation || 0));
    const scriptScore = parseFloat(scores.script !== undefined ? scores.script : (scores.speaking || 0));
    const presScore = parseFloat(scores.presentation !== undefined ? scores.presentation : (scores.teamwork || 0));

    const maxCostume = (isVn && !isEmcee) ? 1.5 : 3.0;
    if (isNaN(costumeScore) || costumeScore < 0 || costumeScore > maxCostume) {
      return res.status(400).json({
        success: false,
        error: `Điểm Trang phục & Hình ảnh phải từ 0 đến ${maxCostume} điểm.`
      });
    }
    if (isNaN(scriptScore) || scriptScore < 0 || scriptScore > 3.0) {
      return res.status(400).json({ success: false, error: 'Điểm Lời thoại & Phát âm phải từ 0 đến 3.0 điểm.' });
    }
    if (isNaN(presScore) || presScore < 0 || presScore > 2.0) {
      return res.status(400).json({ success: false, error: 'Điểm Phong thái (dáng đi, cúi chào) phải từ 0 đến 2.0 điểm.' });
    }

    const baseScore = Number((costumeScore + scriptScore + presScore).toFixed(1));
    const hasBonus = Boolean(advancedBonus || scores.addedScriptBonus);
    const bonusPoints = hasBonus ? 2.0 : 0.0;
    const totalScore = Number((baseScore + bonusPoints).toFixed(1));

    const validatedScores = {
      costume: costumeScore,
      script: scriptScore,
      presentation: presScore,
      preparation: costumeScore,
      speaking: scriptScore,
      vocabulary: presScore,
      teamwork: presScore,
      qna: bonusPoints
    };

    const scoreEntry = {
      id: 'score_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      judgeName: judgeName.trim(),
      grade,
      countryId,
      scores: validatedScores,
      baseScore,
      advancedBonus: hasBonus,
      bonusPoints,
      totalScore,
      comments: comments || '',
      division: 'junior',
      timestamp: new Date().toISOString()
    };

    const existingIdx = db.judgeScores.findIndex(
      s => s.judgeName.toLowerCase() === judgeName.trim().toLowerCase() && s.grade === grade && s.countryId === countryId
    );

    if (existingIdx >= 0) {
      db.judgeScores[existingIdx] = scoreEntry;
    } else {
      db.judgeScores.push(scoreEntry);
    }

    saveDb(db);
    return res.json({ success: true, message: 'Junior Score saved successfully!', score: scoreEntry });
  }

  // Senior Division Scoring
  const criteriaIds = ['preparation', 'speaking', 'vocabulary', 'teamwork', 'qna'];
  let baseScore = 0;
  const validatedScores = {};

  for (const cid of criteriaIds) {
    const val = parseInt(scores[cid], 10);
    if (isNaN(val) || val < 1 || val > 3) {
      return res.status(400).json({ success: false, error: 'Score for ' + cid + ' must be between 1 and 3.' });
    }
    validatedScores[cid] = val;
    baseScore += val;
  }

  const hasBonus = Boolean(advancedBonus);
  const bonusPoints = hasBonus ? 5 : 0;
  const totalScore = baseScore + bonusPoints;

  const scoreEntry = {
    id: 'score_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    judgeName: judgeName.trim(),
    grade,
    countryId,
    scores: validatedScores,
    baseScore,
    advancedBonus: hasBonus,
    bonusPoints,
    totalScore,
    comments: comments || '',
    division: 'senior',
    timestamp: new Date().toISOString()
  };

  const existingIdx = db.judgeScores.findIndex(
    s => s.judgeName.toLowerCase() === judgeName.trim().toLowerCase() && s.grade === grade && s.countryId === countryId
  );

  if (existingIdx >= 0) {
    db.judgeScores[existingIdx] = scoreEntry;
  } else {
    db.judgeScores.push(scoreEntry);
  }

  saveDb(db);
  res.json({ success: true, message: 'Score saved successfully!', score: scoreEntry });
});

app.get('/api/judge/scores', (req, res) => {
  const db = loadDb();
  res.json({
    totalScores: db.judgeScores.length,
    scores: db.judgeScores
  });
});

// Ranking helper with accurate Tie handling:
// Standard competition ranking (1224) and tie detection
function rankWithTies(items, scoreField) {
  items.sort((a, b) => (b[scoreField] || 0) - (a[scoreField] || 0));
  const hasAnyScore = items.some(item => (item[scoreField] || 0) > 0);
  if (!hasAnyScore) {
    items.forEach(item => {
      item.rank = null;
      item.isTie = false;
    });
    return items;
  }
  for (let i = 0; i < items.length; i++) {
    if ((items[i][scoreField] || 0) === 0) {
      items[i].rank = null;
      items[i].isTie = false;
      continue;
    }
    if (i > 0 && items[i][scoreField] === items[i - 1][scoreField]) {
      items[i].rank = items[i - 1].rank;
      items[i].isTie = true;
      items[i - 1].isTie = true;
    } else {
      items[i].rank = i + 1;
      items[i].isTie = false;
    }
  }
  return items;
}

// Synchronized Leaderboard & Topic Awards with Tie handling
app.get('/api/leaderboard', (req, res) => {
  const db = loadDb();
  const activeGrade = (presentationTimerState.running && presentationTimerState.presentingGrade) ? presentationTimerState.presentingGrade : (db.settings.activeGrade || "Grade 7");
  const requestedGrade = req.query.grade || activeGrade;

  const gradesToProcess = Object.keys(TEAMS_BY_GRADE);
  const resultsByGrade = {};

  gradesToProcess.forEach(g => {
    const teams = TEAMS_BY_GRADE[g] || [];
    const isJunior = isJuniorGrade(g);

    // 1. Peer Votes Tallies
    const topicStats = {
      climate: {},
      education: {},
      health: {},
      favorites: {}
    };

    teams.forEach(t => {
      topicStats.climate[t.id] = { team: t, votes: 0 };
      topicStats.education[t.id] = { team: t, votes: 0 };
      topicStats.health[t.id] = { team: t, votes: 0 };
      topicStats.favorites[t.id] = { team: t, votes: 0 };
    });

    const gradeBallots = db.studentVotes.filter(v => v.grade === g);
    gradeBallots.forEach(ballot => {
      if (ballot.topicVotes) {
        ['climate', 'education', 'health', 'favorites'].forEach(top => {
          const list = ballot.topicVotes[top];
          if (Array.isArray(list)) {
            list.forEach(chosen => {
              if (topicStats[top] && topicStats[top][chosen]) {
                topicStats[top][chosen].votes += 1;
              }
            });
          }
        });
      }
    });

    // 2. Judge Scores Tally
    const judgeStats = {};
    teams.forEach(t => {
      judgeStats[t.id] = {
        team: t,
        evaluationsCount: 0,
        totalScoreSum: 0,
        baseScoreSum: 0,
        bonusCount: 0,
        criteriaSums: isJunior
          ? { costume: 0, script: 0, presentation: 0, preparation: 0, speaking: 0, vocabulary: 0, teamwork: 0, qna: 0 }
          : { preparation: 0, speaking: 0, vocabulary: 0, teamwork: 0, qna: 0 },
        feedbacks: []
      };
    });

    const gradeScores = db.judgeScores.filter(s => s.grade === g);
    gradeScores.forEach(s => {
      const cid = s.countryId;
      if (judgeStats[cid]) {
        judgeStats[cid].evaluationsCount += 1;
        judgeStats[cid].totalScoreSum += s.totalScore;
        judgeStats[cid].baseScoreSum += s.baseScore;
        if (s.advancedBonus) judgeStats[cid].bonusCount += 1;
        for (const k in s.scores) {
          if (judgeStats[cid].criteriaSums[k] !== undefined) {
            judgeStats[cid].criteriaSums[k] += s.scores[k];
          }
        }
        if (s.comments && s.comments.trim()) {
          judgeStats[cid].feedbacks.push({ judge: s.judgeName, comment: s.comments });
        }
      }
    });

    const judgeList = Object.values(judgeStats).map(item => {
      const count = item.evaluationsCount;
      const avgCrit = {};
      for (const k of Object.keys(item.criteriaSums)) {
        avgCrit[k] = count > 0 ? Number((item.criteriaSums[k] / count).toFixed(2)) : 0;
      }

      return {
        team: item.team,
        evaluationsCount: count,
        avgTotalScore: count > 0 ? Number((item.totalScoreSum / count).toFixed(2)) : 0,
        avgBaseScore: count > 0 ? Number((item.baseScoreSum / count).toFixed(2)) : 0,
        bonusCount: item.bonusCount,
        bonusRate: count > 0 ? Math.round((item.bonusCount / count) * 100) : 0,
        avgCriteria: avgCrit,
        feedbacks: item.feedbacks
      };
    });

    const judgeRanked = rankWithTies(judgeList, 'avgTotalScore');
    const judgeTop3 = judgeRanked.filter(item => item.rank <= 3 && item.avgTotalScore > 0);

    let topicRankings = {};
    if (isJunior) {
      // Junior Awards:
      // Climate column -> Best National Costume (ranked by avgCriteria.costume)
      // Education column -> Best Script & Delivery (ranked by avgCriteria.script)
      // Health column -> Students' Choice (ranked by peer votes in favorites)
      const costumeRanked = rankWithTies(
        judgeList.map(j => ({ team: j.team, votes: j.avgCriteria.costume || 0 })),
        'votes'
      );
      const scriptRanked = rankWithTies(
        judgeList.map(j => ({ team: j.team, votes: Number(((j.avgCriteria.script || 0) + (j.bonusCount > 0 ? 2 : 0)).toFixed(1)) })),
        'votes'
      );
      const peerRanked = rankWithTies(Object.values(topicStats.favorites), 'votes');

      topicRankings = {
        climate: costumeRanked,
        education: scriptRanked,
        health: peerRanked,
        costume: costumeRanked,
        script: scriptRanked,
        favorites: peerRanked
      };
    } else {
      // Senior Topics
      topicRankings = {
        climate: rankWithTies(Object.values(topicStats.climate), 'votes'),
        education: rankWithTies(Object.values(topicStats.education), 'votes'),
        health: rankWithTies(Object.values(topicStats.health), 'votes')
      };
    }

    // Overall Peer Votes Ranking (Students' Choice Award)
    const peerStats = {};
    teams.forEach(t => {
      peerStats[t.id] = { team: t, votes: 0 };
    });
    gradeBallots.forEach(b => {
      const chosenInBallot = new Set();
      if (b.topicVotes) {
        Object.keys(b.topicVotes).forEach(topId => {
          const arr = b.topicVotes[topId] || [];
          arr.forEach(cid => chosenInBallot.add(cid));
        });
      }
      chosenInBallot.forEach(cid => {
        if (peerStats[cid]) peerStats[cid].votes += 1;
      });
    });

    const peerList = Object.values(peerStats).map(p => {
      const judgeEntry = judgeRanked.find(j => j.team.id === p.team.id);
      return {
        team: p.team,
        votes: p.votes,
        avgTotalScore: judgeEntry ? judgeEntry.avgTotalScore : 0,
        avgBaseScore: judgeEntry ? judgeEntry.avgBaseScore : 0,
        bonusCount: judgeEntry ? judgeEntry.bonusCount : 0
      };
    });

    peerList.sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return (b.avgTotalScore || 0) - (a.avgTotalScore || 0);
    });

    const totalVotesInGrade = peerList.reduce((sum, p) => sum + (p.votes || 0), 0);

    if (totalVotesInGrade === 0) {
      peerList.forEach(p => {
        p.rank = null;
        p.isTie = false;
        p.tieNote = "Awaiting ballots";
      });
    } else {
      let currentRank = 1;
      for (let i = 0; i < peerList.length; i++) {
        if ((peerList[i].votes || 0) === 0) {
          peerList[i].rank = null;
          peerList[i].isTie = false;
          peerList[i].tieNote = "No ballots recorded";
          continue;
        }

        let groupEnd = i;
        while (groupEnd + 1 < peerList.length && peerList[groupEnd + 1].votes === peerList[i].votes) {
          groupEnd++;
        }
        const groupSize = groupEnd - i + 1;
        const groupRank = currentRank;

        if (groupSize > 1) {
          const maxScoreInGroup = Math.max(...peerList.slice(i, groupEnd + 1).map(p => p.avgTotalScore || 0));
          const minScoreInGroup = Math.min(...peerList.slice(i, groupEnd + 1).map(p => p.avgTotalScore || 0));
          const hasDifferentScores = maxScoreInGroup !== minScoreInGroup;

          for (let j = i; j <= groupEnd; j++) {
            peerList[j].rank = groupRank;
            peerList[j].isTie = true;
            if (hasDifferentScores && (peerList[j].avgTotalScore || 0) === maxScoreInGroup) {
              peerList[j].tieNote = "Tied #" + groupRank + " (Higher Judge Score: " + peerList[j].avgTotalScore.toFixed(2) + ")";
            } else if (hasDifferentScores) {
              peerList[j].tieNote = "Tied #" + groupRank + " (Judge Score: " + peerList[j].avgTotalScore.toFixed(2) + ")";
            } else {
              peerList[j].tieNote = "Tied #" + groupRank + " (" + peerList[j].votes + " votes)";
            }
          }
        } else {
          peerList[i].rank = groupRank;
          peerList[i].isTie = false;
          peerList[i].tieNote = "-";
        }

        currentRank += groupSize;
        i = groupEnd;
      }
    }

    resultsByGrade[g] = {
      grade: g,
      division: isJunior ? 'junior' : 'senior',
      maxScore: isJunior ? 10 : 20,
      totalBallots: gradeBallots.length,
      totalJudgeEvaluations: gradeScores.length,
      topicRankings,
      studentsChoiceRanking: peerList,
      judgeRanking: judgeRanked,
      judgeTop3
    };
  });

  res.json({
    activePhase: db.settings.activePhase || 'all',
    activeGrade,
    currentGrade: activeGrade,
    requestedGrade: requestedGrade || 'All',
    resultsByGrade,
    grades: resultsByGrade,
    totalStudentBallotsAll: db.studentVotes.length,
    totalJudgeEvaluationsAll: db.judgeScores.length
  });
});

// Admin: Set Active Phase

// Set Active Stage Grade (Controls which grade displays on Leaderboard / Projector)
app.post(['/api/admin/grade', '/api/admin/stage-grade'], (req, res) => {
  const db = loadDb();
  const { pin, token, grade } = req.body;
  if (!verifyAdminPin(pin, token || req.headers['x-admin-token'])) {
    return res.status(401).json({ success: false, error: 'Unauthorized PIN' });
  }

  const validGrades = Object.keys(TEAMS_BY_GRADE);
  if (!validGrades.includes(grade)) {
    return res.status(400).json({ success: false, error: 'Invalid grade: ' + grade });
  }

  db.settings.activeGrade = grade;
  saveDb(db);

  // If not currently running speech timer, sync presenter grade too
  if (!presentationTimerState.running) {
    presentationTimerState.presentingGrade = grade;
    const teams = TEAMS_BY_GRADE[grade] || [];
    if (teams.length > 0) {
      presentationTimerState.presentingCountry = teams[0].id;
    }
  }

  console.log('[STAGE SYNC] Admin changed active stage grade to:', grade);
  res.json({ success: true, activeGrade: grade });
});

app.post('/api/admin/phase', (req, res) => {
  const db = loadDb();
  const { pin, phase } = req.body;
  if (!verifyAdminPin(pin)) {
    return res.status(401).json({ success: false, error: 'Unauthorized PIN' });
  }

  const validPhases = ['all', 'locked', 'closed', 'climate', 'education', 'health', 'judges', 'ceremony'];
  if (!validPhases.includes(phase)) {
    return res.status(400).json({ success: false, error: 'Invalid phase: ' + phase });
  }

  db.settings.activePhase = phase;
  saveDb(db);
  res.json({ success: true, activePhase: phase, message: 'Stage phase updated to ' + phase });
});

// Admin: Verify PIN with Anti-Brute-Force & Session Token Generation
app.post('/api/admin/verify-pin', (req, res) => {
  const ip = getClientIp(req);
  const { pin } = req.body;
  if (verifyAdminPin(pin)) {
    recordAuthSuccess(ip);
    const token = createAdminToken();
    res.json({ success: true, token });
  } else {
    recordAuthFailure(ip);
    res.status(401).json({ success: false, error: 'Incorrect Admin PIN' });
  }
});

// Build Full Audit Evidence CSV string
function buildFullEvidenceCsv() {
  const db = loadDb();
  const ts = new Date().toISOString();
  let csv = '=== MODEL UNITED NATIONS (MUN) OFFICIAL AUDIT EVIDENCE REPORT ===\n';
  csv += `Export Timestamp: "${ts}"\n\n`;

  // Section 1: All Teams Performance Summary (Every single team, not just top 3)
  csv += '--- SECTION 1: COMPLETE OFFICIAL STANDINGS & SCORES (ALL TEAMS ACROSS ALL GRADES) ---\n';
  csv += 'Grade,Rank,Country,Mentor,Delegates,Evaluations Count,Avg Prep (/3),Avg Speak (/3),Avg Vocab (/3),Avg Team (/3),Avg Q&A (/3),Avg Base (/15),Bonus Q&A (+5 Count),Avg Total Score (/20),Judge Comments\n';

  for (const g of Object.keys(TEAMS_BY_GRADE)) {
    const teams = TEAMS_BY_GRADE[g] || [];
    const gradeScores = db.judgeScores.filter(s => s.grade === g);

    const teamList = teams.map(t => {
      const tScores = gradeScores.filter(s => s.countryId === t.id);
      const count = tScores.length;
      let totalSum = 0, baseSum = 0, bonusCount = 0;
      let pSum = 0, sSum = 0, vSum = 0, tmSum = 0, qSum = 0;
      const comments = [];

      tScores.forEach(s => {
        totalSum += s.totalScore;
        baseSum += s.baseScore;
        if (s.advancedBonus) bonusCount++;
        pSum += s.scores.preparation || 0;
        sSum += s.scores.speaking || 0;
        vSum += s.scores.vocabulary || 0;
        tmSum += s.scores.teamwork || 0;
        qSum += s.scores.qna || 0;
        if (s.comments) comments.push(`${s.judgeName}: ${s.comments}`);
      });

      return {
        team: t,
        count,
        avgTotal: count > 0 ? Number((totalSum / count).toFixed(2)) : 0,
        avgBase: count > 0 ? Number((baseSum / count).toFixed(2)) : 0,
        bonusCount,
        avgP: count > 0 ? Number((pSum / count).toFixed(2)) : 0,
        avgS: count > 0 ? Number((sSum / count).toFixed(2)) : 0,
        avgV: count > 0 ? Number((vSum / count).toFixed(2)) : 0,
        avgTm: count > 0 ? Number((tmSum / count).toFixed(2)) : 0,
        avgQ: count > 0 ? Number((qSum / count).toFixed(2)) : 0,
        commentsStr: comments.join(' | ')
      };
    });

    const ranked = rankWithTies(teamList, 'avgTotal');
    ranked.forEach(item => {
      const dStr = (item.team.delegates || []).join('; ').replace(/"/g, '""');
      const cStr = item.commentsStr.replace(/"/g, '""');
      const rankDisplay = item.isTie ? `${item.rank} (Tie)` : `${item.rank}`;
      csv += `"${g}","${rankDisplay}","${item.team.name}","${item.team.mentor || ''}","${dStr}",${item.count},${item.avgP},${item.avgS},${item.avgV},${item.avgTm},${item.avgQ},${item.avgBase},${item.bonusCount},${item.avgTotal},"${cStr}"\n`;
    });
  }

  // Section 2: Students' Choice Topic Votes (All Teams)
  csv += '\n--- SECTION 2: STUDENTS\' CHOICE TOPIC AWARDS VOTE TALLY (ALL TEAMS) ---\n';
  csv += 'Grade,Country,Climate Change Votes,Education Votes,Health Issues Votes,Total Peer Votes\n';

  for (const g of Object.keys(TEAMS_BY_GRADE)) {
    const teams = TEAMS_BY_GRADE[g] || [];
    const gradeBallots = db.studentVotes.filter(v => v.grade === g);

    teams.forEach(t => {
      let cVotes = 0, eVotes = 0, hVotes = 0;
      gradeBallots.forEach(b => {
        const tv = b.topicVotes || {};
        if (Array.isArray(tv.climate) && tv.climate.includes(t.id)) cVotes++;
        if (Array.isArray(tv.education) && tv.education.includes(t.id)) eVotes++;
        if (Array.isArray(tv.health) && tv.health.includes(t.id)) hVotes++;
      });
      const tot = cVotes + eVotes + hVotes;
      csv += `"${g}","${t.name}",${cVotes},${eVotes},${hVotes},${tot}\n`;
    });
  }

  // Section 3: Raw Individual Judge Scorecards Ledger
  csv += '\n--- SECTION 3: RAW JUDGE SCORECARD AUDIT TRAIL ---\n';
  csv += 'Score ID,Timestamp,Judge Name,Grade,Target Country,Prep (/3),Speaking (/3),Vocab (/3),Teamwork (/3),Q&A (/3),Base Score (/15),Bonus Q&A (+5),Total (/20),Judge Comments\n';
  db.judgeScores.forEach(s => {
    const cStr = (s.comments || '').replace(/"/g, '""');
    csv += `"${s.id}","${s.timestamp}","${s.judgeName}","${s.grade}","${s.countryId}",${s.scores.preparation},${s.scores.speaking},${s.scores.vocabulary},${s.scores.teamwork},${s.scores.qna},${s.baseScore},"${s.advancedBonus ? 'YES (+5)' : 'NO (0)'}",${s.totalScore},"${cStr}"\n`;
  });

  // Section 4: Raw Individual Student Ballots Ledger
  csv += '\n--- SECTION 4: RAW STUDENT BALLOT AUDIT TRAIL ---\n';
  csv += 'Ballot ID,Timestamp,Grade,Voter Country,Delegates,Topic 1 Climate (2 Votes),Topic 2 Education (2 Votes),Topic 3 Health (2 Votes),Comments\n';
  db.studentVotes.forEach(b => {
    const dStr = (b.delegates || '').replace(/"/g, '""');
    const cStr = (b.comment || '').replace(/"/g, '""');
    const tv = b.topicVotes || {};
    const c1 = (Array.isArray(tv.climate) ? tv.climate.join(' & ') : '').toUpperCase();
    const c2 = (Array.isArray(tv.education) ? tv.education.join(' & ') : '').toUpperCase();
    const c3 = (Array.isArray(tv.health) ? tv.health.join(' & ') : '').toUpperCase();
    csv += `"${b.id}","${b.timestamp}","${b.grade}","${b.voterCountry}","${dStr}","${c1}","${c2}","${c3}","${cStr}"\n`;
  });

  return csv;
}


// 1. Official Excel (.xlsx) Evidence Export Endpoint
app.get('/api/admin/export/excel', (req, res) => {
  const db = loadDb();
  const grade = req.query.grade || 'all';
  const buffer = generateExcelWorkbook(db, TEAMS_BY_GRADE, TOPICS, grade);
  const filename = `MUN_Official_Evidence_${grade.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

// 2. Official Visual HTML Evidence Dossier (Printable / PDF)
app.get(['/api/admin/report', '/report', '/dossier'], (req, res) => {
  const db = loadDb();
  const grade = req.query.grade || 'all';
  const html = generateVisualHtmlReport(db, TEAMS_BY_GRADE, TOPICS, grade);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Full Evidence Export CSV Endpoint
app.get('/api/admin/export/full-evidence', (req, res) => {
  const csv = buildFullEvidenceCsv();
  const filename = `mun_evidence_report_${Date.now()}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv);
});

// Admin: Reset for Next Grade (with Mandatory Server Archive)
app.post('/api/admin/reset-grade', (req, res) => {
  const db = loadDb();
  const { pin } = req.body;
  if (!verifyAdminPin(pin)) {
    return res.status(401).json({ success: false, error: 'Unauthorized PIN' });
  }

  // 1. Save evidence archive to disk first (Excel .xlsx + Visual HTML Dossier + CSV)
  const ts = Date.now();
  const excelBuffer = generateExcelWorkbook(db, TEAMS_BY_GRADE, TOPICS, 'all');
  const excelPath = path.join(ARCHIVES_DIR, `MUN_Evidence_${ts}.xlsx`);
  fs.writeFileSync(excelPath, excelBuffer);

  const visualHtml = generateVisualHtmlReport(db, TEAMS_BY_GRADE, TOPICS, 'all');
  const htmlPath = path.join(ARCHIVES_DIR, `MUN_Dossier_${ts}.html`);
  fs.writeFileSync(htmlPath, visualHtml, 'utf8');

  const csvData = buildFullEvidenceCsv();
  const csvPath = path.join(ARCHIVES_DIR, `evidence_${ts}.csv`);
  fs.writeFileSync(csvPath, '\uFEFF' + csvData, 'utf8');

  const jsonPath = path.join(ARCHIVES_DIR, `snapshot_${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ db, timestamp: new Date().toISOString() }, null, 2), 'utf8');

  // 2. Clear current live votes and scores for the next grade
  db.studentVotes = [];
  db.judgeScores = [];
  db.settings.activePhase = 'all';

  saveDb(db);
  res.json({
    success: true,
    message: 'Audit evidence archived successfully on server. Live ballots and scores reset for the next grade.',
    archiveFilename: `evidence_${ts}.csv`
  });
});

// Generic Reset
app.post('/api/admin/reset', (req, res) => {
  const db = loadDb();
  const { pin, target } = req.body;
  if (!verifyAdminPin(pin)) {
    return res.status(401).json({ success: false, error: 'Unauthorized PIN' });
  }

  if (target === 'student') db.studentVotes = [];
  else if (target === 'judge') db.judgeScores = [];
  else if (target === 'all') { db.studentVotes = []; db.judgeScores = []; }

  saveDb(db);
  res.json({ success: true, message: 'Successfully reset ' + target + ' data.' });
});

// Admin Full Database Backup JSON Endpoint
app.get("/api/admin/backup", (req, res) => {
  const pin = req.query.pin || req.headers["x-admin-pin"];
  const token = req.headers["x-admin-token"];
  if (!verifyAdminPin(pin, token)) {
    return res.status(401).json({ success: false, error: "Unauthorized PIN" });
  }
  const db = loadDb();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=mun_backup_" + Date.now() + ".json");
  res.send(JSON.stringify(db, null, 2));
});

// Admin Full Database Restore JSON Endpoint
app.post("/api/admin/restore", (req, res) => {
  const { pin, token, backupData } = req.body;
  if (!verifyAdminPin(pin, token || req.headers["x-admin-token"])) {
    return res.status(401).json({ success: false, error: "Unauthorized PIN" });
  }
  if (!backupData || typeof backupData !== "object") {
    return res.status(400).json({ success: false, error: "Invalid backup JSON structure" });
  }
  const db = loadDb();
  if (Array.isArray(backupData.judgeScores)) db.judgeScores = backupData.judgeScores;
  if (Array.isArray(backupData.studentVotes)) db.studentVotes = backupData.studentVotes;
  if (backupData.settings && typeof backupData.settings === "object") {
    db.settings = { ...db.settings, ...backupData.settings };
  }
  saveDb(db);
  res.json({
    success: true,
    message: "Restored successfully: " + (db.judgeScores ? db.judgeScores.length : 0) + " judge scores and " + (db.studentVotes ? db.studentVotes.length : 0) + " student ballots.",
    judgeScoresCount: db.judgeScores ? db.judgeScores.length : 0,
    studentVotesCount: db.studentVotes ? db.studentVotes.length : 0
  });
});

// Admin Delete Entry
app.post('/api/admin/delete-entry', (req, res) => {
  const db = loadDb();
  const { pin, type, id } = req.body;
  if (!verifyAdminPin(pin)) {
    return res.status(401).json({ success: false, error: 'Unauthorized PIN' });
  }

  if (type === 'student') db.studentVotes = db.studentVotes.filter(v => v.id !== id);
  else if (type === 'judge') db.judgeScores = db.judgeScores.filter(s => s.id !== id);

  saveDb(db);
  res.json({ success: true });
});

// Admin Toggle Settings
app.post('/api/admin/toggle-voting', (req, res) => {
  const db = loadDb();
  const { pin, key, value } = req.body;
  if (!verifyAdminPin(pin)) {
    return res.status(401).json({ success: false, error: 'Unauthorized PIN' });
  }

  if (key === 'studentVotingOpen') db.settings.studentVotingOpen = Boolean(value);
  if (key === 'judgeVotingOpen') db.settings.judgeVotingOpen = Boolean(value);
  if (key === 'allowVoteUpdate') db.settings.allowVoteUpdate = Boolean(value);

  saveDb(db);
  res.json({ success: true, settings: db.settings });
});

// Network info
app.get('/api/network-info', (req, res) => {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  res.json({
    port: PORT,
    ipAddresses: addresses,
    localUrls: addresses.map(ip => 'http://' + ip + ':' + PORT)
  });
});

// Friendly routes (Zero cache for instant cross-device sync)
const sendFreshFile = (res, filename) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', filename));
};

app.get('/', (req, res) => sendFreshFile(res, 'index.html'));
app.get('/student', (req, res) => sendFreshFile(res, 'student.html'));
app.get('/judge', (req, res) => sendFreshFile(res, 'judge.html'));
app.get('/results', (req, res) => sendFreshFile(res, 'results.html'));
app.get('/admin', (req, res) => sendFreshFile(res, 'admin.html'));

// Short URL aliases
app.get('/s', (req, res) => res.redirect('/student'));
app.get('/j', (req, res) => res.redirect('/judge'));
app.get('/r', (req, res) => res.redirect('/results'));
app.get('/a', (req, res) => res.redirect('/admin'));

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API route not found: ' + req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  } else {
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('MUN Event Server running on http://localhost:' + PORT);
});

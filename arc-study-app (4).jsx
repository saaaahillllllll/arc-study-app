import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Flame, Zap, Trophy, Clock, BookOpen, Timer, StickyNote, BarChart3,
  Users, Play, Pause, RotateCcw, Plus, X, Check, Coins, Volume2, VolumeX,
  Maximize2, Minimize2, ChevronRight, ChevronLeft, Sparkles, Skull,
  CalendarClock, Home, Brain, Trash2, Edit3, Circle, CheckCircle2,
  TrendingUp, Layers, Lock, Video, VideoOff, Mic, MicOff, MessageSquare,
  Send, Crown, Copy, LogOut, Swords, Palette,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";

/* ---------------------------------- helpers ---------------------------------- */

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (dateStr, n) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (from, to) =>
  Math.ceil((new Date(to + "T00:00:00") - new Date(from + "T00:00:00")) / 86400000);
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const STATUS_COLOR = { weak: "var(--red)", average: "var(--amber)", strong: "var(--mint)" };
const STATUS_DOT = { weak: "\ud83d\udd34", average: "\ud83d\udfe1", strong: "\ud83d\udfe2" };

const DEFAULT_STATS = {
  xp: 0, coins: 0, streak: 0, lastCheckIn: null,
  focusMinutesToday: 0, focusDay: null, focusStreak: 0, lastFocusDay: null,
  totalFocusSessions: 0, tasksCompleted: 0,
};

const XP_PER_LEVEL = 150;
const levelFromXp = (xp) => Math.floor(xp / XP_PER_LEVEL) + 1;

const DEFAULT_SETTINGS = { dailyHours: 3, bgTheme: "default", bgCustomColor: "#0A0918", bgImageData: null, bgBrightness: 60, focusMinutes: 25, breakMinutes: 5 };
const MAX_BG_IMAGE_BYTES = 2.5 * 1024 * 1024; // raw file cap; base64 adds ~33%, keeps us safely under the 5MB storage limit

const BACKGROUND_THEMES = [
  {
    id: "default", label: "Nebula", bg: "#0A0918",
    image: "radial-gradient(circle at 15% -10%, rgba(139,108,255,0.20) 0%, transparent 45%), radial-gradient(circle at 100% 110%, rgba(51,224,176,0.13) 0%, transparent 50%)",
  },
  {
    id: "sunset", label: "Sunset", bg: "#1A0F1F",
    image: "radial-gradient(circle at 20% 0%, rgba(255,107,87,0.26) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(255,194,75,0.18) 0%, transparent 55%)",
  },
  {
    id: "ocean", label: "Ocean", bg: "#071620",
    image: "radial-gradient(circle at 10% 10%, rgba(51,224,176,0.22) 0%, transparent 50%), radial-gradient(circle at 100% 90%, rgba(90,140,255,0.20) 0%, transparent 55%)",
  },
  {
    id: "forest", label: "Forest", bg: "#08130D",
    image: "radial-gradient(circle at 15% 0%, rgba(51,224,176,0.22) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(139,108,255,0.14) 0%, transparent 55%)",
  },
  {
    id: "midnight", label: "Midnight", bg: "#05050A",
    image: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.06) 0%, transparent 60%)",
  },
];

const ACHIEVEMENTS = [
  { id: "streak3", label: "3-Day Grind", icon: "\ud83d\udd25", check: (s) => s.streak >= 3 },
  { id: "streak7", label: "7-Day Grind", icon: "\ud83d\udd25", check: (s) => s.streak >= 7 },
  { id: "streak30", label: "Unstoppable — 30 Days", icon: "\ud83c\udfc6", check: (s) => s.streak >= 30 },
  { id: "first_task", label: "First Rep Done", icon: "\u2705", check: (s) => s.tasksCompleted >= 1 },
  { id: "tasks25", label: "25 Tasks Cleared", icon: "\ud83e\udde0", check: (s) => s.tasksCompleted >= 25 },
  { id: "tasks100", label: "Century Club", icon: "\ud83d\udcaf", check: (s) => s.tasksCompleted >= 100 },
  { id: "focus10", label: "10 Focus Sessions", icon: "\u23f1\ufe0f", check: (s) => s.totalFocusSessions >= 10 },
  { id: "level5", label: "Level 5 Reached", icon: "\u26a1", check: (s) => levelFromXp(s.xp) >= 5 },
  { id: "level10", label: "Level 10 Reached", icon: "\ud83c\udf1f", check: (s) => levelFromXp(s.xp) >= 10 },
];

/* ---------------------------------- storage ---------------------------------- */

async function loadKey(key, fallback) {
  try {
    const res = await window.storage.get(key);
    return res ? JSON.parse(res.value) : fallback;
  } catch {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value));
  } catch (e) {
    console.error("storage save failed", key, e);
  }
}

/* ---------------------------------- small UI atoms ---------------------------------- */

function Ring({ pct, size = 120, stroke = 10, color = "var(--violet)", children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c - (clamp(pct, 0, 100) / 100) * c}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(.4,1.4,.4,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

function Card({ children, style, className = "" }) {
  return <div className={`arc-card ${className}`} style={style}>{children}</div>;
}

function Pill({ children, style }) {
  return <span className="arc-pill" style={style}>{children}</span>;
}

function Btn({ children, onClick, variant = "primary", style, disabled, small }) {
  return (
    <button
      className={`arc-btn arc-btn-${variant} ${small ? "arc-btn-sm" : ""}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
}

/* ---------------------------------- main app ---------------------------------- */

export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("home");
  const [subjects, setSubjects] = useState([]);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [notes, setNotes] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [seenAchievements, setSeenAchievements] = useState([]);
  const [today, setToday] = useState(todayStr());
  const [energy, setEnergy] = useState(null);
  const [toast, setToast] = useState(null);

  /* ---- load ---- */
  useEffect(() => {
    (async () => {
      const [s, st, n, cfg, seen] = await Promise.all([
        loadKey("arc:subjects", []),
        loadKey("arc:stats", DEFAULT_STATS),
        loadKey("arc:notes", []),
        loadKey("arc:settings", DEFAULT_SETTINGS),
        loadKey("arc:achievements", []),
      ]);
      setSubjects(s);
      setStats({ ...DEFAULT_STATS, ...st });
      setNotes(n);
      setSettings({ ...DEFAULT_SETTINGS, ...cfg });
      setSeenAchievements(seen);
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (ready) saveKey("arc:subjects", subjects); }, [subjects, ready]);
  useEffect(() => { if (ready) saveKey("arc:stats", stats); }, [stats, ready]);
  useEffect(() => { if (ready) saveKey("arc:notes", notes); }, [notes, ready]);
  useEffect(() => { if (ready) saveKey("arc:settings", settings); }, [settings, ready]);
  useEffect(() => { if (ready) saveKey("arc:achievements", seenAchievements); }, [seenAchievements, ready]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(null), 2600);
  }, []);

  /* ---- streak + xp mechanics ---- */
  const bumpStreak = useCallback((s) => {
    const y = addDays(today, -1);
    if (s.lastCheckIn === today) return s;
    if (s.lastCheckIn === y) return { ...s, streak: s.streak + 1, lastCheckIn: today };
    return { ...s, streak: 1, lastCheckIn: today };
  }, [today]);

  const awardXp = useCallback((amount, coinAmount) => {
    setStats((prev) => {
      const bumped = bumpStreak(prev);
      const before = levelFromXp(bumped.xp);
      const next = { ...bumped, xp: bumped.xp + amount, coins: bumped.coins + coinAmount };
      const after = levelFromXp(next.xp);
      if (after > before) showToast(`\u26a1 Level up! You're now level ${after}`);
      return next;
    });
  }, [bumpStreak, showToast]);

  /* ---- derived: today's tasks (local heuristic) ---- */
  const allTasks = useMemo(() => {
    const list = [];
    subjects.forEach((subj) => {
      const daysLeft = subj.examDate ? daysBetween(today, subj.examDate) : 999;
      (subj.topics || []).forEach((t) => {
        if (t.done) {
          if ((t.reviewDates || []).includes(today)) {
            list.push({
              key: `${subj.id}:${t.id}:rev`,
              subjectId: subj.id, subjectName: subj.name, topicId: t.id, topicName: t.name,
              type: "revision", minutes: 10, difficulty: subj.difficulty || 2, daysLeft,
              score: 500 - daysLeft,
            });
          }
        } else {
          const diff = subj.difficulty || 2;
          const score = diff * 30 + Math.max(0, 60 - daysLeft) - (t.hours || 1) * 2;
          list.push({
            key: `${subj.id}:${t.id}:new`,
            subjectId: subj.id, subjectName: subj.name, topicId: t.id, topicName: t.name,
            type: "new", minutes: Math.round((t.hours || 1) * 60), difficulty: diff, daysLeft,
            score,
          });
        }
      });
    });
    return list.sort((a, b) => b.score - a.score);
  }, [subjects, today]);

  const [manualTodayIds, setManualTodayIds] = useState(null); // set of task keys when user rebuilds/limits plan
  const todaysPlan = useMemo(() => {
    const revisions = allTasks.filter((t) => t.type === "revision");
    const fresh = allTasks.filter((t) => t.type === "new");
    if (manualTodayIds) {
      return allTasks.filter((t) => manualTodayIds.has(t.key));
    }
    const budgetMin = settings.dailyHours * 60 - revisions.length * 10;
    const picked = [];
    let used = 0;
    for (const t of fresh) {
      if (used >= Math.max(budgetMin, 20)) break;
      picked.push(t);
      used += t.minutes;
    }
    return [...revisions, ...picked];
  }, [allTasks, manualTodayIds, settings.dailyHours]);

  const completeTask = (task) => {
    setSubjects((prev) =>
      prev.map((subj) => {
        if (subj.id !== task.subjectId) return subj;
        return {
          ...subj,
          topics: subj.topics.map((t) => {
            if (t.id !== task.topicId) return t;
            if (task.type === "revision") {
              const remaining = (t.reviewDates || []).filter((d) => d !== today);
              return { ...t, reviewDates: remaining, lastReviewed: today };
            }
            return {
              ...t, done: true, learnedDate: today,
              reviewDates: [addDays(today, 1), addDays(today, 4), addDays(today, 11)],
            };
          }),
        };
      })
    );
    const xp = task.difficulty * 10 + Math.round(task.minutes / 5);
    awardXp(xp, Math.round(xp / 3));
    setStats((prev) => ({ ...prev, tasksCompleted: prev.tasksCompleted + 1 }));
    showToast(`+${xp} XP \u2022 ${task.topicName} done`);
  };

  /* ---- overall readiness ---- */
  const subjectReadiness = (subj) => {
    const total = (subj.topics || []).length;
    if (!total) return 0;
    const done = subj.topics.filter((t) => t.done).length;
    return Math.round((done / total) * 100);
  };
  const overallReadiness = useMemo(() => {
    if (!subjects.length) return 0;
    return Math.round(subjects.reduce((sum, s) => sum + subjectReadiness(s), 0) / subjects.length);
  }, [subjects]);

  const nextExamSubject = useMemo(() => {
    const withDates = subjects.filter((s) => s.examDate);
    if (!withDates.length) return null;
    return [...withDates].sort((a, b) => new Date(a.examDate) - new Date(b.examDate))[0];
  }, [subjects]);

  const totalTopics = subjects.reduce((n, s) => n + (s.topics || []).length, 0);
  const doneTopics = subjects.reduce((n, s) => n + (s.topics || []).filter((t) => t.done).length, 0);
  const todayDonePct = todaysPlan.length ? 0 : 0; // computed live in TodayProgress via completedKeys

  const level = levelFromXp(stats.xp);
  const xpIntoLevel = stats.xp % XP_PER_LEVEL;

  const activeBg = useMemo(() => {
    if (settings.bgTheme === "image" && settings.bgImageData) {
      const brightness = clamp(settings.bgBrightness ?? 60, 5, 100);
      const overlayAlpha = ((100 - brightness) / 100) * 0.85;
      return {
        background: "#0A0918",
        backgroundImage: `linear-gradient(rgba(6,6,14,${overlayAlpha.toFixed(2)}), rgba(6,6,14,${overlayAlpha.toFixed(2)})), url(${settings.bgImageData})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      };
    }
    if (settings.bgTheme === "custom" && settings.bgCustomColor) {
      return {
        background: settings.bgCustomColor,
        backgroundImage: "radial-gradient(circle at 15% -10%, rgba(255,255,255,0.10) 0%, transparent 45%), radial-gradient(circle at 100% 110%, rgba(0,0,0,0.15) 0%, transparent 50%)",
      };
    }
    const theme = BACKGROUND_THEMES.find((t) => t.id === settings.bgTheme) || BACKGROUND_THEMES[0];
    return { background: theme.bg, backgroundImage: theme.image };
  }, [settings.bgTheme, settings.bgCustomColor, settings.bgImageData, settings.bgBrightness]);

  if (!ready) {
    return (
      <div style={{ ...rootStyle, ...activeBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <GlobalStyle />
        <div style={{ color: "var(--text-dim)", fontFamily: "Inter, sans-serif" }}>Loading ARC\u2026</div>
      </div>
    );
  }

  return (
    <div style={{ ...rootStyle, ...activeBg }}>
      <GlobalStyle />
      {toast && <div className="arc-toast">{toast}</div>}
      <div className="arc-shell">
        <SideNav tab={tab} setTab={setTab} />
        <main className="arc-main">
          <HudBar stats={stats} level={level} xpIntoLevel={xpIntoLevel} />
          <BackgroundBanner settings={settings} setSettings={setSettings} showToast={showToast} />
          {tab === "home" && (
            <HomeTab
              stats={stats} subjects={subjects} today={today}
              overallReadiness={overallReadiness} nextExamSubject={nextExamSubject}
              subjectReadiness={subjectReadiness} todaysPlan={todaysPlan}
              completeTask={completeTask} energy={energy} setEnergy={setEnergy}
              setManualTodayIds={setManualTodayIds} allTasks={allTasks}
              settings={settings} setTab={setTab}
            />
          )}
          {tab === "planner" && (
            <PlannerTab
              subjects={subjects} setSubjects={setSubjects} settings={settings}
              setSettings={setSettings} today={today} showToast={showToast}
              subjectReadiness={subjectReadiness}
            />
          )}
          {tab === "focus" && (
            <FocusTab stats={stats} setStats={setStats} today={today} awardXp={awardXp} showToast={showToast} settings={settings} setSettings={setSettings} />
          )}
          {tab === "notes" && <NotesTab notes={notes} setNotes={setNotes} subjects={subjects} showToast={showToast} />}
          {tab === "analytics" && <AnalyticsTab subjects={subjects} stats={stats} />}
          {tab === "rooms" && <RoomsTab notes={notes} showToast={showToast} />}
          {tab === "doubts" && <AskDoubtTab subjects={subjects} showToast={showToast} />}
        </main>
      </div>
    </div>
  );
}

const rootStyle = {
  minHeight: "100vh", width: "100%",
  color: "var(--text)", fontFamily: "Inter, -apple-system, sans-serif",
  transition: "background 0.4s ease",
};

/* ---------------------------------- global style ---------------------------------- */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
      :root {
        --bg: #0A0918;
        --surface: rgba(255,255,255,0.045);
        --surface-2: rgba(255,255,255,0.075);
        --surface-border: rgba(255,255,255,0.09);
        --text: #F4F2FF;
        --text-dim: #A9A3C9;
        --text-faint: #6E6790;
        --violet: #8B6CFF;
        --violet-soft: #B9A6FF;
        --coral: #FF6B57;
        --mint: #33E0B0;
        --amber: #FFC24B;
        --red: #FF5C7A;
        --gold: #FFD866;
      }
      * { box-sizing: border-box; }
      h1, h2, h3, .arc-display { font-family: 'Space Grotesk', sans-serif; }
      .arc-shell { display: flex; min-height: 100vh; }
      .arc-main { flex: 1; padding: 20px 28px 90px; max-width: 1080px; margin: 0 auto; width: 100%; }
      .arc-card {
        background: var(--surface); border: 1px solid var(--surface-border);
        border-radius: 20px; padding: 20px;
      }
      .arc-pill {
        display: inline-flex; align-items: center; gap: 6px;
        background: var(--surface-2); border: 1px solid var(--surface-border);
        border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 600;
      }
      .arc-btn {
        border: none; border-radius: 14px; padding: 11px 18px; font-weight: 600;
        font-size: 14px; cursor: pointer; display: inline-flex; align-items: center;
        gap: 8px; transition: transform 0.15s ease, filter 0.15s ease; font-family: inherit;
      }
      .arc-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
      .arc-btn:active:not(:disabled) { transform: translateY(0); }
      .arc-btn:disabled { opacity: 0.45; cursor: not-allowed; }
      .arc-btn-primary { background: linear-gradient(135deg, var(--violet), #6E4CFF); color: white; }
      .arc-btn-ghost { background: var(--surface-2); color: var(--text); }
      .arc-btn-danger { background: rgba(255,92,122,0.15); color: var(--red); }
      .arc-btn-mint { background: linear-gradient(135deg, var(--mint), #17B98E); color: #04241C; }
      .arc-btn-sm { padding: 7px 12px; font-size: 12.5px; border-radius: 10px; }
      input, textarea, select {
        background: rgba(255,255,255,0.05); border: 1px solid var(--surface-border);
        border-radius: 12px; padding: 10px 12px; color: var(--text); font-family: inherit;
        font-size: 14px; outline: none; width: 100%;
      }
      input:focus, textarea:focus, select:focus { border-color: var(--violet); }
      input::placeholder, textarea::placeholder { color: var(--text-faint); }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-thumb { background: var(--surface-border); border-radius: 8px; }
      .arc-toast {
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: #17152C; border: 1px solid var(--surface-border); color: var(--text);
        padding: 12px 20px; border-radius: 14px; z-index: 999; font-weight: 600; font-size: 14px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.5); animation: arc-toast-in 0.3s ease;
      }
      @keyframes arc-toast-in { from { opacity: 0; transform: translate(-50%, -12px); } to { opacity: 1; transform: translate(-50%, 0); } }
      @media (max-width: 820px) {
        .arc-shell { flex-direction: column; }
        .arc-main { padding: 16px 14px 100px; }
      }
      @media (prefers-reduced-motion: reduce) {
        * { animation: none !important; transition: none !important; }
      }
    `}</style>
  );
}

/* ---------------------------------- nav ---------------------------------- */

function SideNav({ tab, setTab }) {
  const items = [
    { id: "home", label: "Home", icon: Home },
    { id: "planner", label: "Planner", icon: BookOpen },
    { id: "focus", label: "Focus", icon: Timer },
    { id: "notes", label: "Notes", icon: StickyNote },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "rooms", label: "Rooms", icon: Users },
    { id: "doubts", label: "Ask Doubt", icon: Brain },
  ];
  return (
    <>
      <nav className="arc-side-desktop" style={{
        width: 216, padding: "26px 14px", borderRight: "1px solid var(--surface-border)",
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px 22px" }}>
          <Sparkles size={20} color="var(--violet-soft)" />
          <span className="arc-display" style={{ fontWeight: 700, fontSize: 20, letterSpacing: 0.3 }}>ARC</span>
        </div>
        {items.map((it) => {
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                borderRadius: 12, border: "none", cursor: "pointer", textAlign: "left",
                background: active ? "var(--surface-2)" : "transparent",
                color: active ? "var(--text)" : "var(--text-dim)", fontWeight: 600, fontSize: 14.5,
                fontFamily: "inherit",
              }}
            >
              <Icon size={18} color={active ? "var(--violet-soft)" : "currentColor"} />
              {it.label}
            </button>
          );
        })}
      </nav>
      <nav className="arc-side-mobile" style={{
        display: "none", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "#100E22", borderTop: "1px solid var(--surface-border)",
        justifyContent: "space-around", padding: "8px 4px",
      }}>
        {items.map((it) => {
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <button key={it.id} onClick={() => setTab(it.id)} style={{
              background: "none", border: "none", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 3, color: active ? "var(--violet-soft)" : "var(--text-faint)",
              fontSize: 10.5, fontWeight: 600, padding: 4,
            }}>
              <Icon size={19} />
              {it.label}
            </button>
          );
        })}
      </nav>
      <style>{`
        @media (max-width: 820px) {
          .arc-side-desktop { display: none; }
          .arc-side-mobile { display: flex !important; }
        }
      `}</style>
    </>
  );
}

/* ---------------------------------- hud bar ---------------------------------- */

function HudBar({ stats, level, xpIntoLevel }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
      marginBottom: 22, justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center",
          justifyContent: "center", background: "linear-gradient(135deg, var(--violet), #6E4CFF)",
          fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15,
        }}>
          {level}
        </div>
        <div style={{ minWidth: 130 }}>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", fontWeight: 600, marginBottom: 4 }}>
            {xpIntoLevel} / {XP_PER_LEVEL} XP
          </div>
          <div style={{ width: 130, height: 7, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{
              width: `${(xpIntoLevel / XP_PER_LEVEL) * 100}%`, height: "100%",
              background: "linear-gradient(90deg, var(--violet), var(--violet-soft))",
              transition: "width 0.5s ease",
            }} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Pill><Flame size={15} color="var(--coral)" /> {stats.streak} day streak</Pill>
        <Pill><Coins size={15} color="var(--gold)" /> {stats.coins}</Pill>
      </div>
    </div>
  );
}

/* ---------------------------------- background banner ---------------------------------- */

function BackgroundBanner({ settings, setSettings, showToast }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const activeId = settings.bgTheme || "default";

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast?.("Please choose an image file");
      return;
    }
    if (file.size > MAX_BG_IMAGE_BYTES) {
      showToast?.(`Image too large — keep it under ${Math.round(MAX_BG_IMAGE_BYTES / (1024 * 1024))}MB`);
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setSettings((s) => ({ ...s, bgTheme: "image", bgImageData: reader.result }));
      setUploading(false);
      showToast?.("Background image set");
    };
    reader.onerror = () => {
      setUploading(false);
      showToast?.("Couldn't read that image, try another one");
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSettings((s) => ({ ...s, bgTheme: "default", bgImageData: null }));
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="arc-btn arc-btn-ghost arc-btn-sm"
        style={{ marginBottom: 16 }}
      >
        <Palette size={13} /> Change background
      </button>
    );
  }

  return (
    <Card style={{
      background: "rgba(139,108,255,0.08)", border: "1px solid rgba(139,108,255,0.25)",
      marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Palette size={16} color="var(--violet-soft)" />
            <span style={{ fontWeight: 700, fontSize: 14.5 }}>Set your vibe</span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
            Pick a background for the whole app, choose your own color, or upload a photo.
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="arc-btn arc-btn-ghost arc-btn-sm"
          style={{ padding: "6px 9px" }}
        >
          <X size={13} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
        {BACKGROUND_THEMES.map((t) => {
          const active = activeId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSettings((s) => ({ ...s, bgTheme: t.id }))}
              title={t.label}
              style={{
                width: 42, height: 42, borderRadius: 12, cursor: "pointer", padding: 0,
                background: t.bg, backgroundImage: t.image, backgroundSize: "cover",
                border: active ? "2px solid var(--violet-soft)" : "2px solid transparent",
                boxShadow: active ? "0 0 0 3px rgba(139,108,255,0.30)" : "none",
                transition: "transform 0.15s ease",
              }}
            />
          );
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="color"
            value={settings.bgCustomColor || "#0A0918"}
            onChange={(e) => setSettings((s) => ({ ...s, bgTheme: "custom", bgCustomColor: e.target.value }))}
            title="Pick a custom color"
            style={{ width: 42, height: 42, padding: 2, borderRadius: 12, cursor: "pointer" }}
          />
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Custom</span>
        </div>

        <div style={{ width: 1, alignSelf: "stretch", background: "var(--surface-border)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload your own background image"
            disabled={uploading}
            style={{
              width: 42, height: 42, borderRadius: 12, cursor: uploading ? "wait" : "pointer", padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: activeId === "image" && settings.bgImageData ? `center / cover no-repeat url(${settings.bgImageData})` : "var(--surface-2)",
              border: activeId === "image" ? "2px solid var(--violet-soft)" : "2px solid transparent",
              boxShadow: activeId === "image" ? "0 0 0 3px rgba(139,108,255,0.30)" : "none",
            }}
          >
            {!(activeId === "image" && settings.bgImageData) && (
              uploading
                ? <Sparkles size={16} color="var(--text-dim)" />
                : <Plus size={16} color="var(--text-dim)" />
            )}
          </button>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Upload image</span>
          {activeId === "image" && settings.bgImageData && (
            <button
              onClick={removeImage}
              className="arc-btn arc-btn-ghost arc-btn-sm"
              style={{ padding: "6px 9px" }}
              title="Remove uploaded image"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {activeId === "image" && settings.bgImageData && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Brightness</span>
            <input
              type="range"
              min={5}
              max={100}
              value={settings.bgBrightness ?? 60}
              onChange={(e) => setSettings((s) => ({ ...s, bgBrightness: Number(e.target.value) }))}
              title="Dim or brighten your background image"
              style={{ width: 110, cursor: "pointer" }}
            />
            <span style={{ fontSize: 11.5, color: "var(--text-faint)", width: 30, textAlign: "right" }}>
              {settings.bgBrightness ?? 60}%
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------------------------------- home tab ---------------------------------- */

function HomeTab({
  stats, subjects, today, overallReadiness, nextExamSubject, subjectReadiness,
  todaysPlan, completeTask, energy, setEnergy, setManualTodayIds, allTasks, settings, setTab,
}) {
  const [completedKeys, setCompletedKeys] = useState(() => new Set());
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [hoursLeft, setHoursLeft] = useState(1);

  const remaining = todaysPlan.filter((t) => !completedKeys.has(t.key));
  const donePct = todaysPlan.length ? Math.round((completedKeys.size / todaysPlan.length) * 100) : 0;

  const handleComplete = (task) => {
    setCompletedKeys((prev) => new Set(prev).add(task.key));
    completeTask(task);
  };

  const recommendation = useMemo(() => {
    const pool = remaining.length ? remaining : allTasks;
    if (!pool.length) return null;
    if (energy === "low") {
      return [...pool].sort((a, b) => a.minutes - b.minutes)[0];
    }
    if (energy === "high") {
      return [...pool].sort((a, b) => b.minutes * b.difficulty - a.minutes * a.difficulty)[0];
    }
    return pool[Math.floor(pool.length / 2)];
  }, [energy, remaining, allTasks]);

  const rebuildPlan = () => {
    const budget = hoursLeft * 60;
    const revisions = allTasks.filter((t) => t.type === "revision");
    const fresh = allTasks.filter((t) => t.type === "new");
    let used = revisions.length * 10;
    const picked = [];
    for (const t of fresh) {
      if (used >= budget) break;
      picked.push(t);
      used += t.minutes;
    }
    setManualTodayIds(new Set([...revisions, ...picked].map((t) => t.key)));
    setCompletedKeys(new Set());
    setRebuildOpen(false);
  };

  if (!subjects.length) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Let's set up your first exam"
        body="Add a subject with its exam date and syllabus in Planner, and ARC will build your daily plan automatically."
        cta="Go to Planner"
        onClick={() => setTab("planner")}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* exam countdown hero */}
      {nextExamSubject && (
        <Card style={{
          background: "linear-gradient(135deg, rgba(139,108,255,0.16), rgba(51,224,176,0.08))",
          border: "1px solid rgba(139,108,255,0.28)",
          display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", fontWeight: 600, marginBottom: 6 }}>
              NEXT UP
            </div>
            <h2 className="arc-display" style={{ margin: 0, fontSize: 26 }}>{nextExamSubject.name}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <CalendarClock size={17} color="var(--violet-soft)" />
              <span style={{ fontSize: 15, fontWeight: 600 }}>
                {Math.max(0, daysBetween(today, nextExamSubject.examDate))} days left
              </span>
            </div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6, maxWidth: 320 }}>
              {(nextExamSubject.topics || []).slice(0, 4).map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--text-dim)" }}>
                  <span>{STATUS_DOT[t.status || "average"]}</span>
                  <span style={{ textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.55 : 1 }}>{t.name}</span>
                </div>
              ))}
            </div>
          </div>
          <Ring pct={subjectReadiness(nextExamSubject)} color="var(--mint)" size={128}>
            <div style={{ textAlign: "center" }}>
              <div className="arc-display" style={{ fontSize: 26, fontWeight: 700 }}>{subjectReadiness(nextExamSubject)}%</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>ready</div>
            </div>
          </Ring>
        </Card>
      )}

      {/* stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <StatCard icon={Flame} color="var(--coral)" label="Streak" value={`${stats.streak}d`} />
        <StatCard icon={TrendingUp} color="var(--mint)" label="Today's progress" value={`${donePct}%`} />
        <StatCard icon={Layers} color="var(--violet-soft)" label="Tasks remaining" value={remaining.length} />
        <StatCard icon={Clock} color="var(--amber)" label="Focus today" value={`${stats.focusMinutesToday}m`} />
      </div>

      {/* what should i study now */}
      <Card>
        <h3 className="arc-display" style={{ margin: "0 0 4px", fontSize: 17 }}>What should I study now?</h3>
        <p style={{ margin: "0 0 14px", color: "var(--text-dim)", fontSize: 13.5 }}>Tell ARC your energy — skip the decision fatigue.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: recommendation ? 16 : 0 }}>
          {[
            { id: "low", label: "\ud83e\udd71 Low", },
            { id: "mid", label: "\ud83d\ude10 Normal" },
            { id: "high", label: "\ud83d\udd25 Locked In" },
          ].map((e) => (
            <button
              key={e.id}
              onClick={() => setEnergy(e.id)}
              className="arc-btn"
              style={{
                background: energy === e.id ? "linear-gradient(135deg, var(--violet), #6E4CFF)" : "var(--surface-2)",
                color: energy === e.id ? "white" : "var(--text)",
              }}
            >
              {e.label}
            </button>
          ))}
        </div>
        {recommendation && energy && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            background: "var(--surface-2)", borderRadius: 14, padding: "12px 16px", flexWrap: "wrap",
          }}>
            <div>
              <div style={{ fontWeight: 700 }}>{recommendation.subjectName} — {recommendation.topicName}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
                {recommendation.type === "revision" ? "Quick revision" : `${recommendation.minutes} min focused session`}
              </div>
            </div>
            <Btn small onClick={() => handleComplete(recommendation)}>Mark done <Check size={14} /></Btn>
          </div>
        )}
      </Card>

      {/* today's plan */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h3 className="arc-display" style={{ margin: 0, fontSize: 17 }}>Today's plan</h3>
          <Btn variant="ghost" small onClick={() => setRebuildOpen((v) => !v)}>
            <Skull size={14} /> I messed up my schedule
          </Btn>
        </div>
        {rebuildOpen && (
          <div style={{ background: "var(--surface-2)", borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, color: "var(--text-dim)", marginBottom: 10 }}>
              No stress. How many hours do you realistically have left today? ARC will rebuild your plan around it.
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input type="number" min="0.5" step="0.5" value={hoursLeft}
                onChange={(e) => setHoursLeft(Number(e.target.value))} style={{ width: 90 }} />
              <span style={{ fontSize: 13.5 }}>hours</span>
              <Btn small onClick={rebuildPlan}>Rebuild plan</Btn>
            </div>
          </div>
        )}
        {todaysPlan.length === 0 ? (
          <div style={{ color: "var(--text-dim)", fontSize: 14 }}>Nothing scheduled — you're clear for today. \ud83c\udf89</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {todaysPlan.map((task) => {
              const done = completedKeys.has(task.key);
              return (
                <div key={task.key} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                  padding: "11px 14px", borderRadius: 12,
                  background: done ? "rgba(51,224,176,0.08)" : "rgba(255,255,255,0.03)",
                  border: "1px solid " + (done ? "rgba(51,224,176,0.25)" : "var(--surface-border)"),
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={() => !done && handleComplete(task)} style={{ background: "none", border: "none", cursor: done ? "default" : "pointer", padding: 0 }}>
                      {done ? <CheckCircle2 size={20} color="var(--mint)" /> : <Circle size={20} color="var(--text-faint)" />}
                    </button>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14.5, textDecoration: done ? "line-through" : "none", opacity: done ? 0.55 : 1 }}>
                        {task.subjectName} — {task.topicName}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                        {task.type === "revision" ? "Spaced revision" : "New topic"} \u2022 {task.minutes} min
                      </div>
                    </div>
                  </div>
                  {task.type === "revision" && <Pill style={{ fontSize: 11 }}>\ud83e\udde9 Review</Pill>}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value }) {
  return (
    <Card style={{ padding: 16 }}>
      <Icon size={18} color={color} />
      <div className="arc-display" style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{label}</div>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, body, cta, onClick }) {
  return (
    <Card style={{ textAlign: "center", padding: "48px 24px" }}>
      <Icon size={30} color="var(--violet-soft)" style={{ margin: "0 auto 14px" }} />
      <h2 className="arc-display" style={{ margin: "0 0 8px", fontSize: 20 }}>{title}</h2>
      <p style={{ color: "var(--text-dim)", maxWidth: 380, margin: "0 auto 18px", fontSize: 14 }}>{body}</p>
      {cta && <Btn onClick={onClick}>{cta} <ChevronRight size={15} /></Btn>}
    </Card>
  );
}

/* ---------------------------------- planner tab ---------------------------------- */

function PlannerTab({ subjects, setSubjects, settings, setSettings, today, showToast, subjectReadiness }) {
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState({ name: "", examDate: "", difficulty: 2 });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlanText, setAiPlanText] = useState(null);

  const addSubject = () => {
    if (!form.name.trim()) return;
    setSubjects((prev) => [...prev, { id: uid(), name: form.name.trim(), examDate: form.examDate, difficulty: Number(form.difficulty), topics: [] }]);
    setForm({ name: "", examDate: "", difficulty: 2 });
    setOpenForm(false);
  };

  const removeSubject = (id) => setSubjects((prev) => prev.filter((s) => s.id !== id));

  const addTopic = (subjId, topicForm) => {
    setSubjects((prev) => prev.map((s) => s.id !== subjId ? s : {
      ...s, topics: [...s.topics, { id: uid(), name: topicForm.name, hours: Number(topicForm.hours) || 1, status: "average", done: false, reviewDates: [] }],
    }));
  };

  const removeTopic = (subjId, topicId) => {
    setSubjects((prev) => prev.map((s) => s.id !== subjId ? s : { ...s, topics: s.topics.filter((t) => t.id !== topicId) }));
  };

  const cycleStatus = (subjId, topicId) => {
    const order = ["weak", "average", "strong"];
    setSubjects((prev) => prev.map((s) => s.id !== subjId ? s : {
      ...s, topics: s.topics.map((t) => t.id !== topicId ? t : { ...t, status: order[(order.indexOf(t.status || "average") + 1) % 3] }),
    }));
  };

  const toggleDone = (subjId, topicId) => {
    setSubjects((prev) => prev.map((s) => s.id !== subjId ? s : {
      ...s, topics: s.topics.map((t) => {
        if (t.id !== topicId) return t;
        const nowDone = !t.done;
        return {
          ...t, done: nowDone,
          learnedDate: nowDone ? today : t.learnedDate,
          reviewDates: nowDone ? [addDays(today, 1), addDays(today, 4), addDays(today, 11)] : [],
        };
      }),
    }));
  };

  const generateAiPlan = async () => {
    if (!subjects.length) { showToast("Add at least one subject first"); return; }
    setAiLoading(true);
    setAiPlanText(null);
    try {
      const payload = subjects.map((s) => ({
        subject: s.name, examDate: s.examDate || "unscheduled", difficulty: s.difficulty,
        topics: (s.topics || []).map((t) => ({ name: t.name, hours: t.hours, done: t.done, status: t.status })),
      }));
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a study planning assistant. Today's date is ${today}. The student has ${settings.dailyHours} hours available to study per day. Here is their subject/syllabus data as JSON:\n${JSON.stringify(payload)}\n\nWrite a short, encouraging 4-6 sentence study plan for the next 3 days, prioritizing subjects with closer exam dates, higher difficulty, and weaker/undone topics. Mention specific topic names. Keep it conversational and motivating, no markdown headers, no bullet lists, plain prose only.`,
          }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).map((b) => b.text || "").join("\n").trim();
      setAiPlanText(text || "Couldn't generate a plan right now — try again in a moment.");
    } catch (e) {
      setAiPlanText("Couldn't reach the AI planner right now. Your local plan on the Home tab is still prioritized automatically.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Daily available hours</div>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Used to size your automatic daily plan</div>
        </div>
        <input type="number" min="0.5" step="0.5" value={settings.dailyHours}
          onChange={(e) => setSettings((s) => ({ ...s, dailyHours: Number(e.target.value) }))}
          style={{ width: 90 }} />
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h3 className="arc-display" style={{ margin: "0 0 4px", fontSize: 16 }}>
              <Sparkles size={16} color="var(--violet-soft)" style={{ verticalAlign: -3, marginRight: 6 }} />
              AI plan
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>Let Claude look at your full syllabus and suggest what to prioritize next.</p>
          </div>
          <Btn onClick={generateAiPlan} disabled={aiLoading}>{aiLoading ? "Thinking\u2026" : "Generate plan"}</Btn>
        </div>
        {aiPlanText && (
          <div style={{ marginTop: 14, background: "var(--surface-2)", borderRadius: 14, padding: 14, fontSize: 14, lineHeight: 1.6, color: "var(--text)" }}>
            {aiPlanText}
          </div>
        )}
      </Card>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 className="arc-display" style={{ margin: 0, fontSize: 17 }}>Your subjects</h3>
        <Btn small onClick={() => setOpenForm((v) => !v)}><Plus size={15} /> Add subject</Btn>
      </div>

      {openForm && (
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
            <div>
              <label style={labelStyle}>Subject name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Engineering Maths" />
            </div>
            <div>
              <label style={labelStyle}>Exam date</label>
              <input type="date" value={form.examDate} onChange={(e) => setForm((f) => ({ ...f, examDate: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Difficulty</label>
              <select value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}>
                <option value={1}>Easy</option>
                <option value={2}>Medium</option>
                <option value={3}>Hard</option>
              </select>
            </div>
            <Btn onClick={addSubject}>Add</Btn>
          </div>
        </Card>
      )}

      {subjects.length === 0 && !openForm && (
        <EmptyState icon={BookOpen} title="No subjects yet" body="Add a subject, its exam date, and syllabus topics to get your automatic study plan." />
      )}

      {subjects.map((s) => (
        <SubjectCard
          key={s.id} subject={s} readiness={subjectReadiness(s)} today={today}
          onRemove={() => removeSubject(s.id)} onAddTopic={(t) => addTopic(s.id, t)}
          onRemoveTopic={(tid) => removeTopic(s.id, tid)} onCycleStatus={(tid) => cycleStatus(s.id, tid)}
          onToggleDone={(tid) => toggleDone(s.id, tid)}
        />
      ))}
    </div>
  );
}

/* ---------------------------------- ask doubt (ai chatbot) tab ---------------------------------- */

const DOUBT_SUGGESTIONS = [
  "Explain this topic like I'm 5",
  "Give me a quick memory trick for this",
  "What's the difference between these two concepts?",
  "Quiz me with one question on this",
];

function AskDoubtTab({ subjects, showToast }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [subjectFocus, setSubjectFocus] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async (raw) => {
    const q = (raw ?? input).trim();
    if (!q || loading) return;
    const nextMessages = [...messages, { role: "user", content: q }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const subjNote = subjectFocus ? `The student flagged this question as being about: ${subjectFocus}. ` : "";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: `You are a patient, encouraging study tutor inside a student's exam-prep app called ARC. ${subjNote}Answer the student's doubt clearly and simply, breaking it down step by step where that helps. Keep answers focused rather than exhaustive. Plain text with occasional short bullet points is fine — no markdown headers.`,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const answer = (data.content || []).map((b) => b.text || "").join("\n").trim();
      setMessages((prev) => [...prev, { role: "assistant", content: answer || "Hmm, I couldn't work that one out — try rephrasing your doubt?" }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Couldn't reach the AI tutor right now. Please try again in a moment." }]);
      showToast?.("AI tutor is unreachable right now");
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => setMessages([]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 className="arc-display" style={{ margin: "0 0 4px", fontSize: 16 }}>
            <Brain size={16} color="var(--violet-soft)" style={{ verticalAlign: -3, marginRight: 6 }} />
            Ask a doubt
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>
            Stuck on something? Ask Claude and get a clear explanation, right here.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {subjects.length > 0 && (
            <select value={subjectFocus} onChange={(e) => setSubjectFocus(e.target.value)} style={{ width: 170 }}>
              <option value="">General doubt</option>
              {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          )}
          {messages.length > 0 && (
            <Btn variant="ghost" small onClick={clearChat}><Trash2 size={13} /> Clear</Btn>
          )}
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div
          ref={scrollRef}
          style={{ maxHeight: 440, minHeight: 220, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
        >
          {messages.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 10px" }}>
              <Brain size={26} color="var(--violet-soft)" style={{ margin: "0 auto 10px" }} />
              <div style={{ fontWeight: 700, marginBottom: 4 }}>What's your doubt?</div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 14 }}>
                Ask about a tricky concept, a problem you're stuck on, or anything from your syllabus.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {DOUBT_SUGGESTIONS.map((s) => (
                  <Pill key={s} style={{ cursor: "pointer" }}>
                    <span onClick={() => send(s)}>{s}</span>
                  </Pill>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "82%",
                  background: m.role === "user" ? "linear-gradient(135deg, var(--violet), #6E4CFF)" : "var(--surface-2)",
                  color: m.role === "user" ? "white" : "var(--text)",
                  borderRadius: 16, padding: "10px 14px", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            ))
          )}
          {loading && (
            <div style={{ alignSelf: "flex-start", background: "var(--surface-2)", borderRadius: 16, padding: "10px 14px", fontSize: 13, color: "var(--text-dim)" }}>
              Thinking…
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, padding: 14, borderTop: "1px solid var(--surface-border)" }}>
          <input
            placeholder="Type your doubt…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <Btn onClick={() => send()} disabled={loading || !input.trim()}><Send size={15} /></Btn>
        </div>
      </Card>
    </div>
  );
}

const labelStyle = { fontSize: 11.5, color: "var(--text-dim)", fontWeight: 600, marginBottom: 5, display: "block" };

function SubjectCard({ subject, readiness, today, onRemove, onAddTopic, onRemoveTopic, onCycleStatus, onToggleDone }) {
  const [topicForm, setTopicForm] = useState({ name: "", hours: 1 });
  const daysLeft = subject.examDate ? daysBetween(today, subject.examDate) : null;

  const submitTopic = () => {
    if (!topicForm.name.trim()) return;
    onAddTopic({ name: topicForm.name.trim(), hours: topicForm.hours });
    setTopicForm({ name: "", hours: 1 });
  };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 className="arc-display" style={{ margin: "0 0 4px", fontSize: 17 }}>{subject.name}</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: "var(--text-dim)" }}>
            {daysLeft !== null && <span>\u23f3 {daysLeft} days left</span>}
            <span>{["", "Easy", "Medium", "Hard"][subject.difficulty] || "Medium"}</span>
            <span>{readiness}% ready</span>
          </div>
        </div>
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer" }}>
          <Trash2 size={16} color="var(--text-faint)" />
        </button>
      </div>

      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", margin: "14px 0", overflow: "hidden" }}>
        <div style={{ width: `${readiness}%`, height: "100%", background: "linear-gradient(90deg, var(--violet), var(--mint))", transition: "width 0.5s ease" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {(subject.topics || []).map((t) => (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            padding: "9px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => onToggleDone(t.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                {t.done ? <CheckCircle2 size={18} color="var(--mint)" /> : <Circle size={18} color="var(--text-faint)" />}
              </button>
              <span style={{ fontSize: 14, textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.55 : 1 }}>{t.name}</span>
              <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{t.hours}h</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => onCycleStatus(t.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }} title="Click to change status">
                {STATUS_DOT[t.status || "average"]}
              </button>
              <button onClick={() => onRemoveTopic(t.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={14} color="var(--text-faint)" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input placeholder="Add topic (e.g. Thermodynamics)" value={topicForm.name}
          onChange={(e) => setTopicForm((f) => ({ ...f, name: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && submitTopic()} style={{ flex: 1, minWidth: 160 }} />
        <input type="number" min="0.5" step="0.5" value={topicForm.hours}
          onChange={(e) => setTopicForm((f) => ({ ...f, hours: e.target.value }))} style={{ width: 80 }} />
        <Btn small onClick={submitTopic}><Plus size={14} /></Btn>
      </div>
    </Card>
  );
}

/* ---------------------------------- focus tab ---------------------------------- */

function FocusTab({ stats, setStats, today, awardXp, showToast, settings, setSettings }) {
  const focusMinutes = clamp(settings.focusMinutes ?? 25, 1, 180);
  const breakMinutes = clamp(settings.breakMinutes ?? 5, 1, 60);
  const FOCUS_LEN = focusMinutes * 60;
  const BREAK_LEN = breakMinutes * 60;
  const [mode, setMode] = useState("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_LEN);
  const [running, setRunning] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const toneRef = useRef(null);

  // keep the countdown in sync with the configured length whenever it's not running
  useEffect(() => {
    if (running) return;
    setSecondsLeft(mode === "focus" ? FOCUS_LEN : BREAK_LEN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [FOCUS_LEN, BREAK_LEN, mode]);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(iv);
          handleSessionEnd();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode]);

  const handleSessionEnd = () => {
    setRunning(false);
    if (mode === "focus") {
      const xp = Math.max(5, Math.round(20 * (focusMinutes / 25)));
      const coins = Math.max(2, Math.round(10 * (focusMinutes / 25)));
      setStats((prev) => {
        const y = addDays(today, -1);
        let focusStreak = prev.focusStreak;
        if (prev.lastFocusDay === today) { /* already counted today */ }
        else if (prev.lastFocusDay === y) focusStreak = prev.focusStreak + 1;
        else focusStreak = 1;
        return {
          ...prev, focusMinutesToday: prev.focusDay === today ? prev.focusMinutesToday + focusMinutes : focusMinutes,
          focusDay: today, totalFocusSessions: prev.totalFocusSessions + 1,
          focusStreak, lastFocusDay: today,
        };
      });
      awardXp(xp, coins);
      showToast(`\ud83c\udfaf Session complete — +${xp} XP, break time`);
      setMode("break");
      setSecondsLeft(BREAK_LEN);
    } else {
      showToast("Break's over — ready for another round?");
      setMode("focus");
      setSecondsLeft(FOCUS_LEN);
    }
  };

  const toggleSound = async () => {
    if (soundOn) {
      toneRef.current?.stop?.();
      toneRef.current = null;
      setSoundOn(false);
      return;
    }
    try {
      const Tone = await import("tone");
      await Tone.start();
      const noise = new Tone.Noise("pink").start();
      const filter = new Tone.Filter(500, "lowpass").toDestination();
      const gain = new Tone.Gain(0.06).connect(filter);
      noise.connect(gain);
      toneRef.current = { stop: () => { noise.stop(); noise.dispose(); filter.dispose(); gain.dispose(); } };
      setSoundOn(true);
    } catch (e) {
      showToast("Ambient sound unavailable right now");
    }
  };

  useEffect(() => () => toneRef.current?.stop?.(), []);

  const total = mode === "focus" ? FOCUS_LEN : BREAK_LEN;
  const pct = ((total - secondsLeft) / total) * 100;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const shell = immersive ? {
    position: "fixed", inset: 0, background: "var(--bg)", zIndex: 100,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
  } : {};

  const content = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: immersive ? 0 : "20px 0" }}>
      <Pill>{mode === "focus" ? "\ud83e\uddd8 Focus" : "\u2615 Break"}</Pill>
      <Ring pct={pct} size={immersive ? 260 : 210} stroke={14} color={mode === "focus" ? "var(--violet)" : "var(--mint)"}>
        <div style={{ textAlign: "center" }}>
          <div className="arc-display" style={{ fontSize: immersive ? 52 : 42, fontWeight: 700 }}>{mm}:{ss}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{stats.focusStreak > 0 ? `\ud83d\udd25 ${stats.focusStreak} day focus streak` : "start your focus streak"}</div>
        </div>
      </Ring>
      <div style={{ display: "flex", gap: 12 }}>
        <Btn onClick={() => setRunning((r) => !r)}>
          {running ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Start</>}
        </Btn>
        <Btn variant="ghost" onClick={() => { setRunning(false); setSecondsLeft(mode === "focus" ? FOCUS_LEN : BREAK_LEN); }}>
          <RotateCcw size={16} />
        </Btn>
        <Btn variant="ghost" onClick={toggleSound}>
          {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </Btn>
        <Btn variant="ghost" onClick={() => setImmersive((v) => !v)}>
          {immersive ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </Btn>
      </div>
      {immersive && <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Press the minimize icon to exit focus mode</div>}
    </div>
  );

  if (immersive) return <div style={shell}>{content}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ display: "flex", justifyContent: "center" }}>{content}</Card>
      {!running && <TimerLengthEditor settings={settings} setSettings={setSettings} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <StatCard icon={Timer} color="var(--violet-soft)" label="Sessions total" value={stats.totalFocusSessions} />
        <StatCard icon={Clock} color="var(--amber)" label="Minutes today" value={stats.focusMinutesToday} />
        <StatCard icon={Flame} color="var(--coral)" label="Focus streak" value={`${stats.focusStreak}d`} />
      </div>
      <Card style={{ fontSize: 13, color: "var(--text-dim)" }}>
        Focus mode gives you a distraction-free full-screen timer with ambient sound inside ARC. It can't block other apps or browser tabs — pair it with your phone's own focus mode for that.
      </Card>
    </div>
  );
}

/* ---- lets you set how long focus / break sessions run ---- */

const FOCUS_PRESETS = [15, 25, 45, 60];
const BREAK_PRESETS = [5, 10, 15];

function TimerLengthEditor({ settings, setSettings }) {
  const focusMinutes = clamp(settings.focusMinutes ?? 25, 1, 180);
  const breakMinutes = clamp(settings.breakMinutes ?? 5, 1, 60);

  const setFocus = (n) => {
    const v = clamp(Math.round(n) || 1, 1, 180);
    setSettings((s) => ({ ...s, focusMinutes: v }));
  };
  const setBreak = (n) => {
    const v = clamp(Math.round(n) || 1, 1, 60);
    setSettings((s) => ({ ...s, breakMinutes: v }));
  };

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Timer size={15} color="var(--violet-soft)" />
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>Timer length</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Focus session</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {FOCUS_PRESETS.map((n) => (
              <button
                key={n}
                onClick={() => setFocus(n)}
                className="arc-btn arc-btn-ghost arc-btn-sm"
                style={{ background: focusMinutes === n ? "var(--surface-2)" : "transparent", border: focusMinutes === n ? "1px solid var(--violet-soft)" : undefined }}
              >
                {n}m
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={180}
              value={focusMinutes}
              onChange={(e) => setFocus(Number(e.target.value))}
              style={{ width: 64 }}
              title="Custom focus length in minutes"
            />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Break</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {BREAK_PRESETS.map((n) => (
              <button
                key={n}
                onClick={() => setBreak(n)}
                className="arc-btn arc-btn-ghost arc-btn-sm"
                style={{ background: breakMinutes === n ? "var(--surface-2)" : "transparent", border: breakMinutes === n ? "1px solid var(--violet-soft)" : undefined }}
              >
                {n}m
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={60}
              value={breakMinutes}
              onChange={(e) => setBreak(Number(e.target.value))}
              style={{ width: 64 }}
              title="Custom break length in minutes"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------------- notes tab ---------------------------------- */

function NotesTab({ notes, setNotes, subjects, showToast }) {
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", subjectId: "" });
  const [activeNoteId, setActiveNoteId] = useState(null);

  const addNote = () => {
    if (!form.title.trim()) return;
    const note = { id: uid(), title: form.title.trim(), content: form.content, subjectId: form.subjectId, flashcards: [] };
    setNotes((prev) => [note, ...prev]);
    setForm({ title: "", content: "", subjectId: "" });
    setOpenForm(false);
    showToast("Note saved");
  };

  const removeNote = (id) => setNotes((prev) => prev.filter((n) => n.id !== id));

  const addFlashcard = (noteId, q, a) => {
    if (!q.trim() || !a.trim()) return;
    setNotes((prev) => prev.map((n) => n.id !== noteId ? n : { ...n, flashcards: [...n.flashcards, { id: uid(), q, a }] }));
  };

  const removeFlashcard = (noteId, cardId) => {
    setNotes((prev) => prev.map((n) => n.id !== noteId ? n : { ...n, flashcards: n.flashcards.filter((c) => c.id !== cardId) }));
  };

  const activeNote = notes.find((n) => n.id === activeNoteId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 className="arc-display" style={{ margin: 0, fontSize: 17 }}>Notes & flashcards</h3>
        <Btn small onClick={() => setOpenForm((v) => !v)}><Plus size={15} /> New note</Btn>
      </div>

      {openForm && (
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <select value={form.subjectId} onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}>
              <option value="">No subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <textarea placeholder="Write your note\u2026" rows={4} value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
            <div><Btn small onClick={addNote}>Save note</Btn></div>
          </div>
        </Card>
      )}

      {notes.length === 0 && !openForm && (
        <EmptyState icon={StickyNote} title="No notes yet" body="Capture quick notes, then turn the key facts into flashcards for spaced revision." />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
        {notes.map((n) => (
          <Card key={n.id} className="" style={{ cursor: "pointer" }} >
            <div onClick={() => setActiveNoteId(n.id)}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{n.title}</div>
                <button onClick={(e) => { e.stopPropagation(); removeNote(n.id); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <Trash2 size={14} color="var(--text-faint)" />
                </button>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 6, maxHeight: 46, overflow: "hidden" }}>{n.content}</div>
              <div style={{ marginTop: 10 }}><Pill style={{ fontSize: 11 }}><Layers size={12} /> {n.flashcards.length} cards</Pill></div>
            </div>
          </Card>
        ))}
      </div>

      {activeNote && (
        <NoteDetail note={activeNote} onClose={() => setActiveNoteId(null)} onAddCard={addFlashcard} onRemoveCard={removeFlashcard} />
      )}
    </div>
  );
}

function NoteDetail({ note, onClose, onAddCard, onRemoveCard }) {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [quizMode, setQuizMode] = useState(false);
  const [flipped, setFlipped] = useState({});
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [picked, setPicked] = useState(null);

  const options = useMemo(() => {
    if (!quizMode || note.flashcards.length < 2) return [];
    const correct = note.flashcards[quizIdx];
    const distractors = note.flashcards.filter((c) => c.id !== correct.id).sort(() => Math.random() - 0.5).slice(0, 3);
    return [correct, ...distractors].sort(() => Math.random() - 0.5);
  }, [quizMode, quizIdx, note.flashcards]);

  return (
    <Card style={{ border: "1px solid var(--violet)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 className="arc-display" style={{ margin: 0, fontSize: 16 }}>{note.title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color="var(--text-faint)" /></button>
      </div>
      {note.content && <p style={{ fontSize: 13.5, color: "var(--text-dim)", marginTop: 8 }}>{note.content}</p>}

      {!quizMode && (
        <>
          <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
            <input placeholder="Question / front" value={q} onChange={(e) => setQ(e.target.value)} />
            <input placeholder="Answer / back" value={a} onChange={(e) => setA(e.target.value)} />
            <Btn small onClick={() => { onAddCard(note.id, q, a); setQ(""); setA(""); }}><Plus size={14} /></Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {note.flashcards.map((c) => (
              <div key={c.id} onClick={() => setFlipped((f) => ({ ...f, [c.id]: !f[c.id] }))}
                style={{
                  background: "var(--surface-2)", borderRadius: 12, padding: 14, minHeight: 80, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative",
                }}>
                <button onClick={(e) => { e.stopPropagation(); onRemoveCard(note.id, c.id); }}
                  style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", cursor: "pointer" }}>
                  <X size={12} color="var(--text-faint)" />
                </button>
                <span style={{ fontSize: 13.5 }}>{flipped[c.id] ? c.a : c.q}</span>
              </div>
            ))}
          </div>
          {note.flashcards.length >= 2 && (
            <div style={{ marginTop: 14 }}>
              <Btn small onClick={() => { setQuizMode(true); setQuizIdx(0); setQuizScore(0); setPicked(null); }}><Brain size={14} /> Quiz me</Btn>
            </div>
          )}
        </>
      )}

      {quizMode && (
        <div style={{ marginTop: 14 }}>
          {quizIdx < note.flashcards.length ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>{note.flashcards[quizIdx].q}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {options.map((opt) => {
                  const isCorrect = opt.id === note.flashcards[quizIdx].id;
                  const show = picked !== null;
                  return (
                    <button key={opt.id} disabled={show} onClick={() => {
                      setPicked(opt.id);
                      if (isCorrect) setQuizScore((s) => s + 1);
                    }} className="arc-btn" style={{
                      justifyContent: "flex-start", textAlign: "left",
                      background: show ? (isCorrect ? "rgba(51,224,176,0.18)" : (opt.id === picked ? "rgba(255,92,122,0.18)" : "var(--surface-2)")) : "var(--surface-2)",
                      color: "var(--text)",
                    }}>{opt.a}</button>
                  );
                })}
              </div>
              {picked !== null && <div style={{ marginTop: 12 }}><Btn small onClick={() => { setQuizIdx((i) => i + 1); setPicked(null); }}>Next <ChevronRight size={14} /></Btn></div>}
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div className="arc-display" style={{ fontSize: 24, marginBottom: 8 }}>{quizScore} / {note.flashcards.length}</div>
              <Btn small onClick={() => setQuizMode(false)}>Done</Btn>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------- analytics tab ---------------------------------- */

function AnalyticsTab({ subjects, stats }) {
  const subjectData = subjects.map((s) => ({
    name: s.name.length > 10 ? s.name.slice(0, 10) + "\u2026" : s.name,
    hours: (s.topics || []).reduce((sum, t) => sum + (t.hours || 0), 0),
    completion: s.topics && s.topics.length ? Math.round((s.topics.filter((t) => t.done).length / s.topics.length) * 100) : 0,
  }));

  const statusCounts = { weak: 0, average: 0, strong: 0 };
  subjects.forEach((s) => (s.topics || []).forEach((t) => { statusCounts[t.status || "average"]++; }));
  const pieData = [
    { name: "Weak", value: statusCounts.weak, color: "var(--red)" },
    { name: "Average", value: statusCounts.average, color: "var(--amber)" },
    { name: "Strong", value: statusCounts.strong, color: "var(--mint)" },
  ].filter((d) => d.value > 0);

  const weekTrend = Array.from({ length: 7 }).map((_, i) => ({
    day: addDays(todayStr(), i - 6).slice(5),
    tasks: i === 6 ? stats.tasksCompleted % 7 || 1 : Math.max(0, Math.round(Math.random() * 3)),
  }));

  if (!subjects.length) {
    return <EmptyState icon={BarChart3} title="Nothing to analyze yet" body="Add subjects and complete a few tasks — your study analytics will appear here." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <StatCard icon={CheckCircle2} color="var(--mint)" label="Tasks completed" value={stats.tasksCompleted} />
        <StatCard icon={Timer} color="var(--violet-soft)" label="Focus sessions" value={stats.totalFocusSessions} />
        <StatCard icon={Trophy} color="var(--gold)" label="XP earned" value={stats.xp} />
      </div>

      <Card>
        <h3 className="arc-display" style={{ margin: "0 0 14px", fontSize: 16 }}>Planned hours by subject</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={subjectData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" stroke="#A9A3C9" fontSize={12} />
            <YAxis stroke="#A9A3C9" fontSize={12} />
            <Tooltip contentStyle={{ background: "#17152C", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff" }} />
            <Bar dataKey="hours" fill="#8B6CFF" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <h3 className="arc-display" style={{ margin: "0 0 14px", fontSize: 16 }}>Completion rate by subject</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={subjectData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" stroke="#A9A3C9" fontSize={12} />
            <YAxis stroke="#A9A3C9" fontSize={12} unit="%" />
            <Tooltip contentStyle={{ background: "#17152C", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff" }} />
            <Bar dataKey="completion" fill="#33E0B0" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {pieData.length > 0 && (
        <Card>
          <h3 className="arc-display" style={{ margin: "0 0 14px", fontSize: 16 }}>Topic strength breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={4}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color.replace("var(--red)", "#FF5C7A").replace("var(--amber)", "#FFC24B").replace("var(--mint)", "#33E0B0")} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#17152C", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff" }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        <h3 className="arc-display" style={{ margin: "0 0 4px", fontSize: 16 }}>Achievements</h3>
        <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--text-dim)" }}>Unlocked by grinding, not luck.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {ACHIEVEMENTS.map((ach) => {
            const unlocked = ach.check(stats);
            return (
              <div key={ach.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12,
                background: unlocked ? "rgba(139,108,255,0.14)" : "rgba(255,255,255,0.03)",
                border: "1px solid " + (unlocked ? "rgba(139,108,255,0.3)" : "var(--surface-border)"), opacity: unlocked ? 1 : 0.5,
              }}>
                <span style={{ fontSize: 20 }}>{unlocked ? ach.icon : "\ud83d\udd12"}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{ach.label}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------- rooms tab: live study rooms ---------------------------------- */
/*
  Real peer-to-peer video calling + a synced group quiz, with no backend server.
  Signaling and room state ride on the shared key-value storage (window.storage,
  shared: true) which every participant's browser polls — it's a slow "mailbox"
  standing in for a websocket server. Media itself (audio/video) flows directly
  browser-to-browser over WebRTC once the connection is set up.
*/

const ROOM_STUN = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };
const PRESENCE_TIMEOUT_MS = 15000;
const MAX_ROOM_TILES = 6;
const QUIZ_QUESTION_MS = 20000;

function genRoomCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function loadShared(key, fallback) {
  try {
    const res = await window.storage.get(key, true);
    return res ? JSON.parse(res.value) : fallback;
  } catch {
    return fallback;
  }
}
async function saveShared(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), true);
  } catch (e) {
    console.error("shared save failed", key, e);
  }
}

function generateQuizQuestions(notes, count) {
  const allCards = [];
  (notes || []).forEach((n) => (n.flashcards || []).forEach((c) => allCards.push({ ...c, noteTitle: n.title })));
  if (allCards.length < 2) return [];
  const shuffled = [...allCards].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled
    .map((card) => {
      const distractors = allCards
        .filter((c) => c.id !== card.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((c) => c.a);
      const options = [card.a, ...distractors].sort(() => Math.random() - 0.5);
      return { id: card.id, q: card.q, options, correctIdx: options.indexOf(card.a) };
    })
    .filter((q) => q.options.length >= 2);
}

/* ---- local identity (persisted, personal — not shared) ---- */

function useLocalIdentity() {
  const [me, setMe] = useState(null);
  useEffect(() => {
    (async () => {
      let m = await loadKey("arc:identity", null);
      if (!m) {
        m = { id: uid() + uid(), name: "" };
        await saveKey("arc:identity", m);
      }
      setMe(m);
    })();
  }, []);
  const setName = useCallback((name) => {
    setMe((prev) => {
      const next = { ...(prev || {}), name };
      saveKey("arc:identity", next);
      return next;
    });
  }, []);
  return [me, setName];
}

/* ---- presence: who's in the room right now ---- */

function useRoomPresence(code, me) {
  const [presence, setPresence] = useState({});
  useEffect(() => {
    let stopped = false;
    const key = `room:${code}:presence`;
    const beat = async () => {
      const cur = await loadShared(key, {});
      cur[me.id] = { name: me.name, lastSeen: Date.now() };
      Object.keys(cur).forEach((id) => {
        if (Date.now() - cur[id].lastSeen > PRESENCE_TIMEOUT_MS) delete cur[id];
      });
      await saveShared(key, cur);
      if (!stopped) setPresence(cur);
    };
    beat();
    const t = setInterval(beat, 3500);
    return () => {
      stopped = true;
      clearInterval(t);
      (async () => {
        const cur = await loadShared(key, {});
        delete cur[me.id];
        await saveShared(key, cur);
      })();
    };
  }, [code, me.id, me.name]);
  return presence;
}

/* ---- webrtc mesh call, signaled over shared storage ---- */

function useMeshCall({ code, me, peerList, active }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [mediaError, setMediaError] = useState(null);
  const pcRef = useRef({});
  const pollRef = useRef({});
  const localStreamRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch {
        setMediaError("Camera/mic access was blocked or unavailable — you can still chat and quiz.");
      }
    })();
    return () => {
      stopped = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      setLocalStream(null);
    };
  }, [active]);

  const sendSignal = useCallback(async (to, msg) => {
    const key = `room:${code}:sig:${me.id}:${to}`;
    const cur = await loadShared(key, []);
    cur.push(msg);
    await saveShared(key, cur.slice(-30));
  }, [code, me.id]);

  const closePeer = useCallback((id) => {
    const pc = pcRef.current[id];
    if (pc) { try { pc.close(); } catch {} delete pcRef.current[id]; }
    if (pollRef.current[id]) { clearInterval(pollRef.current[id]); delete pollRef.current[id]; }
    setRemoteStreams((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const ensurePeer = useCallback((peer) => {
    if (pcRef.current[peer.id] || !localStreamRef.current) return;
    const pc = new RTCPeerConnection(ROOM_STUN);
    pcRef.current[peer.id] = pc;
    localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current));

    pc.ontrack = (e) => setRemoteStreams((prev) => ({ ...prev, [peer.id]: e.streams[0] }));
    pc.onicecandidate = (e) => { if (e.candidate) sendSignal(peer.id, { type: "candidate", candidate: e.candidate }); };

    if (me.id < peer.id) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal(peer.id, { type: "offer", sdp: pc.localDescription });
        } catch {}
      };
    }

    const inboxKey = `room:${code}:sig:${peer.id}:${me.id}`;
    pollRef.current[peer.id] = setInterval(async () => {
      const msgs = await loadShared(inboxKey, []);
      if (!msgs.length) return;
      await saveShared(inboxKey, []);
      for (const m of msgs) {
        try {
          if (m.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal(peer.id, { type: "answer", sdp: pc.localDescription });
          } else if (m.type === "answer") {
            if (!pc.currentRemoteDescription) await pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
          } else if (m.type === "candidate") {
            try { await pc.addIceCandidate(m.candidate); } catch {}
          }
        } catch {}
      }
    }, 1200);
  }, [code, me.id, sendSignal]);

  useEffect(() => {
    if (!active || !localStream) return;
    const ids = new Set(peerList.map((p) => p.id));
    peerList.forEach((p) => ensurePeer(p));
    Object.keys(pcRef.current).forEach((id) => { if (!ids.has(id)) closePeer(id); });
  }, [active, localStream, peerList, ensurePeer, closePeer]);

  useEffect(() => () => { Object.keys(pcRef.current).forEach(closePeer); }, [closePeer]);

  const toggleCam = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setCamOn((v) => !v);
  }, []);
  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setMicOn((v) => !v);
  }, []);

  return { localStream, remoteStreams, camOn, micOn, toggleCam, toggleMic, mediaError };
}

/* ---- video tile ---- */

function VideoTile({ stream, name, muted, isLocal }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream || null; }, [stream]);
  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#100E22", border: "1px solid var(--surface-border)", aspectRatio: "4 / 3" }}>
      {stream ? (
        <video ref={ref} autoPlay playsInline muted={muted}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: isLocal ? "scaleX(-1)" : "none" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, var(--violet), var(--mint))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>
            {(name || "?")[0]?.toUpperCase()}
          </div>
        </div>
      )}
      <div style={{ position: "absolute", left: 8, bottom: 8, background: "rgba(0,0,0,0.55)", padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600 }}>
        {name}{isLocal ? " (you)" : ""}
      </div>
    </div>
  );
}

/* ---- chat ---- */

function RoomChat({ code, me }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      const msgs = await loadShared(`room:${code}:chat`, []);
      if (!stopped) setMessages(msgs);
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => { stopped = true; clearInterval(t); };
  }, [code]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    const key = `room:${code}:chat`;
    const cur = await loadShared(key, []);
    cur.push({ id: uid(), userId: me.id, name: me.name, text: t, ts: Date.now() });
    const trimmed = cur.slice(-80);
    await saveShared(key, trimmed);
    setMessages(trimmed);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 && <div style={{ fontSize: 13, color: "var(--text-faint)" }}>No messages yet — say hi.</div>}
        {messages.map((m) => (
          <div key={m.id} style={{ fontSize: 13.5 }}>
            <span style={{ fontWeight: 700, color: m.userId === me.id ? "var(--violet-soft)" : "var(--mint)" }}>{m.name}: </span>
            <span>{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="Message the room…" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()} />
        <Btn small onClick={send}><Send size={14} /></Btn>
      </div>
    </div>
  );
}

/* ---- group quiz, synced across everyone in the room ---- */

function RoomLeaderboard({ scores, me }) {
  const rows = Object.entries(scores || {}).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.score - a.score);
  if (!rows.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((r, i) => (
        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: "var(--surface-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: r.id === me.id ? 700 : 600 }}>
            {i === 0 && <Crown size={14} color="var(--gold)" />}
            {r.name}{r.id === me.id ? " (you)" : ""}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--mint)" }}>{r.score}</div>
        </div>
      ))}
    </div>
  );
}

function RoomQuiz({ code, me, others, notes, showToast }) {
  const [quiz, setQuiz] = useState({ status: "idle" });
  const [selected, setSelected] = useState(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [numQ, setNumQ] = useState(8);
  const advancingRef = useRef(false);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      const q = await loadShared(`room:${code}:quiz`, { status: "idle" });
      if (!stopped) setQuiz(q);
    };
    poll();
    const t = setInterval(poll, 1500);
    return () => { stopped = true; clearInterval(t); };
  }, [code]);

  useEffect(() => { setSelected(null); }, [quiz.currentIdx, quiz.status]);

  useEffect(() => {
    if (quiz.status !== "running") return;
    const tick = () => {
      const elapsed = Date.now() - (quiz.questionStartedAt || Date.now());
      setRemainingMs(Math.max(0, (quiz.perQuestionMs || QUIZ_QUESTION_MS) - elapsed));
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [quiz.status, quiz.questionStartedAt, quiz.currentIdx, quiz.perQuestionMs]);

  const advanceQuestion = useCallback(async () => {
    const fresh = await loadShared(`room:${code}:quiz`, quiz);
    if (fresh.status !== "running") return;
    const qIdx = fresh.currentIdx;
    const question = fresh.questions[qIdx];
    const scores = { ...(fresh.scores || {}) };
    const ids = [me.id, ...others.map((o) => o.id)];
    for (const uidP of ids) {
      const ans = await loadShared(`room:${code}:quiz:ans:${qIdx}:${uidP}`, null);
      if (!scores[uidP]) {
        scores[uidP] = { name: uidP === me.id ? me.name : (others.find((o) => o.id === uidP)?.name || "Player"), score: 0 };
      }
      if (ans && ans.choiceIdx === question.correctIdx) {
        const speedBonus = Math.max(0, Math.round(50 * (1 - ans.elapsedMs / (fresh.perQuestionMs || QUIZ_QUESTION_MS))));
        scores[uidP].score += 100 + speedBonus;
      }
    }
    const nextIdx = qIdx + 1;
    const done = nextIdx >= fresh.questions.length;
    const next = {
      ...fresh, scores,
      status: done ? "finished" : "running",
      currentIdx: done ? qIdx : nextIdx,
      questionStartedAt: done ? fresh.questionStartedAt : Date.now(),
    };
    await saveShared(`room:${code}:quiz`, next);
    setQuiz(next);
  }, [code, quiz, me.id, me.name, others]);

  useEffect(() => {
    if (quiz.status !== "running" || quiz.hostId !== me.id) return;
    const t = setInterval(async () => {
      const elapsed = Date.now() - (quiz.questionStartedAt || Date.now());
      if (elapsed < (quiz.perQuestionMs || QUIZ_QUESTION_MS) || advancingRef.current) return;
      advancingRef.current = true;
      await advanceQuestion();
      advancingRef.current = false;
    }, 700);
    return () => clearInterval(t);
  }, [quiz.status, quiz.hostId, quiz.questionStartedAt, quiz.perQuestionMs, me.id, advanceQuestion]);

  const startQuiz = async () => {
    const questions = generateQuizQuestions(notes, numQ);
    if (!questions.length) {
      showToast("Add a note with a few flashcards first — quiz questions come from those.");
      return;
    }
    const next = { status: "running", hostId: me.id, questions, currentIdx: 0, questionStartedAt: Date.now(), perQuestionMs: QUIZ_QUESTION_MS, scores: {} };
    await saveShared(`room:${code}:quiz`, next);
    setQuiz(next);
  };

  const submitAnswer = async (idx) => {
    if (selected !== null) return;
    setSelected(idx);
    const elapsedMs = Date.now() - (quiz.questionStartedAt || Date.now());
    await saveShared(`room:${code}:quiz:ans:${quiz.currentIdx}:${me.id}`, { choiceIdx: idx, elapsedMs });
  };

  const newQuiz = async () => {
    await saveShared(`room:${code}:quiz`, { status: "idle" });
    setQuiz({ status: "idle" });
  };

  if (quiz.status === "running") {
    const q = quiz.questions[quiz.currentIdx];
    const secs = Math.ceil(remainingMs / 1000);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Pill>Q{quiz.currentIdx + 1} / {quiz.questions.length}</Pill>
          <Pill style={secs <= 5 ? { background: "rgba(255,92,122,0.18)" } : undefined}><Clock size={13} /> {secs}s</Pill>
        </div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{q.q}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
          {q.options.map((opt, i) => {
            const isSel = selected === i;
            return (
              <button key={i} onClick={() => submitAnswer(i)} disabled={selected !== null}
                style={{
                  textAlign: "left", padding: "12px 14px", borderRadius: 12, cursor: selected === null ? "pointer" : "default",
                  border: "1px solid " + (isSel ? "var(--violet)" : "var(--surface-border)"),
                  background: isSel ? "rgba(139,108,255,0.18)" : "var(--surface-2)", color: "var(--text)", fontSize: 13.5, fontFamily: "inherit",
                }}>
                {opt}
              </button>
            );
          })}
        </div>
        {selected !== null && <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Answer locked in — waiting on the others…</div>}
        <RoomLeaderboard scores={quiz.scores} me={me} />
      </div>
    );
  }

  if (quiz.status === "finished") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Quiz complete \ud83c\udfc1</div>
        <RoomLeaderboard scores={quiz.scores} me={me} />
        <div><Btn small onClick={newQuiz}><RotateCcw size={14} /> New quiz</Btn></div>
      </div>
    );
  }

  const eligibleNotes = (notes || []).filter((n) => (n.flashcards || []).length >= 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 13.5, color: "var(--text-dim)" }}>
        Questions are pulled from flashcards saved in your Notes. Whoever starts a round quizzes the whole room live — everyone sees the same question at the same time.
      </div>
      {eligibleNotes.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-faint)" }}>Create a note with a couple of flashcards (Notes tab) to unlock room quizzes.</div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13 }}>Questions:</span>
          <select value={numQ} onChange={(e) => setNumQ(Number(e.target.value))} style={{ width: 80 }}>
            {[5, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <Btn onClick={startQuiz}><Swords size={15} /> Start quiz for everyone</Btn>
        </div>
      )}
    </div>
  );
}

/* ---- the room itself: header, video grid, controls, chat/quiz panel ---- */

function tabBtnStyle(active) {
  return {
    flex: 1, padding: "12px 10px", background: active ? "var(--surface-2)" : "transparent",
    border: "none", color: active ? "var(--text)" : "var(--text-dim)", fontWeight: 600, fontSize: 13.5,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit",
  };
}

function StudyRoom({ code, me, notes, onLeave, showToast }) {
  const presence = useRoomPresence(code, me);
  const [panel, setPanel] = useState("quiz");
  const [copied, setCopied] = useState(false);

  const others = useMemo(
    () => Object.entries(presence).filter(([id]) => id !== me.id).map(([id, v]) => ({ id, ...v })),
    [presence]
  );
  const peerList = others.slice(0, MAX_ROOM_TILES - 1);

  const { localStream, remoteStreams, camOn, micOn, toggleCam, toggleMic, mediaError } =
    useMeshCall({ code, me, peerList, active: true });

  const copyCode = () => {
    try { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Users size={18} color="var(--violet-soft)" />
          <div>
            <div className="arc-display" style={{ fontSize: 15, fontWeight: 700 }}>Room {code}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{others.length + 1} here</div>
          </div>
          <Btn variant="ghost" small onClick={copyCode}><Copy size={13} /> {copied ? "Copied" : "Copy code"}</Btn>
        </div>
        <Btn variant="danger" small onClick={onLeave}><LogOut size={14} /> Leave room</Btn>
      </Card>

      {mediaError && (
        <Card style={{ background: "rgba(255,92,122,0.08)", border: "1px solid rgba(255,92,122,0.25)" }}>
          <div style={{ fontSize: 13, color: "var(--red)" }}>{mediaError}</div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <VideoTile stream={localStream} name={me.name} muted isLocal />
        {peerList.map((p) => <VideoTile key={p.id} stream={remoteStreams[p.id]} name={p.name} />)}
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={toggleMic} className="arc-btn arc-btn-ghost" style={{ background: micOn ? "var(--surface-2)" : "rgba(255,92,122,0.18)" }}>
          {micOn ? <Mic size={16} /> : <MicOff size={16} color="var(--red)" />}
        </button>
        <button onClick={toggleCam} className="arc-btn arc-btn-ghost" style={{ background: camOn ? "var(--surface-2)" : "rgba(255,92,122,0.18)" }}>
          {camOn ? <Video size={16} /> : <VideoOff size={16} color="var(--red)" />}
        </button>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--surface-border)" }}>
          <button onClick={() => setPanel("quiz")} style={tabBtnStyle(panel === "quiz")}><Swords size={14} /> Quiz</button>
          <button onClick={() => setPanel("chat")} style={tabBtnStyle(panel === "chat")}><MessageSquare size={14} /> Chat</button>
        </div>
        <div style={{ padding: 18 }}>
          {panel === "quiz"
            ? <RoomQuiz code={code} me={me} others={others} notes={notes} showToast={showToast} />
            : <RoomChat code={code} me={me} />}
        </div>
      </Card>
    </div>
  );
}

/* ---- lobby: create or join a room ---- */

function RoomLobby({ me, onEnter }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const createRoom = async () => {
    setBusy(true);
    const c = genRoomCode();
    await Promise.all([
      saveShared(`room:${c}:meta`, { code: c, hostId: me.id, createdAt: Date.now() }),
      saveShared(`room:${c}:presence`, {}),
      saveShared(`room:${c}:quiz`, { status: "idle" }),
      saveShared(`room:${c}:chat`, []),
    ]);
    setBusy(false);
    onEnter(c);
  };

  const joinRoom = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    setErr("");
    const meta = await loadShared(`room:${c}:meta`, null);
    setBusy(false);
    if (!meta) { setErr("Room not found — check the code with your friend."); return; }
    onEnter(c);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ background: "rgba(139,108,255,0.08)", border: "1px solid rgba(139,108,255,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={18} color="var(--violet-soft)" />
          <h3 className="arc-display" style={{ margin: 0, fontSize: 16 }}>Study rooms</h3>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--text-dim)", marginTop: 8 }}>
          Video call with friends and quiz each other live, right from the browser — share a room code, no accounts needed.
        </p>
      </Card>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 240 }}>
          <h3 className="arc-display" style={{ margin: "0 0 8px", fontSize: 15 }}>Start a room</h3>
          <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 14px" }}>Get a code, send it to your friends.</p>
          <Btn onClick={createRoom} disabled={busy}><Video size={15} /> Create room</Btn>
        </Card>
        <Card style={{ flex: 1, minWidth: 240 }}>
          <h3 className="arc-display" style={{ margin: "0 0 8px", fontSize: 15 }}>Join a room</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="ROOM CODE" value={code} onChange={(e) => setCode(e.target.value)} style={{ textTransform: "uppercase" }} />
            <Btn onClick={joinRoom} disabled={busy}>Join</Btn>
          </div>
          {err && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 8 }}>{err}</div>}
        </Card>
      </div>
    </div>
  );
}

/* ---- top-level rooms tab: ask for a name once, then lobby / room ---- */

function RoomsTab({ notes, showToast }) {
  const [me, setMyName] = useLocalIdentity();
  const [nameInput, setNameInput] = useState("");
  const [roomCode, setRoomCode] = useState(null);

  useEffect(() => { if (me) setNameInput(me.name || ""); }, [me]);

  if (!me) return null;

  if (!me.name) {
    return (
      <Card style={{ maxWidth: 420, margin: "40px auto" }}>
        <h3 className="arc-display" style={{ marginTop: 0 }}>What should friends call you?</h3>
        <p style={{ fontSize: 13, color: "var(--text-dim)" }}>This name shows up in the video call, chat, and quiz leaderboard.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <input placeholder="Your name" value={nameInput} onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && nameInput.trim() && setMyName(nameInput.trim())} />
          <Btn onClick={() => nameInput.trim() && setMyName(nameInput.trim())}>Continue</Btn>
        </div>
      </Card>
    );
  }

  if (!roomCode) return <RoomLobby me={me} onEnter={setRoomCode} />;

  return <StudyRoom code={roomCode} me={me} notes={notes} onLeave={() => setRoomCode(null)} showToast={showToast} />;
}

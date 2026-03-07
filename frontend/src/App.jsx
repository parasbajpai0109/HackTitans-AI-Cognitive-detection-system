import { useState, useEffect, useRef } from "react";

const fetchRealData = async () => {
  try {
    const res = await fetch('http://localhost:5000/api/status');
    const data = await res.json();
    return {
      blinkRate:     data.biometrics.blink_rate,
      stressScore:   data.biometrics.stress_score,
      reactionTime:  data.biometrics.reaction_time,
      focusScore:    data.biometrics.focus_score,
      gazeStability: data.biometrics.gaze_stability,
      hrv:           data.biometrics.hrv,
    };
  } catch {
    return generateBio();
  }
};

let prevBio = {
  blinkRate: 18, stressScore: 25, reactionTime: 260,
  focusScore: 78, gazeStability: 80, hrv: 62
};

const generateBio = (f = 1) => {
  const smooth = (prev, min, max, step) => {
    const change = (Math.random() - 0.5) * step;
    return Math.min(max, Math.max(min, Math.round(prev + change)));
  };
  prevBio = {
    blinkRate:     smooth(prevBio.blinkRate,     12, 28,  2),
    stressScore:   smooth(prevBio.stressScore,   15, 75,  4),
    reactionTime:  smooth(prevBio.reactionTime, 220, 480, 15),
    focusScore:    smooth(prevBio.focusScore,    30,  90,  4),
    gazeStability: smooth(prevBio.gazeStability, 35, 92,  4),
    hrv:           smooth(prevBio.hrv,           38,  75,  3),
  };
  return prevBio;
};

const calcRisk = (b) => Math.min(Math.floor(
  Math.min((b.blinkRate / 30) * 100, 100) * 0.25 +
  b.stressScore * 0.30 +
  Math.min((b.reactionTime / 500) * 100, 100) * 0.25 +
  (100 - b.focusScore) * 0.20
), 100);

const getRL = (s) => s >= 70
  ? { label: "CRITICAL", color: "#ef4444", bg: "rgba(239,68,68,0.15)", glow: "0 0 30px rgba(239,68,68,0.5)" }
  : s >= 40
  ? { label: "WARNING", color: "#f59e0b", bg: "rgba(245,158,11,0.15)", glow: "0 0 30px rgba(245,158,11,0.4)" }
  : { label: "NORMAL", color: "#10b981", bg: "rgba(16,185,129,0.1)", glow: "none" };

const USERS = [
  { name: "Lt. Arjun Sharma", role: "Fighter Pilot", avatar: "AS", fatigue: 1.7, clearance: "TOP SECRET" },
  { name: "Cpt. Priya Nair", role: "Air Traffic Controller", avatar: "PN", fatigue: 0.8, clearance: "SECRET" },
  { name: "Cmd. Vikram Singh", role: "Mission Commander", avatar: "VS", fatigue: 0.6, clearance: "TOP SECRET" },
];

const OPS = [
  { id: 1, name: "Lt. Arjun Sharma", role: "Fighter Pilot", avatar: "AS", fatigue: 1.8 },
  { id: 2, name: "Cpt. Priya Nair", role: "Air Traffic Ctrl", avatar: "PN", fatigue: 0.7 },
  { id: 3, name: "Maj. Vikram Singh", role: "Surgeon", avatar: "VS", fatigue: 1.4 },
  { id: 4, name: "Dr. Meera Patel", role: "Mission Cmd", avatar: "MP", fatigue: 0.5 },
];

export default function App() {
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState(null);
  const [bio, setBio] = useState(generateBio());
  const [risk, setRisk] = useState(0);
  const [history, setHistory] = useState(
    Array.from({ length: 20 }, (_, i) => ({ t: i, v: Math.floor(20 + Math.sin(i * 0.5) * 30 + Math.random() * 20) }))
  );
  const [alerts, setAlerts] = useState([]);
  const [camOn, setCamOn] = useState(false);
  const [ops, setOps] = useState(OPS.map(o => ({ ...o, bio: generateBio(o.fatigue), risk: 0 })));
  const [rtTest, setRtTest] = useState({ active: false, waiting: false, start: null, result: null });
  const [notifs, setNotifs] = useState(true);
  const [sens, setSens] = useState(50);
  const videoRef = useRef(null);

  useEffect(() => {
    if (screen !== "dashboard" && screen !== "commander") return;
    const iv = setInterval(async () => {
      const b = await fetchRealData();
      setBio(b);
      const r = calcRisk(b);
      setRisk(r);
      setHistory(p => [...p.slice(-29), { t: Date.now(), v: r }]);
      setOps(p => p.map(o => {
        const nb = generateBio(o.fatigue + Math.random() * 0.2);
        return { ...o, bio: nb, risk: calcRisk(nb) };
      }));
      if (r >= 70 && notifs) setAlerts(p => [{ id: Date.now(), msg: `🚨 CRITICAL: Risk ${r}% — Intervene now!`, type: "critical", time: new Date().toLocaleTimeString() }, ...p.slice(0, 9)]);
      else if (r >= 40 && Math.random() > 0.75 && notifs) setAlerts(p => [{ id: Date.now(), msg: `⚠️ WARNING: Cognitive load at ${r}%`, type: "warning", time: new Date().toLocaleTimeString() }, ...p.slice(0, 9)]);
    }, 2000);
    return () => clearInterval(iv);
  }, [screen, user, notifs]);

  useEffect(() => {
    if (screen === "dashboard" && camOn && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(s => { if (videoRef.current) videoRef.current.srcObject = s; })
        .catch(() => setCamOn(false));
    }
    return () => {
      if (videoRef.current?.srcObject)
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    };
  }, [screen, camOn]);

  const startRT = () => {
    setRtTest({ active: true, waiting: true, start: null, result: null });
    setTimeout(() => setRtTest(p => ({ ...p, waiting: false, start: Date.now() })), 1000 + Math.random() * 3000);
  };

  const clickRT = () => {
    if (rtTest.waiting) {
      setRtTest({ active: false, waiting: false, start: null, result: "Too early! Wait for green." });
    } else if (rtTest.start) {
      const rt = Date.now() - rtTest.start;
      fetch(`http://localhost:5000/api/reaction/${rt}`);
      setRtTest({ active: false, waiting: false, start: null, result: `${rt}ms — ${rt < 250 ? "Excellent 🟢" : rt < 400 ? "Normal ⚠️" : "Slow 🔴 Fatigue!"}` });
    }
  };

  const rl = getRL(risk);
  const graphPts = history.slice(-15).map((h, i) => ({ x: i * (100 / 14), y: 100 - h.v }));
  const svgPath = graphPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const NavBtn = ({ s, icon, label }) => (
    <button onClick={() => setScreen(s)} style={{ background: s === screen ? "rgba(0,245,255,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${s === screen ? "rgba(0,245,255,0.5)" : "rgba(255,255,255,0.1)"}`, color: s === screen ? "#00f5ff" : "#64748b", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "10px", letterSpacing: "1px" }}>
      {icon} {label}
    </button>
  );

  if (screen === "login") return (
    <div style={{ minHeight: "100vh", background: "#050a14", color: "#e2e8f0", fontFamily: "Inter,system-ui,sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(0,245,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,245,255,0.025) 1px,transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />
      <div style={{ textAlign: "center", marginBottom: 40, position: "relative" }}>
        <div style={{ fontSize: 64, marginBottom: 10 }}>🛡️</div>
        <h1 style={{ fontSize: 40, fontWeight: 900, background: "linear-gradient(135deg,#00f5ff,#0080ff,#8000ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 4, margin: 0 }}>COGNIGUARD</h1>
        <p style={{ color: "#475569", letterSpacing: 6, fontSize: 10, marginTop: 8 }}>AI COGNITIVE DEFENSE SYSTEM v2.1</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
          {["OPENCV AI", "PYTHON", "REACT"].map(t => (
            <span key={t} style={{ background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.25)", padding: "3px 10px", borderRadius: 20, fontSize: 9, color: "#00f5ff", letterSpacing: 2 }}>{t}</span>
          ))}
        </div>
      </div>
      <p style={{ color: "#334155", fontSize: 11, letterSpacing: 3, marginBottom: 16, position: "relative" }}>SELECT OPERATOR PROFILE</p>
      <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
        {USERS.map(u => (
          <button key={u.name} onClick={() => { setUser(u); setScreen("dashboard"); }}
            style={{ width: "100%", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,245,255,0.15)", borderRadius: 12, padding: 18, marginBottom: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, color: "#e2e8f0", textAlign: "left", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,245,255,0.07)"; e.currentTarget.style.borderColor = "rgba(0,245,255,0.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(0,245,255,0.15)"; }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg,#0080ff,#8000ff)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>{u.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
              <div style={{ color: "#64748b", fontSize: 11 }}>{u.role}</div>
            </div>
            <span style={{ background: "rgba(0,128,255,0.15)", border: "1px solid rgba(0,128,255,0.3)", padding: "2px 8px", borderRadius: 6, fontSize: 9, color: "#60a5fa", letterSpacing: 1 }}>{u.clearance}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#050a14", color: "#e2e8f0", fontFamily: "Inter,system-ui,sans-serif" }}>
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(0,245,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,245,255,0.025) 1px,transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}} @keyframes flash{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      <div style={{ background: "rgba(5,10,20,0.95)", borderBottom: "1px solid rgba(0,245,255,0.1)", padding: "11px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🛡️</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 3, color: "#00f5ff" }}>COGNIGUARD</div>
            <div style={{ fontSize: 8, color: "#334155", letterSpacing: 2, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }} />
              LIVE — {user?.name}
            </div>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <NavBtn s="dashboard" icon="📊" label="LIVE" />
          <NavBtn s="history" icon="📈" label="HISTORY" />
          <NavBtn s="commander" icon="👥" label="COMMAND" />
          <NavBtn s="settings" icon="⚙️" label="SETTINGS" />
        </div>
      </div>

      {screen === "dashboard" && risk >= 40 && (
        <div style={{ background: rl.bg, borderBottom: `1px solid ${rl.color}40`, padding: "9px 20px", display: "flex", alignItems: "center", gap: 10, animation: risk >= 70 ? "flash 1s infinite" : "none" }}>
          <span style={{ fontSize: 16 }}>{risk >= 70 ? "🚨" : "⚠️"}</span>
          <span style={{ color: rl.color, fontWeight: 700, fontSize: 12 }}>
            {risk >= 70 ? "CRITICAL: Cognitive failure risk — Intervene immediately!" : "WARNING: Elevated cognitive load detected"}
          </span>
          <span style={{ marginLeft: "auto", color: rl.color, fontWeight: 700 }}>{risk}%</span>
        </div>
      )}

      {screen === "dashboard" && (
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "260px 1fr 240px", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,245,255,0.13)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "9px 14px", borderBottom: "1px solid rgba(0,245,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, letterSpacing: 2, color: "#94a3b8" }}>📷 LIVE FEED</span>
                <button onClick={() => setCamOn(!camOn)} style={{ background: camOn ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)", border: `1px solid ${camOn ? "#10b981" : "#ef4444"}50`, color: camOn ? "#10b981" : "#ef4444", padding: "2px 10px", borderRadius: 6, cursor: "pointer", fontSize: 10 }}>
                  {camOn ? "ON" : "OFF"}
                </button>
              </div>
              <div style={{ position: "relative", height: 180, background: "#000" }}>
                {camOn
                  ? <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", filter: "hue-rotate(180deg) saturate(0.5)" }} />
                  : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#334155" }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 28 }}>📷</div><div style={{ fontSize: 10, marginTop: 6 }}>Camera disabled</div></div></div>
                }
                {camOn && <>
                  <div style={{ position: "absolute", top: 6, left: 6, width: 18, height: 18, borderTop: "2px solid #00f5ff", borderLeft: "2px solid #00f5ff" }} />
                  <div style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18, borderTop: "2px solid #00f5ff", borderRight: "2px solid #00f5ff" }} />
                  <div style={{ position: "absolute", bottom: 6, left: 6, width: 18, height: 18, borderBottom: "2px solid #00f5ff", borderLeft: "2px solid #00f5ff" }} />
                  <div style={{ position: "absolute", bottom: 6, right: 6, width: 18, height: 18, borderBottom: "2px solid #00f5ff", borderRight: "2px solid #00f5ff" }} />
                  <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4 }}>
                    {["👁️ EYE", "😐 FACE", "🧠 AI"].map(e => <span key={e} style={{ background: "rgba(0,0,0,0.8)", padding: "1px 6px", borderRadius: 4, fontSize: 9, color: "#00f5ff" }}>{e}</span>)}
                  </div>
                </>}
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,245,255,0.13)", borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#94a3b8", marginBottom: 10 }}>⚡ REACTION TEST</div>
              {!rtTest.active && !rtTest.result && (
                <button onClick={startRT} style={{ width: "100%", background: "linear-gradient(135deg,rgba(0,128,255,0.2),rgba(128,0,255,0.2))", border: "1px solid rgba(0,128,255,0.4)", color: "#60a5fa", padding: 12, borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>START TEST</button>
              )}
              {rtTest.active && (
                <button onClick={clickRT} style={{ width: "100%", background: rtTest.waiting ? "rgba(71,85,105,0.2)" : "rgba(16,185,129,0.25)", border: `2px solid ${rtTest.waiting ? "#475569" : "#10b981"}`, color: rtTest.waiting ? "#94a3b8" : "#10b981", padding: 18, borderRadius: 10, cursor: "pointer", fontWeight: 900, fontSize: 14 }}>
                  {rtTest.waiting ? "⏳  WAIT..." : "🟢 CLICK NOW!"}
                </button>
              )}
              {rtTest.result && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8, lineHeight: 1.6 }}>{rtTest.result}</div>
                  <button onClick={startRT} style={{ background: "rgba(0,128,255,0.1)", border: "1px solid rgba(0,128,255,0.3)", color: "#60a5fa", padding: "5px 14px", borderRadius: 8, cursor: "pointer", fontSize: 10 }}>TEST AGAIN</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${rl.color}40`, borderRadius: 18, padding: "20px 24px", textAlign: "center", boxShadow: rl.glow, transition: "all 1s" }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: "#64748b", marginBottom: 14 }}>COGNITIVE RISK SCORE</div>
              <div style={{ position: "relative", display: "inline-block" }}>
                <svg width="150" height="150" viewBox="0 0 150 150">
                  <circle cx="75" cy="75" r="65" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="9" />
                  <circle cx="75" cy="75" r="65" fill="none" stroke={rl.color} strokeWidth="9"
                    strokeDasharray={`${(risk / 100) * 408} 408`} strokeLinecap="round"
                    transform="rotate(-90 75 75)"
                    style={{ filter: `drop-shadow(0 0 8px ${rl.color})`, transition: "stroke-dasharray 1s ease" }} />
                </svg>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
                  <div style={{ fontSize: 42, fontWeight: 900, color: rl.color, lineHeight: 1 }}>{risk}</div>
                  <div style={{ fontSize: 12, color: rl.color, fontWeight: 700, letterSpacing: 3, marginTop: 4 }}>{rl.label}</div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "BLINK RATE", value: bio.blinkRate, unit: "/min", icon: "👁️", warn: bio.blinkRate > 25, color: "#60a5fa" },
                { label: "STRESS", value: bio.stressScore, unit: "%", icon: "😤", warn: bio.stressScore > 60, color: "#f472b6" },
                { label: "REACTION", value: bio.reactionTime, unit: "ms", icon: "⚡", warn: bio.reactionTime > 350, color: "#fbbf24" },
                { label: "FOCUS", value: bio.focusScore, unit: "%", icon: "🎯", warn: bio.focusScore < 40, color: "#34d399" },
                { label: "GAZE", value: bio.gazeStability, unit: "%", icon: "🔭", warn: bio.gazeStability < 50, color: "#a78bfa" },
              ].map(m => (
                <div key={m.label} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${m.warn ? rl.color + "50" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: 12, textAlign: "center", transition: "all 0.5s" }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.value}<span style={{ fontSize: 9, color: "#64748b" }}>{m.unit}</span></div>
                  <div style={{ fontSize: 8, color: "#475569", letterSpacing: 1, marginTop: 3 }}>{m.label}</div>
                  {m.warn && <div style={{ fontSize: 8, color: rl.color, marginTop: 3 }}>⚠ HIGH</div>}
                </div>
              ))}
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,245,255,0.1)", borderRadius: 14, padding: 14, flex: 1 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#94a3b8", marginBottom: 10 }}>📈 RISK TREND — LIVE</div>
              <svg width="100%" height="70" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="g1" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={rl.color} stopOpacity="0.45" />
                    <stop offset="100%" stopColor={rl.color} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={svgPath + " L 100 100 L 0 100 Z"} fill="url(#g1)" />
                <path d={svgPath} fill="none" stroke={rl.color} strokeWidth="2.5" style={{ filter: `drop-shadow(0 0 4px ${rl.color})` }} />
              </svg>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,245,255,0.13)", borderRadius: 14, overflow: "hidden", flex: 1 }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,245,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, letterSpacing: 2, color: "#94a3b8" }}>🔔 ALERTS</span>
                {alerts.length > 0 && <span style={{ background: "rgba(239,68,68,0.25)", color: "#f87171", padding: "1px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{alerts.length}</span>}
              </div>
              <div style={{ overflowY: "auto", maxHeight: 420 }}>
                {alerts.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#334155", fontSize: 11 }}>✅ No alerts<br />System normal</div>}
                {alerts.map(a => (
                  <div key={a.id} style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", borderLeft: `3px solid ${a.type === "critical" ? "#ef4444" : "#f59e0b"}` }}>
                    <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.6 }}>{a.msg}</div>
                    <div style={{ fontSize: 9, color: "#475569", marginTop: 3 }}>{a.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "history" && (
        <div style={{ padding: 20 }}>
          <h2 style={{ letterSpacing: 4, color: "#00f5ff", marginBottom: 20, fontSize: 18 }}>SESSION HISTORY</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
            {[
              { label: "AVG RISK", value: `${Math.floor(history.reduce((s, h) => s + h.v, 0) / history.length)}%`, color: "#f59e0b" },
              { label: "PEAK RISK", value: `${Math.max(...history.map(h => h.v))}%`, color: "#ef4444" },
              { label: "CRITICAL EVENTS", value: history.filter(h => h.v >= 70).length, color: "#ef4444" },
            ].map(s => (
              <div key={s.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,245,255,0.13)", borderRadius: 14, padding: 22, textAlign: "center" }}>
                <div style={{ fontSize: 38, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 9, color: "#64748b", letterSpacing: 2, marginTop: 8 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,245,255,0.13)", borderRadius: 14, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#94a3b8", marginBottom: 14 }}>📊 RISK SCORE TIMELINE</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100 }}>
              {history.slice(-25).map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h.v}%`, background: h.v >= 70 ? "#ef4444" : h.v >= 40 ? "#f59e0b" : "#10b981", borderRadius: "4px 4px 0 0", opacity: 0.85, minWidth: 8 }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, color: "#334155", fontSize: 9 }}><span>EARLIER</span><span>NOW →</span></div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,245,255,0.13)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,245,255,0.1)" }}><span style={{ fontSize: 9, letterSpacing: 2, color: "#94a3b8" }}>📋 ALERT LOG</span></div>
            {alerts.length === 0 && <div style={{ padding: 18, textAlign: "center", color: "#334155", fontSize: 11 }}>No alerts recorded</div>}
            {alerts.slice(0, 8).map(a => (
              <div key={a.id} style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", borderLeft: `3px solid ${a.type === "critical" ? "#ef4444" : "#f59e0b"}`, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#cbd5e1" }}>{a.msg}</span>
                <span style={{ fontSize: 9, color: "#475569", marginLeft: 10, whiteSpace: "nowrap" }}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {screen === "commander" && (
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, letterSpacing: 4, color: "#00f5ff", fontSize: 18 }}>COMMANDER OVERVIEW</h2>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {[{ c: "#10b981", l: "NORMAL", n: ops.filter(o => o.risk < 40).length }, { c: "#f59e0b", l: "WARNING", n: ops.filter(o => o.risk >= 40 && o.risk < 70).length }, { c: "#ef4444", l: "CRITICAL", n: ops.filter(o => o.risk >= 70).length }].map(s => (
                <span key={s.l} style={{ background: `${s.c}20`, color: s.c, padding: "4px 12px", borderRadius: 8, fontSize: 10 }}>● {s.n} {s.l}</span>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
            {ops.map(op => {
              const r = getRL(op.risk);
              return (
                <div key={op.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${r.color}40`, borderRadius: 16, padding: 18, boxShadow: op.risk >= 70 ? r.glow : "none", transition: "all 1s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#0080ff,#8000ff)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>{op.avatar}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{op.name}</div>
                      <div style={{ color: "#64748b", fontSize: 11 }}>{op.role}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 30, fontWeight: 900, color: r.color }}>{op.risk}%</div>
                      <div style={{ fontSize: 9, color: r.color, letterSpacing: 2 }}>{r.label}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                    {[{ l: "BLINK", v: op.bio.blinkRate, u: "/min" }, { l: "STRESS", v: op.bio.stressScore, u: "%" }, { l: "REACTION", v: op.bio.reactionTime, u: "ms" }].map(m => (
                      <div key={m.l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 8, textAlign: "center" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#cbd5e1" }}>{m.v}<span style={{ fontSize: 9, color: "#64748b" }}>{m.u}</span></div>
                        <div style={{ fontSize: 8, color: "#475569", marginTop: 2 }}>{m.l}</div>
                      </div>
                    ))}
                  </div>
                  {op.risk >= 70 && <div style={{ marginTop: 10, background: "rgba(239,68,68,0.12)", border: "1px solid #ef444440", borderRadius: 8, padding: "7px 10px", fontSize: 10, color: "#f87171", textAlign: "center" }}>🚨 RECOMMEND IMMEDIATE RELIEF FROM DUTY</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {screen === "settings" && (
        <div style={{ padding: 20, maxWidth: 580 }}>
          <h2 style={{ letterSpacing: 4, color: "#00f5ff", marginBottom: 20, fontSize: 18 }}>SETTINGS</h2>
          {[{
            label: "OPERATOR PROFILE",
            content: (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "rgba(0,245,255,0.05)", borderRadius: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#0080ff,#8000ff)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>{user?.avatar}</div>
                <div><div style={{ fontWeight: 700 }}>{user?.name}</div><div style={{ color: "#64748b", fontSize: 11 }}>{user?.role}</div></div>
                <span style={{ marginLeft: "auto", background: "rgba(0,128,255,0.15)", color: "#60a5fa", padding: "2px 8px", borderRadius: 6, fontSize: 9 }}>{user?.clearance}</span>
              </div>
            )
          }, {
            label: "ALERT SENSITIVITY",
            content: (
              <div>
                <input type="range" min="10" max="90" value={sens} onChange={e => setSens(+e.target.value)} style={{ width: "100%", accentColor: "#00f5ff", marginBottom: 6 }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b" }}><span>LOW</span><span style={{ color: "#00f5ff", fontWeight: 700 }}>{sens}%</span><span>HIGH</span></div>
              </div>
            )
          }, {
            label: "NOTIFICATIONS",
            content: (
              <div style={{ display: "flex", gap: 10 }}>
                {[{ l: "Push Alerts", v: notifs, fn: () => setNotifs(!notifs) }, { l: "SMS Alerts", v: true, fn: () => {} }, { l: "Email Reports", v: false, fn: () => {} }].map(n => (
                  <div key={n.l} onClick={n.fn} style={{ flex: 1, background: n.v ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.02)", border: `1px solid ${n.v ? "#10b981" : "#1e293b"}`, borderRadius: 10, padding: 12, textAlign: "center", cursor: "pointer" }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{n.v ? "🔔" : "🔕"}</div>
                    <div style={{ fontSize: 10, color: n.v ? "#10b981" : "#64748b" }}>{n.l}</div>
                    <div style={{ fontSize: 9, color: n.v ? "#10b981" : "#475569", marginTop: 3 }}>{n.v ? "ON" : "OFF"}</div>
                  </div>
                ))}
              </div>
            )
          }].map(sec => (
            <div key={sec.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,245,255,0.13)", borderRadius: 14, padding: 18, marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#94a3b8", marginBottom: 14 }}>{sec.label}</div>
              {sec.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



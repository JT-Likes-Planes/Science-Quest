(function () {
  "use strict";
  var KEY = "sciquest", FXK = "sciquest-fx", GOAL = 50;
  var THEMES = [["light", "☀️ Light"], ["dark", "🌙 Dark"], ["neon", "🌈 Neon"], ["sunset", "🌅 Sunset"]];
  var TITLES = ["Curious Kid", "Lab Rookie", "Test-Tube Hero", "Star Gazer", "Quantum Cadet", "Brainiac", "Professor", "Nobel Laureate", "Legend"];
  var F = { theme: "light", mute: false, day: "", dayXp: 0, last: null, got: {}, seeded: false };
  try { var r = JSON.parse(localStorage.getItem(FXK)); if (r) for (var k in r) F[k] = r[k]; } catch (e) {}
  function saveF() { try { localStorage.setItem(FXK, JSON.stringify(F)); } catch (e) {} }
  function S() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function today() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function lvl(xp) { return Math.floor(xp / 100) + 1; }
  function title(xp) { return TITLES[Math.min(TITLES.length - 1, lvl(xp) - 1)]; }

  // Mute support: silence oscillators when muted
  var AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    var oc = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function () {
      var o = oc.call(this);
      if (F.mute) { o.start = function () {}; o.stop = function () {}; }
      return o;
    };
  }

  // ---------- Elements ----------
  function el(tag, id, html) {
    var e = document.createElement(tag);
    if (id) e.id = id;
    if (html != null) e.innerHTML = html;
    document.body.appendChild(e);
    return e;
  }
  var bg = el("div", "bg"), toasts = el("div", "toasts"), cv = el("canvas", "confetti"),
      hud = el("div", "hudx"), dock = el("div", "dock");

  var EM = ["🧪", "🚀", "🧬", "⚛️", "🪐", "🔬", "💡", "🌋", "📐", "💻", "🧲", "🌍"];
  for (var i = 0; i < 18; i++) {
    var s = document.createElement("span");
    s.textContent = EM[i % EM.length];
    s.style.left = Math.random() * 100 + "%";
    s.style.fontSize = 24 + Math.random() * 36 + "px";
    s.style.animationDuration = 20 + Math.random() * 25 + "s";
    s.style.animationDelay = -Math.random() * 40 + "s";
    bg.appendChild(s);
  }

  dock.innerHTML = '<button id="bTheme" title="Theme (T)">🎨</button><button id="bMute" title="Sound (M)">🔊</button>' +
    '<button id="bBadge" title="Badges (B)">🏅</button><button id="bFull" title="Fullscreen (F)">⛶</button>';

  // ---------- Toasts + confetti ----------
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    toasts.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2800);
  }

  var ctx = cv.getContext("2d"), parts = [], running = false;
  function size() { cv.width = innerWidth; cv.height = innerHeight; }
  size(); addEventListener("resize", size);
  function burst(n) {
    var cols = ["#58cc02", "#1cb0f6", "#ce82ff", "#ffc800", "#ff4b4b", "#ff9600"];
    for (var i = 0; i < n; i++) {
      parts.push({ x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.4,
        vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 3,
        c: cols[Math.floor(Math.random() * cols.length)], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        life: 120 + Math.random() * 60 });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(function (p) { return p.life > 0; });
    parts.forEach(function (p) {
      p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr; p.life--;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, p.life / 40);
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
    });
    if (parts.length) requestAnimationFrame(tick);
    else { running = false; ctx.clearRect(0, 0, cv.width, cv.height); }
  }

  // ---------- Badges ----------
  function stats() {
    var s = S(), done = s.done || {}, bank = window.BANK || [], cnt = {}, st = { lessons: 0, threes: 0, units: 0, total: 0 };
    bank.forEach(function (q) { cnt[q[0]] = (cnt[q[0]] || 0) + 1; });
    Object.keys(done).forEach(function (k) { if (done[k]) st.lessons++; if (done[k] === 3) st.threes++; });
    Object.keys(cnt).forEach(function (c) {
      st.total++;
      var n = Math.ceil(cnt[c] / 5), all = true;
      for (var i = 0; i < n; i++) if (!done[c + "-" + i]) all = false;
      if (all) st.units++;
    });
    st.xp = s.xp || 0; st.streak = s.streak || 0;
    return st;
  }
  function badgeList() {
    var st = stats();
    return [
      ["first", "🐣", "First Steps", "Finish a lesson", st.lessons >= 1],
      ["fire", "🔥", "On Fire", "3-day streak", st.streak >= 3],
      ["week", "🗓️", "Week Warrior", "7-day streak", st.streak >= 7],
      ["c100", "💯", "Century", "Earn 100 XP", st.xp >= 100],
      ["c500", "💎", "XP Hoarder", "Earn 500 XP", st.xp >= 500],
      ["perf", "⭐", "Perfectionist", "3 stars on a lesson", st.threes >= 1],
      ["stars", "🌟", "Star Collector", "10 three-star lessons", st.threes >= 10],
      ["unit", "🏅", "Unit Master", "Finish a whole unit", st.units >= 1],
      ["all", "🧑‍🔬", "Scientist", "Finish every unit", st.total > 0 && st.units >= st.total],
      ["l5", "🎓", "Level 5", "Reach level 5", lvl(st.xp) >= 5]
    ];
  }
  function checkBadges() {
    badgeList().forEach(function (b) {
      if (b[4] && !F.got[b[0]]) {
        F.got[b[0]] = 1;
        if (F.seeded) { toast("🏅 Badge unlocked: " + b[2]); burst(80); }
      }
    });
    F.seeded = true; saveF();
  }
  function openBadges() {
    if (document.getElementById("modal")) return closeModal();
    var st = stats(), list = badgeList(), got = list.filter(function (b) { return b[4]; }).length;
    var m = el("div", "modal",
      '<div class="box"><h1>🏅 Trophy Case</h1><div class="mstats"><span>Level ' + lvl(st.xp) + ' · ' + title(st.xp) + '</span><span>⚡ ' + st.xp +
      ' XP</span><span>🔥 ' + st.streak + '</span><span>📚 ' + st.lessons + ' lessons</span></div><div class="bgrid">' +
      list.map(function (b) {
        return '<div class="badge ' + (b[4] ? "" : "off") + '"><div class="e">' + b[1] + '</div><b>' + b[2] + '</b><small>' + b[3] + '</small></div>';
      }).join("") + '</div><p class="muted">' + got + ' / ' + list.length + ' unlocked</p>' +
      '<div style="display:flex;gap:10px;margin-top:14px"><button class="btn blue" id="mClose" style="flex:1">Close</button>' +
      '<button class="btn red" id="mReset">Reset</button></div></div>');
    m.addEventListener("click", function (e) { if (e.target === m) closeModal(); });
    document.getElementById("mClose").onclick = closeModal;
    document.getElementById("mReset").onclick = function () {
      if (confirm("Erase ALL progress, XP, streaks and badges?")) {
        try { localStorage.removeItem(KEY); localStorage.removeItem(FXK); } catch (e) {}
        location.reload();
      }
    };
  }
  function closeModal() { var m = document.getElementById("modal"); if (m) m.parentNode.removeChild(m); }

  // ---------- HUD + XP tracking ----------
  function rollDay() { if (F.day !== today()) { F.day = today(); F.dayXp = 0; } }
  function updateHud() {
    rollDay();
    var xp = S().xp || 0;
    hud.innerHTML = '<span>Lv ' + lvl(xp) + ' · ' + title(xp) + '</span><span class="xpbar"><i style="width:' + (xp % 100) +
      '%"></i></span><span class="goal">🎯 ' + Math.min(F.dayXp, GOAL) + '/' + GOAL + '</span>';
  }
  function checkXp() {
    var xp = S().xp || 0;
    rollDay();
    if (F.last === null) F.last = xp;
    else if (xp > F.last) {
      var gain = xp - F.last, before = F.dayXp;
      F.dayXp += gain;
      toast("+" + gain + " XP ⚡");
      if (lvl(xp) > lvl(F.last)) { toast("🎉 Level up! " + title(xp)); burst(160); }
      if (before < GOAL && F.dayXp >= GOAL) { toast("🎯 Daily goal complete!"); burst(160); }
      F.last = xp;
    } else F.last = xp;
    saveF(); updateHud(); checkBadges();
  }

  // ---------- Theme, sound, fullscreen ----------
  function applyAll() {
    document.body.setAttribute("data-theme", F.theme);
    document.getElementById("bMute").textContent = F.mute ? "🔇" : "🔊";
  }
  function nextTheme() {
    var i = 0;
    THEMES.forEach(function (t, n) { if (t[0] === F.theme) i = n; });
    var t = THEMES[(i + 1) % THEMES.length];
    F.theme = t[0]; saveF(); applyAll(); toast(t[1]);
  }
  function toggleMute() { F.mute = !F.mute; saveF(); applyAll(); toast(F.mute ? "🔇 Sound off" : "🔊 Sound on"); }
  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  }

  document.getElementById("bTheme").onclick = nextTheme;
  document.getElementById("bMute").onclick = toggleMute;
  document.getElementById("bBadge").onclick = openBadges;
  document.getElementById("bFull").onclick = fullscreen;
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (k === "t") nextTheme();
    else if (k === "m") toggleMute();
    else if (k === "b") openBadges();
    else if (k === "f") fullscreen();
    else if (e.key === "Escape") closeModal();
  });

  // ---------- Watch the app for celebrations ----------
  var app = document.getElementById("app"), lastT = null, lastS = null;
  new MutationObserver(function () {
    var t = app.querySelector(".trophy");
    if (t && t !== lastT && t.textContent === "🏆") burst(180);
    lastT = t;
    var g = app.querySelector(".sheet.good");
    if (g && g !== lastS) burst(40);
    lastS = g;
    checkXp();
  }).observe(app, { childList: true });
  setInterval(checkXp, 2000);

  applyAll();
  updateHud();
})();

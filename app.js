(function () {
  "use strict";
  var BANK = window.BANK, app = document.getElementById("app");
  var LESSON = 5;

  var CATS = {
    space:     { name: "Space",         emoji: "🚀", color: "#8549ba" },
    biology:   { name: "Biology",       emoji: "🧬", color: "#58a700" },
    chemistry: { name: "Chemistry",     emoji: "⚗️", color: "#ff9600" },
    physics:   { name: "Physics",       emoji: "⚡", color: "#1899d6" },
    earth:     { name: "Earth Science", emoji: "🌋", color: "#ea2b2b" },
    math:      { name: "Math",          emoji: "📐", color: "#00a896" },
    computing: { name: "Computing",     emoji: "💻", color: "#3b5bdb" }
  };

  // ---------- Save data ----------
  var S = { xp: 0, streak: 0, lastDay: "", done: {}, name: "" };
  try { var raw = localStorage.getItem("sciquest"); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) {}
  if (!S.name) S.name = "Player" + Math.floor(100 + Math.random() * 900);
  function save() { try { localStorage.setItem("sciquest", JSON.stringify(S)); } catch (e) {} }

  function dayStr(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function liveStreak() {
    if (!S.lastDay) return 0;
    var y = new Date(); y.setDate(y.getDate() - 1);
    return (S.lastDay === dayStr(new Date()) || S.lastDay === dayStr(y)) ? S.streak : 0;
  }
  function bumpStreak() {
    var t = dayStr(new Date());
    if (S.lastDay === t) return;
    S.streak = liveStreak() + 1; S.lastDay = t;
  }

  // ---------- Helpers ----------
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function prep(r) {
    var o = shuffle(r[2].map(function (t, i) { return { t: t, ok: i === 0 }; })), a = 0;
    o.forEach(function (x, i) { if (x.ok) a = i; });
    return { c: r[0], q: r[1], o: o.map(function (x) { return x.t; }), a: a, f: r[3], missed: false };
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function pool(c) { return BANK.filter(function (r) { return r[0] === c; }); }

  // ---------- Sound ----------
  var ac = null;
  var SND = { good: [660, 880], bad: [230, 170], win: [523, 659, 784, 1047], tick: [520] };
  function beep(seq) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      var t = ac.currentTime;
      seq.forEach(function (f, i) {
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.15, t + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.11);
        o.connect(g); g.connect(ac.destination);
        o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.12);
      });
    } catch (e) {}
  }

  // ---------- Focus manager (shared by mouse, keyboard, controller) ----------
  var view = "home", focusEls = [], fi = 0;

  function setFocus(i) {
    focusEls.forEach(function (e) { e.classList.remove("focus"); });
    if (!focusEls.length) return;
    fi = (i + focusEls.length) % focusEls.length;
    var e = focusEls[fi];
    e.classList.add("focus");
    if (e.scrollIntoView) e.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function page(html, focusAct, keep) {
    var prev = fi;
    app.innerHTML = html;
    focusEls = [].slice.call(app.querySelectorAll(".fx:not(.disabled)"));
    var start = keep ? Math.min(prev, focusEls.length - 1) : 0;
    if (focusAct) {
      for (var i = 0; i < focusEls.length; i++) if (focusEls[i].getAttribute("data-act") === focusAct) { start = i; break; }
    }
    setFocus(start < 0 ? 0 : start);
    if (!keep) window.scrollTo(0, 0);
  }

  app.addEventListener("mousedown", function (e) { e.preventDefault(); }); // keep focus virtual
  app.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!el || el.classList.contains("disabled")) return;
    act(el.getAttribute("data-act"), el.getAttribute("data-v"));
  });

  Pad.onNav = function (d) { setFocus(fi + d); };
  Pad.onConfirm = function () { var e = focusEls[fi]; if (e) e.click(); };
  Pad.onBack = goBack;

  document.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k === "ArrowUp" || k === "ArrowLeft") { e.preventDefault(); setFocus(fi - 1); }
    else if (k === "ArrowDown" || k === "ArrowRight") { e.preventDefault(); setFocus(fi + 1); }
    else if (k === "Enter" || k === " ") { e.preventDefault(); Pad.onConfirm(); }
    else if (k === "Escape") goBack();
    else if (view === "join" && /^[0-9]$/.test(k)) act("d", k);
    else if (view === "join" && k === "Backspace") act("d", "b");
    else if (/^[1-4]$/.test(k) && (view === "lesson" || view === "mpq")) act("pick", String(Number(k) - 1));
  });

  function goBack() {
    if (view === "home") return;
    if (view === "join") return mpMenu();
    home();
  }

  // ---------- HOME ----------
  function home() {
    mpReset(); view = "home";
    var h = '<div class="top"><div class="stat">🔥 ' + liveStreak() + '</div><div class="logo">Science Quest</div><div class="stat xp">⚡ ' + S.xp + '</div></div>';
    h += '<div class="hero"><button class="btn blue fx" data-act="mixed">🎯 Mixed practice</button>' +
         '<button class="btn purple fx" data-act="mpmenu">👥 Multiplayer</button></div>';
    Object.keys(CATS).forEach(function (c) {
      var n = Math.ceil(pool(c).length / LESSON), d = 0, i;
      for (i = 0; i < n; i++) if (S.done[c + "-" + i]) d++;
      h += '<div class="unit" style="--c:' + CATS[c].color + '"><div class="unithead"><span>' + CATS[c].emoji + ' ' + CATS[c].name +
           '</span><small>' + d + ' / ' + n + '</small></div><div class="nodes">';
      for (i = 0; i < n; i++) {
        var key = c + "-" + i, st = S.done[key] || 0, off = [0, 46, 0, -46][i % 4];
        h += '<button class="node fx ' + (st ? "done" : "") + '" style="left:' + off + 'px" data-act="lesson" data-v="' + key + '">' +
             (st ? "⭐" : CATS[c].emoji) + '<span class="st">' + (st ? "★".repeat(st) + "☆".repeat(3 - st) : "") + '</span></button>';
      }
      h += '</div></div>';
    });
    page(h);
  }

  // ---------- SOLO LESSONS ----------
  var L = null;

  function startLesson(key) {
    var p = key.split("-"), c = p[0], i = Number(p[1]);
    beginLesson(key, pool(c).slice(i * LESSON, i * LESSON + LESSON).map(prep), 3);
  }
  function startMixed() { beginLesson("mixed", shuffle(BANK).slice(0, 10).map(prep), 5); }

  function beginLesson(key, qs, hearts) {
    L = { key: key, queue: qs, total: qs.length, correct: 0, first: 0, mistakes: 0, hearts: hearts,
          checked: false, picked: -1, ok: false, cur: qs[0] };
    lessonView();
  }

  function optsHTML(q, picked, right, locked) {
    return q.o.map(function (t, i) {
      var c = "opt";
      if (right >= 0) { if (i === right) c += " right"; else if (i === picked) c += " wrong"; }
      else if (i === picked) c += " picked";
      c += locked ? " disabled" : " fx";
      return '<button class="' + c + '" data-act="pick" data-v="' + i + '"><b>' + (i + 1) + '</b><span>' + esc(t) + '</span></button>';
    }).join("");
  }

  function lessonView() {
    view = "lesson";
    var q = L.cur, pct = Math.round(L.correct / L.total * 100);
    var h = '<div class="lhead"><button class="x" data-act="quit">✕</button><div class="bar"><div style="width:' + pct +
            '%"></div></div><div class="hearts">❤️ ' + L.hearts + '</div></div>';
    h += '<div class="qwrap"><div class="qlabel">' + CATS[q.c].emoji + ' ' + CATS[q.c].name + '</div><h2>' + esc(q.q) +
         '</h2><div class="opts">' + optsHTML(q, L.picked, L.checked ? q.a : -1, L.checked) + '</div></div>';
    if (L.checked) {
      h += '<div class="sheet ' + (L.ok ? "good" : "bad") + '"><div class="sheetin"><div class="msg"><div class="big">' +
           (L.ok ? "Nicely done! 🎉" : "Not quite") + '</div>' +
           (L.ok ? "" : '<div>Correct answer: <b>' + esc(q.o[q.a]) + '</b></div>') +
           '<div class="fact">💡 ' + esc(q.f) + '</div></div><button class="btn ' + (L.ok ? "green" : "red") +
           ' fx" data-act="next">Continue</button></div></div>';
    } else {
      h += '<div class="sheet"><div class="sheetin"><div class="msg"></div><button class="btn green fx ' +
           (L.picked < 0 ? "disabled" : "") + '" data-act="check">Check</button></div></div>';
    }
    page(h, L.checked ? "next" : (L.picked >= 0 ? "check" : null));
  }

  function check() {
    if (view !== "lesson" || L.checked || L.picked < 0) return;
    var q = L.cur;
    L.checked = true; L.ok = (L.picked === q.a);
    if (L.ok) {
      L.queue.shift(); L.correct++; if (!q.missed) L.first++;
      beep(SND.good); Pad.rumble(0.2, 0.4, 100);
    } else {
      L.hearts--; L.mistakes++; q.missed = true;
      L.queue.push(L.queue.shift());   // missed questions come back later
      beep(SND.bad); Pad.rumble(0.9, 0.2, 300);
    }
    lessonView();
  }

  function next() {
    if (L.hearts <= 0) return failView();
    if (!L.queue.length) return doneView();
    L.cur = L.queue[0]; L.checked = false; L.picked = -1;
    lessonView();
  }

  function doneView() {
    view = "done";
    var xp = Math.max(5, 10 + L.first * 2), pct = Math.round(L.first / L.total * 100);
    var stars = L.mistakes === 0 ? 3 : L.mistakes <= 1 ? 2 : 1;
    S.xp += xp; bumpStreak();
    if (L.key !== "mixed") S.done[L.key] = Math.max(S.done[L.key] || 0, stars);
    save(); beep(SND.win);
    page('<div class="center"><div class="trophy">🏆</div><h1>Lesson complete!</h1><p class="muted">' + "⭐".repeat(stars) + '</p>' +
         '<div class="stats"><div class="s xpc"><span>TOTAL XP</span><b>+' + xp + '</b></div>' +
         '<div class="s acc"><span>ACCURACY</span><b>' + pct + '%</b></div>' +
         '<div class="s stk"><span>STREAK</span><b>🔥 ' + liveStreak() + '</b></div></div></div>' +
         '<div class="sheet"><div class="sheetin"><button class="btn green wide fx" data-act="home">Continue</button></div></div>');
  }

  function failView() {
    view = "fail";
    page('<div class="center"><div class="trophy">💔</div><h1>Out of hearts!</h1><p class="muted">Review and try again.</p></div>' +
         '<div class="sheet"><div class="sheetin"><button class="btn ghost fx" data-act="home">Quit</button>' +
         '<button class="btn green fx" data-act="retry">Try again</button></div></div>', "retry");
  }

  // ---------- MULTIPLAYER ----------
  var M = null, codeIn = "";

  function mpReset() {
    if (M) { clearTimeout(M.tq); clearTimeout(M.tn); }
    M = null;
    try { Net.leave(); } catch (e) {}
  }

  function mpError(msg) {
    mpReset(); view = "mperr";
    page('<div class="center"><div class="trophy">😕</div><h1>Oops</h1><p class="muted">' + esc(msg) + '</p></div>' +
         '<div class="sheet"><div class="sheetin"><button class="btn blue wide fx" data-act="mpmenu">Back</button></div></div>');
  }

  function mpMenu() {
    mpReset(); view = "mpmenu";
    page('<div class="top"><button class="x" data-act="home">←</button><div class="logo">Multiplayer</div><div></div></div>' +
         '<div class="card"><h3>Play live with friends</h3><p class="muted">One person hosts and shares the 4-digit room code. Everyone answers the same 10 questions at the same time. Faster correct answers earn more points.</p></div>' +
         '<div class="opts"><button class="btn green fx" data-act="mphost">Host a game</button>' +
         '<button class="btn blue fx" data-act="mpjoin">Join a game</button>' +
         '<button class="btn ghost fx" data-act="name">✏️ Name: ' + esc(S.name) + '</button></div>');
  }

  function mpWait(text) {
    view = "mpwait";
    page('<div class="center"><div class="spinner"></div><p class="muted">' + esc(text) + '</p></div>');
  }

  function mpJoinView() {
    view = "join";
    var boxes = "";
    for (var i = 0; i < 4; i++) boxes += "<span>" + (codeIn.charAt(i) || "–") + "</span>";
    var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "b", "0", "go"], pad = "";
    keys.forEach(function (k) {
      if (k === "b") pad += '<button class="btn ghost fx" data-act="d" data-v="b">⌫</button>';
      else if (k === "go") pad += '<button class="btn green fx ' + (codeIn.length === 4 ? "" : "disabled") + '" data-act="go">Join</button>';
      else pad += '<button class="btn blue fx" data-act="d" data-v="' + k + '">' + k + '</button>';
    });
    page('<div class="top"><button class="x" data-act="mpmenu">←</button><div class="logo">Join a game</div><div></div></div>' +
         '<div class="center"><p class="muted">Enter the 4-digit room code</p><div class="codebox">' + boxes + '</div><div class="pad">' + pad + '</div></div>',
         null, true);
  }

  // --- network helpers ---
  function bcast(msg) { Net.broadcast(msg); handle(msg); }       // host: send to everyone incl. self

  function pushLobby() {
    var list = Object.keys(M.players).map(function (id) { return { id: id, name: M.players[id].name }; });
    bcast({ t: "lobby", players: list, cat: M.cat, code: M.code });
  }

  function scoreList() {
    return Object.keys(M.players).map(function (id) {
      var p = M.players[id];
      return { id: id, name: p.name, score: p.score, pts: p.pts || 0, choice: p.choice };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  // --- host logic ---
  function mpHost() {
    if (!Net.available()) return mpError("The multiplayer library didn't load. Check your internet connection.");
    mpWait("Creating room…");
    M = { role: "host", me: "host", phase: "lobby", cat: "mixed", lobby: [], players: { host: { name: S.name, score: 0 } } };
    Net.on({ data: hostData, leave: hostLeave });
    Net.host(function (code) { if (M) { M.code = code; pushLobby(); } },
             function (e) { if (M) mpError("Couldn't create a room (" + (e.type || e) + ")."); });
  }

  function hostData(id, msg) {
    if (!M || M.role !== "host" || !msg) return;
    if (msg.t === "hello") {
      if (M.phase !== "lobby") { Net.sendTo(id, { t: "busy" }); return; }
      M.players[id] = { name: String(msg.name || "Player").slice(0, 14), score: 0 };
      pushLobby();
    } else if (msg.t === "ans") {
      onAns(id, msg.choice, msg.i);
    }
  }

  function hostLeave(id) {
    if (!M || !M.players[id]) return;
    delete M.players[id];
    if (M.phase === "lobby") pushLobby();
    else if (M.phase === "q") checkAll();
  }

  function mpStart() {
    if (!M || M.role !== "host" || M.phase !== "lobby") return;
    var src = M.cat === "mixed" ? BANK.slice() : pool(M.cat);
    M.full = shuffle(src).slice(0, 10).map(prep);
    M.hi = -1; M.phase = "starting";
    Object.keys(M.players).forEach(function (id) { M.players[id].score = 0; });
    bcast({ t: "start", total: M.full.length });
    M.tn = setTimeout(hostNext, 2500);
  }

  function hostNext() {
    if (!M) return;
    M.hi++;
    if (M.hi >= M.full.length) { M.phase = "end"; bcast({ t: "end", scores: scoreList() }); return; }
    var q = M.full[M.hi];
    M.phase = "q"; M.t0 = Date.now(); M.limit = 15000;
    Object.keys(M.players).forEach(function (id) { var p = M.players[id]; p.choice = -1; p.pts = 0; p.t = null; });
    bcast({ t: "q", i: M.hi, total: M.full.length, q: { c: q.c, q: q.q, o: q.o }, limit: M.limit });
    M.tq = setTimeout(hostReveal, M.limit + 400);
  }

  function onAns(id, choice, i) {
    if (!M || M.phase !== "q" || i !== M.hi) return;
    var p = M.players[id]; choice = Number(choice);
    if (!p || p.choice >= 0 || !(choice >= 0 && choice < 4)) return;
    p.choice = choice; p.t = Date.now() - M.t0;
    checkAll();
  }

  function checkAll() {
    var all = Object.keys(M.players).every(function (id) { return M.players[id].choice >= 0; });
    if (all) hostReveal();
  }

  function hostReveal() {
    if (!M || M.phase !== "q") return;
    clearTimeout(M.tq);
    var q = M.full[M.hi]; M.phase = "reveal";
    Object.keys(M.players).forEach(function (id) {
      var p = M.players[id]; p.pts = 0;
      if (p.choice === q.a) {
        var rem = Math.max(0, M.limit - (p.t == null ? M.limit : p.t));
        p.pts = 100 + Math.round(100 * rem / M.limit);
        p.score += p.pts;
      }
    });
    bcast({ t: "reveal", i: M.hi, a: q.a, f: q.f, scores: scoreList() });
    M.tn = setTimeout(hostNext, 5500);
  }

  // --- guest logic ---
  function mpJoin(code) {
    if (!Net.available()) return mpError("The multiplayer library didn't load. Check your internet connection.");
    mpWait("Joining room " + code + "…");
    M = { role: "guest", phase: "lobby", lobby: [], cat: "mixed", code: code, picked: -1 };
    Net.on({
      data: function (id, msg) { handle(msg); },
      hostClosed: function () { if (M && M.phase !== "end") mpError("The host left the game."); }
    });
    Net.join(code,
      function () { if (!M) return; M.me = Net.myId(); Net.sendHost({ t: "hello", name: S.name }); },
      function (e) { if (M) mpError(e && e.type === "peer-unavailable" ? "Room " + code + " wasn't found." : "Couldn't connect (" + ((e && e.type) || e) + ")."); });
  }

  // --- messages (run on every player, including the host) ---
  function handle(msg) {
    if (!M || !msg) return;
    switch (msg.t) {
      case "lobby":
        M.lobby = msg.players; M.cat = msg.cat; M.code = msg.code;
        if (M.phase === "lobby") mpLobbyView();
        break;
      case "start":
        M.phase = "starting"; view = "mpwait";
        page('<div class="center"><div class="trophy">⚡</div><h1>Get ready!</h1><p class="muted">First question coming up…</p></div>');
        beep(SND.tick);
        break;
      case "q":
        M.phase = "q"; M.cur = msg; M.picked = -1; M.rev = null;
        mpQView(); beep(SND.tick);
        break;
      case "reveal":
        M.phase = "reveal"; M.rev = msg;
        var me = msg.scores.filter(function (s) { return s.id === M.me; })[0];
        beep(me && me.choice === msg.a ? SND.good : SND.bad);
        mpQView();
        break;
      case "end":
        M.phase = "end"; M.final = msg.scores;
        mpEndView();
        break;
      case "busy":
        mpError("That game has already started.");
        break;
    }
  }

  function mpPick(i) {
    if (!M || M.phase !== "q" || M.picked >= 0) return;
    M.picked = i;
    if (M.role === "host") onAns("host", i, M.hi);
    else Net.sendHost({ t: "ans", i: M.cur.i, choice: i });
    if (M && M.phase === "q") mpQView();
  }

  function mpLobbyView() {
    view = "mplobby";
    var host = M.role === "host";
    var h = '<div class="top"><button class="x" data-act="home">✕</button><div class="logo">Lobby</div><div></div></div>' +
            '<div class="center"><p class="muted">Room code</p><div class="roomcode">' + esc(M.code || "…") + '</div>' +
            '<p class="muted">Friends: open this site → Multiplayer → Join a game</p></div>';
    h += '<div class="card"><h3>Players (' + M.lobby.length + ')</h3>' + M.lobby.map(function (p) {
      return '<div class="prow">' + (p.id === "host" ? "👑 " : "🧑‍🔬 ") + esc(p.name) + (p.id === M.me ? " (you)" : "") + '</div>';
    }).join("") + '</div>';
    if (host) {
      h += '<h3>Topic</h3><div class="chips">';
      ["mixed"].concat(Object.keys(CATS)).forEach(function (c) {
        h += '<button class="chip fx ' + (M.cat === c ? "on" : "") + '" data-act="mpcat" data-v="' + c + '">' +
             (c === "mixed" ? "🎲 Mixed" : CATS[c].emoji + " " + CATS[c].name) + '</button>';
      });
      h += '</div><div class="sheet"><div class="sheetin"><div class="msg muted">' + M.lobby.length + ' player(s) in the room</div>' +
           '<button class="btn green fx" data-act="mpstart">Start game</button></div></div>';
    } else {
      h += '<p class="wait">Waiting for the host to start…</p>';
    }
    page(h, null, true);
  }

  function mpQView() {
    view = "mpq";
    var m = M.cur, rev = M.rev, q = m.q;
    var h = '<div class="lhead"><button class="x" data-act="home">✕</button><div class="qnum">Question ' + (m.i + 1) + ' / ' + m.total + '</div><div class="stat"></div></div>';
    if (!rev) h += '<div class="timer"><div style="animation-duration:' + m.limit + 'ms"></div></div>';
    h += '<div class="qwrap"><div class="qlabel">' + CATS[q.c].emoji + ' ' + CATS[q.c].name + '</div><h2>' + esc(q.q) + '</h2><div class="opts">' +
         optsHTML(q, M.picked, rev ? rev.a : -1, M.picked >= 0 || !!rev) + '</div></div>';
    if (!rev && M.picked >= 0) h += '<p class="wait">Answer locked in! Waiting for the others…</p>';
    if (rev) {
      var me = rev.scores.filter(function (s) { return s.id === M.me; })[0], ok = me && me.choice === rev.a;
      h += '<div class="card">' + rev.scores.map(function (s, i) {
        return '<div class="score ' + (s.id === M.me ? "me" : "") + '"><span class="rk">' + (i + 1) + '</span><span class="nm">' + esc(s.name) +
               '</span><span class="pt">' + (s.pts ? "+" + s.pts : (s.choice < 0 ? "⏱" : "✖")) + '</span><span class="sc">' + s.score + '</span></div>';
      }).join("") + '</div>';
      h += '<div class="sheet ' + (ok ? "good" : "bad") + '"><div class="sheetin"><div class="msg"><div class="big">' +
           (ok ? "Correct! +" + me.pts : (me && me.choice < 0 ? "Time's up!" : "Not quite")) + '</div>' +
           '<div class="fact">💡 ' + esc(rev.f) + '</div></div></div></div>';
    }
    page(h, null, true);
  }

  function mpEndView() {
    view = "mpend";
    var medals = ["🥇", "🥈", "🥉"], f = M.final;
    var h = '<div class="center"><div class="trophy">🏆</div><h1>Game over!</h1><p class="muted">' +
            esc(f[0] ? f[0].name : "") + ' wins!</p></div><div class="card">' +
            f.map(function (s, i) {
              return '<div class="score ' + (s.id === M.me ? "me" : "") + '"><span class="rk">' + (medals[i] || i + 1) + '</span><span class="nm">' +
                     esc(s.name) + '</span><span class="sc">' + s.score + '</span></div>';
            }).join("") + '</div>' +
            '<div class="sheet"><div class="sheetin"><button class="btn green wide fx" data-act="home">Back to menu</button></div></div>';
    page(h);
    beep(SND.win);
  }

  // ---------- Actions ----------
  function act(a, v) {
    switch (a) {
      case "mixed": startMixed(); break;
      case "lesson": startLesson(v); break;
      case "pick":
        if (view === "lesson") { if (!L.checked) { L.picked = Number(v); lessonView(); } }
        else if (view === "mpq") mpPick(Number(v));
        break;
      case "check": check(); break;
      case "next": next(); break;
      case "quit": case "home": home(); break;
      case "retry": L.key === "mixed" ? startMixed() : startLesson(L.key); break;
      case "mpmenu": mpMenu(); break;
      case "mphost": mpHost(); break;
      case "mpjoin": codeIn = ""; mpJoinView(); break;
      case "name":
        var n = window.prompt("Your name (shown to other players):", S.name);
        if (n && n.trim()) { S.name = n.trim().slice(0, 14); save(); }
        mpMenu();
        break;
      case "d":
        if (view !== "join") break;
        if (v === "b") codeIn = codeIn.slice(0, -1);
        else if (codeIn.length < 4) codeIn += v;
        mpJoinView();
        break;
      case "go": if (codeIn.length === 4) mpJoin(codeIn); break;
      case "mpcat": if (M && M.role === "host") { M.cat = v; pushLobby(); } break;
      case "mpstart": mpStart(); break;
    }
  }

  home();
})();
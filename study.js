(function () {
  "use strict";
  var WORKER_URL = "https://super-field-0702.avgeekauspodcast.workers.dev/";   // <-- paste yours here
  var KEY = "sciquest-sets", MAX = 12000;
  var PDF_JS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  var PDF_W = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function getSets() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function putSets(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }

  function prep(q) {
    var o = shuffle([{ t: q.correct, ok: true }].concat(q.wrong.map(function (w) { return { t: w, ok: false }; })));
    var a = 0; o.forEach(function (x, i) { if (x.ok) a = i; });
    return { q: q.q, o: o.map(function (x) { return x.t; }), a: a, f: q.explain };
  }

  // ---------- Modal ----------
  var box = null, inner = null, Q = null;

  function open() {
    if (box) return close();
    box = document.createElement("div");
    box.id = "studyModal";
    box.innerHTML = '<div class="sbox"></div>';
    inner = box.firstChild;
    document.body.appendChild(box);
    // Keep typing from triggering game shortcuts (T, M, B, F, space, Enter...)
    box.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Escape") close(); });
    box.addEventListener("click", function (e) {
      if (e.target === box) return close();
      var a = e.target.closest ? e.target.closest("[data-s]") : null;
      if (a) onAct(a.getAttribute("data-s"), a.getAttribute("data-v"));
    });
    box.addEventListener("change", function (e) { if (e.target.id === "sFile") onFile(e.target.files[0]); });
    home();
  }
  function close() { if (box) { box.parentNode.removeChild(box); box = inner = null; Q = null; } }

  // ---------- Home ----------
  function home(msg) {
    Q = null;
    var sets = getSets();
    var h = '<h1>📚 Study from your notes</h1><p class="tip">Paste notes or upload a .txt, .md or .pdf. The AI writes a quiz from only your material.</p>';
    if (sets.length) {
      h += '<h3 style="margin-top:14px">Saved quizzes</h3>';
      sets.forEach(function (s) {
        h += '<div class="setrow"><span>' + esc(s.title) + ' <small class="tip">(' + s.qs.length + ' Qs)</small></span>' +
             '<button class="btn green" data-s="play" data-v="' + s.id + '">Play</button>' +
             '<button class="btn ghost" data-s="del" data-v="' + s.id + '">🗑</button></div>';
      });
    }
    h += '<h3 style="margin-top:16px">New quiz</h3>' +
      '<input type="text" id="sTitle" placeholder="Title (e.g. Biology: Cells)" maxlength="40">' +
      '<textarea id="sText" placeholder="Paste your notes here…"></textarea>' +
      '<div class="row"><input type="file" id="sFile" accept=".txt,.md,.pdf">' +
      '<select id="sCount"><option value="5">5 questions</option><option value="10" selected>10 questions</option><option value="15">15 questions</option></select></div>' +
      '<p class="tip">Only the first ~12,000 characters are used. Scanned PDFs (photos of pages) won\'t work because they have no text. ' +
      'Your text is sent to OpenAI to write the questions, so don\'t include private information.</p>' +
      '<div class="status' + (msg ? " err" : "") + '" id="sStatus">' + (msg ? esc(msg) : "") + '</div>' +
      '<div class="row"><button class="btn green" data-s="gen">✨ Make quiz</button><button class="btn ghost" data-s="close">Close</button></div>';
    inner.innerHTML = h;
  }

  function status(t, err) {
    var s = document.getElementById("sStatus");
    if (s) { s.textContent = t; s.className = "status" + (err ? " err" : ""); }
  }

  // ---------- File reading ----------
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error("Couldn't load the PDF reader")); };
      document.head.appendChild(s);
    });
  }
  async function readPdf(file) {
    if (!window.pdfjsLib) await loadScript(PDF_JS);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_W;
    var pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise, out = "";
    for (var i = 1; i <= Math.min(pdf.numPages, 40); i++) {
      var page = await pdf.getPage(i), c = await page.getTextContent();
      out += c.items.map(function (x) { return x.str; }).join(" ") + "\n";
      if (out.length > MAX * 2) break;
    }
    return out;
  }
  async function onFile(file) {
    if (!file) return;
    status("Reading " + file.name + "…");
    try {
      var text = /\.pdf$/i.test(file.name) ? await readPdf(file) : await file.text();
      text = text.replace(/\s+\n/g, "\n").trim();
      if (text.length < 50) return status("Couldn't find any text in that file. Scanned PDFs aren't supported.", true);
      document.getElementById("sText").value = text.slice(0, MAX);
      var t = document.getElementById("sTitle");
      if (!t.value) t.value = file.name.replace(/\.[^.]+$/, "").slice(0, 40);
      status("Loaded " + Math.min(text.length, MAX) + " characters" + (text.length > MAX ? " (trimmed to fit)" : "") + ".");
    } catch (e) { status("Couldn't read that file: " + e.message, true); }
  }

  // ---------- Generate ----------
  async function generate() {
    var text = document.getElementById("sText").value.trim();
    var count = Number(document.getElementById("sCount").value);
    var title = document.getElementById("sTitle").value.trim() || text.slice(0, 30);
    if (text.length < 200) return status("Add at least a few sentences of notes first.", true);
    if (WORKER_URL.indexOf("YOUR-WORKER") !== -1) return status("The Worker URL isn't set in study.js yet.", true);
    status("🤖 Writing your questions… (about 10 seconds)");
    try {
      var r = await fetch(WORKER_URL, { method: "POST", headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ text: text.slice(0, MAX), count: count }) });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || "Server error");
      var sets = getSets(), set = { id: String(Date.now()), title: title, qs: d.questions };
      sets.unshift(set); putSets(sets.slice(0, 20));
      play(set);
    } catch (e) { status("Couldn't make the quiz: " + e.message, true); }
  }

  // ---------- Quiz ----------
  function play(set, only) {
    var qs = only || set.qs.map(prep);
    Q = { set: set, queue: shuffle(qs), i: 0, picked: -1, checked: false, right: 0, missed: [] };
    quiz();
  }

  function quiz() {
    if (Q.i >= Q.queue.length) return results();
    var q = Q.queue[Q.i], pct = Math.round(Q.i / Q.queue.length * 100);
    var h = '<div class="row"><button class="x" data-s="home">←</button><div class="bar" style="flex:4"><div style="width:' + pct +
            '%"></div></div><b style="flex:1;text-align:right">' + (Q.i + 1) + '/' + Q.queue.length + '</b></div>' +
            '<div class="qlabel">' + esc(Q.set.title) + '</div><h2>' + esc(q.q) + '</h2><div class="opts">';
    q.o.forEach(function (t, i) {
      var c = "opt";
      if (Q.checked) { if (i === q.a) c += " right"; else if (i === Q.picked) c += " wrong"; }
      else if (i === Q.picked) c += " picked";
      h += '<button class="' + c + '" ' + (Q.checked ? "" : 'data-s="pick" data-v="' + i + '"') + '><b>' + (i + 1) + '</b><span>' + esc(t) + '</span></button>';
    });
    h += '</div>';
    if (Q.checked) {
      var ok = Q.picked === q.a;
      h += '<div class="res ' + (ok ? "good" : "bad") + '">' + (ok ? "Correct! 🎉" : "Not quite. Answer: " + esc(q.o[q.a])) +
           (q.f ? '<div class="tip" style="color:inherit;margin-top:6px">💡 ' + esc(q.f) + '</div>' : "") + '</div>' +
           '<button class="btn green wide" data-s="next">Continue</button>';
    } else {
      h += '<button class="btn ' + (Q.picked < 0 ? "disabled" : "green") + ' wide" ' + (Q.picked < 0 ? "" : 'data-s="check"') + '>Check</button>';
    }
    inner.innerHTML = h;
  }

  function results() {
    var n = Q.queue.length, pct = Math.round(Q.right / n * 100);
    var h = '<div class="center"><div class="trophy">' + (pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "📖") + '</div><h1>' + Q.right + ' / ' + n +
            ' (' + pct + '%)</h1><p class="muted">' + (pct >= 80 ? "Great revision!" : pct >= 50 ? "Getting there. Review the missed ones." : "Keep going, repetition works!") + '</p></div>';
    if (Q.missed.length) {
      h += '<h3>Review these</h3>' + Q.missed.map(function (q) {
        return '<div class="res bad">' + esc(q.q) + '<div class="tip" style="color:inherit">✔ ' + esc(q.o[q.a]) + (q.f ? " — " + esc(q.f) : "") + '</div></div>';
      }).join("");
    }
    h += '<div class="row">' + (Q.missed.length ? '<button class="btn red" data-s="retry">Retry missed</button>' : "") +
         '<button class="btn blue" data-s="again">Play again</button><button class="btn ghost" data-s="home">Back</button></div>';
    inner.innerHTML = h;
  }

  // ---------- Actions ----------
  function onAct(a, v) {
    if (a === "close") close();
    else if (a === "home") home();
    else if (a === "gen") generate();
    else if (a === "play") { var s = getSets().filter(function (x) { return x.id === v; })[0]; if (s) play(s); }
    else if (a === "del") { putSets(getSets().filter(function (x) { return x.id !== v; })); home(); }
    else if (a === "pick" && Q && !Q.checked) { Q.picked = Number(v); quiz(); }
    else if (a === "check" && Q && !Q.checked && Q.picked >= 0) {
      var q = Q.queue[Q.i]; Q.checked = true;
      if (Q.picked === q.a) Q.right++; else Q.missed.push(q);
      quiz();
    }
    else if (a === "next" && Q) { Q.i++; Q.picked = -1; Q.checked = false; quiz(); }
    else if (a === "retry" && Q) play(Q.set, Q.missed.map(function (q) { return { q: q.q, o: q.o, a: q.a, f: q.f }; }));
    else if (a === "again" && Q) play(Q.set);
  }

  // ---------- Dock button ----------
  var dock = document.getElementById("dock");
  if (dock) {
    var b = document.createElement("button");
    b.id = "bStudy"; b.title = "Study from your notes"; b.textContent = "📚";
    b.onclick = open;
    dock.appendChild(b);
  }
})();

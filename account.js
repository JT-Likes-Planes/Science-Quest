(function () {
  "use strict";
  var WORKER = "sciencequest-auth.avgeekauspodcast.workers.dev";   // <-- paste your auth Worker URL here
  var AK = "sciquest-acct", KEYS = ["sciquest", "sciquest-fx", "sciquest-sets"];
  var acct = null, lastPush = "", box = null, mode = "login";
  try { acct = JSON.parse(localStorage.getItem(AK)); } catch (e) {}

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function collect() {
    var d = {};
    KEYS.forEach(function (k) { var v = localStorage.getItem(k); if (v) d[k] = v; });
    return d;
  }
  function xpOf(d) { try { return JSON.parse(d.sciquest).xp || 0; } catch (e) { return 0; } }
  function apply(d) { KEYS.forEach(function (k) { if (d && d[k]) localStorage.setItem(k, d[k]); }); }
  function setName(n) {
    try { var s = JSON.parse(localStorage.getItem("sciquest") || "{}"); s.name = n; localStorage.setItem("sciquest", JSON.stringify(s)); } catch (e) {}
  }
  function saveAcct() { try { if (acct) localStorage.setItem(AK, JSON.stringify(acct)); else localStorage.removeItem(AK); } catch (e) {} }

  function call(body, keep) {
    body.token = acct && acct.token;
    return fetch(WORKER, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: !!keep })
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) { if (r.status === 401 && acct && body.a !== "login") { acct = null; saveAcct(); } throw new Error(d.error || "Server error"); }
          return d;
        });
      });
  }

  // ---------- Sync ----------
  function push(keep) {
    if (!acct) return;
    var data = collect(), s = JSON.stringify(data);
    if (s === lastPush) return;
    call({ a: "save", data: data }, keep).then(function () { lastPush = s; }).catch(function () {});
  }
  if (acct) {
    call({ a: "load" }).then(function (d) {
      var cloud = d.data || {};
      if (xpOf(cloud) > xpOf(collect())) { apply(cloud); location.reload(); }
      else push();
    }).catch(function () {});
  }
  setInterval(function () { push(); }, 15000);
  window.addEventListener("pagehide", function () { push(true); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) push(true); });

  // ---------- Modal ----------
  var st = document.createElement("style");
  st.textContent =
    "#acctModal{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:97;display:flex;align-items:center;justify-content:center;padding:14px}" +
    "#acctModal .sbox{background:var(--panel,#fff);color:var(--ink,#333);border-radius:22px;max-width:420px;width:100%;padding:24px}" +
    "#acctModal h1{font-size:1.5rem;margin-bottom:6px}" +
    "#acctModal input{width:100%;font:inherit;font-weight:700;color:var(--ink,#333);background:var(--panel,#fff);border:2px solid var(--line,#ddd);border-radius:14px;padding:12px;margin:6px 0}" +
    "#acctModal .row{display:flex;gap:10px;margin:10px 0}#acctModal .row>*{flex:1}" +
    "#acctModal .msg{min-height:22px;font-weight:800;margin:6px 0;color:var(--mut,#777)}#acctModal .msg.err{color:var(--badt,#e33)}" +
    "#acctModal .tip{font-size:.8rem;color:var(--mut,#777);font-weight:700}";
  document.head.appendChild(st);

  function msg(t, err) { var m = document.getElementById("aMsg"); if (m) { m.textContent = t; m.className = "msg" + (err ? " err" : ""); } }

  function view() {
    var h;
    if (acct) {
      h = '<h1>👤 ' + esc(acct.name) + '</h1><p class="tip">Your progress is saved to your account and syncs across devices.</p>' +
          '<div class="msg" id="aMsg"></div><div class="row"><button class="btn blue" data-a="sync">Sync now</button>' +
          '<button class="btn red" data-a="out">Log out</button></div><button class="btn ghost wide" data-a="close">Close</button>';
    } else {
      h = '<h1>👤 ' + (mode === "login" ? "Log in" : "Create account") + '</h1>' +
          '<input id="aUser" type="text" placeholder="Username" maxlength="14" autocomplete="username">' +
          '<input id="aPass" type="password" placeholder="Password (6+ characters)" autocomplete="' + (mode === "login" ? "current-password" : "new-password") + '">' +
          '<div class="msg" id="aMsg"></div>' +
          '<button class="btn green wide" data-a="go">' + (mode === "login" ? "Log in" : "Sign up") + '</button>' +
          '<div class="row"><button class="btn ghost" data-a="switch">' + (mode === "login" ? "New here? Sign up" : "Have an account? Log in") + '</button>' +
          '<button class="btn ghost" data-a="close">Close</button></div>' +
          '<p class="tip">No password reset is available, so remember it. Don\'t reuse a password from another site. Progress already on this device is kept and uploaded.</p>';
    }
    box.firstChild.innerHTML = h;
  }

  function open() {
    if (box) return close();
    box = document.createElement("div");
    box.id = "acctModal";
    box.innerHTML = '<div class="sbox"></div>';
    document.body.appendChild(box);
    box.addEventListener("keydown", function (e) {
      e.stopPropagation();                      // typing shouldn't trigger game shortcuts
      if (e.key === "Escape") close();
      else if (e.key === "Enter" && !acct) submit();
    });
    box.addEventListener("click", function (e) {
      if (e.target === box) return close();
      var b = e.target.closest ? e.target.closest("[data-a]") : null;
      if (!b) return;
      var a = b.getAttribute("data-a");
      if (a === "close") close();
      else if (a === "switch") { mode = mode === "login" ? "signup" : "login"; view(); }
      else if (a === "go") submit();
      else if (a === "sync") { msg("Syncing…"); lastPush = ""; push(); setTimeout(function () { msg("Saved ✓"); }, 800); }
      else if (a === "out") logout();
    });
    view();
  }
  function close() { if (box) { box.parentNode.removeChild(box); box = null; } }

  function submit() {
    var u = document.getElementById("aUser").value.trim(), p = document.getElementById("aPass").value;
    if (!u || !p) return msg("Enter a username and password.", true);
    if (WORKER.indexOf("YOUR-AUTH") !== -1) return msg("The Worker URL isn't set in account.js yet.", true);
    msg("Working…");
    var body = { a: mode, user: u, pass: p };
    if (mode === "signup") body.data = collect();
    call(body).then(function (d) {
      var cloud = d.data || {};
      acct = { token: d.token, name: d.name }; saveAcct();
      if (mode === "login" && xpOf(cloud) >= xpOf(collect())) apply(cloud);   // higher XP wins
      setName(d.name);
      location.reload();
    }).catch(function (e) { msg(e.message === "Failed to fetch" ? "Couldn't reach the server." : e.message, true); });
  }

  function logout() {
    var done = function () {
      acct = null; saveAcct();
      KEYS.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      location.reload();
    };
    lastPush = ""; push();
    call({ a: "logout" }).then(done, done);
  }

  // ---------- Dock button ----------
  var dock = document.getElementById("dock");
  if (dock) {
    var btn = document.createElement("button");
    btn.id = "bAcct"; btn.title = acct ? "Account: " + acct.name : "Log in"; btn.textContent = "👤";
    btn.onclick = open;
    dock.appendChild(btn);
  }
})();

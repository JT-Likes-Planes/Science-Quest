// Reads USB / Bluetooth controllers and reports: nav(-1/+1), confirm, back.
(function () {
  "use strict";
  var Pad = window.Pad = { onNav: function () {}, onConfirm: function () {}, onBack: function () {} };
  var badge = document.getElementById("pad"), dbg = document.getElementById("dbg");
  var hatAxes = {}, prevDir = 0, prevC = false, prevB = false, holdT = 0, lastRep = 0, showDbg = false;

  window.addEventListener("keydown", function (e) {
    if (e.key === "d" || e.key === "D") { showDbg = !showDbg; dbg.hidden = !showDbg; }
  });

  Pad.rumble = function (weak, strong, ms) {
    try {
      var pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (var i = 0; i < pads.length; i++) {
        var a = pads[i] && pads[i].vibrationActuator;
        if (a && a.playEffect) {
          a.playEffect("dual-rumble", { duration: ms, weakMagnitude: weak, strongMagnitude: strong }).catch(function () {});
          return;
        }
      }
    } catch (e) {}
  };

  function poll(now) {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var up = false, down = false, left = false, right = false, conf = false, back = false, n = 0, txt = [];

    for (var p = 0; p < pads.length; p++) {
      var gp = pads[p];
      if (!gp || !gp.connected) continue;
      n++;
      var std = gp.mapping === "standard", pressed = [], axesTxt = [];

      for (var i = 0; i < gp.buttons.length; i++) {
        var b = gp.buttons[i];
        if (!(b.pressed || b.value > 0.5)) continue;
        pressed.push(i);
        if (std) {
          if (i === 12) up = true;
          else if (i === 13) down = true;
          else if (i === 14) left = true;
          else if (i === 15) right = true;
          else if (i === 1 || i === 8) back = true;           // B / Select
          else if (i === 0 || i === 2 || i === 3 || i === 9) conf = true; // A, X, Y, Start
        } else {
          conf = true; // generic controllers: any button confirms
        }
      }

      for (var a = 0; a < gp.axes.length; a++) {
        var v = gp.axes[a], key = p + "-" + a;
        axesTxt.push(v.toFixed(2));
        if (v > 1.2) hatAxes[key] = true;                     // idle value of a hat-switch D-pad
        if (hatAxes[key]) {
          if (v <= 1.1) {
            var idx = Math.round((v + 1) * 3.5);              // 0=up 2=right 4=down 6=left
            if (idx === 7 || idx === 0 || idx === 1) up = true;
            if (idx >= 1 && idx <= 3) right = true;
            if (idx >= 3 && idx <= 5) down = true;
            if (idx >= 5 && idx <= 7) left = true;
          }
        } else if (a === 0) {
          if (v < -0.6) left = true;
          if (v > 0.6) right = true;
        } else if (a === 1) {
          if (v < -0.6) up = true;
          if (v > 0.6) down = true;
        }
      }
      txt.push("Pad " + p + ": " + gp.id + "\nmapping=" + (gp.mapping || "non-standard") +
        " pressed=[" + pressed.join(",") + "] axes=[" + axesTxt.join(", ") + "]");
    }

    var dir = (up || left) ? -1 : (down || right) ? 1 : 0;
    if (dir !== 0) {
      if (dir !== prevDir) { Pad.onNav(dir); holdT = now; lastRep = now; }
      else if (now - holdT > 450 && now - lastRep > 160) { Pad.onNav(dir); lastRep = now; }
    }
    prevDir = dir;
    if (conf && !prevC) Pad.onConfirm();
    if (back && !prevB) Pad.onBack();
    prevC = conf; prevB = back;

    badge.textContent = n ? "🎮 Controller connected" : "🎮 No controller (press a button)";
    badge.className = n ? "on" : "";
    if (showDbg) dbg.textContent = n ? txt.join("\n\n") : "No controller detected. Click the page and press a button.";
    requestAnimationFrame(poll);
  }
  requestAnimationFrame(poll);
})();
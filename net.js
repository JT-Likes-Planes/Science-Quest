// Thin wrapper around PeerJS (peer-to-peer WebRTC). No server of your own needed.
window.Net = (function () {
  "use strict";
  var peer = null, conns = {}, hostConn = null, H = {};

  var OPTS = {
    debug: 1,
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" },
        { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
      ]
    }
  };

  function destroy() {
    try { if (peer) peer.destroy(); } catch (e) {}
    peer = null; conns = {}; hostConn = null;
  }

  return {
    available: function () { return typeof Peer !== "undefined"; },
    on: function (handlers) { H = handlers || {}; },
    myId: function () { return peer ? peer.id : null; },

    // Create a room with a random 4-digit code
    host: function (ok, fail) {
      var tries = 0;
      (function attempt() {
        var code = String(Math.floor(1000 + Math.random() * 9000));
        var p = new Peer("sciquest-" + code, OPTS);
        peer = p;
        var opened = false;
        var to = setTimeout(function () {
          if (peer === p && !opened) fail({ type: "server-timeout" });
        }, 12000);
        p.on("open", function () { opened = true; clearTimeout(to); ok(code); });
        p.on("error", function (e) {
          if (e.type === "unavailable-id" && tries++ < 6) { clearTimeout(to); try { p.destroy(); } catch (x) {} attempt(); }
          else if (peer === p) { clearTimeout(to); fail(e); }
        });
        p.on("connection", function (c) {
          conns[c.peer] = c;
          c.on("data", function (d) { if (H.data) H.data(c.peer, d); });
          c.on("close", function () { delete conns[c.peer]; if (H.leave) H.leave(c.peer); });
        });
      })();
    },

    // Join an existing room
    join: function (code, ok, fail) {
      var p = new Peer(undefined, OPTS);
      peer = p;
      var finished = false;
      function bad(e) { if (!finished && peer === p) { finished = true; fail(e); } }
      var to = setTimeout(function () { bad({ type: "timeout" }); }, 20000);
      p.on("open", function () {
        var c = p.connect("sciquest-" + code, { reliable: true });
        hostConn = c;
        c.on("open", function () { if (finished) return; finished = true; clearTimeout(to); ok(); });
        c.on("data", function (d) { if (H.data) H.data(null, d); });
        c.on("close", function () { if (H.hostClosed) H.hostClosed(); });
        c.on("error", function (e) { clearTimeout(to); bad(e); });
      });
      p.on("error", function (e) { clearTimeout(to); bad(e); });
    },

    sendHost: function (msg) { if (hostConn && hostConn.open) hostConn.send(msg); },
    sendTo: function (id, msg) { if (conns[id] && conns[id].open) conns[id].send(msg); },
    broadcast: function (msg) { for (var id in conns) if (conns[id].open) conns[id].send(msg); },
    leave: destroy
  };
})();

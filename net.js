// Thin wrapper around PeerJS (peer-to-peer WebRTC). No server of your own needed.
window.Net = (function () {
  "use strict";
  var peer = null, conns = {}, hostConn = null, H = {};

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
        var p = new Peer("sciquest-" + code);
        peer = p;
        p.on("open", function () { ok(code); });
        p.on("error", function (e) {
          if (e.type === "unavailable-id" && tries++ < 6) { try { p.destroy(); } catch (x) {} attempt(); }
          else if (peer === p) fail(e);
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
      var p = new Peer();
      peer = p;
      p.on("open", function () {
        var c = p.connect("sciquest-" + code, { reliable: true });
        hostConn = c;
        var to = setTimeout(function () { if (peer === p && !c.open) fail({ type: "timeout" }); }, 10000);
        c.on("open", function () { clearTimeout(to); ok(); });
        c.on("data", function (d) { if (H.data) H.data(null, d); });
        c.on("close", function () { if (H.hostClosed) H.hostClosed(); });
      });
      p.on("error", function (e) { if (peer === p) fail(e); });
    },

    sendHost: function (msg) { if (hostConn && hostConn.open) hostConn.send(msg); },
    sendTo: function (id, msg) { if (conns[id] && conns[id].open) conns[id].send(msg); },
    broadcast: function (msg) { for (var id in conns) if (conns[id].open) conns[id].send(msg); },
    leave: destroy
  };
})();
/* Gilded Ace rooms. One browser is the host and runs every table; others connect by room code over PeerJS.
   Solo play is the same code path: you host a room nobody else has joined. */
(function () {
  "use strict";
  const GA = window.GA;
  const PREFIX = "gilded-ace-room-";
  const CODE_AL = "ABCDEFGHJKMNPQRSTUVWXYZ";

  class Host {
    constructor() {
      this.players = {}; this.tables = {}; this.chat = []; this.evts = []; this.eid = 0; this.timers = {}; this.pending = false;
    }
    table(g) {
      if (!this.tables[g]) {
        const E = GA.engines[g]; if (!E) return null;
        this.tables[g] = { pub: {}, priv: {} };
        E.create(this.tables[g], this.ctx(g));
      }
      return this.tables[g];
    }
    ctx(g) {
      const h = this;
      return {
        g,
        players: h.players,
        name: pid => (h.players[pid] || {}).name || "Someone",
        color: pid => (h.players[pid] || {}).color || "#d9b35d",
        here: pid => !!h.players[pid],
        bal: pid => (h.players[pid] ? h.players[pid].chips : 0),
        charge(pid, n) {
          const p = h.players[pid]; n = Math.round(n);
          if (!p || !(n > 0) || p.chips < n) return false;
          p.chips -= n; p.wagered = (p.wagered || 0) + n; return true;
        },
        refund(pid, n) { const p = h.players[pid]; n = Math.round(n); if (p && n > 0) { p.chips += n; p.wagered = Math.max(0, (p.wagered || 0) - n); } },
        pay(pid, n) { const p = h.players[pid]; n = Math.round(n); if (p && n > 0) p.chips += n; },
        result(pid, net, label) {
          const p = h.players[pid]; if (!p) return;
          p.net = (p.net || 0) + net;
          if (net > (p.best || 0)) p.best = net;
          h.evt(g, net > 0 ? "win" : net < 0 ? "lose" : "push", { pid, net, label });
        },
        evt: (kind, data) => h.evt(g, kind, data),
        after(ms, fn, key) {
          key = g + ":" + (key || "main");
          clearTimeout(h.timers[key]);
          h.timers[key] = setTimeout(() => { delete h.timers[key]; try { fn(); } catch (e) { console.error(e); } h.publish(); }, ms);
        },
        cancel(key) { key = g + ":" + (key || "main"); clearTimeout(h.timers[key]); delete h.timers[key]; },
        now: () => Date.now(),
        publish: () => h.publish(),
        sys: text => h.sys(text)
      };
    }
    evt(g, kind, data = {}) {
      this.evts.push(Object.assign({ id: ++this.eid, g, kind, at: Date.now() }, data));
      if (this.evts.length > 40) this.evts.splice(0, this.evts.length - 40);
    }
    sys(text) { this.chat.push({ sys: true, text, at: Date.now() }); if (this.chat.length > 80) this.chat.splice(0, this.chat.length - 80); }
    add(pid, info) {
      const existing = this.players[pid];
      this.players[pid] = {
        name: String(info.name || "Player").slice(0, 20), color: /^#[0-9a-f]{6}$/i.test(info.color) ? info.color : "#d9b35d",
        chips: existing ? existing.chips : Math.max(0, Math.floor(+info.chips || 0)), at: String(info.at || "lobby").slice(0, 20),
        wagered: existing ? existing.wagered : 0, net: existing ? existing.net : 0, best: existing ? existing.best : 0
      };
      if (!existing && Object.keys(this.players).length > 1) this.sys(`${this.players[pid].name} joined the room`);
      this.publish();
    }
    remove(pid) {
      const p = this.players[pid]; if (!p) return;
      for (const g in this.tables) { const E = GA.engines[g]; if (E && E.leave) try { E.leave(this.tables[g], pid, this.ctx(g)); } catch (e) { console.error(e); } }
      this.sys(`${p.name} left with ${GA.fmt(p.chips)} chips`);
      delete this.players[pid];
      this.publish();
    }
    handle(pid, m) {
      const p = this.players[pid]; if (!p || !m || typeof m !== "object") return;
      switch (m.t) {
        case "act": {
          const E = GA.engines[m.g]; if (!E) return;
          const T = this.table(m.g);
          try { E.handle(T, pid, m.a || {}, this.ctx(m.g)); } catch (e) { console.error(e); }
          break;
        }
        case "at": p.at = String(m.g || "lobby").slice(0, 20); if (GA.engines[p.at]) this.table(p.at); break;
        case "chat": { const text = String(m.text || "").slice(0, 240).trim(); if (text) { this.chat.push({ pid, name: p.name, color: p.color, text, at: Date.now() }); if (this.chat.length > 80) this.chat.shift(); } break; }
        case "react": this.evt("*", "react", { pid, e: String(m.e || "").slice(0, 8) }); break;
        case "adj": {
          const d = Math.round(+m.d || 0); if (!d && typeof m.net !== "number") return;
          if (d < 0 && p.chips < -d) return;
          p.chips += d;
          if (d < 0) p.wagered = (p.wagered || 0) - d;
          if (typeof m.why === "string" && m.why.startsWith("tip:")) this.sys(`${p.name} tipped ${m.why.slice(4)} ${-d} chips`);
          if (m.why === "bonus") this.sys(`${p.name} collected a ${GA.fmt(d)} chip bonus`);
          if (typeof m.net === "number") { p.net = (p.net || 0) + m.net; if (m.net > (p.best || 0)) p.best = m.net; }
          if (m.big) this.evt("*", "solo-big", { pid, label: String(m.big).slice(0, 40), net: m.net || d });
          break;
        }
        case "profile":
          p.name = String(m.name || p.name).slice(0, 20);
          if (/^#[0-9a-f]{6}$/i.test(m.color)) p.color = m.color;
          break;
        default: return;
      }
      this.publish();
    }
    publish() {
      if (this.pending) return;
      this.pending = true;
      queueMicrotask(() => { this.pending = false; GA.net._fromHost(this.snapshot()); });
    }
    snapshot() {
      const tables = {};
      for (const g in this.tables) tables[g] = this.tables[g].pub;
      return { code: GA.net.code, host: GA.me.id, now: Date.now(), players: this.players, tables, chat: this.chat.slice(-60), evts: this.evts.slice(-40) };
    }
    stopTimers() { for (const k in this.timers) clearTimeout(this.timers[k]); this.timers = {}; }
  }

  const net = (GA.net = {
    mode: "solo", code: null, host: null, peer: null, conn: null, conns: new Map(), snap: null, skew: 0, subs: [],
    on(fn) { this.subs.push(fn); },
    isMulti() { return this.mode !== "solo"; },
    _emit(snap) {
      this.snap = snap;
      this.skew = this.mode === "client" ? snap.now - Date.now() : 0;
      const me = snap.players[GA.me.id];
      if (me && me.chips !== GA.me.chips) { GA.me.chips = me.chips; GA.saveMe(); }
      for (const f of this.subs) { try { f(snap); } catch (e) { console.error(e); } }
    },
    _fromHost(snap) {
      const json = JSON.stringify(snap);
      for (const c of this.conns.values()) if (c.open) { try { c.send({ t: "snap", s: snap }); } catch (e) {} }
      this._emit(JSON.parse(json));
    },
    send(m) {
      if (this.mode === "client") { if (this.conn && this.conn.open) this.conn.send(m); else GA.toast("Reconnecting to the room…"); }
      else if (this.host) this.host.handle(GA.me.id, m);
    },
    act(g, a) { this.send({ t: "act", g, a }); },
    startSolo() {
      if (this.host) this.host.stopTimers();
      this.mode = "solo"; this.code = null; this.conn = null;
      this.host = new Host();
      this.host.add(GA.me.id, { name: GA.me.name, color: GA.me.color, chips: GA.me.chips, at: GA.route || "lobby" });
      if (GA.route && GA.engines[GA.route]) this.host.table(GA.route);
      this.host.publish();
    },
    _peerOK() {
      if (!window.Peer) { GA.toast("Multiplayer couldn't load. Check your connection and refresh."); return false; }
      return true;
    },
    hostRoom() {
      if (!this._peerOK()) return Promise.reject(new Error("no peer"));
      if (this.mode === "host") return Promise.resolve(this.code);
      return new Promise((resolve, reject) => {
        const tryCode = attempt => {
          let code = ""; for (let i = 0; i < 5; i++) code += CODE_AL[GA.rand(CODE_AL.length)];
          const peer = new Peer(PREFIX + code, { debug: 0 });
          let opened = false;
          peer.on("open", () => {
            opened = true; this.peer = peer; this.mode = "host"; this.code = code;
            this.host.sys(`${GA.me.name} opened room ${code}`);
            this.host.publish(); resolve(code);
          });
          peer.on("connection", conn => this._accept(conn));
          peer.on("disconnected", () => { if (this.peer === peer && !peer.destroyed) setTimeout(() => peer.reconnect(), 1500); });
          peer.on("error", err => {
            if (!opened) {
              peer.destroy();
              if (err.type === "unavailable-id" && attempt < 4) tryCode(attempt + 1);
              else { GA.toast("Couldn't open a room right now. Try again in a moment."); reject(err); }
            } else console.warn("peer error", err.type);
          });
        };
        tryCode(0);
      });
    },
    _accept(conn) {
      let pid = null;
      conn.on("data", m => {
        if (!m || typeof m !== "object") return;
        if (m.t === "hello") {
          pid = String(m.id || "").slice(0, 24);
          if (!pid || pid === GA.me.id) { conn.close(); return; }
          const old = this.conns.get(pid); if (old && old !== conn) try { old.close(); } catch (e) {}
          this.conns.set(pid, conn);
          this.host.add(pid, m);
          GA.sfx.ding();
        } else if (pid && this.conns.get(pid) === conn) this.host.handle(pid, m);
      });
      const gone = () => { if (pid && this.conns.get(pid) === conn) { this.conns.delete(pid); this.host.remove(pid); } };
      conn.on("close", gone); conn.on("error", gone);
    },
    join(code) {
      if (!this._peerOK()) return Promise.reject(new Error("no peer"));
      code = String(code || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
      if (code.length !== 5) { GA.toast("Room codes are 5 letters."); return Promise.reject(new Error("bad code")); }
      if (this.mode !== "solo") this.leave(true);
      return new Promise((resolve, reject) => {
        const peer = new Peer({ debug: 0 });
        let done = false;
        const fail = (msg, err) => { if (done) return; done = true; try { peer.destroy(); } catch (e) {} GA.toast(msg); reject(err || new Error(msg)); };
        const to = setTimeout(() => fail("No room answered with that code. Check it and try again."), 14000);
        peer.on("open", () => {
          const conn = peer.connect(PREFIX + code, { reliable: true, serialization: "json" });
          conn.on("open", () => {
            if (done) return;
            done = true; clearTimeout(to);
            // Settle and refund anything open at your solo tables before switching.
            if (this.host) {
              for (const g in this.host.tables) { const E = GA.engines[g]; if (E && E.leave) try { E.leave(this.host.tables[g], GA.me.id, this.host.ctx(g)); } catch (e) {} }
              GA.me.chips = this.host.players[GA.me.id] ? this.host.players[GA.me.id].chips : GA.me.chips; GA.saveMe();
              this.host.stopTimers();
            }
            this.host = null; this.peer = peer; this.conn = conn; this.mode = "client"; this.code = code;
            conn.send({ t: "hello", id: GA.me.id, name: GA.me.name, color: GA.me.color, chips: GA.me.chips, at: GA.route || "lobby" });
            resolve(code);
          });
          conn.on("data", m => { if (m && m.t === "snap" && this.conn === conn) this._emit(m.s); });
          conn.on("close", () => { if (this.conn === conn) this._lost("The host closed the room. You're back to solo play with your chips."); });
          conn.on("error", () => { if (this.conn === conn) this._lost("Lost the connection to the room. You're back to solo play."); });
        });
        peer.on("error", err => {
          if (!done) fail(err.type === "peer-unavailable" ? "No room is open with that code." : "Couldn't reach the room server. Try again.", err);
          else if (this.peer === peer && (err.type === "network" || err.type === "server-error")) this._lost("Lost the connection to the room. You're back to solo play.");
        });
      });
    },
    _lost(msg) {
      if (this.mode !== "client") return;
      const chips = GA.me.chips;
      try { this.peer && this.peer.destroy(); } catch (e) {}
      this.peer = null; this.conn = null;
      GA.me.chips = chips; GA.saveMe();
      this.startSolo();
      GA.toast(msg);
    },
    leave(quiet) {
      if (this.mode === "client") {
        const c = this.conn, p = this.peer; this.conn = null;
        try { c && c.close(); } catch (e) {}
        try { p && p.destroy(); } catch (e) {}
        this.peer = null; this.startSolo();
      } else if (this.mode === "host") {
        for (const [pid, c] of this.conns) { try { c.close(); } catch (e) {} this.host.remove(pid); }
        this.conns.clear();
        try { this.peer && this.peer.destroy(); } catch (e) {}
        this.peer = null; this.mode = "solo"; this.code = null;
        this.host.publish();
      }
      if (!quiet) GA.toast("You left the room. Solo tables are still open.");
    },
    inviteLink() { return location.origin + location.pathname + "?room=" + this.code; }
  });

  addEventListener("beforeunload", () => { try { net.peer && net.peer.destroy(); } catch (e) {} });
})();

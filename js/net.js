/* Gilded Ace rooms. One browser is the host and runs every table; others connect by room code over PeerJS.
   Solo play is the same code path: you host a room nobody else has joined. */
(function () {
  "use strict";
  const GA = window.GA;
  const PREFIX = "gilded-ace-room-";
  const CODE_AL = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const BROKERS = ["wss://broker.emqx.io:8084/mqtt", "wss://broker.hivemq.com:8884/mqtt"];
  const TOPIC = code => "gilded-ace/v1/" + code;
  // A connection-shaped object for relay players, so the host treats them like direct ones.
  function relayConn(send) {
    const ls = {};
    const conn = {
      open: true, seen: Date.now(),
      on(ev, fn) { (ls[ev] = ls[ev] || []).push(fn); },
      _emit(ev, arg) { (ls[ev] || []).forEach(f => { try { f(arg); } catch (e) { console.error(e); } }); },
      send(m) { if (conn.open) try { send(m); } catch (e) {} },
      close() { if (!conn.open) return; try { send({ t: "bye" }); } catch (e) {} conn.open = false; }
    };
    return conn;
  }

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
          h.record(p, g, net);
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
    // Per-table totals and the latest result, shown on every player's rail.
    record(p, g, net) {
      p.tbl = p.tbl || {};
      p.tbl[g] = (p.tbl[g] || 0) + net;
      p.hands = (p.hands || 0) + 1;
      p.last = { g, net, at: Date.now() };
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
        wagered: existing ? existing.wagered : 0, net: existing ? existing.net : 0, best: existing ? existing.best : 0,
        tbl: existing ? existing.tbl : {}, hands: existing ? existing.hands : 0, last: existing ? existing.last : null, start: existing ? existing.start : Math.max(0, Math.floor(+info.chips || 0))
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
          if (typeof m.net === "number") { p.net = (p.net || 0) + m.net; if (m.net > (p.best || 0)) p.best = m.net; if (typeof m.g === "string" && GA.engines[m.g] === undefined && GA.views[m.g]) this.record(p, m.g, m.net); }
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
      queueMicrotask(() => { this.pending = false; GA.net._fromHost(this); });
    }
    // Each player gets their own copy, so games can hide private cards (poker hole cards).
    snapshot(pid) {
      const tables = {};
      for (const g in this.tables) { const E = GA.engines[g]; tables[g] = E && E.redact ? E.redact(this.tables[g], pid) : this.tables[g].pub; }
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
    _fromHost(host) {
      for (const [pid, c] of this.conns) if (c.open) { try { c.send({ t: "snap", s: host.snapshot(pid) }); } catch (e) {} }
      this._emit(JSON.parse(JSON.stringify(host.snapshot(GA.me.id))));
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
    hostRoom() {
      if (this.mode === "host") return Promise.resolve(this.code);
      if (!window.Peer && !window.mqtt) { GA.toast("Multiplayer couldn't load. Check your connection and refresh."); return Promise.reject(new Error("no transport")); }
      return new Promise(resolve => {
        let settled = false;
        const open = (code, peer) => {
          if (settled) return; settled = true;
          this.peer = peer || null; this.mode = "host"; this.code = code;
          this._relayHost(code);
          this.host.sys(`${GA.me.name} opened room ${code}`);
          this.host.publish(); resolve(code);
        };
        const newCode = () => { let c = ""; for (let i = 0; i < 5; i++) c += CODE_AL[GA.rand(CODE_AL.length)]; return c; };
        if (!window.Peer) { open(newCode()); return; }
        // Fall back to relay-only if the PeerJS server doesn't answer in time.
        const giveUp = setTimeout(() => open(newCode()), 7000);
        const tryCode = attempt => {
          const code = newCode();
          const peer = new Peer(PREFIX + code, { debug: 0 });
          let opened = false;
          peer.on("open", () => { opened = true; clearTimeout(giveUp); if (settled) { peer.destroy(); return; } open(code, peer); });
          peer.on("connection", conn => this._accept(conn));
          peer.on("disconnected", () => { if (this.peer === peer && !peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch (e) {} }, 1500); });
          peer.on("error", err => {
            if (!opened) {
              try { peer.destroy(); } catch (e) {}
              if (err.type === "unavailable-id" && attempt < 4) tryCode(attempt + 1);
              else { clearTimeout(giveUp); open(newCode()); }
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

    /* ----- Relay (MQTT over secure websockets): used when two browsers can't connect directly ----- */
    _relayHost(code) {
      if (!window.mqtt) return;
      const T = TOPIC(code), conns = new Map();
      const clients = BROKERS.map(url => {
        const c = mqtt.connect(url, { clientId: "gah-" + GA.uid(10), reconnectPeriod: 3000, connectTimeout: 8000, clean: true });
        c.on("connect", () => c.subscribe(T + "/h"));
        c.on("message", (topic, payload) => {
          let msg; try { msg = JSON.parse(payload.toString()); } catch (e) { return; }
          if (!msg || typeof msg.from !== "string" || !msg.m) return;
          const key = url + "|" + msg.from;
          let conn = conns.get(key);
          if (!conn) {
            if (msg.m.t !== "hello") return;
            conn = relayConn(m2 => c.publish(T + "/c/" + msg.from, JSON.stringify(m2)));
            conns.set(key, conn);
            this._accept(conn);
          }
          conn.seen = Date.now();
          if (msg.m.t === "bye") { conn.open = false; conn._emit("close"); conns.delete(key); return; }
          if (msg.m.t !== "ping") conn._emit("data", msg.m);
        });
        c.on("error", () => {});
        return c;
      });
      const beat = setInterval(() => {
        const now = Date.now();
        for (const [key, conn] of conns) {
          if (now - conn.seen > 25000) { conn.open = false; conn._emit("close"); conns.delete(key); }
          else conn.send({ t: "hb" });
        }
      }, 8000);
      this._relay = { clients, conns, beat };
    },
    _relayStop() {
      const r = this._relay; if (!r) return;
      clearInterval(r.beat);
      for (const conn of r.conns.values()) { try { conn.send({ t: "bye" }); } catch (e) {} }
      setTimeout(() => r.clients.forEach(c => { try { c.end(true); } catch (e) {} }), 300);
      this._relay = null;
    },

    // Settle your solo tables and keep the chips you'll bring into someone else's room.
    _leaveSolo() {
      if (!this.host) return;
      for (const g in this.host.tables) { const E = GA.engines[g]; if (E && E.leave) try { E.leave(this.host.tables[g], GA.me.id, this.host.ctx(g)); } catch (e) {} }
      if (this.host.players[GA.me.id]) GA.me.chips = this.host.players[GA.me.id].chips;
      GA.saveMe();
      this.host.stopTimers();
      this.host = null;
    },
    _hello() { return { t: "hello", id: GA.me.id, name: GA.me.name, color: GA.me.color, chips: this.host && this.host.players[GA.me.id] ? this.host.players[GA.me.id].chips : GA.me.chips, at: GA.route || "lobby" }; },

    _tryPeer(code) {
      return new Promise(resolve => {
        if (!window.Peer) { resolve({ ok: false, why: "error" }); return; }
        let done = false;
        const peer = new Peer({ debug: 0 });
        const finish = r => { if (done) return; done = true; clearTimeout(to); if (!r.ok) try { peer.destroy(); } catch (e) {} resolve(r); };
        const to = setTimeout(() => finish({ ok: false, why: "timeout" }), 9000);
        peer.on("open", () => {
          const conn = peer.connect(PREFIX + code, { reliable: true, serialization: "json" });
          conn.on("open", () => {
            if (done) { try { conn.close(); } catch (e) {} return; }
            const hello = this._hello();
            finish({ ok: true });
            this._leaveSolo();
            this.peer = peer; this.conn = conn; this.mode = "client"; this.code = code; this.via = "direct";
            conn.send(hello);
          });
          conn.on("data", m => { if (m && m.t === "snap" && this.conn === conn) this._emit(m.s); });
          conn.on("close", () => { if (this.conn === conn) this._lost("The host closed the room. You're back to solo play with your chips."); });
          conn.on("error", () => { if (this.conn === conn) this._lost("Lost the connection to the room. You're back to solo play."); });
        });
        peer.on("error", err => {
          if (!done) finish({ ok: false, why: err.type === "peer-unavailable" ? "missing" : "error" });
          else if (this.peer === peer && (err.type === "network" || err.type === "server-error")) this._lost("Lost the connection to the room. You're back to solo play.");
        });
      });
    },
    _tryRelay(code) {
      if (!window.mqtt) return Promise.resolve({ ok: false });
      const T = TOPIC(code), me = GA.me.id;
      const attempt = url => new Promise(resolve => {
        let done = false, c;
        const finish = ok => { if (done) return; done = true; clearTimeout(to); if (!ok) try { c.end(true); } catch (e) {} resolve(ok ? c : null); };
        const to = setTimeout(() => finish(false), 9000);
        c = mqtt.connect(url, { clientId: "gac-" + GA.uid(10), reconnectPeriod: 0, connectTimeout: 7000, clean: true });
        c.on("error", () => finish(false));
        c.on("connect", () => c.subscribe(T + "/c/" + me, err => {
          if (err) { finish(false); return; }
          c.publish(T + "/h", JSON.stringify({ from: me, m: this._hello() }));
        }));
        c.once("message", (topic, payload) => { c._first = payload; finish(true); });
      });
      return (async () => {
        for (const url of BROKERS) {
          const c = await attempt(url);
          if (!c) continue;
          this._leaveSolo();
          const conn = relayConn(m => c.publish(T + "/h", JSON.stringify({ from: me, m })));
          let seen = Date.now();
          const onMsg = payload => {
            if (this.conn !== conn) return;
            let m; try { m = JSON.parse(payload.toString()); } catch (e) { return; }
            seen = Date.now();
            if (m.t === "snap") this._emit(m.s);
            else if (m.t === "bye") this._lost("The host closed the room. You're back to solo play with your chips.");
          };
          conn.close = () => { if (!conn.open) return; conn.open = false; try { c.publish(T + "/h", JSON.stringify({ from: me, m: { t: "bye" } })); } catch (e) {} setTimeout(() => { try { c.end(true); } catch (e) {} }, 300); };
          const ping = setInterval(() => {
            if (this.conn !== conn) { clearInterval(ping); return; }
            if (Date.now() - seen > 30000) { clearInterval(ping); this._lost("Lost the connection to the room. You're back to solo play."); return; }
            conn.send({ t: "ping" });
          }, 6000);
          c.on("message", (topic, payload) => onMsg(payload));
          this.peer = null; this.conn = conn; this.mode = "client"; this.code = code; this.via = "relay";
          if (c._first) onMsg(c._first);
          return { ok: true };
        }
        return { ok: false };
      })();
    },
    async join(code) {
      code = String(code || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
      if (code.length !== 5) { GA.toast("Room codes are 5 letters."); throw new Error("bad code"); }
      if (!window.Peer && !window.mqtt) { GA.toast("Multiplayer couldn't load. Check your connection and refresh."); throw new Error("no transport"); }
      if (this.mode !== "solo") this.leave(true);
      GA.toast(`Looking for room ${code}…`);
      const direct = await this._tryPeer(code);
      if (direct.ok) return code;
      GA.toast("Trying the backup connection…");
      const relay = await this._tryRelay(code);
      if (relay.ok) return code;
      if (!this.host) this.startSolo();
      const msg = direct.why === "missing"
        ? "No room is open with that code. Check the letters, and make sure the host still has the casino open."
        : "Couldn't reach that room. Ask the host to keep the casino open on screen, then try again.";
      GA.toast(msg);
      throw new Error(msg);
    },
    _lost(msg) {
      if (this.mode !== "client") return;
      const c = this.conn;
      this.conn = null;
      try { c && this.via === "relay" && c.close(); } catch (e) {}
      try { this.peer && this.peer.destroy(); } catch (e) {}
      this.peer = null;
      GA.saveMe();
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
        this._relayStop();
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

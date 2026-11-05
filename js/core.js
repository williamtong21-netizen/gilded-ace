/* Gilded Ace core: utilities, the player profile, sound, effects, chips and cards. */
(function () {
  "use strict";
  const GA = (window.GA = window.GA || {});
  GA.engines = GA.engines || {};
  GA.views = GA.views || {};

  GA.$ = (s, r = document) => r.querySelector(s);
  GA.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  GA.fmt = n => Math.round(n).toLocaleString("en-US");
  GA.short = n => (n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M" : n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + "K" : String(n));
  GA.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  GA.rand = n => {
    // unbiased integer in [0, n)
    const max = Math.floor(0xffffffff / n) * n, a = new Uint32Array(1);
    do crypto.getRandomValues(a); while (a[0] >= max);
    return a[0] % n;
  };
  GA.pick = arr => arr[GA.rand(arr.length)];
  GA.shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = GA.rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  GA.uid = (n = 8) => { const al = "abcdefghjkmnpqrstuvwxyz23456789"; let s = ""; for (let i = 0; i < n; i++) s += al[GA.rand(al.length)]; return s; };
  GA.reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- Storage ---------- */
  GA.store = {
    get(k, d) { try { const v = localStorage.getItem("ga." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("ga." + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- Profile ---------- */
  GA.COLORS = ["#f06a8f", "#d9b35d", "#5fc7d6", "#9b7bea", "#7fe0a8", "#ff9f5a", "#e8e2d0", "#ff5d5d"];
  const NAMES = ["Lucky", "Ace", "Dice", "Velvet", "Ruby", "Maverick", "Diamond", "Blaze", "Jinx", "Sterling"];
  // One id per browser tab, so two tabs (or a host opening their own invite link) never collide.
  let tabId = null;
  try { tabId = sessionStorage.getItem("ga.tab"); if (!tabId) { tabId = GA.uid(10); sessionStorage.setItem("ga.tab", tabId); } } catch (e) { tabId = GA.uid(10); }
  GA.me = {
    id: tabId,
    name: GA.store.get("name") || GA.pick(NAMES) + " " + (10 + GA.rand(89)),
    color: GA.store.get("color") || GA.pick(GA.COLORS),
    chips: GA.store.get("chips", 10000),
    sound: GA.store.get("sound", true),
    lastBonus: GA.store.get("lastBonus", ""),
    stats: GA.store.get("stats", { wagered: 0, won: 0, biggest: 0, hands: 0 })
  };
  GA.saveMe = () => {
    const m = GA.me;
    GA.store.set("name", m.name); GA.store.set("color", m.color);
    GA.store.set("chips", m.chips); GA.store.set("sound", m.sound); GA.store.set("lastBonus", m.lastBonus); GA.store.set("stats", m.stats);
  };
  GA.saveMe();

  /* ---------- Audio ---------- */
  let ac = null;
  function audio() {
    if (!GA.me.sound) return null;
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  function tone(freq, dur = 0.08, type = "square", vol = 0.04, when = 0) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + when;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur = 0.06, vol = 0.05, when = 0, hp = 2000) {
    const a = audio(); if (!a) return;
    const len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = "highpass"; f.frequency.value = hp; g.gain.value = vol;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(a.destination); s.start(a.currentTime + when);
  }
  GA.sfx = {
    chip: () => { tone(1800, 0.04, "triangle", 0.05); tone(2400, 0.05, "triangle", 0.03, 0.03); },
    card: () => noise(0.07, 0.08, 0, 2500),
    flip: () => noise(0.05, 0.06, 0, 4000),
    tick: () => tone(900 + Math.random() * 300, 0.025, "square", 0.015),
    thud: () => tone(140, 0.12, "sine", 0.12),
    dice: () => { for (let i = 0; i < 6; i++) noise(0.03, 0.09, i * 0.07, 1200); },
    lose: () => { tone(330, 0.18, "sawtooth", 0.03); tone(247, 0.3, "sawtooth", 0.03, 0.16); },
    win: () => [523, 659, 784].forEach((f, i) => tone(f, 0.16, "triangle", 0.06, i * 0.09)),
    big: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, "triangle", 0.07, i * 0.1)),
    coin: () => { tone(2600, 0.3, "sine", 0.05); tone(3900, 0.25, "sine", 0.02, 0.02); },
    ding: () => tone(1320, 0.25, "sine", 0.05),
    pop: () => tone(660, 0.06, "sine", 0.05)
  };

  /* ---------- Toast + big win ---------- */
  let toastT;
  GA.toast = msg => {
    const t = GA.$("#toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2800);
  };
  let bwT;
  GA.bigWin = (kicker, head, profit) => {
    const el = GA.$("#bigwin"); if (!el) return;
    GA.$("#bw-k").textContent = kicker; GA.$("#bw-h").textContent = head; GA.$("#bw-p").textContent = "+" + GA.fmt(profit) + " chips";
    el.classList.add("show"); clearTimeout(bwT); bwT = setTimeout(() => el.classList.remove("show"), 2800);
    GA.celebrate(220); GA.sfx.big();
  };

  // The full blackjack moment: banner, suit confetti in waves, a fanfare.
  GA.blackjackParty = (net, kicker) => {
    const el = GA.$("#bigwin"); if (!el) return;
    GA.$("#bw-k").textContent = kicker || "Twenty-One Club";
    GA.$("#bw-h").textContent = "BLACKJACK!";
    GA.$("#bw-p").textContent = net > 0 ? "+" + GA.fmt(net) + " chips" : "Natural 21";
    el.classList.add("show", "bj"); clearTimeout(bwT);
    bwT = setTimeout(() => el.classList.remove("show", "bj"), 3400);
    GA.celebrate(260, { suits: true });
    setTimeout(() => GA.celebrate(160, { suits: true }), 650);
    setTimeout(() => GA.celebrate(120, { suits: true }), 1300);
    GA.sfx.big(); setTimeout(GA.sfx.coin, 700); setTimeout(GA.sfx.coin, 900);
  };

  /* ---------- Confetti ---------- */
  let parts = [], running = false, fx, fctx;
  function sizeFx() { if (!fx) return; const dpr = Math.min(2, devicePixelRatio || 1); fx.width = innerWidth * dpr; fx.height = innerHeight * dpr; fctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function heart(ctx, s) { ctx.beginPath(); ctx.moveTo(0, s * 0.3); ctx.bezierCurveTo(-s, -s * 0.4, -s * 0.4, -s * 1.1, 0, -s * 0.45); ctx.bezierCurveTo(s * 0.4, -s * 1.1, s, -s * 0.4, 0, s * 0.3); ctx.fill(); }
  GA.celebrate = (n, opts = {}) => {
    if (GA.reduced) return;
    if (!fx) { fx = GA.$("#fx"); if (!fx) return; fctx = fx.getContext("2d"); sizeFx(); addEventListener("resize", sizeFx); }
    const cols = ["#f8e7ad", "#d9b35d", "#f06a8f", "#b8172e", "#f6ecd8", "#6d2c8f", "#1e7b4f"];
    for (let i = 0; i < n; i++) {
      const r = Math.random(), kind = opts.suits && r < 0.35 ? "suit" : r < 0.25 ? "heart" : r < 0.65 ? "chip" : "spark";
      parts.push({ kind, x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.5, y: innerHeight * 0.6, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 18 - 8,
        s: 6 + Math.random() * 10, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: cols[(Math.random() * cols.length) | 0], life: 0, max: 120 + Math.random() * 80 });
    }
    if (!running) { running = true; requestAnimationFrame(loop); }
  };
  function loop() {
    fctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life < p.max && p.y < innerHeight + 40);
    for (const p of parts) {
      p.life++; p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      fctx.save(); fctx.globalAlpha = 1 - Math.max(0, (p.life - p.max * 0.7) / (p.max * 0.3));
      fctx.translate(p.x, p.y); fctx.rotate(p.r); fctx.fillStyle = p.c;
      if (p.kind === "suit") { if (!p.g) { p.g = "♠♥♦♣"[(Math.random() * 4) | 0]; p.c = p.g === "♥" || p.g === "♦" ? "#e2364f" : "#f6ecd8"; fctx.fillStyle = p.c; } fctx.font = `${Math.round(p.s * 2.4)}px serif`; fctx.textAlign = "center"; fctx.textBaseline = "middle"; fctx.fillText(p.g, 0, 0); }
      else if (p.kind === "heart") heart(fctx, p.s);
      else if (p.kind === "chip") {
        fctx.scale(1, Math.abs(Math.cos(p.r * 2)) * 0.8 + 0.2);
        fctx.beginPath(); fctx.arc(0, 0, p.s, 0, 6.283); fctx.fill();
        fctx.strokeStyle = "#f6ecd8"; fctx.setLineDash([3, 3]); fctx.lineWidth = 2; fctx.beginPath(); fctx.arc(0, 0, p.s * 0.75, 0, 6.283); fctx.stroke();
      } else { fctx.fillRect(-p.s / 2, -1.5, p.s, 3); fctx.fillRect(-1.5, -p.s / 2, 3, p.s); }
      fctx.restore();
    }
    if (parts.length) requestAnimationFrame(loop); else { running = false; fctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* ---------- Chips ---------- */
  GA.DENOMS = [10, 25, 100, 500, 1000, 5000];
  GA.chip = GA.store.get("chipSel", 100);
  const racks = new Set();
  GA.rack = (el, opts = {}) => {
    const denoms = opts.denoms || GA.DENOMS;
    if (!denoms.includes(GA.chip)) GA.chip = denoms[2] || denoms[0];
    el.classList.add("rack");
    el.innerHTML = `<span class="lbl">${opts.label || "Chip"}</span>` + denoms.map(v => `<button type="button" class="chip" data-v="${v}" aria-label="${v} chip" aria-pressed="${v === GA.chip}">${GA.short(v)}</button>`).join("");
    el.addEventListener("click", e => {
      const b = e.target.closest(".chip"); if (!b) return;
      GA.chip = +b.dataset.v; GA.store.set("chipSel", GA.chip); GA.sfx.chip();
      racks.forEach(r => GA.$$(".chip", r).forEach(c => c.setAttribute("aria-pressed", String(+c.dataset.v === GA.chip))));
    });
    racks.add(el);
  };
  GA.chipColor = n => (n >= 5000 ? "#b8172e" : n >= 1000 ? "#c49428" : n >= 500 ? "#6d2c8f" : n >= 100 ? "#2a1d21" : n >= 25 ? "#1e7b4f" : "#3a6fb0");
  GA.stack = (n, color) => (n > 0 ? `<span class="stack"><i style="--c:${color || GA.chipColor(n)}"></i>${GA.fmt(n)}</span>` : "");

  /* ---------- Cards ---------- */
  GA.RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  GA.SUITS = ["♠", "♥", "♦", "♣"];
  GA.isRed = c => c.s === "♥" || c.s === "♦";
  GA.makeShoe = (decks = 1, filter) => {
    const shoe = [];
    for (let d = 0; d < decks; d++) for (const s of GA.SUITS) for (const r of GA.RANKS) if (!filter || filter(r, s)) shoe.push({ r, s });
    return GA.shuffle(shoe);
  };
  GA.cardHTML = (c, cls = "") => {
    if (!c || c.back) return `<span class="card back ${cls}" aria-label="Face-down card"></span>`;
    const face = "JQK".includes(c.r);
    return `<span class="card ${GA.isRed(c) ? "red" : ""} ${cls}" aria-label="${c.r} of ${c.s}"><span class="tl">${c.r}<small>${c.s}</small></span><span class="c ${face ? "face" : ""}">${face ? c.r + "<small style='font-size:.5em'>" + c.s + "</small>" : c.s}</span><span class="br">${c.r}<small>${c.s}</small></span></span>`;
  };
  // Renders cards and animates only cards this view has not shown before.
  GA.cardTracker = () => {
    const seen = new Set();
    return {
      html(key, c, extra = "") {
        const k = key + (c && !c.back ? ":" + c.r + c.s : ":back");
        let cls = extra;
        if (!seen.has(k)) {
          seen.add(k);
          const wasBack = c && !c.back && seen.has(key + ":back");
          cls += wasBack ? " flip-in" : " deal-in";
        }
        return GA.cardHTML(c, cls);
      },
      reset() { seen.clear(); }
    };
  };

  /* ---------- Time ---------- */
  GA.remaining = deadline => (deadline ? Math.max(0, deadline - (Date.now() + (GA.net ? GA.net.skew : 0))) : 0);
  GA.timerHTML = deadline => {
    const ms = GA.remaining(deadline); if (!deadline || ms <= 0) return "";
    const s = Math.ceil(ms / 1000);
    return `<span class="timer ${s <= 5 ? "hot" : ""}">${s}s</span>`;
  };

  /* ---------- Wallet (routes through the room host) ---------- */
  GA.wallet = {
    bal() { const s = GA.net && GA.net.snap, p = s && s.players && s.players[GA.me.id]; return p ? p.chips : GA.me.chips; },
    can(n) { return this.bal() >= n; },
    adjust(delta, why) { GA.net.send({ t: "adj", d: Math.round(delta), why }); }
  };
})();

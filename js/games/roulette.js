/* Roulette: one European wheel, everyone in the room bets on the same spin. */
(function () {
  "use strict";
  const GA = window.GA;
  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = n => (n === 0 ? "g" : REDS.has(n) ? "r" : "b");
  const MAX_TOTAL = 100000, SPIN_MS = 6000;

  function wins(key, n) {
    if (key[0] === "n") return +key.slice(1) === n ? 36 : 0;
    if (n === 0) return 0;
    switch (key) {
      case "red": return REDS.has(n) ? 2 : 0;
      case "black": return !REDS.has(n) ? 2 : 0;
      case "odd": return n % 2 ? 2 : 0;
      case "even": return n % 2 ? 0 : 2;
      case "low": return n <= 18 ? 2 : 0;
      case "high": return n >= 19 ? 2 : 0;
      case "d1": return n <= 12 ? 3 : 0;
      case "d2": return n >= 13 && n <= 24 ? 3 : 0;
      case "d3": return n >= 25 ? 3 : 0;
      case "c1": return n % 3 === 1 ? 3 : 0;
      case "c2": return n % 3 === 2 ? 3 : 0;
      case "c3": return n % 3 === 0 ? 3 : 0;
    }
    return 0;
  }
  const validKey = k => /^n([0-9]|[12][0-9]|3[0-6])$/.test(k) || ["red", "black", "odd", "even", "low", "high", "d1", "d2", "d3", "c1", "c2", "c3"].includes(k);

  function spin(T, ctx) {
    const P = T.pub;
    if (P.phase !== "betting") return;
    if (!Object.keys(P.bets).length) return;
    ctx.cancel(); P.deadline = 0;
    const n = ORDER[GA.rand(37)];
    P.phase = "spinning"; P.spin = { id: (P.spin ? P.spin.id : 0) + 1, n };
    P.msg = "No more bets.";
    ctx.evt("spin", {});
    ctx.after(SPIN_MS + 300, () => settle(T, ctx));
  }
  function settle(T, ctx) {
    const P = T.pub, n = P.spin.n;
    P.results = {};
    for (const pid in P.bets) {
      const b = P.bets[pid]; let back = 0, staked = 0, bestMult = 0;
      for (const k in b) { const m = wins(k, n); back += b[k] * m; staked += b[k]; if (m > bestMult) bestMult = m; }
      ctx.pay(pid, back);
      const net = back - staked;
      P.results[pid] = net;
      ctx.result(pid, net, bestMult === 36 ? "Straight up!" : "");
      T.priv.last[pid] = Object.assign({}, b); P.canRebet[pid] = true;
    }
    P.history.unshift(n); P.history = P.history.slice(0, 16);
    P.phase = "payout"; P.winning = n;
    P.msg = `${n} ${n === 0 ? "green" : REDS.has(n) ? "red" : "black"}.`;
    ctx.after(4500, () => { P.phase = "betting"; P.bets = {}; P.results = {}; T.priv.hist = {}; P.msg = "Place your bets."; });
  }

  const sum = b => Object.values(b || {}).reduce((x, y) => x + y, 0);
  function arm(T, ctx) {
    const P = T.pub;
    P.winning = null;
    if (!P.deadline) { P.deadline = Date.now() + 20000; ctx.after(20000, () => spin(T, ctx)); }
  }
  function remember(T, pid) {
    const h = (T.priv.hist[pid] = T.priv.hist[pid] || []);
    h.push(Object.assign({}, T.pub.bets[pid] || {}));
    if (h.length > 60) h.shift();
  }

  GA.engines.roulette = {
    create(T) {
      T.pub = { phase: "betting", bets: {}, deadline: 0, spin: null, history: [], results: {}, msg: "Place your bets.", winning: null, canRebet: {} };
      T.priv = { last: {}, hist: {} };
    },
    handle(T, pid, a, ctx) {
      const P = T.pub, mine = P.bets[pid] || {};
      const betting = P.phase === "betting";
      if (a.k === "bet") {
        if (!betting || !validKey(a.key)) return;
        const amt = Math.round(+a.amt || 0); if (amt <= 0) return;
        if (sum(mine) + amt > MAX_TOTAL) { ctx.evt("limit", { pid }); return; }
        if (!ctx.charge(pid, amt)) { ctx.evt("broke", { pid }); return; }
        remember(T, pid);
        mine[a.key] = (mine[a.key] || 0) + amt; P.bets[pid] = mine;
        arm(T, ctx); ctx.evt("bet", { pid });
      } else if (a.k === "double") {
        // Double every chip you have on the table.
        const total = sum(mine);
        if (!betting || !total) return;
        if (total * 2 > MAX_TOTAL) { ctx.evt("limit", { pid }); return; }
        if (!ctx.charge(pid, total)) { ctx.evt("broke", { pid }); return; }
        remember(T, pid);
        for (const k in mine) mine[k] *= 2;
        arm(T, ctx); ctx.evt("bet", { pid });
      } else if (a.k === "undo") {
        // Take back your last chip (or your last double / rebet).
        const h = T.priv.hist[pid];
        if (!betting || !h || !h.length) return;
        const prev = h.pop(), back = sum(mine) - sum(prev);
        if (back > 0) ctx.refund(pid, back);
        if (sum(prev)) P.bets[pid] = prev; else delete P.bets[pid];
        if (!Object.keys(P.bets).length) { ctx.cancel(); P.deadline = 0; }
      } else if (a.k === "clear") {
        if (!betting || !P.bets[pid]) return;
        ctx.refund(pid, sum(mine));
        delete P.bets[pid]; T.priv.hist[pid] = [];
        if (!Object.keys(P.bets).length) { ctx.cancel(); P.deadline = 0; }
      } else if (a.k === "rebet") {
        // Repeat last spin's bets, optionally at double size.
        const L = T.priv.last[pid], x = a.x === 2 ? 2 : 1;
        if (!betting || P.bets[pid] || !L) return;
        const total = sum(L) * x;
        if (total > MAX_TOTAL) { ctx.evt("limit", { pid }); return; }
        if (!ctx.charge(pid, total)) { ctx.evt("broke", { pid }); return; }
        remember(T, pid);
        P.bets[pid] = {}; for (const k in L) P.bets[pid][k] = L[k] * x;
        arm(T, ctx); ctx.evt("bet", { pid });
      } else if (a.k === "spin") {
        if (P.bets[pid]) spin(T, ctx);
      }
    },
    leave(T, pid, ctx) {
      const P = T.pub;
      if (P.phase === "betting" && P.bets[pid]) {
        ctx.refund(pid, sum(P.bets[pid]));
        delete P.bets[pid];
        if (!Object.keys(P.bets).length) { ctx.cancel(); P.deadline = 0; }
      }
    }
  };

  /* ================= VIEW ================= */
  GA.views.roulette = {
    title: "Roulette",
    mount(el) {
      el.innerHTML = `
        <div class="view-head">
          <div><div class="eyebrow">Roulette Royale · Single zero · Shared wheel</div><h1 class="gold-text">Roulette Royale</h1>
          <p>Everyone in the room bets on the same spin. The wheel turns 20 seconds after the first chip lands, or sooner if you call it.</p></div>
          <div class="who-here" data-who></div>
        </div>
        <div class="felt">
          <div data-dealer></div>
          <div class="roul">
            <div class="wheel-box"><span class="pointer"></span><canvas data-wheel role="img" aria-label="Roulette wheel"></canvas></div>
            <div style="min-width:0;display:grid;gap:12px">
              <div class="layout-scroll"><div class="layout" data-layout></div></div>
              <div class="history" data-hist></div>
            </div>
          </div>
        </div>
        <div class="table-bar"><div class="status" data-status></div><div class="controls" data-controls></div></div>
        <div style="margin-top:14px" data-rack></div>
        <p class="rules" style="margin-top:14px">Straight up pays 35:1. Dozens and columns pay 2:1. Red, black, odd, even, 1–18 and 19–36 pay even money. Zero loses every outside bet.</p>`;
      const q = s => el.querySelector(s);
      const dealer = GA.dealer(q("[data-dealer]"), "valentina");
      GA.rack(q("[data-rack]"));

      // Layout grid
      let cellsHTML = `<button type="button" class="cell g" data-key="n0" style="grid-row:1/4;grid-column:1">0</button>`;
      for (let col = 0; col < 12; col++) for (let row = 0; row < 3; row++) {
        const n = col * 3 + (3 - row);
        cellsHTML += `<button type="button" class="cell ${colorOf(n)}" data-key="n${n}" style="grid-row:${row + 1};grid-column:${col + 2}">${n}</button>`;
      }
      ["c3", "c2", "c1"].forEach((k, i) => (cellsHTML += `<button type="button" class="cell o" data-key="${k}" style="grid-row:${i + 1};grid-column:14">2 to 1</button>`));
      [["d1", "1st 12"], ["d2", "2nd 12"], ["d3", "3rd 12"]].forEach(([k, l], i) => (cellsHTML += `<button type="button" class="cell o" data-key="${k}" style="grid-row:4;grid-column:${2 + i * 4}/${6 + i * 4}">${l}</button>`));
      [["low", "1–18"], ["even", "Even"], ["red", "Red"], ["black", "Black"], ["odd", "Odd"], ["high", "19–36"]].forEach(([k, l], i) => (cellsHTML += `<button type="button" class="cell o ${k === "red" ? "r" : k === "black" ? "b" : ""}" data-key="${k}" style="grid-row:5;grid-column:${2 + i * 2}/${4 + i * 2}">${l}</button>`));
      q("[data-layout]").innerHTML = cellsHTML;
      const cellEls = {};
      GA.$$("[data-key]", q("[data-layout]")).forEach(c => (cellEls[c.dataset.key] = c));

      el.addEventListener("click", e => {
        const c = e.target.closest("[data-key]");
        if (c) { GA.net.act("roulette", { k: "bet", key: c.dataset.key, amt: GA.chip }); GA.sfx.chip(); return; }
        const b = e.target.closest("[data-act]"); if (b && !b.disabled) { GA.net.act("roulette", { k: b.dataset.act, x: b.dataset.x ? +b.dataset.x : undefined }); GA.sfx.chip(); }
      });

      // Wheel
      const cv = q("[data-wheel]"), cx = cv.getContext("2d");
      let rot = 0, ballA = -Math.PI / 2, ballR = 0.7, anim = null, lastSpinId = null;
      const SEG = (Math.PI * 2) / 37;
      const COL = { r: "#b8172e", b: "#1a1013", g: "#13583f", gold: "#d9b35d", hi: "#f8e7ad", lo: "#8b6a2b", ink: "#120509", velvet: "#2a0a14", velvet2: "#44111f", ivory: "#f6ecd8" };
      function size() { const w = cv.parentElement.getBoundingClientRect().width; if (!w) return; const dpr = Math.min(2, devicePixelRatio || 1); cv.width = cv.height = Math.round(w * dpr); draw(); }
      function draw() {
        const W = cv.width, R = W / 2, c = cx; if (!W) return;
        c.clearRect(0, 0, W, W); c.save(); c.translate(R, R);
        let g = c.createRadialGradient(0, 0, R * 0.86, 0, 0, R); g.addColorStop(0, COL.lo); g.addColorStop(0.5, COL.hi); g.addColorStop(1, COL.lo);
        c.beginPath(); c.arc(0, 0, R * 0.995, 0, 7); c.fillStyle = g; c.fill();
        c.beginPath(); c.arc(0, 0, R * 0.95, 0, 7); c.fillStyle = COL.velvet; c.fill();
        c.beginPath(); c.arc(0, 0, R * 0.885, 0, 7); c.fillStyle = COL.ink; c.fill();
        for (let i = 0; i < 37; i++) {
          const n = ORDER[i], a0 = rot + i * SEG - Math.PI / 2 - SEG / 2, a1 = a0 + SEG;
          c.beginPath(); c.arc(0, 0, R * 0.87, a0, a1); c.arc(0, 0, R * 0.6, a1, a0, true); c.closePath();
          c.fillStyle = COL[colorOf(n)]; c.fill(); c.strokeStyle = COL.lo; c.lineWidth = Math.max(1, R * 0.006); c.stroke();
          c.save(); c.rotate(rot + i * SEG); c.fillStyle = COL.ivory; c.font = `600 ${Math.round(R * 0.068)}px Jost, system-ui, sans-serif`;
          c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(n), 0, -R * 0.795); c.restore();
        }
        g = c.createRadialGradient(-R * 0.1, -R * 0.12, R * 0.05, 0, 0, R * 0.6); g.addColorStop(0, COL.velvet2); g.addColorStop(1, COL.ink);
        c.beginPath(); c.arc(0, 0, R * 0.6, 0, 7); c.fillStyle = g; c.fill(); c.strokeStyle = COL.gold; c.lineWidth = R * 0.012; c.stroke();
        c.save(); c.rotate(rot);
        for (let k = 0; k < 4; k++) {
          c.rotate(Math.PI / 2);
          c.beginPath(); c.moveTo(-R * 0.025, 0); c.lineTo(R * 0.025, 0); c.lineTo(R * 0.01, -R * 0.36); c.lineTo(-R * 0.01, -R * 0.36); c.closePath(); c.fillStyle = COL.gold; c.fill();
          c.beginPath(); c.arc(0, -R * 0.37, R * 0.03, 0, 7); c.fillStyle = COL.hi; c.fill();
        }
        c.restore();
        c.beginPath(); c.arc(0, 0, R * 0.08, 0, 7); c.fillStyle = COL.gold; c.fill();
        const bx = Math.cos(ballA) * R * ballR, by = Math.sin(ballA) * R * ballR;
        c.beginPath(); c.arc(bx + R * 0.006, by + R * 0.01, R * 0.034, 0, 7); c.fillStyle = "rgba(0,0,0,.45)"; c.fill();
        g = c.createRadialGradient(bx - R * 0.01, by - R * 0.012, 1, bx, by, R * 0.034); g.addColorStop(0, "#fff"); g.addColorStop(1, "#c9c2b6");
        c.beginPath(); c.arc(bx, by, R * 0.032, 0, 7); c.fillStyle = g; c.fill();
        c.restore();
      }
      // The wheel stays put; the ball is launched around the rim, slows, bounces and drops into its pocket.
      const pocketAngle = n => rot + ORDER.indexOf(n) * SEG - Math.PI / 2;
      function animate(n) {
        const TAU = Math.PI * 2, a0 = ballA, target = pocketAngle(n);
        const sweep = TAU * 7 + ((((a0 - target) % TAU) + TAU) % TAU);
        const dur = GA.reduced ? 1000 : SPIN_MS, t0 = performance.now();
        let lastTick = 0;
        cancelAnimationFrame(anim);
        const frame = now => {
          const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 2.6);
          ballA = a0 - sweep * e;
          if (t < 0.08) ballR = 0.7 + 0.215 * (t / 0.08);
          else if (t < 0.6) ballR = 0.915;
          else { const k = (t - 0.6) / 0.4; ballR = 0.915 - 0.215 * Math.min(1, k * 1.3) + Math.abs(Math.sin(k * 22)) * 0.03 * (1 - k); }
          draw();
          if (now - lastTick > 60 + t * 300 && t < 0.97) { GA.sfx.tick(); lastTick = now; }
          if (t < 1) anim = requestAnimationFrame(frame);
          else { ballR = 0.7; ballA = target; draw(); GA.sfx.thud(); }
        };
        anim = requestAnimationFrame(frame);
      }
      addEventListener("resize", size);
      requestAnimationFrame(size);

      let P = null;
      function status() { if (P) q("[data-status]").innerHTML = `${GA.timerHTML(P.deadline)}<span>${GA.esc(P.msg || "")}</span>`; }

      return {
        shown() { size(); },
        render(snap) {
          P = snap.tables.roulette; if (!P) return;
          const me = GA.me.id, mine = P.bets[me] || {};
          if (P.spin && P.spin.id !== lastSpinId) {
            if (lastSpinId !== null && P.phase === "spinning") { animate(P.spin.n); dealer.say("spin"); }
            else if (P.spin) { ballA = pocketAngle(P.spin.n); ballR = 0.7; draw(); }
            lastSpinId = P.spin.id;
          }
          if (lastSpinId === null && !P.spin) lastSpinId = 0;
          for (const k in cellEls) {
            const c = cellEls[k], amt = mine[k] || 0;
            const others = Object.keys(P.bets).filter(pid => pid !== me && P.bets[pid][k]);
            let extra = amt ? `<span class="cb">${GA.short(amt)}</span>` : "";
            if (others.length) extra += `<span class="od">${others.slice(0, 4).map(pid => `<i style="--c:${(snap.players[pid] || {}).color || "#999"}"></i>`).join("")}</span>`;
            const label = c.dataset.label || (c.dataset.label = c.textContent);
            c.innerHTML = GA.esc(label) + extra;
            c.disabled = P.phase !== "betting";
            c.classList.toggle("hit", P.winning != null && (k === "n" + P.winning || (wins(k, P.winning) > 0 && k[0] !== "n")));
          }
          q("[data-hist]").innerHTML = `<span class="eyebrow" style="margin-right:6px">Last spins</span>` + (P.history.length ? P.history.map(n => `<span class="hball ${colorOf(n)}">${n}</span>`).join("") : `<span class="muted" style="font-size:13px">No spins yet</span>`);
          const total = Object.values(mine).reduce((a, b) => a + b, 0);
          const betting = P.phase === "betting";
          q("[data-controls]").innerHTML = betting ? (total
              ? `<span class="stack"><i></i>${GA.fmt(total)} on the table</span>
                 <button class="btn btn-ghost btn-sm" data-act="undo">Undo</button>
                 <button class="btn btn-ghost btn-sm" data-act="clear">Clear</button>
                 <button class="btn btn-ghost btn-sm" data-act="double">Double ×2</button>
                 <button class="btn btn-gold" data-act="spin">Spin now</button>`
              : (P.canRebet && P.canRebet[me]
                  ? `<button class="btn btn-ghost btn-sm" data-act="rebet">Rebet</button><button class="btn btn-ghost btn-sm" data-act="rebet" data-x="2">Rebet ×2</button>`
                  : `<span class="muted" style="font-size:13px">Tap the layout to place chips.</span>`))
            : `${total ? `<span class="stack"><i></i>${GA.fmt(total)} on the table</span>` : ""}${P.results && P.results[me] != null ? `<span class="badge ${P.results[me] > 0 ? "w" : P.results[me] < 0 ? "l" : "p"}">${P.results[me] >= 0 ? "+" : "−"}${GA.fmt(Math.abs(P.results[me]))}</span>` : ""}`;
          status();
        },
        tick: status,
        onEvt(e, snap) {
          const mine = e.pid === GA.me.id;
          if (e.kind === "bet" && mine && Math.random() < 0.3) dealer.say("bet");
          else if (e.kind === "win" && mine) {
            if (e.label === "Straight up!") { dealer.say("big"); GA.bigWin("Roulette Royale", "Straight up!", e.net); }
            else { dealer.say("win"); GA.sfx.win(); GA.celebrate(40); }
          } else if (e.kind === "lose" && mine) { dealer.say("lose"); GA.sfx.lose(); }
          else if (e.kind === "win" && !mine && Math.random() < 0.5) dealer.say("other", { n: snap.players[e.pid] ? snap.players[e.pid].name : "" });
          else if (e.kind === "broke" && mine) GA.toast("Not enough chips for that bet.");
          else if (e.kind === "limit" && mine) GA.toast("That would go over the 100,000 table limit.");
        }
      };
    }
  };
})();

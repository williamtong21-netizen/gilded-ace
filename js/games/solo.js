/* Solo games: slots, video poker and keno. They run in your browser and settle chips through the room host. */
(function () {
  "use strict";
  const GA = window.GA;
  const settle = (bet, back, big) => {
    const net = back - bet;
    GA.net.send({ t: "adj", d: back, net, big: big || undefined });
    GA.me.stats.hands++; GA.me.stats.wagered += bet; if (net > GA.me.stats.biggest) GA.me.stats.biggest = net; GA.saveMe();
  };

  /* ===================== SLOTS ===================== */
  const SYMS = [["7", 1, "7", 500], ["K", 2, "♛", 200], ["B", 3, "<span>BAR</span>", 100], ["D", 4, "♦", 50], ["H", 5, "♥", 25], ["S", 5, "★", 20], ["C", 6, "♣", 15]];
  const W = SYMS.reduce((a, s) => a + s[1], 0);
  const GL = Object.fromEntries(SYMS.map(s => [s[0], s[2]])), PAY = Object.fromEntries(SYMS.map(s => [s[0], s[3]]));
  const pickSym = () => { let r = GA.rand(W); for (const s of SYMS) { if ((r -= s[1]) < 0) return s[0]; } return "C"; };
  const LINES = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]];
  const LCOL = ["#f8e7ad", "#f06a8f", "#5fc7d6", "#7fe0a8", "#ff9f5a"];
  const symHTML = s => `<div class="sym" data-s="${s}">${GL[s]}</div>`;

  GA.views.slots = {
    title: "Slots", solo: true,
    mount(el) {
      el.innerHTML = `
        <div class="view-head"><div><div class="eyebrow">Slots · 5 paylines · Pays up to 500×</div><h1 class="gold-text">Gilded Reels</h1>
          <p>Pick a chip for each line. Every spin plays all five lines: three rows and two diagonals.</p></div><div class="who-here" data-who></div></div>
        <div class="slots">
          <div class="cabinet" data-cab>
            <div class="cab-top"><div class="t gold-text">♛ Gilded Reels ♛</div><div class="s">Five lines · Left to right</div></div>
            <div class="reels" data-reels>
              <div class="reel"><div class="strip"></div></div><div class="reel"><div class="strip"></div></div><div class="reel"><div class="strip"></div></div>
              <svg class="lines-svg" viewBox="0 0 300 300" preserveAspectRatio="none" data-lines></svg>
            </div>
            <div class="table-bar"><div data-rack></div><button class="btn btn-red btn-lg" data-spin>Spin</button></div>
            <div class="readout" data-out aria-live="polite">Five lines, one pull.</div>
          </div>
          <div class="paytable"><h3>Pay table</h3><p class="muted" style="margin:0 0 10px;font-size:14px">Three in a row on any line, left to right. Pays are per line bet.</p>
            <table class="pt"><tbody>${SYMS.map(s => `<tr data-k="${s[0]}"><td><span class="mini">${s[0] === "B" ? "<b style='font-size:9px'>BAR</b>" : s[2]}</span><span class="mini">${s[0] === "B" ? "<b style='font-size:9px'>BAR</b>" : s[2]}</span><span class="mini">${s[0] === "B" ? "<b style='font-size:9px'>BAR</b>" : s[2]}</span></td><td>${s[3]}×</td></tr>`).join("")}
            <tr data-k="77"><td><span class="mini">7</span><span class="mini">7</span> first two reels</td><td>10×</td></tr></tbody></table></div>
        </div>`;
      const q = s => el.querySelector(s);
      GA.rack(q("[data-rack]"), { denoms: [10, 25, 100, 500, 1000], label: "Per line" });
      const reels = GA.$$(".reel", el);
      let grid = [[pickSym(), pickSym(), pickSym()], [pickSym(), pickSym(), pickSym()], [pickSym(), pickSym(), pickSym()]], spinning = false;
      reels.forEach((r, i) => (r.querySelector(".strip").innerHTML = grid[i].map(symHTML).join("")));
      function spin() {
        if (spinning) return;
        const bet = GA.chip * 5;
        if (!GA.wallet.can(bet)) { GA.toast(`A spin at ${GA.short(GA.chip)} a line costs ${GA.fmt(bet)} chips.`); return; }
        GA.wallet.adjust(-bet);
        spinning = true; q("[data-spin]").disabled = true; q("[data-lines]").innerHTML = ""; q("[data-cab]").classList.remove("won");
        GA.$$(".pt tr", el).forEach(t => t.classList.remove("hit"));
        q("[data-out]").className = "readout"; q("[data-out]").textContent = "Spinning…";
        const res = [0, 1, 2].map(() => [pickSym(), pickSym(), pickSym()]);
        const H = reels[0].clientHeight / 3; let maxDur = 0;
        const ticker = setInterval(GA.sfx.tick, 75);
        reels.forEach((reel, i) => {
          const strip = reel.querySelector(".strip");
          const seq = [...res[i], ...Array.from({ length: 16 + i * 6 }, pickSym), ...grid[i]];
          strip.innerHTML = seq.map(symHTML).join("");
          strip.style.transition = "none"; strip.style.transform = `translateY(${-(seq.length - 3) * H}px)`; strip.offsetHeight;
          const dur = GA.reduced ? 0.3 + i * 0.15 : 1.2 + i * 0.45; maxDur = Math.max(maxDur, dur);
          strip.style.transition = `transform ${dur}s cubic-bezier(.15,.7,.25,1.04)`; strip.style.transform = "translateY(0px)";
          setTimeout(() => { GA.sfx.thud(); strip.style.transition = "none"; strip.innerHTML = res[i].map(symHTML).join(""); strip.style.transform = "none"; }, dur * 1000 + 30);
        });
        setTimeout(() => {
          clearInterval(ticker); grid = res; spinning = false; q("[data-spin]").disabled = false;
          let back = 0, best = 0, bestName = ""; const hits = [];
          LINES.forEach((L, li) => {
            const a = res[0][L[0]], b = res[1][L[1]], c = res[2][L[2]];
            let m = 0, k = "";
            if (a === b && b === c) { m = PAY[a]; k = a; } else if (a === "7" && b === "7") { m = 10; k = "77"; }
            if (m) { back += GA.chip * m; hits.push(li); GA.$$(`.pt tr[data-k="${k}"]`, el).forEach(t => t.classList.add("hit")); if (m > best) { best = m; bestName = k; } }
          });
          q("[data-lines]").innerHTML = hits.map(li => `<polyline style="color:${LCOL[li]}" stroke="${LCOL[li]}" points="${LINES[li].map((r, ci) => `${50 + ci * 100},${50 + r * 100}`).join(" ")}"/>`).join("");
          const out = q("[data-out]");
          if (back) {
            out.className = "readout good"; out.textContent = `${hits.length} winning line${hits.length > 1 ? "s" : ""}. Pays ${GA.fmt(back)}.`;
            q("[data-cab]").classList.add("won");
            const label = best >= 100 ? (bestName === "7" ? "Triple Sevens" : bestName === "K" ? "Crown Jewels" : "Open Bar") : "";
            settle(bet, back, label);
            if (best >= 100) GA.bigWin("Gilded Reels", label, back - bet); else { GA.sfx.win(); if (back > bet) GA.celebrate(50); }
          } else { out.className = "readout bad"; out.textContent = GA.pick(["Nothing on the lines. Pull again.", "So close. The reels are teasing you.", "Cold reels. Warm hands though."]); settle(bet, 0); GA.sfx.lose(); }
        }, maxDur * 1000 + 120);
      }
      q("[data-spin]").addEventListener("click", spin);
      el.addEventListener("keydown", e => { if (e.key === " " && e.target === document.body) { e.preventDefault(); spin(); } });
      return { render() {} };
    }
  };

  /* ===================== VIDEO POKER ===================== */
  const VP = [["Royal flush", 250, 800], ["Straight flush", 50], ["Four of a kind", 25], ["Full house", 9], ["Flush", 6], ["Straight", 4], ["Three of a kind", 3], ["Two pair", 2], ["Jacks or better", 1]];
  const rv = r => (r === "A" ? 14 : r === "K" ? 13 : r === "Q" ? 12 : r === "J" ? 11 : +r);
  function vpEval(cs) {
    const v = cs.map(c => rv(c.r)).sort((a, b) => a - b), counts = {};
    v.forEach(x => (counts[x] = (counts[x] || 0) + 1));
    const groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const flush = cs.every(c => c.s === cs[0].s);
    const uniq = groups.length === 5;
    const straight = uniq && (v[4] - v[0] === 4 || v.join() === "2,3,4,5,14");
    if (straight && flush) return v[0] === 10 ? 0 : 1;
    if (groups[0][1] === 4) return 2;
    if (groups[0][1] === 3 && groups[1][1] === 2) return 3;
    if (flush) return 4;
    if (straight) return 5;
    if (groups[0][1] === 3) return 6;
    if (groups[0][1] === 2 && groups[1][1] === 2) return 7;
    if (groups[0][1] === 2 && +groups[0][0] >= 11) return 8;
    return -1;
  }
  GA.rules = GA.rules || {}; GA.rules.vpEval = vpEval;
  GA.views.videopoker = {
    title: "Video Poker", solo: true,
    mount(el) {
      el.innerHTML = `
        <div class="view-head"><div><div class="eyebrow">Video poker · 9/6 Jacks or Better</div><h1 class="gold-text">Jacks or Better</h1>
          <p>Deal five cards, tap the ones you want to keep, then draw. Bet five coins to unlock the 4,000-coin royal flush.</p></div><div class="who-here" data-who></div></div>
        <div class="vp"><div class="vp-screen">
          <table class="paytbl" data-pay></table>
          <div class="vp-msg" data-msg aria-live="polite">Press Deal</div>
          <div class="vp-hand" data-hand></div>
        </div>
        <div class="table-bar"><div data-rack></div><div class="controls">
          <span class="muted" style="font-size:13px">Coins</span>${[1, 2, 3, 4, 5].map(n => `<button class="btn btn-dark btn-sm" data-coins="${n}" aria-pressed="false">${n}</button>`).join("")}
          <button class="btn btn-gold btn-lg" data-deal>Deal</button></div></div></div>`;
      const q = s => el.querySelector(s);
      GA.rack(q("[data-rack]"), { denoms: [10, 25, 100, 500, 1000], label: "Coin" });
      let coins = GA.store.get("vpCoins", 5), hand = [], held = [false, false, false, false, false], deck = [], stage = "idle", bet = 0;
      const tr = GA.cardTracker(); let round = 0;
      function pay(hit) {
        q("[data-pay]").innerHTML = VP.map((r, i) => `<tr class="${hit === i ? "hit" : ""}"><td>${r[0]}</td>${[1, 2, 3, 4, 5].map(c => `<td class="${c === coins ? "col" : ""}">${i === 0 && c === 5 ? 4000 : r[1] * c}</td>`).join("")}</tr>`).join("");
        GA.$$("[data-coins]", el).forEach(b => { b.setAttribute("aria-pressed", String(+b.dataset.coins === coins)); b.className = "btn btn-sm " + (+b.dataset.coins === coins ? "btn-gold" : "btn-dark"); b.disabled = stage === "dealt"; });
      }
      function draw() {
        q("[data-hand]").innerHTML = (hand.length ? hand : Array(5).fill({ back: true })).map((c, i) => `<button type="button" data-i="${i}" ${stage !== "dealt" ? "disabled" : ""} aria-pressed="${held[i]}"><span class="held-tag">${held[i] ? "HELD" : ""}</span>${tr.html(`r${round}c${i}`, c, held[i] ? "held" : "")}</button>`).join("");
      }
      q("[data-hand]").addEventListener("click", e => {
        const b = e.target.closest("[data-i]"); if (!b || stage !== "dealt") return;
        const i = +b.dataset.i; held[i] = !held[i]; GA.sfx.pop(); draw();
      });
      GA.$$("[data-coins]", el).forEach(b => b.addEventListener("click", () => { coins = +b.dataset.coins; GA.store.set("vpCoins", coins); pay(); GA.sfx.chip(); }));
      q("[data-deal]").addEventListener("click", () => {
        if (stage !== "dealt") {
          bet = GA.chip * coins;
          if (!GA.wallet.can(bet)) { GA.toast(`That hand costs ${GA.fmt(bet)} chips.`); return; }
          GA.wallet.adjust(-bet);
          deck = GA.makeShoe(1); round++; hand = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()]; held = [false, false, false, false, false];
          stage = "dealt"; q("[data-deal]").textContent = "Draw"; GA.sfx.card();
          const r = vpEval(hand); q("[data-msg]").textContent = r >= 0 ? VP[r][0] + " dealt. Hold it?" : "Tap cards to hold, then draw.";
          pay(r >= 0 ? r : undefined); draw();
        } else {
          round++;
          hand = hand.map((c, i) => (held[i] ? c : deck.pop()));
          const keepKeys = hand.map((c, i) => held[i]);
          // carry held cards without re-animating them
          keepKeys.forEach((k, i) => { if (k) tr.html(`r${round}c${i}`, hand[i]); });
          stage = "idle"; q("[data-deal]").textContent = "Deal"; GA.sfx.card();
          const r = vpEval(hand);
          const winAmt = r < 0 ? 0 : r === 0 && coins === 5 ? 4000 * GA.chip : VP[r][1] * GA.chip * coins;
          held = [false, false, false, false, false];
          pay(r >= 0 ? r : undefined); draw();
          if (r >= 0) {
            q("[data-msg]").textContent = `${VP[r][0]}! Pays ${GA.fmt(winAmt)}.`;
            settle(bet, winAmt, r <= 2 ? VP[r][0] : "");
            if (r <= 2) GA.bigWin("Jacks or Better", VP[r][0], winAmt - bet); else { GA.sfx.win(); if (winAmt > bet) GA.celebrate(40); }
          } else { q("[data-msg]").textContent = "No win. Deal again."; settle(bet, 0); GA.sfx.lose(); }
        }
      });
      pay(); draw();
      return { render() {} };
    }
  };

  /* ===================== KENO ===================== */
  const KPAY = {
    1: { 1: 3 }, 2: { 2: 12 }, 3: { 2: 1, 3: 42 }, 4: { 2: 1, 3: 4, 4: 100 }, 5: { 3: 2, 4: 20, 5: 450 },
    6: { 3: 1, 4: 6, 5: 90, 6: 1500 }, 7: { 3: 1, 4: 3, 5: 20, 6: 180, 7: 5000 }, 8: { 4: 2, 5: 12, 6: 90, 7: 1000, 8: 15000 },
    9: { 4: 1, 5: 5, 6: 40, 7: 300, 8: 4000, 9: 25000 }, 10: { 0: 2, 5: 2, 6: 20, 7: 120, 8: 1000, 9: 5000, 10: 50000 }
  };
  GA.views.keno = {
    title: "Keno", solo: true,
    mount(el) {
      el.innerHTML = `
        <div class="view-head"><div><div class="eyebrow">Keno · Pick up to 10 · 20 balls drawn</div><h1 class="gold-text">Lucky Keno</h1>
          <p>Choose 1 to 10 numbers, set your bet and draw. The more of your numbers come up, the bigger the payout.</p></div><div class="who-here" data-who></div></div>
        <div class="keno">
          <div style="min-width:0;display:grid;gap:12px"><div class="kboard" data-board>${Array.from({ length: 80 }, (_, i) => `<button type="button" class="kn" data-n="${i + 1}">${i + 1}</button>`).join("")}</div>
            <div class="table-bar"><div data-rack></div><div class="controls"><button class="btn btn-ghost btn-sm" data-qp>Quick pick</button><button class="btn btn-dark btn-sm" data-clr>Clear</button><button class="btn btn-gold btn-lg" data-draw>Draw</button></div></div>
            <div class="readout" data-out aria-live="polite">Pick your numbers.</div></div>
          <div class="paytable"><h3>Payouts</h3><p class="muted" style="margin:0 0 10px;font-size:14px" data-spots>Pick some numbers to see what they pay.</p><table class="pt"><tbody data-kp></tbody></table></div>
        </div>`;
      const q = s => el.querySelector(s);
      GA.rack(q("[data-rack]"), { denoms: [10, 25, 100, 500, 1000] });
      let picks = new Set(GA.store.get("kenoPicks", [7, 14, 21, 33, 42])), drawing = false, drawn = new Set();
      const btns = GA.$$(".kn", el);
      function paint(hit) {
        btns.forEach(b => { const n = +b.dataset.n; b.classList.toggle("pick", picks.has(n)); b.classList.toggle("drawn", drawn.has(n)); b.disabled = drawing; });
        const k = picks.size, t = KPAY[k];
        q("[data-spots]").textContent = k ? `${k} spot${k > 1 ? "s" : ""} picked. Pays per chip bet:` : "Pick some numbers to see what they pay.";
        q("[data-kp]").innerHTML = t ? Object.entries(t).sort((a, b) => b[0] - a[0]).map(([h, m]) => `<tr class="${hit === +h ? "hit" : ""}"><td>Catch ${h}</td><td>${GA.fmt(m)}×</td></tr>`).join("") : "";
      }
      el.addEventListener("click", e => {
        const b = e.target.closest(".kn"); if (!b || drawing) return;
        const n = +b.dataset.n;
        if (drawn.size) drawn = new Set();
        if (picks.has(n)) picks.delete(n); else if (picks.size < 10) picks.add(n); else { GA.toast("Ten numbers max."); return; }
        GA.store.set("kenoPicks", [...picks]); GA.sfx.pop(); paint();
      });
      q("[data-qp]").addEventListener("click", () => { if (drawing) return; drawn = new Set(); const n = picks.size || 8; picks = new Set(); while (picks.size < n) picks.add(1 + GA.rand(80)); GA.store.set("kenoPicks", [...picks]); GA.sfx.chip(); paint(); });
      q("[data-clr]").addEventListener("click", () => { if (drawing) return; picks = new Set(); drawn = new Set(); paint(); });
      q("[data-draw]").addEventListener("click", () => {
        if (drawing) return;
        if (!picks.size) { GA.toast("Pick at least one number."); return; }
        const bet = GA.chip;
        if (!GA.wallet.can(bet)) { GA.toast("Not enough chips."); return; }
        GA.wallet.adjust(-bet);
        drawing = true; drawn = new Set(); paint();
        const pool = GA.shuffle(Array.from({ length: 80 }, (_, i) => i + 1)).slice(0, 20);
        let i = 0;
        const iv = setInterval(() => {
          const n = pool[i++]; drawn.add(n); paint();
          if (picks.has(n)) GA.sfx.ding(); else GA.sfx.tick();
          q("[data-out]").textContent = `Ball ${i} of 20: ${n}`;
          if (i >= 20) {
            clearInterval(iv); drawing = false;
            const hits = [...picks].filter(x => drawn.has(x)).length, m = (KPAY[picks.size] || {})[hits] || 0, back = bet * m;
            paint(hits);
            const out = q("[data-out]");
            if (back) {
              out.className = "readout good"; out.textContent = `Caught ${hits} of ${picks.size}. Pays ${GA.fmt(back)}.`;
              settle(bet, back, m >= 100 ? `Caught ${hits} of ${picks.size}` : "");
              if (m >= 100) GA.bigWin("Lucky Keno", `Caught ${hits}!`, back - bet); else { GA.sfx.win(); if (back > bet) GA.celebrate(40); }
            } else { out.className = "readout bad"; out.textContent = `Caught ${hits} of ${picks.size}. Try again.`; settle(bet, 0); }
          }
        }, GA.reduced ? 40 : 140);
      });
      paint();
      return { render() {} };
    }
  };
})();

/* Craps: one shared pair of dice. The shooter rotates around the players at the table after each seven-out. */
(function () {
  "use strict";
  const GA = window.GA;
  const BETS = {
    pass: { nm: "Pass Line", od: "1:1", when: "comeout" },
    dont: { nm: "Don't Pass", od: "1:1 · bar 12", when: "comeout" },
    odds: { nm: "Pass Odds", od: "True odds · up to 3×", when: "point" },
    field: { nm: "Field", od: "2, 3, 4, 9, 10, 11, 12 · 2 & 12 pay 2:1", when: "any" },
    place6: { nm: "Place 6", od: "7:6", when: "any" },
    place8: { nm: "Place 8", od: "7:6", when: "any" },
    hard4: { nm: "Hard 4", od: "7:1", when: "any" },
    hard6: { nm: "Hard 6", od: "9:1", when: "any" },
    hard8: { nm: "Hard 8", od: "9:1", when: "any" },
    hard10: { nm: "Hard 10", od: "7:1", when: "any" },
    any7: { nm: "Any Seven", od: "4:1", when: "any" },
    craps: { nm: "Any Craps", od: "2, 3, 12 · 7:1", when: "any" },
    yo: { nm: "Yo 11", od: "15:1", when: "any" }
  };
  const ODDS = { 4: 2, 10: 2, 5: 1.5, 9: 1.5, 6: 1.2, 8: 1.2 };

  function shooterFor(T, ctx) {
    const P = T.pub, here = Object.keys(ctx.players).filter(pid => ctx.players[pid].at === "craps");
    if (P.shooter && here.includes(P.shooter)) return P.shooter;
    const withBets = here.filter(pid => P.bets[pid] && Object.keys(P.bets[pid]).length);
    P.shooter = withBets[0] || here[0] || null;
    return P.shooter;
  }
  function rotate(T, ctx) {
    const P = T.pub, here = Object.keys(ctx.players).filter(pid => ctx.players[pid].at === "craps");
    if (!here.length) { P.shooter = null; return; }
    const i = here.indexOf(P.shooter);
    P.shooter = here[(i + 1) % here.length];
  }

  function resolve(T, ctx) {
    const P = T.pub, [d1, d2] = P.dice, t = d1 + d2, hard = d1 === d2, pt = P.point;
    const nets = {};
    for (const pid in P.bets) {
      const b = P.bets[pid]; let net = 0, back = 0; const label = [];
      const take = k => { net -= b[k]; delete b[k]; };
      const win = (k, profit, keep) => { back += profit + (keep ? 0 : b[k]); net += profit; if (!keep) delete b[k]; };
      // one-roll bets
      if (b.field) { if (t === 2 || t === 12) win("field", b.field * 2); else if ([3, 4, 9, 10, 11].includes(t)) win("field", b.field); else take("field"); }
      if (b.any7) { if (t === 7) { win("any7", b.any7 * 4); label.push("Any Seven"); } else take("any7"); }
      if (b.craps) { if ([2, 3, 12].includes(t)) { win("craps", b.craps * 7); label.push("Any Craps"); } else take("craps"); }
      if (b.yo) { if (t === 11) { win("yo", b.yo * 15); label.push("Yo-leven!"); } else take("yo"); }
      if (pt == null) {
        if (b.pass) { if (t === 7 || t === 11) win("pass", b.pass); else if ([2, 3, 12].includes(t)) take("pass"); }
        if (b.dont) { if (t === 2 || t === 3) win("dont", b.dont); else if (t === 7 || t === 11) take("dont"); }
      } else {
        // place and hardways work while a point is on
        for (const n of [6, 8]) { const k = "place" + n; if (b[k]) { if (t === n) win(k, Math.floor(b[k] * 7 / 6), true); else if (t === 7) take(k); } }
        for (const n of [4, 6, 8, 10]) {
          const k = "hard" + n; if (!b[k]) continue;
          if (t === n && hard) { win(k, b[k] * (n === 6 || n === 8 ? 9 : 7), true); label.push("Hard " + n + "!"); }
          else if (t === n || t === 7) take(k);
        }
        if (t === pt) {
          if (b.pass) win("pass", b.pass);
          if (b.odds) win("odds", Math.floor(b.odds * ODDS[pt]));
          if (b.dont) take("dont");
        } else if (t === 7) {
          if (b.pass) take("pass");
          if (b.odds) take("odds");
          if (b.dont) win("dont", b.dont);
        }
      }
      ctx.pay(pid, back);
      if (net !== 0) { nets[pid] = net; ctx.result(pid, net, label.join(" · ")); }
      if (!Object.keys(b).length) delete P.bets[pid];
    }
    let msg;
    if (pt == null) {
      if (t === 7 || t === 11) msg = `${t}! Front line winner.`;
      else if ([2, 3, 12].includes(t)) msg = `${t}, craps. Line away.`;
      else { P.point = t; msg = `Point is ${t}. Mark it.`; }
    } else if (t === pt) { msg = `${t}! The point is made. Pay the line.`; P.point = null; }
    else if (t === 7) { msg = "Seven out. Line away."; P.point = null; rotate(T, ctx); ctx.evt("sevenout", {}); }
    else msg = `${t}${hard && [4, 6, 8, 10].includes(t) ? " the hard way" : ""}. Point is still ${pt}.`;
    P.lastRoll = { d: [d1, d2], t, nets };
    P.history.unshift(t); P.history = P.history.slice(0, 16);
    P.msg = msg; P.phase = "ready";
    shooterFor(T, ctx);
  }

  GA.engines.craps = {
    create(T) { T.pub = { phase: "ready", point: null, dice: [3, 4], rollId: 0, shooter: null, bets: {}, history: [], msg: "Coming out! Place a line bet.", lastRoll: null }; T.priv = {}; },
    handle(T, pid, a, ctx) {
      const P = T.pub;
      shooterFor(T, ctx);
      if (a.k === "bet") {
        const B = BETS[a.spot]; if (!B || P.phase !== "ready") return;
        if (B.when === "comeout" && P.point != null) { ctx.evt("nobet", { pid, why: "Line bets go down on the come-out roll." }); return; }
        if (B.when === "point" && P.point == null) { ctx.evt("nobet", { pid, why: "Odds go behind the pass line once a point is set." }); return; }
        const mine = P.bets[pid] || {};
        let amt = Math.round(+a.amt || 0); if (amt <= 0) return;
        if (a.spot === "odds") {
          if (!mine.pass) { ctx.evt("nobet", { pid, why: "You need a Pass Line bet to take odds." }); return; }
          amt = Math.min(amt, mine.pass * 3 - (mine.odds || 0));
          if (amt <= 0) { ctx.evt("nobet", { pid, why: "Odds are capped at 3× your pass bet." }); return; }
        }
        if ((mine[a.spot] || 0) + amt > 50000) return;
        if (!ctx.charge(pid, amt)) { ctx.evt("broke", { pid }); return; }
        mine[a.spot] = (mine[a.spot] || 0) + amt; P.bets[pid] = mine;
        if (!P.shooter) P.shooter = pid;
        ctx.evt("bet", { pid });
      } else if (a.k === "take") {
        // pull back bets that are allowed to come down
        if (P.phase !== "ready" || !P.bets[pid]) return;
        const b = P.bets[pid];
        for (const k of Object.keys(b)) { if ((k === "pass" || k === "odds") && P.point != null) continue; ctx.refund(pid, b[k]); delete b[k]; }
        if (!Object.keys(b).length) delete P.bets[pid];
      } else if (a.k === "roll") {
        if (P.phase !== "ready") return;
        const shooter = shooterFor(T, ctx);
        if (shooter && shooter !== pid) { ctx.evt("notshooter", { pid }); return; }
        if (!P.bets[pid] || !Object.keys(P.bets[pid]).length) { ctx.evt("nobet", { pid, why: "Put a bet down before you roll." }); return; }
        P.shooter = pid;
        P.phase = "rolling"; P.rollId++;
        P.dice = [1 + GA.rand(6), 1 + GA.rand(6)];
        P.msg = `${ctx.name(pid)} rolls…`;
        ctx.evt("roll", { pid });
        ctx.after(GA.reduced ? 300 : 1300, () => resolve(T, ctx));
      }
    },
    leave(T, pid, ctx) {
      const P = T.pub;
      if (P.bets[pid] && P.phase === "ready") {
        const b = P.bets[pid];
        for (const k of Object.keys(b)) { if ((k === "pass" || k === "odds") && P.point != null) continue; ctx.refund(pid, b[k]); }
        delete P.bets[pid];
      }
      if (P.shooter === pid) { P.shooter = null; }
    }
  };

  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const dieHTML = n => `<div class="die" aria-label="${n}">${Array.from({ length: 9 }, (_, i) => `<i style="visibility:${PIPS[n].includes(i) ? "visible" : "hidden"}"></i>`).join("")}</div>`;

  GA.views.craps = {
    title: "Craps",
    mount(el) {
      el.innerHTML = `
        <div class="view-head">
          <div><div class="eyebrow">Craps · Shared dice · Shooter rotates</div><h1 class="gold-text">The Hot Table</h1>
          <p>Bet the line on the come-out roll, then ride the point. When there's a crowd, the dice pass to the next player after a seven-out.</p></div>
          <div class="who-here" data-who></div>
        </div>
        <div class="felt">
          <div data-dealer></div>
          <div class="craps-top">
            <div style="display:flex;gap:18px;align-items:center"><div class="dice" data-dice>${dieHTML(3)}${dieHTML(4)}</div><div class="puck off" data-puck>OFF</div></div>
            <div style="min-width:0"><div class="points" data-points>${[4, 5, 6, 8, 9, 10].map(n => `<span data-pt="${n}">${n}</span>`).join("")}</div><div class="history" data-hist></div></div>
          </div>
          <div class="craps-board" data-board>
            ${["pass", "dont", "odds"].map(k => `<button class="spot wide2" data-spot="${k}"><span class="nm">${BETS[k].nm}</span><span class="od">${BETS[k].od}</span><span class="mine"></span><span class="dots"></span></button>`).join("")}
            <button class="spot wide6" data-spot="field"><span class="nm">Field</span><span class="od">${BETS.field.od}</span><span class="mine"></span><span class="dots"></span></button>
            ${["place6", "place8", "any7", "craps", "yo", "hard4", "hard6", "hard8", "hard10"].map(k => `<button class="spot ${k === "yo" || k === "any7" || k === "craps" ? "" : ""}" data-spot="${k}"><span class="nm">${BETS[k].nm}</span><span class="od">${BETS[k].od}</span><span class="mine"></span><span class="dots"></span></button>`).join("")}
          </div>
        </div>
        <div class="table-bar"><div class="status" data-status></div><div class="controls" data-controls></div></div>
        <div style="margin-top:14px" data-rack></div>
        <p class="rules" style="margin-top:14px">Pass Line wins on 7 or 11 on the come-out and loses on 2, 3 or 12. Any other number becomes the point: roll it again before a 7 to win. Place bets and hardways only work while a point is on, and stay up after they hit.</p>`;
      const q = s => el.querySelector(s);
      const dealer = GA.dealer(q("[data-dealer]"), "monty");
      GA.rack(q("[data-rack]"));
      let P = null, lastRoll = null;
      el.addEventListener("click", e => {
        const s = e.target.closest("[data-spot]");
        if (s) { GA.net.act("craps", { k: "bet", spot: s.dataset.spot, amt: GA.chip }); GA.sfx.chip(); return; }
        const b = e.target.closest("[data-act]"); if (b && !b.disabled) GA.net.act("craps", { k: b.dataset.act });
      });
      function status() { if (P) q("[data-status]").innerHTML = `<span>${GA.esc(P.msg || "")}</span>`; }
      return {
        render(snap) {
          P = snap.tables.craps; if (!P) return;
          const me = GA.me.id, mine = P.bets[me] || {};
          if (lastRoll !== null && P.rollId !== lastRoll && P.phase === "rolling") {
            GA.sfx.dice();
            const dice = q("[data-dice]");
            dice.innerHTML = dieHTML(1 + GA.rand(6)) + dieHTML(1 + GA.rand(6));
            GA.$$(".die", dice).forEach(d => d.classList.add("rolling"));
            let n = 0; const iv = setInterval(() => { if (++n > 8) { clearInterval(iv); return; } dice.innerHTML = dieHTML(1 + GA.rand(6)) + dieHTML(1 + GA.rand(6)); GA.$$(".die", dice).forEach(d => d.classList.add("rolling")); }, 130);
            setTimeout(() => clearInterval(iv), 1200);
          } else if (P.phase === "ready") q("[data-dice]").innerHTML = dieHTML(P.dice[0]) + dieHTML(P.dice[1]);
          lastRoll = P.rollId;
          const puck = q("[data-puck]"); puck.className = "puck " + (P.point ? "on" : "off"); puck.textContent = P.point ? "ON" : "OFF";
          GA.$$("[data-pt]", el).forEach(s => s.classList.toggle("on", +s.dataset.pt === P.point));
          q("[data-hist]").innerHTML = `<span class="eyebrow" style="margin-right:6px">Rolls</span>` + (P.history.length ? P.history.map(t => `<span class="hball ${t === 7 ? "r" : "b"}">${t}</span>`).join("") : `<span class="muted" style="font-size:13px">No rolls yet</span>`);
          GA.$$("[data-spot]", el).forEach(b => {
            const k = b.dataset.spot, B = BETS[k];
            b.querySelector(".mine").innerHTML = GA.stack(mine[k] || 0);
            b.querySelector(".dots").innerHTML = Object.keys(P.bets).filter(pid => pid !== me && P.bets[pid][k]).map(pid => `<i style="--c:${(snap.players[pid] || {}).color}"></i>`).join("");
            b.disabled = P.phase !== "ready" || (B.when === "comeout" && P.point != null) || (B.when === "point" && (P.point == null || !mine.pass));
          });
          const sh = P.shooter, shName = sh && snap.players[sh] ? snap.players[sh].name : null;
          const myRoll = !sh || sh === me;
          const any = Object.keys(mine).length;
          q("[data-controls]").innerHTML = `${shName ? `<span class="ptag" style="--c:${snap.players[sh].color}"><i></i>Shooter: ${GA.esc(shName)}${sh === me ? " (you)" : ""}</span>` : ""}
            ${any ? `<button class="btn btn-ghost btn-sm" data-act="take" ${P.phase !== "ready" ? "disabled" : ""}>Take down bets</button>` : ""}
            ${myRoll ? `<button class="btn btn-red btn-lg" data-act="roll" ${P.phase !== "ready" || !any ? "disabled" : ""}>Roll the dice</button>` : `<span class="muted" style="font-size:14px">Waiting for ${GA.esc(shName)} to roll</span>`}`;
          status();
        },
        tick: status,
        onEvt(e, snap) {
          const mine = e.pid === GA.me.id;
          if (e.kind === "roll") { if (mine || Math.random() < 0.5) dealer.say("roll", { n: snap.players[e.pid] ? snap.players[e.pid].name : "" }); }
          else if (e.kind === "bet" && mine && Math.random() < 0.3) dealer.say("bet");
          else if (e.kind === "win" && mine) { if (e.label && /Hard|Yo|Craps|Seven/.test(e.label) && e.net >= 400) { dealer.say("big"); GA.bigWin("The Hot Table", e.label, e.net); } else { dealer.say("win"); GA.sfx.win(); GA.celebrate(40); } }
          else if (e.kind === "lose" && mine) { dealer.say("lose"); GA.sfx.lose(); }
          else if (e.kind === "nobet" && mine) GA.toast(e.why);
          else if (e.kind === "notshooter" && mine) GA.toast("Hold up. It's someone else's turn with the dice.");
          else if (e.kind === "broke" && mine) GA.toast("Not enough chips for that bet.");
          else if (e.kind === "win" && !mine && Math.random() < 0.4) dealer.say("other", { n: snap.players[e.pid] ? snap.players[e.pid].name : "" });
        }
      };
    }
  };
})();

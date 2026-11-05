/* Three Card Poker: every player plays their own hand against Jade's. */
(function () {
  "use strict";
  const GA = window.GA;
  const PP = { 5: [40, "Straight flush"], 4: [30, "Three of a kind"], 3: [6, "Straight"], 2: [3, "Flush"], 1: [1, "Pair"] };
  const ANTE = { 5: [5, "Straight flush"], 4: [4, "Three of a kind"], 3: [1, "Straight"] };
  const NAMES = ["High card", "Pair", "Flush", "Straight", "Three of a kind", "Straight flush"];
  const rv = r => (r === "A" ? 14 : r === "K" ? 13 : r === "Q" ? 12 : r === "J" ? 11 : +r);

  function evalHand(cs) {
    let v = cs.map(c => rv(c.r)).sort((a, b) => b - a);
    const flush = cs.every(c => c.s === cs[0].s);
    let straight = v[0] - 1 === v[1] && v[1] - 1 === v[2];
    if (!straight && v[0] === 14 && v[1] === 3 && v[2] === 2) { straight = true; v = [3, 2, 1]; }
    const trips = v[0] === v[2], pair = !trips && (v[0] === v[1] || v[1] === v[2]);
    let cat = 0;
    if (straight && flush) cat = 5; else if (trips) cat = 4; else if (straight) cat = 3; else if (flush) cat = 2; else if (pair) cat = 1;
    if (pair) { const p = v[0] === v[1] ? v[0] : v[1], k = v[0] === v[1] ? v[2] : v[0]; v = [p, p, k]; }
    return { cat, v, name: NAMES[cat] };
  }
  const cmp = (a, b) => { if (a.cat !== b.cat) return a.cat - b.cat; for (let i = 0; i < 3; i++) if (a.v[i] !== b.v[i]) return a.v[i] - b.v[i]; return 0; };
  const qualifies = h => h.cat > 0 || h.v[0] >= 12;

  function draw(T) { if (T.priv.shoe.length < 10) T.priv.shoe = GA.makeShoe(1); return T.priv.shoe.pop(); }

  function deal(T, ctx) {
    const P = T.pub;
    if (P.phase !== "betting") return;
    const ids = Object.keys(P.players).filter(pid => P.players[pid].ante > 0);
    if (!ids.length) return;
    ctx.cancel(); P.deadline = 0;
    T.priv.shoe = GA.makeShoe(1);
    P.round++; P.phase = "dealing"; P.dealer = { cards: [], hidden: true };
    ids.forEach(pid => Object.assign(P.players[pid], { hand: [], decision: null, res: null, inRound: true }));
    Object.keys(P.players).forEach(pid => { if (!ids.includes(pid)) { const p = P.players[pid]; ctx.refund(pid, (p.ante || 0) + (p.pp || 0)); delete P.players[pid]; } });
    T.priv.dealer = [];
    const steps = [];
    for (let i = 0; i < 3; i++) {
      ids.forEach(pid => steps.push(() => P.players[pid] && P.players[pid].hand.push(draw(T))));
      steps.push(() => { T.priv.dealer.push(draw(T)); P.dealer.cards.push({ back: true }); });
    }
    ctx.evt("deal", {});
    const next = () => {
      const st = steps.shift();
      if (!st) {
        P.phase = "deciding"; P.deadline = Date.now() + 20000; P.msg = "Play or fold?";
        ctx.after(20000, () => reveal(T, ctx));
        return;
      }
      st(); ctx.after(GA.reduced ? 100 : 260, next, "deal");
    };
    ctx.after(200, next, "deal");
  }

  function reveal(T, ctx) {
    const P = T.pub;
    if (P.phase !== "deciding") return;
    ctx.cancel(); P.deadline = 0;
    for (const pid in P.players) { const p = P.players[pid]; if (p.inRound && !p.decision) p.decision = "fold"; }
    P.dealer.cards = T.priv.dealer.slice(); P.dealer.hidden = false;
    const dh = evalHand(P.dealer.cards), dq = qualifies(dh);
    P.dealer.name = dh.name + (dq ? "" : ", doesn't qualify");
    for (const pid in P.players) {
      const p = P.players[pid]; if (!p.inRound) continue;
      const h = evalHand(p.hand); let back = 0, staked = p.ante + p.pp + (p.play || 0); const notes = [];
      if (p.pp) { const r = PP[h.cat]; if (r) { back += p.pp * (r[0] + 1); notes.push(`Pair Plus ${r[0]}:1`); } }
      if (p.decision === "play") {
        const ab = ANTE[h.cat]; if (ab) { back += p.ante * ab[0]; notes.push(`Ante bonus ${ab[0]}:1`); }
        if (!dq) { back += p.ante * 2 + p.play; notes.push("Dealer doesn't qualify"); }
        else { const c = cmp(h, dh); if (c > 0) back += (p.ante + p.play) * 2; else if (c === 0) back += p.ante + p.play; }
      }
      const net = back - staked;
      ctx.pay(pid, back);
      p.res = { net, name: h.name, notes };
      ctx.result(pid, net, h.cat >= 4 ? h.name : "");
      T.priv.last[pid] = { ante: p.ante, pp: p.pp };
    }
    P.phase = "payout"; P.msg = `Jade shows ${P.dealer.name}.`;
    ctx.after(5000, () => {
      P.phase = "betting"; P.msg = "Ante up.";
      for (const pid in P.players) { const p = P.players[pid]; p.inRound = false; p.ante = 0; p.pp = 0; p.play = 0; }
    });
  }

  GA.rules = GA.rules || {}; GA.rules.p3Eval = evalHand;
  GA.engines.poker3 = {
    create(T) { T.pub = { phase: "betting", players: {}, dealer: { cards: [], hidden: true }, deadline: 0, msg: "Ante up.", round: 0 }; T.priv = { shoe: [], dealer: [], last: {} }; },
    handle(T, pid, a, ctx) {
      const P = T.pub;
      if (a.k === "bet") {
        if (P.phase !== "betting" || !["ante", "pp"].includes(a.spot)) return;
        const amt = Math.round(+a.amt || 0); if (amt <= 0) return;
        const p = P.players[pid] || (P.players[pid] = { ante: 0, pp: 0, play: 0, hand: [], decision: null, res: null, inRound: false });
        if (p.res) Object.assign(p, { hand: [], decision: null, res: null });
        if (p[a.spot] + amt > 25000) return;
        if (!ctx.charge(pid, amt)) { ctx.evt("broke", { pid }); return; }
        p[a.spot] += amt;
        if (p.ante && !P.deadline) { P.deadline = Date.now() + 15000; ctx.after(15000, () => deal(T, ctx)); }
        ctx.evt("bet", { pid });
      } else if (a.k === "clear") {
        const p = P.players[pid]; if (P.phase !== "betting" || !p) return;
        ctx.refund(pid, p.ante + p.pp); p.ante = p.pp = 0;
      } else if (a.k === "rebet") {
        const L = T.priv.last[pid]; if (P.phase !== "betting" || !L) return;
        const p = P.players[pid] || (P.players[pid] = { ante: 0, pp: 0, play: 0, hand: [] });
        if (p.ante) return;
        if (!ctx.charge(pid, L.ante + L.pp)) { ctx.evt("broke", { pid }); return; }
        Object.assign(p, { ante: L.ante, pp: L.pp, hand: [], decision: null, res: null });
        if (!P.deadline) { P.deadline = Date.now() + 15000; ctx.after(15000, () => deal(T, ctx)); }
      } else if (a.k === "deal") {
        if (P.players[pid] && P.players[pid].ante) deal(T, ctx);
      } else if (a.k === "play" || a.k === "fold") {
        const p = P.players[pid]; if (P.phase !== "deciding" || !p || !p.inRound || p.decision) return;
        if (a.k === "play") { if (!ctx.charge(pid, p.ante)) { ctx.evt("broke", { pid }); return; } p.play = p.ante; }
        p.decision = a.k;
        if (Object.values(P.players).every(x => !x.inRound || x.decision)) ctx.after(500, () => reveal(T, ctx));
      }
    },
    leave(T, pid, ctx) {
      const P = T.pub, p = P.players[pid]; if (!p) return;
      if (P.phase === "betting") { ctx.refund(pid, p.ante + p.pp); delete P.players[pid]; }
      else if (P.phase === "deciding" && !p.decision) { p.decision = "fold"; if (Object.values(P.players).every(x => !x.inRound || x.decision)) ctx.after(300, () => reveal(T, ctx)); }
    }
  };

  GA.views.poker3 = {
    title: "Three Card Poker",
    mount(el) {
      el.innerHTML = `
        <div class="view-head">
          <div><div class="eyebrow">Three Card Poker · Everyone vs. the dealer</div><h1 class="gold-text">Jade's Three Card</h1>
          <p>Ante up and add Pair Plus if you like. Look at your three cards, then play (match your ante) or fold. Jade needs queen-high to qualify.</p></div>
          <div class="who-here" data-who></div>
        </div>
        <div class="felt red">
          <div data-dealer></div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px"><div class="hand spread" data-dhand></div><span data-dname></span></div>
          <div class="felt-print" style="margin:14px 0">Dealer qualifies with queen high · Ante bonus on straights and better</div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:12px" data-mine></div>
          <div class="p3-players" data-others></div>
        </div>
        <div class="table-bar"><div class="status" data-status></div><div class="controls" data-controls></div></div>
        <div style="margin-top:14px" data-rack></div>
        <p class="rules" style="margin-top:14px">Pair Plus pays on your hand alone: pair 1:1, flush 3:1, straight 6:1, three of a kind 30:1, straight flush 40:1. Ante bonus (when you play): straight 1:1, trips 4:1, straight flush 5:1. If the dealer doesn't qualify, your ante pays 1:1 and your play bet pushes. In three-card poker a straight beats a flush.</p>`;
      const q = s => el.querySelector(s);
      const dealer = GA.dealer(q("[data-dealer]"), "jade");
      GA.rack(q("[data-rack]"));
      const cards = GA.cardTracker();
      let P = null;
      el.addEventListener("click", e => {
        const s = e.target.closest("[data-spot]");
        if (s && !s.disabled) { GA.net.act("poker3", { k: "bet", spot: s.dataset.spot, amt: GA.chip }); GA.sfx.chip(); return; }
        const b = e.target.closest("[data-act]"); if (b && !b.disabled) GA.net.act("poker3", { k: b.dataset.act });
      });
      function status() { if (P) q("[data-status]").innerHTML = `${GA.timerHTML(P.deadline)}<span>${GA.esc(P.msg || "")}</span>`; }
      return {
        render(snap) {
          P = snap.tables.poker3; if (!P) return;
          const me = GA.me.id, mp = P.players[me];
          q("[data-dhand]").innerHTML = P.dealer.cards.length ? P.dealer.cards.map((c, i) => cards.html(`r${P.round}d${i}`, c)).join("") : `<span class="muted" style="font-size:13px">Jade's cards land here</span>`;
          q("[data-dname]").innerHTML = !P.dealer.hidden && P.dealer.name ? `<span class="total">${GA.esc(P.dealer.name)}</span>` : "";
          const betting = P.phase === "betting";
          const myHand = mp && mp.hand && mp.hand.length ? mp.hand : [];
          q("[data-mine]").innerHTML = `
            <div class="hand spread" style="--cw:clamp(60px,12vw,84px)">${myHand.map((c, i) => cards.html(`r${P.round}me${i}`, c)).join("")}</div>
            ${myHand.length === 3 ? `<span class="total">${evalHand(myHand).name}</span>` : ""}
            ${mp && mp.res ? `<span class="badge ${mp.res.net > 0 ? "w" : mp.res.net < 0 ? "l" : "p"}">${mp.res.net >= 0 ? "+" : "−"}${GA.fmt(Math.abs(mp.res.net))}${mp.res.notes.length ? " · " + GA.esc(mp.res.notes.join(" · ")) : ""}</span>` : ""}
            <div class="p3-spots">
              <button class="bspot" data-spot="pp" ${betting ? "" : "disabled"}>Pair Plus<b>${mp && mp.pp ? GA.short(mp.pp) : ""}</b></button>
              <button class="bspot main" data-spot="ante" ${betting ? "" : "disabled"}>Ante<b>${mp && mp.ante ? GA.short(mp.ante) : ""}</b></button>
              <span class="bspot">Play<b>${mp && mp.play ? GA.short(mp.play) : ""}</b></span>
            </div>`;
          const others = Object.keys(P.players).filter(pid => pid !== me && snap.players[pid]);
          q("[data-others]").innerHTML = others.map(pid => {
            const p = P.players[pid], pl = snap.players[pid], show = P.phase === "payout";
            return `<div class="p3-p" style="--c:${pl.color}"><span class="sname"><i></i>${GA.esc(pl.name)}</span>
              <div class="hand" style="--cw:40px">${(p.hand || []).map((c, i) => cards.html(`r${P.round}${pid}${i}${show ? "" : "x"}`, show ? c : { back: true })).join("")}</div>
              <span style="font-size:12px" class="muted">${p.decision ? (p.decision === "play" ? "Playing" : "Folded") : p.inRound ? "Thinking…" : `Ante ${GA.short(p.ante || 0)}${p.pp ? " · PP " + GA.short(p.pp) : ""}`}</span>
              ${p.res ? `<span class="badge ${p.res.net > 0 ? "w" : p.res.net < 0 ? "l" : "p"}">${GA.esc(p.res.name)} ${p.res.net >= 0 ? "+" : "−"}${GA.fmt(Math.abs(p.res.net))}</span>` : ""}</div>`;
          }).join("");
          let ctl = "";
          if (betting) ctl = `${!mp || !mp.ante ? `<button class="btn btn-ghost btn-sm" data-act="rebet">Rebet</button>` : `<button class="btn btn-ghost btn-sm" data-act="clear">Clear</button><button class="btn btn-gold" data-act="deal">Deal now</button>`}`;
          else if (P.phase === "deciding" && mp && mp.inRound && !mp.decision) ctl = `<button class="btn btn-gold btn-lg" data-act="play">Play ${GA.short(mp.ante)}</button><button class="btn btn-dark btn-lg" data-act="fold">Fold</button>`;
          else if (P.phase === "deciding" && mp && mp.decision) ctl = `<span class="muted" style="font-size:14px">${mp.decision === "play" ? "You're playing." : "You folded."} Waiting on the table…</span>`;
          q("[data-controls]").innerHTML = ctl;
          status();
        },
        tick: status,
        onEvt(e, snap) {
          const mine = e.pid === GA.me.id;
          if (e.kind === "deal") { dealer.say("deal"); GA.sfx.card(); }
          else if (e.kind === "bet" && mine && Math.random() < 0.35) dealer.say("bet");
          else if (e.kind === "win" && mine) { if (e.label) { dealer.say("big"); GA.bigWin("Three Card Poker", e.label, e.net); } else { dealer.say("win"); GA.sfx.win(); GA.celebrate(40); } }
          else if (e.kind === "lose" && mine) { dealer.say("lose"); GA.sfx.lose(); }
          else if (e.kind === "push" && mine) dealer.say("lose");
          else if (e.kind === "broke" && mine) GA.toast("Not enough chips for that.");
          else if (e.kind === "win" && !mine && Math.random() < 0.4) dealer.say("other", { n: snap.players[e.pid] ? snap.players[e.pid].name : "" });
        }
      };
    }
  };
})();

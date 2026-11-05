/* Baccarat (punto banco): shared hand, everyone bets Player, Banker, Tie and pairs. */
(function () {
  "use strict";
  const GA = window.GA;
  const SPOTS = { player: [2, "Player", "1:1"], banker: [1.95, "Banker", "0.95:1"], tie: [9, "Tie", "8:1"], ppair: [12, "Player pair", "11:1"], bpair: [12, "Banker pair", "11:1"] };
  const bv = c => (c.r === "A" ? 1 : ["10", "J", "Q", "K"].includes(c.r) ? 0 : +c.r);
  const tot = cs => cs.reduce((t, c) => t + bv(c), 0) % 10;

  function draw(T) { if (T.priv.shoe.length < 20) { T.priv.shoe = GA.makeShoe(8); } return T.priv.shoe.pop(); }

  function deal(T, ctx) {
    const P = T.pub;
    if (P.phase !== "betting" || !Object.keys(P.bets).length) return;
    ctx.cancel(); P.deadline = 0;
    P.round++; P.phase = "dealing"; P.hand = { p: [], b: [], winner: null }; P.results = {};
    P.msg = "Cards, please.";
    ctx.evt("deal", {});
    const H = P.hand, steps = [() => H.p.push(draw(T)), () => H.b.push(draw(T)), () => H.p.push(draw(T)), () => H.b.push(draw(T))];
    const thirds = () => {
      const pt = tot(H.p), bt = tot(H.b);
      if (pt >= 8 || bt >= 8) return;
      let p3 = null;
      if (pt <= 5) { steps.push(() => { p3 = draw(T); H.p.push(p3); }); }
      steps.push(() => {
        const b = tot(H.b), pv = p3 ? bv(p3) : null;
        let go;
        if (pv === null) go = b <= 5;
        else if (b <= 2) go = true;
        else if (b === 3) go = pv !== 8;
        else if (b === 4) go = pv >= 2 && pv <= 7;
        else if (b === 5) go = pv >= 4 && pv <= 7;
        else if (b === 6) go = pv === 6 || pv === 7;
        else go = false;
        if (go) H.b.push(draw(T));
      });
    };
    let added = false;
    const next = () => {
      if (!steps.length && !added) { added = true; thirds(); }
      const st = steps.shift();
      if (!st) { settle(T, ctx); return; }
      st(); ctx.after(GA.reduced ? 150 : 750, next, "deal");
    };
    ctx.after(400, next, "deal");
  }

  function settle(T, ctx) {
    const P = T.pub, H = P.hand, pt = tot(H.p), bt = tot(H.b);
    H.pt = pt; H.bt = bt; H.winner = pt > bt ? "P" : bt > pt ? "B" : "T";
    const ppair = H.p[0].r === H.p[1].r, bpair = H.b[0].r === H.b[1].r;
    for (const pid in P.bets) {
      const b = P.bets[pid]; let back = 0, staked = 0, label = "";
      for (const k in b) {
        staked += b[k];
        if (k === "player" && H.winner === "P") back += b[k] * 2;
        else if (k === "banker" && H.winner === "B") back += b[k] * 1.95;
        else if ((k === "player" || k === "banker") && H.winner === "T") back += b[k];
        else if (k === "tie" && H.winner === "T") { back += b[k] * 9; label = "Tie pays 8:1!"; }
        else if (k === "ppair" && ppair) { back += b[k] * 12; label = "Player pair!"; }
        else if (k === "bpair" && bpair) { back += b[k] * 12; label = "Banker pair!"; }
      }
      back = Math.floor(back);
      ctx.pay(pid, back);
      P.results[pid] = back - staked;
      ctx.result(pid, back - staked, label);
      T.priv.last[pid] = b;
    }
    P.history.push(H.winner); if (P.history.length > 60) P.history.shift();
    P.phase = "payout";
    P.msg = H.winner === "T" ? `Tie, ${pt} to ${bt}.` : `${H.winner === "P" ? "Player" : "Banker"} wins, ${Math.max(pt, bt)} over ${Math.min(pt, bt)}.`;
    ctx.after(4500, () => { P.phase = "betting"; P.bets = {}; P.results = {}; P.msg = "Place your bets."; });
  }

  GA.engines.baccarat = {
    create(T) {
      T.pub = { phase: "betting", bets: {}, deadline: 0, hand: null, history: [], results: {}, msg: "Place your bets.", round: 0 };
      T.priv = { shoe: GA.makeShoe(8), last: {} };
    },
    handle(T, pid, a, ctx) {
      const P = T.pub;
      if (a.k === "bet") {
        if (P.phase !== "betting" || !SPOTS[a.spot]) return;
        const amt = Math.round(+a.amt || 0); if (amt <= 0) return;
        const mine = P.bets[pid] || {};
        if (a.spot === "player" && mine.banker) { ctx.evt("nohedge", { pid }); return; }
        if (a.spot === "banker" && mine.player) { ctx.evt("nohedge", { pid }); return; }
        if ((mine[a.spot] || 0) + amt > 50000) return;
        if (!ctx.charge(pid, amt)) { ctx.evt("broke", { pid }); return; }
        mine[a.spot] = (mine[a.spot] || 0) + amt; P.bets[pid] = mine;
        if (!P.deadline) { P.deadline = Date.now() + 15000; ctx.after(15000, () => deal(T, ctx)); }
        ctx.evt("bet", { pid });
      } else if (a.k === "clear") {
        if (P.phase !== "betting" || !P.bets[pid]) return;
        ctx.refund(pid, Object.values(P.bets[pid]).reduce((x, y) => x + y, 0)); delete P.bets[pid];
        if (!Object.keys(P.bets).length) { ctx.cancel(); P.deadline = 0; }
      } else if (a.k === "rebet") {
        if (P.phase !== "betting" || P.bets[pid] || !T.priv.last[pid]) return;
        const L = T.priv.last[pid], sum = Object.values(L).reduce((x, y) => x + y, 0);
        if (!ctx.charge(pid, sum)) { ctx.evt("broke", { pid }); return; }
        P.bets[pid] = Object.assign({}, L);
        if (!P.deadline) { P.deadline = Date.now() + 15000; ctx.after(15000, () => deal(T, ctx)); }
      } else if (a.k === "deal") { if (P.bets[pid]) deal(T, ctx); }
    },
    leave(T, pid, ctx) {
      const P = T.pub;
      if (P.phase === "betting" && P.bets[pid]) {
        ctx.refund(pid, Object.values(P.bets[pid]).reduce((x, y) => x + y, 0)); delete P.bets[pid];
        if (!Object.keys(P.bets).length) { ctx.cancel(); P.deadline = 0; }
      }
    }
  };

  GA.views.baccarat = {
    title: "Baccarat",
    mount(el) {
      el.innerHTML = `
        <div class="view-head">
          <div><div class="eyebrow">Punto banco · Eight decks · Shared hand</div><h1 class="gold-text">Salon Baccarat</h1>
          <p>Bet on the Player or the Banker hand, closest to nine wins. Drawing rules are automatic, so all you do is pick a side and watch Celeste squeeze the cards.</p></div>
          <div class="who-here" data-who></div>
        </div>
        <div class="felt blue">
          <div data-dealer></div>
          <div class="bac-hands">
            <div class="bac-side p" data-side="P"><h3>Player</h3><div class="hand spread" data-ph></div><span data-pt></span></div>
            <div class="bac-side b" data-side="B"><h3>Banker</h3><div class="hand spread" data-bh></div><span data-bt></span></div>
          </div>
          <div class="bac-spots">
            <div class="side"><button class="spot pl" data-spot="player"><span class="nm">Player</span><span class="od">1:1</span><span class="mine"></span><span class="dots"></span></button><button class="spot" data-spot="ppair"><span class="nm">P Pair</span><span class="od">11:1</span><span class="mine"></span><span class="dots"></span></button></div>
            <button class="spot tie" data-spot="tie"><span class="nm">Tie</span><span class="od">8:1 · Player and Banker push</span><span class="mine"></span><span class="dots"></span></button>
            <div class="side"><button class="spot bk" data-spot="banker"><span class="nm">Banker</span><span class="od">0.95:1</span><span class="mine"></span><span class="dots"></span></button><button class="spot" data-spot="bpair"><span class="nm">B Pair</span><span class="od">11:1</span><span class="mine"></span><span class="dots"></span></button></div>
          </div>
        </div>
        <div class="table-bar"><div class="status" data-status></div><div class="controls" data-controls></div></div>
        <div style="margin-top:14px;display:grid;gap:12px"><div data-rack></div><div><div class="eyebrow" style="margin-bottom:6px">Bead road</div><div class="road" data-road></div></div></div>
        <p class="rules" style="margin-top:14px">Card values: ace is 1, tens and faces are 0, totals count only the last digit. A natural 8 or 9 stops the hand. Banker wins pay 0.95 to 1 (a 5% commission).</p>`;
      const q = s => el.querySelector(s);
      const dealer = GA.dealer(q("[data-dealer]"), "celeste");
      GA.rack(q("[data-rack]"));
      const cards = GA.cardTracker();
      let P = null, last = 0;
      el.addEventListener("click", e => {
        const s = e.target.closest("[data-spot]");
        if (s && s.tagName === "BUTTON") { GA.net.act("baccarat", { k: "bet", spot: s.dataset.spot, amt: GA.chip }); GA.sfx.chip(); return; }
        const b = e.target.closest("[data-act]"); if (b && !b.disabled) GA.net.act("baccarat", { k: b.dataset.act });
      });
      function status() { if (P) q("[data-status]").innerHTML = `${GA.timerHTML(P.deadline)}<span>${GA.esc(P.msg || "")}</span>`; }
      return {
        render(snap) {
          P = snap.tables.baccarat; if (!P) return;
          const me = GA.me.id, mine = P.bets[me] || {}, H = P.hand;
          q("[data-ph]").innerHTML = H ? H.p.map((c, i) => cards.html(`r${P.round}p${i}`, c)).join("") : "";
          q("[data-bh]").innerHTML = H ? H.b.map((c, i) => cards.html(`r${P.round}b${i}`, c)).join("") : "";
          q("[data-pt]").innerHTML = H && H.p.length ? `<span class="total">${tot(H.p)}</span>` : "";
          q("[data-bt]").innerHTML = H && H.b.length ? `<span class="total">${tot(H.b)}</span>` : "";
          const n = H ? H.p.length + H.b.length : 0; if (n > last) GA.sfx.flip(); last = n;
          GA.$$("[data-side]", el).forEach(s => s.classList.toggle("won", !!(H && H.winner && (H.winner === s.dataset.side || H.winner === "T") && P.phase === "payout")));
          GA.$$("button[data-spot]", el).forEach(b => {
            const k = b.dataset.spot;
            b.querySelector(".mine").innerHTML = GA.stack(mine[k] || 0);
            b.querySelector(".dots").innerHTML = Object.keys(P.bets).filter(pid => pid !== me && P.bets[pid][k]).map(pid => `<i style="--c:${(snap.players[pid] || {}).color}" title="${GA.esc((snap.players[pid] || {}).name)}"></i>`).join("");
            b.disabled = P.phase !== "betting";
            const w = H && P.phase === "payout" && ((k === "player" && H.winner === "P") || (k === "banker" && H.winner === "B") || (k === "tie" && H.winner === "T") || (k === "ppair" && H.p[0].r === H.p[1].r) || (k === "bpair" && H.b[0].r === H.b[1].r));
            b.classList.toggle("win", !!w);
          });
          const total = Object.values(mine).reduce((a, b) => a + b, 0), betting = P.phase === "betting";
          q("[data-controls]").innerHTML = `${betting && !total ? `<button class="btn btn-ghost btn-sm" data-act="rebet">Rebet</button>` : ""}${betting && total ? `<button class="btn btn-ghost btn-sm" data-act="clear">Clear</button><button class="btn btn-gold" data-act="deal">Deal now</button>` : ""}${P.results[me] != null ? `<span class="badge ${P.results[me] > 0 ? "w" : P.results[me] < 0 ? "l" : "p"}">${P.results[me] >= 0 ? "+" : "−"}${GA.fmt(Math.abs(P.results[me]))}</span>` : ""}`;
          q("[data-road]").innerHTML = P.history.length ? P.history.map(h => `<i class="${h}">${h}</i>`).join("") : `<span style="color:var(--paper-ink);font-size:12px;grid-row:1/7;align-self:center;white-space:nowrap;padding:0 6px">Results will fill in here</span>`;
          status();
        },
        tick: status,
        onEvt(e, snap) {
          const mine = e.pid === GA.me.id;
          if (e.kind === "deal") dealer.say("deal");
          else if (e.kind === "bet" && mine && Math.random() < 0.35) dealer.say("bet");
          else if (e.kind === "win" && mine) { if (e.label) { dealer.say("big"); GA.bigWin("Salon Baccarat", e.label, e.net); } else { dealer.say("win"); GA.sfx.win(); GA.celebrate(40); } }
          else if (e.kind === "lose" && mine) { dealer.say("lose"); GA.sfx.lose(); }
          else if (e.kind === "push" && mine) dealer.say("push");
          else if (e.kind === "nohedge" && mine) GA.toast("Pick one side: Player or Banker.");
          else if (e.kind === "broke" && mine) GA.toast("Not enough chips for that bet.");
          else if (e.kind === "win" && !mine && Math.random() < 0.4) dealer.say("other", { n: snap.players[e.pid] ? snap.players[e.pid].name : "" });
        }
      };
    }
  };
})();

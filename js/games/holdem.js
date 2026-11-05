/* Texas Hold'em: players against each other. No-limit, up to 8 seats, side pots, private hole cards.
   The engine runs on the room host; each player's snapshot only carries their own hole cards. */
(function () {
  "use strict";
  const GA = window.GA;
  const N = 8;
  const STAKES = [[10, 20], [25, 50], [100, 200], [500, 1000]];
  const NAMES = ["High card", "Pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"];
  const rv = r => ({ A: 14, K: 13, Q: 12, J: 11 }[r] || +r);

  /* ---------- Hand evaluation ---------- */
  function eval5(cs) {
    const v = cs.map(c => rv(c.r)).sort((a, b) => b - a);
    const flush = cs.every(c => c.s === cs[0].s);
    const cnt = {}; v.forEach(x => (cnt[x] = (cnt[x] || 0) + 1));
    const g = Object.entries(cnt).map(([k, c]) => [+k, c]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const u = [...new Set(v)];
    let hi = 0;
    if (u.length === 5) { if (u[0] - u[4] === 4) hi = u[0]; else if (u.join() === "14,5,4,3,2") hi = 5; }
    if (hi && flush) return [8, hi];
    if (g[0][1] === 4) return [7, g[0][0], g[1][0]];
    if (g[0][1] === 3 && g[1][1] === 2) return [6, g[0][0], g[1][0]];
    if (flush) return [5, ...v];
    if (hi) return [4, hi];
    if (g[0][1] === 3) return [3, g[0][0], ...g.slice(1).map(x => x[0])];
    if (g[0][1] === 2 && g[1][1] === 2) return [2, g[0][0], g[1][0], g[2][0]];
    if (g[0][1] === 2) return [1, g[0][0], ...g.slice(1).map(x => x[0])];
    return [0, ...v];
  }
  const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
  function best(cards) {
    let top = null, used = null;
    const n = cards.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const five = [cards[a], cards[b], cards[c], cards[d], cards[e]], s = eval5(five);
      if (!top || cmp(s, top) > 0) { top = s; used = five; }
    }
    return { score: top, cards: used, name: top[0] === 8 && top[1] === 14 ? "Royal flush" : NAMES[top[0]] };
  }
  GA.rules = GA.rules || {};
  GA.rules.holdemBest = best;
  GA.rules.holdemCmp = cmp;

  /* ---------- Engine helpers ---------- */
  const seatOf = (P, pid) => P.seats.findIndex(s => s && s.pid === pid);
  const nextIdx = (P, from, pred) => { for (let k = 1; k <= N; k++) { const i = (((from + k) % N) + N) % N; if (pred(P.seats[i], i)) return i; } return -1; };
  const canAct = s => !!s && s.inHand && !s.folded && !s.allin;
  const inPlay = s => !!s && s.inHand && !s.folded;
  const eligible = s => !!s && !s.gone && !s.sitout && s.stack > 0;
  const blinds = P => STAKES[P.stakes];
  function draw(T) { return T.priv.rig && T.priv.rig.length ? T.priv.rig.shift() : T.priv.deck.pop(); }
  function potTotal(P) { return P.seats.reduce((t, s) => t + (s ? s.total : 0), 0); }
  function commit(P, s, amt) { amt = Math.max(0, Math.min(amt, s.stack)); s.stack -= amt; s.bet += amt; s.total += amt; if (s.stack === 0) s.allin = true; P.pot = potTotal(P); return amt; }

  function maybeStart(T, ctx) {
    const P = T.pub;
    if (P.phase !== "waiting") return;
    const ready = P.seats.filter(eligible).length;
    if (ready < 2) { ctx.cancel("next"); P.deadline = 0; P.msg = ready ? "Waiting for another player to sit down." : "Take a seat to play."; return; }
    if (P.deadline) return;
    P.msg = "Next hand in a moment…";
    P.deadline = Date.now() + 3000;
    ctx.after(3000, () => { P.deadline = 0; startHand(T, ctx); }, "next");
  }

  function startHand(T, ctx) {
    const P = T.pub;
    const elig = P.seats.map((s, i) => (eligible(s) ? i : -1)).filter(i => i >= 0);
    if (elig.length < 2) { P.phase = "waiting"; maybeStart(T, ctx); return; }
    const [sbAmt, bbAmt] = blinds(P);
    P.hand++; P.board = []; P.results = null; P.pot = 0;
    T.priv.deck = GA.makeShoe(1); T.priv.hole = {}; T.priv.start = {};
    P.seats.forEach((s, i) => {
      if (!s) return;
      Object.assign(s, { bet: 0, total: 0, folded: false, allin: false, acted: false, lock: false, shown: null, won: 0, last: "", best: "", inHand: elig.includes(i) });
      if (s.inHand) T.priv.start[s.pid] = s.stack;
    });
    P.button = nextIdx(P, P.button, (s, i) => elig.includes(i));
    const isIn = (s, i) => elig.includes(i);
    const sb = elig.length === 2 ? P.button : nextIdx(P, P.button, isIn);
    const bb = nextIdx(P, sb, isIn);
    P.sb = sb; P.bb = bb;
    commit(P, P.seats[sb], sbAmt); P.seats[sb].last = "Small blind";
    commit(P, P.seats[bb], bbAmt); P.seats[bb].last = "Big blind";
    for (let r = 0; r < 2; r++) {
      let i = P.button;
      for (let k = 0; k < elig.length; k++) { i = nextIdx(P, i, isIn); const pid = P.seats[i].pid; (T.priv.hole[pid] = T.priv.hole[pid] || []).push(draw(T)); }
    }
    P.currentBet = bbAmt; P.minRaise = bbAmt; P.phase = "preflop";
    P.msg = `Hand #${P.hand}. Blinds ${GA.fmt(sbAmt)}/${GA.fmt(bbAmt)}.`;
    ctx.evt("deal", {});
    advance(T, ctx, bb);
  }

  function needsAction(P, s) { return canAct(s) && (!s.acted || s.bet < P.currentBet); }

  function advance(T, ctx, from) {
    const P = T.pub;
    if (P.seats.filter(inPlay).length === 1) { uncontested(T, ctx); return; }
    const nx = nextIdx(P, from, s => needsAction(P, s));
    if (nx < 0) { endStreet(T, ctx); return; }
    // Everyone else is all-in and this player already matches the bet: nothing left to decide.
    const others = P.seats.filter((s, i) => i !== nx && canAct(s)).length;
    if (!others && P.seats[nx].bet >= P.currentBet) { endStreet(T, ctx); return; }
    P.toAct = nx;
    const hand = P.hand;
    P.deadline = Date.now() + 30000;
    ctx.after(30000, () => {
      if (P.hand !== hand || P.toAct !== nx) return;
      const s = P.seats[nx];
      act(T, s.pid, { k: s.bet === P.currentBet ? "check" : "fold", auto: true }, ctx);
    }, "turn");
    ctx.evt("turn", { pid: P.seats[nx].pid });
  }

  function act(T, pid, a, ctx) {
    const P = T.pub, si = seatOf(P, pid);
    if (si < 0 || si !== P.toAct || !["preflop", "flop", "turn", "river"].includes(P.phase)) return;
    const s = P.seats[si], f = GA.fmt;
    const toCall = P.currentBet - s.bet;
    if (a.k === "fold") { s.folded = true; s.last = a.auto ? "Fold (time)" : "Fold"; }
    else if (a.k === "check") { if (toCall > 0) return; s.last = a.auto ? "Check (time)" : "Check"; }
    else if (a.k === "call") {
      if (toCall <= 0) { s.last = "Check"; }
      else { const put = commit(P, s, toCall); s.last = s.allin ? `All-in ${f(s.bet)}` : `Call ${f(put)}`; }
    } else if (a.k === "raise") {
      if (s.lock) return;
      const maxTo = s.bet + s.stack;
      let to = Math.round(+a.to || 0);
      if (to > maxTo) to = maxTo;
      if (to <= P.currentBet) return;
      const inc = to - P.currentBet, full = inc >= P.minRaise;
      if (!full && to !== maxTo) return; // under a minimum raise is only allowed as an all-in
      const wasBet = P.currentBet === 0;
      commit(P, s, to - s.bet);
      P.seats.forEach((o, i) => {
        if (i === si || !canAct(o)) return;
        if (full) { o.acted = false; o.lock = false; }
        else if (o.acted) { o.acted = false; o.lock = true; } // a short all-in doesn't reopen raising
      });
      if (full) P.minRaise = inc;
      P.currentBet = to;
      s.last = s.allin ? `All-in ${f(to)}` : wasBet ? `Bet ${f(to)}` : `Raise to ${f(to)}`;
    } else return;
    s.acted = true;
    ctx.cancel("turn"); P.deadline = 0; P.toAct = -1;
    ctx.evt("act", { pid, k: a.k, allin: s.allin });
    advance(T, ctx, si);
  }

  function endStreet(T, ctx) {
    const P = T.pub, bb = blinds(P)[1];
    P.toAct = -1;
    P.seats.forEach(s => { if (s) { s.bet = 0; s.acted = false; s.lock = false; } });
    P.currentBet = 0; P.minRaise = bb;
    if (P.phase === "river") { showdown(T, ctx); return; }
    const deal = n => { draw(T); for (let i = 0; i < n; i++) P.board.push(draw(T)); };
    if (P.phase === "preflop") { deal(3); P.phase = "flop"; }
    else if (P.phase === "flop") { deal(1); P.phase = "turn"; }
    else if (P.phase === "turn") { deal(1); P.phase = "river"; }
    P.seats.forEach(s => { if (s && s.inHand && !s.folded && !s.allin) s.last = ""; });
    ctx.evt("street", { phase: P.phase });
    const actors = P.seats.filter(canAct).length;
    if (actors < 2) {
      P.msg = "All in. Running out the board…";
      ctx.after(GA.reduced ? 300 : 1400, () => endStreet(T, ctx), "runout");
      return;
    }
    P.msg = { flop: "The flop.", turn: "The turn.", river: "The river." }[P.phase];
    advance(T, ctx, P.button);
  }

  function pots(P) {
    const seats = P.seats.map((s, i) => ({ s, i })).filter(x => x.s && x.s.total > 0);
    const levels = [...new Set(seats.map(x => x.s.total))].sort((a, b) => a - b);
    const out = []; let prev = 0;
    for (const L of levels) {
      let amt = 0;
      for (const x of seats) amt += Math.min(x.s.total, L) - Math.min(x.s.total, prev);
      const elig = seats.filter(x => inPlay(x.s) && x.s.total >= L).map(x => x.i);
      if (!elig.length) { if (out.length) out[out.length - 1].amt += amt; }
      else if (out.length && out[out.length - 1].elig.join() === elig.join()) out[out.length - 1].amt += amt;
      else out.push({ amt, elig });
      prev = L;
    }
    return out;
  }

  function showdown(T, ctx) {
    const P = T.pub;
    P.phase = "showdown"; P.toAct = -1;
    const hands = {};
    P.seats.forEach((s, i) => {
      if (!inPlay(s)) return;
      s.shown = T.priv.hole[s.pid];
      hands[i] = best([...s.shown, ...P.board]);
      s.best = hands[i].name;
    });
    const res = [];
    for (const pot of pots(P)) {
      let top = null, winners = [];
      for (const i of pot.elig) { const h = hands[i]; const c = top ? cmp(h.score, top) : 1; if (c > 0) { top = h.score; winners = [i]; } else if (c === 0) winners.push(i); }
      // odd chips go to the first winner left of the button
      winners.sort((a, b) => ((a - P.button + N - 1) % N) - ((b - P.button + N - 1) % N));
      const share = Math.floor(pot.amt / winners.length);
      let rem = pot.amt - share * winners.length;
      for (const w of winners) { const amt = share + (rem-- > 0 ? 1 : 0); P.seats[w].stack += amt; P.seats[w].won += amt; }
      res.push({ amt: pot.amt, winners, hand: hands[winners[0]].name, cards: hands[winners[0]].cards });
    }
    P.results = res;
    const w = res[0];
    P.msg = w.winners.length > 1 ? `Split pot: ${w.winners.map(i => ctx.name(P.seats[i].pid)).join(" & ")} with ${w.hand.toLowerCase()}.` : `${ctx.name(P.seats[w.winners[0]].pid)} wins ${GA.fmt(w.amt)} with ${w.hand.toLowerCase()}.`;
    finish(T, ctx);
  }

  function uncontested(T, ctx) {
    const P = T.pub, wi = P.seats.findIndex(inPlay), s = P.seats[wi];
    const amt = potTotal(P);
    s.stack += amt; s.won = amt;
    P.results = [{ amt, winners: [wi], hand: null }];
    P.msg = `${ctx.name(s.pid)} takes the pot of ${GA.fmt(amt)}.`;
    P.phase = "showdown"; P.toAct = -1;
    finish(T, ctx);
  }

  function finish(T, ctx) {
    const P = T.pub;
    ctx.cancel("turn"); ctx.cancel("runout"); P.deadline = 0; P.pot = 0;
    P.seats.forEach((s, i) => {
      if (!s || !s.inHand) return;
      if (s.gone) { P.seats[i] = null; return; }
      const net = s.stack - (T.priv.start[s.pid] || 0);
      ctx.result(s.pid, net, s.won && s.best && ["Four of a kind", "Straight flush", "Royal flush", "Full house"].includes(s.best) ? s.best : "");
    });
    ctx.after(GA.reduced ? 1500 : 6000, () => {
      P.phase = "waiting";
      P.seats.forEach((s, i) => { if (s && (s.gone || !ctx.here(s.pid))) P.seats[i] = null; else if (s) { s.inHand = false; s.shown = null; s.won = 0; s.best = ""; } });
      maybeStart(T, ctx);
    }, "next");
  }

  GA.engines.holdem = {
    create(T) {
      T.pub = { seats: Array(N).fill(null), stakes: 1, button: -1, sb: -1, bb: -1, phase: "waiting", board: [], pot: 0, toAct: -1, currentBet: 0, minRaise: 0, deadline: 0, hand: 0, msg: "Take a seat to play.", results: null };
      T.priv = { deck: [], hole: {}, start: {}, rig: null };
    },
    redact(T, pid) { return Object.assign({}, T.pub, { mine: T.priv.hole[pid] || null }); },
    handle(T, pid, a, ctx) {
      const P = T.pub, si = seatOf(P, pid), s = si >= 0 ? P.seats[si] : null, [, bb] = blinds(P);
      const between = P.phase === "waiting" || P.phase === "showdown";
      switch (a.k) {
        case "sit": {
          if (s) return;
          const n = +a.seat; if (!(n >= 0 && n < N) || P.seats[n]) return;
          const buy = Math.round(+a.buy || 0);
          if (buy < bb * 20 || buy > bb * 200) { ctx.evt("buyin", { pid, min: bb * 20, max: bb * 200 }); return; }
          if (!ctx.charge(pid, buy)) { ctx.evt("broke", { pid }); return; }
          P.seats[n] = { pid, stack: buy, bet: 0, total: 0, folded: false, allin: false, acted: false, lock: false, inHand: false, sitout: false, last: "", shown: null, won: 0, best: "" };
          ctx.evt("sit", { pid });
          maybeStart(T, ctx);
          return;
        }
        case "rebuy": {
          if (!s || (s.inHand && !between)) return;
          const room = bb * 200 - s.stack, amt = Math.min(Math.round(+a.amt || 0), room);
          if (amt <= 0) return;
          if (!ctx.charge(pid, amt)) { ctx.evt("broke", { pid }); return; }
          s.stack += amt; maybeStart(T, ctx);
          return;
        }
        case "sitout": if (s) { s.sitout = !s.sitout; if (s.sitout && s.inHand && P.toAct === si) act(T, pid, { k: s.bet === P.currentBet ? "check" : "fold" }, ctx); maybeStart(T, ctx); } return;
        case "leave": GA.engines.holdem.leave(T, pid, ctx); return;
        case "stakes": {
          if (!s || !between || P.seats.some(x => x && x.inHand && P.phase !== "waiting" && P.phase !== "showdown")) return;
          const k = +a.v; if (!(k >= 0 && k < STAKES.length) || k === P.stakes) return;
          P.stakes = k; P.msg = `Blinds are now ${GA.fmt(STAKES[k][0])}/${GA.fmt(STAKES[k][1])}.`;
          ctx.evt("stakes", { pid });
          return;
        }
        default: act(T, pid, a, ctx);
      }
    },
    leave(T, pid, ctx) {
      const P = T.pub, si = seatOf(P, pid); if (si < 0) return;
      const s = P.seats[si];
      const live = s.inHand && ["preflop", "flop", "turn", "river"].includes(P.phase);
      if (live && !s.folded && P.toAct === si) act(T, pid, { k: "fold" }, ctx);
      else if (live) s.folded = true;
      ctx.pay(pid, s.stack); s.stack = 0;
      if (live) { s.gone = true; if (P.seats.filter(inPlay).length === 1 && P.toAct !== -1) { ctx.cancel("turn"); uncontested(T, ctx); } }
      else P.seats[si] = null;
      maybeStart(T, ctx);
    }
  };

  /* ================= VIEW ================= */
  // seat positions around the oval, starting bottom-centre (that's you) and going clockwise
  const POS = [[50, 96], [16, 86], [2, 50], [16, 13], [50, 3], [84, 13], [98, 50], [84, 86]];

  GA.views.holdem = {
    title: "Hold'em",
    mount(el) {
      el.innerHTML = `
        <div class="view-head">
          <div><div class="eyebrow">Texas Hold'em · No limit · Player vs player</div><h1 class="gold-text">The Hold'em Room</h1>
          <p>Play poker against your friends, not the house. Buy in from your chips, and when you leave the table your stack goes back to your balance.</p></div>
          <div class="who-here" data-who></div>
        </div>
        <div class="felt pk-felt">
          <div data-dealer></div>
          <div class="pk-table" data-table>
            <div class="pk-center"><div class="hand spread" data-board></div><div class="pk-pot" data-pot></div><div class="pk-msg" data-msg></div></div>
          </div>
        </div>
        <div class="table-bar"><div class="status" data-status></div><div class="controls" data-controls></div></div>
        <div class="pk-raise" data-raise hidden></div>
        <div class="pk-stakes" data-stakes></div>`;
      const q = s => el.querySelector(s);
      const dealer = GA.dealer(q("[data-dealer]"), "ivy");
      const cards = GA.cardTracker();
      let P = null, pickSeat = -1, raiseTo = 0, lastHand = 0;

      el.addEventListener("click", e => {
        const b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
        const k = b.dataset.act;
        if (k === "pick") { pickSeat = +b.dataset.seat; render(GA.net.snap); return; }
        if (k === "cancel") { pickSeat = -1; render(GA.net.snap); return; }
        if (k === "sit") { const v = +q("#pk-buy").value; GA.net.act("holdem", { k: "sit", seat: pickSeat, buy: v }); pickSeat = -1; GA.sfx.chip(); return; }
        if (k === "rebuy") { const me = P.seats.find(s => s && s.pid === GA.me.id); const [, bb] = STAKES[P.stakes]; GA.net.act("holdem", { k: "rebuy", amt: bb * 100 - (me ? me.stack : 0) }); GA.sfx.chip(); return; }
        if (k === "preset") { raiseTo = +b.dataset.to; syncRaise(); return; }
        if (k === "raise") { GA.net.act("holdem", { k: "raise", to: raiseTo }); GA.sfx.chip(); return; }
        if (k === "stakes") { GA.net.act("holdem", { k: "stakes", v: +b.dataset.v }); return; }
        GA.net.act("holdem", { k });
        if (k === "call") GA.sfx.chip();
      });
      el.addEventListener("input", e => {
        if (e.target.id === "pk-slider") { raiseTo = +e.target.value; syncRaise(true); }
        if (e.target.id === "pk-to") { raiseTo = Math.round(+e.target.value || 0); syncRaise(true, true); }
      });

      function syncRaise(fromInput, fromBox) {
        const sl = q("#pk-slider"), box = q("#pk-to"), btn = q('[data-act="raise"]');
        if (!sl) return;
        if (!fromBox) box.value = raiseTo;
        if (!fromInput || fromBox) sl.value = raiseTo;
        const me = P.seats.find(s => s && s.pid === GA.me.id), max = me.bet + me.stack;
        btn.textContent = raiseTo >= max ? `All-in ${GA.fmt(max)}` : `${P.currentBet ? "Raise to" : "Bet"} ${GA.fmt(raiseTo)}`;
      }

      function seatHTML(s, i, snap, mySeat) {
        const rot = mySeat >= 0 ? (i - mySeat + N) % N : i;
        const [x, y] = POS[rot];
        const style = `left:${x}%;top:${y}%`;
        if (!s) {
          return `<div class="pk-seat empty" style="${style}">${mySeat < 0 ? `<button class="sit-btn" data-act="pick" data-seat="${i}">Sit</button>` : ""}</div>`;
        }
        const pl = snap.players[s.pid] || { name: "Player", color: "#999" };
        const mine = s.pid === GA.me.id, turn = P.toAct === i;
        let cs = "";
        if (s.inHand && !s.folded) {
          if (mine && P.mine) cs = P.mine.map((c, k) => cards.html(`h${P.hand}me${k}`, c)).join("");
          else if (s.shown) cs = s.shown.map((c, k) => cards.html(`h${P.hand}s${i}c${k}`, c)).join("");
          else cs = cards.html(`h${P.hand}s${i}b0`, { back: true }) + cards.html(`h${P.hand}s${i}b1`, { back: true });
        }
        const won = P.results && P.results.some(r => r.winners.includes(i));
        return `<div class="pk-seat ${mine ? "me" : ""} ${turn ? "turn" : ""} ${s.folded ? "folded" : ""} ${won && P.phase === "showdown" ? "won" : ""}" style="${style};--c:${pl.color}">
          <div class="pk-cards hand">${cs}</div>
          <div class="pk-plate"><b>${GA.esc(pl.name)}</b><span class="num">${s.sitout ? "Sitting out" : GA.fmt(s.stack)}</span>${turn ? `<span class="pk-timer">${GA.timerHTML(P.deadline)}</span>` : ""}</div>
          ${s.last ? `<div class="pk-last">${GA.esc(s.last)}</div>` : ""}
          ${s.best && P.phase === "showdown" ? `<div class="pk-last best">${GA.esc(s.best)}</div>` : ""}
          ${s.bet ? `<div class="pk-bet">${GA.stack(s.bet)}</div>` : ""}
          ${P.button === i && P.hand ? `<span class="pk-btn">D</span>` : ""}
          ${s.won && P.phase === "showdown" ? `<div class="pk-won">+${GA.fmt(s.won)}</div>` : ""}
        </div>`;
      }

      function controls(snap) {
        const me = GA.me.id, si = P.seats.findIndex(s => s && s.pid === me), s = si >= 0 ? P.seats[si] : null, [, bb] = STAKES[P.stakes];
        const raise = q("[data-raise]");
        raise.hidden = true;
        if (!s) {
          if (pickSeat >= 0) {
            const bal = GA.wallet.bal(), min = bb * 20, max = Math.min(bb * 200, bal), def = Math.min(bb * 100, max);
            if (bal < min) return `<span class="muted" style="font-size:14px">You need at least ${GA.fmt(min)} chips to sit at these stakes.</span><button class="btn btn-dark btn-sm" data-act="cancel">Cancel</button>`;
            return `<label class="muted" for="pk-buy" style="font-size:13px">Buy in (${GA.fmt(min)}–${GA.fmt(max)})</label><input class="input" id="pk-buy" type="number" min="${min}" max="${max}" step="${bb}" value="${def}" style="width:130px;flex:0 0 auto"><button class="btn btn-gold" data-act="sit">Sit down</button><button class="btn btn-dark btn-sm" data-act="cancel">Cancel</button>`;
          }
          return `<span class="muted" style="font-size:14px">Tap an open seat to buy in.</span>`;
        }
        const live = ["preflop", "flop", "turn", "river"].includes(P.phase);
        if (live && P.toAct === si) {
          const toCall = P.currentBet - s.bet, max = s.bet + s.stack;
          const minTo = Math.min(max, P.currentBet + Math.max(P.minRaise, bb));
          const canRaise = !s.lock && max > P.currentBet;
          if (canRaise) {
            if (raiseTo < minTo || raiseTo > max || P.hand !== lastHand) raiseTo = minTo;
            lastHand = P.hand;
            const pot = P.pot + toCall, half = Math.min(max, P.currentBet + Math.max(minTo - P.currentBet, Math.round(pot / 2))), full = Math.min(max, P.currentBet + Math.max(minTo - P.currentBet, pot));
            raise.hidden = false;
            raise.innerHTML = `<div class="pk-presets"><button class="btn btn-dark btn-sm" data-act="preset" data-to="${minTo}">Min</button><button class="btn btn-dark btn-sm" data-act="preset" data-to="${half}">½ pot</button><button class="btn btn-dark btn-sm" data-act="preset" data-to="${full}">Pot</button><button class="btn btn-dark btn-sm" data-act="preset" data-to="${max}">All-in</button></div>
              <input type="range" id="pk-slider" min="${minTo}" max="${max}" step="${bb / 2}" value="${raiseTo}" aria-label="Raise amount"><input class="input" id="pk-to" type="number" min="${minTo}" max="${max}" value="${raiseTo}" aria-label="Raise to" style="width:120px;flex:0 0 auto">`;
          }
          return `<button class="btn btn-dark" data-act="fold">Fold</button>
            ${toCall > 0 ? `<button class="btn btn-ghost" data-act="call">${toCall >= s.stack ? `All-in ${GA.fmt(s.stack)}` : `Call ${GA.fmt(toCall)}`}</button>` : `<button class="btn btn-ghost" data-act="check">Check</button>`}
            ${canRaise ? `<button class="btn btn-gold" data-act="raise">Raise</button>` : ""}`;
        }
        const between = !live;
        return `${between && s.stack < bb * 100 ? `<button class="btn btn-ghost btn-sm" data-act="rebuy">Top up to ${GA.short(bb * 100)}</button>` : ""}
          <button class="btn btn-dark btn-sm" data-act="sitout">${s.sitout ? "I'm back" : "Sit out"}</button>
          <button class="btn btn-dark btn-sm" data-act="leave">Leave table</button>`;
      }

      function status() { if (P) q("[data-status]").innerHTML = `${P.toAct < 0 ? GA.timerHTML(P.deadline) : ""}<span>${GA.esc(P.msg || "")}</span>`; GA.$$(".pk-timer", el).forEach(t => (t.innerHTML = GA.timerHTML(P.deadline))); }

      function render(snap) {
        P = snap.tables.holdem; if (!P) return;
        const me = GA.me.id, mySeat = P.seats.findIndex(s => s && s.pid === me);
        GA.$$(".pk-seat", el).forEach(n => n.remove());
        q("[data-table]").insertAdjacentHTML("beforeend", P.seats.map((s, i) => seatHTML(s, i, snap, mySeat)).join(""));
        q("[data-board]").innerHTML = P.board.length ? P.board.map((c, i) => cards.html(`h${P.hand}b${i}`, c)).join("") : `<span class="muted" style="font-size:13px">${P.phase === "waiting" ? "" : "Community cards"}</span>`;
        q("[data-pot]").innerHTML = P.pot ? `Pot ${GA.stack(P.pot)}` : "";
        q("[data-msg]").textContent = P.phase === "waiting" && !P.hand ? "Two players start the action." : "";
        const between = !["preflop", "flop", "turn", "river"].includes(P.phase), seated = mySeat >= 0;
        q("[data-stakes]").innerHTML = `<span class="eyebrow">Blinds</span>` + STAKES.map((st, i) => `<button class="btn btn-sm ${i === P.stakes ? "btn-gold" : "btn-dark"}" data-act="stakes" data-v="${i}" ${!seated || !between ? "disabled" : ""}>${GA.short(st[0])}/${GA.short(st[1])}</button>`).join("") + `<span class="muted" style="font-size:12px">Buy in 20 to 200 big blinds. Seated players can change blinds between hands.</span>`;
        const active = document.activeElement && ["pk-buy", "pk-to", "pk-slider"].includes(document.activeElement.id);
        if (!active) q("[data-controls]").innerHTML = controls(snap);
        status();
      }
      return {
        render,
        tick: status,
        onEvt(e, snap) {
          const mine = e.pid === GA.me.id, nm = snap.players[e.pid] ? snap.players[e.pid].name : "";
          if (e.kind === "deal") { dealer.say("deal"); GA.sfx.card(); }
          else if (e.kind === "turn" && mine) { GA.sfx.ding(); dealer.say("turn"); }
          else if (e.kind === "street") GA.sfx.flip();
          else if (e.kind === "act" && e.allin) { dealer.say("allin", { n: nm }); GA.sfx.chip(); }
          else if (e.kind === "act" && e.k !== "fold") GA.sfx.chip();
          else if (e.kind === "win" && mine) { if (e.label) { dealer.say("big"); GA.bigWin("The Hold'em Room", e.label, e.net); } else { dealer.say("win"); GA.sfx.win(); GA.celebrate(60); } }
          else if (e.kind === "win" && !mine) dealer.say("other", { n: nm });
          else if (e.kind === "lose" && mine && e.net < 0) dealer.say("lose");
          else if (e.kind === "buyin" && mine) GA.toast(`Buy in between ${GA.fmt(e.min)} and ${GA.fmt(e.max)} at these blinds.`);
          else if (e.kind === "broke" && mine) GA.toast("Not enough chips for that buy-in.");
        }
      };
    }
  };
})();

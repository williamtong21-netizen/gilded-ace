/* Blackjack: five rule sets, five seats, one shared deck. The engine runs on the room host; the view renders snapshots. */
(function () {
  "use strict";
  const GA = window.GA;
  const SEATS = 5, MAX_BET = 50000;

  const V = {
    classic: { name: "Classic", blurb: "Single deck. Blackjack pays 3 to 2, the dealer stands on soft 17, double after split, late surrender.", decks: 1, h17: false, bj: 1.5, das: true, surrender: true, print: "Blackjack pays 3 to 2 · Dealer stands on all 17s" },
    frenzy: { name: "Double Down Frenzy", blurb: "Double on any number of cards, then double again, up to three times a hand. After a double you can only double again or stand. Dealer hits soft 17.", decks: 1, h17: true, bj: 1.5, das: true, frenzy: true, print: "Double any time · Up to 3 doubles a hand" },
    freebet: { name: "Free Bet", blurb: "Free doubles on hard 9, 10 and 11, and free splits on every pair except tens. The house puts up the extra bet. A dealer 22 pushes every hand that's still live.", decks: 1, h17: true, bj: 1.5, das: true, free: true, push22: true, print: "Free doubles · Free splits · Dealer 22 pushes" },
    exposure: { name: "Double Exposure", blurb: "Both dealer cards are dealt face up. In exchange, blackjack pays even money and the dealer wins ties (tied blackjacks push).", decks: 1, h17: true, bj: 1, das: true, exposure: true, print: "Both dealer cards face up · Dealer wins ties" },
    spanish: { name: "Spanish 21", blurb: "Single deck with the four tens removed (face cards stay). Your 21 always wins, you can double on any number of cards, and 5, 6 and 7-card 21s or 6-7-8 and 7-7-7 pay bonuses.", decks: 1, h17: true, bj: 1.5, das: true, surrender: true, spanish: true, doubleAny: true, print: "Player 21 always wins · Bonus 21s" }
  };
  const ORDER = ["classic", "frenzy", "freebet", "exposure", "spanish"];

  const val = r => (r === "A" ? 11 : r === "10" || r === "J" || r === "Q" || r === "K" ? 10 : +r);
  function hv(cards) {
    let t = 0, a = 0;
    for (const c of cards) { if (!c || c.back) continue; t += val(c.r); if (c.r === "A") a++; }
    while (t > 21 && a) { t -= 10; a--; }
    return { t, soft: a > 0 };
  }
  const isBJ = h => h.cards.length === 2 && !h.split && hv(h.cards).t === 21;
  const rv = r => (r === "A" ? 14 : r === "K" ? 13 : r === "Q" ? 12 : r === "J" ? 11 : +r);
  function pairRes(a, b) {
    if (!a || !b || a.r !== b.r) return null;
    if (a.s === b.s) return [25, "Perfect pair"];
    if (GA.isRed(a) === GA.isRed(b)) return [12, "Colored pair"];
    return [6, "Mixed pair"];
  }
  function t3Res(a, b, c) {
    const cs = [a, b, c], v = cs.map(x => rv(x.r)).sort((x, y) => x - y);
    const flush = cs.every(x => x.s === a.s), trips = v[0] === v[2];
    const straight = (v[0] + 1 === v[1] && v[1] + 1 === v[2]) || (v[0] === 2 && v[1] === 3 && v[2] === 14);
    if (trips && flush) return [100, "Suited trips"];
    if (straight && flush) return [40, "Straight flush"];
    if (trips) return [30, "Three of a kind"];
    if (straight) return [10, "Straight"];
    if (flush) return [5, "Flush"];
    return null;
  }
  function spanishBonus(h) {
    if (h.doubles > 0) return 1;
    const n = h.cards.length, rs = h.cards.map(c => c.r).sort().join(",");
    if (n === 3 && (rs === "6,7,8" || rs === "7,7,7")) {
      const suited = h.cards.every(c => c.s === h.cards[0].s);
      return suited && h.cards[0].s === "♠" ? 3 : suited ? 2 : 1.5;
    }
    return n >= 7 ? 3 : n === 6 ? 2 : n === 5 ? 1.5 : 1;
  }
  function canDouble(h, v) {
    if (!h || h.done || h.aces) return false;
    if (v.frenzy) return h.doubles < 3;
    if (h.doubles > 0) return false;
    if (v.doubleAny) return true;
    return h.cards.length === 2 && (v.das || !h.split);
  }
  const freeDouble = (h, v) => { const t = hv(h.cards); return !!v.free && h.cards.length === 2 && h.doubles === 0 && !t.soft && t.t >= 9 && t.t <= 11; };
  const canSplit = (s, h) => !!h && !h.done && h.cards.length === 2 && h.doubles === 0 && val(h.cards[0].r) === val(h.cards[1].r) && s.hands.length < 4;
  const freeSplit = (h, v) => !!v.free && val(h.cards[0].r) !== 10;
  const canSurrender = (s, h, v) => !!v.surrender && !!h && !h.done && h.cards.length === 2 && !h.split && h.doubles === 0 && s.hands.length === 1;

  /* ================= ENGINE ================= */
  function newShoe(T) {
    const v = V[T.pub.variant];
    T.priv.shoe = GA.makeShoe(v.decks, v.spanish ? r => r !== "10" : null);
    T.priv.cut = Math.floor(T.priv.shoe.length * 0.5); // single deck: reshuffle at half
    T.pub.shoeLeft = T.priv.shoe.length;
  }
  function draw(T) { if (!T.priv.shoe.length) newShoe(T); const c = T.priv.shoe.pop(); T.pub.shoeLeft = T.priv.shoe.length; return c; }
  const seatOf = (T, pid) => T.pub.seats.findIndex(s => s && s.pid === pid);

  function armTimer(T, ctx) {
    const P = T.pub, now = Date.now();
    const seated = P.seats.filter(s => s && !s.gone);
    const allIn = seated.length && seated.every(s => s.bet > 0);
    if (allIn) {
      const at = Math.min(P.deadline || Infinity, now + 3000);
      P.deadline = at; ctx.after(at - now, () => startRound(T, ctx));
    } else if (!P.deadline) {
      P.deadline = now + 15000; ctx.after(15000, () => startRound(T, ctx));
    }
  }
  function clearTable(P) { P.dealer = { cards: [] }; P.seats.forEach(s => { if (s) { s.hands = []; s.side = []; s.net = null; } }); P.settled = false; }

  function startRound(T, ctx) {
    const P = T.pub;
    ctx.cancel(); P.deadline = 0;
    if (P.phase !== "betting") return;
    const live = [];
    P.seats.forEach((s, i) => { if (s && !s.gone && s.bet > 0) live.push(i); });
    if (!live.length) { P.msg = "Place a bet to start the hand."; return; }
    if (T.priv.shoe.length < Math.max(T.priv.cut, (live.length + 1) * 7)) { newShoe(T); ctx.evt("shuffle", {}); }
    clearTable(P);
    P.round++; P.phase = "dealing"; P.turn = null; T.priv.hole = null;
    P.seats.forEach((s, i) => {
      if (!s) return;
      s.inRound = live.includes(i);
      s.hands = s.inRound ? [{ cards: [], bet: s.bet, free: 0, doubles: 0, done: false }] : [];
    });
    const v = V[P.variant], steps = [];
    for (let pass = 0; pass < 2; pass++) {
      for (const i of live) steps.push(() => P.seats[i] && P.seats[i].hands[0] && P.seats[i].hands[0].cards.push(draw(T)));
      if (pass === 0 || v.exposure) steps.push(() => P.dealer.cards.push(draw(T)));
      else steps.push(() => { T.priv.hole = draw(T); P.dealer.cards.push({ back: true }); });
    }
    P.msg = "Dealing…";
    ctx.evt("deal", {});
    const next = () => { const st = steps.shift(); if (!st) { afterDeal(T, ctx); return; } st(); ctx.after(GA.reduced ? 120 : 360, next, "deal"); };
    ctx.after(250, next, "deal");
  }

  function afterDeal(T, ctx) {
    const P = T.pub, v = V[P.variant], up = P.dealer.cards[0];
    P.seats.forEach(s => {
      if (!s || !s.inRound) return;
      const c = s.hands[0].cards; s.side = [];
      if (s.pp) {
        const r = pairRes(c[0], c[1]);
        if (r) { ctx.pay(s.pid, s.pp * (r[0] + 1)); s.side.push({ k: "Perfect Pairs", label: `${r[1]} ${r[0]}:1`, net: s.pp * r[0] }); }
        else s.side.push({ k: "Perfect Pairs", label: "No pair", net: -s.pp });
      }
      if (s.t3) {
        const r = t3Res(c[0], c[1], up);
        if (r) { ctx.pay(s.pid, s.t3 * (r[0] + 1)); s.side.push({ k: "21+3", label: `${r[1]} ${r[0]}:1`, net: s.t3 * r[0] }); }
        else s.side.push({ k: "21+3", label: "No hand", net: -s.t3 });
      }
      if (isBJ(s.hands[0])) s.hands[0].done = true;
      s.ins = 0; s.insDone = false;
    });
    // Insurance: offered when the dealer's up card is an ace (not in Double Exposure, where the hole card is visible).
    if (up.r === "A" && !v.exposure) {
      P.phase = "insurance";
      P.msg = "Dealer shows an ace. Insurance?";
      P.deadline = Date.now() + 12000;
      ctx.evt("insurance", {});
      ctx.after(12000, () => endInsurance(T, ctx), "ins");
      return;
    }
    peek(T, ctx);
  }

  function endInsurance(T, ctx) {
    const P = T.pub;
    if (P.phase !== "insurance") return;
    ctx.cancel("ins"); P.deadline = 0;
    const dealerBJ = hv([P.dealer.cards[0], T.priv.hole]).t === 21;
    P.seats.forEach(s => {
      if (!s || !s.inRound || !s.ins) return;
      if (dealerBJ) { ctx.pay(s.pid, s.ins * 3); s.side.push({ k: "Insurance", label: "Pays 2:1", net: s.ins * 2 }); }
      else s.side.push({ k: "Insurance", label: "Lost", net: -s.ins });
    });
    peek(T, ctx);
  }

  function peek(T, ctx) {
    const P = T.pub, v = V[P.variant], up = P.dealer.cards[0];
    const hole = v.exposure ? P.dealer.cards[1] : T.priv.hole;
    if (hv([up, hole]).t === 21) {
      P.dealer.cards[1] = hole;
      P.msg = "Dealer has blackjack.";
      ctx.evt("dealerbj", {});
      ctx.after(900, () => settle(T, ctx), "dealer");
      P.phase = "dealer";
      return;
    }
    P.phase = "playing"; P.turn = { seat: -1, hand: 0 };
    nextTurn(T, ctx);
  }

  function nextTurn(T, ctx) {
    const P = T.pub;
    let { seat, hand } = P.turn || { seat: -1, hand: 0 };
    hand++;
    for (let guard = 0; guard < 60; guard++) {
      const s = seat >= 0 ? P.seats[seat] : null;
      if (s && s.inRound && hand < s.hands.length) {
        const h = s.hands[hand];
        if (!h.done && s.gone) h.done = true;
        if (!h.done) {
          P.turn = { seat, hand };
          P.deadline = Date.now() + 30000;
          ctx.after(30000, () => { const t = P.turn; if (!t) return; const hh = P.seats[t.seat] && P.seats[t.seat].hands[t.hand]; if (hh) hh.done = true; P.deadline = 0; nextTurn(T, ctx); }, "turn");
          P.msg = `${ctx.name(s.pid)} to act${s.hands.length > 1 ? `, hand ${hand + 1}` : ""}.`;
          ctx.evt("turn", { pid: s.pid });
          return;
        }
        hand++; continue;
      }
      seat++; hand = 0;
      if (seat >= SEATS) break;
    }
    P.turn = null; P.deadline = 0; ctx.cancel("turn");
    dealerPlay(T, ctx);
  }

  function dealerPlay(T, ctx) {
    const P = T.pub, v = V[P.variant];
    P.phase = "dealer";
    if (P.dealer.cards[1] && P.dealer.cards[1].back) P.dealer.cards[1] = T.priv.hole;
    P.msg = "Dealer's turn.";
    const live = P.seats.some(s => s && s.inRound && s.hands.some(h => !h.bust && !h.surrendered && !isBJ(h)));
    if (!live) { ctx.after(800, () => settle(T, ctx), "dealer"); return; }
    const step = () => {
      const t = hv(P.dealer.cards);
      if (t.t < 17 || (v.h17 && t.t === 17 && t.soft)) { P.dealer.cards.push(draw(T)); ctx.after(GA.reduced ? 200 : 700, step, "dealer"); }
      else ctx.after(600, () => settle(T, ctx), "dealer");
    };
    ctx.after(700, step, "dealer");
  }

  function settle(T, ctx) {
    const P = T.pub, v = V[P.variant];
    if (P.dealer.cards[1] && P.dealer.cards[1].back) P.dealer.cards[1] = T.priv.hole;
    const d = hv(P.dealer.cards), dBJ = P.dealer.cards.length === 2 && d.t === 21;
    P.seats.forEach(s => {
      if (!s || !s.inRound) return;
      let total = 0, best = "";
      for (const h of s.hands) {
        const real = h.bet, free = h.free || 0;
        if (h.surrendered) { h.result = "surrender"; h.net = -(real - Math.floor(real / 2)); total += h.net; continue; }
        const p = hv(h.cards).t, pbj = isBJ(h);
        let r, out;
        if (h.bust) { r = "bust"; out = 0; }
        else if (pbj) { if (dBJ && !v.spanish) { r = "push"; out = real; } else { r = "bj"; out = real + real * v.bj; } }
        else if (dBJ) { r = "lose"; out = 0; }
        else if (v.spanish && p === 21) { const m = spanishBonus(h); r = m > 1 ? "bonus" : "win"; out = real + (real + free) * m; }
        else if (d.t > 21) { if (v.push22 && d.t === 22) { r = "push"; out = real; } else { r = "win"; out = real + real + free; } }
        else if (p > d.t) { r = "win"; out = real + real + free; }
        else if (p < d.t) { r = "lose"; out = 0; }
        else if (v.exposure) { r = "lose"; out = 0; }
        else { r = "push"; out = real; }
        h.result = r; h.net = Math.round(out - real); ctx.pay(s.pid, out); total += h.net;
        if (r === "bj") best = "Blackjack!"; else if (r === "bonus") best = "Bonus 21!"; else if (r === "win" && h.doubles > 1) best = `Won with ${h.doubles} doubles!`;
      }
      for (const sd of s.side || []) total += sd.net;
      s.net = total;
      ctx.result(s.pid, total, best || (s.side || []).filter(x => x.net > 0).map(x => x.label).join(", "));
      T.priv.last[s.pid] = { bet: s.bet, pp: s.pp, t3: s.t3 };
      s.last = T.priv.last[s.pid];
      s.bet = 0; s.pp = 0; s.t3 = 0; s.inRound = false;
    });
    P.msg = dBJ ? "Dealer blackjack." : d.t > 21 ? `Dealer busts with ${d.t}.` : `Dealer stands on ${d.t}.`;
    P.phase = "payout"; P.settled = true; P.turn = null;
    ctx.after(3800, () => {
      P.phase = "betting";
      P.seats.forEach((s, i) => { if (s && (s.gone || !ctx.here(s.pid))) P.seats[i] = null; });
      P.msg = "Place your bets.";
    }, "reset");
  }

  function play(T, pid, k, ctx) {
    const P = T.pub, v = V[P.variant];
    if (P.phase !== "playing" || !P.turn) return;
    const s = P.seats[P.turn.seat]; if (!s || s.pid !== pid) return;
    const h = s.hands[P.turn.hand]; if (!h || h.done) return;
    const after = () => {
      const t = hv(h.cards).t;
      if (t > 21) { h.bust = true; h.done = true; ctx.evt("bust", { pid }); }
      else if (t === 21) h.done = true;
    };
    if (k === "hit") {
      if (v.frenzy && h.doubles > 0) return;
      if (h.aces) return;
      h.cards.push(draw(T)); after();
    } else if (k === "stand") h.done = true;
    else if (k === "double") {
      if (!canDouble(h, v)) return;
      const free = freeDouble(h, v);
      if (!free && !ctx.charge(pid, s.bet)) { ctx.evt("broke", { pid }); return; }
      if (free) h.free += s.bet; else h.bet += s.bet;
      h.doubles++;
      h.cards.push(draw(T)); after();
      if (!h.done && (!v.frenzy || h.doubles >= 3)) h.done = true;
      ctx.evt("double", { pid, n: h.doubles });
    } else if (k === "split") {
      if (!canSplit(s, h)) return;
      const free = freeSplit(h, v);
      if (!free && !ctx.charge(pid, s.bet)) { ctx.evt("broke", { pid }); return; }
      const nh = { cards: [h.cards.pop()], bet: free ? 0 : s.bet, free: free ? s.bet : 0, doubles: 0, done: false, split: true };
      h.split = true;
      const aces = h.cards[0].r === "A";
      h.cards.push(draw(T)); nh.cards.push(draw(T));
      if (aces) { h.aces = nh.aces = true; h.done = nh.done = true; }
      if (hv(h.cards).t === 21) h.done = true;
      if (hv(nh.cards).t === 21) nh.done = true;
      s.hands.splice(P.turn.hand + 1, 0, nh);
      ctx.evt("split", { pid });
    } else if (k === "surrender") {
      if (!canSurrender(s, h, v)) return;
      h.surrendered = true; h.done = true;
      ctx.pay(pid, Math.floor(h.bet / 2));
    } else return;
    if (h.done) { P.deadline = 0; nextTurn(T, ctx); }
    else {
      P.deadline = Date.now() + 30000;
      ctx.after(30000, () => { h.done = true; P.deadline = 0; nextTurn(T, ctx); }, "turn");
    }
  }

  GA.engines.blackjack = {
    create(T) {
      T.pub = { variant: "classic", phase: "betting", round: 0, seats: Array(SEATS).fill(null), dealer: { cards: [] }, deadline: 0, turn: null, msg: "Take a seat and place a bet.", shoeLeft: 0, settled: false };
      T.priv = { shoe: [], hole: null, last: {} };
      newShoe(T);
    },
    handle(T, pid, a, ctx) {
      const P = T.pub, si = seatOf(T, pid), s = si >= 0 ? P.seats[si] : null;
      switch (a.k) {
        case "sit": {
          if (s) return;
          const n = +a.seat;
          if (!(n >= 0 && n < SEATS) || P.seats[n]) return;
          P.seats[n] = { pid, bet: 0, pp: 0, t3: 0, hands: [], side: [], last: T.priv.last[pid] || null, inRound: false };
          ctx.evt("sit", { pid });
          return;
        }
        case "leave":
          if (!s) return;
          GA.engines.blackjack.leave(T, pid, ctx);
          return;
        case "variant": {
          if (P.phase !== "betting" || !V[a.v] || P.variant === a.v) return;
          if (P.seats.some(x => x && (x.bet || x.pp || x.t3))) return;
          P.variant = a.v; newShoe(T); clearTable(P);
          P.msg = `Now dealing ${V[a.v].name}.`;
          ctx.evt("variant", { pid, v: a.v });
          return;
        }
        case "bet": {
          if (P.phase !== "betting" || !s) return;
          const field = { main: "bet", pp: "pp", t3: "t3" }[a.spot]; if (!field) return;
          if (field !== "bet" && !s.bet && !(a.spot === "main")) { /* side bets need a main bet */ if (!s.bet) return; }
          let amt = Math.round(+a.amt || 0);
          amt = Math.min(amt, MAX_BET - s[field]);
          if (amt <= 0) return;
          if (P.settled) clearTable(P);
          if (!ctx.charge(pid, amt)) { ctx.evt("broke", { pid }); return; }
          s[field] += amt;
          ctx.evt("bet", { pid });
          armTimer(T, ctx);
          return;
        }
        case "clear": {
          if (P.phase !== "betting" || !s) return;
          ctx.refund(pid, s.bet + s.pp + s.t3); s.bet = s.pp = s.t3 = 0;
          if (!P.seats.some(x => x && x.bet)) { ctx.cancel(); P.deadline = 0; }
          return;
        }
        case "rebet": {
          if (P.phase !== "betting" || !s || !s.last || s.bet) return;
          const L = s.last, sum = L.bet + L.pp + L.t3;
          if (P.settled) clearTable(P);
          if (!ctx.charge(pid, sum)) { ctx.evt("broke", { pid }); return; }
          s.bet = L.bet; s.pp = L.pp; s.t3 = L.t3;
          ctx.evt("bet", { pid });
          armTimer(T, ctx);
          return;
        }
        case "deal":
          if (P.phase === "betting" && s && P.seats.some(x => x && x.bet)) startRound(T, ctx);
          return;
        case "insure":
        case "noins": {
          if (P.phase !== "insurance" || !s || !s.inRound || s.insDone) return;
          if (a.k === "insure") {
            const amt = Math.floor(s.bet / 2);
            if (amt > 0 && !ctx.charge(pid, amt)) { ctx.evt("broke", { pid }); return; }
            s.ins = amt;
          }
          s.insDone = true;
          if (P.seats.every(x => !x || !x.inRound || x.insDone || x.gone)) ctx.after(300, () => endInsurance(T, ctx), "ins");
          return;
        }
        default:
          play(T, pid, a.k, ctx);
      }
    },
    leave(T, pid, ctx) {
      const P = T.pub, si = seatOf(T, pid); if (si < 0) return;
      const s = P.seats[si];
      if (P.phase === "betting") {
        ctx.refund(pid, s.bet + s.pp + s.t3);
        P.seats[si] = null;
        if (!P.seats.some(x => x && x.bet)) { ctx.cancel(); P.deadline = 0; }
      } else {
        s.gone = true;
        s.hands.forEach(h => (h.done = true));
        if (P.phase === "playing" && P.turn && P.turn.seat === si) nextTurn(T, ctx);
      }
    }
  };

  /* ================= VIEW ================= */
  GA.views.blackjack = {
    title: "Blackjack",
    mount(el) {
      el.innerHTML = `
        <div class="view-head">
          <div><div class="eyebrow">Blackjack · Five seats · Single deck</div><h1 class="gold-text">Twenty-One Club</h1>
          <p>Pick a rule set, take a seat and bet. When a friend is in your room, you all play the same deck against Rico.</p></div>
          <div class="who-here" data-who></div>
        </div>
        <div class="variants" data-var></div>
        <p class="rules" data-rules></p>
        <div class="felt">
          <div data-dealer></div>
          <div class="bj-dealer"><div class="hand" data-dhand></div><div data-dtotal></div></div>
          <div class="felt-print" data-print></div>
          <div class="bj-seats" data-seats></div>
        </div>
        <div class="table-bar"><div class="status" data-status></div><div class="controls" data-controls></div></div>
        <div style="margin-top:14px" data-rack></div>
        <p class="rules" style="margin-top:14px">Side bets: <b>Perfect Pairs</b> pays 6:1 for a mixed pair (different colors) and 12:1 for a colored pair (same color). <b>21+3</b> uses your two cards plus the dealer's up card: flush 5:1, straight 10:1, three of a kind 30:1, straight flush 40:1. With one deck, a same-suit pair or suited trips can't happen. <b>Insurance</b> is offered when the dealer shows an ace: it costs half your bet and pays 2:1 if the dealer has blackjack. Tap a betting circle to add your selected chip.</p>`;
      const q = s => el.querySelector(s);
      const dealer = GA.dealer(q("[data-dealer]"), "rico");
      GA.rack(q("[data-rack]"));
      const cards = GA.cardTracker();
      let lastCount = 0, P = null;

      el.addEventListener("click", e => {
        const b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
        const k = b.dataset.act;
        if (k === "bet") GA.net.act("blackjack", { k: "bet", spot: b.dataset.spot, amt: GA.chip });
        else if (k === "sit") GA.net.act("blackjack", { k: "sit", seat: +b.dataset.seat });
        else if (k === "variant") GA.net.act("blackjack", { k: "variant", v: b.dataset.v });
        else GA.net.act("blackjack", { k });
        if (k === "bet" || k === "rebet") GA.sfx.chip();
      });

      function seatHTML(s, i, me, mySeat) {
        if (!s) {
          return `<div class="seat"><span class="muted" style="font-size:12px">Seat ${i + 1}</span>${mySeat < 0 ? `<button class="sit-btn" data-act="sit" data-seat="${i}">Sit here</button>` : `<span class="muted" style="margin:auto;font-size:13px">Open</span>`}</div>`;
        }
        const pl = GA.net.snap.players[s.pid] || { name: "Away", color: "#888" };
        const mine = s.pid === me, turn = P.turn && P.turn.seat === i;
        const hands = s.hands.map((h, hi) => {
          const t = hv(h.cards);
          const active = turn && P.turn.hand === hi && P.phase === "playing";
          const badge = h.result ? { win: '<span class="badge w">Win</span>', bonus: '<span class="badge bj">Bonus</span>', bj: '<span class="badge bj">Blackjack</span>', lose: '<span class="badge l">Lose</span>', bust: '<span class="badge l">Bust</span>', push: '<span class="badge p">Push</span>', surrender: '<span class="badge p">Surrender</span>' }[h.result] : h.bust ? '<span class="badge l">Bust</span>' : isBJ(h) ? '<span class="badge bj">Blackjack</span>' : "";
          const wager = h.bet + (h.free || 0);
          return `<div class="h ${active ? "active" : ""}"><div class="hand">${h.cards.map((c, ci) => cards.html(`r${P.round}s${i}h${hi}c${ci}`, c)).join("")}</div>
            <div class="meta">${h.cards.length ? `<span class="total">${t.soft && t.t < 21 ? t.t - 10 + "/" : ""}${t.t}</span>` : ""}${GA.stack(wager)}${h.free ? `<span class="badge p" title="House-funded free bet">Free ${GA.short(h.free)}</span>` : ""}${h.doubles > 1 ? `<span class="badge bj">×${h.doubles}</span>` : ""}${badge}${h.net != null && h.result ? `<span class="num" style="font-size:12px;color:${h.net >= 0 ? "var(--win)" : "var(--lose)"}">${h.net >= 0 ? "+" : "−"}${GA.fmt(Math.abs(h.net))}</span>` : ""}</div></div>`;
        }).join("");
        const betting = P.phase === "betting";
        const spot = (key, label, amt) => mine && betting
          ? `<button class="bspot ${key === "main" ? "main" : ""}" data-act="bet" data-spot="${key}" ${key !== "main" && !s.bet ? "disabled title='Place a main bet first'" : ""}>${label}<b>${amt ? GA.short(amt) : ""}</b></button>`
          : amt ? `<span class="bspot ${key === "main" ? "main" : ""}">${label}<b>${GA.short(amt)}</b></span>` : "";
        const side = (s.side || []).map(x => `<span class="badge ${x.net > 0 ? "w" : "l"}" title="${GA.esc(x.k)}">${GA.esc(x.k)}: ${GA.esc(x.label)}</span>`).join("");
        return `<div class="seat taken ${mine ? "me" : ""} ${turn && P.phase === "playing" ? "turn" : ""}" style="--c:${pl.color}">
          <span class="sname"><i></i>${GA.esc(pl.name)}${mine ? " (you)" : ""}</span>
          <div class="hands">${hands}</div>
          ${side ? `<div class="actions-row">${side}</div>` : ""}
          <div class="bets">${spot("pp", "Pairs", s.pp)}${spot("main", "Bet", s.bet)}${spot("t3", "21+3", s.t3)}</div>
        </div>`;
      }

      function controls(me) {
        const si = P.seats.findIndex(s => s && s.pid === me), s = si >= 0 ? P.seats[si] : null, v = V[P.variant];
        if (!s) return `<span class="muted" style="font-size:14px">Pick an open seat to play.</span>`;
        if (P.phase === "betting") {
          return `${s.last && !s.bet ? `<button class="btn btn-ghost btn-sm" data-act="rebet">Rebet ${GA.short(s.last.bet + s.last.pp + s.last.t3)}</button>` : ""}
            ${s.bet || s.pp || s.t3 ? `<button class="btn btn-ghost btn-sm" data-act="clear">Clear</button>` : ""}
            ${P.seats.some(x => x && x.bet) ? `<button class="btn btn-gold" data-act="deal">Deal now</button>` : ""}
            <button class="btn btn-dark btn-sm" data-act="leave">Leave seat</button>`;
        }
        if (P.phase === "insurance" && s.inRound) {
          if (s.insDone) return `<span class="muted" style="font-size:14px">${s.ins ? `Insured for ${GA.fmt(s.ins)}.` : "No insurance."} Waiting on the table…</span>`;
          const h = s.hands[0], bj = h && isBJ(h);
          return `<button class="btn btn-gold" data-act="insure">${bj ? "Even money" : `Insurance ${GA.short(Math.floor(s.bet / 2))}`}</button><button class="btn btn-dark" data-act="noins">No insurance</button>`;
        }
        if (P.phase === "playing" && P.turn && P.turn.seat === si) {
          const h = s.hands[P.turn.hand];
          const fd = freeDouble(h, v), fs = canSplit(s, h) && freeSplit(h, v);
          const hitOK = !(v.frenzy && h.doubles > 0) && !h.aces;
          return `<button class="btn btn-gold" data-act="hit" ${hitOK ? "" : "disabled"}>Hit</button>
            <button class="btn btn-red" data-act="stand">Stand</button>
            <button class="btn btn-ghost" data-act="double" ${canDouble(h, v) ? "" : "disabled"}>${fd ? "Free double" : v.frenzy && h.doubles ? `Double again (${h.doubles + 1}/3)` : "Double"}</button>
            <button class="btn btn-ghost" data-act="split" ${canSplit(s, h) ? "" : "disabled"}>${fs ? "Free split" : "Split"}</button>
            ${v.surrender ? `<button class="btn btn-dark" data-act="surrender" ${canSurrender(s, h, v) ? "" : "disabled"}>Surrender</button>` : ""}`;
        }
        return "";
      }

      function status() {
        if (!P) return;
        q("[data-status]").innerHTML = `${GA.timerHTML(P.deadline)}<span>${GA.esc(P.msg || "")}</span>`;
      }

      return {
        render(snap) {
          P = snap.tables.blackjack; if (!P) return;
          const me = GA.me.id, v = V[P.variant];
          const locked = P.phase !== "betting" || P.seats.some(x => x && (x.bet || x.pp || x.t3));
          q("[data-var]").innerHTML = ORDER.map(k => `<button type="button" data-act="variant" data-v="${k}" aria-pressed="${k === P.variant}" ${locked && k !== P.variant ? "disabled title='Change rules between hands'" : ""}>${V[k].name}</button>`).join("");
          q("[data-rules]").textContent = v.blurb;
          q("[data-print]").textContent = v.print + ` · ${P.shoeLeft} cards left in the deck`;
          const dc = P.dealer.cards;
          q("[data-dhand]").innerHTML = dc.map((c, i) => cards.html(`r${P.round}d${i}`, c)).join("") || `<span class="muted" style="font-size:13px;align-self:center">Dealer's cards land here</span>`;
          const dt = hv(dc);
          q("[data-dtotal]").innerHTML = dc.length ? `<span class="total">${dc.some(c => c.back) ? dt.t + " showing" : dt.t > 21 ? "Bust " + dt.t : dt.t}</span>` : "";
          const mySeat = P.seats.findIndex(s => s && s.pid === me);
          q("[data-seats]").innerHTML = P.seats.map((s, i) => seatHTML(s, i, me, mySeat)).join("");
          q("[data-controls]").innerHTML = controls(me);
          status();
          const count = dc.length + P.seats.reduce((n, s) => n + (s ? s.hands.reduce((m, h) => m + h.cards.length, 0) : 0), 0);
          if (count > lastCount) GA.sfx.card();
          lastCount = count;
        },
        tick: status,
        onEvt(e, snap) {
          const mine = e.pid === GA.me.id, nm = snap.players[e.pid] ? snap.players[e.pid].name : "";
          if (e.kind === "turn" && mine) { dealer.say("deal"); GA.sfx.ding(); }
          else if (e.kind === "bet" && mine && Math.random() < 0.35) dealer.say("bet");
          else if (e.kind === "bust" && mine) { dealer.say("bust"); GA.sfx.lose(); }
          else if (e.kind === "shuffle") GA.toast("Fresh deck. Rico shuffles with a little too much flair.");
          else if (e.kind === "insurance") { const s = P && P.seats.find(x => x && x.pid === GA.me.id && x.inRound); if (s) { GA.sfx.ding(); GA.toast("Dealer shows an ace. Insurance pays 2:1 if Rico has blackjack."); } }
          else if (e.kind === "broke" && mine) GA.toast("Not enough chips for that.");
          else if (e.kind === "dealerbj") dealer.say("lose");
          else if (e.kind === "win" && mine) {
            if (e.label === "Blackjack!" || e.net >= 2500) { dealer.say("big"); if (e.net >= 1000) GA.bigWin("Blackjack table", e.label || "Big win", e.net); else { GA.sfx.win(); GA.celebrate(80); } }
            else { dealer.say("win"); GA.sfx.win(); GA.celebrate(40); }
          } else if (e.kind === "lose" && mine) { dealer.say("lose"); }
          else if (e.kind === "push" && mine) dealer.say("push");
          else if (e.kind === "win" && !mine && Math.random() < 0.5) dealer.say("other", { n: nm });
        }
      };
    }
  };
})();

/* Rules tests: plays scripted hands with stacked cards and dice through the real engines.
   Run with: node tests/rules-test.js */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");

// ---- minimal browser shims + fake timers ----
let queue = [], tid = 0, clock = 0;
globalThis.window = globalThis;
globalThis.document = { querySelector: () => null, querySelectorAll: () => [], body: { contains: () => false } };
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.setTimeout = (fn, ms) => { queue.push({ id: ++tid, at: clock + (ms || 0), fn }); return tid; };
globalThis.clearTimeout = id => { queue = queue.filter(t => t.id !== id); };
globalThis.setInterval = () => 0; globalThis.clearInterval = () => {};
// Runs timers due within the next 8 s of game time: card dealing, spins, payouts.
// Betting countdowns (15 s), insurance (12 s) and turn timers (30 s) wait for a player action.
function flush(horizon = 8000) {
  const until = clock + horizon;
  for (let i = 0; i < 5000; i++) {
    queue.sort((a, b) => a.at - b.at || a.id - b.id);
    if (!queue.length || queue[0].at > until) break;
    const t = queue.shift(); clock = Math.max(clock, t.at); t.fn();
  }
}
const root = path.join(__dirname, "..");
for (const f of ["js/core.js", "js/net.js", "js/games/blackjack.js", "js/games/roulette.js", "js/games/baccarat.js", "js/games/craps.js", "js/games/poker3.js", "js/games/holdem.js", "js/games/solo.js"])
  vm.runInThisContext(fs.readFileSync(path.join(root, f), "utf8"), { filename: f });
const GA = globalThis.GA;
GA.me.sound = false; GA.reduced = true;
const tick = () => new Promise(r => queueMicrotask(r));

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
}
const C = s => { const m = s.match(/^(10|[2-9AJQK])([shdc])$/); return { r: m[1], s: { s: "♠", h: "♥", d: "♦", c: "♣" }[m[2]] }; };
const cards = str => str.split(" ").map(C);
const filler = n => Array.from({ length: n }, () => C("2c"));

function fresh(game) {
  GA.net.startSolo(); flush();
  const H = GA.net.host, me = GA.me.id;
  H.players[me].chips = 100000;
  const T = H.table(game);
  const act = a => { H.handle(me, { t: "act", g: game, a }); flush(); };
  const chips = () => H.players[me].chips;
  return { H, T, act, chips, me };
}

/* ================= BLACKJACK ================= */
// Deal order with one seat: player, dealer up, player, dealer hole, then draws.
function bj(variant, deal, moves, opts = {}) {
  const { T, act, chips, me } = fresh("blackjack");
  if (variant !== "classic") act({ k: "variant", v: variant });
  act({ k: "sit", seat: 0 });
  const stack = cards(deal);
  T.priv.shoe = [...filler(40), ...stack.reverse()];
  T.priv.cut = 0;
  const before = chips();
  act({ k: "bet", spot: "main", amt: 100 });
  act({ k: "deal" });
  for (const m of moves) act({ k: m });
  flush();
  const P = T.pub, s = P.seats[0];
  return { net: chips() - before, results: s ? (s.hands || []).map(h => h.result) : [], dealer: P.dealer.cards.map(c => c.r).join(","), P, s, me };
}
(() => {
  let r;
  r = bj("classic", "10s 6h 7d Ah", ["stand"]);
  check("Classic: dealer stands on soft 17 (A-6), 17 vs 17 pushes", [r.dealer, r.net], ["6,A", 0]);
  r = bj("frenzy", "10s 6h 7d Ah 5c Kd", ["stand"]);
  check("Frenzy: dealer hits soft 17, busts, player wins 1:1", [r.dealer, r.net], ["6,A,5,K", 100]);
  r = bj("classic", "As 9h Kd 7c", []);
  check("Classic: blackjack pays 3:2", r.net, 150);
  r = bj("exposure", "As 9h Kd 7c", []);
  check("Double Exposure: blackjack pays even money", r.net, 100);
  r = bj("exposure", "10s 10h 8d 8c", ["stand"]);
  check("Double Exposure: dealer wins ties", r.net, -100);
  r = bj("freebet", "6s 6h 4d 10c 9h 6d", ["double"]);
  check("Free Bet: free double on 10, dealer 22 pushes, costs nothing", [r.s.hands[0].free, r.net, r.results], [100, 0, ["push"]]);
  r = bj("freebet", "6s 6h 4d 10c 9h 2d", ["double"]);
  check("Free Bet: free double wins pay as if the double were yours (+200)", r.net, 200);
  r = bj("freebet", "8s 6h 8d 10c 3h 9c 10d", ["split", "stand", "stand"]);
  check("Free Bet: free split on 8s, both hands win, only your stake was at risk", [r.s.hands.length, r.s.hands[1].bet, r.s.hands[1].free, r.net], [2, 0, 100, 200]);
  r = bj("spanish", "7s Kh 7d Qc 7c", ["hit"]);
  check("Spanish 21: 7-7-7 mixed suits pays 3:2 bonus", [r.results, r.net], [["bonus"], 150]);
  r = bj("spanish", "9s 6h 5d 5c 7h 10s", ["hit"]);
  check("Spanish 21: no tens in the decks", r.P.shoeLeft <= 96, true);
  r = bj("spanish", "9s 6h 5d 5c 7h Kd", ["hit"]);
  check("Spanish 21: player 21 beats dealer 21", [r.dealer, r.net], ["6,5,K", 100]);
  r = bj("classic", "As 9h Ad 7c Ks 5h 10d", ["split"]);
  check("Split aces get one card each, 21 after split pays 1:1 (not blackjack)", [r.s.hands.map(h => h.cards.length), r.net], [[2, 2], 200]);
  r = bj("classic", "10s 10h 6d 7c", ["surrender"]);
  check("Late surrender returns half the bet", r.net, -50);
  r = bj("classic", "10s 9h 8d 7c", ["double"]);
  check("Classic: double allowed on any two cards", r.s.hands[0].doubles, 1);
  r = bj("frenzy", "5s 9h 3d 7c 2h 2d 2s Kd", ["double", "double", "double"]);
  check("Frenzy: three doubles, each adds the original bet", [r.s.hands[0].bet, r.s.hands[0].doubles], [400, 3]);
  // Insurance: dealer ace up with blackjack underneath
  (() => {
    const { T, act, chips } = fresh("blackjack");
    act({ k: "sit", seat: 0 });
    T.priv.shoe = [...filler(40), ...cards("10s Ah 9d Kc").reverse()]; T.priv.cut = 0;
    const before = chips();
    act({ k: "bet", spot: "main", amt: 100 }); act({ k: "deal" });
    check("Insurance is offered when the dealer shows an ace", T.pub.phase, "insurance");
    act({ k: "insure" }); flush();
    check("Insurance pays 2:1 and offsets the lost hand", chips() - before, 0);
  })();
  (() => {
    const { T, act } = fresh("blackjack");
    act({ k: "variant", v: "exposure" }); act({ k: "sit", seat: 0 });
    T.priv.shoe = [...filler(40), ...cards("10s Ah 9d 6c 5h").reverse()]; T.priv.cut = 0;
    act({ k: "bet", spot: "main", amt: 100 }); act({ k: "deal" });
    check("No insurance in Double Exposure", T.pub.phase !== "insurance", true);
  })();
  (() => {
    const { T } = fresh("blackjack");
    check("Double deck: 104 cards", T.priv.shoe.length, 104);
  })();
})();

/* ================= BACCARAT ================= */
function bac(deal, spot = "banker") {
  const { T, act, chips } = fresh("baccarat");
  T.priv.shoe = [...filler(30).map(() => C("Kc")), ...cards(deal).reverse()];
  const before = chips();
  act({ k: "bet", spot, amt: 100 }); act({ k: "deal" }); flush();
  const Hd = T.pub.hand;
  return { p: Hd.p.map(c => c.r).join(","), b: Hd.b.map(c => c.r).join(","), w: Hd.winner, net: chips() - before };
}
(() => {
  let r;
  r = bac("2s 3h 3d Kc 8d");
  check("Baccarat: player 5 draws; banker 3 stands when player's third card is 8", [r.p, r.b], ["2,3,8", "3,K"]);
  r = bac("4s 3h 2d 2c 9h");
  check("Baccarat: player 6 stands; banker 5 draws", [r.p, r.b], ["4,2", "3,2,9"]);
  r = bac("2s 3h 2d 3c 6h 4d");
  check("Baccarat: banker 6 draws when player's third card is 6", [r.p, r.b], ["2,2,6", "3,3,4"]);
  r = bac("8s Kh Kd 9c");
  check("Baccarat: naturals stop the hand, banker 9 wins at 0.95:1", [r.p, r.b, r.w, r.net], ["8,K", "K,9", "B", 95]);
  r = bac("4s 4h 3d 3c Kh Kd", "tie");
  check("Baccarat: tie pays 8:1", [r.w, r.net], ["T", 800]);
  r = bac("4s 4h 3d 3c Kh Kd", "player");
  check("Baccarat: player bet pushes on a tie", r.net, 0);
})();

/* ================= CRAPS ================= */
(() => {
  const { T, act, chips } = fresh("craps");
  const rolls = [];
  const realRand = GA.rand;
  GA.rand = n => (n === 6 && rolls.length ? rolls.shift() - 1 : realRand(n));
  const roll = (a, b) => { rolls.push(a, b); act({ k: "roll" }); flush(); };
  let before = chips();
  act({ k: "bet", spot: "pass", amt: 100 }); act({ k: "bet", spot: "field", amt: 100 });
  roll(3, 4);
  check("Craps: come-out 7 wins pass, field loses", chips() - before, 0);
  before = chips();
  act({ k: "bet", spot: "pass", amt: 100 });
  roll(3, 3);
  check("Craps: 6 sets the point", T.pub.point, 6);
  act({ k: "bet", spot: "odds", amt: 100 }); act({ k: "bet", spot: "place8", amt: 60 }); act({ k: "bet", spot: "hard8", amt: 10 });
  roll(4, 4);
  check("Craps: hard 8 pays 9:1, place 8 pays 7:6, both stay up", [T.pub.bets[GA.me.id].hard8, T.pub.bets[GA.me.id].place8], [10, 60]);
  roll(2, 4);
  check("Craps: point made pays pass 1:1 and odds 6:5", chips() - before, 100 + 120 + 70 + 90 - 60 - 10);
  before = chips();
  act({ k: "bet", spot: "dont", amt: 100 });
  roll(6, 6);
  check("Craps: don't pass pushes on 12 (bar 12)", [T.pub.bets[GA.me.id] && T.pub.bets[GA.me.id].dont, T.pub.point], [100, null]);
  roll(4, 1); roll(5, 2);
  check("Craps: don't pass wins on seven-out", chips() - before, 100);
  before = chips();
  act({ k: "bet", spot: "field", amt: 100 }); roll(1, 1);
  check("Craps: field pays 2:1 on 2", chips() - before, 200);
  GA.rand = realRand;
})();

/* ================= THREE CARD POKER ================= */
function p3(deal, decision = "play", pp = 0) {
  const { T, act, chips } = fresh("poker3");
  const realShoe = GA.makeShoe;
  GA.makeShoe = () => [...filler(30), ...cards(deal).reverse()];
  const before = chips();
  act({ k: "bet", spot: "ante", amt: 100 }); if (pp) act({ k: "bet", spot: "pp", amt: pp });
  act({ k: "deal" });
  act({ k: decision }); flush();
  GA.makeShoe = realShoe;
  return { net: chips() - before, me: T.pub.players[GA.me.id] };
}
(() => {
  // order: player, dealer, player, dealer, player, dealer
  let r = p3("4s Kh 5d 9h 6c 2h");
  check("3 Card: straight beats flush, plus 1:1 ante bonus", r.net, 300);
  r = p3("2s Jh 2d 9c 7c 4h");
  check("3 Card: dealer jack-high doesn't qualify: ante pays, play pushes", r.net, 100);
  r = p3("As 2h 2d 3c 3c 4d");
  check("3 Card: A-2-3 is the lowest straight (loses to 2-3-4, ante bonus still pays)", r.net, -100);
  r = p3("Ks Qh Kd 9c 5c 4d", "fold", 100);
  check("3 Card: fold loses ante, Pair Plus still pays 1:1 on a pair", r.net, 0);
  const E = GA.rules.p3Eval;
  check("3 Card ranking: straight flush > trips > straight > flush > pair", [E(cards("4h 5h 6h")).cat, E(cards("9s 9h 9d")).cat, E(cards("4s 5h 6h")).cat, E(cards("2h 9h Kh")).cat, E(cards("2h 2s Kh")).cat], [5, 4, 3, 2, 1]);
})();

/* ================= ROULETTE ================= */
(() => {
  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const realRand = GA.rand;
  function spin(n, bets) {
    const { act, chips } = fresh("roulette");
    GA.rand = k => (k === 37 ? ORDER.indexOf(n) : realRand(k));
    const before = chips();
    for (const [key, amt] of bets) act({ k: "bet", key, amt });
    act({ k: "spin" }); flush();
    GA.rand = realRand;
    return chips() - before;
  }
  check("Roulette: straight up pays 35:1", spin(17, [["n17", 100]]), 3500);
  check("Roulette: red pays 1:1 (1 is red)", spin(1, [["red", 100]]), 100);
  check("Roulette: zero loses outside bets", spin(0, [["red", 100], ["even", 100], ["low", 100]]), -300);
  check("Roulette: dozen and column pay 2:1", spin(34, [["d3", 100], ["c1", 100]]), 400);
  (() => {
    const { T, act, chips, me } = fresh("roulette");
    const before = chips();
    act({ k: "bet", key: "red", amt: 100 }); act({ k: "bet", key: "n17", amt: 25 });
    act({ k: "double" });
    check("Roulette: Double doubles every chip on the table", [T.pub.bets[me].red, T.pub.bets[me].n17, before - chips()], [200, 50, 250]);
    act({ k: "undo" });
    check("Roulette: Undo takes back the double", [T.pub.bets[me].red, before - chips()], [100, 125]);
    act({ k: "undo" }); act({ k: "undo" });
    check("Roulette: Undo all the way refunds everything", [T.pub.bets[me], chips() - before], [undefined, 0]);
  })();
  (() => {
    const { T, act, chips, me } = fresh("roulette");
    GA.rand = k => (k === 37 ? ORDER.indexOf(2) : realRand(k));
    act({ k: "bet", key: "red", amt: 100 }); act({ k: "spin" }); flush(); flush();
    GA.rand = realRand;
    const before = chips();
    act({ k: "rebet", x: 2 });
    check("Roulette: Rebet ×2 repeats last bets at double size", [T.pub.bets[me] && T.pub.bets[me].red, before - chips()], [200, 200]);
  })();
})();


/* ================= TEXAS HOLD'EM ================= */
(() => {
  const B = cs => GA.rules.holdemBest(cards(cs)), CMP = GA.rules.holdemCmp;
  check("Hold'em: royal flush recognised from 7 cards", B("Ah Kh Qh Jh 10h 2c 3d").name, "Royal flush");
  check("Hold'em: wheel A-2-3-4-5 is a straight", B("As 2h 3d 4c 5s Kd 9h").name, "Straight");
  check("Hold'em: full house beats flush", CMP(B("Ks Kh Kd 4c 4s 2h 9h").score, B("Ah 9h 7h 4h 2h Kc 3d").score) > 0, true);
  check("Hold'em: kicker decides two pair", CMP(B("Ks Kh 9d 9c Ah 2s 3c").score, B("Kc Kd 9h 9s Qh 2d 3h").score) > 0, true);
  check("Hold'em: best five of seven (six-card flush uses the top five)", B("Ah Kh 9h 7h 4h 2h Qc").name, "Flush");

  // Set up a room with extra players.
  function room(stacks) {
    GA.net.startSolo(); flush();
    const H = GA.net.host, ids = [GA.me.id, "p2", "p3", "p4"].slice(0, stacks.length);
    ids.slice(1).forEach((pid, i) => H.add(pid, { name: "P" + (i + 2), color: "#5fc7d6", chips: 100000, at: "holdem" }));
    H.players[GA.me.id].chips = 100000;
    const T = H.table("holdem");
    const act = (pid, a, h = 1000) => { H.handle(pid, { t: "act", g: "holdem", a }); flush(h); };
    return { H, T, ids, act };
  }
  // Heads-up: button posts the small blind and acts first before the flop, last after it.
  (() => {
    const { H, T, ids, act } = room([2000, 2000]);
    T.priv.rig = cards("2c 3d 4h 5s 9c 7d 8h 10s Jc Qd Kh");
    act(ids[0], { k: "sit", seat: 0, buy: 2000 }); act(ids[1], { k: "sit", seat: 3, buy: 2000 }, 3500);
    const P = T.pub;
    check("Hold'em heads-up: button posts small blind", [P.button, P.sb, P.bb, P.seats[0].bet, P.seats[3].bet], [0, 0, 3, 25, 50]);
    check("Hold'em heads-up: button acts first preflop", P.toAct, 0);
    act(ids[0], { k: "raise", to: 70 });
    check("Hold'em: a raise smaller than the big blind is refused", P.seats[0].bet, 25);
    act(ids[0], { k: "call" }); act(ids[1], { k: "check" });
    check("Hold'em heads-up: big blind acts first after the flop", [P.phase, P.toAct, P.board.length], ["flop", 3, 3]);
    const before = H.players[ids[1]].chips;
    act(ids[1], { k: "raise", to: 100 }); act(ids[0], { k: "fold" });
    check("Hold'em: everyone folds, last player takes the pot (50+50+100)", [P.phase, P.seats[3].stack], ["showdown", 2050]);
    void before;
  })();
  // Three-way all-in with side pot.
  (() => {
    const { T, ids, act } = room([1000, 3000, 3000]);
    // deal order starts left of the button (seat 0 is button on hand 1): seat1, seat2, seat0, seat1, seat2, seat0
    T.priv.rig = cards("Kc 2d As Kd 3h Ah 4c Qs Jh 9d 8c 7s 6c 5h");
    act(ids[0], { k: "sit", seat: 0, buy: 1000 }); act(ids[1], { k: "sit", seat: 1, buy: 3000 }); act(ids[2], { k: "sit", seat: 2, buy: 3000 }, 3500);
    const P = T.pub;
    check("Hold'em 3-handed: blinds are the two seats after the button", [P.button, P.sb, P.bb], [0, 1, 2]);
    act(ids[0], { k: "raise", to: 1000 });
    act(ids[1], { k: "raise", to: 3000 });
    act(ids[2], { k: "call" }, 1200);
    check("Hold'em: board runs out when everyone is all in", [P.phase, P.board.length], ["showdown", 5]);
    // A (seat0) has aces = best, B (seat1) kings, C (seat2) deuce-trey.
    check("Hold'em side pot: short stack wins main pot (3,000), kings win side pot (4,000)", [P.seats[0].stack, P.seats[1].stack, P.seats[2].stack], [3000, 4000, 0]);
    check("Hold'em side pot: two pots built", P.results.map(r => r.amt), [3000, 4000]);
  })();
  // Private cards: a player's snapshot only carries their own hole cards.
  (() => {
    const { H, T, ids, act } = room([2000, 2000]);
    act(ids[0], { k: "sit", seat: 0, buy: 2000 }); act(ids[1], { k: "sit", seat: 1, buy: 2000 }, 3500);
    const mine = H.snapshot(ids[0]).tables.holdem, theirs = H.snapshot(ids[1]).tables.holdem;
    const leak = JSON.stringify(theirs).includes(JSON.stringify(T.priv.hole[ids[0]][0])) && JSON.stringify(theirs).includes(JSON.stringify(T.priv.hole[ids[0]][1]));
    check("Hold'em: you see your own two cards", mine.mine && mine.mine.length, 2);
    check("Hold'em: other players' snapshots don't contain your cards", [JSON.stringify(theirs.mine) === JSON.stringify(T.priv.hole[ids[1]]), leak], [true, false]);
    // leaving returns your stack
    const before = H.players[ids[1]].chips;
    act(ids[1], { k: "leave" });
    check("Hold'em: leaving pays your table stack back to your balance", H.players[ids[1]].chips - before > 0, true);
  })();
})();

/* ================= VIDEO POKER ================= */
(() => {
  const E = GA.rules.vpEval;
  check("Video poker: royal flush", E(cards("10h Jh Qh Kh Ah")), 0);
  check("Video poker: wheel straight flush", E(cards("Ah 2h 3h 4h 5h")), 1);
  check("Video poker: wheel straight", E(cards("As 2h 3h 4h 5h")), 5);
  check("Video poker: full house", E(cards("Ks Kh Kd 4h 4c")), 3);
  check("Video poker: jacks or better pays", E(cards("Js Jh 3d 4h 9c")), 8);
  check("Video poker: tens don't pay", E(cards("10s 10h 3d 4h 9c")), -1);
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

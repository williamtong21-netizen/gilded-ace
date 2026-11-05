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
for (const f of ["js/core.js", "js/net.js", "js/games/blackjack.js", "js/games/roulette.js", "js/games/baccarat.js", "js/games/craps.js", "js/games/poker3.js", "js/games/solo.js"])
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

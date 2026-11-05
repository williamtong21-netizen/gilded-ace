/* Gilded Ace dealers: illustrated hosts with moods, eyes that follow the pointer, and a lot of charm. */
(function () {
  "use strict";
  const GA = window.GA;

  const EYE = (x, lash) => `<g class="eye ${x < 100 ? "l" : "r"}"><ellipse cx="${x}" cy="88" rx="6.5" ry="5.2" fill="#fff8f0"/><g class="pupil"><circle cx="${x}" cy="88.4" r="3.9" fill="#2a1410"/><circle cx="${x}" cy="88.4" r="2" fill="#0a0506"/><circle cx="${x + 1.4}" cy="86.8" r="1.2" fill="#fff"/></g>${lash ? `<path d="M${x - 7.5} 86 Q${x} 79.5 ${x + 7.5} 85.5 L${x + 10} 82.5" stroke="#140808" stroke-width="2.4" fill="none" stroke-linecap="round"/>` : `<path d="M${x - 7} 85.5 Q${x} 81.5 ${x + 7} 85.5" stroke="#3a2016" stroke-width="1.4" fill="none" opacity=".6"/>`}</g>`;

  function face(o) {
    const lips = o.lips
      ? `<path class="mouth" d="M89 115.5 Q94.5 111.5 100 114 Q105.5 111.5 111 115.5 Q100 124 89 115.5Z" fill="${o.lips}"/>`
      : `<path class="mouth" d="M89 115 Q100 122 111 115" stroke="#6a2a1e" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    return `
      <ellipse cx="62" cy="96" rx="6" ry="9" fill="${o.skin}"/><ellipse cx="138" cy="96" rx="6" ry="9" fill="${o.skin}"/>
      <ellipse cx="100" cy="90" rx="38" ry="45" fill="${o.skin}"/>
      <ellipse cx="100" cy="128" rx="22" ry="6" fill="${o.shade}" opacity=".35"/>
      ${o.hairFront || ""}
      <path class="brow l" d="M78 ${o.browY || 75} Q86 ${(o.browY || 75) - 5} 94 ${(o.browY || 75) - 1}" stroke="${o.brow}" stroke-width="${o.browW || 3}" fill="none" stroke-linecap="round"/>
      <path class="brow r" d="M106 ${(o.browY || 75) - 1} Q114 ${(o.browY || 75) - 5} 122 ${o.browY || 75}" stroke="${o.brow}" stroke-width="${o.browW || 3}" fill="none" stroke-linecap="round"/>
      ${EYE(86, o.lash)}${EYE(114, o.lash)}
      ${o.shadow ? `<path d="M78 84 Q86 78 94 84" stroke="${o.shadow}" stroke-width="3" fill="none" opacity=".55"/><path d="M106 84 Q114 78 122 84" stroke="${o.shadow}" stroke-width="3" fill="none" opacity=".55"/>` : ""}
      <path d="M100 92 Q96.5 104 101 106.5" stroke="${o.shade}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <ellipse class="blush" cx="77" cy="104" rx="8" ry="4.5" fill="#ff5a7a"/><ellipse class="blush" cx="123" cy="104" rx="8" ry="4.5" fill="#ff5a7a"/>
      ${lips}
      <g class="mouth-alt"><path d="M87 112.5 Q100 131 113 112.5 Q100 118 87 112.5Z" fill="#5a1020"/><path d="M89.5 113.6 Q100 118.4 110.5 113.6 L109 116 Q100 119.6 91 116Z" fill="#fff"/></g>
      <ellipse class="mouth-o" cx="100" cy="117" rx="5" ry="6.5" fill="#5a1020"/>
      ${o.faceExtra || ""}`;
  }

  function svg(o) {
    return `<svg viewBox="0 0 200 220" aria-hidden="true"><g class="fig">${o.back || ""}
      <path d="M86 118 L86 152 Q100 162 114 152 L114 118Z" fill="${o.shade}"/>
      ${o.outfit}
      <g class="head">${o.hairBack || ""}${face(o)}${o.top || ""}</g></g></svg>`;
  }

  const shoulders = (fill) => `<path d="M24 222 C28 176 60 160 100 158 C140 160 172 176 176 222Z" fill="${fill}"/>`;

  const CHARS = {
    valentina: {
      name: "Valentina", title: "Croupier · Roulette",
      svg: svg({
        skin: "#e2ae86", shade: "#c08a64", brow: "#1c0f12", lash: true, lips: "#c8102e", shadow: "#7a2a4a",
        hairBack: `<ellipse cx="100" cy="82" rx="46" ry="52" fill="#1c0f12"/><circle cx="100" cy="34" r="21" fill="#1c0f12"/><path d="M60 92 Q50 130 64 150" stroke="#1c0f12" stroke-width="9" fill="none" stroke-linecap="round"/>`,
        hairFront: `<path d="M62 90 C58 50 90 36 114 42 C134 48 144 66 138 92 C134 70 118 56 98 58 C82 60 68 72 62 90Z" fill="#1c0f12"/><path d="M66 70 Q86 50 108 54" stroke="#3a2026" stroke-width="2" fill="none"/>`,
        top: `<circle cx="128" cy="46" r="9" fill="#c8102e"/><circle cx="128" cy="46" r="5" fill="#e2364f"/><path d="M122 52 l-6 6 M134 52 l6 4" stroke="#1f6b44" stroke-width="3"/>`,
        faceExtra: `<circle cx="121" cy="108" r="1.4" fill="#3a1a12"/><circle cx="62" cy="110" r="3.4" fill="#f8e7ad"/><circle cx="62" cy="118" r="4.4" fill="#d9b35d"/><circle cx="138" cy="110" r="3.4" fill="#f8e7ad"/><circle cx="138" cy="118" r="4.4" fill="#d9b35d"/>`,
        outfit: `${shoulders("#e2ae86")}<defs><pattern id="seq" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#a0102a"/><circle cx="3" cy="3" r="1.3" fill="#ff5a6e"/></pattern></defs>
          <path d="M40 222 C44 196 58 184 72 184 Q86 180 100 196 Q114 180 128 184 C142 184 156 196 160 222Z" fill="url(#seq)"/>
          <path d="M72 184 L70 160 M128 184 L130 160" stroke="#d9b35d" stroke-width="2"/>
          <path d="M84 146 Q100 166 116 146" stroke="#d9b35d" stroke-width="2" fill="none"/><path d="M100 160 l-4 -4 a3 3 0 0 1 4 -3 a3 3 0 0 1 4 3Z" fill="#c8102e"/>`
      }),
      lines: {
        greet: ["Bonsoir, {n}. Red or black tonight?", "Place your bets, darling. I keep the wheel warm for you.", "Ah, {n}. I was hoping you'd come back to my table."],
        bet: ["Mm, bold choice, {n}.", "I like a player who knows what they want.", "Careful, chéri. I can see your hands shaking."],
        spin: ["Rien ne va plus.", "No more bets. Hold your breath for me.", "Round and round she goes…"],
        win: ["Magnifique! Come collect, darling.", "The wheel adores you. So do I, a little.", "{n} wins. Don't spend it all on me. Or do."],
        lose: ["Oh, chéri. The wheel is such a tease.", "Don't pout, {n}. It's cute, but don't.", "Next spin is yours. I can feel it."],
        big: ["Straight up! Somebody fan me.", "Oh là là! Twenty years at this wheel and I'm blushing."],
        other: ["Lucky night for {n}.", "{n} is on fire. Is anyone else warm in here?"],
        poke: ["Tap me again and I'll have to call security. Or not.", "I only spin for the gorgeous ones. You qualify.", "Flattery gets you nowhere. Tips, perhaps.", "Is that a full stack in your pocket, or are you happy to see me?"],
        tip: ["Merci, {n}. For that, a kiss for luck. Mwah.", "Generous and gorgeous. Dangerous combination.", "You do know how to treat a lady."]
      }
    },
    rico: {
      name: "Rico", title: "Dealer · Blackjack",
      svg: svg({
        skin: "#b97a52", shade: "#93593a", brow: "#120c0c", browW: 4, browY: 74,
        hairBack: `<ellipse cx="100" cy="76" rx="41" ry="40" fill="#120c0c"/>`,
        hairFront: `<path d="M62 84 C58 46 92 32 120 38 C138 44 144 62 138 84 C134 64 122 54 100 54 C86 54 72 62 62 84Z" fill="#120c0c"/><path d="M74 54 C88 30 124 30 136 52 C120 44 98 44 74 54Z" fill="#1e1616"/>`,
        faceExtra: `<path d="M66 100 Q70 134 100 138 Q130 134 134 100 Q130 126 100 130 Q70 126 66 100Z" fill="#000" opacity=".16"/><path d="M88 110 Q100 104 112 110 Q100 108.5 88 110Z" fill="#120c0c"/>
          <g transform="rotate(14 142 70)"><rect x="134" y="54" width="16" height="22" rx="2" fill="#fffdf7" stroke="#d9b35d" stroke-width="1"/><text x="142" y="69" font-size="10" text-anchor="middle" fill="#c8102e" font-family="serif">A♥</text></g>`,
        outfit: `${shoulders("#1a1013")}<path d="M84 152 L100 198 L116 152Z" fill="#f3eee4"/><path d="M92 152 L100 170 L108 152" fill="#b97a52"/>
          <path d="M84 152 L100 204 L74 222 L44 222 C50 188 64 168 84 152Z" fill="#44111f"/><path d="M116 152 L100 204 L126 222 L156 222 C150 188 136 168 116 152Z" fill="#44111f"/>
          <path d="M84 152 L100 204 M116 152 L100 204" stroke="#d9b35d" stroke-width="1.6"/>
          <path d="M94 160 Q86 176 90 190 M106 160 Q114 176 110 190" stroke="#0a0506" stroke-width="3" fill="none" stroke-linecap="round"/>`
      }),
      lines: {
        greet: ["Rico. Cards, charm and questionable decisions. Sit down, {n}.", "Welcome back, {n}. I saved your favorite seat. It's the one next to me.", "Pull up a stool, gorgeous. The shoe is hot."],
        bet: ["Chips on the felt. That's how I like it.", "Brave. I like brave.", "Look at you, {n}. All in on yourself."],
        deal: ["Cards coming your way, beautiful.", "Let's see what the shoe thinks of you.", "Easy now. Don't let me see you sweat."],
        win: ["Winner winner. Rico pays with a wink.", "That's how it's done, {n}.", "Beat me fair and square. I kind of liked it."],
        lose: ["Ooh. The cards are cold, but you're not.", "House wins this one. Don't hate me, I'm too pretty.", "Shake it off, {n}. Next hand."],
        big: ["Blackjack! Somebody get this high roller a drink.", "Now THAT is a double down. I'm impressed. And a little flustered."],
        bust: ["Twenty-two. Too much of a good thing, {n}.", "Busted. Happens to the best of us. Mostly to you, tonight."],
        push: ["A tie. We'll call it chemistry.", "Push. Neither of us wanted to leave."],
        other: ["{n} is playing like a shark tonight.", "Nice hand, {n}. Everyone else, take notes."],
        poke: ["Stop staring, {n}. I'm working.", "This vest? Tailored. The smolder? Natural.", "I deal cards. You deal heartbreak.", "You can hit me. Hit your hand first though."],
        tip: ["For you, I'd shuffle anything.", "{n}, you know how to treat a dealer.", "A tip! Rico's blushing. That never happens."]
      }
    },
    celeste: {
      name: "Celeste", title: "Hostess · Baccarat",
      svg: svg({
        skin: "#f3d2bc", shade: "#d9a98c", brow: "#b8a27e", lash: true, lips: "#b8325a", shadow: "#6a6a9a",
        hairBack: `<path d="M56 96 C50 50 78 34 100 34 C124 34 152 50 144 96 L148 132 Q130 126 124 116 L76 116 Q70 126 52 132Z" fill="#efe2b8"/>`,
        hairFront: `<path d="M60 96 C58 54 84 40 104 42 C128 44 146 60 140 96 C130 70 114 58 100 66 C90 58 72 66 60 96Z" fill="#f8ecc8"/><path d="M100 46 Q94 66 72 80" stroke="#d9c690" stroke-width="2" fill="none"/>`,
        faceExtra: `<path d="M78 85 L70 81 M122 85 L130 81" stroke="#140808" stroke-width="2.2" stroke-linecap="round"/>`,
        outfit: `${shoulders("#f3d2bc")}<path d="M34 222 C40 194 60 182 76 186 L100 214 L124 186 C140 182 160 194 166 222Z" fill="#cfc4b0"/><path d="M76 186 L100 214 L124 186" stroke="#f8ecc8" stroke-width="2" fill="none"/>
          <path d="M80 148 Q100 172 120 148" stroke="#fffdf7" stroke-width="5" stroke-dasharray="0.1 7" stroke-linecap="round" fill="none"/>`
      }),
      lines: {
        greet: ["Good evening, {n}. Player, banker, or something more daring?", "Baccarat is a game of elegance. You'll fit right in.", "Champagne is on the house. Your losses are not."],
        bet: ["Exquisite choice.", "Banker? Player? Either way, you look marvelous doing it.", "A wager with class, {n}."],
        deal: ["Cards, please. Slowly. I like the suspense.", "Squeeze it, darling. It's tradition."],
        win: ["Natural elegance, {n}. And natural winnings.", "Lovely. Shall I pour you another?", "You win. I knew you had taste."],
        lose: ["The cards were rude to you. I'll have a word.", "A tiny setback for someone so fabulous.", "Ah, the banker is greedy tonight."],
        big: ["A tie! Eight to one! I may need to sit down.", "Pairs! How positively thrilling."],
        push: ["A tie on the hand. How romantic."],
        other: ["{n} has impeccable instincts.", "Bravo, {n}."],
        poke: ["Darling, I'm a professional. Mostly.", "These pearls? A gift from a very lucky gentleman.", "You have a nice smile, {n}. Bet with it.", "Please, call me Celeste. Everyone does, eventually."],
        tip: ["How generous. I'll remember that.", "Merci, {n}. You're officially my favorite.", "A tip! You may kiss my hand."]
      }
    },
    monty: {
      name: "Monty", title: "Stickman · Craps",
      svg: svg({
        skin: "#efc2a2", shade: "#cf9a78", brow: "#d8d2ca", browW: 4.5,
        hairBack: `<ellipse cx="64" cy="88" rx="10" ry="16" fill="#d8d2ca"/><ellipse cx="136" cy="88" rx="10" ry="16" fill="#d8d2ca"/>`,
        hairFront: `<path d="M66 70 Q100 46 134 70 Q118 60 100 60 Q82 60 66 70Z" fill="#d8d2ca"/>`,
        top: `<path d="M54 66 Q100 40 146 66 L150 74 Q100 58 50 74Z" fill="#1f7a4d"/><path d="M48 72 Q100 54 152 72 Q154 86 100 82 Q46 86 48 72Z" fill="#2fa36b" opacity=".75"/>`,
        faceExtra: `<circle cx="86" cy="88" r="11" stroke="#d9b35d" stroke-width="2.4" fill="#ffffff10"/><circle cx="114" cy="88" r="11" stroke="#d9b35d" stroke-width="2.4" fill="#ffffff10"/><path d="M97 88 h6" stroke="#d9b35d" stroke-width="2.4"/>
          <path d="M80 112 Q90 104 100 109 Q110 104 120 112 Q126 118 130 112 Q124 124 114 116 Q106 112 100 114 Q94 112 86 116 Q76 124 70 112 Q74 118 80 112Z" fill="#e8e2da"/>
          <path d="M140 82 l12 -14" stroke="#f2c230" stroke-width="4" stroke-linecap="round"/><path d="M152 68 l3 -3" stroke="#f06a8f" stroke-width="4" stroke-linecap="round"/>`,
        outfit: `${shoulders("#f3eee4")}<path d="M24 222 C28 180 54 166 80 162 L100 212 L120 162 C146 166 172 180 176 222Z" fill="#6d2c8f"/>
          <circle cx="100" cy="190" r="2.6" fill="#d9b35d"/><circle cx="100" cy="204" r="2.6" fill="#d9b35d"/><path d="M90 158 L100 164 L110 158 L110 170 L100 164 L90 170Z" fill="#c8102e"/>`
      }),
      lines: {
        greet: ["Monty's the name, dice are the game. Silver fox, golden arm.", "Step up, {n}. Coming out!", "Welcome to the loudest table in the house."],
        bet: ["Chips down! Monty approves.", "Bold bet. My second wife liked bold.", "That's a bet with some swagger, {n}."],
        roll: ["Dice are out! Hands up high!", "Shooter's got the cubes. Give 'em some love.", "Blow on 'em, {n}. Monty won't judge."],
        win: ["Winner! Pay the line!", "Yo-leven! Monty's heart skips a beat.", "Hot dice, hot shooter. Hotter player."],
        lose: ["Seven out, line away. Monty's sorry, sweetheart.", "Craps! Don't worry, I'll be gentle with the paperwork.", "The dice giveth, the dice taketh."],
        big: ["HARDWAY! Somebody hold me.", "Look at that payout! These glasses are fogging up."],
        other: ["{n} is rolling like a legend.", "Take a bow, {n}."],
        poke: ["These glasses? Reading. These eyes? Smoldering.", "Silver fox, golden heart, green visor.", "Careful, {n}. I bruise like a peach and blush like one too.", "I've been stickman for 40 years. Still got the moves."],
        tip: ["A tip! Monty blushes. Monty never blushes.", "Bless you, {n}. Dinner's on you, the next one's on me.", "You're a class act. A classy, classy act."]
      }
    },
    jade: {
      name: "Jade", title: "Dealer · Three Card Poker",
      svg: svg({
        skin: "#8d5a3b", shade: "#6c4129", brow: "#120a08", lash: true, lips: "#8a2846", shadow: "#2e6b52",
        hairBack: `<ellipse cx="100" cy="80" rx="42" ry="46" fill="#120a08"/><path d="M128 40 Q170 70 150 150 Q146 120 132 96Z" fill="#120a08"/>`,
        hairFront: `<path d="M60 92 C56 48 92 34 118 40 C138 46 146 66 140 92 C134 62 112 54 92 58 C76 62 64 74 60 92Z" fill="#120a08"/><circle cx="128" cy="42" r="6" fill="#d9b35d"/>`,
        faceExtra: `<circle cx="62" cy="114" r="6.5" stroke="#d9b35d" stroke-width="2.4" fill="none"/><circle cx="138" cy="114" r="6.5" stroke="#d9b35d" stroke-width="2.4" fill="none"/>`,
        outfit: `${shoulders("#8d5a3b")}<path d="M40 222 C44 196 60 182 80 180 L150 168 C160 186 164 204 166 222Z" fill="#11664a"/><path d="M80 180 L150 168" stroke="#d9b35d" stroke-width="2.4"/>`
      }),
      lines: {
        greet: ["Ante up, {n}. Let's see if you're as good as you look.", "Three cards. One chance. No crying at my table.", "Hey, {n}. You came back. They always do."],
        bet: ["Confident. I respect that.", "Pair Plus too? Living dangerously, {n}.", "Chips down. Poker face on."],
        deal: ["Three for you, three for me. Don't peek.", "Cards in the air, darling."],
        win: ["You got me. Don't let it go to your head.", "Nice hand, {n}. I'll admit it. Once.", "Winner. You can stop smirking now."],
        lose: ["Dealer takes it. Better luck, sugar.", "Mine's bigger. Hand, I mean.", "Oof. Fold or not, you look good doing it."],
        big: ["Straight flush?! Okay, you've got my attention.", "Trips! I might need your number. For the tax form."],
        other: ["{n} came to play.", "Watch out for {n}. That one's trouble."],
        poke: ["You keep tapping me, {n}. Want something?", "My poker face is famous. My other faces are private.", "Ask me nicely and I might deal you a pair.", "Emerald suits me, right? Say yes."],
        tip: ["Mm. Generous AND good-looking.", "Thanks, {n}. That's going straight to my shoe fund.", "Keep that up and I'll smile. Maybe."]
      }
    }
  };
  GA.DEALERS = CHARS;

  const all = [];
  let lastPt = null;
  addEventListener("pointermove", e => {
    lastPt = { x: e.clientX, y: e.clientY };
    if (!GA._eyeRaf) GA._eyeRaf = requestAnimationFrame(() => { GA._eyeRaf = 0; all.forEach(d => d.look(lastPt)); });
  }, { passive: true });

  GA.dealer = (el, id) => {
    const C = CHARS[id];
    el.classList.add("dealer");
    el.innerHTML = `<button type="button" class="dealer-portrait" aria-label="Talk to ${C.name}">${C.svg}</button>
      <div class="dealer-info">
        <div class="dealer-name"><b>${C.name}</b><span>${C.title}</span></div>
        <div class="bubble" aria-live="polite"></div>
        <div class="dealer-actions"><button type="button" data-a="chat">Flirt</button><button type="button" data-a="tip">Tip 25</button><small class="tips"></small></div>
      </div>`;
    const portrait = el.querySelector(".dealer-portrait"), fig = el.querySelector("svg"), bubble = el.querySelector(".bubble"), tipsEl = el.querySelector(".tips");
    let last = "", typeT = 0, moodT = 0, tips = GA.store.get("tips." + id, 0);
    const showTips = () => { tipsEl.textContent = tips ? `Tipped ${GA.fmt(tips * 25)}` : ""; };
    showTips();
    const api = {
      el,
      say(kind, vars = {}) {
        const pool = C.lines[kind] || C.lines.poke;
        let line = GA.pick(pool);
        if (pool.length > 1) for (let i = 0; i < 4 && line === last; i++) line = GA.pick(pool);
        last = line;
        const text = line.replace(/\{n\}/g, vars.n || GA.me.name);
        clearInterval(typeT);
        if (GA.reduced) bubble.textContent = text;
        else {
          let i = 0; bubble.textContent = "";
          typeT = setInterval(() => { bubble.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(typeT); }, 18);
        }
        const moods = { win: "grin blushing", big: "gasp blushing", lose: "tilt", bust: "gasp", poke: "wink blushing tilt", tip: "grin blushing wink", bet: "wink", greet: "grin", other: "grin", push: "tilt", deal: "wink", spin: "", roll: "grin" };
        api.mood(moods[kind] || "");
        if (kind === "big") setTimeout(() => api.mood("grin blushing"), 900);
      },
      mood(m) {
        fig.classList.remove("grin", "gasp", "wink", "blushing", "tilt");
        clearTimeout(moodT);
        if (!m) return;
        m.split(" ").forEach(c => c && fig.classList.add(c));
        moodT = setTimeout(() => fig.classList.remove("grin", "gasp", "wink", "blushing", "tilt"), 2600);
      },
      look(pt) {
        const r = portrait.getBoundingClientRect();
        if (!r.width) return;
        const cx = r.left + r.width / 2, cy = r.top + r.height * 0.4;
        const dx = pt.x - cx, dy = pt.y - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 300);
        const tx = (dx / d) * 2.4 * k, ty = (dy / d) * 1.8 * k;
        fig.querySelectorAll(".pupil").forEach(p => p.setAttribute("transform", `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`));
      },
      kiss() {
        if (GA.reduced) return;
        const r = portrait.getBoundingClientRect();
        for (let i = 0; i < 3; i++) {
          const k = document.createElement("span");
          k.className = "kiss"; k.textContent = "♥";
          k.style.left = r.left + r.width / 2 - 12 + "px"; k.style.top = r.top + r.height * 0.5 + "px";
          k.style.setProperty("--dx", (Math.random() * 120 - 60).toFixed(0) + "px"); k.style.animationDelay = i * 0.15 + "s";
          document.body.appendChild(k); setTimeout(() => k.remove(), 2000);
        }
      }
    };
    portrait.addEventListener("click", () => { api.say("poke"); GA.sfx.pop(); });
    el.querySelector('[data-a="chat"]').addEventListener("click", () => { api.say("poke"); GA.sfx.pop(); });
    el.querySelector('[data-a="tip"]').addEventListener("click", () => {
      if (!GA.wallet.can(25)) { GA.toast("You need 25 chips to tip."); return; }
      GA.wallet.adjust(-25, "tip:" + C.name);
      tips++; GA.store.set("tips." + id, tips); showTips();
      api.say("tip"); api.kiss(); GA.sfx.coin();
    });
    // blinking
    (function blink() {
      setTimeout(() => {
        if (!document.body.contains(el)) return;
        fig.classList.add("blink"); setTimeout(() => fig.classList.remove("blink"), 140);
        blink();
      }, 2200 + Math.random() * 3800);
    })();
    all.push(api);
    if (lastPt) api.look(lastPt);
    api.say("greet");
    return api;
  };
  GA.dealerFace = id => CHARS[id].svg;
})();

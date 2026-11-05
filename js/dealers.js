/* Gilded Ace dealers: illustrated hosts in evening wear, with shading, makeup, moods,
   eyes that follow the pointer, hair flips, blown kisses and a lot of charm. */
(function () {
  "use strict";
  const GA = window.GA;
  let UID = 0;

  /* ---------- Shared drawing pieces ---------- */
  function defs(o, u) {
    const [sl, sb, ss] = o.skin, [hh, hb, hd] = o.hair, [lb, ld] = o.lips;
    return `<defs>
      <radialGradient id="${u}sk" cx="46%" cy="34%" r="72%"><stop offset="0" stop-color="${sl}"/><stop offset=".55" stop-color="${sb}"/><stop offset="1" stop-color="${ss}"/></radialGradient>
      <linearGradient id="${u}nk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ss}"/><stop offset=".45" stop-color="${sb}"/><stop offset="1" stop-color="${sl}"/></linearGradient>
      <radialGradient id="${u}ch" cx="50%" cy="20%" r="90%"><stop offset="0" stop-color="${sl}"/><stop offset=".6" stop-color="${sb}"/><stop offset="1" stop-color="${ss}"/></radialGradient>
      <linearGradient id="${u}hr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hh}"/><stop offset=".35" stop-color="${hb}"/><stop offset="1" stop-color="${hd}"/></linearGradient>
      <radialGradient id="${u}ir" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="${o.iris[0]}"/><stop offset="1" stop-color="${o.iris[1]}"/></radialGradient>
      <linearGradient id="${u}lp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lb}"/><stop offset="1" stop-color="${ld}"/></linearGradient>
      <radialGradient id="${u}bl" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${o.blush || "#ff6b8a"}" stop-opacity=".7"/><stop offset="1" stop-color="${o.blush || "#ff6b8a"}" stop-opacity="0"/></radialGradient>
      <linearGradient id="${u}es" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${o.shadow || ss}" stop-opacity=".85"/><stop offset="1" stop-color="${o.shadow || ss}" stop-opacity="0"/></linearGradient>
      <linearGradient id="${u}au" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".4" stop-color="#e2bd66"/><stop offset=".7" stop-color="#9c7630"/><stop offset="1" stop-color="#f8e7ad"/></linearGradient>
      <radialGradient id="${u}spot" cx="50%" cy="28%" r="70%"><stop offset="0" stop-color="${o.bg || "#5a1a2c"}"/><stop offset="1" stop-color="#120509"/></radialGradient>
      <clipPath id="${u}cl"><path d="${almond(85)}"/></clipPath><clipPath id="${u}cr"><path d="${almond(115)}"/></clipPath>
      ${o.defs ? o.defs(u) : ""}
    </defs>`;
  }
  const almond = x => `M${x - 9.5} 90 Q${x - 2} 82.6 ${x + 9.5} 89.4 Q${x + 1} 96 ${x - 9.5} 90Z`;

  function eye(o, u, x, side) {
    const s = side; // -1 left, +1 right (outward)
    const wing = o.wing ? `<path d="M${x + s * 9} 89.2 Q${x + s * 12} 87.4 ${x + s * 14.5} 84.6 Q${x + s * 11.5} 88.8 ${x + s * 8.6} 90.6Z" fill="#120808"/>` : "";
    const lashes = o.lash ? [0.62, 0.8, 0.95].map(t => {
      const px = x + (t - 0.5) * 19 * (s > 0 ? 1 : -1);
      const py = 90 - Math.sin(Math.PI * t) * 7.2;
      return `<path d="M${px.toFixed(1)} ${(py + 0.4).toFixed(1)} q${(s * (0.8 + t * 1.2)).toFixed(1)} -1.6 ${(s * (1.6 + t * 1.6)).toFixed(1)} -2.4" stroke="#120808" stroke-width="1" fill="none" stroke-linecap="round" opacity=".85"/>`;
    }).join("") : "";
    return `<g class="eye ${s < 0 ? "l" : "r"}">
      ${o.shadow ? `<path d="M${x - 11} 89 Q${x} 74 ${x + 11} 88 Q${x} 81 ${x - 11} 89Z" fill="url(#${u}es)" opacity=".9"/>` : ""}
      <path d="${almond(x)}" fill="#fbf4ee"/>
      <g clip-path="url(#${u}c${s < 0 ? "l" : "r"})"><g class="pupil">
        <circle cx="${x}" cy="89.6" r="4.9" fill="url(#${u}ir)"/><circle cx="${x}" cy="89.6" r="4.9" fill="none" stroke="#0a0506" stroke-width=".8" opacity=".6"/>
        <circle cx="${x}" cy="89.6" r="2.2" fill="#070304"/><circle cx="${x + 1.6}" cy="87.9" r="1.3" fill="#fff"/><circle cx="${x - 1.4}" cy="91.2" r=".6" fill="#fff" opacity=".8"/>
      </g><path d="M${x - 10} 86 Q${x} 82 ${x + 10} 86 L${x + 10} 88 Q${x} 85 ${x - 10} 88Z" fill="#000" opacity=".12"/></g>
      <path d="M${x - 9.5} 90 Q${x - 2} 82.6 ${x + 9.5} 89.4" stroke="#140909" stroke-width="${o.wing ? 2.2 : 1.4}" fill="none" stroke-linecap="round"/>
      <path d="M${x - 8.5} 91 Q${x + 1} 95.6 ${x + 9} 90" stroke="${o.skin[2]}" stroke-width=".9" fill="none" opacity=".8"/>
      ${wing}${lashes}
      <path d="M${x - 8} 83.6 Q${x} 79.4 ${x + 9} 83" stroke="${o.skin[2]}" stroke-width="1" fill="none" opacity=".55"/>
    </g>`;
  }
  function brow(o, x, side) {
    const s = side, t = o.browW || 1;
    const inner = x - s * 9, outer = x + s * 11, y = o.browY || 78;
    return `<path class="brow ${s < 0 ? "l" : "r"}" d="M${inner} ${y + 1.5} Q${x - s * 1} ${y - 4.5 * t} ${outer} ${y - 1} Q${x} ${y - 2.2 * t} ${inner} ${y + 3.4 * t}Z" fill="${o.browC}"/>`;
  }
  function lips(o, u) {
    if (o.male) return `<g class="mouth"><path d="M90 119 Q95 116.4 100 117.6 Q105 116.4 110 119 Q100 120 90 119Z" fill="url(#${u}lp)" opacity=".85"/><path d="M90.4 119.2 Q100 121 109.6 119.2 Q105 124 100 124.2 Q95 124 90.4 119.2Z" fill="url(#${u}lp)" opacity=".75"/><path d="M89.5 119 Q100 121.2 110.5 118.6" stroke="#3a1610" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M110.5 118.6 q2 -1 3 -2.6" stroke="#3a1610" stroke-width="1" fill="none" stroke-linecap="round"/></g>`;
    return `<g class="mouth"><path d="M88.5 118.6 Q93.4 114 97.6 115.4 Q100 114.4 102.4 115.4 Q106.6 114 111.5 118.6 Q100 120.2 88.5 118.6Z" fill="url(#${u}lp)"/>
      <path d="M89 118.9 Q100 120.6 111 118.9 Q106.4 126.6 100 126.9 Q93.6 126.6 89 118.9Z" fill="url(#${u}lp)"/>
      <path d="M88.5 118.6 Q100 121 111.5 118.6" stroke="${o.lips[1]}" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".9"/>
      <ellipse cx="100.6" cy="122.6" rx="4.6" ry="1.3" fill="#fff" opacity=".5"/><ellipse cx="96" cy="116.6" rx="1.8" ry=".6" fill="#fff" opacity=".35"/></g>`;
  }
  function mouths(o, u) {
    return `<g class="mouth-alt"><path d="M87.5 117 Q100 133 112.5 117 Q100 120.6 87.5 117Z" fill="#4a0f1a"/><path d="M89.6 117.8 Q100 121.6 110.4 117.8 L109.2 120.2 Q100 123.2 90.8 120.2Z" fill="#fffaf2"/>
        <path d="M87.5 117 Q100 120.6 112.5 117" stroke="${o.male ? o.skin[2] : o.lips[0]}" stroke-width="${o.male ? 1.2 : 2.2}" fill="none" stroke-linecap="round"/><path d="M87.5 117 Q100 133 112.5 117" stroke="${o.male ? o.skin[2] : o.lips[0]}" stroke-width="${o.male ? 1.2 : 2.6}" fill="none" stroke-linecap="round"/></g>
      <g class="mouth-o"><ellipse cx="100" cy="121" rx="5" ry="6" fill="#3a0a14"/><ellipse cx="100" cy="121" rx="5" ry="6" fill="none" stroke="${o.male ? o.skin[2] : `url(#${u}lp)`}" stroke-width="${o.male ? 1.4 : 3}"/></g>
      <g class="mouth-k"><path d="M96 118 Q100 115 104 118 Q106.5 121.5 104 124.4 Q100 127 96 124.4 Q93.5 121.5 96 118Z" fill="${o.male ? o.skin[2] : `url(#${u}lp)`}"/><path d="M96.5 121.4 h7" stroke="#3a0a14" stroke-width="1" stroke-linecap="round"/><ellipse cx="101.4" cy="123.4" rx="1.6" ry=".7" fill="#fff" opacity=".5"/></g>`;
  }

  function portrait(o) {
    const u = "d" + ++UID + "-";
    const jaw = o.male
      ? "M61 88 C61 50 79 41 100 41 C121 41 139 50 139 88 C139 114 127 136 100 141 C73 136 61 114 61 88Z"
      : "M63 88 C63 52 80 43 100 43 C120 43 137 52 137 88 C137 112 123 133 100 139 C77 133 63 112 63 88Z";
    return `<svg viewBox="0 0 200 220" aria-hidden="true">${defs(o, u)}
      <rect width="200" height="220" fill="url(#${u}spot)"/>
      <g class="fig">
        ${o.behind ? o.behind(u) : ""}
        <path d="M84 120 L84 156 Q100 168 116 156 L116 120Z" fill="url(#${u}nk)"/>
        <path d="M84 132 Q100 146 116 132 L116 140 Q100 152 84 140Z" fill="${o.skin[2]}" opacity=".45"/>
        ${o.outfit(u)}
        <g class="head">
          <g class="hair">${o.hairBack(u)}</g>
          <ellipse cx="62.5" cy="98" rx="6" ry="9.5" fill="url(#${u}sk)"/><ellipse cx="137.5" cy="98" rx="6" ry="9.5" fill="url(#${u}sk)"/>
          <path d="M62 94 q2.4 4 1 8 M138 94 q-2.4 4 -1 8" stroke="${o.skin[2]}" stroke-width="1.2" fill="none" opacity=".6"/>
          <path d="${jaw}" fill="url(#${u}sk)"/>
          <ellipse cx="73" cy="110" rx="9" ry="13" fill="${o.skin[2]}" opacity=".16"/><ellipse cx="127" cy="110" rx="9" ry="13" fill="${o.skin[2]}" opacity=".16"/>
          <ellipse cx="81" cy="101" rx="7" ry="3.6" fill="#fff" opacity=".13"/><ellipse cx="119" cy="101" rx="7" ry="3.6" fill="#fff" opacity=".13"/>
          ${o.male ? "" : `<ellipse cx="78" cy="106" rx="10" ry="6" fill="url(#${u}bl)" opacity=".55"/><ellipse cx="122" cy="106" rx="10" ry="6" fill="url(#${u}bl)" opacity=".55"/>`}
          <ellipse class="blush" cx="78" cy="106" rx="11" ry="6.5" fill="url(#${u}bl)"/><ellipse class="blush" cx="122" cy="106" rx="11" ry="6.5" fill="url(#${u}bl)"/>
          ${o.faceUnder ? o.faceUnder(u) : ""}
          ${brow(o, 85, -1)}${brow(o, 115, 1)}
          ${eye(o, u, 85, -1)}${eye(o, u, 115, 1)}
          <path d="M98.4 93 Q95.6 106 97.2 110" stroke="${o.skin[2]}" stroke-width="1.6" fill="none" opacity=".55" stroke-linecap="round"/>
          <path d="M101.2 92 L101.8 105" stroke="#fff" stroke-width="2" opacity=".18" stroke-linecap="round"/>
          <path d="M95 110.6 Q97.2 112.6 100 111.6 Q102.8 112.6 105 110.6" stroke="${o.skin[2]}" stroke-width="1.3" fill="none" opacity=".75" stroke-linecap="round"/>
          ${lips(o, u)}${mouths(o, u)}
          ${o.faceOver ? o.faceOver(u) : ""}
          <g class="hair">${o.hairFront(u)}</g>
          ${o.top ? o.top(u) : ""}
        </g>
      </g></svg>`;
  }
  const bareShoulders = u => `<path d="M22 222 C26 178 56 160 100 158 C144 160 174 178 178 222Z" fill="url(#${u}ch)"/>
    <path d="M70 168 Q84 172 94 168 M106 168 Q116 172 130 168" stroke="#000" stroke-width="1.2" fill="none" opacity=".12" stroke-linecap="round"/>`;
  const earring = (u, x, y, gem) => `<path d="M${x} ${y} v6" stroke="url(#${u}au)" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="2" fill="url(#${u}au)"/>${gem ? `<path d="M${x} ${y + 6} l4 5 -4 7 -4 -7Z" fill="${gem}"/><path d="M${x - 1} ${y + 9} l1.4 -2" stroke="#fff" stroke-width=".8" opacity=".8"/>` : ""}`;

  /* ---------- The cast ---------- */
  const CHARS = {
    valentina: {
      name: "Valentina", title: "Croupier · Roulette",
      look: {
        skin: ["#f6d2b2", "#e0a982", "#b97a54"], hair: ["#5a3a44", "#1c0f12", "#060304"], iris: ["#8a5a2a", "#3a200c"],
        lips: ["#e01535", "#8a0820"], shadow: "#7a2346", blush: "#ff5c7a", wing: true, lash: true, browC: "#1c0f12", browW: 1.1, bg: "#6a1426",
        defs: u => `<pattern id="${u}sq" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#9c0d26"/><circle cx="2.5" cy="2.5" r="1.4" fill="#e2304e"/><circle cx="2" cy="2" r=".5" fill="#ffd0d8"/></pattern>
          <linearGradient id="${u}sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".45" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient>`,
        hairBack: u => `<path d="M54 100 C44 54 74 24 104 26 C136 28 158 56 148 102 C144 126 134 142 126 148 L74 148 C64 140 56 122 54 100Z" fill="url(#${u}hr)"/>
          <ellipse cx="130" cy="38" rx="21" ry="17" fill="url(#${u}hr)"/><path d="M114 34 C122 24 140 24 148 36 M116 44 C126 38 140 40 146 46" stroke="#6a4a54" stroke-width="1.6" fill="none" opacity=".7"/>`,
        hairFront: u => `<path d="M61 96 C56 62 74 40 100 38 C126 37 143 54 141 82 C135 64 122 55 108 57 C96 59 89 68 83 80 C77 72 68 78 64 92Z" fill="url(#${u}hr)"/>
          <path d="M64 84 C52 100 56 120 66 130 C72 137 70 146 62 152" stroke="url(#${u}hr)" stroke-width="11" fill="none" stroke-linecap="round"/>
          <path d="M70 68 C80 54 98 48 118 50 M66 80 C72 66 84 60 96 60 M58 102 C56 114 60 124 67 132" stroke="#8a6a74" stroke-width="1.8" fill="none" opacity=".55" stroke-linecap="round"/>`,
        top: u => `<g transform="translate(136 50)"><circle r="10" fill="#b0102c"/><path d="M-6 -3 Q0 -10 6 -3 Q0 2 -6 -3Z" fill="#e2304e"/><path d="M-4 3 Q0 -2 4 3 Q0 6 -4 3Z" fill="#7a0618"/><path d="M-9 6 l-7 6 M2 9 l2 8" stroke="#1f6b44" stroke-width="3" stroke-linecap="round"/></g>${earring(u, 62.5, 106, "#c8102e")}${earring(u, 137.5, 106, "#c8102e")}`,
        faceOver: () => `<circle cx="121" cy="112" r="1.3" fill="#3a1a12"/>`,
        outfit: u => `${bareShoulders(u)}<path d="M36 222 C40 196 54 184 70 184 C82 183 92 185 100 186 C108 185 118 183 130 184 C146 184 160 196 164 222Z" fill="url(#${u}sq)"/>
          <path d="M36 222 C40 196 54 184 70 184 C82 183 92 185 100 186 C108 185 118 183 130 184 C146 184 160 196 164 222Z" fill="url(#${u}sh)"/>
          <path d="M70 184 C82 183 92 185 100 186 C108 185 118 183 130 184" stroke="#ff8aa0" stroke-width="1.4" fill="none" opacity=".7"/>
          <path d="M82 152 Q100 172 118 152" stroke="url(#${u}au)" stroke-width="1.8" fill="none"/><path d="M100 164 l-4 -4 a3 3 0 0 1 4 -3.4 a3 3 0 0 1 4 3.4Z" fill="#c8102e" stroke="url(#${u}au)" stroke-width=".8"/>`
      },
      lines: {
        greet: ["Bonsoir, {n}. Red or black tonight?", "Place your bets, darling. I've been keeping the wheel warm for you.", "Ah, {n}. I was hoping you'd come back to my table."],
        bet: ["Mm, bold choice, {n}.", "I like a player who knows exactly what they want.", "Careful, chéri. I can see your hands shaking. Or is that me?"],
        spin: ["Rien ne va plus.", "No more bets. Hold your breath for me.", "Round and round she goes. Watch her, not me."],
        win: ["Magnifique! Come collect, darling.", "The wheel adores you. So do I, a little.", "{n} wins. Spend it on something pretty. Like me."],
        lose: ["Oh, chéri. The wheel is such a tease.", "Don't pout, {n}. It's cute, but don't.", "Next spin is yours. I can feel it."],
        big: ["Straight up! Somebody fan me.", "Oh là là! Twenty years at this wheel and I'm blushing."],
        other: ["Lucky night for {n}.", "{n} is on fire. Is anyone else warm in here?"],
        poke: ["Tap me again and I'll have to call security. Or not.", "I only spin for the gorgeous ones. You qualify.", "Flattery gets you nowhere. Tips, perhaps.", "Is that a full stack in your pocket, or are you happy to see me?", "You're staring, darling. Keep going."],
        tip: ["Merci, {n}. For that, a kiss for luck. Mwah.", "Generous and gorgeous. Dangerous combination.", "You do know how to treat a lady."]
      }
    },
    rico: {
      name: "Rico", title: "Dealer · Blackjack",
      look: {
        male: true, skin: ["#dca47a", "#b67a4f", "#86502e"], hair: ["#4a3630", "#16100f", "#040202"], iris: ["#6a4220", "#24140a"],
        lips: ["#a86450", "#6e3a2a"], browC: "#140c0b", browW: 1.5, browY: 77, bg: "#3c0c1c",
        defs: u => `<pattern id="${u}stb" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".55" fill="#1a0e0a"/><circle cx="2.4" cy="2.2" r=".45" fill="#1a0e0a"/></pattern>
          <linearGradient id="${u}vel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1a20"/><stop offset=".5" stop-color="#0e0709"/><stop offset="1" stop-color="#1e1216"/></linearGradient>
          <linearGradient id="${u}sat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a1428"/><stop offset=".5" stop-color="#b0304e"/><stop offset="1" stop-color="#5a1428"/></linearGradient>`,
        hairBack: u => `<path d="M60 92 C56 52 78 32 102 32 C126 32 146 50 140 92 C136 76 132 66 124 62 L76 62 C68 68 62 78 60 92Z" fill="url(#${u}hr)"/>`,
        hairFront: u => `<path d="M62 84 C58 46 90 30 120 36 C140 42 146 62 139 84 C134 64 122 54 104 53 C86 52 72 62 62 84Z" fill="url(#${u}hr)"/>
          <path d="M72 56 C84 28 126 26 140 50 C126 40 102 38 72 56Z" fill="url(#${u}hr)"/>
          <path d="M80 50 C94 36 118 34 132 44 M76 58 C90 46 110 44 124 50" stroke="#7a5a50" stroke-width="1.6" fill="none" opacity=".6" stroke-linecap="round"/>`,
        faceUnder: u => `<path d="M66 102 Q70 134 100 140 Q130 134 134 102 Q128 126 100 131 Q72 126 66 102Z" fill="url(#${u}stb)" opacity=".55"/><path d="M88 112 Q100 108 112 112 L112 116 Q100 113 88 116Z" fill="url(#${u}stb)" opacity=".6"/>`,
        top: u => `<g transform="rotate(16 144 70)"><rect x="135" y="52" width="17" height="24" rx="2" fill="#fffdf7" stroke="url(#${u}au)" stroke-width="1"/><text x="143.5" y="68" font-size="10" text-anchor="middle" fill="#c8102e" font-family="serif">A♥</text></g>`,
        outfit: u => `<path d="M22 222 C26 178 58 160 100 158 C142 160 174 178 178 222Z" fill="url(#${u}vel)"/>
          <path d="M84 152 L100 200 L116 152Z" fill="#f6f1e8"/><path d="M90 152 L100 174 L110 152Z" fill="url(#${u}nk)"/><path d="M95 160 L100 172 L105 160" stroke="${"#86502e"}" stroke-width="1" fill="none" opacity=".4"/>
          <path d="M84 152 L100 206 L74 222 L42 222 C48 188 62 166 84 152Z" fill="url(#${u}sat)"/><path d="M116 152 L100 206 L126 222 L158 222 C152 188 138 166 116 152Z" fill="url(#${u}sat)"/>
          <path d="M84 152 L100 206 M116 152 L100 206" stroke="url(#${u}au)" stroke-width="1.4"/>
          <path d="M93 160 Q86 178 90 192 M107 160 Q114 178 110 192" stroke="#0a0506" stroke-width="3.2" fill="none" stroke-linecap="round"/>
          <path d="M140 186 l8 -4 4 8 -9 3Z" fill="#c8102e"/>`
      },
      lines: {
        greet: ["Rico. Cards, charm and questionable decisions. Sit down, {n}.", "Welcome back, {n}. I saved your favorite seat. It's the one next to me.", "Pull up a stool, gorgeous. The shoe is hot. So's the dealer."],
        bet: ["Chips on the felt. That's how I like it.", "Brave. I like brave.", "Look at you, {n}. All in on yourself."],
        deal: ["Cards coming your way, beautiful.", "Let's see what the shoe thinks of you.", "Easy now. Don't let me see you sweat."],
        win: ["Winner winner. Rico pays with a wink.", "That's how it's done, {n}.", "Beat me fair and square. I kind of liked it."],
        lose: ["Ooh. The cards are cold, but you're not.", "House wins this one. Don't hate me, I'm too pretty.", "Shake it off, {n}. Next hand."],
        big: ["Blackjack! Somebody get this high roller a drink.", "Now THAT is a double down. I'm impressed. And a little flustered."],
        bust: ["Twenty-two. Too much of a good thing, {n}.", "Busted. Happens to the best of us. Mostly to you, tonight."],
        push: ["A tie. We'll call it chemistry.", "Push. Neither of us wanted to leave."],
        other: ["{n} is playing like a shark tonight.", "Nice hand, {n}. Everyone else, take notes."],
        poke: ["Stop staring, {n}. I'm working.", "This jacket? Tailored. The smolder? Natural.", "I deal cards. You deal heartbreak.", "You can hit me. Hit your hand first though.", "Keep looking at me like that and I'll forget how to count to 21."],
        tip: ["For you, I'd shuffle anything.", "{n}, you know how to treat a dealer.", "A tip! Rico's blushing. That never happens."]
      }
    },
    celeste: {
      name: "Celeste", title: "Hostess · Baccarat",
      look: {
        skin: ["#fff0e4", "#f2cfb8", "#d29f84"], hair: ["#fffcee", "#efdca6", "#b89a5c"], iris: ["#8cc0ec", "#2c5a8a"],
        lips: ["#d44a74", "#8a1f44"], shadow: "#8a7ab8", blush: "#ff8aa8", wing: true, lash: true, browC: "#b39468", browW: 1, bg: "#1e3a5a",
        defs: u => `<linearGradient id="${u}sat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4dc"/><stop offset=".35" stop-color="#d9c6a0"/><stop offset=".6" stop-color="#f6e9cc"/><stop offset="1" stop-color="#a8926a"/></linearGradient>`,
        hairBack: u => `<path d="M54 98 C48 50 76 30 100 30 C126 30 154 50 146 98 L150 136 Q132 132 124 120 L76 120 Q68 132 50 136Z" fill="url(#${u}hr)"/>`,
        hairFront: u => `<path d="M58 100 C56 56 84 38 106 40 C130 42 148 60 142 100 C134 72 118 60 104 66 C92 56 72 66 62 98Z" fill="url(#${u}hr)"/>
          <path d="M104 42 C96 60 82 70 66 78 M60 104 C56 116 54 126 52 134 M140 100 C144 114 146 124 148 134" stroke="#fffdf4" stroke-width="2" fill="none" opacity=".7" stroke-linecap="round"/>
          <path d="M70 60 C80 50 94 46 104 46" stroke="#c4a666" stroke-width="1.4" fill="none" opacity=".6"/>`,
        top: u => `<circle cx="62.5" cy="108" r="2.6" fill="#fff"/><path d="M62.5 104 v8 M58.5 108 h8" stroke="#fff" stroke-width=".8" opacity=".8"/><circle cx="137.5" cy="108" r="2.6" fill="#fff"/><path d="M137.5 104 v8 M133.5 108 h8" stroke="#fff" stroke-width=".8" opacity=".8"/>`,
        outfit: u => `${bareShoulders(u)}<path d="M30 222 C36 194 58 182 76 186 Q100 194 124 186 C142 182 164 194 170 222Z" fill="url(#${u}sat)"/>
          <path d="M76 186 L72 160 M124 186 L128 160" stroke="#f6e9cc" stroke-width="1.6"/>
          <path d="M80 150 Q100 172 120 150" stroke="#fffdf7" stroke-width="4.4" stroke-dasharray="0.1 6.4" stroke-linecap="round" fill="none"/>
          <path d="M84 156 Q100 180 116 156" stroke="#fffdf7" stroke-width="3.8" stroke-dasharray="0.1 6" stroke-linecap="round" fill="none"/>`
      },
      lines: {
        greet: ["Good evening, {n}. Player, Banker, or something more daring?", "Baccarat is a game of elegance. You'll fit right in.", "Champagne is on the house. Your losses are not."],
        bet: ["Exquisite choice.", "Banker? Player? Either way, you look marvelous doing it.", "A wager with class, {n}."],
        deal: ["Cards, please. Slowly. I like the suspense.", "Squeeze it, darling. It's tradition."],
        win: ["Natural elegance, {n}. And natural winnings.", "Lovely. Shall I pour you another?", "You win. I knew you had taste."],
        lose: ["The cards were rude to you. I'll have a word.", "A tiny setback for someone so fabulous.", "Ah, the Banker is greedy tonight."],
        big: ["A tie! Eight to one! I may need to sit down.", "Pairs! How positively thrilling."],
        push: ["A tie on the hand. How romantic."],
        other: ["{n} has impeccable instincts.", "Bravo, {n}."],
        poke: ["Darling, I'm a professional. Mostly.", "These pearls? A gift from a very lucky gentleman.", "You have a lovely smile, {n}. Bet with it.", "Please, call me Celeste. Everyone does, eventually.", "If you keep flirting, I'll have to start flirting back."],
        tip: ["How generous. I'll remember that.", "Merci, {n}. You're officially my favorite.", "A tip! You may kiss my hand."]
      }
    },
    monty: {
      name: "Monty", title: "Stickman · Craps",
      look: {
        male: true, skin: ["#f6d2b6", "#e6b190", "#bf8664"], hair: ["#ffffff", "#d6d0c8", "#9a948c"], iris: ["#8ab07a", "#3a5a2a"],
        lips: ["#c0806a", "#8a5040"], browC: "#e6e0d8", browW: 1.7, browY: 77, bg: "#14402c",
        defs: u => `<linearGradient id="${u}vel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a3aa8"/><stop offset=".5" stop-color="#4a1a60"/><stop offset="1" stop-color="#6a2a86"/></linearGradient>`,
        hairBack: u => `<ellipse cx="63" cy="88" rx="11" ry="18" fill="url(#${u}hr)"/><ellipse cx="137" cy="88" rx="11" ry="18" fill="url(#${u}hr)"/>`,
        hairFront: u => `<path d="M64 74 Q100 46 136 74 Q120 60 100 60 Q80 60 64 74Z" fill="url(#${u}hr)"/><path d="M58 84 q4 8 2 16 M142 84 q-4 8 -2 16" stroke="#fff" stroke-width="1.6" opacity=".6" fill="none"/>`,
        faceOver: u => `<path d="M72 92 l-5 2 M72 96 l-5 1 M128 92 l5 2 M128 96 l5 1" stroke="#bf8664" stroke-width="1" opacity=".7"/>
          <circle cx="85" cy="89" r="12" stroke="url(#${u}au)" stroke-width="2.4" fill="#ffffff14"/><circle cx="115" cy="89" r="12" stroke="url(#${u}au)" stroke-width="2.4" fill="#ffffff14"/><path d="M97 88 h6 M73 88 l-10 -2 M127 88 l10 -2" stroke="url(#${u}au)" stroke-width="2.2"/>
          <path d="M79 113 Q90 105 100 110 Q110 105 121 113 Q128 119 133 112 Q127 126 115 118 Q107 113 100 115 Q93 113 85 118 Q73 126 67 112 Q72 119 79 113Z" fill="url(#${u}hr)"/>
          <path d="M141 82 l12 -15" stroke="#f2c230" stroke-width="4" stroke-linecap="round"/><path d="M153 67 l3 -3.4" stroke="#f06a8f" stroke-width="4" stroke-linecap="round"/>`,
        top: () => `<path d="M52 68 Q100 40 148 68 L152 76 Q100 59 48 76Z" fill="#1f7a4d"/><path d="M46 74 Q100 54 154 74 Q156 88 100 84 Q44 88 46 74Z" fill="#33b878" opacity=".7"/><path d="M50 76 Q100 60 150 76" stroke="#bff0d4" stroke-width="1" opacity=".6" fill="none"/>`,
        outfit: u => `<path d="M22 222 C26 178 58 160 100 158 C142 160 174 178 178 222Z" fill="#f6f1e8"/><path d="M60 170 v52 M80 164 v58 M120 164 v58 M140 170 v52" stroke="#c8d4e8" stroke-width="1.2"/>
          <path d="M22 222 C26 182 52 168 80 162 L100 214 L120 162 C148 168 174 182 178 222Z" fill="url(#${u}vel)"/>
          <circle cx="100" cy="190" r="2.6" fill="url(#${u}au)"/><circle cx="100" cy="204" r="2.6" fill="url(#${u}au)"/><path d="M88 158 L100 165 L112 158 L112 172 L100 165 L88 172Z" fill="#c8102e"/><circle cx="100" cy="165" r="2.4" fill="#8a0a20"/>`
      },
      lines: {
        greet: ["Monty's the name, dice are the game. Silver fox, golden arm.", "Step up, {n}. Coming out!", "Welcome to the loudest table in the house."],
        bet: ["Chips down! Monty approves.", "Bold bet. My second wife liked bold.", "That's a bet with some swagger, {n}."],
        roll: ["Dice are out! Hands up high!", "Shooter's got the cubes. Give 'em some love.", "Blow on 'em, {n}. Monty won't judge."],
        win: ["Winner! Pay the line!", "Yo-leven! Monty's heart skips a beat.", "Hot dice, hot shooter. Hotter player."],
        lose: ["Seven out, line away. Monty's sorry, sweetheart.", "Craps! Don't worry, I'll be gentle with the paperwork.", "The dice giveth, the dice taketh."],
        big: ["HARDWAY! Somebody hold me.", "Look at that payout! These glasses are fogging up."],
        other: ["{n} is rolling like a legend.", "Take a bow, {n}."],
        poke: ["These glasses? Reading. These eyes? Smoldering.", "Silver fox, golden heart, green visor.", "Careful, {n}. I bruise like a peach and blush like one too.", "I've been stickman for 40 years. Still got the moves.", "Wink at me again and I'm telling my book club."],
        tip: ["A tip! Monty blushes. Monty never blushes.", "Bless you, {n}. Dinner's on you, the next one's on me.", "You're a class act. A classy, classy act."]
      }
    },
    jade: {
      name: "Jade", title: "Dealer · Three Card Poker",
      look: {
        skin: ["#c08a64", "#8d5a3b", "#5e361f"], hair: ["#5a4440", "#120a08", "#030101"], iris: ["#7a4a24", "#2a1408"],
        lips: ["#b0345e", "#5a1028"], shadow: "#1f8a5e", blush: "#d0506a", wing: true, lash: true, browC: "#120a08", browW: 1.1, bg: "#0f4a36",
        defs: u => `<linearGradient id="${u}sat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1fa070"/><stop offset=".45" stop-color="#0c5a3e"/><stop offset=".7" stop-color="#18885e"/><stop offset="1" stop-color="#063a28"/></linearGradient>`,
        hairBack: u => `<ellipse cx="100" cy="80" rx="42" ry="46" fill="url(#${u}hr)"/><path d="M126 40 Q176 64 160 140 Q156 168 146 186 Q150 150 140 120 Q134 100 126 86Z" fill="url(#${u}hr)"/><path d="M138 54 Q164 82 154 140" stroke="#7a6460" stroke-width="2" fill="none" opacity=".55"/>`,
        hairFront: u => `<path d="M60 94 C56 48 92 34 118 40 C138 46 146 66 140 94 C134 62 112 54 92 58 C76 62 64 76 60 94Z" fill="url(#${u}hr)"/><path d="M72 62 C86 48 108 44 128 50" stroke="#7a6460" stroke-width="1.8" fill="none" opacity=".55" stroke-linecap="round"/>
          <ellipse cx="128" cy="42" rx="7" ry="5" fill="url(#${u}au)"/>`,
        top: u => `<circle cx="62.5" cy="116" r="7" stroke="url(#${u}au)" stroke-width="2.4" fill="none"/><circle cx="137.5" cy="116" r="7" stroke="url(#${u}au)" stroke-width="2.4" fill="none"/>`,
        outfit: u => `${bareShoulders(u)}<path d="M38 222 C42 196 58 182 78 180 L150 166 C160 186 164 204 166 222Z" fill="url(#${u}sat)"/>
          <path d="M78 180 L150 166" stroke="url(#${u}au)" stroke-width="2.6"/><path d="M96 184 Q120 200 112 222 M130 178 Q146 196 140 222" stroke="#5ae0a8" stroke-width="1.4" fill="none" opacity=".45"/>`
      },
      lines: {
        greet: ["Ante up, {n}. Let's see if you're as good as you look.", "Three cards. One chance. No crying at my table.", "Hey, {n}. You came back. They always do."],
        bet: ["Confident. I respect that.", "Pair Plus too? Living dangerously, {n}.", "Chips down. Poker face on."],
        deal: ["Three for you, three for me. Don't peek.", "Cards in the air, darling."],
        win: ["You got me. Don't let it go to your head.", "Nice hand, {n}. I'll admit it. Once.", "Winner. You can stop smirking now."],
        lose: ["Dealer takes it. Better luck, sugar.", "Mine's bigger. Hand, I mean.", "Oof. Fold or not, you look good doing it."],
        big: ["Straight flush?! Okay, you've got my attention.", "Trips! I might need your number. For the tax form."],
        other: ["{n} came to play.", "Watch out for {n}. That one's trouble."],
        poke: ["You keep tapping me, {n}. Want something?", "My poker face is famous. My other faces are private.", "Ask me nicely and I might deal you a pair.", "Emerald suits me, right? Say yes.", "Careful. I bite. Only at the table."],
        tip: ["Mm. Generous AND good-looking.", "Thanks, {n}. That's going straight to my shoe fund.", "Keep that up and I'll smile. Maybe."]
      }
    }
  };
  for (const k in CHARS) CHARS[k].svg = () => portrait(CHARS[k].look);
  GA.DEALERS = CHARS;

  /* ---------- Behavior ---------- */
  const all = [];
  let lastPt = null;
  addEventListener("pointermove", e => {
    lastPt = { x: e.clientX, y: e.clientY };
    if (!GA._eyeRaf) GA._eyeRaf = requestAnimationFrame(() => { GA._eyeRaf = 0; all.forEach(d => d.look(lastPt)); });
  }, { passive: true });

  const MOODS = ["grin", "gasp", "wink", "blushing", "tilt", "flip", "kissing"];
  GA.dealer = (el, id) => {
    const C = CHARS[id];
    el.classList.add("dealer");
    el.innerHTML = `<button type="button" class="dealer-portrait" aria-label="Talk to ${C.name}">${C.svg()}</button>
      <div class="dealer-info">
        <div class="dealer-name"><b>${C.name}</b><span>${C.title}</span></div>
        <div class="bubble" aria-live="polite"></div>
        <div class="dealer-actions"><button type="button" data-a="chat">Flirt</button><button type="button" data-a="kiss">Blow a kiss</button><button type="button" data-a="tip">Tip 25</button><small class="tips"></small></div>
      </div>`;
    const portraitBtn = el.querySelector(".dealer-portrait"), fig = el.querySelector("svg"), bubble = el.querySelector(".bubble"), tipsEl = el.querySelector(".tips");
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
        else { let i = 0; bubble.textContent = ""; typeT = setInterval(() => { bubble.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(typeT); }, 18); }
        const moods = {
          win: "grin blushing", big: "gasp blushing", lose: "tilt", bust: "gasp", tip: "kissing wink blushing", bet: "wink", greet: "grin flip",
          other: "grin", push: "tilt", deal: "wink", spin: "flip", roll: "grin",
          poke: GA.pick(["wink blushing tilt", "flip grin", "kissing wink", "grin blushing tilt"])
        };
        api.mood(moods[kind] || "");
        if (kind === "big") setTimeout(() => api.mood("grin blushing flip"), 900);
        if (kind === "tip" || (kind === "poke" && fig.classList.contains("kissing"))) api.kiss();
      },
      mood(m) {
        fig.classList.remove(...MOODS);
        clearTimeout(moodT);
        if (!m) return;
        void fig.getBoundingClientRect();
        m.split(" ").forEach(c => c && fig.classList.add(c));
        moodT = setTimeout(() => fig.classList.remove(...MOODS), fig.classList.contains("wink") ? 1800 : 2600);
      },
      look(pt) {
        const r = portraitBtn.getBoundingClientRect();
        if (!r.width) return;
        const cx = r.left + r.width / 2, cy = r.top + r.height * 0.42;
        const dx = pt.x - cx, dy = pt.y - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 300);
        const tx = (dx / d) * 2.6 * k, ty = (dy / d) * 1.6 * k;
        fig.querySelectorAll(".pupil").forEach(p => p.setAttribute("transform", `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`));
      },
      kiss() {
        if (GA.reduced) return;
        const r = portraitBtn.getBoundingClientRect();
        for (let i = 0; i < 4; i++) {
          const k = document.createElement("span");
          k.className = "kiss"; k.textContent = i % 2 ? "💋" : "♥";
          k.style.left = r.left + r.width / 2 - 12 + "px"; k.style.top = r.top + r.height * 0.55 + "px";
          k.style.setProperty("--dx", (Math.random() * 140 - 70).toFixed(0) + "px"); k.style.animationDelay = i * 0.14 + "s";
          document.body.appendChild(k); setTimeout(() => k.remove(), 2200);
        }
      }
    };
    portraitBtn.addEventListener("click", () => { api.say("poke"); GA.sfx.pop(); });
    el.querySelector('[data-a="chat"]').addEventListener("click", () => { api.say("poke"); GA.sfx.pop(); });
    el.querySelector('[data-a="kiss"]').addEventListener("click", () => {
      api.mood("kissing wink blushing"); api.kiss(); GA.sfx.pop();
      clearInterval(typeT);
      bubble.textContent = GA.pick([`Mwah! That one's for you, ${GA.me.name}.`, "Catch it, darling.", "Don't tell the pit boss.", "Careful, they're lucky."]);
    });
    el.querySelector('[data-a="tip"]').addEventListener("click", () => {
      if (!GA.wallet.can(25)) { GA.toast("You need 25 chips to tip."); return; }
      GA.wallet.adjust(-25, "tip:" + C.name);
      tips++; GA.store.set("tips." + id, tips); showTips();
      api.say("tip"); GA.sfx.coin();
    });
    (function blink() {
      setTimeout(() => {
        if (!document.body.contains(el)) return;
        if (!fig.classList.contains("wink")) { fig.classList.add("blink"); setTimeout(() => fig.classList.remove("blink"), 140); }
        blink();
      }, 2200 + Math.random() * 3800);
    })();
    // an idle hair flip now and then
    (function idle() {
      setTimeout(() => {
        if (!document.body.contains(el)) return;
        if (!GA.reduced && !fig.classList.length) api.mood(GA.pick(["flip", "wink", "tilt grin"]));
        idle();
      }, 9000 + Math.random() * 9000);
    })();
    all.push(api);
    if (lastPt) api.look(lastPt);
    api.say("greet");
    return api;
  };
  GA.dealerFace = id => CHARS[id].svg();
})();

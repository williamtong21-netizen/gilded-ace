/* Gilded Ace app shell: lobby, routing, the room drawer, chat and event dispatch. */
(function () {
  "use strict";
  const GA = window.GA, $ = GA.$, $$ = GA.$$;

  const GAMES = [
    { id: "blackjack", name: "Twenty-One Club", tag: "Blackjack · 5 variants", desc: "Classic, Double Down Frenzy, Free Bet, Double Exposure and Spanish 21, plus Perfect Pairs and 21+3.", dealer: "rico", mp: true, art: "21", g: "linear-gradient(160deg,#0f4a36,#081f17)" },
    { id: "roulette", name: "Roulette Royale", tag: "Single zero", desc: "One wheel for the whole room. Straight up pays 35 to 1.", dealer: "valentina", mp: true, art: "◎", g: "linear-gradient(160deg,#5a1222,#1e050b)" },
    { id: "craps", name: "The Hot Table", tag: "Craps · Shooter rotates", desc: "Pass line, odds, the field, place bets, hardways and the long-shot props.", dealer: "monty", mp: true, art: "⚃", g: "linear-gradient(160deg,#13583f,#062014)" },
    { id: "baccarat", name: "Salon Baccarat", tag: "Punto banco", desc: "Player, Banker or Tie, with pair side bets and a bead road.", dealer: "celeste", mp: true, art: "9", g: "linear-gradient(160deg,#164a70,#06182a)" },
    { id: "poker3", name: "Jade's Three Card", tag: "Three Card Poker", desc: "Ante, Pair Plus and a dealer who needs queen high to qualify.", dealer: "jade", mp: true, art: "♠", g: "linear-gradient(160deg,#4a1030,#16040e)" },
    { id: "slots", name: "Gilded Reels", tag: "Slots · 5 lines", desc: "Three reels, five paylines and a 500× triple seven.", mp: false, art: "7", g: "linear-gradient(160deg,#6a3b0f,#1e1004)" },
    { id: "videopoker", name: "Jacks or Better", tag: "Video poker · 9/6", desc: "Full-pay Jacks or Better with a 4,000-coin royal flush.", mp: false, art: "J", g: "linear-gradient(160deg,#0b1b4a,#040a1e)" },
    { id: "keno", name: "Lucky Keno", tag: "Keno · 80 balls", desc: "Pick up to ten numbers and watch twenty balls drop.", mp: false, art: "80", g: "linear-gradient(160deg,#3b1a6a,#100620)" }
  ];
  const ROUTES = ["lobby", ...GAMES.map(g => g.id)];

  /* ---------- Views ---------- */
  const mounted = {};
  const viewsEl = $("#views");
  function viewEl(id) {
    let el = $("#v-" + id);
    if (!el) { el = document.createElement("section"); el.id = "v-" + id; el.className = "view wrap"; el.hidden = true; viewsEl.appendChild(el); }
    return el;
  }
  function show(id) {
    if (!ROUTES.includes(id)) id = "lobby";
    GA.route = id;
    const el = viewEl(id);
    if (!mounted[id]) mounted[id] = id === "lobby" ? lobby(el) : GA.views[id].mount(el);
    $$(".view", viewsEl).forEach(v => (v.hidden = v !== el));
    $$("#nav a").forEach(a => a.setAttribute("aria-current", a.getAttribute("href") === "#" + id ? "page" : "false"));
    document.title = id === "lobby" ? "Gilded Ace Casino" : (GA.views[id] ? GA.views[id].title : "") + " · Gilded Ace";
    if (GA.net.host || GA.net.mode === "client") GA.net.send({ t: "at", g: id });
    if (GA.net.snap) render(GA.net.snap, true);
    if (mounted[id].shown) mounted[id].shown();
    scrollTo(0, 0);
  }
  addEventListener("hashchange", () => show(location.hash.slice(1)));

  /* ---------- Lobby ---------- */
  function lobby(el) {
    el.innerHTML = `
      <div class="hero">
        <div class="marquee">
          <div class="eyebrow">Open all night · Play money · Live with friends</div>
          <h1 class="gold-text">Gilded Ace</h1>
          <p class="lede">Eight games, five dealers who flirt for tips, and a room code that puts your friends at the same table.</p>
          <div class="acts"><a class="btn btn-gold btn-lg" href="#blackjack">Deal me in</a><button class="btn btn-ghost btn-lg" type="button" data-open-room>Play with friends</button></div>
        </div>
        <div class="cashier">
          <div class="eyebrow">The cashier</div>
          <div><div class="muted" style="font-size:13px">Your chips</div><div class="bal num" data-bal>0</div></div>
          <div class="row" data-cash></div>
          <div><label for="name-in">Your name at the tables</label>
            <form class="field" data-name-form style="margin-top:6px"><input class="input" id="name-in" maxlength="20" autocomplete="nickname"><button class="btn btn-ghost btn-sm" type="submit">Save</button></form></div>
          <div><label>Your chip color</label><div class="swatches" data-swatches style="margin-top:6px"></div></div>
          <div class="muted" style="font-size:13px" data-stats></div>
        </div>
      </div>
      <div class="section-title"><h2 class="gold-text">The floor</h2><span class="muted" style="font-size:14px" data-live></span></div>
      <div class="games" data-games></div>
      <div class="section-title"><h2 class="gold-text">Playing with friends</h2></div>
      <div class="how">
        <div><b>Open a room</b><p>Tap "Play with friends" and open a room. You get a five-letter code and a link to send.</p></div>
        <div><b>Friends join</b><p>They open the link or type the code. No accounts and no downloads, and they bring their own chips.</p></div>
        <div><b>Same tables, live</b><p>Everyone shares the blackjack shoe, the roulette wheel, the craps dice and the baccarat shoe. Chat and react as you go.</p></div>
      </div>
      <div data-board></div>`;
    const q = s => el.querySelector(s);
    q("[data-games]").innerHTML = GAMES.map(g => `
      <a class="gcard" href="#${g.id}" style="--g:${g.g}" data-game="${g.id}">
        <span class="art gold-text">${g.art}</span>
        <span class="tag">${g.tag}</span><h3>${g.name}</h3><p>${g.desc}</p>
        <span class="foot">${g.dealer ? `<span class="dealer-chip"><span style="width:34px;height:37px;display:inline-block;border-radius:50%;overflow:hidden;background:#120509;box-shadow:0 0 0 2px #d9b35d">${GA.dealerFace(g.dealer)}</span>${GA.DEALERS[g.dealer].name}</span>` : `<span>Solo</span>`}
        <span class="here" data-here></span><span class="mp ${g.mp ? "" : "solo"}">${g.mp ? "Multiplayer" : "Solo"}</span></span>
      </a>`).join("");
    q("[data-open-room]").addEventListener("click", openDrawer);
    q("#name-in").value = GA.me.name;
    q("[data-name-form]").addEventListener("submit", e => {
      e.preventDefault();
      const v = q("#name-in").value.trim().slice(0, 20); if (!v) return;
      GA.me.name = v; GA.saveMe(); GA.net.send({ t: "profile", name: v }); GA.toast(`You're ${v} at the tables.`);
    });
    const sw = () => (q("[data-swatches]").innerHTML = GA.COLORS.map(c => `<button type="button" class="swatch" style="--c:${c}" data-c="${c}" aria-label="Color ${c}" aria-pressed="${c === GA.me.color}"></button>`).join(""));
    sw();
    q("[data-swatches]").addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (!b) return; GA.me.color = b.dataset.c; GA.saveMe(); GA.net.send({ t: "profile", color: GA.me.color }); sw(); GA.sfx.pop(); });
    el.addEventListener("click", e => {
      const b = e.target.closest("[data-cash-act]"); if (!b) return;
      const today = new Date().toDateString();
      if (b.dataset.cashAct === "daily") {
        if (GA.me.lastBonus === today) return;
        GA.me.lastBonus = today; GA.saveMe(); GA.net.send({ t: "adj", d: 1000, why: "bonus" }); GA.sfx.coin(); GA.celebrate(40); GA.toast("1,000 chips added. See you tomorrow.");
      } else if (b.dataset.cashAct === "refill") {
        const bal = GA.wallet.bal(); if (bal >= 500) return;
        GA.net.send({ t: "adj", d: 5000 - bal, why: "bonus" }); GA.sfx.coin(); GA.toast("Topped up to 5,000. The house believes in you.");
      }
    });
    return {
      render(snap) {
        const bal = GA.wallet.bal(), today = new Date().toDateString();
        q("[data-bal]").textContent = GA.fmt(bal);
        q("[data-cash]").innerHTML = `<button class="btn btn-gold btn-sm" data-cash-act="daily" ${GA.me.lastBonus === today ? "disabled" : ""}>${GA.me.lastBonus === today ? "Daily bonus collected" : "Collect daily 1,000"}</button>
          ${bal < 500 ? `<button class="btn btn-red btn-sm" data-cash-act="refill">Refill to 5,000</button>` : ""}`;
        const s = GA.me.stats;
        q("[data-stats]").textContent = s.hands ? `Solo machines: ${GA.fmt(s.hands)} plays, biggest hit ${GA.fmt(s.biggest)}.` : "Every player starts with 10,000 chips, saved in this browser.";
        const ps = snap.players, ids = Object.keys(ps);
        q("[data-live]").textContent = GA.net.isMulti() ? `${ids.length} player${ids.length > 1 ? "s" : ""} in room ${snap.code}` : "Solo play · open a room to bring friends";
        $$("[data-game]", el).forEach(card => {
          const here = ids.filter(pid => ps[pid].at === card.dataset.game);
          card.querySelector("[data-here]").innerHTML = here.slice(0, 5).map(pid => `<i style="--c:${ps[pid].color}" title="${GA.esc(ps[pid].name)}"></i>`).join("");
        });
        if (GA.net.isMulti()) {
          const rows = ids.map(pid => ps[pid]).sort((a, b) => b.chips - a.chips);
          q("[data-board]").innerHTML = `<div class="section-title"><h2 class="gold-text">Room leaderboard</h2></div><ul class="plist">${rows.map((p, i) => `<li style="--c:${p.color}"><i></i><span>${i + 1}. ${GA.esc(p.name)}<small>Net tonight ${p.net >= 0 ? "+" : "−"}${GA.fmt(Math.abs(p.net || 0))} · best hit ${GA.fmt(p.best || 0)}</small></span><span class="ch">${GA.fmt(p.chips)}</span></li>`).join("")}</ul>`;
        } else q("[data-board]").innerHTML = "";
      }
    };
  }

  /* ---------- Drawer ---------- */
  const drawer = $("#drawer"), scrim = $("#scrim");
  let unread = 0;
  function openDrawer() { drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); scrim.classList.add("show"); unread = 0; badge(); renderDrawer(); setTimeout(() => { const m = $("#msgs"); m.scrollTop = m.scrollHeight; }, 50); }
  function closeDrawer() { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); scrim.classList.remove("show"); }
  $("#room-btn").addEventListener("click", () => (drawer.classList.contains("open") ? closeDrawer() : openDrawer()));
  $("#drawer-close").addEventListener("click", closeDrawer);
  scrim.addEventListener("click", closeDrawer);
  addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });
  function badge() { const b = $("#chat-badge"); b.hidden = !unread; b.textContent = unread > 9 ? "9+" : unread; }

  let busy = false, joinDraft = "";
  function renderDrawer() {
    const body = $("#drawer-body"), snap = GA.net.snap, mode = GA.net.mode;
    $("#drawer-title").textContent = mode === "solo" ? "Play with friends" : `Room ${GA.net.code}`;
    if (mode === "solo") {
      body.innerHTML = `
        <p class="muted" style="margin:0">Open a room and send the code to friends. Everyone plays the same tables live, and chips come with each player.</p>
        <button class="btn btn-gold btn-lg" data-host ${busy ? "disabled" : ""}>${busy ? "Opening…" : "Open a room"}</button>
        <div><label class="eyebrow" for="join-in">Have a code?</label>
          <form class="field" data-join style="margin-top:8px"><input class="input" id="join-in" maxlength="5" placeholder="ABCDE" style="text-transform:uppercase;font-family:var(--mono);letter-spacing:.2em" autocomplete="off"><button class="btn btn-ghost" type="submit" ${busy ? "disabled" : ""}>Join</button></form></div>
        <p class="muted" style="margin:0;font-size:13px">You're playing as <b style="color:var(--ivory)">${GA.esc(GA.me.name)}</b>. Change your name in the lobby.</p>`;
      body.querySelector("[data-host]").addEventListener("click", async () => {
        busy = true; renderDrawer();
        try { const code = await GA.net.hostRoom(); GA.toast(`Room ${code} is open. Send your friends the link.`); } catch (e) {}
        busy = false; renderDrawer();
      });
      const ji = body.querySelector("#join-in");
      ji.value = joinDraft;
      ji.addEventListener("input", () => { ji.value = ji.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5); joinDraft = ji.value; });
      body.querySelector("[data-join]").addEventListener("submit", async e => {
        e.preventDefault();
        const code = ji.value || joinDraft;
        if (code.length !== 5) { GA.toast("Room codes are 5 letters."); ji.focus(); return; }
        busy = true; renderDrawer();
        try { await GA.net.join(code); joinDraft = ""; GA.toast("You're in. Pull up a chair."); } catch (err) {}
        busy = false; renderDrawer();
      });
      return;
    }
    const link = GA.net.inviteLink(), ps = snap ? snap.players : {};
    body.innerHTML = `
      <div><div class="eyebrow">Room code</div><div class="code">${GA.net.code}</div></div>
      <div class="field"><input class="input" readonly value="${GA.esc(link)}" id="invite-link" aria-label="Invite link"><button class="btn btn-gold btn-sm" data-copy>Copy link</button></div>
      <p class="muted" style="margin:0;font-size:13px">${mode === "host" ? "You're the host. Your tab runs the tables, so keep it open." : "Connected to the host's tables."}</p>
      <div><div class="eyebrow" style="margin-bottom:8px">At the casino</div><ul class="plist">${Object.keys(ps).map(pid => { const p = ps[pid], g = GAMES.find(x => x.id === p.at); return `<li style="--c:${p.color}"><i></i><span>${GA.esc(p.name)}${pid === GA.me.id ? " (you)" : ""}${pid === snap.host ? " · host" : ""}<small>${g ? "At " + g.name : "In the lobby"}</small></span><span class="ch">${GA.fmt(p.chips)}</span></li>`; }).join("")}</ul></div>
      <button class="btn btn-dark" data-leave>${mode === "host" ? "Close room" : "Leave room"}</button>`;
    body.querySelector("[data-copy]").addEventListener("click", () => {
      const inp = $("#invite-link");
      const done = () => GA.toast("Invite link copied.");
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => { inp.select(); GA.toast("Press copy on your keyboard to copy the link."); });
      else { inp.select(); document.execCommand && document.execCommand("copy"); done(); }
    });
    body.querySelector("[data-leave]").addEventListener("click", () => { GA.net.leave(); renderDrawer(); });
  }

  /* ---------- Chat + reactions ---------- */
  const EMOTES = ["🔥", "😂", "😍", "💸", "🎉", "😱", "🍀", "👑"];
  $("#emotes").innerHTML = EMOTES.map(e => `<button type="button" data-e="${e}" aria-label="React ${e}">${e}</button>`).join("");
  $("#emotes").addEventListener("click", e => { const b = e.target.closest("[data-e]"); if (b) GA.net.send({ t: "react", e: b.dataset.e }); });
  $("#chat-form").addEventListener("submit", e => {
    e.preventDefault();
    const inp = $("#chat-in"), v = inp.value.trim(); if (!v) return;
    if (!GA.net.isMulti()) { GA.toast("Open or join a room to chat with friends."); return; }
    GA.net.send({ t: "chat", text: v }); inp.value = "";
  });
  let lastChatLen = 0, lastChatAt = 0;
  function renderChat(snap) {
    const box = $("#msgs"), msgs = snap.chat || [];
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.innerHTML = msgs.length ? msgs.map(m => m.sys ? `<div class="msg sys">${GA.esc(m.text)}</div>` : `<div class="msg" style="--c:${m.color}"><b>${GA.esc(m.name)}</b> ${GA.esc(m.text)}</div>`).join("") : `<div class="msg sys">${GA.net.isMulti() ? "Say hi to the room." : "Chat opens when you're in a room with friends."}</div>`;
    if (atBottom) box.scrollTop = box.scrollHeight;
    const newest = msgs.length ? msgs[msgs.length - 1].at : 0;
    if (newest > lastChatAt && lastChatLen) {
      const fresh = msgs.filter(m => m.at > lastChatAt && !m.sys && m.pid !== GA.me.id);
      if (fresh.length && !drawer.classList.contains("open")) { unread += fresh.length; badge(); GA.sfx.pop(); }
    }
    lastChatAt = newest; lastChatLen = msgs.length || 1;
  }
  function floatReact(e, snap) {
    const p = snap.players[e.pid];
    const el = document.createElement("div");
    el.className = "float-react";
    el.innerHTML = `${GA.esc(e.e)}<small>${GA.esc(p ? p.name : "")}</small>`;
    el.style.left = 10 + Math.random() * 75 + "vw"; el.style.bottom = "80px";
    document.body.appendChild(el); setTimeout(() => el.remove(), 2500);
  }

  /* ---------- Snapshot rendering ---------- */
  let lastEid = null, lastHost = null, lastBal = null;
  function render(snap, force) {
    // balance
    const bal = GA.wallet.bal(), pill = $("#bal-pill");
    $("#bal").textContent = GA.fmt(bal);
    if (lastBal !== null && bal !== lastBal && !force) { pill.classList.remove("up", "down"); void pill.offsetWidth; pill.classList.add(bal > lastBal ? "up" : "down"); }
    lastBal = bal;
    // room button
    const multi = GA.net.isMulti(), rb = $("#room-btn");
    rb.classList.toggle("on", multi);
    const narrow = innerWidth < 620;
    $("#room-label").textContent = multi ? `${narrow ? "" : "Room "}${GA.net.code} · ${Object.keys(snap.players).length}` : narrow ? "Friends" : "Play with friends";
    // current view
    const v = mounted[GA.route];
    if (v && v.render) v.render(snap);
    // who's here line
    const who = $(`#v-${GA.route} [data-who]`);
    if (who) {
      const here = Object.keys(snap.players).filter(pid => snap.players[pid].at === GA.route);
      who.innerHTML = multi ? here.map(pid => `<span class="ptag" style="--c:${snap.players[pid].color}"><i></i>${GA.esc(snap.players[pid].name)}</span>`).join("") : `<span class="ptag" style="--c:${GA.me.color}"><i></i>${GA.esc(GA.me.name)}</span>`;
    }
    renderChat(snap);
    if (drawer.classList.contains("open")) {
      const active = document.activeElement;
      if (!(active && (active.id === "join-in" || active.id === "chat-in"))) renderDrawer();
    }
    // events
    if (snap.host !== lastHost) { lastHost = snap.host; lastEid = null; }
    const evts = snap.evts || [];
    if (lastEid === null) lastEid = evts.length ? evts[evts.length - 1].id : 0;
    else for (const e of evts) {
      if (e.id <= lastEid) continue;
      lastEid = e.id;
      if (e.kind === "react") { floatReact(e, snap); continue; }
      if (e.kind === "solo-big" && e.pid !== GA.me.id && snap.players[e.pid]) { GA.toast(`${snap.players[e.pid].name} hit ${e.label} for ${GA.fmt(e.net)}!`); continue; }
      if (e.g === GA.route && v && v.onEvt) v.onEvt(e, snap);
      else if (e.kind === "win" && e.pid === GA.me.id && e.net > 0) GA.toast(`You won ${GA.fmt(e.net)} at ${GA.views[e.g] ? GA.views[e.g].title : "the tables"}.`);
    }
  }
  GA.net.on(snap => render(snap));
  setInterval(() => { const v = mounted[GA.route]; if (v && v.tick) v.tick(); }, 500);

  /* ---------- Sound ---------- */
  function soundIcon() {
    $("#sound-ico").innerHTML = GA.me.sound ? '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>' : '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>';
    $("#sound-btn").setAttribute("aria-label", GA.me.sound ? "Sound on" : "Sound off");
  }
  $("#sound-btn").addEventListener("click", () => { GA.me.sound = !GA.me.sound; GA.saveMe(); soundIcon(); if (GA.me.sound) GA.sfx.chip(); });
  soundIcon();

  /* ---------- Boot ---------- */
  GA.route = ROUTES.includes(location.hash.slice(1)) ? location.hash.slice(1) : "lobby";
  GA.net.startSolo();
  show(GA.route);
  const params = new URLSearchParams(location.search), code = params.get("room");
  if (code) {
    history.replaceState(null, "", location.pathname + location.hash);
    GA.toast(`Joining room ${code.toUpperCase()}…`);
    GA.net.join(code).then(() => { GA.toast(`You're in room ${GA.net.code}. Pull up a chair.`); openDrawer(); }).catch(() => {});
  }
})();

// Battle screen for the turn-based JRPG encounters (rules live in battle.js).
import * as B from './battle.js';

export function createBattleUI({ getState, renderer, E, dist, save, message, hud, stopInput }) {
  let root = null, b = null, busy = false, picking = null, itemMenu = false, token = 0;
  const reduced = () => matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const pause = ms => new Promise(r => setTimeout(r, reduced() ? Math.min(ms, 90) : ms));
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ctx = () => ({ hurt: E.hurt, use: E.use, note: E.note, now: Date.now() });

  function mount() {
    if (root) return root;
    root = document.createElement('section');
    root.id = 'battle'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Battle');
    (document.getElementById('game') || document.body).append(root);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    return root;
  }

  const FOE_FRAME = { wolf: { y: 1.0, d: 3.0, look: .75 }, troll: { y: 1.9, d: 3.8, look: 1.5 }, ghost: { y: 1.5, d: 2.8, look: 1.3 }, skeleton: { y: 1.55, d: 2.6, look: 1.3 } };
  function portrait(canvas, actor, frame) {
    try { renderer.portrait(canvas, actor, null, frame || null); } catch { /* the card still works without art */ }
  }

  function card(kind, id, name, hp, maxHp, mp, maxMp) {
    const pct = Math.max(0, Math.min(100, Math.round(hp / maxHp * 100)));
    return `<div class="b-card b-${kind==='foe'?'enemy':kind}" data-id="${esc(id)}"><canvas width="256" height="256" aria-hidden="true"></canvas><div class="b-meta"><strong>${esc(name)}</strong><div class="b-bar" role="img" aria-label="${esc(name)} health ${Math.max(0, Math.round(hp))} of ${Math.round(maxHp)}"><i style="width:${pct}%"></i></div><small class="b-hp">${Math.max(0, Math.round(hp))} / ${Math.round(maxHp)}</small>${maxMp ? `<div class="b-bar b-mp"><i style="width:${Math.round(mp / maxMp * 100)}%"></i></div><small class="b-mpt">${Math.round(mp)} / ${Math.round(maxMp)} mana</small>` : ''}</div></div>`;
  }

  function build() {
    const s = getState(), foes = B.foe(b, s), g = s.guardian;
    root.innerHTML = `<div class="b-banner">Encounter</div><div class="b-stage"><div class="b-foes">${foes.map(e => `<button type="button" class="b-foe" data-target="${esc(e.id)}" ${B.livingFoes(b, s).includes(e) ? '' : 'disabled'}>${card('foe', e.id, e.name, e.hp, e.maxHp)}</button>`).join('')}</div><div class="b-party">${card('player', 'player', s.player.name || 'You', s.player.hp, s.player.maxHp, s.player.mp, s.player.maxMp)}${g ? card('guardian', 'guardian', g.name, g.hp, g.maxHp) : ''}</div></div><div class="b-log" role="log" aria-live="polite"></div><div class="b-menu" role="menu"></div>`;
    const set = (sel, actor, frame) => { const c = root.querySelector(sel + ' canvas'); if (c) portrait(c, actor, frame); };
    for (const e of foes) set(`.b-foe[data-target="${CSS.escape(e.id)}"]`, e, FOE_FRAME[e.kind]);
    set('.b-player', { ...s.player, id: 'player', type: 'hero' }, null);
    if (g) set('.b-guardian', g, { x: .1, y: .75, d: 2.4, look: .5, turn: -.4 });
    root.querySelector('.b-banner').textContent = foes.length > 1 ? 'Encounter — ' + foes.length + ' foes' : 'Encounter — ' + foes[0].name;
    log(b.log.slice(0, 1));
  }

  function log(lines) {
    const el = root.querySelector('.b-log');
    for (const t of lines) { const p = document.createElement('p'); p.textContent = t; el.append(p); }
    while (el.children.length > 5) el.firstChild.remove();
    el.scrollTop = el.scrollHeight;
  }

  function applyHp(snap) {
    const bar = (sel, h, m, down) => {
      const c = root.querySelector(sel); if (!c) return;
      c.querySelector('.b-bar i').style.width = Math.max(0, Math.round(h / m * 100)) + '%';
      c.querySelector('.b-hp').textContent = Math.max(0, h) + ' / ' + m;
      c.querySelector('.b-bar').setAttribute('aria-label', 'health ' + Math.max(0, h) + ' of ' + m);
      c.classList.toggle('down', h <= 0);
    };
    bar('.b-player', snap.player.hp, snap.player.maxHp);
    const pm = root.querySelector('.b-player .b-mp i'); if (pm) pm.style.width = Math.round(snap.player.mp / snap.player.maxMp * 100) + '%';
    const pt = root.querySelector('.b-player .b-mpt'); if (pt) pt.textContent = snap.player.mp + ' / ' + snap.player.maxMp + ' mana';
    if (snap.guardian) bar('.b-guardian', snap.guardian.hp, snap.guardian.maxHp);
    for (const [id, f] of Object.entries(snap.foes)) {
      bar(`.b-foe[data-target="${CSS.escape(id)}"] .b-card`, f.hp, f.maxHp);
      const btn = root.querySelector(`.b-foe[data-target="${CSS.escape(id)}"]`); if (btn && f.dead) btn.disabled = true;
    }
  }

  async function play(events, myToken) {
    for (const e of events) {
      if (myToken !== token) return;
      applyHp(e.hp);
      log([e.text].filter(Boolean));
      if (e.type === 'hit') {
        const sel = e.dst === 'player' ? '.b-player' : e.dst === 'guardian' ? '.b-guardian' : `.b-foe[data-target="${CSS.escape(e.dst)}"] .b-card`;
        const c = root.querySelector(sel);
        if (c) {
          c.classList.remove('hit'); void c.offsetWidth; c.classList.add('hit');
          const n = document.createElement('span'); n.className = 'b-pop' + (e.crit ? ' crit' : ''); n.textContent = e.amount; c.append(n); setTimeout(() => n.remove(), 900);
        }
      }
      await pause(e.type === 'end' ? 300 : 520);
    }
  }

  function menu() {
    const s = getState(), el = root.querySelector('.b-menu');
    root.dataset.phase = b.phase; root.dataset.round = b.round;
    if (b.phase === 'over') {
      const sm = b.summary || {}, r = b.result;
      const text = r === 'won' ? `Victory! +${sm.gold || 0} coins, +${sm.xp || 0} experience${sm.leveled ? ` — level ${sm.level}!` : ''}.` : r === 'fled' ? 'You escaped. The foes will hesitate for a moment.' : 'You have fallen. The wayfarer shrine will call you back in ten seconds.';
      el.innerHTML = `<p class="b-result" data-result="${r}">${esc(text)}</p><button type="button" data-cmd="done" class="b-primary">Continue</button>`;
      el.querySelector('button').focus();
      return;
    }
    root.querySelectorAll('.b-foe').forEach(x => x.classList.toggle('pick', !!picking && !x.disabled));
    if (picking) {
      el.innerHTML = `<p class="b-prompt">Choose a target.</p><button type="button" data-cmd="back">Back</button>`;
      root.querySelector('.b-foe:not([disabled])')?.focus();
      return;
    }
    if (itemMenu) {
      const items = B.ITEM_LIST.filter(i => s.inv[i] > 0);
      el.innerHTML = items.map(i => `<button type="button" data-item="${i}">${esc(({ salve: 'Salve', bread: 'Bread', fish: 'Fish', tonic: 'Tonic' })[i])} ×${s.inv[i]}</button>`).join('') + '<button type="button" data-cmd="back">Back</button>';
      el.querySelector('button')?.focus();
      return;
    }
    const cmds = B.commands(b, s);
    el.innerHTML = cmds.map((c, i) => `<button type="button" role="menuitem" data-cmd="${c.id}" ${c.enabled && !busy ? '' : 'disabled'} ${c.hint ? `title="${esc(c.hint)}"` : ''}><kbd>${i + 1}</kbd> ${esc(c.label)}${c.cost ? ` <small>${c.cost} mana</small>` : ''}</button>`).join('');
    el.querySelector('button:not([disabled])')?.focus();
  }

  const needsTarget = (cmd, s) => (cmd === 'attack' || (cmd === 'skill' && !['warrior', 'ranger', 'summoner'].includes(s.player.classId))) && B.livingFoes(b, getState()).length > 1;

  async function perform(cmd) {
    if (busy || b.phase === 'over') return;
    busy = true; picking = null; itemMenu = false;
    const my = token;
    root.querySelectorAll('.b-menu button').forEach(x => x.disabled = true);
    const out = B.act(b, getState(), cmd, ctx());
    await play(out.events, my);
    if (my !== token) return;
    busy = false;
    if (b.phase === 'over') { root.querySelector('.b-banner').textContent = b.result === 'won' ? 'Victory' : b.result === 'fled' ? 'Escaped' : 'Defeated'; }
    menu();
  }

  function command(cmd, target) {
    const s = getState();
    if (cmd === 'item') { itemMenu = true; menu(); return; }
    if (needsTarget(cmd, s) && !target) { picking = cmd; menu(); return; }
    void perform({ id: cmd, target });
  }

  function onClick(e) {
    const t = e.target.closest('button'); if (!t || t.disabled) return;
    if (t.dataset.target && picking) { const c = picking; picking = null; command(c, t.dataset.target); return; }
    if (t.dataset.item) { void perform({ id: 'item', item: t.dataset.item }); return; }
    const c = t.dataset.cmd; if (!c) return;
    if (c === 'back') { picking = null; itemMenu = false; menu(); return; }
    if (c === 'done') { finish(); return; }
    command(c);
  }

  function onKey(e) {
    if (busy || b?.phase === 'over' && e.key !== 'Enter') return;
    if (e.key === 'Escape') { if (picking || itemMenu) { picking = null; itemMenu = false; menu(); } e.stopPropagation(); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= 5 && !picking && !itemMenu) { const c = B.commands(b, getState())[n - 1]; if (c?.enabled) command(c.id); e.preventDefault(); }
  }

  function finish() {
    token++;
    const s = getState(), r = b?.result;
    root.hidden = true; root.innerHTML = ''; b = null; busy = false; picking = null; itemMenu = false;
    document.getElementById('game')?.removeAttribute('data-battle');
    if (r === 'lost') message('You have fallen. The wayfarer shrine will call you back in ten seconds.');
    else if (r === 'won') message('The road is clear.');
    s.revision++; save(); hud();
  }

  return {
    get active() { return !!b; },
    get state() { return b; },
    start(foes) {
      if (b) return;
      mount(); stopInput?.();
      const s = getState();
      token++; busy = true; picking = null; itemMenu = false;
      const first = B.begin(s, foes, ctx());
      b = first.b;
      document.getElementById('game')?.setAttribute('data-battle', 'true');
      root.hidden = false; build();
      const my = token;
      play(first.events, my).then(() => { if (my !== token) return; busy = false; if (b.phase === 'over') root.querySelector('.b-banner').textContent = b.result === 'won' ? 'Victory' : 'Defeated'; menu(); });
      menu();
    },
    cancel() { if (!b) return; finish(); }
  };
}

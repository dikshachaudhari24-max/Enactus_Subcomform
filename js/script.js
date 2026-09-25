/* ===================================================================
   ENACTUS SPIT — SUBCOM APPLICATION 2026-27
   Game-world application experience. Vanilla JS, no dependencies.

   MODULES
     Config      endpoint, tenure, domain definitions
     Sfx         WebAudio chiptune synth (no audio files, no autoplay)
     Fx          coin bursts, pixel particles, confetti, score popups
     Hud         coin counter + world label
     World       pointer parallax + day/dusk mood
     Screens     pixel-wipe transitions between the four screens
     Domains     render + multi-select (no maximum)
     Validate    per-field rules, inline game-style errors
     Submit      POST to Apps Script, success/failure handling

   DATA POLICY
     Nothing the applicant types is ever written to localStorage,
     sessionStorage, cookies or IndexedDB. A reload always starts blank.
=================================================================== */

(() => {
  'use strict';

  /* =================================================================
     CONFIG
  ================================================================= */
  /* The one and only backend endpoint for the whole project. */
  const SCRIPT_URL =
    'https://script.google.com/macros/s/AKfycbwUgkGRX18siJchaj766Ach67MxLQkleoAg5k8d7wkU6HNshBvbe_7MsUjUmS1G-Fq5Iw/exec';

  const APPLICATION_YEAR = '2026–27';

  /* The single source of truth for domains. Rendered into cards,
     the selected-bar, the form recap and the submitted payload. */
  const DOMAINS = [
    {
      id: 'pr',
      name: 'THE CONNECTOR',
      label: 'PR',
      csv: 'PR',
      accent: '#2f6fe4',
      desc: 'Build relationships, open doors and grow the network behind every project.',
      art: `<g class="float-art" fill="none" stroke="#2f6fe4" stroke-width="2.6" stroke-linecap="square">
              <circle cx="11" cy="12" r="5" fill="#2f6fe4" stroke="none"/>
              <circle cx="31" cy="12" r="5" fill="#79b0ff" stroke="none"/>
              <circle cx="21" cy="32" r="5" fill="#fbd000" stroke="none"/>
              <path d="M13 16 19 28M29 16 23 28M16 12h10"/>
            </g>`
    },
    {
      id: 'marketing',
      name: 'THE STORYTELLER',
      label: 'MARKETING',
      csv: 'Marketing',
      accent: '#f6921e',
      desc: 'Craft the story, spread the word and make people genuinely care.',
      art: `<g class="float-art">
              <path d="M6 16h8l14-8v26l-14-8H6z" fill="#f6921e" stroke="#8a3306" stroke-width="2.4"/>
              <path d="M32 14c4 4 4 10 0 14M37 9c7 7 7 19 0 26" fill="none" stroke="#fbd000" stroke-width="2.6" stroke-linecap="round"/>
            </g>`
    },
    {
      id: 'creatives',
      name: 'THE CREATOR',
      label: 'CREATIVES',
      csv: 'Creatives',
      accent: '#e73025',
      desc: 'Bring every Enactus idea to life visually, frame by frame.',
      art: `<g class="float-art">
              <path d="M21 5c9 0 16 6 16 14 0 5-4 7-8 7h-3c-2 0-3 2-2 4 1 3-1 6-4 6C11 36 5 29 5 20 5 11 12 5 21 5z" fill="#fff8e7" stroke="#1a1a2e" stroke-width="2.4"/>
              <circle cx="14" cy="15" r="2.6" fill="#e73025"/>
              <circle cx="22" cy="12" r="2.6" fill="#2f6fe4"/>
              <circle cx="29" cy="17" r="2.6" fill="#fbd000"/>
              <circle cx="15" cy="24" r="2.6" fill="#3cb043"/>
            </g>`
    },
    {
      id: 'social',
      name: 'THE STORY COVERER',
      label: 'SOCIAL MEDIA',
      csv: 'Social Media',
      accent: '#7a4bd1',
      desc: 'Capture, document and present every Enactus moment as it happens.',
      art: `<g class="float-art">
              <rect x="5" y="13" width="32" height="22" fill="#7a4bd1" stroke="#1a1a2e" stroke-width="2.4"/>
              <rect x="15" y="8" width="12" height="6" fill="#7a4bd1" stroke="#1a1a2e" stroke-width="2.4"/>
              <circle cx="21" cy="24" r="7" fill="#1a1a2e"/>
              <circle cx="21" cy="24" r="3.4" fill="#fbd000"/>
              <rect x="30" y="17" width="4" height="4" fill="#fff8e7"/>
            </g>`
    },
    {
      id: 'techprojects',
      name: 'THE INNOVATOR',
      label: 'TECH & PROJECTS',
      csv: 'Tech & Projects',
      accent: '#1fa8a0',
      desc: 'Build the tools, ship the code and turn ideas into real social impact.',
      art: `<g class="float-art">
              <rect x="4" y="7" width="34" height="24" fill="#1a1a2e" stroke="#1fa8a0" stroke-width="2.6"/>
              <path d="M12 15 8 19l4 4M30 15l4 4-4 4M24 13l-6 12" fill="none" stroke="#fbd000" stroke-width="2.6" stroke-linecap="square"/>
              <rect x="13" y="33" width="16" height="4" fill="#1fa8a0"/>
            </g>`
    },
    {
      id: 'operations',
      name: 'THE ORGANISER',
      label: 'OPERATIONS',
      csv: 'Operations',
      accent: '#d4467a',
      desc: 'Keep every event, team and timeline running like clockwork.',
      art: `<g class="float-art">
              <rect x="9" y="7" width="24" height="29" fill="#fff8e7" stroke="#1a1a2e" stroke-width="2.4"/>
              <rect x="15" y="3" width="12" height="7" fill="#d4467a" stroke="#1a1a2e" stroke-width="2.4"/>
              <path d="M14 18l3 3 6-6" fill="none" stroke="#d4467a" stroke-width="2.8" stroke-linecap="square"/>
              <path d="M14 28l3 3 6-6" fill="none" stroke="#3cb043" stroke-width="2.8" stroke-linecap="square"/>
            </g>`
    }
  ];

  /* Optional work-link fields that appear only when their domain is
     selected. Each entry is independent of the others. */
  const CONDITIONAL_FIELDS = [
    { domainId: 'creatives',    sectionId: 'creatives-section',    inputId: 'field-portfolio' },
    { domainId: 'techprojects', sectionId: 'techprojects-section', inputId: 'field-worklink' }
  ];

  const BRANCHES = ['CE', 'CSE', 'EXTC'];

  /* Screen name -> HUD world label, used to sell level progression. */
  const WORLD_LABELS = {
    title: '1-1',
    select: '1-2',
    form: '1-3',
    success: 'CLEAR'
  };

  /* =================================================================
     SMALL HELPERS
  ================================================================= */
  const $ = (id) => document.getElementById(id);
  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = () => window.matchMedia('(hover: none)').matches;
  const isSmallScreen = () => window.matchMedia('(max-width: 767px)').matches;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  /* =================================================================
     SFX — square-wave chiptune blips generated on the fly.
     Starts muted; the AudioContext is only created after the user
     opts in, so no autoplay policy is ever violated.
  ================================================================= */
  const Sfx = (() => {
    let enabled = false;
    let ctx = null;

    const tone = (freq, dur, type = 'square', vol = 0.05, delay = 0) => {
      if (!enabled || !ctx) return;
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    };

    const sweep = (from, to, dur, vol = 0.05) => {
      if (!enabled || !ctx) return;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(from, t0);
      osc.frequency.linearRampToValueAtTime(to, t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    };

    const library = {
      coin:    () => { tone(988, 0.08); tone(1319, 0.22, 'square', 0.05, 0.07); },
      select:  () => { tone(660, 0.07); tone(880, 0.12, 'square', 0.05, 0.06); },
      deselect:() => { tone(440, 0.09); tone(330, 0.12, 'square', 0.04, 0.07); },
      click:   () => tone(760, 0.07),
      start:   () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.05, i * 0.08)); },
      warp:    () => sweep(220, 900, 0.32),
      error:   () => { tone(200, 0.12, 'sawtooth', 0.05); tone(150, 0.18, 'sawtooth', 0.05, 0.1); },
      complete:() => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.2, 'square', 0.055, i * 0.1)); }
    };

    const play = (name) => { if (library[name]) library[name](); };

    const toggle = () => {
      enabled = !enabled;
      if (enabled && !ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      if (enabled && ctx && ctx.state === 'suspended') ctx.resume();
      if (enabled) play('click');
      return enabled;
    };

    return { play, toggle, isEnabled: () => enabled };
  })();

  /* =================================================================
     FX — DOM particles, capped and self-cleaning so the layer can
     never accumulate nodes or leak timers.
  ================================================================= */
  const Fx = (() => {
    const layer = $('fx-layer');
    const COLORS = ['#fbd000', '#e73025', '#3cb043', '#2f6fe4', '#f6921e', '#fff8e7'];
    let live = 0;
    const MAX_LIVE = 90;

    const spawn = (node, life) => {
      live += 1;
      layer.appendChild(node);
      setTimeout(() => {
        node.remove();
        live -= 1;
      }, life + 60);
    };

    /* Coin/pixel burst from a point (or from an element's centre). */
    const burst = (x, y, opts = {}) => {
      if (prefersReducedMotion()) return;
      const count = opts.count || (isSmallScreen() ? 7 : 12);
      if (live + count > MAX_LIVE) return;

      for (let i = 0; i < count; i += 1) {
        const p = document.createElement('i');
        const kind = opts.kind || (i % 3 === 0 ? 'coin' : 'pixel');
        p.className = `particle particle--${kind}`;
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const dist = 50 + Math.random() * (opts.spread || 70);
        const life = 560 + Math.random() * 320;
        const size = kind === 'coin' ? 12 : 7 + Math.random() * 6;

        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        if (kind !== 'coin') {
          p.style.background = opts.color || COLORS[i % COLORS.length];
        }
        p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
        p.style.setProperty('--dy', `${Math.sin(angle) * dist - 40}px`);
        p.style.setProperty('--dr', `${Math.random() * 540 - 270}deg`);
        p.style.setProperty('--ds', '0.3');
        p.style.setProperty('--life', `${life}ms`);
        spawn(p, life);
      }
    };

    const burstFrom = (el, opts) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, opts);
    };

    /* "+1 COIN" style floating score text. */
    const popup = (el, text) => {
      if (!el || prefersReducedMotion()) return;
      const r = el.getBoundingClientRect();
      const node = document.createElement('span');
      node.className = 'popup-score';
      node.textContent = text;
      node.style.left = `${r.left + r.width / 2}px`;
      node.style.top = `${r.top}px`;
      spawn(node, 900);
    };

    /* Success-screen confetti rain — one bounded batch, never a loop. */
    const confetti = () => {
      if (prefersReducedMotion()) return;
      const count = isSmallScreen() ? 26 : 54;
      for (let i = 0; i < count; i += 1) {
        const c = document.createElement('i');
        c.className = 'confetti';
        const life = 2600 + Math.random() * 2000;
        c.style.left = `${Math.random() * 100}vw`;
        c.style.background = COLORS[i % COLORS.length];
        c.style.animationDelay = `${Math.random() * 900}ms`;
        c.style.setProperty('--life', `${life}ms`);
        if (i % 4 === 0) { c.style.borderRadius = '50%'; c.style.width = '11px'; c.style.height = '11px'; }
        spawn(c, life + 900);
      }
    };

    return { burst, burstFrom, popup, confetti };
  })();

  /* =================================================================
     HUD
  ================================================================= */
  const Hud = (() => {
    const coinsEl = $('hud-coins');
    const countEl = $('hud-coin-count');
    const worldEl = $('hud-world');
    let coins = 0;

    const render = () => { countEl.textContent = String(coins).padStart(2, '0'); };

    const addCoin = (n = 1) => {
      coins = clamp(coins + n, 0, 99);
      render();
      coinsEl.classList.remove('is-bumped');
      void coinsEl.offsetWidth;      // restart the bump animation
      coinsEl.classList.add('is-bumped');
    };

    const setCoins = (n) => { coins = clamp(n, 0, 99); render(); };
    const setWorld = (label) => { worldEl.textContent = label; };
    const reset = () => setCoins(0);

    return { addCoin, setCoins, setWorld, reset };
  })();

  /* =================================================================
     WORLD — pointer parallax + mood switching.
     Pointer work is throttled through rAF and skipped entirely on
     touch devices and under reduced-motion.
  ================================================================= */
  const World = (() => {
    const root = document.documentElement;
    let target = { x: 0, y: 0 };
    let queued = false;

    const apply = () => {
      queued = false;
      root.style.setProperty('--px', target.x.toFixed(3));
      root.style.setProperty('--py', target.y.toFixed(3));
    };

    const onPointerMove = (e) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (!queued) { queued = true; requestAnimationFrame(apply); }
    };

    const init = () => {
      if (isTouch() || prefersReducedMotion()) return;
      window.addEventListener('pointermove', onPointerMove, { passive: true });
    };

    const setMood = (mood) => { document.body.dataset.mood = mood; };

    return { init, setMood };
  })();

  /* =================================================================
     SCREENS — pixel-wipe transitions (~600ms round trip)
  ================================================================= */
  const Screens = (() => {
    const screens = {
      title: $('screen-title'),
      select: $('screen-select'),
      form: $('screen-form'),
      success: $('screen-success')
    };
    const wipe = $('wipe');
    const badge = $('wipe-badge');
    let busy = false;
    let current = 'title';

    /* Build the 10x6 wipe grid once. */
    const CELLS = 60;
    for (let i = 0; i < CELLS; i += 1) {
      const cell = document.createElement('i');
      cell.className = 'wipe__cell';
      /* Stagger cells diagonally so the wipe reads as a sweep. */
      const col = i % 10;
      const row = Math.floor(i / 10);
      cell.style.animationDelay = `${(col + row) * 14}ms`;
      wipe.insertBefore(cell, badge);
    }

    const swap = (name) => {
      Object.values(screens).forEach((el) => el.classList.remove('is-active'));
      screens[name].classList.add('is-active');
      current = name;
      Hud.setWorld(WORLD_LABELS[name] || '1-1');
      World.setMood(name === 'title' ? 'day' : 'dusk');
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    /* go(name, {badge}) — wipe closed, swap, wipe open. */
    const go = async (name, opts = {}) => {
      if (busy || name === current) return;
      if (!screens[name]) return;

      if (prefersReducedMotion()) { swap(name); return; }

      busy = true;
      Sfx.play('warp');
      badge.textContent = opts.badge || '';
      wipe.classList.add('is-running', 'is-closing');
      await wait(440);

      swap(name);

      wipe.classList.remove('is-closing');
      wipe.classList.add('is-opening');
      await wait(440);

      wipe.classList.remove('is-running', 'is-opening');
      badge.textContent = '';
      busy = false;

      if (opts.onArrive) opts.onArrive();
    };

    return { go, get current() { return current; } };
  })();

  /* =================================================================
     DOMAINS — render cards, multi-select with no maximum
  ================================================================= */
  const Domains = (() => {
    const grid = $('domain-grid');
    const summary = $('selected-summary');
    const bar = $('selected-bar');
    const chips = $('recap-chips');
    const selected = new Set();

    const byId = (id) => DOMAINS.find((d) => d.id === id);

    const render = () => {
      grid.innerHTML = '';
      DOMAINS.forEach((d) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'domain-card';
        card.dataset.id = d.id;
        card.style.setProperty('--card-accent', d.accent);
        card.setAttribute('aria-pressed', 'false');
        card.innerHTML = `
          <span class="domain-card__stamp"><i class="coin coin--sm"></i>SELECTED</span>
          <span class="domain-card__art">
            <svg viewBox="0 0 42 42" aria-hidden="true">${d.art}</svg>
          </span>
          <span class="domain-card__text">
            <span class="domain-card__role">${d.name}</span><br>
            <span class="domain-card__label">${d.label}</span>
            <span class="domain-card__desc">${d.desc}</span>
          </span>`;
        card.addEventListener('click', () => toggle(d.id, card));
        grid.appendChild(card);
      });
      Tilt.bind(grid.querySelectorAll('.domain-card'));
    };

    const toggle = (id, card) => {
      if (selected.has(id)) {
        selected.delete(id);
        card.classList.remove('is-selected');
        card.classList.add('is-deselecting');
        setTimeout(() => card.classList.remove('is-deselecting'), 320);
        card.setAttribute('aria-pressed', 'false');
        Sfx.play('deselect');
        Hud.addCoin(-1);
      } else {
        selected.add(id);
        card.classList.add('is-selected');
        card.setAttribute('aria-pressed', 'true');
        Sfx.play('coin');
        Fx.burstFrom(card.querySelector('.domain-card__art'), { count: isSmallScreen() ? 6 : 10 });
        Fx.popup(card, '+1 COIN');
        Hud.addCoin(1);
      }
      Alerts.clear('select-alert');
      sync();
      Validate.refreshProgress();
    };

    /* Keep every selected-domain readout in step with the Set. */
    const sync = () => {
      const list = list_();
      const labels = list.map((d) => d.label);

      summary.textContent = labels.length ? labels.join('  •  ') : 'SELECT AT LEAST ONE DOMAIN';
      bar.classList.toggle('is-empty', labels.length === 0);

      chips.innerHTML = '';
      if (!labels.length) {
        const chip = document.createElement('span');
        chip.className = 'chip chip--empty';
        chip.textContent = 'NONE SELECTED';
        chips.appendChild(chip);
      } else {
        labels.forEach((l) => {
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = l;
          chips.appendChild(chip);
        });
      }

      /* Each conditional work-link section exists only while its own
         domain is selected. They are independent: picking both Creatives
         and Tech & Projects shows both fields. */
      CONDITIONAL_FIELDS.forEach((c) => {
        const on = selected.has(c.domainId);
        $(c.sectionId).hidden = !on;
        if (!on) {
          $(c.inputId).value = '';
          Validate.clearField(c.inputId);
        }
      });
    };

    const list_ = () => DOMAINS.filter((d) => selected.has(d.id));

    const clear = () => {
      selected.clear();
      grid.querySelectorAll('.domain-card').forEach((c) => {
        c.classList.remove('is-selected', 'is-deselecting');
        c.setAttribute('aria-pressed', 'false');
      });
      sync();
    };

    return {
      render,
      sync,
      clear,
      has: (id) => selected.has(id),
      get size() { return selected.size; },
      /* Submitted as a readable, comma-separated list of labels. */
      /* Submitted as a readable comma-separated list, e.g.
         "PR, Creatives, Tech". Every selected domain is included —
         there is no maximum and nothing is truncated. */
      toPayload: () => list_().map((d) => d.csv).join(', ')
    };
  })();

  /* =================================================================
     TILT — subtle pointer-follow 3D on desktop only
  ================================================================= */
  const Tilt = (() => {
    const MAX = 7;   // degrees

    const bind = (nodes) => {
      if (isTouch() || prefersReducedMotion()) return;
      nodes.forEach((el) => {
        let frame = null;

        const move = (e) => {
          const r = el.getBoundingClientRect();
          const rx = ((e.clientY - r.top) / r.height - 0.5) * -2 * MAX;
          const ry = ((e.clientX - r.left) / r.width - 0.5) * 2 * MAX;
          if (frame) cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            el.style.transform =
              `perspective(700px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-6px)`;
          });
        };

        const leave = () => {
          if (frame) cancelAnimationFrame(frame);
          el.style.transform = '';
        };

        el.addEventListener('pointermove', move);
        el.addEventListener('pointerleave', leave);
        el.addEventListener('blur', leave);
      });
    };

    return { bind };
  })();

  /* =================================================================
     ALERTS — pixel banners, never window.alert()
  ================================================================= */
  const Alerts = (() => {
    const show = (id, msg) => {
      const el = $(id);
      el.textContent = `⚠ ${msg}`;
      el.classList.remove('is-shown');
      void el.offsetWidth;
      el.classList.add('is-shown');
    };
    const clear = (id) => {
      const el = $(id);
      el.textContent = '';
      el.classList.remove('is-shown');
    };
    return { show, clear };
  })();

  /* =================================================================
     VALIDATE
     Rules live in one table so the frontend contract is easy to read
     and mirrors apps-script/Code.gs exactly.
  ================================================================= */
  const Validate = (() => {
    const form = $('application-form');

    /* Strip spaces, dashes, brackets and a +91 / 0 prefix. */
    const normalizeMobile = (v) =>
      String(v).replace(/[\s()\-.]/g, '').replace(/^(\+91|0091|91(?=\d{10}$)|0)/, '');

    const isHttpUrl = (v) => {
      try {
        const u = new URL(v.trim());
        return /^https?:$/.test(u.protocol) && /\./.test(u.hostname);
      } catch (_) {
        return false;
      }
    };

    /* A UID must look like a real SPIT UID: mixed letters+digits or a
       plain numeric roll of sensible length — not "aaaaaa" or "111". */
    const isPlausibleUid = (raw) => {
      const v = raw.trim();
      if (!/^[A-Za-z0-9/-]{5,20}$/.test(v)) return false;
      const bare = v.replace(/[^A-Za-z0-9]/g, '');
      if (!/\d/.test(bare)) return false;                 // must carry digits
      if (/^(\d)\1+$/.test(bare)) return false;           // 111111
      if (/^0+$/.test(bare)) return false;
      if (new Set(bare.toLowerCase()).size < 3) return false;
      return true;
    };

    /* Reject filler like "aaaaaaaaaaaa" or "asdasdasdasd" in answers. */
    const isMeaningfulText = (raw, min) => {
      const v = raw.trim().replace(/\s+/g, ' ');
      if (v.length < min) return false;
      if (!/[A-Za-z]/.test(v)) return false;
      const words = v.split(' ').filter((w) => w.length > 1);
      if (words.length < 5) return false;
      if (new Set(v.toLowerCase().replace(/[^a-z]/g, '')).size < 8) return false;
      return true;
    };

    const RULES = {
      'field-name': {
        test: (v) => /^(?=.*[A-Za-z])[A-Za-z][A-Za-z .'-]{1,49}$/.test(v.trim()),
        msg: 'ENTER A VALID NAME (2+ LETTERS)'
      },
      'field-branch': {
        test: (v) => BRANCHES.includes(v),
        msg: 'CHOOSE CE, CSE OR EXTC'
      },
      'field-uid': {
        test: isPlausibleUid,
        msg: 'ENTER YOUR REAL SPIT UID'
      },
      'field-email': {
        test: (v) => /^[A-Z0-9._%+-]+@spit\.ac\.in$/i.test(v.trim()),
        msg: 'ONLY SPIT EMAILS ALLOWED (@spit.ac.in)'
      },
      'field-mobile': {
        test: (v) => /^[6-9]\d{9}$/.test(normalizeMobile(v)),
        msg: 'CHECK YOUR MOBILE NUMBER (10 DIGITS)'
      },
      'field-why': {
        test: (v) => isMeaningfulText(v, 30),
        msg: 'TELL US A LITTLE MORE! (30+ CHARACTERS)'
      },
      'field-impact': {
        test: (v) => isMeaningfulText(v, 30),
        msg: 'IMAGINE YOUR IMPACT! (30+ CHARACTERS)'
      },
      'field-portfolio': {
        test: (v) => !v.trim() || isHttpUrl(v),
        msg: 'ENTER A VALID LINK STARTING WITH HTTPS://',
        optional: true
      },
      'field-worklink': {
        test: (v) => !v.trim() || isHttpUrl(v),
        msg: 'ENTER A VALID LINK STARTING WITH HTTPS://',
        optional: true
      }
    };

    /* Required ids, in DOM order — drives progress and focus-first-error. */
    const REQUIRED = Object.keys(RULES).filter((id) => !RULES[id].optional);

    /* A conditional field is only validated while its domain is selected. */
    const isActive = (id) => {
      const cond = CONDITIONAL_FIELDS.filter((c) => c.inputId === id)[0];
      return !cond || Domains.has(cond.domainId);
    };

    const setState = (id, ok, msg) => {
      const input = $(id);
      const field = input.closest('.field');
      const err = $(`err-${id.replace('field-', '')}`);
      const filled = input.value.trim().length > 0;

      field.classList.toggle('is-invalid', !ok);
      field.classList.toggle('is-valid', ok && filled);
      input.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (err) err.textContent = ok ? '' : `⚠ ${msg}`;

      if (!ok) {
        field.classList.remove('is-shaking');
        void field.offsetWidth;
        field.classList.add('is-shaking');
        setTimeout(() => field.classList.remove('is-shaking'), 340);
      }
    };

    const clearField = (id) => {
      const input = $(id);
      const field = input.closest('.field');
      const err = $(`err-${id.replace('field-', '')}`);
      field.classList.remove('is-invalid', 'is-valid', 'just-completed');
      input.removeAttribute('aria-invalid');
      if (err) err.textContent = '';
    };

    const field = (id, { silent = false, reward = false } = {}) => {
      if (!isActive(id)) return true;
      const rule = RULES[id];
      const ok = rule.test($(id).value);
      if (!silent) setState(id, ok, rule.msg);

      if (ok && reward) {
        const wrap = $(id).closest('.field');
        if (!wrap.dataset.rewarded) {
          wrap.dataset.rewarded = '1';
          wrap.classList.add('just-completed');
          Sfx.play('coin');
          Hud.addCoin(1);
          setTimeout(() => wrap.classList.remove('just-completed'), 760);
        }
      }
      return ok;
    };

    /* field() returns true for any conditional field whose domain is not
       selected, so this covers required and optional rules alike. */
    const all = () => Object.keys(RULES).map((id) => field(id)).every(Boolean);

    const refreshProgress = () => {
      const done = REQUIRED.filter((id) => RULES[id].test($(id).value)).length +
                   (Domains.size > 0 ? 1 : 0);
      const total = REQUIRED.length + 1;
      const pct = Math.round((done / total) * 100);
      $('progress-fill').style.width = `${pct}%`;
      $('progress-label').textContent = `${pct}%`;
      $('progress-sr').textContent = `Mission progress ${pct} percent`;
    };

    const focusFirstInvalid = () => {
      const bad = form.querySelector('.field.is-invalid input, .field.is-invalid select, .field.is-invalid textarea');
      if (bad) {
        bad.focus();
        bad.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    };

    const init = () => {
      Object.keys(RULES).forEach((id) => {
        const input = $(id);

        /* While typing: clear the error, don't nag mid-word. */
        input.addEventListener('input', () => {
          const wrap = input.closest('.field');
          wrap.classList.remove('is-invalid');
          const err = $(`err-${id.replace('field-', '')}`);
          if (err) err.textContent = '';
          if (!RULES[id].test(input.value)) delete wrap.dataset.rewarded;
          Alerts.clear('submit-alert');
          refreshProgress();
        });

        /* On blur: validate for real and pay out the coin. */
        input.addEventListener('blur', () => {
          if (input.value.trim() || input.closest('.field').classList.contains('is-invalid')) {
            field(id, { reward: true });
          }
          refreshProgress();
        });

        if (input.tagName === 'SELECT') {
          input.addEventListener('change', () => { field(id, { reward: true }); refreshProgress(); });
        }
      });
      refreshProgress();
    };

    const reset = () => {
      Object.keys(RULES).forEach((id) => {
        clearField(id);
        delete $(id).closest('.field').dataset.rewarded;
      });
      refreshProgress();
    };

    return {
      init, all, field, clearField, reset, refreshProgress,
      focusFirstInvalid, normalizeMobile, RULES
    };
  })();

  /* =================================================================
     SUBMIT
  ================================================================= */
  const Submit = (() => {
    const form = $('application-form');
    const btn = $('submit-btn');
    let inFlight = false;

    /* Carries two messages: `message` is safe to show an applicant,
       `detail` is a deployment hint meant only for the console. */
    class SubmitError extends Error {
      constructor(message, detail) {
        super(message);
        this.name = 'SubmitError';
        this.detail = detail || '';
      }
    }

    const buildPayload = () => ({
      name: $('field-name').value.trim().replace(/\s+/g, ' '),
      branch: $('field-branch').value,
      uid: $('field-uid').value.trim().toUpperCase(),
      email: $('field-email').value.trim().toLowerCase(),
      mobile: Validate.normalizeMobile($('field-mobile').value),
      domains: Domains.toPayload(),
      whyJoin: $('field-why').value.trim(),
      socialImpact: $('field-impact').value.trim(),
      /* Each work link is sent only when its own domain is selected. */
      portfolio: Domains.has('creatives') ? $('field-portfolio').value.trim() : '',
      workLink: Domains.has('techprojects') ? $('field-worklink').value.trim() : '',
      applicationYear: APPLICATION_YEAR
    });

    const setLoading = (on) => {
      btn.disabled = on;
      btn.classList.toggle('is-loading', on);
      btn.setAttribute('aria-busy', String(on));
    };

    const onSubmit = async (e) => {
      e.preventDefault();
      if (inFlight) return;                 // hard guard against double submits
      Alerts.clear('submit-alert');

      /* At least one domain is mandatory — bounce back to level select. */
      if (Domains.size === 0) {
        Sfx.play('error');
        Alerts.show('submit-alert', 'CHOOSE AT LEAST ONE DOMAIN');
        await Screens.go('select', { badge: 'CHOOSE YOUR DOMAINS' });
        Alerts.show('select-alert', 'CHOOSE AT LEAST ONE DOMAIN');
        return;
      }

      if (!Validate.all()) {
        Sfx.play('error');
        Alerts.show('submit-alert', 'COIN LOST! CHECK THE HIGHLIGHTED FIELDS.');
        Validate.focusFirstInvalid();
        return;
      }

      inFlight = true;
      setLoading(true);

      try {
        const payload = buildPayload();

        /* URL-encoded form data. Apps Script exposes these directly as
           e.parameter.<key>, and the browser treats the request as
           CORS-simple, so no preflight OPTIONS is sent (Apps Script
           cannot answer OPTIONS). The same values also go out as a
           JSON `payload` field so a doPost that reads
           e.postData.contents keeps working unchanged. */
        const body = new URLSearchParams();
        Object.keys(payload).forEach((k) => body.append(k, payload[k]));
        body.append('payload', JSON.stringify(payload));

        let res;
        try {
          res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: body,
            redirect: 'follow'
          });
        } catch (netErr) {
          /* A TypeError here means the browser discarded the response
             before we could read it. With an Apps Script endpoint this
             is essentially always the deployment being login-walled:
             /exec 302s to a Google sign-in page that sends no
             Access-Control-Allow-Origin header. */
          throw new SubmitError(
            "COULDN'T REACH THE SERVER — PLEASE TRY AGAIN.",
            'The request never returned a CORS-readable response.\n' +
            'Endpoint: ' + SCRIPT_URL + '\n' +
            'Redeploy the Web App with "Who has access: Anyone".'
          );
        }

        const raw = await res.text();
        let data;
        try { data = JSON.parse(raw); } catch (_) { data = null; }

        if (!data) {
          /* We got a response, but it was not our JSON — typically the
             Google sign-in HTML page. */
          const looksLikeLogin = /ServiceLogin|Sign in - Google|accounts\.google\.com/i.test(raw);
          throw new SubmitError(
            "COULDN'T REACH THE SERVER — PLEASE TRY AGAIN.",
            (looksLikeLogin
              ? 'The Web App returned a Google sign-in page instead of JSON, so the ' +
                'deployment is restricted. Redeploy with "Who has access: Anyone".'
              : 'Expected JSON but got a non-JSON response.') +
            '\nHTTP ' + res.status + ': ' + (raw.slice(0, 160) || '(empty body)')
          );
        }

        /* Backend answered. Trust ONLY an explicit success === true. */
        if (data.success !== true) {
          /* A real validation message from Code.gs — show it verbatim. */
          throw new SubmitError(data.message || 'SOMETHING WENT WRONG! PLEASE TRY AGAIN.');
        }

        /* Confirmed by the backend — only now clear and celebrate. */
        Sfx.play('complete');
        resetApplication();
        await Screens.go('success', { badge: 'LEVEL COMPLETE!' });
        Fx.confetti();
        Fx.burst(window.innerWidth / 2, window.innerHeight / 2, { count: 22, kind: 'star', spread: 180 });
        Hud.setCoins(99);
      } catch (err) {
        /* Failure path: keep every entered value so the user can retry. */
        Sfx.play('error');
        const msg = (err && err.message ? String(err.message) : '').slice(0, 140);
        Alerts.show('submit-alert', msg.toUpperCase() || 'SOMETHING WENT WRONG! PLEASE TRY AGAIN.');
        if (err && err.detail) {
          console.error('[Enactus] Submission blocked before it reached the script.\n' + err.detail);
        }
      } finally {
        inFlight = false;
        setLoading(false);
      }
    };

    const init = () => form.addEventListener('submit', onSubmit);
    return { init };
  })();

  /* =================================================================
     RESET — a blank slate. Called on load and after a confirmed save.
     Never called on failure.
  ================================================================= */
  function resetApplication() {
    $('application-form').reset();
    /* explicit: the work-link fields must never be prefilled */
    CONDITIONAL_FIELDS.forEach((c) => {
      $(c.inputId).value = '';
      $(c.sectionId).hidden = true;
    });
    Domains.clear();
    Validate.reset();
    Alerts.clear('submit-alert');
    Alerts.clear('select-alert');
    Hud.reset();
  }

  /* =================================================================
     TITLE SCREEN CHOREOGRAPHY
     Hero walks in from the left, stops centre, turns to the title,
     then hops once to acknowledge it.
  ================================================================= */
  function playTitleIntro() {
    const stage = $('hero-stage');
    const hero = $('title-hero');
    if (!stage || !hero) return;

    if (prefersReducedMotion()) {
      stage.dataset.state = 'arrived';
      hero.className = 'hero hero--idle';
      return;
    }

    requestAnimationFrame(() => { stage.dataset.state = 'arrived'; });

    setTimeout(() => {
      hero.className = 'hero hero--idle';                 // stops, looks up
      setTimeout(() => {
        hero.classList.add('hero--jump');                 // small hop
        Sfx.play('click');
        Fx.burstFrom(hero, { count: 6 });
        setTimeout(() => hero.classList.remove('hero--jump'), 700);
      }, 500);
    }, 1950);
  }

  /* =================================================================
     WIRE-UP
  ================================================================= */
  function init() {
    /* A /a/macros/<domain>/ endpoint is a Workspace-restricted
       deployment: it 302s to a Google login page that carries no CORS
       headers, so every submission fails before it reaches the script.
       Warn the developer loudly; applicants never see this. */
    if (/\/a\/macros\//.test(SCRIPT_URL)) {
      console.warn(
        '[Enactus] The endpoint is a Workspace-restricted deployment (/a/macros/...).\n' +
        'It answers signed-in SPIT accounts but returns a Google sign-in page to ' +
        'everyone else, and fetch() omits cookies, so submissions cannot succeed.\n' +
        'Redeploy the Web App with "Who has access: Anyone" and use the resulting ' +
        'https://script.google.com/macros/s/.../exec URL.'
      );
    }

    Domains.render();
    Domains.sync();
    Validate.init();
    Submit.init();
    World.init();
    Tilt.bind(document.querySelectorAll('.social-card'));

    /* Fresh load is always empty — nothing is ever restored. */
    resetApplication();
    playTitleIntro();

    /* --- sound toggle --- */
    $('sound-toggle').addEventListener('click', (e) => {
      const on = Sfx.toggle();
      e.currentTarget.setAttribute('aria-pressed', String(on));
      $('sound-icon').innerHTML = on ? '&#128266;' : '&#128263;';
      $('sound-label').textContent = on ? 'SFX ON' : 'SFX OFF';
    });

    /* --- PRESS START --- */
    $('press-start').addEventListener('click', (e) => {
      Sfx.play('start');
      Fx.burstFrom(e.currentTarget, { count: isSmallScreen() ? 10 : 18, spread: 110 });
      Screens.go('select', { badge: 'WORLD 1-2\nCHOOSE YOUR DOMAINS' });
    });

    /* --- navigation --- */
    $('back-to-title').addEventListener('click', () => {
      Sfx.play('click');
      Screens.go('title');
    });

    $('continue-to-form').addEventListener('click', (e) => {
      if (Domains.size === 0) {
        Sfx.play('error');
        Alerts.show('select-alert', 'CHOOSE AT LEAST ONE DOMAIN');
        return;
      }
      Sfx.play('start');
      Fx.burstFrom(e.currentTarget, { count: 12 });
      Alerts.clear('select-alert');
      Screens.go('form', {
        badge: 'LEVEL 1\nPLAYER PROFILE',
        onArrive: () => Validate.refreshProgress()
      });
    });

    $('back-to-select').addEventListener('click', () => {
      Sfx.play('click');
      Screens.go('select');
    });

    $('edit-domains').addEventListener('click', () => {
      Sfx.play('click');
      Screens.go('select', { badge: 'CHOOSE YOUR DOMAINS' });
    });

    $('back-to-start').addEventListener('click', () => {
      Sfx.play('click');
      resetApplication();
      Screens.go('title');
    });

    /* Keyboard shortcut: Enter/Space on the title screen starts the game. */
    document.addEventListener('keydown', (e) => {
      if (Screens.current !== 'title') return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
      e.preventDefault();
      $('press-start').click();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

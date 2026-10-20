// ==UserScript==
// @name         Mini Hero - Work All
// @namespace    minihero.workall
// @version      1.8.2
// @description  GO WORK quando energia e habilitados fecham, com tempo, farm e preço do MHDG
// @match        https://dg.minihero.org/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'mh-workall-v1';
  const DEFAULT_WAIT_MINUTES = 30;
  const DEFAULT_CHECK_MINUTES = 1;
  const DEFAULT_ENERGY_MINUTES = 1;
  const DEFAULT_MIN_ENERGY = 30;
  const DEFAULT_MIN_HEROES = 1;
  const ARENA_SLOTS = 15;
  const MHDG_MINT = '2fk5eGwAch1wGhsK3XhRUZpopXFGyRbFUn6XL4Yxpump';
  const PRICE_URL = 'https://api.dexscreener.com/latest/dex/tokens/' + MHDG_MINT;
  const CHEST_SAMPLE_MS = 120000;

  const state = {
    running: false,
    timer: null,
    countdownTimer: null,
    nextCheckAt: 0,
    nextEnergyAt: 0,
    busy: false,
    dragging: false,
    picking: false,
    sampling: false,
    priceUsd: null,
    priceChange: null,
  };

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (error) {
      return {};
    }
  }

  function save(partial) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...load(), ...partial }));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function waitFor(finder, timeout) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (!state.running) {
          resolve(null);
          return;
        }
        const element = finder();
        if (element) {
          resolve(element);
          return;
        }
        if (Date.now() - start >= timeout) {
          resolve(null);
          return;
        }
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  function clickEl(element) {
    const rect = element.getBoundingClientRect();
    const options = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    };
    element.dispatchEvent(new PointerEvent('pointerdown', options));
    element.dispatchEvent(new MouseEvent('mousedown', options));
    element.dispatchEvent(new PointerEvent('pointerup', options));
    element.dispatchEvent(new MouseEvent('mouseup', options));
    element.click();
  }

  function formatClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const mins = Math.floor(total / 60);
    const secs = String(total % 60).padStart(2, '0');
    return mins + ':' + secs;
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = String(total % 60).padStart(2, '0');
    if (hours > 0) return hours + 'h ' + String(mins).padStart(2, '0') + 'm';
    return mins + ':' + secs;
  }

  function formatMhdg(value) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatPrice(value) {
    if (!Number.isFinite(value)) return '—';
    if (value >= 1) return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 4 });
    if (value >= 0.01) return '$' + value.toFixed(4);
    return '$' + value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  }

  function formatUsd(value) {
    if (!Number.isFinite(value)) return '—';
    if (value >= 1) return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return '$' + value.toFixed(4);
  }

  function parseAmount(text) {
    const cleaned = String(text || '').replace(/[^\d.,-]/g, '');
    if (!cleaned) return null;
    const value = Number(cleaned.replace(/,/g, ''));
    return Number.isFinite(value) ? value : null;
  }

  function heroesRoot() {
    const labels = document.querySelectorAll('.fab-label');
    for (const label of labels) {
      if (label.textContent.trim().toUpperCase() === 'HEROES') {
        return label.closest('button') || label.closest('[class*="heroes"]') || label.parentElement;
      }
    }
    return null;
  }

  function readWorking() {
    const root = heroesRoot();
    const countEl = (root && root.querySelector('.fab-count')) || document.querySelector('.fab-count');
    if (!countEl) return null;
    const match = countEl.textContent.match(/(\d+)\s*\/\s*\d+/);
    return match ? Number(match[1]) : null;
  }

  function findBack() {
    return document.querySelector('.topbar-back button.back-btn, button.back-btn, button[aria-label="Back"]');
  }

  function findEnabledGoWork() {
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^GO WORK$/i.test(text) && !button.disabled) return button;
    }
    return null;
  }

  function readHeroEnergies() {
    return [...document.querySelectorAll('.dur-bar[data-dur-hero]')].map((bar) => {
      const label = bar.getAttribute('aria-label') || '';
      const match = label.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
      const current = match ? Number(match[1].replace(/,/g, '')) : 0;
      const max = match ? Number(match[2].replace(/,/g, '')) : 0;
      const row = bar.closest('.roster-row');
      return {
        id: bar.dataset.durHero,
        current,
        max,
        percent: max > 0 ? (current / max) * 100 : 0,
        status: row ? row.dataset.status || '' : '',
        forge: row ? row.dataset.forge || 'false' : 'false',
        row,
      };
    });
  }

  function splitHeroes(heroes) {
    const minPercent = readPercent(energyInput);
    const fit = [];
    const skip = [];
    for (const hero of heroes) {
      const enabled = hero.status === 'resting' && hero.forge !== 'true' && hero.percent >= minPercent && hero.row;
      if (enabled) fit.push(hero);
      else skip.push(hero);
    }
    return { fit, skip, minPercent };
  }

  function updateHeroCounts() {
    const heroes = readHeroEnergies();
    if (heroes.length === 0) {
      fitEl.textContent = '—';
      skipEl.textContent = '—';
      return { fit: [], skip: [] };
    }
    const split = splitHeroes(heroes);
    fitEl.textContent = String(split.fit.length);
    skipEl.textContent = String(split.skip.length);
    return split;
  }

  function paintEnergyLine() {
    if (!state.nextEnergyAt) {
      energyLine.textContent = 'Energia —';
      return;
    }
    energyLine.textContent = 'Energia ' + formatClock(state.nextEnergyAt - Date.now());
  }

  function armEnergyCheck() {
    const minutes = readMinutes(energyCheckInput, DEFAULT_ENERGY_MINUTES);
    energyCheckInput.value = String(minutes);
    state.nextEnergyAt = Date.now() + minutes * 60 * 1000;
    paintEnergyLine();
  }

  async function showActiveHeroes() {
    const toggles = document.querySelectorAll('.roster-tools button.toggle, .heroes-tools button.toggle');
    for (const toggle of toggles) {
      if (!/^ACTIVE/i.test((toggle.textContent || '').trim())) continue;
      if (toggle.getAttribute('aria-checked') !== 'true') {
        clickEl(toggle);
        await sleep(500);
      }
      return;
    }
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function readMinutes(input, fallback) {
    const value = Math.round(Number(input.value));
    if (!Number.isFinite(value) || value < 1) return fallback;
    return value;
  }

  function readPercent(input) {
    const value = Math.round(Number(input.value));
    if (!Number.isFinite(value) || value < 0) return DEFAULT_MIN_ENERGY;
    return Math.min(100, value);
  }

  function readMinHeroes() {
    const value = Math.round(Number(minHeroesInput.value));
    if (!Number.isFinite(value) || value < 1) return DEFAULT_MIN_HEROES;
    return Math.min(ARENA_SLOTS, value);
  }

  function currentRunMs() {
    const saved = load();
    const base = saved.runMs || 0;
    if (state.running && saved.runSince) return base + (Date.now() - saved.runSince);
    return base;
  }

  function commitRunTime() {
    if (!state.running) return;
    const saved = load();
    if (!saved.runSince) return;
    const now = Date.now();
    save({ runMs: (saved.runMs || 0) + (now - saved.runSince), runSince: now });
  }

  function paintTime() {
    timeEl.textContent = formatDuration(currentRunMs());
  }

  function paintPill() {
    pillEl.textContent = state.running ? 'ligado' : 'parado';
    pillEl.classList.toggle('is-on', state.running);
    runBtn.textContent = state.running ? 'Parar' : 'Executar';
    runBtn.classList.toggle('is-stop', state.running);
  }

  function paintFarm() {
    const saved = load();
    if (saved.lastChest == null) farmedEl.textContent = '—';
    else farmedEl.textContent = formatMhdg(saved.lastChest);
    const session = saved.farmed || 0;
    if (session > 0.009) sessionEl.textContent = '+' + formatMhdg(session) + ' nesta sessão';
    else sessionEl.textContent = saved.lastChest == null ? 'lendo o baú' : 'total no baú';
    walletNowEl.textContent = saved.lastWallet == null ? '—' : formatMhdg(saved.lastWallet);
    paintUsd();
  }

  function paintUsd() {
    const saved = load();
    const chest = saved.lastChest;
    if (!Number.isFinite(state.priceUsd) || chest == null) {
      usdEl.textContent = '—';
      return;
    }
    usdEl.textContent = formatUsd(chest * state.priceUsd);
  }

  function paintPrice() {
    priceEl.textContent = formatPrice(state.priceUsd);
    if (!Number.isFinite(state.priceChange)) {
      priceChangeEl.textContent = 'DexScreener';
      priceChangeEl.className = 'mh-change';
      return;
    }
    const up = state.priceChange >= 0;
    priceChangeEl.textContent = (up ? '+' : '') + state.priceChange.toFixed(1) + '% 24h';
    priceChangeEl.className = 'mh-change ' + (up ? 'is-up' : 'is-down');
    paintUsd();
  }

  function noteChest(value) {
    const saved = load();
    const missing = saved.lastChest == null || (saved.lastChest === 0 && value > 0 && !(saved.farmed > 0));
    if (missing) {
      save({ lastChest: value });
      paintFarm();
      return;
    }
    const delta = value - saved.lastChest;
    if (delta > 0.009) save({ lastChest: value, farmed: (saved.farmed || 0) + delta });
    else if (delta < -0.009) save({ lastChest: value });
    paintFarm();
  }

  function noteWallet(value) {
    const saved = load();
    if (saved.lastWallet === value) {
      walletNowEl.textContent = formatMhdg(value);
      return;
    }
    save({ lastWallet: value });
    paintFarm();
  }

  function readWallet() {
    return parseAmount(document.querySelector('.mhdg-value')?.textContent);
  }

  function readChest() {
    const root = document.querySelector('.chest-reward.chest-mhdg .chest-value');
    if (!root) return null;
    const chunks = [...root.querySelectorAll('span')]
      .map((element) => element.textContent.trim())
      .filter((text) => /\d/.test(text));
    return parseAmount(chunks.length ? chunks[chunks.length - 1] : root.textContent);
  }

  async function readStableChest() {
    let last = null;
    let repeats = 0;
    const start = Date.now();
    while (Date.now() - start < 2500) {
      const value = readChest();
      if (value != null && value === last) repeats += 1;
      else repeats = 0;
      last = value;
      if (repeats >= 2 && value != null) return value;
      await sleep(200);
    }
    return last;
  }

  function watchBalances() {
    const observer = new MutationObserver(() => {
      const wallet = readWallet();
      if (wallet != null) noteWallet(wallet);
      const chest = readChest();
      if (chest != null) noteChest(chest);
    });
    const hook = () => {
      const topbar = document.querySelector('#topbar');
      const modal = document.querySelector('#modal-root');
      if (topbar) observer.observe(topbar, { subtree: true, childList: true, characterData: true });
      if (modal) observer.observe(modal, { subtree: true, childList: true, characterData: true });
    };
    hook();
    setInterval(hook, 3000);
    const wallet = readWallet();
    if (wallet != null) noteWallet(wallet);
  }

  function onHeroesScreen() {
    return document.querySelectorAll('.dur-bar[data-dur-hero]').length > 0;
  }

  async function closeChestIfOpen() {
    const close = document.querySelector('.panel-chest .close-btn');
    if (!close) return;
    clickEl(close);
    await sleep(300);
  }

  async function sampleChest() {
    if (state.sampling || state.picking || state.dragging || state.busy) return;
    if (onHeroesScreen()) return;
    const working = readWorking();
    if (working === 0 || working === null) return;
    const alreadyOpen = !!document.querySelector('.panel-chest');
    if (!alreadyOpen && document.querySelector('#modal-root .panel')) return;
    const button = document.querySelector('.chest-btn');
    if (!alreadyOpen && !button) return;
    state.sampling = true;
    try {
      if (!alreadyOpen) clickEl(button);
      const chest = await readStableChest();
      if (chest != null) noteChest(chest);
      if (!alreadyOpen) await closeChestIfOpen();
    } finally {
      state.sampling = false;
    }
  }

  async function refreshPrice() {
    try {
      const response = await fetch(PRICE_URL, { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const pairs = (data.pairs || []).filter((pair) => pair.baseToken && pair.baseToken.address === MHDG_MINT);
      pairs.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
      const best = pairs[0];
      if (!best || !Number.isFinite(Number(best.priceUsd))) return;
      state.priceUsd = Number(best.priceUsd);
      state.priceChange = best.priceChange ? Number(best.priceChange.h24) : null;
      save({ priceUsd: state.priceUsd, priceChange: state.priceChange, priceAt: Date.now() });
      paintPrice();
    } catch (error) {
      paintPrice();
    }
  }

  function paintCountdown() {
    updateHeroCounts();
    paintEnergyLine();
    paintTime();
    if (!state.running || state.busy || !state.nextCheckAt) return;
    const working = readWorking();
    if (working === null) {
      setStatus('Procurando a tela do jogo. A varredura volta sozinha.');
      return;
    }
    if (working > 0) {
      setStatus(working + '/15 working. A aba de energia abre quando zerar · ' + formatClock(state.nextCheckAt - Date.now()));
      return;
    }
    setStatus('Working em 0. Abrindo a energia em ' + formatClock(state.nextCheckAt - Date.now()));
  }

  function tickCountdown() {
    clearInterval(state.countdownTimer);
    paintCountdown();
    state.countdownTimer = setInterval(paintCountdown, 1000);
  }

  async function waitOnHeroes(minutes) {
    const end = Date.now() + minutes * 60 * 1000;
    armEnergyCheck();
    while (Date.now() < end) {
      if (!state.running) return false;
      if (Date.now() >= state.nextEnergyAt) armEnergyCheck();
      updateHeroCounts();
      paintEnergyLine();
      setStatus('Na tela Heroes. GO WORK em ' + formatClock(end - Date.now()));
      await sleep(1000);
    }
    return state.running;
  }

  async function waitForMinHeroes() {
    const minHeroes = readMinHeroes();
    minHeroesInput.value = String(minHeroes);
    while (state.running) {
      await showActiveHeroes();
      const split = updateHeroCounts();
      if (split.fit.length >= minHeroes) return true;
      armEnergyCheck();
      while (state.running && Date.now() < state.nextEnergyAt) {
        updateHeroCounts();
        paintEnergyLine();
        setStatus(split.fit.length + '/' + minHeroes + ' habilitados. GO WORK aguardando.');
        await sleep(1000);
      }
    }
    return false;
  }

  async function leaveHeroes() {
    const back = await waitFor(findBack, 5000);
    if (back) clickEl(back);
  }

  async function waitIdleSample() {
    const start = Date.now();
    while (state.sampling && Date.now() - start < 3000) await sleep(100);
  }

  async function workByEnergy() {
    await waitIdleSample();
    state.picking = true;
    try {
      const minHeroes = readMinHeroes();
      const tried = new Set();
      let sent = 0;

      for (let step = 0; step < ARENA_SLOTS && state.running; step += 1) {
        await showActiveHeroes();
        const heroes = readHeroEnergies();
        const split = updateHeroCounts();
        if (split.fit.length < minHeroes && sent === 0) return;
        const working = heroes.filter((hero) => hero.status === 'working').length;
        if (working >= ARENA_SLOTS) {
          setStatus('Arena cheia: ' + working + '/15.');
          break;
        }

        const next = split.fit.filter((hero) => !tried.has(hero.id)).sort((a, b) => b.percent - a.percent)[0];
        if (!next) {
          setStatus(sent === 0
            ? 'Nenhum habilitado com ' + split.minPercent + '% ou mais.'
            : 'GO WORK em ' + sent + ' heróis. O resto ficou fora.');
          return;
        }

        tried.add(next.id);
        next.row.scrollIntoView({ block: 'center' });
        clickEl(next.row);
        setStatus('Selecionando #' + next.id + ' · ' + next.current + '/' + next.max);
        await sleep(500);

        const go = await waitFor(findEnabledGoWork, 4000);
        if (!go) continue;
        clickEl(go);
        sent += 1;
        setStatus('GO WORK em #' + next.id + ' · ' + sent + ' enviado(s)');
        await sleep(700);
      }

      if (sent > 0) setStatus('Entraram na arena: ' + sent + ' heróis.');
    } finally {
      state.picking = false;
    }
  }

  async function cycle() {
    const hud = document.querySelector('.fab-count, .heroes-fab');
    const alreadyThere = onHeroesScreen();
    if (!hud && !alreadyThere) {
      setStatus('Aguardando o jogo carregar...');
      return 'soon';
    }

    const working = readWorking();
    if (working === null && !alreadyThere) {
      setStatus('Aguardando o contador de working...');
      return 'soon';
    }
    if (working > 0) return;

    if (!alreadyThere) {
      const heroes = heroesRoot();
      if (!heroes) {
        setStatus('Working está em 0, mas não achei Heroes.');
        return 'soon';
      }
      await closeChestIfOpen();
      clickEl(heroes);
      setStatus('Entrando em Heroes...');
      await sleep(600);
      if (!state.running) return;
    } else {
      setStatus('Já estou na tela Heroes. Seguindo a varredura.');
      await sleep(400);
    }

    const waitMinutes = readMinutes(waitInput, DEFAULT_WAIT_MINUTES);
    waitInput.value = String(waitMinutes);
    const stillRunning = await waitOnHeroes(waitMinutes);
    if (!stillRunning) {
      await leaveHeroes();
      return;
    }

    const ready = await waitForMinHeroes();
    if (!ready) {
      await leaveHeroes();
      return;
    }

    await workByEnergy();
    if (!state.running) return;
    await sleep(400);
    await leaveHeroes();
  }

  function scheduleCheck(soon) {
    clearTimeout(state.timer);
    const checkMinutes = readMinutes(checkInput, DEFAULT_CHECK_MINUTES);
    checkInput.value = String(checkMinutes);
    save({ checkMinutes });
    const delay = soon ? 5000 : checkMinutes * 60 * 1000;
    state.nextCheckAt = Date.now() + delay;
    state.timer = setTimeout(runLoop, delay);
    tickCountdown();
  }

  async function runLoop() {
    if (!state.running || state.busy) return;
    state.busy = true;
    let soon = false;
    try {
      soon = (await cycle()) === 'soon';
    } catch (error) {
      soon = true;
      setStatus('A varredura falhou. Tentando de novo.');
    } finally {
      state.busy = false;
    }
    if (state.running) scheduleCheck(soon);
  }

  function start() {
    const waitMinutes = readMinutes(waitInput, DEFAULT_WAIT_MINUTES);
    const checkMinutes = readMinutes(checkInput, DEFAULT_CHECK_MINUTES);
    const energyMinutes = readMinutes(energyCheckInput, DEFAULT_ENERGY_MINUTES);
    const minEnergy = readPercent(energyInput);
    const minHeroes = readMinHeroes();
    const previous = load();
    waitInput.value = String(waitMinutes);
    checkInput.value = String(checkMinutes);
    energyCheckInput.value = String(energyMinutes);
    energyInput.value = String(minEnergy);
    minHeroesInput.value = String(minHeroes);
    state.running = true;
    save({
      waitMinutes,
      checkMinutes,
      energyMinutes,
      minEnergy,
      minHeroes,
      running: true,
      runSince: previous.runSince || Date.now(),
      runMs: previous.runMs || 0,
    });
    armEnergyCheck();
    paintPill();
    runLoop();
  }

  function stop() {
    commitRunTime();
    state.running = false;
    state.nextCheckAt = 0;
    state.nextEnergyAt = 0;
    save({ running: false, runSince: null });
    clearTimeout(state.timer);
    clearInterval(state.countdownTimer);
    paintPill();
    paintEnergyLine();
    paintTime();
    setStatus('Parado.');
  }

  function applyDefaults() {
    waitInput.value = String(DEFAULT_WAIT_MINUTES);
    checkInput.value = String(DEFAULT_CHECK_MINUTES);
    energyCheckInput.value = String(DEFAULT_ENERGY_MINUTES);
    energyInput.value = String(DEFAULT_MIN_ENERGY);
    minHeroesInput.value = String(DEFAULT_MIN_HEROES);
  }

  function wipeBotData() {
    state.running = false;
    state.nextCheckAt = 0;
    state.nextEnergyAt = 0;
    clearTimeout(state.timer);
    clearInterval(state.countdownTimer);
    localStorage.removeItem(STORAGE_KEY);
    applyDefaults();
    paintPill();
    paintEnergyLine();
    paintTime();
    paintFarm();
    setStatus('Dados do painel apagados. O login do jogo continua.');
  }

  function placePanel(x, y) {
    const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);
    const left = Math.min(Math.max(8, x), maxX);
    const top = Math.min(Math.max(8, y), maxY);
    panel.style.bottom = 'auto';
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    return { x: left, y: top };
  }

  const saved = load();
  const heroOptions = [];
  for (let count = 1; count <= ARENA_SLOTS; count += 1) {
    heroOptions.push('<option value="' + count + '">' + count + '</option>');
  }

  const style = document.createElement('style');
  style.textContent = [
    '#mh-workall{position:fixed;left:16px;bottom:16px;z-index:2147483647;width:304px;max-width:calc(100vw - 20px);',
    'color:#f7f2e8;font:13px/1.35 Georgia,"Segoe UI",system-ui,sans-serif;',
    'background:radial-gradient(120% 80% at 0% 0%,rgba(224,165,42,.16),transparent 42%),linear-gradient(180deg,#1a140c 0%,#100e12 55%,#0c0d12 100%);',
    'border:1px solid rgba(255,214,140,.38);border-radius:22px;overflow:hidden;touch-action:none;',
    'box-shadow:0 22px 50px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,236,196,.2),inset 0 0 0 1px rgba(0,0,0,.35);}',
    '#mh-workall *{box-sizing:border-box;}',
    '#mh-workall.is-min{width:228px;}',
    '#mh-workall.is-min #mh-body{display:none;}',
    '#mh-handle{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 14px 8px;cursor:move;user-select:none;}',
    '.mh-brand{display:flex;align-items:center;gap:10px;}',
    '.mh-mark{width:42px;height:42px;border-radius:12px;flex:0 0 auto;display:block;object-fit:cover;',
    'box-shadow:0 0 0 1px rgba(255,214,140,.35),0 8px 16px rgba(0,0,0,.4);}',
    '.mh-brand strong{display:block;font:700 15px/1.1 Georgia,serif;letter-spacing:.02em;}',
    '.mh-brand small{color:#cbbfaa;font:11px/1.2 "Segoe UI",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;}',
    '.mh-head-actions{display:flex;align-items:center;gap:6px;}',
    '#mh-pill{font:700 10px/1 "Segoe UI",system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;',
    'padding:5px 8px;border-radius:999px;color:#d9d0c3;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.06);}',
    '#mh-pill.is-on{color:#10211a;background:#d7b25a;border-color:transparent;}',
    '#mh-min,#mh-settings-toggle,#mh-reset{border:0;cursor:pointer;font:inherit;}',
    '#mh-min{width:28px;height:28px;border-radius:9px;color:#f7f2e8;background:rgba(255,255,255,.06);}',
    '#mh-body{padding:4px 14px 14px;font-family:"Segoe UI",system-ui,sans-serif;}',
    '.mh-hero{margin:4px 0 10px;padding:14px 14px 12px;border-radius:16px;text-align:center;',
    'background:linear-gradient(180deg,rgba(255,214,140,.1),rgba(255,255,255,.03));',
    'border:1px solid rgba(255,214,140,.18);box-shadow:inset 0 1px 0 rgba(255,244,214,.12);}',
    '.mh-kicker{display:block;color:#e7d3a4;font-size:11px;letter-spacing:.16em;text-transform:uppercase;}',
    '#mh-farmed{display:block;margin:4px 0 0;font:800 32px/1.05 Georgia,serif;font-variant-numeric:tabular-nums;',
    'background:linear-gradient(180deg,#fff8e4,#ffd56a 48%,#e2a52c);-webkit-background-clip:text;background-clip:text;color:transparent;}',
    '#mh-session{display:block;min-height:16px;margin-top:4px;color:#b7aa96;font-size:11px;}',
    '.mh-worth{display:flex;justify-content:center;align-items:baseline;gap:8px;margin-top:8px;color:#f3eadc;}',
    '#mh-usd{font-size:14px;font-weight:700;}',
    '#mh-price{color:#cbbfaa;font-size:12px;}',
    '.mh-change{font-style:normal;font-size:11px;color:#cbbfaa;}',
    '.mh-change.is-up{color:#9be7c4;}',
    '.mh-change.is-down{color:#ff9b8e;}',
    '.mh-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;}',
    '.mh-cell{padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.05);}',
    '.mh-cell span{display:block;color:#b7aa96;font-size:10px;letter-spacing:.08em;text-transform:uppercase;}',
    '.mh-cell b{display:block;margin-top:2px;font-weight:700;font-variant-numeric:tabular-nums;color:#fff8ee;}',
    '#mh-energy-line{margin:2px 2px 10px;color:#e7c56a;font-size:12px;}',
    '#mh-run{width:100%;padding:11px 12px;border:0;border-radius:14px;cursor:pointer;font:800 13px/1 "Segoe UI",system-ui,sans-serif;',
    'letter-spacing:.04em;text-transform:uppercase;color:#3a2708;',
    'background:linear-gradient(180deg,#ffe7a8,#e7b34a 55%,#c48922);',
    'box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 8px 18px rgba(196,137,34,.25);}',
    '#mh-run.is-stop{color:#fff6f4;background:linear-gradient(180deg,#8a4a52,#5c2c34);box-shadow:none;}',
    '#mh-status{margin-top:8px;min-height:32px;color:#d5cbbd;font-size:12px;line-height:1.4;}',
    '#mh-settings-toggle{display:block;width:100%;margin-top:2px;padding:6px;border-radius:8px;color:#e7c56a;background:transparent;}',
    '#mh-settings{display:none;margin-top:4px;}',
    '#mh-settings.is-open{display:block;}',
    '#mh-settings label{display:block;margin:8px 0 4px;color:#b7aa96;font-size:11px;}',
    '#mh-settings input,#mh-settings select{width:100%;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,214,140,.16);',
    'background:#17140f;color:#f7f2e8;font:inherit;}',
    '#mh-reset{width:100%;margin-top:10px;padding:8px;border-radius:10px;color:#ffb4a8;background:rgba(255,120,100,.08);border:1px solid rgba(255,120,100,.22);}',
    '#mh-reset.is-armed{color:#3a2708;background:#ffb4a8;}',
  ].join('');
  document.documentElement.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'mh-workall';
  panel.innerHTML = [
    '<header id="mh-handle">',
    '<div class="mh-brand"><img class="mh-mark" src="https://dg.minihero.org/icon-512.png" alt="Mini Hero"><div><strong>Mini Hero</strong><small>Work All</small></div></div>',
    '<div class="mh-head-actions"><span id="mh-pill">parado</span><button id="mh-min" type="button" title="Recolher">–</button></div>',
    '</header>',
    '<div id="mh-body">',
    '<div class="mh-hero">',
    '<span class="mh-kicker">MHDG no baú</span>',
    '<strong id="mh-farmed">—</strong>',
    '<span id="mh-session">lendo o baú</span>',
    '<div class="mh-worth"><strong id="mh-usd">—</strong><span id="mh-price">—</span><em id="mh-change" class="mh-change">preço</em></div>',
    '</div>',
    '<div class="mh-grid">',
    '<div class="mh-cell"><span>Tempo ligado</span><b id="mh-time">0:00</b></div>',
    '<div class="mh-cell"><span>Carteira</span><b id="mh-wallet-now">—</b></div>',
    '<div class="mh-cell"><span>Habilitados</span><b id="mh-fit">—</b></div>',
    '<div class="mh-cell"><span>Fora</span><b id="mh-skip">—</b></div>',
    '</div>',
    '<div id="mh-energy-line">Energia —</div>',
    '<button id="mh-run" type="button">Executar</button>',
    '<div id="mh-status">Parado.</div>',
    '<button id="mh-settings-toggle" type="button">Ajustes</button>',
    '<div id="mh-settings">',
    '<label>Espera na tela Heroes (min)</label>',
    '<input id="mh-wait" type="number" min="1" step="1">',
    '<label>Verificar working a cada (min)</label>',
    '<input id="mh-check" type="number" min="1" step="1">',
    '<label>Verificar energia a cada (min)</label>',
    '<input id="mh-energy-check" type="number" min="1" step="1">',
    '<label>Energia mínima (%)</label>',
    '<input id="mh-energy" type="number" min="0" max="100" step="1">',
    '<label>Mínimo de habilitados para GO WORK</label>',
    '<select id="mh-min-heroes">' + heroOptions.join('') + '</select>',
    '<button id="mh-reset" type="button">Resetar dados</button>',
    '</div>',
    '</div>',
  ].join('');
  document.documentElement.appendChild(panel);

  const handle = panel.querySelector('#mh-handle');
  const waitInput = panel.querySelector('#mh-wait');
  const checkInput = panel.querySelector('#mh-check');
  const energyCheckInput = panel.querySelector('#mh-energy-check');
  const energyInput = panel.querySelector('#mh-energy');
  const minHeroesInput = panel.querySelector('#mh-min-heroes');
  const fitEl = panel.querySelector('#mh-fit');
  const skipEl = panel.querySelector('#mh-skip');
  const energyLine = panel.querySelector('#mh-energy-line');
  const runBtn = panel.querySelector('#mh-run');
  const statusEl = panel.querySelector('#mh-status');
  const timeEl = panel.querySelector('#mh-time');
  const farmedEl = panel.querySelector('#mh-farmed');
  const sessionEl = panel.querySelector('#mh-session');
  const priceEl = panel.querySelector('#mh-price');
  const priceChangeEl = panel.querySelector('#mh-change');
  const usdEl = panel.querySelector('#mh-usd');
  const walletNowEl = panel.querySelector('#mh-wallet-now');
  const pillEl = panel.querySelector('#mh-pill');
  const minBtn = panel.querySelector('#mh-min');
  const settingsToggle = panel.querySelector('#mh-settings-toggle');
  const settingsEl = panel.querySelector('#mh-settings');
  const resetBtn = panel.querySelector('#mh-reset');

  waitInput.value = String(saved.waitMinutes || saved.minutes || DEFAULT_WAIT_MINUTES);
  checkInput.value = String(saved.checkMinutes || DEFAULT_CHECK_MINUTES);
  energyCheckInput.value = String(saved.energyMinutes || DEFAULT_ENERGY_MINUTES);
  energyInput.value = String(Number.isFinite(saved.minEnergy) ? saved.minEnergy : DEFAULT_MIN_ENERGY);
  minHeroesInput.value = String(saved.minHeroes || DEFAULT_MIN_HEROES);
  if (Number.isFinite(saved.priceUsd)) state.priceUsd = saved.priceUsd;
  if (Number.isFinite(saved.priceChange)) state.priceChange = saved.priceChange;
  if (saved.minimized) {
    panel.classList.add('is-min');
    minBtn.textContent = '+';
  }
  if (saved.settingsOpen) settingsEl.classList.add('is-open');
  if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) placePanel(saved.x, saved.y);
  else placePanel(16, Math.max(8, window.innerHeight - panel.offsetHeight - 16));
  paintPrice();
  paintFarm();
  paintTime();
  paintPill();

  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function onDragStart(event) {
    if (event.button !== 0) return;
    if (event.target.closest('button')) return;
    state.dragging = true;
    const rect = panel.getBoundingClientRect();
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    handle.setPointerCapture(event.pointerId);
  }

  function onDragMove(event) {
    if (!state.dragging) return;
    const placed = placePanel(event.clientX - dragOffsetX, event.clientY - dragOffsetY);
    save({ x: placed.x, y: placed.y });
  }

  function onDragEnd() {
    state.dragging = false;
  }

  handle.addEventListener('pointerdown', onDragStart);
  handle.addEventListener('pointermove', onDragMove);
  handle.addEventListener('pointerup', onDragEnd);
  handle.addEventListener('pointercancel', onDragEnd);

  minBtn.addEventListener('click', () => {
    const minimized = panel.classList.toggle('is-min');
    minBtn.textContent = minimized ? '+' : '–';
    save({ minimized });
  });

  settingsToggle.addEventListener('click', () => {
    const settingsOpen = settingsEl.classList.toggle('is-open');
    save({ settingsOpen });
  });

  runBtn.addEventListener('click', () => {
    if (state.running) stop();
    else start();
  });

  let resetArmed = false;
  let resetTimer = null;
  resetBtn.addEventListener('click', () => {
    if (!resetArmed) {
      resetArmed = true;
      resetBtn.textContent = 'Confirmar reset';
      resetBtn.classList.add('is-armed');
      resetTimer = setTimeout(() => {
        resetArmed = false;
        resetBtn.textContent = 'Resetar dados';
        resetBtn.classList.remove('is-armed');
      }, 4000);
      return;
    }
    clearTimeout(resetTimer);
    resetArmed = false;
    resetBtn.textContent = 'Resetar dados';
    resetBtn.classList.remove('is-armed');
    wipeBotData();
  });

  function persistTimes() {
    save({
      waitMinutes: readMinutes(waitInput, DEFAULT_WAIT_MINUTES),
      checkMinutes: readMinutes(checkInput, DEFAULT_CHECK_MINUTES),
      energyMinutes: readMinutes(energyCheckInput, DEFAULT_ENERGY_MINUTES),
      minEnergy: readPercent(energyInput),
      minHeroes: readMinHeroes(),
    });
    updateHeroCounts();
  }

  waitInput.addEventListener('change', persistTimes);
  checkInput.addEventListener('change', persistTimes);
  energyCheckInput.addEventListener('change', persistTimes);
  energyInput.addEventListener('change', persistTimes);
  minHeroesInput.addEventListener('change', persistTimes);

  watchBalances();
  refreshPrice();
  setInterval(refreshPrice, 60000);
  let lastCommit = 0;
  setInterval(() => {
    updateHeroCounts();
    paintEnergyLine();
    paintTime();
    if (state.running && Date.now() - lastCommit > 15000) {
      commitRunTime();
      lastCommit = Date.now();
    }
  }, 1000);
  setInterval(sampleChest, CHEST_SAMPLE_MS);

  if (saved.running) {
    save({ runSince: Date.now() });
    state.running = true;
    paintPill();
    setStatus('Página reiniciou. Esperando a tela para escanear a energia.');
    const boot = async () => {
      const startAt = Date.now();
      while (state.running && Date.now() - startAt < 120000) {
        if (document.querySelector('.fab-count, .heroes-fab') || onHeroesScreen()) break;
        setStatus('Aguardando o jogo carregar...');
        await sleep(1000);
      }
      if (state.running) start();
    };
    boot();
  }
})();

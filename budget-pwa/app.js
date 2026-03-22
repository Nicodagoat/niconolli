/* ══════════════════════════════════════════
   PAIRLY — app.js v4
   Budget together, stress less.
   Real-time sync · Fixed Costs · Split expenses · Vacation mode
══════════════════════════════════════════ */
'use strict';

/* ─── Constants ─── */
const STORAGE_KEY = 'pairly_v4';
const DEVICE_KEY  = 'pairly_deviceid';
const SYNC_CH     = 'pairly_v4';
const AUTH_KEY    = 'pairly_auth';

const FIXED_ICONS = {
  Rent:'🏠', Mortgage:'🏦', Insurance:'🛡️', Electric:'⚡', Water:'💧',
  Gas:'🔥', Internet:'📡', Phone:'📱', Gym:'💪', Netflix:'📺',
  Spotify:'🎵', Metro:'🚇', Parking:'🅿️', Loan:'💳', Other:'📌'
};

const VAR_CATEGORIES = [
  {name:'Food',      icon:'🍔'},
  {name:'Transport', icon:'🚌'},
  {name:'Fun',       icon:'🎉'},
  {name:'Shopping',  icon:'🛍️'},
  {name:'Health',    icon:'💊'},
  {name:'Home',      icon:'🏡'},
  {name:'Other',     icon:'📦'},
];

const DEFAULT_FIXED = [
  {id:'fc_rent',      name:'Rent',      amount:0, dueDay:1,  paidBy:'joint', splitRatio:0.5, icon:'🏠', category:'Housing'},
  {id:'fc_internet',  name:'Internet',  amount:0, dueDay:5,  paidBy:'joint', splitRatio:0.5, icon:'📡', category:'Utilities'},
  {id:'fc_electric',  name:'Electric',  amount:0, dueDay:10, paidBy:'joint', splitRatio:0.5, icon:'⚡', category:'Utilities'},
];

/* ─── State ─── */
let state = null;
let syncMgr = null;
let currentScreen = 'expense-entry';
let wizardStep = 0;
let onboardStep = 0;

const AVATAR_COLORS = [
  '#4A4E69','#C9ADA7','#9A8C98','#2D6A4F',
  '#B7791F','#C0392B','#2980B9','#6C3483',
];
let currentMonthKey = getMonthKey();
let currentHistoryMonth = getMonthKey();
let amountStr = '0';
let selectedCategory = 'Food';
let selectedType = 'joint';
let paidBy = 'me';
let splitRatio = 50;
let isFixedSelected = false;
let selectedFixedId = null;

/* ─── Utilities ─── */
function getMonthKey(d) {
  const date = d || new Date();
  return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

function generateDeviceId() {
  return 'dev_' + generateId() + generateId();
}

function fmt(n, currency) {
  const c = currency || (state && state.settings.currency) || '€';
  const abs = Math.abs(n);
  const str = abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(2);
  return (n < 0 ? '-' : '') + c + str;
}

function dayOfMonth() { return new Date().getDate(); }

/* ─── Default State ─── */
function defaultState() {
  return {
    deviceId: getOrCreateDeviceId(),
    pairedPeerId: null,
    pendingSync: [],
    activeVacation: null,
    vacations: [],
    // Onboarding / profile
    onboarded: false,
    profile: { name: '', color: AVATAR_COLORS[0] },
    inviteCode: null,
    settings: {
      currency: '€',
      users: [{id:'user1', name:'You'}, {id:'user2', name:'Partner'}],
      currentUser: 'user1',
      categories: VAR_CATEGORIES.map(c => c.name),
      fixedCosts: [],
      notifications: true,
      theme: 'system',
    },
    months: {},
  };
}

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) { id = generateDeviceId(); localStorage.setItem(DEVICE_KEY, id); }
  return id;
}

function ensureMonth(key) {
  key = key || currentMonthKey;
  if (!state.months[key]) {
    state.months[key] = {
      joint:      { total: 0, allocated: {} },
      personal:   { user1: { total: 0 }, user2: { total: 0 } },
      unforeseen: { total: 0 },
      transactions: [],
      fixedPaid: {},
      ious: [],
    };
  }
  return state.months[key];
}

/* ─── Persistence ─── */
function loadState() {
  try {
    // Try new key first, fall back to old key for migration
    const raw = localStorage.getItem(STORAGE_KEY)
              || localStorage.getItem('couplebudget_v3')
              || localStorage.getItem('couplebudget_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      state = parsed;
      // Migrations
      if (!state.settings.fixedCosts) state.settings.fixedCosts = [];
      if (!state.settings.theme) state.settings.theme = 'system';
      if (!state.pendingSync) state.pendingSync = [];
      if (!state.deviceId) state.deviceId = getOrCreateDeviceId();
      if (!state.vacations) state.vacations = [];
      if (state.activeVacation === undefined) state.activeVacation = null;
      if (state.onboarded === undefined) state.onboarded = false;
      if (!state.profile) state.profile = { name: '', color: AVATAR_COLORS[0] };
      if (!state.inviteCode) state.inviteCode = null;
      // Migrate user names: if they were set from real onboarding, mark onboarded
      if (!state.onboarded && state.settings.users[0].name !== 'You' && state.settings.users[0].name !== 'Alex') {
        state.profile.name = state.settings.users[0].name;
        state.onboarded = true;
      }
      return true;
    }
  } catch(e) { console.warn('Load error', e); }
  return false;
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) { console.warn('Save error', e); }
}

/* ─── Budget Math ─── */
function getFixedTotals(monthKey) {
  monthKey = monthKey || currentMonthKey;
  const month = state.months[monthKey];
  const fixedCosts = state.settings.fixedCosts;

  const jointFixed = fixedCosts.filter(fc => fc.paidBy === 'joint' || fc.paidBy === 'split');
  const fixedTotal = jointFixed.reduce((s, fc) => s + fc.amount, 0);

  const jointTotal = month ? month.joint.total : 0;
  const variableTotal = Math.max(0, jointTotal - fixedTotal);

  const txs = month ? month.transactions : [];
  const fixedSpent = txs.filter(t => t.type === 'joint' && t.isFixed).reduce((s,t) => s + t.amount, 0);
  const variableSpent = txs.filter(t => t.type === 'joint' && !t.isFixed).reduce((s,t) => s + t.amount, 0);
  const personalSpent = {
    user1: txs.filter(t => t.type === 'personal' && t.userId === 'user1').reduce((s,t) => s + t.amount, 0),
    user2: txs.filter(t => t.type === 'personal' && t.userId === 'user2').reduce((s,t) => s + t.amount, 0),
  };
  const unforeseenSpent = txs.filter(t => t.type === 'unforeseen').reduce((s,t) => s + t.amount, 0);

  return {
    fixedTotal, fixedSpent,
    variableTotal, variableSpent,
    variableRemaining: variableTotal - variableSpent,
    personalSpent,
    unforeseenTotal: month ? month.unforeseen.total : 0,
    unforeseenSpent,
    jointTotal,
  };
}

function getDueSoonFixed() {
  const today = dayOfMonth();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();
  return state.settings.fixedCosts.filter(fc => {
    const daysUntil = fc.dueDay >= today
      ? fc.dueDay - today
      : daysInMonth - today + fc.dueDay;
    return daysUntil <= 7;
  });
}

function isFixedPaid(fcId, monthKey) {
  monthKey = monthKey || currentMonthKey;
  const month = state.months[monthKey];
  return !!(month && month.fixedPaid[fcId] && month.fixedPaid[fcId].paid);
}

/* ─── SYNC MANAGER ─── */
class SyncManager {
  constructor(deviceId) {
    this.deviceId = deviceId;
    this.bc = null;
    this.peer = null;
    this.conn = null;
    this.status = 'offline';
    this.peerId = null;
    this.listeners = [];
    this._heartbeatTimer = null;
    this.initBC();
  }

  initBC() {
    if (!('BroadcastChannel' in window)) return;
    try {
      this.bc = new BroadcastChannel(SYNC_CH);
      this.bc.onmessage = (e) => {
        if (e.data && e.data.deviceId !== this.deviceId) {
          this._onData(e.data);
        }
      };
    } catch(e) {}
  }

  async initPeer() {
    if (this.peer) return Promise.resolve(this.peerId);
    await this._loadPeerJS();
    return new Promise((resolve, reject) => {
      const peerId = this.deviceId.replace(/[^a-z0-9]/gi,'').slice(0, 20).toLowerCase();
      try {
        this.peer = new Peer(peerId);
        this.peer.on('open', (id) => {
          this.peerId = id;
          this.updateStatus('ready');
          resolve(id);
        });
        this.peer.on('connection', (conn) => this._setupConn(conn));
        this.peer.on('error', (err) => {
          console.warn('[Sync] PeerJS error', err.type);
          this.updateStatus('offline');
          reject(err);
        });
      } catch(e) { reject(e); }
    });
  }

  _loadPeerJS() {
    if (typeof Peer !== 'undefined') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async connect(partnerPeerId) {
    await this.initPeer();
    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(partnerPeerId);
      const timer = setTimeout(() => reject(new Error('timeout')), 30000);
      conn.on('open', () => {
        clearTimeout(timer);
        this._setupConn(conn);
        resolve(conn);
      });
      conn.on('error', (e) => { clearTimeout(timer); reject(e); });
    });
  }

  _setupConn(conn) {
    this.conn = conn;
    conn.on('data', (data) => this._onData(data));
    conn.on('close', () => {
      this.conn = null;
      this.updateStatus('offline');
    });
    conn.on('error', () => {
      this.conn = null;
      this.updateStatus('offline');
    });
    this.updateStatus('connected');
    this._startHeartbeat();
    // request state sync from partner
    this.send({ type: 'sync_request', requestFull: true });
  }

  _startHeartbeat() {
    clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = setInterval(() => {
      if (this.conn && this.conn.open) {
        this.send({ type: 'heartbeat' });
      } else {
        clearInterval(this._heartbeatTimer);
      }
    }, 30000);
  }

  send(data) {
    const packet = { ...data, deviceId: this.deviceId, timestamp: Date.now() };
    if (this.bc) { try { this.bc.postMessage(packet); } catch(e) {} }
    if (this.conn && this.conn.open) { try { this.conn.send(packet); } catch(e) {} }
  }

  _onData(packet) {
    this.listeners.forEach(fn => fn(packet));
  }

  onData(fn) { this.listeners.push(fn); }

  updateStatus(status) {
    this.status = status;
    renderSyncChip(status);
  }

  getPairingCode() {
    if (!this.peerId) return null;
    return this.peerId.slice(-6).toUpperCase();
  }

  disconnect() {
    if (this.conn) { try { this.conn.close(); } catch(e) {} this.conn = null; }
    if (this.peer) { try { this.peer.destroy(); } catch(e) {} this.peer = null; }
    this.updateStatus('offline');
  }
}

/* ─── Sync handlers ─── */
function initSync() {
  syncMgr = new SyncManager(state.deviceId);
  syncMgr.onData((packet) => {
    handleSyncPacket(packet);
  });

  // Flush pending offline queue
  if (state.pendingSync && state.pendingSync.length > 0) {
    state.pendingSync.forEach(tx => {
      syncMgr.send({ type: 'expense', transaction: tx, monthKey: currentMonthKey });
    });
    state.pendingSync = [];
    saveState();
  }

  // If previously paired, try to reconnect
  if (state.pairedPeerId) {
    syncMgr.initPeer().then(() => {
      syncMgr.connect(state.pairedPeerId).catch(() => {});
    }).catch(() => {});
  }
}

function handleSyncPacket(packet) {
  if (!packet || !packet.type) return;

  switch (packet.type) {
    case 'expense': {
      const mk = packet.monthKey || currentMonthKey;
      const month = ensureMonth(mk);
      const tx = packet.transaction;
      if (tx && !month.transactions.find(t => t.id === tx.id)) {
        month.transactions.push(tx);
        if (tx.isFixed && tx.fixedCostId) {
          month.fixedPaid[tx.fixedCostId] = { paid: true, paidAt: tx.date, paidBy: tx.paidBy };
        }
        saveState();
        const partnerName = getPartnerName();
        showPartnerToast(partnerName + ' logged ' + fmt(tx.amount) + ' ' + tx.category);
        if (mk === currentMonthKey) renderCurrentScreen();
      }
      break;
    }
    case 'fixed_update': {
      const mk = packet.monthKey || currentMonthKey;
      const month = ensureMonth(mk);
      if (packet.fixedCostId) {
        month.fixedPaid[packet.fixedCostId] = packet.status;
        saveState();
        if (mk === currentMonthKey) renderCurrentScreen();
      }
      break;
    }
    case 'sync_request': {
      if (packet.requestFull) {
        // Send our current month state
        const month = ensureMonth(currentMonthKey);
        syncMgr.send({ type: 'state_sync', monthKey: currentMonthKey, month });
      }
      break;
    }
    case 'state_sync': {
      const mk = packet.monthKey;
      if (mk && packet.month) {
        const existing = ensureMonth(mk);
        // Merge transactions (deduplicate by id)
        const existingIds = new Set(existing.transactions.map(t => t.id));
        packet.month.transactions.forEach(tx => {
          if (!existingIds.has(tx.id)) existing.transactions.push(tx);
        });
        // Merge fixedPaid
        Object.assign(existing.fixedPaid, packet.month.fixedPaid || {});
        // Merge ious
        const existingIouIds = new Set(existing.ious.map(i => i.id));
        (packet.month.ious || []).forEach(iou => {
          if (!existingIouIds.has(iou.id)) existing.ious.push(iou);
        });
        saveState();
        if (mk === currentMonthKey) renderCurrentScreen();
      }
      break;
    }
    case 'heartbeat':
      break;
  }
}

function broadcastExpense(tx, monthKey) {
  if (!syncMgr) return;
  const packet = { type: 'expense', transaction: tx, monthKey: monthKey || currentMonthKey };
  try {
    syncMgr.send(packet);
  } catch(e) {
    // queue for later
    state.pendingSync.push(tx);
    saveState();
  }
}

/* ─── Render sync chip ─── */
function renderSyncChip(status) {
  const chip = document.getElementById('sync-chip');
  if (!chip) return;
  const dot = chip.querySelector('.sync-dot');
  const label = chip.querySelector('.sync-label');
  chip.className = 'sync-chip sync-' + status;
  const labels = { offline:'Offline', ready:'Ready', connected:'Synced', syncing:'Syncing...' };
  if (label) label.textContent = labels[status] || status;
}

function getPartnerName() {
  const me = state.settings.currentUser;
  const partner = state.settings.users.find(u => u.id !== me);
  return partner ? partner.name : 'Partner';
}

function getMyName() {
  const me = state.settings.users.find(u => u.id === state.settings.currentUser);
  return me ? me.name : 'Me';
}

/* ─── Partner toast ─── */
function showPartnerToast(msg) {
  const el = document.createElement('div');
  el.className = 'partner-toast';
  el.textContent = '👥 ' + msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ─── SCREEN MANAGEMENT ─── */
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('active');
    // Trigger entrance animation
    screen.classList.remove('screen-enter');
    void screen.offsetWidth;
    screen.classList.add('screen-enter');
  }
  currentScreen = screenId;

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === screenId);
  });

  // Hide nav during setup
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.style.display = screenId === 'setup-wizard' ? 'none' : '';

  // Render screen content
  switch (screenId) {
    case 'expense-entry':  renderExpenseEntry(); break;
    case 'status-screen':  renderStatusScreen(); break;
    case 'history-screen': renderHistoryScreen(); break;
    case 'profile-screen': renderProfileScreen(); break;
  }
}

function renderCurrentScreen() {
  showScreen(currentScreen);
}

/* ─── MINI STATUS BAR ─── */
function renderMiniStatus() {
  const el = document.getElementById('mini-status');
  if (!el) return;
  const month = state.months[currentMonthKey];
  if (!month) { el.innerHTML = '<span>Set up your budget →</span>'; return; }

  const t = getFixedTotals(currentMonthKey);
  const jointRemaining = t.variableRemaining;
  const me = state.settings.currentUser;
  const personalMonth = month.personal[me] || { total: 0 };
  const personalSpent = t.personalSpent[me] || 0;
  const personalRemaining = personalMonth.total - personalSpent;

  el.innerHTML =
    '<span class="s-joint">Joint ' + fmt(jointRemaining) + '</span>' +
    '<span class="s-personal">Mine ' + fmt(personalRemaining) + '</span>';
}

/* ─── DUE-SOON BAR ─── */
function renderDueSoonBar() {
  const bar = document.getElementById('due-soon-bar');
  if (!bar) return;
  bar.innerHTML = '';
  if (!state.settings.fixedCosts.length) return;

  const dueSoon = getDueSoonFixed();
  dueSoon.forEach(fc => {
    const paid = isFixedPaid(fc.id);
    const btn = document.createElement('button');
    btn.className = 'due-soon-btn' + (paid ? ' paid' : '');
    const today = dayOfMonth();
    const daysLeft = fc.dueDay >= today ? fc.dueDay - today : 0;
    const dueText = daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : 'Due ' + fc.dueDay;
    btn.innerHTML = fc.icon + ' ' + fc.name + ' ' + fmt(fc.amount) + ' <small style="opacity:.7">· ' + dueText + '</small>';
    if (!paid) {
      btn.addEventListener('click', () => quickPayFixed(fc));
    }
    bar.appendChild(btn);
  });
}

function quickPayFixed(fc) {
  amountStr = String(fc.amount);
  selectedCategory = fc.name;
  isFixedSelected = true;
  selectedFixedId = fc.id;
  renderExpenseEntry();
  document.getElementById('amount-display').textContent = fc.amount;
}

/* ─── CATEGORY PILLS ─── */
function renderCategoryPills() {
  const container = document.getElementById('category-pills');
  if (!container) return;
  container.innerHTML = '';

  const fixedCosts = state.settings.fixedCosts;

  // Fixed cost pills
  if (fixedCosts.length) {
    fixedCosts.forEach(fc => {
      const paid = isFixedPaid(fc.id);
      const pill = document.createElement('button');
      const isSelected = isFixedSelected && selectedFixedId === fc.id;
      pill.className = 'category-pill fixed-pill' +
        (paid ? ' paid-pill' : '') +
        (isSelected ? ' selected-' + selectedType : '');
      pill.innerHTML = fc.icon + ' ' + fc.name + ' <span style="opacity:.7;font-size:11px">' + fmt(fc.amount) + '</span>';
      pill.addEventListener('click', () => selectFixedCategory(fc));
      container.appendChild(pill);
    });

    // Divider
    const div = document.createElement('div');
    div.className = 'pills-divider';
    container.appendChild(div);
  }

  // Variable category pills
  VAR_CATEGORIES.forEach(cat => {
    const pill = document.createElement('button');
    const isSelected = !isFixedSelected && selectedCategory === cat.name;
    pill.className = 'category-pill' + (isSelected ? ' selected-' + selectedType : '');
    pill.textContent = cat.icon + ' ' + cat.name;
    pill.addEventListener('click', () => selectVariableCategory(cat.name));
    container.appendChild(pill);
  });
}

function selectFixedCategory(fc) {
  isFixedSelected = true;
  selectedFixedId = fc.id;
  selectedCategory = fc.name;
  amountStr = String(fc.amount);
  document.getElementById('amount-display').textContent = fc.amount;
  renderCategoryPills();
}

function selectVariableCategory(name) {
  isFixedSelected = false;
  selectedFixedId = null;
  selectedCategory = name;
  renderCategoryPills();
}

/* ─── SPLIT PANEL ─── */
function initSplitPanel() {
  const toggleBtn = document.getElementById('split-toggle-btn');
  const panel = document.getElementById('split-panel');
  if (!toggleBtn || !panel) return;

  toggleBtn.addEventListener('click', () => {
    const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleBtn.setAttribute('aria-expanded', !expanded);
    panel.hidden = expanded;
  });

  // Paid-by buttons
  document.querySelectorAll('.paid-by-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.paid-by-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      paidBy = btn.dataset.paid;
      const ratioRow = document.getElementById('split-ratio-row');
      if (ratioRow) ratioRow.hidden = (paidBy !== 'both');
      updateIouPreview();
    });
  });

  // Split ratio slider
  const slider = document.getElementById('split-ratio');
  if (slider) {
    slider.addEventListener('input', () => {
      splitRatio = parseInt(slider.value);
      slider.style.setProperty('--val', splitRatio + '%');
      document.getElementById('split-me-pct').textContent = splitRatio + '%';
      document.getElementById('split-partner-pct').textContent = (100 - splitRatio) + '%';
      updateIouPreview();
    });
  }

  // Update names
  const myNameEl = document.getElementById('split-my-name');
  const partnerNameEl = document.getElementById('split-partner-name');
  if (myNameEl) myNameEl.textContent = getMyName();
  if (partnerNameEl) partnerNameEl.textContent = getPartnerName();
}

function updateIouPreview() {
  const preview = document.getElementById('iou-preview');
  if (!preview) return;
  const amount = parseFloat(amountStr) || 0;
  if (paidBy !== 'both' || amount === 0 || splitRatio === 50) {
    preview.hidden = true;
    return;
  }
  preview.hidden = false;
  const myShare = amount * splitRatio / 100;
  const netOwed = Math.abs(myShare - amount / 2);
  const partnerName = getPartnerName();
  const myName = getMyName();
  if (splitRatio > 50) {
    preview.textContent = partnerName + ' will owe ' + myName + ' ' + fmt(netOwed);
  } else {
    preview.textContent = myName + ' will owe ' + partnerName + ' ' + fmt(netOwed);
  }
}

/* ─── EXPENSE ENTRY SCREEN ─── */
function renderExpenseEntry() {
  renderMiniStatus();
  renderDueSoonBar();
  renderVacationBanner();
  renderCategoryPills();
  updateIouPreview();

  // Currency symbol
  const cur = document.getElementById('currency-symbol');
  if (cur) cur.textContent = state.settings.currency || '€';

  // Amount
  const disp = document.getElementById('amount-display');
  if (disp) disp.textContent = amountStr === '0' ? '0' : amountStr;

  // Sync chip
  if (syncMgr) renderSyncChip(syncMgr.status);
}

/* ─── NUMBER PAD ─── */
function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms || 8);
}

function initNumpad() {
  const numpad = document.getElementById('numpad');
  if (!numpad) return;
  numpad.addEventListener('click', (e) => {
    const btn = e.target.closest('.num-btn');
    if (!btn) return;
    vibrate(8);
    const val = btn.dataset.value;
    handleNumpadInput(val);
  });
}

function handleNumpadInput(val) {
  if (val === 'backspace') {
    amountStr = amountStr.length > 1 ? amountStr.slice(0,-1) : '0';
  } else if (val === '.') {
    if (!amountStr.includes('.')) amountStr += '.';
  } else {
    if (amountStr === '0') amountStr = val;
    else if (amountStr.includes('.')) {
      const parts = amountStr.split('.');
      if (parts[1].length < 2) amountStr += val;
    } else {
      if (amountStr.length < 7) amountStr += val;
    }
  }
  const disp = document.getElementById('amount-display');
  if (disp) {
    disp.textContent = amountStr;
    disp.classList.remove('amount-pop');
    void disp.offsetWidth; // reflow
    disp.classList.add('amount-pop');
  }
  updateIouPreview();

  // Auto-select fixed cost if amount matches
  if (!isFixedSelected) {
    const amt = parseFloat(amountStr);
    const match = state.settings.fixedCosts.find(fc => Math.abs(fc.amount - amt) < 0.01);
    if (match && !isFixedPaid(match.id)) {
      isFixedSelected = true;
      selectedFixedId = match.id;
      selectedCategory = match.name;
      renderCategoryPills();
    }
  }
}

/* ─── SUBMIT EXPENSE ─── */
function initSubmitBtn() {
  const btn = document.getElementById('submit-btn');
  if (!btn) return;
  let submitting = false;
  btn.addEventListener('click', () => {
    if (submitting) return;
    submitting = true;
    submitExpense();
    setTimeout(() => { submitting = false; }, 800);
  });
}

function submitExpense() {
  const amount = parseFloat(amountStr);
  if (!amount || amount <= 0) {
    shakeAmount();
    return;
  }

  const month = ensureMonth(currentMonthKey);
  const noteEl = document.getElementById('expense-note');
  const note = noteEl ? noteEl.value.trim() : '';
  const me = state.settings.currentUser;

  const tx = {
    id: generateId(),
    type: selectedType,
    amount,
    category: selectedCategory,
    note,
    date: new Date().toISOString(),
    paidBy: paidBy,
    splitRatio: paidBy === 'both' ? splitRatio / 100 : null,
    isFixed: isFixedSelected,
    fixedCostId: isFixedSelected ? selectedFixedId : null,
    userId: me,
    deviceId: state.deviceId,
    timestamp: Date.now(),
    vacationId: state.activeVacation ? state.activeVacation.id : null,
  };

  // Add to transactions
  month.transactions.push(tx);

  // Mark fixed cost as paid
  if (isFixedSelected && selectedFixedId) {
    month.fixedPaid[selectedFixedId] = { paid: true, paidAt: tx.date, paidBy: me };
    syncMgr && syncMgr.send({
      type: 'fixed_update', fixedCostId: selectedFixedId,
      status: month.fixedPaid[selectedFixedId], monthKey: currentMonthKey
    });
    // Update due-soon bar
    const dueSoonBtn = document.querySelector('.due-soon-btn[data-fcid="' + selectedFixedId + '"]');
    if (dueSoonBtn) dueSoonBtn.classList.add('paid');
  }

  // Create IOU if split unevenly: store the NET difference from a fair 50/50 split
  if (paidBy === 'both' && splitRatio !== 50) {
    const myShare = amount * (splitRatio / 100);
    const netOwed = Math.abs(myShare - amount / 2); // e.g. 100 at 60/40 → net = 10
    const partnerName = getPartnerName();
    const myName = getMyName();
    const partnerId = state.settings.users.find(u => u.id !== me).id;
    const iou = {
      id: generateId(),
      txId: tx.id,
      description: note || selectedCategory,
      date: tx.date,
      settled: false,
      amount: netOwed,
    };
    if (splitRatio > 50) {
      // I paid more than my fair share → partner owes me
      iou.from = partnerId; iou.fromName = partnerName;
      iou.to = me;          iou.toName = myName;
    } else {
      // Partner paid more → I owe partner
      iou.from = me;        iou.fromName = myName;
      iou.to = partnerId;   iou.toName = partnerName;
    }
    month.ious.push(iou);
  }

  // Save last entry preferences
  state.lastEntry = { type: selectedType, category: selectedCategory, paidBy, splitRatio };

  saveState();
  broadcastExpense(tx, currentMonthKey);

  // Success feedback
  const feedback = document.getElementById('success-feedback');
  if (feedback) {
    feedback.textContent = '✓ ' + fmt(amount) + ' ' + selectedCategory;
    feedback.classList.add('show');
    setTimeout(() => feedback.classList.remove('show'), 1800);
  }

  // Reset
  amountStr = '0';
  isFixedSelected = false;
  selectedFixedId = null;
  if (noteEl) noteEl.value = '';
  paidBy = 'me';
  splitRatio = 50;
  document.querySelectorAll('.paid-by-btn').forEach(b => b.classList.toggle('active', b.dataset.paid === 'me'));
  // Close + reset split panel fully
  const splitPanel = document.getElementById('split-panel');
  if (splitPanel) splitPanel.hidden = true;
  const splitToggleBtn = document.getElementById('split-toggle-btn');
  if (splitToggleBtn) splitToggleBtn.setAttribute('aria-expanded', 'false');
  const splitRatioRow = document.getElementById('split-ratio-row');
  if (splitRatioRow) splitRatioRow.hidden = true;
  const slider = document.getElementById('split-ratio');
  if (slider) { slider.value = 50; slider.style.setProperty('--val', '50%'); }
  const smePct = document.getElementById('split-me-pct');
  const sPartnerPct = document.getElementById('split-partner-pct');
  if (smePct) smePct.textContent = '50%';
  if (sPartnerPct) sPartnerPct.textContent = '50%';

  renderExpenseEntry();
}

function shakeAmount() {
  const el = document.getElementById('amount-display');
  if (!el) return;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 300);
}

/* ─── BUDGET TYPE TOGGLE ─── */
function resetSplitPanel() {
  paidBy = 'me';
  splitRatio = 50;
  const panel = document.getElementById('split-panel');
  if (panel) panel.hidden = true;
  const toggleBtn = document.getElementById('split-toggle-btn');
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  const ratioRow = document.getElementById('split-ratio-row');
  if (ratioRow) ratioRow.hidden = true;
  document.querySelectorAll('.paid-by-btn').forEach(b => b.classList.toggle('active', b.dataset.paid === 'me'));
  updateIouPreview();
}

function initTypeToggle() {
  // Set body class immediately so CSS rules (e.g. hiding split section) apply on first paint
  document.body.className = 'type-' + selectedType;

  document.querySelectorAll('.type-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedType = btn.dataset.type;
      document.body.className = 'type-' + selectedType;
      // Personal and unforeseen are standalone budgets — split panel doesn't apply
      if (selectedType !== 'joint') resetSplitPanel();
      renderCategoryPills();
    });
  });
}

/* ─── REPEAT BUTTON ─── */
function initRepeatBtn() {
  const btn = document.getElementById('repeat-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const month = state.months[currentMonthKey];
    if (!month || !month.transactions.length) return showToast('No recent expense', 'info');
    const last = [...month.transactions].reverse()[0];
    amountStr = String(last.amount);
    selectedCategory = last.category;
    selectedType = last.type;
    isFixedSelected = last.isFixed || false;
    selectedFixedId = last.fixedCostId || null;
    document.querySelectorAll('.type-toggle-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === selectedType);
    });
    document.body.className = 'type-' + selectedType;
    const noteEl = document.getElementById('expense-note');
    if (noteEl) noteEl.value = last.note || '';
    renderExpenseEntry();
    showToast('Repeating: ' + last.category, 'info');
  });
}

/* ─── STATUS SCREEN ─── */
function renderStatusScreen() {
  const screen = document.getElementById('status-screen');
  if (!screen) return;
  const month = state.months[currentMonthKey];
  const t = getFixedTotals(currentMonthKey);
  const fixedCosts = state.settings.fixedCosts;
  const me = state.settings.currentUser;
  const currency = state.settings.currency;
  const monthLabel = new Date(currentMonthKey + '-15').toLocaleDateString('en-US', {month:'long', year:'numeric'});

  if (!month || month.joint.total === 0) {
    screen.innerHTML = '<div class="status-container"><p class="no-budget">No budget set up yet. <br>Go to Setup in the Profile tab.</p></div>';
    return;
  }

  const jointPct   = t.jointTotal > 0 ? Math.min(100, Math.round((t.variableSpent + t.fixedSpent) / t.jointTotal * 100)) : 0;
  const fixedPct   = t.jointTotal > 0 ? Math.round(t.fixedTotal / t.jointTotal * 100) : 0;
  const varPct     = t.variableTotal > 0 ? Math.min(100, Math.round(t.variableSpent / t.variableTotal * 100)) : 0;
  const danger     = varPct >= 90;

  // Fixed costs status list
  let fixedListHtml = '';
  if (fixedCosts.length) {
    fixedListHtml = '<div class="section-title">Fixed Costs</div><div class="fixed-costs-status-list">';
    fixedCosts.forEach(fc => {
      const paid = isFixedPaid(fc.id, currentMonthKey);
      const today = dayOfMonth();
      const isDue = !paid && fc.dueDay <= today;
      fixedListHtml += '<div class="fixed-status-item' + (paid?' is-paid':'') + (isDue?' is-due':'') + '" data-fcid="' + fc.id + '">' +
        '<div class="fixed-status-checkbox">' + (paid ? '✓' : '') + '</div>' +
        '<div class="fixed-status-info"><div class="fixed-status-name">' + fc.icon + ' ' + fc.name + '</div>' +
        '<div class="fixed-status-due">' + (paid ? 'Paid' : 'Due ' + fc.dueDay) + '</div></div>' +
        '<div class="fixed-status-amount">' + fmt(fc.amount, currency) + '</div>' +
        '</div>';
    });
    fixedListHtml += '</div>';
  }

  // IOUs
  const ious = (month.ious || []).filter(i => !i.settled);
  let iouHtml = '';
  if (ious.length) {
    iouHtml = '<div class="section-title">IOUs</div>';
    ious.forEach(iou => {
      iouHtml += '<div class="iou-card">' +
        '<div class="iou-icon">💸</div>' +
        '<div class="iou-desc">' + iou.fromName + ' owes ' + iou.toName + ' for ' + iou.description + '</div>' +
        '<div><div class="iou-amount">' + fmt(iou.amount, currency) + '</div>' +
        '<button class="iou-settle-btn" data-iou="' + iou.id + '">Settle</button></div>' +
        '</div>';
    });
  }

  // Personal budgets
  const user1 = state.settings.users.find(u => u.id === 'user1') || {name:'Alex'};
  const user2 = state.settings.users.find(u => u.id === 'user2') || {name:'Jordan'};
  const p1Total = month.personal.user1 ? month.personal.user1.total : 0;
  const p2Total = month.personal.user2 ? month.personal.user2.total : 0;
  const p1Spent = t.personalSpent.user1 || 0;
  const p2Spent = t.personalSpent.user2 || 0;
  const p1Pct = p1Total > 0 ? Math.min(100, Math.round(p1Spent / p1Total * 100)) : 0;
  const p2Pct = p2Total > 0 ? Math.min(100, Math.round(p2Spent / p2Total * 100)) : 0;

  screen.innerHTML = '<div class="status-container">' +
    '<div class="status-title">' + monthLabel + '</div>' +

    // Joint card
    '<div class="budget-card">' +
    '<div class="budget-card-header"><span class="budget-label">Joint Budget</span><span class="budget-remaining">' + fmt(t.variableRemaining + (t.fixedTotal - t.fixedSpent), currency) + ' left</span></div>' +
    '<div class="stacked-bar">' +
    '<div class="stacked-seg fixed-seg" style="width:' + Math.min(100,fixedPct) + '%"></div>' +
    '<div class="stacked-seg variable-seg" style="width:' + Math.min(100-fixedPct, Math.round(t.variableSpent/t.jointTotal*100||0)) + '%"></div>' +
    '</div>' +
    '<div class="budget-split-row">' +
    '<div class="budget-split-item"><div class="budget-split-label">Fixed Reserved</div><div class="budget-split-value">' + fmt(t.fixedTotal, currency) + '</div></div>' +
    '<div class="budget-split-item"><div class="budget-split-label">Variable Spent</div><div class="budget-split-value">' + fmt(t.variableSpent, currency) + '</div></div>' +
    '<div class="budget-split-item"><div class="budget-split-label">Available</div><div class="budget-split-value">' + fmt(t.variableRemaining, currency) + '</div></div>' +
    '</div></div>' +

    fixedListHtml +
    iouHtml +

    // Personal cards (only if budgets set)
    (p1Total > 0 ? '<div class="section-title">Personal</div><div class="budget-card">' +
    '<div class="budget-card-header"><span class="budget-label">' + user1.name + '</span><span class="budget-remaining">' + fmt(p1Total - p1Spent, currency) + ' left</span></div>' +
    '<div class="progress-bar"><div class="progress-fill personal' + (p1Pct>=90?' danger':'') + '" style="width:' + p1Pct + '%"></div></div>' +
    '<div class="budget-details"><span>' + fmt(p1Spent, currency) + ' spent</span><span>' + fmt(p1Total, currency) + ' budget</span></div>' +
    '</div>' : '') +

    (p2Total > 0 ? '<div class="budget-card">' +
    '<div class="budget-card-header"><span class="budget-label">' + user2.name + '</span><span class="budget-remaining">' + fmt(p2Total - p2Spent, currency) + ' left</span></div>' +
    '<div class="progress-bar"><div class="progress-fill personal' + (p2Pct>=90?' danger':'') + '" style="width:' + p2Pct + '%"></div></div>' +
    '<div class="budget-details"><span>' + fmt(p2Spent, currency) + ' spent</span><span>' + fmt(p2Total, currency) + ' budget</span></div>' +
    '</div>' : '') +

    // Unforeseen (no budget — just show spending)
    (t.unforeseenSpent > 0 ? '<div class="budget-card unforeseen-card">' +
    '<div class="budget-card-header"><span class="budget-label">⚡ Unforeseen</span><span class="budget-remaining unbudgeted">' + fmt(t.unforeseenSpent, currency) + ' spent</span></div>' +
    '<p style="font-size:13px;opacity:.6;margin-top:4px">Unexpected expenses — tracked outside your budget</p>' +
    '</div>' : '') +

    '</div>';

  // Fixed status tap handler
  screen.querySelectorAll('.fixed-status-item').forEach(item => {
    item.addEventListener('click', () => toggleFixedPaid(item.dataset.fcid));
  });

  // IOU settle
  screen.querySelectorAll('.iou-settle-btn').forEach(btn => {
    btn.addEventListener('click', () => settleIou(btn.dataset.iou));
  });
}

function toggleFixedPaid(fcId) {
  const month = ensureMonth(currentMonthKey);
  const current = month.fixedPaid[fcId] && month.fixedPaid[fcId].paid;
  if (current) {
    // Remove the transaction for this fixed cost
    month.transactions = month.transactions.filter(t => t.fixedCostId !== fcId);
    month.fixedPaid[fcId] = { paid: false };
  } else {
    const fc = state.settings.fixedCosts.find(f => f.id === fcId);
    if (!fc) return;
    const tx = {
      id: generateId(), type: 'joint', amount: fc.amount, category: fc.name,
      note: 'Fixed cost payment', date: new Date().toISOString(),
      paidBy: 'me', isFixed: true, fixedCostId: fcId,
      userId: state.settings.currentUser, deviceId: state.deviceId, timestamp: Date.now(),
    };
    month.transactions.push(tx);
    month.fixedPaid[fcId] = { paid: true, paidAt: tx.date, paidBy: state.settings.currentUser };
    broadcastExpense(tx, currentMonthKey);
    syncMgr && syncMgr.send({ type: 'fixed_update', fixedCostId: fcId, status: month.fixedPaid[fcId], monthKey: currentMonthKey });
  }
  saveState();
  renderStatusScreen();
}

function settleIou(iouId) {
  const month = state.months[currentMonthKey];
  if (!month) return;
  const iou = month.ious.find(i => i.id === iouId);
  if (iou) { iou.settled = true; saveState(); renderStatusScreen(); showToast('IOU settled!', 'success'); }
}

/* ─── HISTORY SCREEN ─── */
function renderHistoryScreen() {
  const screen = document.getElementById('history-screen');
  if (!screen) return;

  const allMonths = Object.keys(state.months).sort().reverse();
  // Ensure currentHistoryMonth is valid
  if (!allMonths.includes(currentHistoryMonth)) currentHistoryMonth = allMonths[0] || currentMonthKey;

  const month = state.months[currentHistoryMonth];
  const txs = month ? [...month.transactions].reverse() : [];

  const monthNavHtml = allMonths.length > 1
    ? '<div class="month-nav">' +
      allMonths.map(mk => {
        const label = new Date(mk + '-15').toLocaleDateString('en-US', {month:'short', year:'numeric'});
        return '<button class="month-nav-btn' + (mk === currentHistoryMonth ? ' active' : '') + '" data-mk="' + mk + '">' + label + '</button>';
      }).join('') +
      '</div>'
    : '';

  screen.innerHTML =
    '<div class="history-header">' +
    '<h2>History</h2>' +
    '<input type="search" class="search-input" id="history-search" placeholder="Search…" autocomplete="off">' +
    '</div>' +
    monthNavHtml +
    '<div id="history-list"></div>';

  screen.querySelectorAll('.month-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentHistoryMonth = btn.dataset.mk;
      renderHistoryScreen();
    });
  });

  renderHistoryList(txs, '');

  const searchInput = document.getElementById('history-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderHistoryList(txs, searchInput.value));
  }
}

function renderHistoryList(txs, query) {
  const list = document.getElementById('history-list');
  if (!list) return;
  const q = (query || '').toLowerCase().trim();
  const filtered = q ? txs.filter(t =>
    (t.category||'').toLowerCase().includes(q) ||
    (t.note||'').toLowerCase().includes(q) ||
    String(t.amount).includes(q)
  ) : txs;

  if (!filtered.length) {
    list.innerHTML = '<div class="no-transactions">' + (q ? 'No matches' : 'No expenses yet') + '</div>';
    return;
  }

  // Group by date
  const groups = {};
  filtered.forEach(tx => {
    const d = new Date(tx.date);
    const key = d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });

  const currency = state.settings.currency;
  let html = '';
  Object.keys(groups).forEach(day => {
    html += '<div class="history-group"><div class="history-date">' + day + '</div>';
    groups[day].forEach(tx => {
      const icon = tx.isFixed ? '🔒' : (VAR_CATEGORIES.find(c=>c.name===tx.category)||{icon:'📦'}).icon;
      const splitTag = tx.paidBy === 'both' ? '<span class="tx-split-tag">Split</span>' : (tx.paidBy === 'partner' ? '<span class="tx-split-tag">Partner paid</span>' : '');
      const vacTag = tx.vacationId ? '<span class="tx-vac-tag">🏖️</span>' : '';
      html += '<div class="transaction-item" data-txid="' + tx.id + '">' +
        '<div class="tx-icon ' + tx.type + (tx.isFixed ? ' fixed' : '') + '">' + icon + '</div>' +
        '<div class="tx-details">' +
        '<div class="tx-category">' + tx.category + vacTag + '</div>' +
        (tx.note ? '<div class="tx-note">' + escapeHtml(tx.note) + '</div>' : '') +
        splitTag +
        '</div>' +
        '<div class="tx-right">' +
        '<div class="tx-amount">' + fmt(tx.amount, currency) + '</div>' +
        '<div class="tx-badge ' + tx.type + (tx.isFixed ? ' fixed' : '') + '">' + (tx.isFixed ? 'fixed' : tx.type) + '</div>' +
        '</div></div>';
    });
    html += '</div>';
  });
  list.innerHTML = html;

  list.querySelectorAll('.transaction-item').forEach(item => {
    item.addEventListener('click', () => {
      const txId = item.dataset.txid;
      const tx = txs.find(t => t.id === txId);
      if (tx) showTransactionDetail(tx);
    });
  });
}

function showTransactionDetail(tx) {
  const currency = state.settings.currency;
  const d = new Date(tx.date);
  const dateStr = d.toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
  const timeStr = d.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
  const txMonthKey = getMonthKey(d);
  const vacName = tx.vacationId
    ? (state.vacations.find(v => v.id === tx.vacationId) || state.activeVacation || {name:'Vacation'}).name
    : null;

  showModal('<div class="detail-modal">' +
    '<div class="modal-handle"></div>' +
    '<h3>' + fmt(tx.amount, currency) + ' · ' + tx.category + '</h3>' +
    (tx.note ? '<div class="detail-row"><span class="detail-label">Note</span><span>' + escapeHtml(tx.note) + '</span></div>' : '') +
    '<div class="detail-row"><span class="detail-label">Type</span><span>' + (tx.isFixed ? 'Fixed Cost' : tx.type) + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Paid by</span><span>' + (tx.paidBy === 'both' ? 'Split ' + Math.round((tx.splitRatio||0.5)*100) + '/' + (100-Math.round((tx.splitRatio||0.5)*100)) : tx.paidBy) + '</span></div>' +
    (vacName ? '<div class="detail-row"><span class="detail-label">Vacation</span><span>🏖️ ' + escapeHtml(vacName) + '</span></div>' : '') +
    '<div class="detail-row"><span class="detail-label">Date</span><span>' + dateStr + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Time</span><span>' + timeStr + '</span></div>' +
    '<button class="btn-danger-outline" id="modal-delete-tx">Delete</button>' +
    '</div>');

  document.getElementById('modal-delete-tx').addEventListener('click', () => {
    // Use the transaction's own month key so deletes from history work correctly
    const month = state.months[txMonthKey];
    if (month) {
      month.transactions = month.transactions.filter(t => t.id !== tx.id);
      if (tx.isFixed && tx.fixedCostId && month.fixedPaid[tx.fixedCostId]) {
        month.fixedPaid[tx.fixedCostId] = { paid: false };
      }
      saveState();
    }
    closeModal();
    renderHistoryScreen();
  });
}

/* ─── PROFILE SCREEN ─── */
function renderProfileScreen() {
  const screen = document.getElementById('profile-screen');
  if (!screen) return;
  const s = state.settings;
  const currency = s.currency || '€';
  const user1 = s.users.find(u => u.id === 'user1') || {id:'user1', name:'Alex'};
  const user2 = s.users.find(u => u.id === 'user2') || {id:'user2', name:'Jordan'};
  const syncConnected = syncMgr && (syncMgr.status === 'connected');
  const pairedCode = syncConnected && syncMgr.getPairingCode();
  const pairingCode = syncMgr && syncMgr.peerId ? syncMgr.getPairingCode() : '------';

  const profile = state.profile || { name: user1.name, color: AVATAR_COLORS[0] };
  const myInitial = profile.name ? profile.name[0].toUpperCase() : '?';

  screen.innerHTML = '<div class="profile-container">' +

    // Profile header with avatar
    '<div class="profile-hero">' +
    '<div class="profile-hero-avatar" style="background:' + profile.color + '">' + myInitial + '</div>' +
    '<div class="profile-hero-name">' + escapeHtml(profile.name || user1.name) + '</div>' +
    '<button class="profile-hero-edit" id="profile-edit-name-btn">Edit profile</button>' +
    '</div>' +

    // Who am I
    '<div class="profile-section">' +
    '<h3>I am</h3>' +
    '<div class="user-selector">' +
    '<button class="user-btn' + (s.currentUser==='user1'?' active':'') + '" data-user="user1">' + user1.name + '</button>' +
    '<button class="user-btn' + (s.currentUser==='user2'?' active':'') + '" data-user="user2">' + user2.name + '</button>' +
    '</div></div>' +

    // Names
    '<div class="profile-section">' +
    '<h3>Partner Names</h3>' +
    '<div class="partner-row">' +
    '<input class="partner-name-input" id="name-user1" value="' + escapeHtml(user1.name) + '" placeholder="Your name" maxlength="20">' +
    '</div><div class="partner-row">' +
    '<input class="partner-name-input" id="name-user2" value="' + escapeHtml(user2.name) + '" placeholder="Partner name" maxlength="20">' +
    '</div></div>' +

    // Currency
    '<div class="profile-section">' +
    '<h3>Currency</h3>' +
    '<select class="currency-select" id="currency-select">' +
    ['€','$','£','¥','CHF','kr','₹','R$'].map(c => '<option value="' + c + '"' + (currency===c?' selected':'') + '>' + c + '</option>').join('') +
    '</select></div>' +

    // Partner sync
    '<div class="profile-section">' +
    '<h3>Partner Sync</h3>' +
    '<div class="pair-status-row">' +
    '<div class="pair-status-dot ' + (syncConnected ? 'connected' : 'offline') + '"></div>' +
    '<span style="font-size:14px;font-weight:600">' + (syncConnected ? '● Connected' : '○ Not connected') + '</span>' +
    '</div>' +
    '<div class="pair-code-display" id="my-code-display">' +
    '<div style="font-size:12px;opacity:.6;margin-bottom:4px">YOUR CODE</div>' +
    '<div class="pair-code-digits" id="my-pairing-code">------</div>' +
    '<div class="pair-code-hint">Share this with your partner</div>' +
    '</div>' +
    '<button class="btn-secondary" id="generate-code-btn" style="margin-bottom:10px">Generate My Code</button>' +
    '<input class="pair-code-input" id="partner-code-input" placeholder="Partner\'s code" maxlength="6" inputmode="text" autocomplete="off">' +
    '<button class="btn-primary" id="connect-partner-btn" style="margin-top:8px;display:block;width:100%">Connect to Partner</button>' +
    (syncConnected ? '<button class="btn-danger-outline" id="disconnect-btn" style="margin-top:8px">Disconnect</button>' : '') +
    '</div>' +

    // Appearance
    '<div class="profile-section">' +
    '<h3>Appearance</h3>' +
    '<div class="theme-selector">' +
    [['system','System'], ['light','Light'], ['dark','Dark']].map(([val, label]) =>
      '<button class="theme-btn' + ((state.settings.theme || 'system') === val ? ' active' : '') + '" data-theme-val="' + val + '">' +
      (val === 'system' ? '☀︎⁄☽' : val === 'light' ? '☀︎' : '☽') + ' ' + label + '</button>'
    ).join('') +
    '</div></div>' +

    // Setup / Danger zone
    '<div class="profile-section">' +
    '<h3>Budget</h3>' +
    '<div class="profile-actions">' +
    '<button class="btn-secondary" id="edit-budget-btn">Edit Budget Setup</button>' +
    '<button class="btn-danger" id="reset-month-btn">Reset This Month</button>' +
    '</div></div>' +

    // Vacation Mode
    '<div class="profile-section">' +
    '<h3>Vacation Mode</h3>' +
    (state.activeVacation
      ? '<div class="vac-active-card">' +
        '<span>🏖️ ' + escapeHtml(state.activeVacation.name) + '</span>' +
        '<span class="vac-active-badge">ACTIVE</span>' +
        '</div>' +
        '<p class="setup-subtitle" style="margin:8px 0 10px">All expenses are being tracked for this vacation.</p>' +
        '<button class="btn-primary" id="end-vac-btn" style="display:block;width:100%">End Vacation &amp; Settle</button>'
      : '<p class="setup-subtitle" style="margin-bottom:10px">Track expenses during a trip and see who owes what at the end.</p>' +
        '<input class="partner-name-input" id="vac-name-input" placeholder="Trip name (e.g. Paris 2025)" maxlength="40" style="margin-bottom:8px">' +
        '<button class="btn-primary" id="start-vac-btn" style="display:block;width:100%">Start Vacation Mode</button>') +
    (state.vacations.length
      ? '<div class="section-title" style="font-size:13px;margin-top:16px;margin-bottom:8px">Past Vacations</div>' +
        state.vacations.map(v => {
          const d = new Date(v.endDate || v.startDate).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
          return '<div class="archive-row vac-history-row" data-vacid="' + v.id + '">' +
            '<span>🏖️ ' + escapeHtml(v.name) + '</span>' +
            '<span class="archive-amount">' + d + '</span>' +
            '</div>';
        }).join('')
      : '') +
    '</div>' +

    '</div>';

  // Edit profile button → restart onboarding profile step
  const profileEditBtn = document.getElementById('profile-edit-name-btn');
  if (profileEditBtn) profileEditBtn.addEventListener('click', () => {
    onboardStep = 1;
    document.getElementById('bottom-nav').style.display = 'none';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('onboard-screen').classList.add('active');
    renderOnboardStep();
  });

  // Bind events
  screen.querySelectorAll('.user-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      s.currentUser = btn.dataset.user;
      saveState();
      renderProfileScreen();
      renderMiniStatus();
      showToast('Switched to ' + btn.textContent, 'info');
    });
  });

  ['user1','user2'].forEach(uid => {
    const inp = document.getElementById('name-' + uid);
    if (inp) inp.addEventListener('change', () => {
      const u = s.users.find(x => x.id === uid);
      if (u) { u.name = inp.value.trim() || u.name; saveState(); }
    });
  });

  const currSel = document.getElementById('currency-select');
  if (currSel) currSel.addEventListener('change', () => { s.currency = currSel.value; saveState(); renderExpenseEntry(); });

  // Theme buttons
  screen.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.theme = btn.dataset.themeVal;
      saveState();
      applyTheme();
      renderProfileScreen();
    });
  });

  // Pairing
  document.getElementById('generate-code-btn').addEventListener('click', async () => {
    const display = document.getElementById('my-pairing-code');
    if (display) display.textContent = '...';
    try {
      await syncMgr.initPeer();
      const code = syncMgr.getPairingCode();
      if (display) display.textContent = code || '------';
      showToast('Your code is ready!', 'success');
    } catch(e) {
      if (display) display.textContent = 'Error';
      showToast('Could not generate code. Check internet.', 'error');
    }
  });

  document.getElementById('connect-partner-btn').addEventListener('click', async () => {
    const input = document.getElementById('partner-code-input');
    const code = (input ? input.value.trim().toLowerCase() : '');
    if (code.length < 4) return showToast('Enter partner\'s code', 'error');
    showToast('Connecting…', 'info');
    try {
      await syncMgr.initPeer();
      // The partner's peer ID is their device ID prefix - but they share just last 6 chars.
      // We'll try connecting directly to that code as the peer ID prefix.
      // This works when their peer ID ends with those 6 chars.
      // For simplicity, we connect to their full peer ID stored when they shared.
      await syncMgr.connect(code);
      state.pairedPeerId = code;
      saveState();
      showToast('Connected to partner!', 'success');
      renderProfileScreen();
    } catch(e) {
      showToast('Connection failed. Try again.', 'error');
    }
  });

  const discBtn = document.getElementById('disconnect-btn');
  if (discBtn) discBtn.addEventListener('click', () => {
    syncMgr.disconnect();
    state.pairedPeerId = null;
    saveState();
    renderProfileScreen();
    showToast('Disconnected', 'info');
  });

  document.getElementById('edit-budget-btn').addEventListener('click', () => {
    wizardStep = 0;
    showScreen('setup-wizard');
    renderWizardStep();
  });

  document.getElementById('reset-month-btn').addEventListener('click', () => {
    if (!confirm('Reset all expenses for this month? This cannot be undone.')) return;
    const month = ensureMonth(currentMonthKey);
    month.transactions = [];
    month.fixedPaid = {};
    month.ious = [];
    saveState();
    showToast('Month reset', 'success');
    showScreen('expense-entry');
  });

  // Vacation bindings
  const startVacBtn = document.getElementById('start-vac-btn');
  if (startVacBtn) startVacBtn.addEventListener('click', () => {
    const input = document.getElementById('vac-name-input');
    startVacation(input ? input.value : '');
  });

  const endVacBtn = document.getElementById('end-vac-btn');
  if (endVacBtn) endVacBtn.addEventListener('click', () => {
    if (!confirm('End vacation and see the settlement?')) return;
    endVacation();
  });

  screen.querySelectorAll('.vac-history-row').forEach(row => {
    row.addEventListener('click', () => {
      const vac = state.vacations.find(v => v.id === row.dataset.vacid);
      if (vac) showVacationSummaryModal(vac);
    });
  });
}

/* ─── ONBOARDING ─── */

function startOnboarding() {
  onboardStep = 0;
  document.getElementById('bottom-nav').style.display = 'none';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('onboard-screen').classList.add('active');
  renderOnboardStep();
}

function renderOnboardStep() {
  const content = document.getElementById('onboard-content');
  if (!content) return;
  switch (onboardStep) {
    case 0: renderOnboardWelcome(content); break;
    case 1: renderOnboardProfile(content); break;
    case 2: renderOnboardPairing(content); break;
  }
}

function renderOnboardWelcome(content) {
  content.innerHTML =
    '<div class="ob-welcome">' +
      '<div class="ob-logo-wrap">' +
        '<img src="icon.svg" class="ob-logo" alt="Pairly">' +
        '<div class="ob-app-name">pairly</div>' +
      '</div>' +
      '<div class="ob-tagline">' +
        '<p>Budget together,</p><p>stress less.</p>' +
      '</div>' +
      '<div class="ob-welcome-actions">' +
        '<button class="btn-primary ob-cta" id="ob-start">Get started</button>' +
      '</div>' +
      '<div class="ob-sub-actions">' +
        '<button class="ob-skip-all" id="ob-skip-all">Already have an account? Skip setup</button>' +
      '</div>' +
    '</div>';
  document.getElementById('ob-start').addEventListener('click', () => { onboardStep = 1; renderOnboardStep(); });
  document.getElementById('ob-skip-all').addEventListener('click', () => finishOnboarding(true));
}

function renderOnboardProfile(content) {
  const profile = state.profile || { name: '', color: AVATAR_COLORS[0] };
  const initial = profile.name ? profile.name[0].toUpperCase() : '?';
  content.innerHTML =
    '<div class="ob-step-wrap">' +
      '<div class="ob-step-label">Step 1 of 2</div>' +
      '<h2 class="ob-step-title">Create your profile</h2>' +
      '<p class="ob-step-sub">How should your partner see you?</p>' +
      '<div class="ob-avatar-wrap">' +
        '<div class="ob-avatar" id="ob-avatar-preview" style="background:' + profile.color + '">' +
          '<span id="ob-avatar-initial">' + initial + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="setup-field">' +
        '<label class="setup-label">Your name</label>' +
        '<input type="text" id="ob-name" class="ob-text-input" ' +
          'value="' + escapeHtml(profile.name) + '" ' +
          'placeholder="Enter your name" ' +
          'autocomplete="given-name" autocapitalize="words" ' +
          'inputmode="text" maxlength="20">' +
      '</div>' +
      '<div class="ob-color-label">Your colour</div>' +
      '<div class="ob-color-grid" id="ob-color-grid">' +
        AVATAR_COLORS.map(c =>
          '<button class="ob-color-swatch' + (c === profile.color ? ' selected' : '') + '" ' +
          'data-color="' + c + '" style="background:' + c + '" aria-label="Color ' + c + '"></button>'
        ).join('') +
      '</div>' +
      '<div class="setup-nav" style="margin-top:28px">' +
        '<button class="btn-ghost" id="ob-back">← Back</button>' +
        '<button class="btn-primary" id="ob-next">Continue →</button>' +
      '</div>' +
    '</div>';

  const nameInput = document.getElementById('ob-name');
  const avatarEl = document.getElementById('ob-avatar-preview');
  const initialEl = document.getElementById('ob-avatar-initial');

  nameInput.addEventListener('input', () => {
    const v = nameInput.value.trim();
    initialEl.textContent = v ? v[0].toUpperCase() : '?';
  });
  nameInput.focus();

  document.querySelectorAll('.ob-color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ob-color-swatch').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      avatarEl.style.background = btn.dataset.color;
      state.profile.color = btn.dataset.color;
    });
  });

  document.getElementById('ob-back').addEventListener('click', () => { onboardStep = 0; renderOnboardStep(); });
  document.getElementById('ob-next').addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.classList.add('ob-input-error'); nameInput.focus(); return; }
    state.profile.name = name;
    state.settings.users[0].name = name;
    saveState();
    onboardStep = 2;
    renderOnboardStep();
  });
}

function renderOnboardPairing(content) {
  const myCode = getOrCreateInviteCode();
  // Pre-fill if opened via share link
  const pairParam = new URLSearchParams(location.search).get('pair');
  if (pairParam) history.replaceState({ app: true }, '', location.pathname);

  content.innerHTML =
    '<div class="ob-step-wrap">' +
      '<div class="ob-step-label">Step 2 of 2</div>' +
      '<h2 class="ob-step-title">Connect your partner</h2>' +
      '<p class="ob-step-sub">Share your code so you can track together in real time</p>' +

      '<div class="ob-pair-card">' +
        '<div class="ob-pair-card-label">Your invite code</div>' +
        '<div class="ob-pair-code" id="ob-pair-code">' + myCode + '</div>' +
        '<button class="ob-share-btn" id="ob-share-btn">Share invite link</button>' +
      '</div>' +

      '<div class="ob-pair-divider"><span>or enter partner\'s code</span></div>' +

      '<div class="setup-field">' +
        '<input type="text" id="ob-partner-code" class="ob-code-input" ' +
          'value="' + (pairParam ? escapeHtml(pairParam) : '') + '" ' +
          'placeholder="e.g. A3BX7K" ' +
          'maxlength="8" autocomplete="off" autocorrect="off" ' +
          'autocapitalize="characters" spellcheck="false" inputmode="text">' +
      '</div>' +

      '<div id="ob-pair-status" class="ob-pair-status" hidden></div>' +

      '<div class="setup-nav" style="margin-top:16px">' +
        '<button class="btn-ghost" id="ob-back">← Back</button>' +
        '<button class="btn-primary" id="ob-connect">Connect →</button>' +
      '</div>' +
      '<button class="ob-skip-btn" id="ob-skip">Skip — I\'ll connect later from Profile</button>' +
    '</div>';

  document.getElementById('ob-back').addEventListener('click', () => { onboardStep = 1; renderOnboardStep(); });
  document.getElementById('ob-skip').addEventListener('click', finishOnboarding);

  document.getElementById('ob-share-btn').addEventListener('click', () => {
    const shareUrl = location.origin + location.pathname + '?pair=' + myCode;
    const text = (state.profile.name || 'Your partner') + ' is inviting you to track your budget together on Pairly. Use code: ' + myCode;
    if (navigator.share) {
      navigator.share({ title: 'Join me on Pairly', text, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl)
        .then(() => showToast('Invite link copied!', 'success'))
        .catch(() => {
          // Fallback: show code in toast
          showToast('Your code: ' + myCode, 'info');
        });
    }
  });

  document.getElementById('ob-connect').addEventListener('click', () => {
    const partnerCode = document.getElementById('ob-partner-code').value.trim().toUpperCase();
    if (!partnerCode || partnerCode.length < 4) {
      showToast('Enter your partner\'s code first', 'info');
      document.getElementById('ob-partner-code').focus();
      return;
    }
    const statusEl = document.getElementById('ob-pair-status');
    statusEl.hidden = false;
    statusEl.textContent = 'Connecting…';
    statusEl.className = 'ob-pair-status connecting';
    connectWithCode(partnerCode, statusEl, () => {
      setTimeout(finishOnboarding, 800);
    });
  });

  // Auto-trigger if deep link had a code
  if (pairParam) {
    document.getElementById('ob-partner-code').value = pairParam.toUpperCase();
  }
}

function getOrCreateInviteCode() {
  if (!state.inviteCode) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    state.inviteCode = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    saveState();
  }
  return state.inviteCode;
}

function connectWithCode(partnerCode, statusEl, onSuccess) {
  // Store partner code — the SyncManager will use it once PeerJS initialises
  state.settings.partnerCode = partnerCode;
  saveState();

  const updateStatus = (msg, cls) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'ob-pair-status ' + (cls || '');
  };

  // Try to initialise the peer connection
  if (!syncMgr) { onSuccess && onSuccess(); return; }

  syncMgr.initPeer().then(() => {
    const myPeerId = syncMgr.peerId;
    // Derive the partner's likely peer ID from their invite code
    // Convention: peer ID ends with the invite code (lowercase)
    // We search for a peer whose ID ends in their code
    const partnerPeerId = partnerCode.toLowerCase();
    updateStatus('Reaching partner…', 'connecting');
    return syncMgr.connect(partnerPeerId);
  }).then(() => {
    state.pairedPeerId = partnerCode.toLowerCase();
    saveState();
    updateStatus('Connected! 🎉', 'success');
    onSuccess && onSuccess();
  }).catch(() => {
    // Connection failed — still save the code and let them try again from Profile
    updateStatus('Saved! Will connect when partner is online.', 'saved');
    setTimeout(onSuccess, 1200);
  });
}

function finishOnboarding(skipSetup) {
  state.onboarded = true;
  saveState();
  // Save to new storage key
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}

  document.getElementById('bottom-nav').style.display = '';

  const month = state.months[currentMonthKey];
  if (!skipSetup && (!month || month.joint.total === 0)) {
    startWizard();
  } else {
    showScreen('expense-entry');
  }
}

/* ─── SETUP WIZARD ─── */
// Steps: 0=Joint Budget, 1=Fixed Costs, 2=Personal Budgets, 3=Summary
const WIZARD_STEPS = 4;

function startWizard() {
  wizardStep = 0;
  document.getElementById('bottom-nav').style.display = 'none';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('setup-wizard').classList.add('active');
  renderWizardStep();
}

function renderWizardProgress() {
  const el = document.getElementById('setup-progress');
  if (!el) return;
  el.innerHTML = Array.from({length:WIZARD_STEPS}, (_,i) =>
    '<div class="progress-dot' + (i === wizardStep ? ' active' : '') + '"></div>'
  ).join('');
}

function renderWizardStep() {
  renderWizardProgress();
  const content = document.getElementById('setup-step-content');
  if (!content) return;

  const month = ensureMonth(currentMonthKey);
  const s = state.settings;
  const currency = s.currency || '€';

  // Animate step content in
  content.classList.remove('wizard-step-enter');
  void content.offsetWidth;
  content.classList.add('wizard-step-enter');

  switch(wizardStep) {
    // ── Step 0: Joint Budget Total ──
    case 0:
      content.innerHTML =
        '<div class="wizard-step-icon">💰</div>' +
        '<h2>Joint budget</h2>' +
        '<p class="setup-subtitle">Your shared monthly spending — fixed costs will be reserved from this automatically</p>' +
        '<div class="setup-field">' +
        '<div class="setup-amount-input large"><span class="currency">' + currency + '</span>' +
        '<input type="number" id="joint-total" value="' + (month.joint.total||'') + '" placeholder="0" inputmode="decimal" min="0" step="1"></div></div>' +
        '<div class="setup-nav single"><button class="btn-primary" id="wizard-next">Continue →</button></div>';
      document.getElementById('wizard-next').addEventListener('click', () => {
        const val = parseFloat(document.getElementById('joint-total').value) || 0;
        month.joint.total = val;
        saveState();
        nextWizardStep();
      });
      document.getElementById('joint-total').focus();
      break;

    // ── Step 1: Fixed Costs ──
    case 1: {
      const fixedCosts = s.fixedCosts;
      const fixedTotal = fixedCosts.reduce((s,fc) => s + fc.amount, 0);
      const varBudget = Math.max(0, month.joint.total - fixedTotal);

      let fcListHtml = fixedCosts.map((fc, i) =>
        '<div class="fixed-cost-item" data-idx="' + i + '">' +
        '<div class="fixed-cost-icon">' + fc.icon + '</div>' +
        '<div class="fixed-cost-info"><div class="fixed-cost-name">' + fc.name + '</div>' +
        '<div class="fixed-cost-meta">Due ' + fc.dueDay + (fc.dueDay===1?'st':fc.dueDay===2?'nd':fc.dueDay===3?'rd':'th') + ' · ' + (fc.paidBy === 'joint' ? 'Joint' : fc.paidBy === 'split' ? 'Split 50/50' : fc.paidBy) + '</div></div>' +
        '<div class="fixed-cost-amount">' + fmt(fc.amount, currency) + '</div>' +
        '<button class="fixed-cost-remove" data-idx="' + i + '" aria-label="Remove">×</button>' +
        '</div>'
      ).join('');

      content.innerHTML =
        '<div class="wizard-step-icon">📋</div>' +
        '<h2>Fixed costs</h2>' +
        '<p class="setup-subtitle">Recurring bills reserved from your joint budget each month</p>' +
        '<div class="fixed-costs-list" id="fc-list">' + (fcListHtml || '<div class="fc-empty">No fixed costs yet — tap below to add</div>') + '</div>' +
        '<button class="add-fixed-cost-btn" id="add-fc-btn">+ Add fixed cost</button>' +
        (fixedCosts.length ? '<div class="fixed-summary-bar"><div class="s-row"><span>Reserved for fixed</span><span><strong>' + fmt(fixedTotal, currency) + '</strong></span></div><div class="s-row highlight"><span>Variable remaining</span><span><strong>' + fmt(varBudget, currency) + '</strong></span></div></div>' : '') +
        '<div class="setup-nav">' +
        '<button class="btn-ghost" id="wizard-back">← Back</button>' +
        '<button class="btn-primary" id="wizard-next">Continue →</button>' +
        '</div>';

      document.getElementById('add-fc-btn').addEventListener('click', () => showAddFixedCostModal());
      document.querySelectorAll('.fixed-cost-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          s.fixedCosts.splice(parseInt(btn.dataset.idx), 1);
          saveState();
          renderWizardStep();
        });
      });
      document.getElementById('wizard-back').addEventListener('click', () => { wizardStep--; renderWizardStep(); });
      document.getElementById('wizard-next').addEventListener('click', nextWizardStep);
      break;
    }

    // ── Step 2: Personal Budgets ──
    case 2: {
      const me = s.currentUser;
      const myUser = s.users.find(u=>u.id===me) || {id:me,name:'You'};
      content.innerHTML =
        '<div class="wizard-step-icon">👤</div>' +
        '<h2>Personal budget</h2>' +
        '<p class="setup-subtitle">Your individual spending limit — separate from the joint budget</p>' +
        '<div class="setup-personal-row">' +
        '<div class="setup-field"><label>' + escapeHtml(myUser.name) + '</label>' +
        '<div class="setup-amount-input"><span class="currency">' + currency + '</span>' +
        '<input type="number" id="personal-me" value="' + (month.personal[me].total||'') + '" placeholder="0" inputmode="decimal" min="0"></div></div>' +
        '</div>' +
        '<div class="setup-nav">' +
        '<button class="btn-ghost" id="wizard-back">← Back</button>' +
        '<button class="btn-primary" id="wizard-next">Continue →</button>' +
        '</div>';
      document.getElementById('wizard-back').addEventListener('click', () => { wizardStep--; renderWizardStep(); });
      document.getElementById('wizard-next').addEventListener('click', () => {
        month.personal[me].total = parseFloat(document.getElementById('personal-me').value) || 0;
        saveState();
        nextWizardStep();
      });
      break;
    }

    // ── Step 3: Summary ──
    case 3: {
      const fixedTotal = s.fixedCosts.reduce((sum,fc) => sum + fc.amount, 0);
      const varBudget = Math.max(0, month.joint.total - fixedTotal);
      const user1 = s.users.find(u=>u.id==='user1') || {id:'user1',name:'You'};
      const user2 = s.users.find(u=>u.id==='user2') || {id:'user2',name:'Partner'};
      content.innerHTML =
        '<div class="wizard-step-icon">✅</div>' +
        '<h2>All set!</h2>' +
        '<p class="setup-subtitle">Your budget for this month</p>' +
        '<div class="setup-summary">' +
        '<div class="summary-row joint"><span>Joint budget</span><strong>' + fmt(month.joint.total, currency) + '</strong></div>' +
        (s.fixedCosts.length ? '<div class="summary-row fixed indent"><span>→ Fixed reserved</span><span>−' + fmt(fixedTotal, currency) + '</span></div>' : '') +
        (s.fixedCosts.length ? '<div class="summary-row available indent"><span>→ Variable available</span><strong>' + fmt(varBudget, currency) + '</strong></div>' : '') +
        (month.personal.user1.total > 0 ? '<div class="summary-row personal"><span>' + escapeHtml(user1.name) + '\'s personal</span><strong>' + fmt(month.personal.user1.total, currency) + '</strong></div>' : '') +
        (month.personal.user2.total > 0 ? '<div class="summary-row personal"><span>' + escapeHtml(user2.name) + '\'s personal</span><strong>' + fmt(month.personal.user2.total, currency) + '</strong></div>' : '') +
        '</div>' +
        '<div class="setup-hint" style="margin-top:12px">Unforeseen expenses are always tracked separately — no need to budget for the unexpected.</div>' +
        '<div class="setup-nav" style="margin-top:16px">' +
        '<button class="btn-ghost" id="wizard-back">← Back</button>' +
        '<button class="btn-primary" id="wizard-finish">Start tracking →</button>' +
        '</div>';
      document.getElementById('wizard-back').addEventListener('click', () => { wizardStep--; renderWizardStep(); });
      document.getElementById('wizard-finish').addEventListener('click', () => {
        saveState();
        document.getElementById('bottom-nav').style.display = '';
        showScreen('expense-entry');
      });
      break;
    }
  }
}

function nextWizardStep() {
  wizardStep++;
  if (wizardStep >= WIZARD_STEPS) wizardStep = WIZARD_STEPS - 1;
  renderWizardStep();
}

/* ─── VACATION MODE ─── */
function renderVacationBanner() {
  const banner = document.getElementById('vacation-banner');
  if (!banner) return;
  if (state.activeVacation) {
    banner.hidden = false;
    const nameEl = document.getElementById('vac-banner-name');
    if (nameEl) nameEl.textContent = '🏖️ ' + state.activeVacation.name;
    const endBtn = document.getElementById('vac-end-quick-btn');
    if (endBtn) {
      endBtn.onclick = () => {
        if (!confirm('End vacation and see the settlement?')) return;
        endVacation();
      };
    }
  } else {
    banner.hidden = true;
  }
}

function startVacation(name) {
  if (!name || !name.trim()) return showToast('Enter a vacation name', 'error');
  state.activeVacation = {
    id: 'vac_' + generateId(),
    name: name.trim(),
    startDate: new Date().toISOString(),
  };
  saveState();
  if (currentScreen === 'profile-screen') renderProfileScreen();
  renderExpenseEntry();
  showToast('Vacation mode started! 🏖️', 'success');
}

function endVacation() {
  if (!state.activeVacation) return;
  const vacation = { ...state.activeVacation, endDate: new Date().toISOString() };
  const txs = getVacationExpenses(vacation.id);
  vacation.txCount = txs.length;
  state.vacations.unshift(vacation);
  state.activeVacation = null;
  saveState();
  showVacationSummaryModal(vacation);
  renderExpenseEntry(); // hide banner on add screen
  if (currentScreen === 'profile-screen') renderProfileScreen(); // refresh profile if visible
}

function getVacationExpenses(vacationId) {
  const txs = [];
  Object.values(state.months).forEach(month => {
    month.transactions.forEach(tx => {
      if (tx.vacationId === vacationId) txs.push(tx);
    });
  });
  txs.sort((a, b) => new Date(a.date) - new Date(b.date));
  return txs;
}

function getVacationSettlement(vacationId) {
  const txs = getVacationExpenses(vacationId);
  const user1 = state.settings.users.find(u => u.id === 'user1') || {id:'user1', name:'User 1'};
  const user2 = state.settings.users.find(u => u.id === 'user2') || {id:'user2', name:'User 2'};

  let user1Paid = 0;
  let user2Paid = 0;

  txs.forEach(tx => {
    const amount = tx.amount;
    const isUser1 = tx.userId === 'user1';
    if (tx.paidBy === 'me') {
      if (isUser1) user1Paid += amount; else user2Paid += amount;
    } else if (tx.paidBy === 'partner') {
      if (isUser1) user2Paid += amount; else user1Paid += amount;
    } else if (tx.paidBy === 'both') {
      const ratio = tx.splitRatio != null ? tx.splitRatio : 0.5;
      if (isUser1) { user1Paid += amount * ratio; user2Paid += amount * (1 - ratio); }
      else { user2Paid += amount * ratio; user1Paid += amount * (1 - ratio); }
    } else {
      if (isUser1) user1Paid += amount; else user2Paid += amount;
    }
  });

  const totalSpent = user1Paid + user2Paid;
  const fairShare = totalSpent / 2;
  const net = user1Paid - fairShare; // positive → user2 owes user1; negative → user1 owes user2

  return { user1, user2, user1Paid, user2Paid, totalSpent, fairShare, net, txs };
}

function showVacationSummaryModal(vacation) {
  const s = getVacationSettlement(vacation.id);
  const currency = state.settings.currency;
  const startDate = new Date(vacation.startDate).toLocaleDateString('en-US', {month:'short', day:'numeric'});
  const endDate   = vacation.endDate
    ? new Date(vacation.endDate).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})
    : 'Ongoing';

  let settlementHtml = '';
  if (s.totalSpent === 0) {
    settlementHtml = '<div class="vac-settlement-empty">No expenses logged during this vacation.</div>';
  } else {
    const owes = s.net > 0.005
      ? escapeHtml(s.user2.name) + ' owes ' + escapeHtml(s.user1.name) + ' ' + fmt(Math.abs(s.net), currency)
      : s.net < -0.005
        ? escapeHtml(s.user1.name) + ' owes ' + escapeHtml(s.user2.name) + ' ' + fmt(Math.abs(s.net), currency)
        : "You're even! 🎉";

    settlementHtml =
      '<div class="vac-totals-row">' +
        '<div class="vac-person-total">' +
          '<div class="vac-person-name">' + escapeHtml(s.user1.name) + '</div>' +
          '<div class="vac-person-paid">' + fmt(s.user1Paid, currency) + '</div>' +
          '<div class="vac-person-label">paid</div>' +
        '</div>' +
        '<div class="vac-vs">⟺</div>' +
        '<div class="vac-person-total">' +
          '<div class="vac-person-name">' + escapeHtml(s.user2.name) + '</div>' +
          '<div class="vac-person-paid">' + fmt(s.user2Paid, currency) + '</div>' +
          '<div class="vac-person-label">paid</div>' +
        '</div>' +
      '</div>' +
      '<div class="vac-settlement-box">' +
        '<div class="vac-settle-label">Settlement</div>' +
        '<div class="vac-settle-amount">' + owes + '</div>' +
        '<div class="vac-settle-sub">Total: ' + fmt(s.totalSpent, currency) + ' · Fair share: ' + fmt(s.fairShare, currency) + ' each</div>' +
      '</div>';
  }

  const txListHtml = s.txs.length
    ? '<div class="vac-tx-list">' +
      s.txs.map(tx => {
        const icon = tx.isFixed ? '🔒' : (VAR_CATEGORIES.find(c => c.name === tx.category) || {icon:'📦'}).icon;
        const d = new Date(tx.date).toLocaleDateString('en-US', {month:'short', day:'numeric'});
        const paidLabel = tx.paidBy === 'me'
          ? (state.settings.users.find(u => u.id === tx.userId) || {name:'?'}).name
          : tx.paidBy === 'partner'
            ? (state.settings.users.find(u => u.id !== tx.userId) || {name:'?'}).name
            : 'Split';
        return '<div class="vac-tx-item">' +
          '<span class="vac-tx-icon">' + icon + '</span>' +
          '<div class="vac-tx-details">' +
            '<span class="vac-tx-cat">' + escapeHtml(tx.category) + (tx.note ? ' · ' + escapeHtml(tx.note) : '') + '</span>' +
            '<span class="vac-tx-who">' + paidLabel + ' · ' + d + '</span>' +
          '</div>' +
          '<span class="vac-tx-amt">' + fmt(tx.amount, currency) + '</span>' +
          '</div>';
      }).join('') +
      '</div>'
    : '';

  showModal('<div class="detail-modal">' +
    '<div class="modal-handle"></div>' +
    '<h3>🏖️ ' + escapeHtml(vacation.name) + '</h3>' +
    '<div class="vac-dates">' + startDate + ' – ' + endDate + ' · ' + s.txs.length + ' expense' + (s.txs.length !== 1 ? 's' : '') + '</div>' +
    settlementHtml +
    (s.txs.length > 0
      ? '<div class="section-title" style="font-size:14px;margin-top:16px;margin-bottom:8px">Expenses</div>' + txListHtml
      : '') +
    '</div>');
}

/* ─── ADD FIXED COST MODAL ─── */
function showAddFixedCostModal() {
  const currency = state.settings.currency;
  const iconOptions = Object.entries(FIXED_ICONS).map(([name,icon]) =>
    '<option value="' + icon + '">' + icon + ' ' + name + '</option>'
  ).join('');

  showModal('<div class="detail-modal">' +
    '<div class="modal-handle"></div>' +
    '<h3>Add Fixed Cost</h3>' +
    '<div class="setup-field" style="margin-bottom:12px"><label>Name</label>' +
    '<input class="partner-name-input" id="fc-name" placeholder="Rent, Insurance, etc." maxlength="30"></div>' +
    '<div class="setup-field" style="margin-bottom:12px"><label>Amount (' + currency + ')</label>' +
    '<div class="setup-amount-input"><span class="currency">' + currency + '</span>' +
    '<input type="number" id="fc-amount" placeholder="0" inputmode="decimal" min="0" step="0.01"></div></div>' +
    '<div class="setup-field" style="margin-bottom:12px"><label>Due Day of Month</label>' +
    '<input class="partner-name-input" id="fc-dueday" type="number" min="1" max="28" placeholder="1-28" inputmode="numeric" value="1"></div>' +
    '<div class="setup-field" style="margin-bottom:12px"><label>Paid By</label>' +
    '<select class="currency-select" id="fc-paidby">' +
    '<option value="joint">Joint Account</option>' +
    '<option value="split">Split 50/50</option>' +
    '<option value="user1">' + (state.settings.users.find(u=>u.id==="user1")||{name:"User 1"}).name + '</option>' +
    '<option value="user2">' + (state.settings.users.find(u=>u.id==="user2")||{name:"User 2"}).name + '</option>' +
    '</select></div>' +
    '<div class="setup-field" style="margin-bottom:16px"><label>Icon</label>' +
    '<select class="currency-select" id="fc-icon">' + iconOptions + '</select></div>' +
    '<button class="btn-primary" id="fc-save-btn" style="width:100%">Add Fixed Cost</button>' +
    '</div>');

  document.getElementById('fc-save-btn').addEventListener('click', () => {
    const name    = (document.getElementById('fc-name').value || '').trim();
    const amount  = parseFloat(document.getElementById('fc-amount').value) || 0;
    const dueDay  = parseInt(document.getElementById('fc-dueday').value) || 1;
    const paidBy  = document.getElementById('fc-paidby').value;
    const icon    = document.getElementById('fc-icon').value;
    if (!name || amount <= 0) return showToast('Name and amount required', 'error');
    state.settings.fixedCosts.push({ id: 'fc_' + generateId(), name, amount, dueDay: Math.min(28, Math.max(1,dueDay)), paidBy, splitRatio: 0.5, icon, category: name });
    saveState();
    closeModal();
    renderWizardStep();
  });
}

/* ─── MODAL ─── */
function showModal(html) {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.innerHTML = '<div class="modal-content">' + html + '</div>';
  overlay.classList.add('show');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); }, { once: true });
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('show');
}

/* ─── TOAST ─── */
function showToast(msg, type) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast ' + (type || 'info');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/* ─── HELPERS ─── */
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── THEME ─── */
function applyTheme(theme) {
  theme = theme || (state && state.settings && state.settings.theme) || 'system';
  const html = document.documentElement;
  if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    html.setAttribute('data-theme', 'light');
  } else {
    html.removeAttribute('data-theme');
  }
}

// React to OS-level changes when user has chosen "system"
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!state || (state.settings.theme || 'system') === 'system') applyTheme('system');
});

/* ─── BOOT ─── */
function boot() {
  const hasData = loadState();
  if (!hasData) state = defaultState();

  applyTheme();
  initSync();

  // Nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  // Mini-status tap → status screen
  const miniStatus = document.getElementById('mini-status');
  if (miniStatus) miniStatus.addEventListener('click', () => showScreen('status-screen'));

  // Sync chip tap → profile pairing section
  const syncChip = document.getElementById('sync-chip');
  if (syncChip) syncChip.addEventListener('click', () => showScreen('profile-screen'));

  // Init expense entry components
  initNumpad();
  initSubmitBtn();
  initTypeToggle();
  initRepeatBtn();
  initSplitPanel();

  // Route: onboarding → budget wizard → main app
  const month = state.months[currentMonthKey];
  if (!state.onboarded || !state.profile || !state.profile.name) {
    startOnboarding();
  } else if (!month || month.joint.total === 0) {
    startWizard();
  } else {
    showScreen('expense-entry');
  }

  // Monthly rollover check
  checkMonthRollover();

  // Keyboard: Enter submits
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && currentScreen === 'expense-entry') submitExpense();
    if (e.key === 'Escape') closeModal();
  });

  // Android hardware back button: close modal if open, else go to expense-entry
  history.pushState({ app: true }, '');
  window.addEventListener('popstate', (e) => {
    const overlay = document.getElementById('modal-overlay');
    if (overlay && overlay.classList.contains('show')) {
      closeModal();
      history.pushState({ app: true }, '');
    } else if (currentScreen !== 'expense-entry') {
      showScreen('expense-entry');
      history.pushState({ app: true }, '');
    }
  });

  // Handle ?quick= URL params from PWA manifest shortcuts
  const quickParam = new URLSearchParams(location.search).get('quick');
  if (quickParam) {
    showScreen('expense-entry');
    // Try to pre-select the matching category pill after render
    setTimeout(() => {
      const pills = document.querySelectorAll('.category-pill');
      for (const pill of pills) {
        if (pill.dataset.category && pill.dataset.category.toLowerCase() === quickParam.toLowerCase()) {
          pill.click();
          break;
        }
      }
    }, 100);
    // Clean URL without reloading
    history.replaceState({ app: true }, '', location.pathname);
  }

  // Register service worker for PWA / Play Store TWA support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('[SW] Registered, scope:', reg.scope);
        // Listen for SW-driven sync-complete events
        navigator.serviceWorker.addEventListener('message', (evt) => {
          if (evt.data && evt.data.type === 'SYNC_COMPLETE') {
            updateSyncChip('online');
          }
        });
      })
      .catch(err => console.warn('[SW] Registration failed:', err));
  }
}

function checkMonthRollover() {
  const prevMonthKey = (() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
  })();

  // If current month has no budget but last month does, copy budget settings
  const current = state.months[currentMonthKey];
  const prev = state.months[prevMonthKey];
  if ((!current || current.joint.total === 0) && prev && prev.joint.total > 0) {
    const m = ensureMonth(currentMonthKey);
    m.joint.total = prev.joint.total;
    m.joint.allocated = { ...prev.joint.allocated };
    m.personal.user1.total = prev.personal.user1.total;
    m.personal.user2.total = prev.personal.user2.total;
    saveState();
    showToast('Budget rolled over from last month', 'info');
  }
}

document.addEventListener('DOMContentLoaded', boot);

/* ══════════════════════════════════════════
   COUPLE BUDGET PWA — app.js
   Zero-friction expense logging in 3 seconds
══════════════════════════════════════════ */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY  = 'couplebudget_v2';
const APP_VERSION  = '1.0.0';

const CATEGORIES = [
  { name: 'Food',          icon: '🍔' },
  { name: 'Transport',     icon: '🚌' },
  { name: 'Shopping',      icon: '🛍️' },
  { name: 'Housing',       icon: '🏠' },
  { name: 'Entertainment', icon: '🎬' },
  { name: 'Health',        icon: '💊' },
  { name: 'Other',         icon: '📝' },
];

// Keyword → category mapping for smart note suggestions
const SUGGESTIONS = {
  starbucks:'Food', coffee:'Food', café:'Food', cafe:'Food',
  restaurant:'Food', pizza:'Food', sushi:'Food', burger:'Food',
  lunch:'Food', dinner:'Food', breakfast:'Food', brunch:'Food',
  grocery:'Food', groceries:'Food', supermarket:'Food', market:'Food',
  uber:'Transport', lyft:'Transport', taxi:'Transport', bolt:'Transport',
  bus:'Transport', metro:'Transport', train:'Transport', tram:'Transport',
  fuel:'Transport', gas:'Transport', petrol:'Transport', parking:'Transport',
  amazon:'Shopping', zara:'Shopping', ikea:'Shopping', hm:'Shopping',
  netflix:'Entertainment', spotify:'Entertainment', cinema:'Entertainment',
  movie:'Entertainment', concert:'Entertainment', theatre:'Entertainment',
  gym:'Health', pharmacy:'Health', doctor:'Health', dentist:'Health',
  hospital:'Health', medicine:'Health',
  rent:'Housing', mortgage:'Housing', electricity:'Housing',
  internet:'Housing', phone:'Housing', utility:'Housing',
};

// ─── Default state ─────────────────────────────────────────────────────────────

function defaultState() {
  return {
    version: APP_VERSION,
    settings: {
      currency:    '€',
      users:       [
        { id: 'user1', name: 'Partner 1' },
        { id: 'user2', name: 'Partner 2' },
      ],
      currentUser: 'user1',
      categories:  CATEGORIES.map(c => c.name),
    },
    months:       {},  // keyed by 'YYYY-MM'
    lastCategory: 'Food',
    lastType:     'joint',
    lastTx:       null,   // for "repeat last" feature
  };
}

let state = defaultState();

// ─── Persistence ───────────────────────────────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Merge to pick up any new default fields
      state = Object.assign(defaultState(), saved);
      // Ensure users array always has 2 entries
      if (!state.settings.users || state.settings.users.length < 2) {
        state.settings.users = defaultState().settings.users;
      }
    }
  } catch (e) {
    console.warn('Failed to load state, starting fresh:', e);
    state = defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
    showToast('Failed to save — storage full?', 'error');
  }
}

// ─── Month helpers ─────────────────────────────────────────────────────────────

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentMonth() {
  return state.months[currentMonthKey()] || null;
}

function needsSetup() {
  const m = getCurrentMonth();
  return !m || m.joint.total === 0;
}

function monthLabel(key) {
  const [y, mo] = key.split('-').map(Number);
  return new Date(y, mo - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function currentMonthLabel() {
  return new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
}

// ─── UI State ──────────────────────────────────────────────────────────────────

let currentScreen    = 'expense-entry';
let currentAmount    = '';            // string as user types
let selectedCategory = 'Food';
let selectedType     = 'joint';       // joint | personal | unforeseen

// ─── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  registerSW();

  selectedCategory = state.lastCategory || 'Food';
  selectedType     = state.lastType     || 'joint';

  bindStaticEvents();

  // Handle quick-launch shortcuts from manifest
  const params = new URLSearchParams(location.search);
  const quick  = params.get('quick');
  if (quick) {
    const match = CATEGORIES.find(c => c.name.toLowerCase() === quick.toLowerCase());
    if (match) selectedCategory = match.name;
  }

  if (needsSetup()) {
    showSetupWizard();
  } else {
    showScreen('expense-entry');
  }
});

// ─── Service Worker ────────────────────────────────────────────────────────────

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ─── Screen management ─────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');

  currentScreen = id;

  // Update bottom nav highlight
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === id);
  });

  // Render screen content
  if      (id === 'expense-entry')  { renderExpenseEntry(); }
  else if (id === 'status-screen')  { renderStatusScreen(); }
  else if (id === 'history-screen') { renderHistoryScreen(); }
  else if (id === 'profile-screen') { renderProfileScreen(); }
}

// ─── Static event binding ─────────────────────────────────────────────────────

function bindStaticEvents() {
  // Bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.screen) showScreen(btn.dataset.screen);
    });
  });

  // Number pad (event delegation)
  document.getElementById('numpad').addEventListener('click', e => {
    const btn = e.target.closest('.num-btn');
    if (btn) handleNumpad(btn.dataset.value);
  });

  // Submit
  document.getElementById('submit-btn').addEventListener('click', submitExpense);

  // Repeat last
  document.getElementById('repeat-btn').addEventListener('click', repeatLast);

  // Note smart suggestions
  document.getElementById('expense-note').addEventListener('input', e => {
    suggestCategory(e.target.value);
  });

  // Mini status → go to Status screen
  document.getElementById('mini-status').addEventListener('click', () => {
    showScreen('status-screen');
  });

  // Modal backdrop dismiss
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Hardware keyboard support (for desktop testing)
  document.addEventListener('keydown', e => {
    if (currentScreen !== 'expense-entry') return;
    if (document.activeElement === document.getElementById('expense-note')) return;
    if (e.key >= '0' && e.key <= '9') { handleNumpad(e.key); return; }
    if (e.key === '.') { handleNumpad('.'); return; }
    if (e.key === 'Backspace') { handleNumpad('backspace'); return; }
    if (e.key === 'Enter') { submitExpense(); return; }
  });

  // Budget type toggle buttons
  document.querySelectorAll('.type-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => selectType(btn.dataset.type));
  });
}

// ─── Expense Entry Screen ──────────────────────────────────────────────────────

function renderExpenseEntry() {
  updateAmountDisplay();
  renderTypeToggle();
  renderCategoryPills();
  updateMiniStatus();
  updateBodyTypeClass();
}

function renderTypeToggle() {
  document.querySelectorAll('.type-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === selectedType);
  });
}

function renderCategoryPills() {
  const container = document.getElementById('category-pills');
  if (!container) return;

  container.innerHTML = state.settings.categories.map(name => {
    const cat  = CATEGORIES.find(c => c.name === name) || { icon: '📝' };
    const isSel = selectedCategory === name;
    const cls  = isSel ? `selected-${selectedType}` : '';
    return `<button class="category-pill ${cls}" data-cat="${name}" aria-pressed="${isSel}">
              ${cat.icon} ${name}
            </button>`;
  }).join('');

  container.querySelectorAll('.category-pill').forEach(pill => {
    pill.addEventListener('click', () => selectCategory(pill.dataset.cat));
  });

  // Scroll selected into view
  const sel = container.querySelector('.category-pill[aria-pressed="true"]');
  if (sel) sel.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function selectCategory(name) {
  selectedCategory = name;
  state.lastCategory = name;
  vibrate(10);
  renderCategoryPills();
}

function selectType(type) {
  selectedType     = type;
  state.lastType   = type;
  vibrate(10);
  renderTypeToggle();
  renderCategoryPills();
  updateBodyTypeClass();
  updateMiniStatus();
}

function updateBodyTypeClass() {
  document.body.className = `type-${selectedType}`;
}

// ─── Number pad ────────────────────────────────────────────────────────────────

function handleNumpad(value) {
  if (value === 'backspace') {
    currentAmount = currentAmount.slice(0, -1);
  } else if (value === '.') {
    if (currentAmount === '') currentAmount = '0';
    if (!currentAmount.includes('.')) currentAmount += '.';
  } else {
    // Guard: max 2 decimal places
    const parts = currentAmount.split('.');
    if (parts[1] && parts[1].length >= 2) return;
    // Guard: max reasonable amount
    if (currentAmount.replace('.', '').length >= 7) return;
    // Strip leading zeros
    if (currentAmount === '0') {
      currentAmount = value;
    } else {
      currentAmount += value;
    }
  }
  updateAmountDisplay();
}

function updateAmountDisplay() {
  const el = document.getElementById('amount-display');
  if (!el) return;
  el.textContent = currentAmount || '0';
  el.classList.toggle('has-value', currentAmount.length > 0);
}

// ─── Expense submission ────────────────────────────────────────────────────────

function submitExpense() {
  const amount = parseFloat(currentAmount);

  if (!amount || amount <= 0) {
    const area = document.getElementById('amount-area-el');
    if (area) { area.classList.add('shake'); setTimeout(() => area.classList.remove('shake'), 350); }
    vibrate([30, 20, 30]);
    return;
  }

  const monthKey = currentMonthKey();
  if (!state.months[monthKey]) {
    showToast('No budget set for this month', 'error');
    return;
  }

  const noteEl = document.getElementById('expense-note');
  const note   = noteEl ? noteEl.value.trim() : '';

  const tx = {
    id:       Date.now(),
    amount,
    category: selectedCategory,
    type:     selectedType,
    note,
    date:     new Date().toISOString(),
    userId:   state.settings.currentUser,
  };

  applyTransaction(tx, monthKey, +1);
  state.months[monthKey].transactions.push(tx);
  state.lastTx = tx;
  saveState();

  // Feedback
  vibrate([40, 25, 40]);
  showSuccessFlash(amount, selectedCategory);

  // Reset input
  currentAmount = '';
  if (noteEl) noteEl.value = '';
  updateAmountDisplay();
  updateMiniStatus();
}

function applyTransaction(tx, monthKey, sign) {
  const m = state.months[monthKey];
  if (!m) return;

  if (tx.type === 'joint') {
    m.joint.spent     += sign * tx.amount;
    m.joint.remaining  = m.joint.total - m.joint.spent;
    const cat = m.joint.categories.find(c => c.name === tx.category);
    if (cat) { cat.spent += sign * tx.amount; cat.remaining = cat.total - cat.spent; }

  } else if (tx.type === 'personal') {
    const p = m.personal[tx.userId];
    if (p) { p.spent += sign * tx.amount; p.remaining = p.total - p.spent; }

  } else if (tx.type === 'unforeseen') {
    m.unforeseen.spent += sign * tx.amount;
  }
}

function showSuccessFlash(amount, category) {
  const el  = document.getElementById('success-feedback');
  const cat = CATEGORIES.find(c => c.name === category) || { icon: '✓' };
  if (!el) return;
  el.textContent = `${cat.icon} ${state.settings.currency}${amount.toFixed(2)} — ${category}`;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

// ─── Smart category suggestion ─────────────────────────────────────────────────

function suggestCategory(text) {
  if (!text) return;
  const lower = text.toLowerCase();
  for (const [kw, cat] of Object.entries(SUGGESTIONS)) {
    if (lower.includes(kw)) {
      selectCategory(cat);
      return;
    }
  }
}

// ─── Repeat last expense ───────────────────────────────────────────────────────

function repeatLast() {
  const last = state.lastTx;
  if (!last) { showToast('No previous expense', 'error'); return; }

  // Pre-fill UI
  currentAmount    = String(last.amount);
  selectedCategory = last.category;
  selectedType     = last.type;
  const noteEl     = document.getElementById('expense-note');
  if (noteEl) noteEl.value = last.note || '';

  updateAmountDisplay();
  renderTypeToggle();
  renderCategoryPills();
  updateBodyTypeClass();
  vibrate(10);
}

// ─── Mini status bar ───────────────────────────────────────────────────────────

function updateMiniStatus() {
  const bar = document.getElementById('mini-status');
  if (!bar) return;

  const m = getCurrentMonth();
  if (!m) { bar.textContent = 'Tap to set up your budget'; return; }

  const curr    = state.settings.currency;
  const uid     = state.settings.currentUser;
  const pers    = m.personal[uid];
  const unf     = Math.max(0, m.unforeseen.allocated - m.unforeseen.spent);
  const jointR  = Math.max(0, m.joint.remaining);
  const persR   = pers ? Math.max(0, pers.remaining) : null;

  bar.innerHTML = `
    <span class="s-joint">Joint: ${curr}${fmt(jointR)}</span>
    <span class="s-personal">Mine: ${pers ? curr + fmt(persR) : '—'}</span>
    <span class="s-unforeseen">Extra: ${curr}${fmt(unf)}</span>
  `;
}

// ─── Status Screen ────────────────────────────────────────────────────────────

function renderStatusScreen() {
  const container = document.getElementById('status-screen');
  const m = getCurrentMonth();
  const curr = state.settings.currency;

  if (!m) {
    container.innerHTML = `<div class="status-container"><p class="no-transactions" style="margin-top:40px">No budget set up yet.<br><br><button class="btn-primary" onclick="showSetupWizard()">Set Up This Month</button></p></div>`;
    return;
  }

  const uid   = state.settings.currentUser;
  const pers  = m.personal[uid];
  const jPct  = m.joint.total > 0 ? (m.joint.spent / m.joint.total * 100) : 0;
  const pPct  = pers?.total  > 0  ? (pers.spent  / pers.total  * 100) : 0;
  const uPct  = m.unforeseen.allocated > 0 ? (m.unforeseen.spent / m.unforeseen.allocated * 100) : 0;

  const catRows = m.joint.categories
    .filter(c => c.total > 0)
    .map(c => {
      const def  = CATEGORIES.find(d => d.name === c.name) || { icon: '📝' };
      const pct  = c.total > 0 ? Math.min(100, c.spent / c.total * 100) : 0;
      return `<div class="cat-row">
        <span class="cat-name">${def.icon} ${c.name}</span>
        <div class="mini-progress"><div class="mini-fill" style="width:${pct}%"></div></div>
        <span class="cat-remaining">${curr}${fmt(Math.max(0, c.remaining))}</span>
      </div>`;
    }).join('');

  const recent5 = [...m.transactions].reverse().slice(0, 5);

  container.innerHTML = `
    <div class="status-container">
      <h2 class="status-title">${currentMonthLabel()}</h2>

      <div class="budget-card">
        <div class="budget-card-header">
          <span class="budget-label">Joint Budget</span>
          <span class="budget-remaining">${curr}${fmt(Math.max(0, m.joint.remaining))}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill joint ${jPct >= 90 ? 'danger' : ''}" style="width:${Math.min(100, jPct)}%"></div>
        </div>
        <div class="budget-details">
          <span>Spent: ${curr}${fmt(m.joint.spent)}</span>
          <span>Total: ${curr}${fmt(m.joint.total)}</span>
        </div>
        ${catRows ? `<div class="category-breakdown">${catRows}</div>` : ''}
      </div>

      <div class="budget-card">
        <div class="budget-card-header">
          <span class="budget-label">My Budget (${userName(uid)})</span>
          <span class="budget-remaining">${pers ? curr + fmt(Math.max(0, pers.remaining)) : '—'}</span>
        </div>
        ${pers?.total > 0 ? `
          <div class="progress-bar">
            <div class="progress-fill personal ${pPct >= 90 ? 'danger' : ''}" style="width:${Math.min(100, pPct)}%"></div>
          </div>
          <div class="budget-details">
            <span>Spent: ${curr}${fmt(pers.spent)}</span>
            <span>Total: ${curr}${fmt(pers.total)}</span>
          </div>
        ` : '<p class="no-budget">No personal budget set</p>'}
      </div>

      <div class="budget-card">
        <div class="budget-card-header">
          <span class="budget-label">Unforeseen Fund</span>
          <span class="budget-remaining">${curr}${fmt(Math.max(0, m.unforeseen.allocated - m.unforeseen.spent))}</span>
        </div>
        ${m.unforeseen.allocated > 0 ? `
          <div class="progress-bar">
            <div class="progress-fill unforeseen ${uPct >= 90 ? 'danger' : ''}" style="width:${Math.min(100, uPct)}%"></div>
          </div>
          <div class="budget-details">
            <span>Spent: ${curr}${fmt(m.unforeseen.spent)}</span>
            <span>Allocated: ${curr}${fmt(m.unforeseen.allocated)}</span>
          </div>
        ` : '<p class="no-budget">No unforeseen fund set</p>'}
      </div>

      <h3 class="section-title">Recent</h3>
      <div class="budget-card" style="padding:8px 16px">
        ${recent5.length ? recent5.map(txCard).join('') : '<p class="no-transactions">No expenses yet</p>'}
      </div>
    </div>
  `;
}

// ─── History Screen ───────────────────────────────────────────────────────────

function renderHistoryScreen() {
  const container = document.getElementById('history-screen');
  container.innerHTML = `
    <div class="history-header">
      <h2>History</h2>
      <input type="search" class="search-input" id="history-search"
        placeholder="Search expenses..." autocomplete="off"
        aria-label="Search transactions">
    </div>
    <div id="history-list" style="padding:0 16px 24px"></div>
  `;

  const m = getCurrentMonth();
  renderHistoryList(m ? [...m.transactions].reverse() : []);

  document.getElementById('history-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const m = getCurrentMonth();
    if (!m) return;
    const filtered = q
      ? [...m.transactions].reverse().filter(t =>
          t.category.toLowerCase().includes(q) ||
          (t.note || '').toLowerCase().includes(q) ||
          t.amount.toFixed(2).includes(q))
      : [...m.transactions].reverse();
    renderHistoryList(filtered);
  });
}

function renderHistoryList(txs) {
  const list = document.getElementById('history-list');
  if (!list) return;

  if (!txs.length) {
    list.innerHTML = '<p class="no-transactions">No expenses found</p>';
    return;
  }

  // Group by date
  const groups = {};
  txs.forEach(t => {
    const d = new Date(t.date).toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!groups[d]) groups[d] = [];
    groups[d].push(t);
  });

  list.innerHTML = Object.entries(groups).map(([date, items]) => `
    <div class="history-group">
      <div class="history-date">${date}</div>
      ${items.map(t => `
        <div class="transaction-item" data-id="${t.id}" role="button" tabindex="0">
          <div class="tx-icon ${t.type}">${CATEGORIES.find(c => c.name === t.category)?.icon || '📝'}</div>
          <div class="tx-details">
            <span class="tx-category">${t.category}</span>
            ${t.note ? `<span class="tx-note">${escHtml(t.note)}</span>` : ''}
          </div>
          <div class="tx-right">
            <span class="tx-amount">${state.settings.currency}${t.amount.toFixed(2)}</span>
            <span class="tx-badge ${t.type}">${t.type}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');

  list.querySelectorAll('.transaction-item').forEach(el => {
    el.addEventListener('click', () => showTxDetail(Number(el.dataset.id)));
  });
}

// ─── Transaction detail modal ─────────────────────────────────────────────────

function showTxDetail(id) {
  const m = getCurrentMonth();
  if (!m) return;
  const tx = m.transactions.find(t => t.id === id);
  if (!tx) return;

  const curr = state.settings.currency;
  const icon = CATEGORIES.find(c => c.name === tx.category)?.icon || '📝';
  const date = new Date(tx.date).toLocaleString('default', { dateStyle: 'medium', timeStyle: 'short' });

  showModal(`
    <div class="modal-handle"></div>
    <div class="detail-modal">
      <h3>${icon} ${tx.category}</h3>
      <div class="detail-row">
        <span class="detail-label">Amount</span>
        <strong>${curr}${tx.amount.toFixed(2)}</strong>
      </div>
      <div class="detail-row">
        <span class="detail-label">Type</span>
        <span class="tx-badge ${tx.type}">${tx.type}</span>
      </div>
      ${tx.note ? `<div class="detail-row"><span class="detail-label">Note</span><span>${escHtml(tx.note)}</span></div>` : ''}
      <div class="detail-row">
        <span class="detail-label">Date</span>
        <span>${date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">By</span>
        <span>${userName(tx.userId)}</span>
      </div>
      <button class="btn-danger" onclick="deleteTx(${tx.id})">Delete Expense</button>
    </div>
  `);
}

function deleteTx(id) {
  const monthKey = currentMonthKey();
  const m = state.months[monthKey];
  if (!m) return;

  const tx = m.transactions.find(t => t.id === id);
  if (!tx) return;

  applyTransaction(tx, monthKey, -1);
  m.transactions = m.transactions.filter(t => t.id !== id);
  if (state.lastTx?.id === id) state.lastTx = null;
  saveState();

  closeModal();
  renderHistoryScreen();
  updateMiniStatus();
  showToast('Expense deleted', 'success');
}

// ─── Profile Screen ───────────────────────────────────────────────────────────

function renderProfileScreen() {
  const container = document.getElementById('profile-screen');
  const curr = state.settings.currency;

  const archiveRows = Object.keys(state.months).sort().reverse().map(key => {
    const m = state.months[key];
    return `<div class="archive-row">
      <span>${monthLabel(key)}</span>
      <span class="archive-amount">${curr}${fmt(m.joint.spent)} / ${curr}${fmt(m.joint.total)}</span>
    </div>`;
  }).join('') || '<p class="no-transactions" style="padding:12px 0">No previous months</p>';

  container.innerHTML = `
    <div class="profile-container">
      <h2>Profile &amp; Settings</h2>

      <div class="profile-section">
        <h3>Who Am I?</h3>
        <div class="user-selector">
          ${state.settings.users.map(u => `
            <button class="user-btn ${u.id === state.settings.currentUser ? 'active' : ''}"
              onclick="switchUser('${u.id}')">${u.name}</button>
          `).join('')}
        </div>
      </div>

      <div class="profile-section">
        <h3>Partner Names</h3>
        ${state.settings.users.map(u => `
          <div class="partner-row">
            <input type="text" class="partner-name-input" value="${escHtml(u.name)}"
              data-uid="${u.id}" placeholder="Name..."
              onblur="updateName(this)" autocomplete="off">
          </div>
        `).join('')}
      </div>

      <div class="profile-section">
        <h3>Currency</h3>
        <select class="currency-select" onchange="updateCurrency(this.value)">
          ${['€','$','£','¥','CHF','kr','₹','R$','zł'].map(c =>
            `<option value="${c}" ${c === curr ? 'selected' : ''}>${c}</option>`
          ).join('')}
        </select>
      </div>

      <div class="profile-section">
        <h3>Month</h3>
        <div class="profile-actions">
          <button class="btn-secondary" onclick="showSetupWizard()">Set Up New Month</button>
          <button class="btn-secondary" onclick="exportData()">Export Data (JSON)</button>
          <button class="btn-danger-outline" onclick="confirmClear()">Clear All Data</button>
        </div>
      </div>

      <div class="profile-section">
        <h3>Archives</h3>
        ${archiveRows}
      </div>
    </div>
  `;
}

function switchUser(uid) {
  state.settings.currentUser = uid;
  saveState();
  renderProfileScreen();
  updateMiniStatus();
}

function updateName(input) {
  const uid  = input.dataset.uid;
  const user = state.settings.users.find(u => u.id === uid);
  if (user && input.value.trim()) {
    user.name = input.value.trim();
    saveState();
  }
}

function updateCurrency(curr) {
  state.settings.currency = curr;
  document.getElementById('currency-symbol').textContent = curr;
  saveState();
  updateMiniStatus();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `couplebudget_${currentMonthKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function confirmClear() {
  showModal(`
    <div class="modal-handle"></div>
    <div class="detail-modal">
      <h3>⚠️ Clear All Data?</h3>
      <p style="color:var(--lilac-ash);margin-bottom:20px;line-height:1.5">
        This will permanently delete all your budget data and cannot be undone.
      </p>
      <button class="btn-danger" onclick="clearAllData()">Yes, delete everything</button>
      <button class="btn-ghost" style="width:100%;margin-top:10px" onclick="closeModal()">Cancel</button>
    </div>
  `);
}

function clearAllData() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

// ─── Setup Wizard ─────────────────────────────────────────────────────────────

let wiz = {
  step:          1,
  jointTotal:    0,
  useCategories: false,
  categories:    {},
  personal:      {},
  unforeseen:    0,
};

function showSetupWizard() {
  // Reset wizard data
  wiz = { step: 1, jointTotal: 0, useCategories: false, categories: {}, personal: {}, unforeseen: 0 };
  // Hide bottom nav during setup
  document.getElementById('bottom-nav').style.display = 'none';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('setup-wizard').classList.add('active');
  renderWizardStep();
}

function renderWizardStep() {
  // Progress dots
  document.getElementById('setup-progress').innerHTML =
    [1,2,3,4,5].map(i =>
      `<div class="progress-dot ${i <= wiz.step ? 'active' : ''}"></div>`
    ).join('');

  const hasPrev = Object.keys(state.months).length > 0;
  const curr    = state.settings.currency;

  const stepHTML = {
    1: () => `
      <h2>Monthly Budget</h2>
      <p class="setup-subtitle">${currentMonthLabel()}</p>
      ${hasPrev ? `<button class="btn-secondary" onclick="usePrevMonth()">↻ Use same as last month</button>` : ''}
      <div class="setup-field">
        <label>Joint Budget Total</label>
        <div class="setup-amount-input">
          <span class="currency">${curr}</span>
          <input type="number" id="s-joint" placeholder="0.00" inputmode="decimal"
            value="${wiz.jointTotal || ''}" autofocus min="0">
        </div>
      </div>
      <button class="btn-primary" onclick="wizNext()">Continue →</button>
    `,
    2: () => `
      <h2>Category Allocation</h2>
      <p class="setup-subtitle">Optionally divide your joint budget by category</p>
      <div class="setup-toggle-row">
        <span>Allocate by category?</span>
        <label class="toggle-switch">
          <input type="checkbox" id="s-use-cat" ${wiz.useCategories ? 'checked' : ''}
            onchange="toggleCatAlloc(this.checked)">
          <span class="slider"></span>
        </label>
      </div>
      <div id="cat-alloc-wrap" class="category-alloc-wrap" style="display:${wiz.useCategories ? 'flex' : 'none'};flex-direction:column;gap:4px">
        ${CATEGORIES.map(cat => `
          <div class="category-alloc-row">
            <span>${cat.icon} ${cat.name}</span>
            <div class="setup-amount-input sm">
              <span class="currency">${curr}</span>
              <input type="number" class="cat-budget" data-cat="${cat.name}"
                placeholder="0" inputmode="decimal" min="0"
                value="${wiz.categories[cat.name] || ''}">
            </div>
          </div>
        `).join('')}
      </div>
      <div class="setup-nav">
        <button class="btn-ghost" onclick="wizBack()">← Back</button>
        <button class="btn-primary" onclick="wizNext()">Continue →</button>
      </div>
    `,
    3: () => `
      <h2>Personal Budgets</h2>
      <p class="setup-subtitle">Each partner's individual spending</p>
      ${state.settings.users.map(u => `
        <div class="setup-field">
          <label>${escHtml(u.name)}'s Budget</label>
          <div class="setup-amount-input">
            <span class="currency">${curr}</span>
            <input type="number" class="pers-budget" data-uid="${u.id}"
              placeholder="0.00" inputmode="decimal" min="0"
              value="${wiz.personal[u.id] || ''}">
          </div>
        </div>
      `).join('')}
      <div class="setup-nav">
        <button class="btn-ghost" onclick="wizBack()">← Back</button>
        <button class="btn-primary" onclick="wizNext()">Continue →</button>
      </div>
    `,
    4: () => {
      const suggested = Math.round(wiz.jointTotal * 0.1);
      return `
        <h2>Unforeseen Fund</h2>
        <p class="setup-subtitle">Buffer for unexpected expenses outside your budget</p>
        <div class="setup-field">
          <label>Unforeseen Allocation</label>
          <div class="setup-amount-input">
            <span class="currency">${curr}</span>
            <input type="number" id="s-unf" placeholder="0.00" inputmode="decimal" min="0"
              value="${wiz.unforeseen || suggested}">
          </div>
          <span class="setup-hint">Suggested 10% of joint = ${curr}${fmt(suggested)}</span>
        </div>
        <div class="setup-nav">
          <button class="btn-ghost" onclick="wizBack()">← Back</button>
          <button class="btn-primary" onclick="wizNext()">Continue →</button>
        </div>
      `;
    },
    5: () => `
      <h2>Confirm Budget</h2>
      <p class="setup-subtitle">Ready to start tracking ${currentMonthLabel()}!</p>
      <div class="setup-summary">
        <div class="summary-row joint">
          <span>Joint Budget</span>
          <strong>${curr}${fmt(wiz.jointTotal)}</strong>
        </div>
        ${wiz.useCategories
          ? CATEGORIES.filter(c => wiz.categories[c.name] > 0).map(c => `
              <div class="summary-row indent">
                <span>${c.icon} ${c.name}</span>
                <span>${curr}${fmt(wiz.categories[c.name] || 0)}</span>
              </div>`).join('')
          : ''}
        ${state.settings.users.map(u => `
          <div class="summary-row personal">
            <span>${escHtml(u.name)}'s Budget</span>
            <strong>${curr}${fmt(wiz.personal[u.id] || 0)}</strong>
          </div>`).join('')}
        <div class="summary-row unforeseen">
          <span>Unforeseen Fund</span>
          <strong>${curr}${fmt(wiz.unforeseen)}</strong>
        </div>
      </div>
      <div class="setup-nav">
        <button class="btn-ghost" onclick="wizBack()">← Edit</button>
        <button class="btn-primary" onclick="saveSetup()">Start Tracking →</button>
      </div>
    `,
  };

  document.getElementById('setup-step-content').innerHTML = stepHTML[wiz.step]?.() || '';

  // Auto-focus first input
  const firstInput = document.querySelector('#setup-step-content input');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

function wizNext() {
  // Collect current step data
  if (wiz.step === 1) {
    const v = parseFloat(document.getElementById('s-joint')?.value || '0');
    if (!v || v <= 0) { showToast('Please enter a valid amount', 'error'); return; }
    wiz.jointTotal = v;

  } else if (wiz.step === 2) {
    wiz.useCategories = document.getElementById('s-use-cat')?.checked || false;
    if (wiz.useCategories) {
      document.querySelectorAll('.cat-budget').forEach(inp => {
        const v = parseFloat(inp.value || '0');
        if (v > 0) wiz.categories[inp.dataset.cat] = v;
      });
    }

  } else if (wiz.step === 3) {
    document.querySelectorAll('.pers-budget').forEach(inp => {
      const v = parseFloat(inp.value || '0');
      wiz.personal[inp.dataset.uid] = v > 0 ? v : 0;
    });

  } else if (wiz.step === 4) {
    wiz.unforeseen = parseFloat(document.getElementById('s-unf')?.value || '0');
  }

  if (wiz.step < 5) { wiz.step++; renderWizardStep(); }
}

function wizBack() {
  if (wiz.step > 1) { wiz.step--; renderWizardStep(); }
}

function toggleCatAlloc(checked) {
  wiz.useCategories = checked;
  const wrap = document.getElementById('cat-alloc-wrap');
  if (wrap) wrap.style.display = checked ? 'flex' : 'none';
}

function usePrevMonth() {
  const keys = Object.keys(state.months).sort();
  if (!keys.length) return;
  const prev = state.months[keys[keys.length - 1]];
  wiz.jointTotal    = prev.joint.total;
  wiz.useCategories = prev.joint.categories.some(c => c.total > 0);
  wiz.categories    = {};
  prev.joint.categories.forEach(c => { if (c.total > 0) wiz.categories[c.name] = c.total; });
  state.settings.users.forEach(u => {
    wiz.personal[u.id] = prev.personal[u.id]?.total || 0;
  });
  wiz.unforeseen = prev.unforeseen.allocated;
  wiz.step = 5;
  renderWizardStep();
}

function saveSetup() {
  const monthKey  = currentMonthKey();
  const categories = CATEGORIES.map(c => ({
    name:      c.name,
    total:     wiz.useCategories ? (wiz.categories[c.name] || 0) : 0,
    spent:     0,
    remaining: wiz.useCategories ? (wiz.categories[c.name] || 0) : 0,
  }));

  const personal = {};
  state.settings.users.forEach(u => {
    const t = wiz.personal[u.id] || 0;
    personal[u.id] = { total: t, spent: 0, remaining: t };
  });

  state.months[monthKey] = {
    joint: {
      total:      wiz.jointTotal,
      spent:      0,
      remaining:  wiz.jointTotal,
      categories,
    },
    personal,
    unforeseen: {
      allocated: wiz.unforeseen,
      spent:     0,
      ious:      [],
    },
    transactions: [],
  };

  saveState();

  // Restore bottom nav and go to expense entry
  document.getElementById('bottom-nav').style.display = 'flex';
  currentAmount = '';
  showScreen('expense-entry');
  showToast(`Budget set for ${currentMonthLabel()} 🎉`, 'success');
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function showModal(html) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `<div class="modal-content">${html}</div>`;
  overlay.classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n)         { return (n || 0).toFixed(2); }
function vibrate(pat)   { if (navigator.vibrate) navigator.vibrate(pat); }
function escHtml(str)   { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function userName(uid)  { return state.settings.users.find(u => u.id === uid)?.name || uid; }

function txCard(tx) {
  const icon = CATEGORIES.find(c => c.name === tx.category)?.icon || '📝';
  const curr = state.settings.currency;
  return `
    <div class="transaction-item" onclick="showTxDetail(${tx.id})">
      <div class="tx-icon ${tx.type}">${icon}</div>
      <div class="tx-details">
        <span class="tx-category">${tx.category}</span>
        ${tx.note ? `<span class="tx-note">${escHtml(tx.note)}</span>` : ''}
      </div>
      <div class="tx-right">
        <span class="tx-amount">${curr}${tx.amount.toFixed(2)}</span>
        <span class="tx-badge ${tx.type}">${tx.type}</span>
      </div>
    </div>`;
}

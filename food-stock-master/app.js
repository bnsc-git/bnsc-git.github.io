/* ====================================================
   Food Stock Master — app.js
==================================================== */

// ---- State ----
let STATE = {
  inventory: [],
  shoppingList: [],
  customRecipes: [],
  consumptionHistory: []
};

let nutritionChart = null;
let ingRowCounter = 0;

// ---- LocalStorage ----
function loadState() {
  STATE.inventory         = JSON.parse(localStorage.getItem('fsm_inventory') || '[]');
  STATE.shoppingList      = JSON.parse(localStorage.getItem('fsm_shopping')  || '[]');
  STATE.customRecipes     = JSON.parse(localStorage.getItem('fsm_recipes')   || '[]');
  STATE.consumptionHistory= JSON.parse(localStorage.getItem('fsm_history')   || '[]');
}

function persist() {
  autoCleanup();
  localStorage.setItem('fsm_inventory', JSON.stringify(STATE.inventory));
  localStorage.setItem('fsm_shopping',  JSON.stringify(STATE.shoppingList));
  localStorage.setItem('fsm_recipes',   JSON.stringify(STATE.customRecipes));
  localStorage.setItem('fsm_history',   JSON.stringify(STATE.consumptionHistory));
}

// Remove zero-quantity duplicates (keep latest 1 per name)
function autoCleanup() {
  const grouped = {};
  STATE.inventory.forEach(item => {
    if (!grouped[item.name]) grouped[item.name] = [];
    grouped[item.name].push(item);
  });

  const result = [];
  Object.values(grouped).forEach(items => {
    const nonZero = items.filter(i => i.quantity > 0);
    if (nonZero.length > 0) {
      result.push(...nonZero);
    } else {
      // Keep only the most recently registered record
      const latest = [...items].sort(
        (a, b) => new Date(b.registered_at) - new Date(a.registered_at)
      )[0];
      result.push({ ...latest, quantity: 0 });
    }
  });

  STATE.inventory = result;
}

// ---- Utilities ----
function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function daysLeft(expiryDateStr) {
  const now = new Date(); now.setHours(0,0,0,0);
  const exp = new Date(expiryDateStr + 'T00:00:00');
  return Math.floor((exp - now) / 86400000);
}

function expiryStatus(expiryDateStr) {
  const d = daysLeft(expiryDateStr);
  if (d < 0)  return 'expired';
  if (d <= 3) return 'soon';
  return 'fresh';
}

function daysLabel(expiryDateStr) {
  const d = daysLeft(expiryDateStr);
  if (d < 0)  return `${Math.abs(d)}日超過`;
  if (d === 0) return '今日まで';
  return `あと${d}日`;
}

function getInventoryNames() {
  return [...new Set([
    ...STATE.inventory.map(i => i.name),
    ...STATE.shoppingList.map(i => i.name)
  ])];
}

function refreshNameDatalist() {
  const dl = document.getElementById('all-item-names');
  if (!dl) return;
  dl.innerHTML = getInventoryNames().map(n => `<option value="${escHtml(n)}">`).join('');
}

// ---- Tab Switching ----
function switchTab(tabName) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tabName}"]`).classList.add('active');
  renderTab(tabName);
}

function renderTab(name) {
  switch (name) {
    case 'dashboard': renderDashboard(); break;
    case 'inventory': renderInventory(); break;
    case 'shopping':  renderShoppingList(); break;
    case 'recipes':   renderRecipes(); break;
  }
}

// ====================================================
// DASHBOARD
// ====================================================
function renderDashboard() {
  renderAlerts();
  renderStats();
  renderNutritionChart();
  renderRecipeSuggestion();
}

function renderAlerts() {
  const el = document.getElementById('alert-list');
  const items = STATE.inventory
    .filter(i => i.quantity > 0 && expiryStatus(i.expiryDate) !== 'fresh')
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  if (!items.length) {
    el.innerHTML = `<div class="alert-item ok">
      <span class="alert-name">✅ 期限切れ・期限間近の食材はありません</span>
    </div>`;
    return;
  }

  el.innerHTML = items.map(item => {
    const st = expiryStatus(item.expiryDate);
    return `<div class="alert-item ${st}">
      <span class="alert-name">${escHtml(item.name)}</span>
      <span class="alert-expiry">${item.expiryDate}</span>
      <span class="alert-badge ${st}">${daysLabel(item.expiryDate)}</span>
    </div>`;
  }).join('');
}

function renderStats() {
  const active   = STATE.inventory.filter(i => i.quantity > 0);
  const expired  = active.filter(i => expiryStatus(i.expiryDate) === 'expired');
  const soon     = active.filter(i => expiryStatus(i.expiryDate) === 'soon');
  document.getElementById('total-items').textContent   = active.length;
  document.getElementById('expiring-soon').textContent = soon.length;
  document.getElementById('expired-count').textContent = expired.length;
}

function renderNutritionChart() {
  const chartNote = document.getElementById('chart-note');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 3);
  cutoff.setHours(0,0,0,0);

  const recent = STATE.consumptionHistory.filter(h => new Date(h.date) >= cutoff);
  const canvas = document.getElementById('nutrition-chart');

  if (!recent.length) {
    chartNote.style.display = 'block';
    if (nutritionChart) { nutritionChart.destroy(); nutritionChart = null; }
    canvas.style.display = 'none';
    return;
  }

  chartNote.style.display = 'none';
  canvas.style.display = 'block';

  const totals = { protein:0, fat:0, carbs:0, vitamins:0, minerals:0 };
  recent.forEach(h => {
    if (!h.nutrients) return;
    Object.keys(totals).forEach(k => { totals[k] += (h.nutrients[k] || 0); });
  });

  const data = [totals.protein, totals.fat, totals.carbs, totals.vitamins, totals.minerals];

  if (nutritionChart) nutritionChart.destroy();
  nutritionChart = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: {
      labels: ['タンパク質', '脂質', '炭水化物', 'ビタミン', 'ミネラル'],
      datasets: [{
        data,
        backgroundColor: 'rgba(22,163,74,.18)',
        borderColor: '#16a34a',
        borderWidth: 2,
        pointBackgroundColor: '#16a34a',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          suggestedMax: Math.max(...data, 5),
          ticks: { display: false },
          grid: { color: 'rgba(0,0,0,.08)' },
          pointLabels: { font: { size: 11 } }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderRecipeSuggestion() {
  const el = document.getElementById('recipe-suggestion');
  const items = getNearExpiryItems(3);
  if (!items.length) {
    el.innerHTML = '<span class="suggest-chip-none">期限間近の食材はありません</span>';
  } else {
    el.innerHTML = items.map(i =>
      `<span class="suggest-chip">⚠️ ${escHtml(i.name)}</span>`
    ).join('');
  }
}

function getNearExpiryItems(max) {
  return STATE.inventory
    .filter(i => i.quantity > 0 && expiryStatus(i.expiryDate) !== 'fresh')
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
    .slice(0, max);
}

function openGoogleRecipe() {
  const items = getNearExpiryItems(3);
  const q = items.length
    ? items.map(i => i.name).join('と') + 'を使ったレシピ'
    : '簡単 時短レシピ';
  window.open(`https://www.google.com/search?udm=5&q=${encodeURIComponent(q)}`, '_blank');
}

// ====================================================
// INVENTORY
// ====================================================
function renderInventory() {
  refreshNameDatalist();
  const el = document.getElementById('inventory-list');
  const q = (document.getElementById('inventory-search')?.value || '').toLowerCase();

  const items = STATE.inventory
    .filter(i => i.quantity > 0)
    .filter(i => !q || i.name.toLowerCase().includes(q))
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  if (!items.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🥗</div>
      <div class="empty-text">${q ? '見つかりません' : '食材を追加してください'}</div>
    </div>`;
    return;
  }

  el.innerHTML = items.map(item => {
    const st = expiryStatus(item.expiryDate);
    return `<div class="inventory-item ${st}">
      <div class="item-info">
        <div class="item-name">${escHtml(item.name)}
          <span class="item-expiry-badge ${st}">${daysLabel(item.expiryDate)}</span>
        </div>
        <div class="item-meta">期限: ${item.expiryDate}</div>
      </div>
      <div class="item-qty-wrap">
        <button class="qty-btn" onclick="adjustQty('${item.id}',-1)">−</button>
        <input class="qty-input" type="number" value="${item.quantity}" min="0" step="0.1"
          onchange="updateQty('${item.id}',this.value)" onclick="this.select()">
        <span class="qty-unit">${escHtml(item.unit)}</span>
        <button class="qty-btn" onclick="adjustQty('${item.id}',1)">＋</button>
      </div>
      <button class="icon-btn" onclick="deleteInventoryItem('${item.id}')" title="削除">🗑️</button>
    </div>`;
  }).join('');
}

function adjustQty(id, delta) {
  const item = STATE.inventory.find(i => i.id === id);
  if (!item) return;
  item.quantity = Math.max(0, +(item.quantity + delta).toFixed(3));
  persist();
  renderInventory();
  renderStats();
}

function updateQty(id, val) {
  const item = STATE.inventory.find(i => i.id === id);
  if (!item) return;
  item.quantity = Math.max(0, parseFloat(val) || 0);
  persist();
  renderInventory();
  renderStats();
}

function deleteInventoryItem(id) {
  if (!confirm('この食材を削除しますか？')) return;
  STATE.inventory = STATE.inventory.filter(i => i.id !== id);
  persist();
  renderInventory();
  renderStats();
  renderAlerts();
}

function openAddInventoryModal() {
  refreshNameDatalist();
  const defaultExpiry = new Date();
  defaultExpiry.setDate(defaultExpiry.getDate() + 7);
  const defExp = defaultExpiry.toISOString().split('T')[0];

  showModal('食材を追加', `
    <div class="form-group">
      <label class="form-label">食材名 *</label>
      <input id="inv-name" class="form-input" type="text" placeholder="例: 牛乳" list="all-item-names"
        oninput="autoFillInventoryHistory(this.value)">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">数量 *</label>
        <input id="inv-qty" class="form-input" type="number" value="1" min="0" step="0.1">
      </div>
      <div class="form-group">
        <label class="form-label">単位</label>
        <input id="inv-unit" class="form-input" type="text" placeholder="個/g/ml" list="unit-list">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">賞味期限 *</label>
      <input id="inv-expiry" class="form-input" type="date" value="${defExp}" min="${todayStr()}">
    </div>
    <div class="form-group">
      <label class="form-label">栄養素（0〜5 の目安）</label>
      <div class="nutrients-grid">
        ${['protein:タンパク質','fat:脂質','carbs:炭水化物','vitamins:ビタミン','minerals:ミネラル'].map(s => {
          const [key, label] = s.split(':');
          return `<div class="nutrient-cell">
            <div class="nutrient-label">${label}</div>
            <input class="nutrient-input" id="nut-${key}" type="number" value="0" min="0" max="5" step="0.5">
          </div>`;
        }).join('')}
      </div>
    </div>
    <button class="btn btn-primary btn-full" onclick="addInventoryItem()">追加する</button>
  `);
}

function autoFillInventoryHistory(name) {
  const matches = STATE.inventory.filter(i => i.name === name);
  if (!matches.length) return;
  const latest = matches.sort((a,b) => new Date(b.registered_at)-new Date(a.registered_at))[0];
  if (latest.unit) document.getElementById('inv-unit').value = latest.unit;

  // Infer expiry from average shelf life
  const withDates = matches.filter(i => i.registered_at && i.expiryDate);
  if (withDates.length) {
    const avg = withDates.reduce((s,i) =>
      s + (new Date(i.expiryDate) - new Date(i.registered_at)) / 86400000, 0
    ) / withDates.length;
    const suggested = new Date();
    suggested.setDate(suggested.getDate() + Math.max(1, Math.round(avg)));
    document.getElementById('inv-expiry').value = suggested.toISOString().split('T')[0];
  }
  // Pre-fill nutrients from last entry
  if (latest.nutrients) {
    ['protein','fat','carbs','vitamins','minerals'].forEach(k => {
      const el = document.getElementById(`nut-${k}`);
      if (el) el.value = latest.nutrients[k] || 0;
    });
  }
}

function addInventoryItem() {
  const name   = document.getElementById('inv-name').value.trim();
  const qty    = parseFloat(document.getElementById('inv-qty').value) || 0;
  const unit   = document.getElementById('inv-unit').value.trim();
  const expiry = document.getElementById('inv-expiry').value;
  if (!name || !expiry) { alert('食材名と賞味期限は必須です'); return; }

  const nutrients = {};
  ['protein','fat','carbs','vitamins','minerals'].forEach(k => {
    nutrients[k] = parseFloat(document.getElementById(`nut-${k}`).value) || 0;
  });

  STATE.inventory.push({ id: uid(), name, quantity: qty, unit, expiryDate: expiry,
    registered_at: todayStr(), nutrients });
  persist();
  closeModal();
  renderInventory();
  renderAlerts();
  renderStats();
  refreshNameDatalist();
}

// ====================================================
// SHOPPING LIST
// ====================================================
function renderShoppingList() {
  refreshNameDatalist();
  const el = document.getElementById('shopping-list');
  if (!STATE.shoppingList.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🛒</div>
      <div class="empty-text">買い物リストは空です</div>
    </div>`;
    updateShoppingBadge();
    return;
  }

  el.innerHTML = STATE.shoppingList.map(item => `
    <div class="shopping-item ${item.checked ? 'checked' : ''}">
      <input type="checkbox" ${item.checked ? 'checked' : ''}
        onchange="toggleShopping('${item.id}', this.checked)">
      <span class="shopping-name">${escHtml(item.name)}</span>
      <span class="shopping-meta">${item.quantity} ${escHtml(item.unit)}</span>
      <button class="icon-btn" onclick="deleteShopping('${item.id}')">🗑️</button>
    </div>
  `).join('');
  updateShoppingBadge();
}

function toggleShopping(id, checked) {
  const item = STATE.shoppingList.find(i => i.id === id);
  if (item) { item.checked = checked; persist(); }
}

function deleteShopping(id) {
  STATE.shoppingList = STATE.shoppingList.filter(i => i.id !== id);
  persist();
  renderShoppingList();
}

function updateShoppingBadge() {
  const badge = document.getElementById('shopping-badge');
  const n = STATE.shoppingList.length;
  badge.style.display = n ? 'flex' : 'none';
  badge.textContent = n;
}

function openAddShoppingModal() {
  refreshNameDatalist();
  showModal('買い物リストに追加', `
    <div class="form-group">
      <label class="form-label">食材名 *</label>
      <input id="sh-name" class="form-input" type="text" placeholder="例: 卵" list="all-item-names"
        oninput="autoFillShoppingHistory(this.value)">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">数量</label>
        <input id="sh-qty" class="form-input" type="number" value="1" min="0" step="0.1">
      </div>
      <div class="form-group">
        <label class="form-label">単位</label>
        <input id="sh-unit" class="form-input" type="text" placeholder="個/g/ml" list="unit-list">
      </div>
    </div>
    <button class="btn btn-primary btn-full" onclick="addShoppingItem()">追加する</button>
  `);
}

function autoFillShoppingHistory(name) {
  const matches = STATE.inventory.filter(i => i.name === name);
  if (!matches.length) return;
  const latest = matches.sort((a,b) => new Date(b.registered_at)-new Date(a.registered_at))[0];
  if (latest.unit)     document.getElementById('sh-unit').value = latest.unit;
  if (latest.quantity) document.getElementById('sh-qty').value  = latest.quantity;
}

function addShoppingItem() {
  const name = document.getElementById('sh-name').value.trim();
  const qty  = parseFloat(document.getElementById('sh-qty').value) || 1;
  const unit = document.getElementById('sh-unit').value.trim();
  if (!name) { alert('食材名を入力してください'); return; }

  STATE.shoppingList.push({ id: uid(), name, quantity: qty, unit, checked: false });
  persist();
  closeModal();
  renderShoppingList();
  refreshNameDatalist();
}

function openCheckoutModal() {
  if (!STATE.shoppingList.length) { alert('買い物リストが空です'); return; }

  const rows = STATE.shoppingList.map(item => {
    const suggested = inferExpiryDate(item.name);
    return `<div class="checkout-row">
      <span class="checkout-name">${escHtml(item.name)}</span>
      <span class="checkout-qty">${item.quantity}${escHtml(item.unit)}</span>
      <div class="checkout-date">
        <input type="date" id="co-${item.id}" value="${suggested}" min="${todayStr()}">
      </div>
    </div>`;
  }).join('');

  showModal('在庫へ入庫', `
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">
      賞味期限を確認して一括で在庫へ追加します
    </p>
    ${rows}
    <div style="margin-top:14px">
      <button class="btn btn-primary btn-full" onclick="checkoutAll()">✅ 全て在庫へ追加</button>
    </div>
  `);
}

function inferExpiryDate(name) {
  const matches = STATE.inventory.filter(i => i.name === name && i.registered_at && i.expiryDate);
  const days = matches.length
    ? matches.reduce((s,i) =>
        s + (new Date(i.expiryDate) - new Date(i.registered_at)) / 86400000, 0
      ) / matches.length
    : 7;
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, Math.round(days)));
  return d.toISOString().split('T')[0];
}

function checkoutAll() {
  STATE.shoppingList.forEach(item => {
    const input    = document.getElementById(`co-${item.id}`);
    const expiry   = input ? input.value : inferExpiryDate(item.name);
    const prevItem = STATE.inventory.find(i => i.name === item.name);
    const nutrients = prevItem?.nutrients || { protein:0, fat:0, carbs:0, vitamins:0, minerals:0 };

    STATE.inventory.push({
      id: uid(), name: item.name, quantity: item.quantity,
      unit: item.unit, expiryDate: expiry,
      registered_at: todayStr(), nutrients
    });
  });

  STATE.shoppingList = [];
  persist();
  closeModal();
  renderShoppingList();
  renderStats();
  renderAlerts();
  refreshNameDatalist();
}

// ====================================================
// RECIPES
// ====================================================
function renderRecipes() {
  const el = document.getElementById('recipe-list');
  if (!STATE.customRecipes.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🍳</div>
      <div class="empty-text">レシピを追加してください</div>
    </div>`;
    return;
  }

  el.innerHTML = STATE.customRecipes.map(recipe => `
    <div class="recipe-card">
      <div class="recipe-name">${escHtml(recipe.name)}</div>
      ${recipe.description ? `<div class="recipe-desc">${escHtml(recipe.description)}</div>` : ''}
      <div class="ingredient-chips">
        ${recipe.ingredients.map(i =>
          `<span class="ingredient-chip">${escHtml(i.name)} ${i.quantity}${escHtml(i.unit)}</span>`
        ).join('')}
      </div>
      <div class="recipe-actions">
        <button class="btn btn-success btn-sm" onclick="cookRecipe('${recipe.id}')">🍽️ 作って消費</button>
        <button class="btn btn-secondary btn-sm" data-recipe="${escHtml(recipe.name)}"
          onclick="searchRecipe(this)">
          🔍 検索
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteRecipe('${recipe.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

function searchRecipe(btn) {
  const name = btn.dataset.recipe || '';
  window.open(`https://www.google.com/search?udm=5&q=${encodeURIComponent(name + '+レシピ')}`, '_blank');
}

function deleteRecipe(id) {
  if (!confirm('このレシピを削除しますか？')) return;
  STATE.customRecipes = STATE.customRecipes.filter(r => r.id !== id);
  persist();
  renderRecipes();
}

function cookRecipe(id) {
  const recipe = STATE.customRecipes.find(r => r.id === id);
  if (!recipe) return;

  // Check stock
  const missing = recipe.ingredients
    .map(ing => {
      const available = STATE.inventory
        .filter(i => i.name === ing.name && i.quantity > 0)
        .reduce((s, i) => s + i.quantity, 0);
      return available < ing.quantity
        ? `${ing.name}（必要: ${ing.quantity}${ing.unit}、在庫: ${available.toFixed(1)}${ing.unit}）`
        : null;
    })
    .filter(Boolean);

  if (missing.length && !confirm(`以下の食材が不足しています:\n${missing.join('\n')}\n\n続けますか？`)) return;

  const nutrientsConsumed = { protein:0, fat:0, carbs:0, vitamins:0, minerals:0 };

  recipe.ingredients.forEach(ing => {
    let remaining = ing.quantity;
    const stocks = STATE.inventory
      .filter(i => i.name === ing.name && i.quantity > 0)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)); // FIFO: oldest first

    stocks.forEach(stock => {
      if (remaining <= 0) return;
      const consume = Math.min(stock.quantity, remaining);
      if (stock.nutrients) {
        const ratio = stock.quantity > 0 ? consume / stock.quantity : 0;
        Object.keys(nutrientsConsumed).forEach(k => {
          nutrientsConsumed[k] += (stock.nutrients[k] || 0) * ratio;
        });
      }
      stock.quantity = +(stock.quantity - consume).toFixed(3);
      remaining = +(remaining - consume).toFixed(3);
    });
  });

  STATE.consumptionHistory.push({
    id: uid(), date: todayStr(), recipeName: recipe.name, nutrients: nutrientsConsumed
  });

  persist();
  renderRecipes();
  renderStats();
  renderAlerts();
  if (document.getElementById('tab-dashboard').classList.contains('active')) {
    renderNutritionChart();
  }
  alert(`「${recipe.name}」を作りました！`);
}

function openAddRecipeModal() {
  refreshNameDatalist();
  ingRowCounter = 0;
  showModal('レシピを追加', `
    <div class="form-group">
      <label class="form-label">レシピ名 *</label>
      <input id="rcp-name" class="form-input" type="text" placeholder="例: 肉じゃが">
    </div>
    <div class="form-group">
      <label class="form-label">説明（任意）</label>
      <textarea id="rcp-desc" class="form-input" rows="2" placeholder="作り方のメモ…"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">材料</label>
      <div id="ing-container">${buildIngRow()}</div>
      <button class="btn btn-secondary btn-sm" style="margin-top:6px" onclick="addIngRow()">
        ＋ 材料を追加
      </button>
    </div>
    <button class="btn btn-primary btn-full" onclick="saveRecipe()">保存する</button>
  `);
}

function buildIngRow() {
  const idx = ingRowCounter++;
  return `<div class="ing-row" id="ing-${idx}">
    <input type="text"   class="ing-name" placeholder="食材名" list="all-item-names">
    <input type="number" class="ing-qty"  placeholder="数量" value="1" min="0" step="0.1">
    <input type="text"   class="ing-unit" placeholder="単位" list="unit-list">
    <button class="ing-remove" onclick="removeIngRow(${idx})">✕</button>
  </div>`;
}

function addIngRow() {
  const c = document.getElementById('ing-container');
  if (!c) return;
  const div = document.createElement('div');
  div.innerHTML = buildIngRow();
  c.appendChild(div.firstElementChild);
}

function removeIngRow(idx) {
  const row = document.getElementById(`ing-${idx}`);
  if (row) row.remove();
}

function saveRecipe() {
  const name = document.getElementById('rcp-name').value.trim();
  const desc = document.getElementById('rcp-desc').value.trim();
  if (!name) { alert('レシピ名を入力してください'); return; }

  const ingredients = [];
  document.querySelectorAll('#ing-container .ing-row').forEach(row => {
    const n = row.querySelector('.ing-name').value.trim();
    const q = parseFloat(row.querySelector('.ing-qty').value) || 0;
    const u = row.querySelector('.ing-unit').value.trim();
    if (n) ingredients.push({ name: n, quantity: q, unit: u });
  });

  STATE.customRecipes.push({ id: uid(), name, description: desc, ingredients });
  persist();
  closeModal();
  renderRecipes();
}

// ====================================================
// MODAL
// ====================================================
function showModal(title, bodyHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  ingRowCounter = 0;
}

// ====================================================
// SETTINGS
// ====================================================
function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    inventory: STATE.inventory,
    shoppingList: STATE.shoppingList,
    customRecipes: STATE.customRecipes,
    consumptionHistory: STATE.consumptionHistory
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `food-stock-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!confirm('現在のデータを上書きしますか？')) return;
      STATE.inventory          = data.inventory          || [];
      STATE.shoppingList       = data.shoppingList       || [];
      STATE.customRecipes      = data.customRecipes      || [];
      STATE.consumptionHistory = data.consumptionHistory || [];
      persist();
      renderDashboard();
      updateShoppingBadge();
      alert('インポート完了しました');
    } catch {
      alert('JSONファイルの読み込みに失敗しました');
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm('全データを削除します。元に戻せません。本当によろしいですか？')) return;
  ['fsm_inventory','fsm_shopping','fsm_recipes','fsm_history'].forEach(k =>
    localStorage.removeItem(k)
  );
  STATE = { inventory:[], shoppingList:[], customRecipes:[], consumptionHistory:[] };
  renderDashboard();
  updateShoppingBadge();
  alert('データを削除しました');
}

// ====================================================
// HELPERS
// ====================================================
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function escJs(str) {
  return String(str ?? '').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"');
}

// ====================================================
// INIT
// ====================================================
function init() {
  loadState();
  renderDashboard();
  updateShoppingBadge();
  refreshNameDatalist();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);

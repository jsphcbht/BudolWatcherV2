/* ============================================================
   BudolWatcher — Main Application Controller
   Handles UI rendering, event binding, routing, charts, export
   ============================================================ */

(() => {
  'use strict';

  /* ---------- DOM References ---------- */
  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  /* ---------- Tab Routing ---------- */
  const TABS = ['dashboard', 'expenses', 'savings', 'insights', 'utang', 'settings'];
  let currentTab = 'dashboard';

  function switchTab(tab) {
    if (!TABS.includes(tab)) return;
    currentTab = tab;
    TABS.forEach(t => {
      const view = $('view' + t.charAt(0).toUpperCase() + t.slice(1));
      if (view) view.classList.toggle('active', t === tab);
    });
    $$('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    // Refresh the tab content
    renderTab(tab);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderTab(tab) {
    switch (tab) {
      case 'dashboard': renderDashboard(); break;
      case 'expenses': renderExpenses(); break;
      case 'savings': renderSavings(); break;
      case 'utang': renderUtang(); break;
      case 'insights': renderInsights(); break;
      case 'settings': renderSettings(); break;
    }
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function showToast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }

  /* ---------- Confirm Dialog ---------- */
  let confirmCallback = null;
  function showConfirm(msg, onConfirm) {
    $('confirmMsg').textContent = msg;
    $('confirmOverlay').classList.remove('hidden');
    confirmCallback = onConfirm;
  }

  /* ---------- DASHBOARD ---------- */
  function renderDashboard() {
    // Balance
    const opening = Store.getOpeningBalance();
    const added = Store.getTodayAdded();
    const spent = Store.getTodaySpent();
    const available = Store.getAvailableBalance();

    $('openingBalance').textContent = Store.formatPeso(opening);
    $('addedToday').textContent = Store.formatPeso(added);
    $('spentToday').textContent = Store.formatPeso(spent);

    const availEl = $('availableNow');
    availEl.textContent = Store.formatPeso(available);
    availEl.classList.toggle('negative', available < 0);

    // Overspent hint
    $('overspentHint').style.display = available < 0 ? 'block' : 'none';

    // Recent expenses (today, max 5)
    const recent = Store.getExpenses('today').slice(0, 5);
    const cats = Store.getCategories(true);
    const list = $('recentExpenses');
    const empty = $('recentEmpty');

    if (recent.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      list.innerHTML = recent.map(e => {
        const cat = cats.find(c => c.id === e.category_id);
        return expenseListItem(e, cat);
      }).join('');
    }

    // Populate quick categories for expense logging
    renderQuickCategories();

    // Today's budget entries (deletable)
    renderTodayBudgets();

    // Utang Summary
    const debtSummary = Store.getDebtSummary();
    const owesMeEl = $('dashOwesMe');
    const oweThemEl = $('dashOweThem');
    if (owesMeEl && oweThemEl) {
      owesMeEl.textContent = Store.formatPeso(debtSummary.owesMe);
      oweThemEl.textContent = Store.formatPeso(debtSummary.oweThem);
    }

    // Budol Meter
    renderBudolMeter();

    // Savings quick glance
    renderSavingsQuick();
  }

  /* ---------- BUDOL METER ---------- */
  function renderBudolMeter() {
    const expenses = Store.getExpenses('month');
    let totalSpent = 0;
    let budolSpent = 0;

    // Categories considered "Budol"
    const cats = Store.getCategories(true);
    const budolCats = cats.filter(c => {
      const name = c.name.toLowerCase();
      return name.includes('shopping') || name.includes('hihihaha') || name.includes('budol');
    }).map(c => c.id);

    expenses.forEach(e => {
      totalSpent += e.amount;
      if (budolCats.includes(e.category_id)) {
        budolSpent += e.amount;
      }
    });

    const pct = totalSpent > 0 ? (budolSpent / totalSpent) * 100 : 0;
    const isSafe = pct < 15;
    const isWarn = pct >= 15 && pct <= 30;
    const isDanger = pct > 30;

    const fillEl = $('budolFill');
    const statusEl = $('budolStatusText');
    const logoIcon = document.querySelector('.logo-icon');
    
    if (!fillEl || !statusEl) return;

    fillEl.style.width = Math.min(100, pct) + '%';
    fillEl.className = 'progress-fill';
    statusEl.className = 'budol-status';
    
    if (isDanger) {
      fillEl.style.background = 'var(--danger)';
      statusEl.classList.add('budol-danger');
      statusEl.textContent = `Over-Budol! (${Math.round(pct)}%)`;
      if (logoIcon) logoIcon.textContent = '🤡';
    } else if (isWarn) {
      fillEl.style.background = 'var(--warning)';
      statusEl.classList.add('budol-warn');
      statusEl.textContent = `Warning (${Math.round(pct)}%)`;
      if (logoIcon) logoIcon.textContent = '₱';
    } else {
      fillEl.style.background = 'var(--success)';
      statusEl.classList.add('budol-safe');
      statusEl.textContent = `Safe (${Math.round(pct)}%)`;
      if (logoIcon) logoIcon.textContent = '₱';
    }
  }

  function renderTodayBudgets() {
    const budgets = Store.getTodayBudgets();
    const list = $('todayBudgets');
    if (budgets.length === 0) {
      list.innerHTML = '';
      return;
    }
    list.innerHTML = budgets.map(b => {
      const time = new Date(b.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' });
      return `
        <li class="list-item">
          <div class="list-item-left">
            <span class="list-item-title">Budget added</span>
            <span class="list-item-sub">${time}</span>
          </div>
          <div class="list-item-right">
            <span class="amount amount-positive">+${Store.formatPeso(b.amount)}</span>
            <button class="delete-btn" data-delete-budget="${b.id}" title="Remove this budget entry">×</button>
          </div>
        </li>`;
    }).join('');
  }

  function renderSavingsQuick() {
    const goals = Store.getActiveGoals();
    const container = $('savingsQuick');
    const empty = $('savingsEmpty');

    if (goals.length === 0) {
      container.innerHTML = '';
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      container.innerHTML = goals.slice(0, 3).map(g => {
        const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100));
        return `
          <div class="goal-card">
            <div class="goal-header">
              <span class="goal-name">${esc(g.name)}</span>
              <span class="goal-amounts"><strong>${Store.formatPeso(g.saved_amount)}</strong> / ${Store.formatPeso(g.target_amount)}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div class="goal-meta"><span>${pct}%</span></div>
          </div>`;
      }).join('');
    }
  }

  /* ---------- EXPENSES LIST ---------- */
  function renderExpenses() {
    const filter = $('expenseFilter').value;
    const expenses = Store.getExpenses(filter);
    const cats = Store.getCategories(true);
    const list = $('allExpenses');
    const empty = $('expensesEmpty');
    const summary = $('expenseSummary');

    const total = expenses.reduce((s, e) => s + e.amount, 0);
    summary.innerHTML = `
      <div class="meta-item">
        <span class="meta-label">Total</span>
        <span class="meta-value">${Store.formatPeso(total)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Transactions</span>
        <span class="meta-value">${expenses.length}</span>
      </div>`;

    if (expenses.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      list.innerHTML = expenses.map(e => {
        const cat = cats.find(c => c.id === e.category_id);
        return expenseListItem(e, cat, true);
      }).join('');
    }
  }

  function expenseListItem(e, cat, showDate = false) {
    const catName = cat ? cat.name : 'Unknown';
    const dateStr = showDate ? formatDisplayDate(e.date) + ' · ' : '';
    const timeStr = new Date(e.logged_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' });
    const overspent = e.is_overspent ? '<span class="badge badge-overspent">overspent</span>' : '';
    return `
      <li class="list-item">
        <div class="list-item-left">
          <span class="list-item-title">${esc(catName)}${e.note ? ' · ' + esc(e.note) : ''}</span>
          <span class="list-item-sub">${dateStr}${timeStr}</span>
        </div>
        <div class="list-item-right">
          ${overspent}
          <span class="amount ${e.is_overspent ? 'amount-overspent' : 'amount-expense'}">-${Store.formatPeso(e.amount)}</span>
          <button class="delete-btn" data-delete-expense="${e.id}" title="Delete">×</button>
        </div>
      </li>`;
  }

  /* ---------- SAVINGS ---------- */
  function renderSavings() {
    const active = Store.getActiveGoals();
    const completed = Store.getCompletedGoals();

    // Goal select for contributions
    const contributeCard = $('contributeCard');
    const goalSelect = $('goalSelect');
    if (active.length > 0) {
      contributeCard.style.display = 'block';
      goalSelect.innerHTML = active.map(g =>
        `<option value="${g.id}">${esc(g.name)} (${Store.formatPeso(g.saved_amount)} / ${Store.formatPeso(g.target_amount)})</option>`
      ).join('');
    } else {
      contributeCard.style.display = 'none';
    }

    // Active goals
    const goalsContainer = $('goalsList');
    const goalsEmpty = $('goalsEmpty');
    if (active.length === 0) {
      goalsContainer.innerHTML = '';
      goalsEmpty.style.display = 'block';
    } else {
      goalsEmpty.style.display = 'none';
      goalsContainer.innerHTML = active.map(goalCard).join('');
    }

    // Completed goals
    const compCard = $('completedGoalsCard');
    const compContainer = $('completedGoals');
    if (completed.length > 0) {
      compCard.style.display = 'block';
      compContainer.innerHTML = completed.map(goalCard).join('');
    } else {
      compCard.style.display = 'none';
    }
  }

  function goalCard(g) {
    const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100));
    const dateInfo = g.target_date ? `Target: ${formatDisplayDate(g.target_date)}` : '';
    const status = g.is_completed ? '✅ Complete' : (g.target_date ? getGoalStatus(g) : '');
    return `
      <div class="goal-card">
        <div class="goal-header">
          <span class="goal-name">${esc(g.name)}</span>
          <button class="delete-btn" data-delete-goal="${g.id}" title="Delete goal">×</button>
        </div>
        <div class="goal-amounts">
          <strong>${Store.formatPeso(g.saved_amount)}</strong> / ${Store.formatPeso(g.target_amount)}
        </div>
        <div class="progress-bar"><div class="progress-fill${g.is_completed ? ' complete' : ''}" style="width:${pct}%"></div></div>
        <div class="goal-meta">
          <span>${pct}%${status ? ' · ' + status : ''}</span>
          <span>${dateInfo}</span>
        </div>
      </div>`;
  }

  function getGoalStatus(g) {
    if (!g.target_date || g.is_completed) return '';
    const today = new Date();
    const target = new Date(g.target_date);
    const remainingDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    if (remainingDays < 0) return '⏰ Overdue';
    const remaining = g.target_amount - g.saved_amount;
    const dailyNeeded = remaining / Math.max(remainingDays, 1);
    return dailyNeeded <= 50 ? '🟢 On track' : '🟡 Behind';
  }

  /* ---------- UTANG ---------- */
  function renderUtang() {
    const debts = (Store.getDebts() || []).sort((a,b) => b.created_at.localeCompare(a.created_at));
    const active = debts.filter(d => !d.is_paid);
    const completed = debts.filter(d => d.is_paid);

    const list = $('debtsList');
    const empty = $('debtsEmpty');
    if (!list) return; // not initialized yet?

    const allDebts = [...active, ...completed];

    if (allDebts.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      list.innerHTML = allDebts.map(d => debtCard(d)).join('');
    }
  }

  function debtCard(d) {
    const isOwesMe = d.type === 'owes_me';
    const typeLabel = isOwesMe ? 'Owes me' : 'I owe them';
    const cardClass = isOwesMe ? 'owes_me' : 'owe_them';
    const amountClass = isOwesMe ? 'val-owes-me' : 'val-owe-them';
    const sign = isOwesMe ? '+' : '-';
    
    return `
      <div class="card utang-card ${cardClass} ${d.is_paid ? 'paid' : ''}">
        <div class="goal-header">
          <span class="goal-name" style="font-size:16px;">${esc(d.person)}</span>
          <div style="display:flex;gap:4px;">
            ${!d.is_paid 
              ? `<button class="delete-btn" data-pay-debt="${d.id}" title="Mark as Paid" style="color:var(--success)">✔️</button>` 
              : `<button class="delete-btn" data-pay-debt="${d.id}" title="Unmark Paid">↩️</button>`}
            <button class="delete-btn" data-delete-debt="${d.id}" title="Delete">×</button>
          </div>
        </div>
        <div class="goal-meta" style="margin-bottom: 4px;">
          <span>${typeLabel} · ${formatDisplayDate(d.date)}</span>
        </div>
        <div class="${amountClass}" style="font-size: 16px; font-weight:700;">${sign}${Store.formatPeso(d.amount)}</div>
      </div>
    `;
  }

  /* ---------- INSIGHTS / CHARTS ---------- */
  let pieChartInstance = null;
  let trendChartInstance = null;

  const CHART_COLORS = ['#2E865F', '#0B1F3B', '#FF9500', '#4A90D9', '#C6F4D6', '#E53E3E', '#8B5CF6', '#F59E0B'];

  function renderInsights() {
    const period = $('chartPeriod').value;
    const breakdown = Store.getCategoryBreakdown(period);

    // Pie chart
    const pieCanvas = $('pieChart');
    const legendEl = $('breakdownLegend');
    const chartEmpty = $('chartEmpty');

    if (breakdown.length === 0) {
      chartEmpty.style.display = 'block';
      pieCanvas.style.display = 'none';
      legendEl.innerHTML = '';
      if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
    } else {
      chartEmpty.style.display = 'none';
      pieCanvas.style.display = 'block';

      const labels = breakdown.map(b => b.category);
      const data = breakdown.map(b => b.total);
      const colors = breakdown.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

      if (pieChartInstance) pieChartInstance.destroy();
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

      pieChartInstance = new Chart(pieCanvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: isDark ? '#1E1E2E' : '#FFFFFF' }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: isDark ? '#2A2A3C' : '#0B1F3B',
              titleColor: '#fff',
              bodyColor: '#fff',
              callbacks: {
                label: ctx => `${ctx.label}: ${Store.formatPeso(ctx.parsed)} (${Math.round(ctx.parsed / data.reduce((a, b) => a + b, 0) * 100)}%)`
              }
            }
          }
        }
      });

      // Legend
      const total = data.reduce((a, b) => a + b, 0);
      legendEl.innerHTML = breakdown.map((b, i) => {
        const pct = Math.round(b.total / total * 100);
        return `<span class="legend-item"><span class="legend-dot" style="background:${colors[i]}"></span>${esc(b.category)} ${Store.formatPeso(b.total)} (${pct}%)</span>`;
      }).join('');
    }

    // Trend chart
    const days = period === 'today' ? 1 : period === '7days' ? 7 : 30;
    const trend = Store.getDailySpendingTrend(Math.max(days, 7));
    const trendCanvas = $('trendChart');
    const isDarkTrend = document.documentElement.getAttribute('data-theme') === 'dark';

    if (trendChartInstance) trendChartInstance.destroy();
    trendChartInstance = new Chart(trendCanvas, {
      type: 'line',
      data: {
        labels: trend.map(t => {
          const d = new Date(t.date + 'T00:00:00');
          return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
        }),
        datasets: [
          {
            label: 'Spent',
            data: trend.map(t => t.spent),
            borderColor: '#FF9500',
            backgroundColor: 'rgba(255,149,0,0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2
          },
          {
            label: 'Budget',
            data: trend.map(t => t.budgeted),
            borderColor: '#2E865F',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
            pointRadius: 2,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            grid: { color: isDarkTrend ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
            ticks: { color: isDarkTrend ? '#A0A0A0' : '#666', font: { size: 11 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: isDarkTrend ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
            ticks: {
              color: isDarkTrend ? '#A0A0A0' : '#666', font: { size: 11 },
              callback: v => '₱' + v
            }
          }
        },
        plugins: {
          legend: {
            labels: { color: isDarkTrend ? '#E0E0E0' : '#0B1F3B', font: { size: 12 }, usePointStyle: true, pointStyle: 'circle' }
          },
          tooltip: {
            backgroundColor: isDarkTrend ? '#2A2A3C' : '#0B1F3B',
            callbacks: { label: ctx => `${ctx.dataset.label}: ${Store.formatPeso(ctx.parsed.y)}` }
          }
        }
      }
    });

    // Summary stats
    const stats = Store.getSummaryStats();
    $('statTotalExpenses').textContent = Store.formatPeso(stats.totalExpenses);
    $('statTotalSaved').textContent = Store.formatPeso(stats.totalSaved);
    $('statTopCategory').textContent = stats.topCategory;
  }

  /* ---------- SETTINGS ---------- */
  function renderSettings() {
    renderCategoriesList();
    // Dark mode toggle
    $('darkModeToggle').checked = document.documentElement.getAttribute('data-theme') === 'dark';
    // Export dates default
    if (!$('exportFrom').value) $('exportFrom').value = Store.monthStart();
    if (!$('exportTo').value) $('exportTo').value = Store.todayStr();
  }

  function renderCategoriesList() {
    const cats = Store.getCategories(true);
    const list = $('categoriesList');
    list.innerHTML = cats.map(c => `
      <li class="list-item">
        <div class="list-item-left">
          <span class="list-item-title">${esc(c.name)}</span>
          <span class="list-item-sub">${c.is_archived ? 'Archived' : 'Active'}</span>
        </div>
        <div class="category-actions">
          ${!c.is_archived ? `<button class="delete-btn" data-rename-cat="${c.id}" title="Rename">✏️</button>` : ''}
          ${!c.is_archived ? `<button class="delete-btn" data-archive-cat="${c.id}" title="Archive">🗂️</button>` : ''}
        </div>
      </li>`).join('');
  }

  /* ---------- Render Quick Categories ---------- */
  function renderQuickCategories() {
    const cats = Store.getCategories();
    const container = $('quickCategoriesList');
    if (!container) return;
    
    const current = $('expenseCategory').value;
    
    let html = cats.map(c => `
      <button type="button" class="quick-cat-btn${c.id === current ? ' selected' : ''}" data-cat-id="${c.id}">
        ${esc(c.name)}
      </button>
    `).join('');
    
    html += `<button type="button" class="quick-cat-btn add-custom" id="addCustomCategoryBtn">+ New</button>`;
    
    container.innerHTML = html;
  }

  /* ---------- EXPORT ---------- */
  function exportCSV(data) {
    if (data.length === 0) { showToast('No data to export'); return; }
    const headers = Object.keys(data[0]);
    const bom = '\uFEFF';
    const csv = bom + headers.join(',') + '\n' +
      data.map(row => headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob(csv, 'text/csv;charset=utf-8', `BudolWatcher_${Store.todayStr()}.csv`);
    showToast('CSV exported!');
  }

  function exportPDF(data) {
    if (data.length === 0) { showToast('No data to export'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(11, 31, 59);
    doc.text('BudolWatcher Report', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(102, 102, 102);
    const from = $('exportFrom').value || 'All time';
    const to = $('exportTo').value || Store.todayStr();
    doc.text(`Period: ${from} to ${to}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`, 14, 34);

    // Summary
    const stats = Store.getSummaryStats();
    doc.setFontSize(12);
    doc.setTextColor(11, 31, 59);
    doc.text('Summary', 14, 44);
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Expenses: ${Store.formatPeso(stats.totalExpenses)}`, 14, 52);
    doc.text(`Total Saved: ${Store.formatPeso(stats.totalSaved)}`, 14, 58);
    doc.text(`Top Category: ${stats.topCategory}`, 14, 64);

    // Table
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => String(row[h])));
    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 78,
      headStyles: { fillColor: [11, 31, 59], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 }
    });

    doc.save(`BudolWatcher_${Store.todayStr()}.pdf`);
    showToast('PDF exported!');
  }

  function downloadBlob(content, type, filename) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ---------- THEME ---------- */
  function initTheme() {
    const saved = Store.getTheme();
    if (saved === 'dark' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      Store.setTheme('light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      Store.setTheme('dark');
    }
    // Re-render current tab for chart theme updates
    renderTab(currentTab);
  }

  /* ---------- Confetti Animation ---------- */
  function spawnConfetti(target) {
    const emojis = ['🎉', '⭐', '💰', '🎊', '✨'];
    for (let i = 0; i < 8; i++) {
      const el = document.createElement('span');
      el.className = 'confetti';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.left = (Math.random() * 80 + 10) + '%';
      el.style.top = target.offsetTop + 'px';
      el.style.animationDelay = (Math.random() * 0.3) + 's';
      target.style.position = 'relative';
      target.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    }
  }

  /* ---------- Utility ---------- */
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDisplayDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* ---------- EVENT BINDING ---------- */
  function bindEvents() {
    // Bottom nav
    $$('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Link buttons (data-tab)
    document.addEventListener('click', e => {
      const linkBtn = e.target.closest('[data-tab]');
      if (linkBtn && !linkBtn.classList.contains('nav-item')) {
        switchTab(linkBtn.dataset.tab);
      }
    });

    // Budget form
    $('budgetForm').addEventListener('submit', e => {
      e.preventDefault();
      const input = $('budgetAmount');
      const result = Store.addBudget(input.value);
      if (result.error) { showToast(result.error); return; }
      input.value = '';
      showToast('Budget added!');
      renderDashboard();
    });

    // Expense form
    $('expenseForm').addEventListener('submit', e => {
      e.preventDefault();
      const amount = $('expenseAmount');
      const catId = $('expenseCategory').value;
      const note = $('expenseNote');
      if (!catId) { showToast('Please select a category'); return; }
      const result = Store.addExpense(amount.value, catId, note.value);
      if (result.error) { showToast(result.error); return; }
      amount.value = '';
      note.value = '';
      if (result.isOverspent) {
        $('overspentHint').style.display = 'block';
        showToast('⚠️ Expense logged — budget exceeded!');
      } else {
        $('overspentHint').style.display = 'none';
        showToast('Expense logged!');
      }
      renderDashboard();
    });

    // Goal form
    $('goalForm').addEventListener('submit', e => {
      e.preventDefault();
      const result = Store.addGoal($('goalName').value, $('goalTarget').value, $('goalDate').value);
      if (result.error) { showToast(result.error); return; }
      $('goalName').value = '';
      $('goalTarget').value = '';
      $('goalDate').value = '';
      showToast('Savings goal created!');
      renderSavings();
    });

    // Contribution form
    $('contributionForm').addEventListener('submit', e => {
      e.preventDefault();
      const goalId = $('goalSelect').value;
      const amount = $('contributionAmount').value;
      if (!amount) { showToast('Enter an amount'); return; }
      const result = Store.addContribution(goalId, amount, 'manual');
      if (result.error) { showToast(result.error); return; }
      $('contributionAmount').value = '';
      if (result.goalCompleted) {
        showToast('🎉 Goal completed! Amazing!');
        const goalsContainer = $('goalsList');
        spawnConfetti(goalsContainer);
      } else {
        showToast('Contribution added!');
      }
      renderSavings();
      renderDashboard();
    });

    // Save leftover button
    $('saveLeftoverBtn').addEventListener('click', () => {
      const goalId = $('goalSelect').value;
      if (!goalId) { showToast('Select a goal first'); return; }
      const result = Store.saveLeftover(goalId);
      if (result.error) { showToast(result.error); return; }
      if (result.goalCompleted) {
        showToast('🎉 Goal completed with leftover! Amazing!');
        spawnConfetti($('goalsList'));
      } else {
        showToast('💰 Leftover saved!');
      }
      renderSavings();
      renderDashboard();
    });

    // Category form
    $('categoryForm').addEventListener('submit', e => {
      e.preventDefault();
      const input = $('categoryName');
      const result = Store.addCategory(input.value);
      if (result.error) { showToast(result.error); return; }
      input.value = '';
      showToast('Category added!');
      renderSettings();
      renderQuickCategories();
    });

    // Debt form
    const debtForm = $('debtForm');
    if (debtForm) {
      debtForm.addEventListener('submit', e => {
        e.preventDefault();
        const person = $('debtPerson').value;
        const amount = $('debtAmount').value;
        const type = $('debtType').value;
        
        const result = Store.addDebt(person, amount, type);
        if (result.error) { showToast(result.error); return; }
        
        $('debtPerson').value = '';
        $('debtAmount').value = '';
        showToast('Debt recorded!');
        renderUtang();
        renderDashboard(); // Update dashboard summary
      });
    }

    // Quick category selection
    document.addEventListener('click', e => {
      // Select category
      const catBtn = e.target.closest('[data-cat-id]');
      if (catBtn) {
        // Toggle off others
        $$('#quickCategoriesList .quick-cat-btn').forEach(b => b.classList.remove('selected'));
        // Toggle on this one
        catBtn.classList.add('selected');
        // Update hidden input
        $('expenseCategory').value = catBtn.dataset.catId;
        return;
      }
      
      // Add custom category inline
      const addCustom = e.target.closest('#addCustomCategoryBtn');
      if (addCustom) {
        const newName = prompt('Enter new category name:');
        if (newName === null || newName.trim() === '') return;
        
        const result = Store.addCategory(newName);
        if (result.error) {
          showToast(result.error);
          return;
        }
        
        showToast(`Category "${esc(newName)}" created!`);
        // Select it immediately
        $('expenseCategory').value = result.data.id;
        renderQuickCategories();
        
        // Ensure new button is scrolled into view and selected
        setTimeout(() => {
          const list = $('quickCategoriesList');
          list.scrollLeft = list.scrollWidth;
        }, 50);
        return;
      }
      
    });

    // Delegated delete/action clicks
    document.addEventListener('click', e => {
      // Delete budget
      const delBudget = e.target.closest('[data-delete-budget]');
      if (delBudget) {
        showConfirm('Remove this budget entry?', () => {
          Store.deleteBudget(delBudget.dataset.deleteBudget);
          showToast('Budget entry removed');
          renderDashboard();
        });
        return;
      }
      // Delete expense
      const delExp = e.target.closest('[data-delete-expense]');
      if (delExp) {
        showConfirm('Delete this expense?', () => {
          Store.deleteExpense(delExp.dataset.deleteExpense);
          showToast('Expense deleted');
          renderDashboard();
          renderExpenses();
        });
        return;
      }
      // Delete goal
      const delGoal = e.target.closest('[data-delete-goal]');
      if (delGoal) {
        showConfirm('Delete this savings goal? Contributions will be removed.', () => {
          Store.deleteGoal(delGoal.dataset.deleteGoal);
          showToast('Goal deleted');
          renderSavings();
          renderDashboard();
        });
        return;
      }
      // Pay/Unpay debt
      const payDebt = e.target.closest('[data-pay-debt]');
      if (payDebt) {
        Store.toggleDebtPaid(payDebt.dataset.payDebt);
        showToast('Debt status updated');
        renderUtang();
        renderDashboard();
        return;
      }
      // Delete debt
      const delDebt = e.target.closest('[data-delete-debt]');
      if (delDebt) {
        showConfirm('Delete this debt record?', () => {
          Store.deleteDebt(delDebt.dataset.deleteDebt);
          showToast('Debt deleted');
          renderUtang();
          renderDashboard();
        });
        return;
      }
      // Rename category
      const renCat = e.target.closest('[data-rename-cat]');
      if (renCat) {
        const cat = Store.getCategories(true).find(c => c.id === renCat.dataset.renameCat);
        if (!cat) return;
        const newName = prompt('Rename category:', cat.name);
        if (newName === null || newName.trim() === '') return;
        const result = Store.renameCategory(cat.id, newName);
        if (result.error) { showToast(result.error); return; }
        showToast('Category renamed!');
        renderSettings();
        renderQuickCategories();
        return;
      }
      // Archive category
      const archCat = e.target.closest('[data-archive-cat]');
      if (archCat) {
        showConfirm('Archive this category? It will be hidden from the dropdown but existing expenses keep it.', () => {
          const result = Store.archiveCategory(archCat.dataset.archiveCat);
          if (result.error) { showToast(result.error); return; }
          showToast('Category archived');
          renderSettings();
          renderQuickCategories();
        });
        return;
      }
    });

    // Expense filter change
    $('expenseFilter').addEventListener('change', renderExpenses);

    // Chart period change
    $('chartPeriod').addEventListener('change', renderInsights);

    // Theme toggles
    $('themeToggle').addEventListener('click', toggleTheme);
    $('darkModeToggle').addEventListener('change', toggleTheme);

    // Export
    $('exportBtn').addEventListener('click', () => {
      const type = $('exportType').value;
      const format = $('exportFormat').value;
      const from = $('exportFrom').value;
      const to = $('exportTo').value;
      const data = Store.getExportData(type, from, to);
      if (format === 'csv') exportCSV(data);
      else exportPDF(data);
    });

    // Clear all data
    $('clearDataBtn').addEventListener('click', () => {
      showConfirm('⚠️ This will permanently delete ALL your data. Are you sure?', () => {
        Store.clearAll();
        showToast('All data cleared');
        switchTab('dashboard');
      });
    });

    // Confirm dialog buttons
    $('confirmOk').addEventListener('click', () => {
      $('confirmOverlay').classList.add('hidden');
      if (confirmCallback) confirmCallback();
      confirmCallback = null;
    });
    $('confirmCancel').addEventListener('click', () => {
      $('confirmOverlay').classList.add('hidden');
      confirmCallback = null;
    });

    // System theme change listener
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (Store.getTheme() === 'system') {
        initTheme();
        renderTab(currentTab);
      }
    });

    // Online/offline
    window.addEventListener('online', () => $('offlineBanner').classList.add('hidden'));
    window.addEventListener('offline', () => $('offlineBanner').classList.remove('hidden'));
  }

  /* ---------- PWA Install ---------- */
  let deferredPrompt = null;

  function setupPWA() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      // Show install banner after a short delay
      setTimeout(() => {
        const dismissed = localStorage.getItem('budolwatcher.install_dismissed');
        if (!dismissed) $('installBanner').classList.remove('hidden');
      }, 3000);
    });

    $('installBtn').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') showToast('App installed! 🎉');
      deferredPrompt = null;
      $('installBanner').classList.add('hidden');
    });

    $('installDismiss').addEventListener('click', () => {
      $('installBanner').classList.add('hidden');
      localStorage.setItem('budolwatcher.install_dismissed', '1');
    });

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('SW registration failed:', err);
      });
    }
  }

  /* ---------- INIT ---------- */
  function init() {
    // Initialize data
    Store.load();

    // Theme
    initTheme();

    // Today label
    $('todayLabel').textContent = new Date().toLocaleDateString('en-PH', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'Asia/Manila'
    });

    // Bind events
    bindEvents();

    // Initial render
    renderDashboard();

    // PWA
    setupPWA();

    // Offline check
    if (!navigator.onLine) $('offlineBanner').classList.remove('hidden');

    // Sync listener
    window.addEventListener('sync-complete', () => {
      renderTab(currentTab);
    });
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

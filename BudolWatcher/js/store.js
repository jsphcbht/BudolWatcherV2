/* ============================================================
   BudolWatcher — LocalStorage Data Store
   All data persistence, CRUD, and helper utilities
   ============================================================ */

const Store = (() => {
  const STORAGE_KEY = 'budolwatcher.v2';
  const TZ = 'Asia/Manila';

  /* ---------- Helpers ---------- */
  function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
  }

  function todayStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function manilaDate(date) {
    return new Date(date).toLocaleDateString('en-CA', { timeZone: TZ });
  }

  function formatPeso(n) {
    const num = Number(n) || 0;
    return '₱' + num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function daysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toLocaleDateString('en-CA', { timeZone: TZ });
  }

  function monthStart() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA', { timeZone: TZ });
  }

  /* ---------- Default State ---------- */
  const DEFAULT_CATEGORIES = ['Food', 'Transport', 'School', 'Shopping', 'Others'];

  function createDefault() {
    const deviceId = uuid();
    const cats = DEFAULT_CATEGORIES.map((name, i) => ({
      id: uuid(), device_id: deviceId, name,
      is_archived: false, sort_order: i, created_at: nowISO()
    }));
    return {
      version: 2,
      device_id: deviceId,
      categories: cats,
      budgets: [],
      expenses: [],
      savings_goals: [],
      contributions: [],
      debts: [],
      settings: { theme: 'system' }
    };
  }

  /* ---------- Persistence ---------- */
  let _data = null;

  function load() {
    if (_data) return _data;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        _data = JSON.parse(raw);
        // Migration from v1
        if (!_data.version || _data.version < 2) {
          _data = migrateV1(_data);
        }
      } else {
        _data = createDefault();
      }
    } catch {
      _data = createDefault();
    }
    save();
    return _data;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
      if (typeof Sync !== 'undefined' && Sync.queueSync) {
        Sync.queueSync();
      }
    } catch (e) {
      console.error('Storage save failed:', e);
    }
  }

  function _saveRaw(data) {
    _data = data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
    } catch (e) {
      console.error('Storage raw save failed:', e);
    }
  }

  function migrateV1(old) {
    // Best-effort migration from v1 format
    const data = createDefault();
    if (old.categories) {
      data.categories = old.categories.map(c => typeof c === 'string'
        ? { id: uuid(), device_id: data.device_id, name: c, is_archived: false, sort_order: 0, created_at: nowISO() }
        : { ...c, device_id: data.device_id }
      );
    }
    if (old.expenses) {
      data.expenses = old.expenses.map(e => ({
        ...e, id: e.id || uuid(), device_id: data.device_id,
        date: e.date || manilaDate(e.logged_at || e.created_at || new Date()),
        logged_at: e.logged_at || nowISO(), created_at: e.created_at || nowISO()
      }));
    }
    if (old.budgets) data.budgets = old.budgets.map(b => ({ ...b, device_id: data.device_id }));
    if (old.savings_goals) data.savings_goals = old.savings_goals.map(g => ({ ...g, device_id: data.device_id }));
    if (old.contributions) data.contributions = old.contributions.map(c => ({ ...c, device_id: data.device_id }));
    if (old.debts) data.debts = old.debts.map(d => ({ ...d, device_id: data.device_id }));
    data.version = 2;
    return data;
  }

  /* ---------- CATEGORIES ---------- */
  function getCategories(includeArchived = false) {
    const d = load();
    return includeArchived ? d.categories : d.categories.filter(c => !c.is_archived);
  }

  function addCategory(name) {
    const d = load();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 30) return { error: 'Name must be 1–30 characters' };
    const exists = d.categories.find(c => !c.is_archived && c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) return { error: 'Category already exists' };
    const activeCount = d.categories.filter(c => !c.is_archived).length;
    if (activeCount >= 20) return { error: 'Maximum 20 categories allowed' };
    const cat = {
      id: uuid(), device_id: d.device_id, name: trimmed,
      is_archived: false, sort_order: activeCount, created_at: nowISO()
    };
    d.categories.push(cat);
    save();
    return { data: cat };
  }

  function renameCategory(id, newName) {
    const d = load();
    const trimmed = newName.trim();
    if (!trimmed || trimmed.length > 30) return { error: 'Name must be 1–30 characters' };
    const dup = d.categories.find(c => c.id !== id && !c.is_archived && c.name.toLowerCase() === trimmed.toLowerCase());
    if (dup) return { error: 'Category name already exists' };
    const cat = d.categories.find(c => c.id === id);
    if (!cat) return { error: 'Category not found' };
    cat.name = trimmed;
    save();
    return { data: cat };
  }

  function archiveCategory(id) {
    const d = load();
    const active = d.categories.filter(c => !c.is_archived);
    if (active.length <= 1) return { error: 'Cannot archive the last category' };
    const cat = d.categories.find(c => c.id === id);
    if (!cat) return { error: 'Category not found' };
    cat.is_archived = true;
    save();
    return { data: cat };
  }

  /* ---------- BUDGETS ---------- */
  function getBudgetsForDate(date) {
    return load().budgets.filter(b => b.date === date);
  }

  function getTodayBudgets() {
    return load().budgets.filter(b => b.date === todayStr())
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  function addBudget(amount) {
    const d = load();
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0 || num > 999999.99) return { error: 'Amount must be 0.01–999,999.99' };
    const entry = {
      id: uuid(), device_id: d.device_id,
      amount: Math.round(num * 100) / 100,
      date: todayStr(), created_at: nowISO()
    };
    d.budgets.push(entry);
    save();
    return { data: entry };
  }

  function deleteBudget(id) {
    const d = load();
    const idx = d.budgets.findIndex(b => b.id === id);
    if (idx === -1) return { error: 'Budget entry not found' };
    d.budgets.splice(idx, 1);
    save();
    return { data: true };
  }

  function getOpeningBalance() {
    const d = load();
    const today = todayStr();
    let total = 0;

    // Sum all budgets before today
    d.budgets.filter(b => b.date < today).forEach(b => total += b.amount);
    // Subtract all expenses before today
    d.expenses.filter(e => e.date < today).forEach(e => total -= e.amount);
    // Subtract all contributions before today
    d.contributions.filter(c => c.date < today).forEach(c => total -= c.amount);

    return Math.round(total * 100) / 100;
  }

  function getAvailableBalance() {
    const d = load();
    const today = todayStr();
    let total = getOpeningBalance();

    // Add today's budgets
    d.budgets.filter(b => b.date === today).forEach(b => total += b.amount);
    // Subtract today's expenses and contributions
    d.expenses.filter(e => e.date === today).forEach(e => total -= e.amount);
    d.contributions.filter(c => c.date === today).forEach(c => total -= c.amount);

    return Math.round(total * 100) / 100;
  }

  function getTodayAdded() {
    const d = load();
    const today = todayStr();
    let total = 0;
    d.budgets.filter(b => b.date === today).forEach(b => total += b.amount);
    return Math.round(total * 100) / 100;
  }

  function getTodaySpent() {
    const d = load();
    const today = todayStr();
    let total = 0;
    d.expenses.filter(e => e.date === today).forEach(e => total += e.amount);
    return Math.round(total * 100) / 100;
  }

  /* ---------- EXPENSES ---------- */
  function addExpense(amount, categoryId, note) {
    const d = load();
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0 || num > 999999.99) return { error: 'Amount must be 0.01–999,999.99' };
    const cat = d.categories.find(c => c.id === categoryId);
    if (!cat) return { error: 'Invalid category' };

    const today = todayStr();
    const available = getAvailableBalance();
    const isOverspent = (available - num) < 0;

    const entry = {
      id: uuid(), device_id: d.device_id,
      amount: Math.round(num * 100) / 100,
      category_id: categoryId,
      is_overspent: isOverspent,
      note: note ? note.trim().slice(0, 100) : '',
      logged_at: nowISO(),
      date: today,
      created_at: nowISO()
    };
    d.expenses.push(entry);
    save();
    return { data: entry, isOverspent };
  }

  function deleteExpense(id) {
    const d = load();
    const idx = d.expenses.findIndex(e => e.id === id);
    if (idx === -1) return { error: 'Expense not found' };
    d.expenses.splice(idx, 1);
    save();
    return { data: true };
  }

  function getExpenses(filter) {
    const d = load();
    const today = todayStr();
    let list = d.expenses;

    if (filter === 'today') list = list.filter(e => e.date === today);
    else if (filter === '7days') { const from = daysAgo(7); list = list.filter(e => e.date >= from); }
    else if (filter === 'month') { const from = monthStart(); list = list.filter(e => e.date >= from); }

    return list.sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  }

  function getExpensesByDateRange(from, to) {
    return load().expenses.filter(e => e.date >= from && e.date <= to)
      .sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  }

  /* ---------- SAVINGS GOALS ---------- */
  function addGoal(name, targetAmount, targetDate) {
    const d = load();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 50) return { error: 'Name must be 1–50 characters' };
    const num = parseFloat(targetAmount);
    if (isNaN(num) || num < 1 || num > 999999.99) return { error: 'Target must be 1–999,999.99' };
    const activeCount = d.savings_goals.filter(g => !g.is_completed).length;
    if (activeCount >= 10) return { error: 'Maximum 10 active goals allowed' };
    const goal = {
      id: uuid(), device_id: d.device_id,
      name: trimmed, target_amount: num, saved_amount: 0,
      target_date: targetDate || null,
      is_completed: false, completed_at: null,
      created_at: nowISO()
    };
    d.savings_goals.push(goal);
    save();
    return { data: goal };
  }

  function deleteGoal(id) {
    const d = load();
    const idx = d.savings_goals.findIndex(g => g.id === id);
    if (idx === -1) return { error: 'Goal not found' };
    // Remove related contributions
    d.contributions = d.contributions.filter(c => c.goal_id !== id);
    d.savings_goals.splice(idx, 1);
    save();
    return { data: true };
  }

  function addContribution(goalId, amount, type) {
    const d = load();
    const goal = d.savings_goals.find(g => g.id === goalId);
    if (!goal) return { error: 'Goal not found' };
    if (goal.is_completed) return { error: 'Goal already completed' };

    let num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return { error: 'Amount must be greater than 0' };

    const remaining = goal.target_amount - goal.saved_amount;
    if (num > remaining) num = remaining;

    const entry = {
      id: uuid(), device_id: d.device_id, goal_id: goalId,
      amount: Math.round(num * 100) / 100,
      type: type || 'manual',
      date: todayStr(), created_at: nowISO()
    };
    d.contributions.push(entry);
    goal.saved_amount = Math.round((goal.saved_amount + num) * 100) / 100;

    if (goal.saved_amount >= goal.target_amount) {
      goal.is_completed = true;
      goal.completed_at = nowISO();
    }
    save();
    return { data: entry, goalCompleted: goal.is_completed };
  }

  function saveLeftover(goalId) {
    const available = getAvailableBalance();
    if (available <= 0) return { error: 'No leftover to save' };
    return addContribution(goalId, available, 'leftover');
  }

  function getActiveGoals() {
    return load().savings_goals.filter(g => !g.is_completed);
  }

  function getCompletedGoals() {
    return load().savings_goals.filter(g => g.is_completed);
  }

  /* ---------- UTANG (DEBTS) ---------- */
  function getDebts() {
    return load().debts || [];
  }

  function addDebt(person, amount, type) {
    const d = load();
    if (!d.debts) d.debts = [];
    const trimmed = person.trim();
    if (!trimmed) return { error: 'Person name is required' };
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0 || num > 999999.99) return { error: 'Amount must be 0.01–999,999.99' };
    
    const debt = {
      id: uuid(), device_id: d.device_id,
      person: trimmed, amount: Math.round(num * 100) / 100,
      type: type, // 'owes_me' or 'owe_them'
      is_paid: false, date: todayStr(), created_at: nowISO()
    };
    d.debts.push(debt);
    save();
    return { data: debt };
  }

  function toggleDebtPaid(id) {
    const d = load();
    if (!d.debts) d.debts = [];
    const debt = d.debts.find(x => x.id === id);
    if (!debt) return { error: 'Debt not found' };
    
    debt.is_paid = !debt.is_paid;
    save();
    return { data: debt };
  }

  function deleteDebt(id) {
    const d = load();
    if (!d.debts) return { error: 'Debt not found' };
    const idx = d.debts.findIndex(x => x.id === id);
    if (idx === -1) return { error: 'Debt not found' };
    
    d.debts.splice(idx, 1);
    save();
    return { data: true };
  }

  function getDebtSummary() {
    const debts = getDebts();
    let owesMe = 0;
    let oweThem = 0;
    
    debts.filter(d => !d.is_paid).forEach(d => {
      if (d.type === 'owes_me') owesMe += d.amount;
      else if (d.type === 'owe_them') oweThem += d.amount;
    });
    
    return {
      owesMe: Math.round(owesMe * 100) / 100,
      oweThem: Math.round(oweThem * 100) / 100
    };
  }

  /* ---------- CHARTS/INSIGHTS DATA ---------- */
  function getCategoryBreakdown(filter) {
    const expenses = getExpenses(filter);
    const cats = load().categories;
    const map = {};
    expenses.forEach(e => {
      if (!map[e.category_id]) map[e.category_id] = 0;
      map[e.category_id] += e.amount;
    });
    const result = Object.entries(map)
      .map(([catId, total]) => {
        const cat = cats.find(c => c.id === catId);
        return { category: cat ? cat.name : 'Unknown', total: Math.round(total * 100) / 100 };
      })
      .sort((a, b) => b.total - a.total);
    return result;
  }

  function getDailySpendingTrend(days) {
    const d = load();
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = daysAgo(i);
      const spent = d.expenses.filter(e => e.date === date).reduce((s, e) => s + e.amount, 0);
      const budgeted = d.budgets.filter(b => b.date === date).reduce((s, b) => s + b.amount, 0);
      result.push({ date, spent: Math.round(spent * 100) / 100, budgeted: Math.round(budgeted * 100) / 100 });
    }
    return result;
  }

  function getSummaryStats() {
    const d = load();
    const totalExpenses = d.expenses.reduce((s, e) => s + e.amount, 0);
    const totalSaved = d.savings_goals.reduce((s, g) => s + g.saved_amount, 0);

    const breakdown = getCategoryBreakdown('all');
    const topCategory = breakdown.length > 0 ? breakdown[0].category : '—';

    return {
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalSaved: Math.round(totalSaved * 100) / 100,
      topCategory
    };
  }

  /* ---------- SETTINGS ---------- */
  function getTheme() { return load().settings.theme || 'system'; }
  function setTheme(theme) { load().settings.theme = theme; save(); }

  /* ---------- EXPORT ---------- */
  function getExportData(type, from, to) {
    const d = load();
    const cats = d.categories;
    const rows = [];

    if (type === 'expenses' || type === 'all') {
      const expenses = from && to
        ? d.expenses.filter(e => e.date >= from && e.date <= to)
        : d.expenses;
      expenses.forEach(e => {
        const cat = cats.find(c => c.id === e.category_id);
        rows.push({
          Date: e.date, Type: 'Expense',
          Category: cat ? cat.name : 'Unknown',
          Amount: e.amount, Note: e.note || '',
          Overspent: e.is_overspent ? 'Yes' : 'No'
        });
      });
    }

    rows.sort((a, b) => b.Date.localeCompare(a.Date));
    return rows;
  }

  /* ---------- CLEAR ALL ---------- */
  function clearAll() {
    _data = createDefault();
    save();
    return _data;
  }

  /* ---------- Public API ---------- */
  return {
    load, save, uuid, todayStr, nowISO, manilaDate, formatPeso, daysAgo, monthStart,
    getCategories, addCategory, renameCategory, archiveCategory,
    getBudgetsForDate, getTodayBudgets, addBudget, deleteBudget, getOpeningBalance, getAvailableBalance, getTodayAdded, getTodaySpent,
    addExpense, deleteExpense, getExpenses, getExpensesByDateRange,
    addGoal, deleteGoal, addContribution, saveLeftover, getActiveGoals, getCompletedGoals,
    getDebts, addDebt, toggleDebtPaid, deleteDebt, getDebtSummary,
    getCategoryBreakdown, getDailySpendingTrend, getSummaryStats,
    getTheme, setTheme,
    getExportData, clearAll, _saveRaw
  };
})();

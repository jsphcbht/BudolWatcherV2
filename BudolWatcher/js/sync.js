/* ============================================================
   BudolWatcher — Supabase Sync Layer (Optional)
   Handles pushing and pulling data to/from Supabase
   ============================================================ */

const Sync = (() => {
  // Replace these with actual Supabase project URL and anon key if deploying with sync.
  // For the local MVP demo, these are intentionally left empty or dummy.
  const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
  const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
  
  let supabase = null;
  let isSyncing = false;

  // Initialize Supabase client if the library is loaded and keys are provided
  function init() {
    if (window.supabase && SUPABASE_URL !== 'https://YOUR_PROJECT_REF.supabase.co') {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // Auto-sync when coming back online
      window.addEventListener('online', () => {
        console.log('Online: Triggering sync...');
        syncNow();
      });
      
      // Trigger initial pull delay
      setTimeout(syncNow, 2000);
    } else {
      console.log('Sync disabled: Supabase credentials not provided or library missing. Operating in local-only mode.');
    }
  }

  // Helper to get local data
  function getLocalData() {
    return Store.load();
  }

  async function pushDevice(deviceId) {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('devices').upsert({
        id: deviceId,
        device_fingerprint: deviceId, // For MVP identity
        last_seen_at: Store.nowISO()
      }, { onConflict: 'id' });
      if (error) console.error('Error pushing device:', error);
    } catch(e) { console.error('Device sync catch:', e); }
  }

  async function pushTable(tableName, items) {
    if (!supabase || !items || items.length === 0) return;
    try {
      // Upsert in batches of 100
      for (let i = 0; i < items.length; i += 100) {
        const batch = items.slice(i, i + 100);
        const { error } = await supabase.from(tableName).upsert(batch, { onConflict: 'id' });
        if (error) console.error(`Error pushing ${tableName}:`, error);
      }
    } catch(e) { console.error(`Push catch ${tableName}:`, e); }
  }

  async function pullTable(tableName, deviceId) {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('device_id', deviceId);
        
      if (error) {
        console.error(`Error pulling ${tableName}:`, error);
        return [];
      }
      return data || [];
    } catch(e) { 
      console.error(`Pull catch ${tableName}:`, e);
      return [];
    }
  }

  // Merge logic: Last write wins based on created_at or updated timestamps
  // For MVP simplicity, we assume local changes are always fresher if an offline write happened,
  // but a robust app would compare explicit 'updated_at' fields.
  function mergeArrays(localArr, remoteArr) {
    const map = new Map();
    // Prefer local first (since local handles the immediate UI)
    localArr.forEach(item => map.set(item.id, item));
    
    // Add remote if missing locally, or if remote is never than local (simplified)
    remoteArr.forEach(item => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      } else {
        const local = map.get(item.id);
        // Very basic tie-breaker for the demo
        if (item.completed_at && !local.completed_at) map.set(item.id, item);
        if (item.is_archived && !local.is_archived) map.set(item.id, item);
      }
    });
    return Array.from(map.values());
  }

  async function syncNow() {
    if (!supabase || !navigator.onLine || isSyncing) return;
    isSyncing = true;
    
    try {
      showSyncIndicator(true);
      const localData = getLocalData();
      const deviceId = localData.device_id;
      
      // 1. Ensure device exists remotely
      await pushDevice(deviceId);
      
      // 2. Pull remote data
      const [rCats, rBudgets, rExp, rGoals, rContr] = await Promise.all([
        pullTable('categories', deviceId),
        pullTable('budgets', deviceId),
        pullTable('expenses', deviceId),
        pullTable('savings_goals', deviceId),
        pullTable('contributions', deviceId)
      ]);
      
      // 3. Merge Local + Remote
      localData.categories = mergeArrays(localData.categories, rCats);
      localData.budgets = mergeArrays(localData.budgets, rBudgets);
      localData.expenses = mergeArrays(localData.expenses, rExp);
      localData.savings_goals = mergeArrays(localData.savings_goals, rGoals);
      localData.contributions = mergeArrays(localData.contributions, rContr);
      
      // Save merged to local immediately so UI can update
      Store._saveRaw(localData);
      
      // 4. Push Merged data back to remote to ensure full sync
      await Promise.all([
        pushTable('categories', localData.categories),
        pushTable('budgets', localData.budgets),
        pushTable('expenses', localData.expenses),
        pushTable('savings_goals', localData.savings_goals),
        pushTable('contributions', localData.contributions)
      ]);
      
      // Dispatch event to app to re-render
      window.dispatchEvent(new CustomEvent('sync-complete'));
      console.log('Sync completed successfully');
      
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      isSyncing = false;
      showSyncIndicator(false);
    }
  }

  function queueSync() {
    if (!supabase) return;
    // Debounce rapid saves
    clearTimeout(Sync._timer);
    Sync._timer = setTimeout(() => {
      if (navigator.onLine) syncNow();
    }, 1000);
  }

  // Visual feedback
  function showSyncIndicator(show) {
    let indicator = document.getElementById('syncIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'syncIndicator';
      indicator.innerHTML = '🔄';
      Object.assign(indicator.style, {
        position: 'fixed',
        top: '64px',
        right: '16px',
        background: 'var(--surface)',
        padding: '4px',
        borderRadius: '50%',
        boxShadow: 'var(--shadow)',
        zIndex: '200',
        fontSize: '12px',
        transition: 'opacity 0.3s',
        opacity: '0',
        pointerEvents: 'none'
      });
      
      const style = document.createElement('style');
      style.textContent = `@keyframes spin { 100% { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`;
      document.head.appendChild(style);
      
      document.body.appendChild(indicator);
    }
    
    if (show) {
      indicator.style.opacity = '1';
      indicator.classList.add('spin');
    } else {
      indicator.style.opacity = '0';
      setTimeout(() => indicator.classList.remove('spin'), 300);
    }
  }

  return { init, syncNow, queueSync };
})();

// Auto-init on load
document.addEventListener('DOMContentLoaded', Sync.init);

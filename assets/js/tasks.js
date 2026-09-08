/* tasks.js — 任務判定、計時與按鍵統計（兩版小舖共用） */
(function () {
  'use strict';
  const VERSION = window.Shop.version();
  const KEY = 'lab.' + VERSION;
  const LABEL = VERSION === 'good' ? '無障礙版' : '一般版';

  const TASKS = [
    { id: 'heading', title: '任務一：在首頁找到「本週特賣」這個區塊。提示：報讀軟體的使用者會按 H 鍵在標題之間跳躍，或用方向鍵往下讀。' },
    { id: 'cart', title: '任務二：用搜尋功能搜尋「耳機」，然後把「藍牙耳機 Pro」加入購物車。' },
    { id: 'dialog', title: '任務三：在搜尋結果頁打開「運費說明」，聽完後把它關掉。' },
    { id: 'order', title: '任務四：前往結帳，填寫姓名、電話，選擇配送方式，勾選同意條款，送出訂單。' },
  ];

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  let state = Object.assign({ startedAt: null, finishedAt: null, keys: 0, done: {} }, load());

  function speak(t, opts) { if (window.SRSim) window.SRSim.speak(t, opts); }
  function currentTask() { return TASKS.find(function (t) { return !state.done[t.id]; }); }
  function fmtTime(ms) {
    const s = Math.round(ms / 1000); const m = Math.floor(s / 60);
    return (m ? m + ' 分 ' : '') + (s % 60) + ' 秒';
  }

  function announceCurrent(interrupt) {
    const t = currentTask();
    if (t) speak('任務系統：' + t.title, { interrupt: interrupt });
    else speak('任務系統：本版任務已全部完成。' + summary(), { interrupt: interrupt });
  }
  function summary() {
    if (!state.finishedAt) return '';
    return '共花了 ' + fmtTime(state.finishedAt - state.startedAt) + '，按了 ' + state.keys + ' 次按鍵。';
  }

  function complete(id) {
    if (state.done[id]) return;
    const idx = TASKS.findIndex(function (t) { return t.id === id; });
    state.done[id] = Date.now();
    const next = currentTask();
    if (!next) state.finishedAt = Date.now();
    save(state);
    const n = ['一', '二', '三', '四'][idx];
    let msg = '任務系統：叮！任務' + n + '完成。';
    if (next) msg += '下一個，' + next.title;
    else msg += LABEL + '全部任務完成！' + summary() + ' 請睜開眼睛，告訴老師你完成了。';
    setTimeout(function () { speak(msg, { interrupt: false }); }, 400);
    document.dispatchEvent(new CustomEvent('lab:task', { detail: { id: id, state: state } }));
    render();
  }

  function reset() {
    state = { startedAt: null, finishedAt: null, keys: 0, done: {} };
    save(state);
    window.Shop.clearCart();
    render();
  }

  // 計時與按鍵
  document.addEventListener('keydown', function (e) {
    if (e.target instanceof Element && e.target.closest('#srsim-ui')) return;
    if (state.finishedAt) return;
    if (!state.startedAt) state.startedAt = Date.now();
    state.keys += 1;
    save(state);
    renderStats();
  }, true);

  // 任務一：游標或焦點到達「本週特賣」
  document.addEventListener('srsim:cursor', function (e) {
    const el = e.detail.el;
    const target = document.querySelector('[data-task="sale-heading"]');
    if (target && (el === target || target.contains(el) || el.contains(target))) complete('heading');
  });
  // 任務二：購物車含 bt-pro
  document.addEventListener('shop:cart', function (e) {
    if (e.detail.items.some(function (i) { return i.id === 'bt-pro'; })) complete('cart');
  });
  // 任務三：對話方塊開過又關掉
  let dialogOpened = false;
  document.addEventListener('shop:dialog', function (e) {
    if (e.detail.open) dialogOpened = true;
    else if (dialogOpened) complete('dialog');
  });
  // 任務四：訂單完成
  document.addEventListener('shop:order', function () { complete('order'); });

  // Ctrl+Alt+M 重聽任務
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'm') { e.preventDefault(); announceCurrent(true); }
  });

  // 頁面上的「重聽任務」按鈕與觀察者面板
  function render() {
    const btn = document.getElementById('task-replay');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () { announceCurrent(true); });
    }
    const panel = document.getElementById('task-panel');
    if (panel) {
      panel.innerHTML = '<div class="text-xs font-bold tracking-widest text-amber-600 mb-1">觀察者面板（' + LABEL + '）</div>' +
        '<ol class="space-y-1 text-sm">' + TASKS.map(function (t, i) {
          const d = state.done[t.id];
          return '<li class="' + (d ? 'text-emerald-700 line-through' : 'text-slate-700') + '">' + (d ? '✅' : '⬜') + ' ' + t.title.split('。')[0] + '</li>';
        }).join('') + '</ol>' +
        '<div id="task-stats" class="mt-2 text-sm text-slate-600"></div>' +
        '<button type="button" id="task-reset" tabindex="-1" class="mt-2 text-xs text-slate-500 underline">重置本版紀錄與購物車</button>';
      document.getElementById('task-reset').addEventListener('click', function () {
        if (confirm('確定要清除' + LABEL + '的任務紀錄、計時與購物車嗎？')) reset();
      });
      renderStats();
    }
  }
  function renderStats() {
    const el = document.getElementById('task-stats'); if (!el) return;
    const elapsed = state.startedAt ? fmtTime((state.finishedAt || Date.now()) - state.startedAt) : '尚未開始';
    el.textContent = '時間：' + elapsed + '　按鍵：' + state.keys + ' 次';
  }
  setInterval(renderStats, 1000);

  function init() {
    render();
    // 進入頁面後，先唸標題再唸目前任務
    setTimeout(function () { announceCurrent(false); }, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.LabTasks = { TASKS: TASKS, state: function () { return state; }, complete: complete, reset: reset, announceCurrent: announceCurrent };
})();

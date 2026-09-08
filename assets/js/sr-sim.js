/*
 * sr-sim.js — 報讀軟體模擬器（簡化版）
 * 以 Web Speech API 模擬螢幕報讀軟體（如 NVDA）的基本行為：
 *  - 焦點朗讀：名稱、角色、狀態、值
 *  - 瀏覽模式：↑↓ 逐段朗讀、H 標題、K 連結、B 按鈕、F 表單欄位、Enter 啟動
 *  - aria-live 動態訊息、打字回音、對話方塊與地標進入提示
 * 這不是 NVDA，只是讓同學「用耳朵理解網頁」的教學模擬。
 */
(function () {
  'use strict';

  const SETTINGS_KEY = 'srsim.settings';
  const defaults = { voice: '', rate: 1, echo: true, blindfold: false };
  const settings = Object.assign({}, defaults, loadSettings());

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /* 角色與名稱計算                                                       */
  /* ------------------------------------------------------------------ */
  const ROLE_ZH = {
    link: '連結', button: '按鈕', textbox: '編輯區', searchbox: '搜尋編輯區', checkbox: '核取方塊',
    radio: '選項按鈕', slider: '滑桿', combobox: '下拉方塊', listbox: '清單方塊', option: '選項',
    img: '圖形', heading: '標題', list: '清單', listitem: '清單項目', navigation: '導覽 地標',
    main: '主要內容 地標', banner: '橫幅 地標', contentinfo: '內容資訊 地標', complementary: '補充 地標',
    form: '表單 地標', search: '搜尋 地標', region: '區域 地標', dialog: '對話方塊',
    alertdialog: '警示對話方塊', table: '表格', group: '群組', status: '狀態', alert: '警示',
    tab: '頁籤', tabpanel: '頁籤面板', menu: '選單', menuitem: '選單項目', switch: '開關',
    progressbar: '進度列', separator: '分隔線', article: '文章', figure: '圖',
  };
  const LANDMARKS = ['navigation', 'main', 'banner', 'contentinfo', 'complementary', 'form', 'search', 'region'];
  const NAME_FROM_CONTENT = ['button', 'link', 'heading', 'option', 'tab', 'menuitem', 'checkbox', 'radio', 'switch', 'cell', 'columnheader', 'rowheader', 'tooltip', 'treeitem'];

  function roleOf(el) {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit.trim().split(/\s+/)[0];
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    switch (tag) {
      case 'a': return el.hasAttribute('href') ? 'link' : null;
      case 'button': return 'button';
      case 'summary': return 'button';
      case 'input':
        if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
        if (type === 'range') return 'slider';
        if (type === 'search') return 'searchbox';
        if (type === 'hidden') return null;
        return 'textbox';
      case 'textarea': return 'textbox';
      case 'select': return el.multiple ? 'listbox' : 'combobox';
      case 'option': return 'option';
      case 'img': return 'img';
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': return 'heading';
      case 'ul': case 'ol': return 'list';
      case 'li': return 'listitem';
      case 'nav': return 'navigation';
      case 'main': return 'main';
      case 'header': return el.closest('article,section,main,aside,nav') ? null : 'banner';
      case 'footer': return el.closest('article,section,main,aside,nav') ? null : 'contentinfo';
      case 'aside': return 'complementary';
      case 'form': return hasOwnLabel(el) ? 'form' : null;
      case 'section': return hasOwnLabel(el) ? 'region' : null;
      case 'dialog': return 'dialog';
      case 'table': return 'table';
      case 'fieldset': return 'group';
      case 'article': return 'article';
      case 'figure': return 'figure';
      case 'hr': return 'separator';
      case 'progress': return 'progressbar';
      case 'output': return 'status';
      default: return null;
    }
  }
  function hasOwnLabel(el) {
    return el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
  }

  function isHidden(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.closest('[aria-hidden="true"]')) return true;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return true;
    if (el.getClientRects().length === 0 && cs.position !== 'fixed') return true;
    return false;
  }

  // 由子內容計算文字（跳過 aria-hidden，圖片用 alt，子元素 aria-label 優先）
  function textOf(el) {
    let out = '';
    el.childNodes.forEach(function (n) {
      if (n.nodeType === 3) { out += n.textContent; return; }
      if (n.nodeType !== 1) return;
      if (n.getAttribute('aria-hidden') === 'true') return;
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const al = n.getAttribute('aria-label');
      if (al) { out += ' ' + al + ' '; return; }
      const tag = n.tagName.toLowerCase();
      if (tag === 'img') { out += ' ' + (n.hasAttribute('alt') ? n.getAttribute('alt') : imgFallbackName(n)) + ' '; return; }
      if (tag === 'svg') { const t = n.querySelector('title'); out += t ? ' ' + t.textContent + ' ' : ''; return; }
      if (tag === 'input' && (n.type === 'checkbox' || n.type === 'radio')) return;
      if (tag === 'input' || tag === 'textarea') { out += ' ' + (n.value || '') + ' '; return; }
      if (tag === 'select') { const o = n.selectedOptions[0]; out += o ? ' ' + o.textContent + ' ' : ''; return; }
      out += ' ' + textOf(n) + ' ';
    });
    return out.replace(/\s+/g, ' ').trim();
  }

  // 沒有 alt 的圖片：瀏覽器與報讀軟體常退而唸出檔名
  function imgFallbackName(img) {
    const src = (img.getAttribute('src') || '').split('/').pop().split('?')[0];
    return src.replace(/\.[a-z0-9]+$/i, '');
  }

  function accName(el) {
    const tag = el.tagName.toLowerCase();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb.split(/\s+/).map(function (id) {
        const r = document.getElementById(id); return r ? (r.getAttribute('aria-label') || textOf(r)) : '';
      }).join(' ').trim();
      if (t) return t;
    }
    const al = el.getAttribute('aria-label');
    if (al && al.trim()) return al.trim();

    if (tag === 'img' || (tag === 'input' && el.type === 'image')) {
      if (el.hasAttribute('alt')) return el.getAttribute('alt').trim();
    }
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      if (el.labels && el.labels.length) {
        const t = Array.prototype.map.call(el.labels, function (l) { return textOf(l); }).join(' ').replace(/\s+/g, ' ').trim();
        if (t) return t;
      }
      if (tag === 'input' && ['button', 'submit', 'reset'].includes(el.type)) {
        if (el.value) return el.value;
        return el.type === 'submit' ? '提交' : el.type === 'reset' ? '重設' : '';
      }
    }
    if (tag === 'fieldset') { const lg = el.querySelector(':scope > legend'); if (lg) return textOf(lg); }
    if (tag === 'table') { const c = el.querySelector(':scope > caption'); if (c) return textOf(c); }
    if (tag === 'figure') { const c = el.querySelector(':scope > figcaption'); if (c) return textOf(c); }
    if (tag === 'dialog' || tag === 'section' || tag === 'nav') {
      // 無 aria-label 的容器沒有名稱
    } else {
      const role = roleOf(el);
      if (NAME_FROM_CONTENT.includes(role) || tag === 'summary' || tag === 'label' || tag === 'legend' || tag === 'option') {
        const t = textOf(el); if (t) return t;
      }
    }
    const title = el.getAttribute('title');
    if (title && title.trim()) return title.trim();
    if (tag === 'input' || tag === 'textarea') {
      const p = el.getAttribute('placeholder'); if (p && p.trim()) return p.trim();
    }
    return '';
  }

  function accDescription(el) {
    const db = el.getAttribute('aria-describedby');
    if (!db) return '';
    return db.split(/\s+/).map(function (id) { const r = document.getElementById(id); return r ? textOf(r) : ''; }).join(' ').trim();
  }

  function isFocusable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.matches('[disabled]')) return false;
    if (el.matches('a[href],button,input:not([type="hidden"]),select,textarea,summary,[contenteditable="true"]')) return true;
    const ti = el.getAttribute('tabindex');
    return ti !== null && parseInt(ti, 10) >= 0;
  }
  function isEditable(el) {
    if (!el || el === document.body) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea' || tag === 'select') return true;
    if (tag === 'input') return !['button', 'submit', 'reset', 'checkbox', 'radio', 'image', 'range', 'file', 'color'].includes(el.type);
    return ['textbox', 'searchbox', 'combobox', 'listbox', 'menu', 'menubar', 'tree', 'grid', 'slider', 'spinbutton'].includes(el.getAttribute('role'));
  }

  function stateOf(el) {
    const parts = [];
    const role = roleOf(el);
    const tag = el.tagName.toLowerCase();
    if (role === 'checkbox' || role === 'switch') {
      const c = tag === 'input' ? el.checked : el.getAttribute('aria-checked') === 'true';
      const mixed = el.indeterminate || el.getAttribute('aria-checked') === 'mixed';
      parts.push(mixed ? '部分勾選' : c ? '已勾選' : '未勾選');
    }
    if (role === 'radio') {
      const c = tag === 'input' ? el.checked : el.getAttribute('aria-checked') === 'true';
      parts.push(c ? '已選取' : '未選取');
      if (tag === 'input' && el.name && el.form !== undefined) {
        const group = Array.prototype.filter.call(document.querySelectorAll('input[type="radio"][name="' + CSS.escape(el.name) + '"]'), function (r) { return !isHidden(r); });
        const idx = group.indexOf(el);
        if (idx >= 0 && group.length > 1) parts.push((idx + 1) + ' 之 ' + group.length);
      }
    }
    if (el.hasAttribute('aria-expanded')) parts.push(el.getAttribute('aria-expanded') === 'true' ? '已展開' : '已收合');
    if (tag === 'summary') { const d = el.closest('details'); if (d) parts.push(d.open ? '已展開' : '已收合'); }
    if (el.hasAttribute('aria-pressed')) parts.push(el.getAttribute('aria-pressed') === 'true' ? '已按下' : '未按下');
    if (el.hasAttribute('aria-selected') && role !== 'radio') parts.push(el.getAttribute('aria-selected') === 'true' ? '已選取' : '未選取');
    if (el.hasAttribute('aria-current') && el.getAttribute('aria-current') !== 'false') {
      parts.push(el.getAttribute('aria-current') === 'page' ? '目前頁面' : '目前');
    }
    if (el.hasAttribute('aria-haspopup') && el.getAttribute('aria-haspopup') !== 'false') parts.push('有子選單');
    if (el.matches('[disabled],[aria-disabled="true"]')) parts.push('無法使用');
    if (el.required || el.getAttribute('aria-required') === 'true') parts.push('必填');
    if (el.getAttribute('aria-invalid') === 'true') parts.push('輸入無效');
    if (tag === 'input' && el.readOnly) parts.push('唯讀');
    return parts;
  }

  function valueOf(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'select') { const o = el.selectedOptions[0]; return o ? o.textContent.trim() : ''; }
    if (tag === 'textarea') return el.value;
    if (tag === 'input') {
      if (['text', 'search', 'email', 'tel', 'url', 'number', 'password', 'date'].includes(el.type)) {
        return el.type === 'password' ? (el.value ? el.value.length + ' 個星號' : '') : el.value;
      }
      if (el.type === 'range') return el.value;
    }
    if (el.hasAttribute('aria-valuetext')) return el.getAttribute('aria-valuetext');
    if (el.hasAttribute('aria-valuenow')) return el.getAttribute('aria-valuenow');
    return '';
  }

  function headingLevel(el) {
    if (el.hasAttribute('aria-level')) return el.getAttribute('aria-level');
    const m = /^h([1-6])$/i.exec(el.tagName); return m ? m[1] : '2';
  }

  // 完整朗讀字串
  function describe(el, opts) {
    opts = opts || {};
    const role = roleOf(el);
    const tag = el.tagName.toLowerCase();
    const parts = [];
    const name = accName(el);

    if (role === 'heading') {
      parts.push('標題 第' + headingLevel(el) + '級');
      const inner = el.querySelector('a[href],button');
      if (inner && textOf(inner) === textOf(el)) parts.push(ROLE_ZH[roleOf(inner)]);
      parts.push(name || textOf(el));
    } else if (role === 'img') {
      if (el.hasAttribute('alt')) {
        parts.push('圖形'); if (name) parts.push(name);
      } else {
        // 沒有 alt：報讀軟體常會唸出檔名
        parts.push('圖形'); parts.push(imgFallbackName(el));
      }
    } else if (role === 'list') {
      const n = el.querySelectorAll(':scope > li, :scope > [role="listitem"]').length;
      parts.push('清單 有 ' + n + ' 個項目');
    } else if (['listitem', 'article', 'figure', 'group', 'region', 'cell', 'gridcell', 'paragraph', 'note'].includes(role)) {
      // 容器類角色：讀內容文字
      parts.push(opts.ownTextOnly ? ownText(el) : textOf(el));
    } else if (role && ROLE_ZH[role]) {
      if (name) parts.push(name);
      parts.push(ROLE_ZH[role]);
      const st = stateOf(el); if (st.length) parts.push(st.join(' '));
      const v = valueOf(el); if (v) parts.push(v);
      if (!name && !v && ['textbox', 'searchbox'].includes(role)) parts.push('空白');
    } else {
      // 純文字段落
      const t = opts.ownTextOnly ? ownText(el) : textOf(el);
      parts.push(t);
    }
    const d = accDescription(el); if (d) parts.push(d);
    return parts.filter(Boolean).join('，').replace(/\s+/g, ' ');
  }

  // 段落文字：自己的文字節點 + 行內（inline）非互動子元素；區塊與互動子元素各自成為獨立單位
  function isInlineEl(el) {
    const d = getComputedStyle(el).display;
    return d === 'inline' || d === 'inline-block' || d === 'inline-flex' || d === 'inline-grid' || d === 'contents';
  }
  function isOwnUnitEl(el) {
    const role = roleOf(el);
    return isFocusable(el) || role === 'img' || role === 'heading' || el.matches('a[href],button,input,select,textarea,summary,[role="button"],[role="link"]');
  }
  function ownText(el) {
    let out = '';
    el.childNodes.forEach(function (n) {
      if (n.nodeType === 3) { out += n.textContent; return; }
      if (n.nodeType !== 1) return;
      if (n.getAttribute('aria-hidden') === 'true') return;
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (isOwnUnitEl(n) || !isInlineEl(n)) return;
      const al = n.getAttribute('aria-label');
      out += ' ' + (al || ownText(n)) + ' ';
    });
    return out.replace(/\s+/g, ' ').trim();
  }

  /* ------------------------------------------------------------------ */
  /* 語音                                                                 */
  /* ------------------------------------------------------------------ */
  const synth = window.speechSynthesis;
  let voices = [];
  let currentVoice = null;
  let speakToken = 0;
  let needGesture = false;
  let lastSpoken = '';
  const pendingBeforeGesture = [];

  function refreshVoices() {
    if (!synth) return;
    voices = synth.getVoices();
    currentVoice = pickVoice();
    renderVoiceOptions();
    updateVoiceStatus();
  }
  function pickVoice() {
    if (!voices.length) return null;
    if (settings.voice) { const v = voices.find(function (x) { return x.name === settings.voice; }); if (v) return v; }
    const norm = function (l) { return (l || '').toLowerCase().replace('_', '-'); };
    const pref = ['zh-tw', 'zh-hant', 'cmn-hant', 'zh-hk', 'zh-cn', 'zh', 'cmn'];
    for (const p of pref) {
      const v = voices.find(function (x) { return norm(x.lang).startsWith(p); });
      if (v) return v;
    }
    return null;
  }
  function hasChineseVoice() {
    return !!(currentVoice && /^(zh|cmn)/i.test(currentVoice.lang.replace('_', '-')));
  }

  function chunk(text) {
    const out = []; let s = text;
    while (s.length > 120) {
      let cut = s.lastIndexOf('，', 120); if (cut < 40) cut = s.lastIndexOf(' ', 120); if (cut < 40) cut = 120;
      out.push(s.slice(0, cut)); s = s.slice(cut).replace(/^[，\s]+/, '');
    }
    if (s) out.push(s);
    return out;
  }

  function speak(text, opts) {
    opts = opts || {};
    text = (text || '').trim();
    if (!text) return;
    lastSpoken = text;
    caption(text);
    document.dispatchEvent(new CustomEvent('srsim:speak', { detail: { text: text } }));
    if (!synth) return;
    if (needGesture) { if (opts.interrupt !== false) pendingBeforeGesture.length = 0; pendingBeforeGesture.push(text); return; }
    const token = ++speakToken;
    const go = function () {
      if (token !== speakToken) return;
      chunk(text).forEach(function (c) {
        const u = new SpeechSynthesisUtterance(c);
        if (currentVoice) { u.voice = currentVoice; u.lang = currentVoice.lang; } else { u.lang = 'zh-TW'; }
        u.rate = settings.rate;
        u.onerror = function (e) {
          if (e.error === 'not-allowed') { needGesture = true; pendingBeforeGesture.push(text); showGestureHint(true); }
        };
        synth.speak(u);
      });
    };
    if (opts.interrupt === false) { go(); } else { synth.cancel(); setTimeout(go, 30); }
  }
  function stop() { if (synth) synth.cancel(); }

  function unlockByGesture() {
    if (!needGesture) return;
    needGesture = false; showGestureHint(false);
    const q = pendingBeforeGesture.splice(0);
    q.forEach(function (t, i) { speak(t, { interrupt: i === 0 }); });
  }

  /* ------------------------------------------------------------------ */
  /* 瀏覽模式（虛擬游標）                                                 */
  /* ------------------------------------------------------------------ */
  let cursorEl = null;
  let lastContext = { dialog: null, landmark: null, list: null };

  function isUnit(el) {
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'template', 'br', 'hr', 'option'].includes(tag)) return false;
    const role = roleOf(el);
    // 已由父層互動元素代表
    const interactiveAncestor = el.parentElement && el.parentElement.closest('a[href],button,summary,[role="button"],[role="link"],[role="option"],[role="menuitem"],[role="tab"]');
    if (interactiveAncestor && interactiveAncestor !== el) return false;
    if (isFocusable(el)) {
      // 標題內唯一的連結由標題代表
      const h = el.closest('h1,h2,h3,h4,h5,h6');
      if (h && textOf(h) === textOf(el)) return false;
      if (tag === 'input' && el.type === 'hidden') return false;
      return true;
    }
    if (role === 'img') return el.getAttribute('alt') !== '';
    if (role === 'heading') return true;
    if (tag === 'label' && el.control) return false;
    if (tag === 'legend') return true;
    if (isInlineEl(el) && el.parentElement && el.parentElement !== document.body) return false;
    if (ownText(el)) return true;
    return false;
  }

  function collectUnits() {
    const units = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (n) {
        if (n.id === 'srsim-ui' || n.closest('#srsim-ui')) return NodeFilter.FILTER_REJECT;
        const tag = n.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'template'].includes(tag)) return NodeFilter.FILTER_REJECT;
        if (n.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
        if (tag === 'dialog' && !n.open) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) { if (isUnit(n)) units.push(n); }
    // 開啟中的 modal 對話方塊：其餘內容視為不可及
    const modal = document.querySelector('dialog[open]:modal, dialog[open]');
    if (modal && modal.matches(':modal')) return units.filter(function (u) { return modal.contains(u); });
    return units;
  }

  function contextAnnouncements(el) {
    const out = [];
    const dlg = el.closest('dialog,[role="dialog"],[role="alertdialog"]');
    if (dlg !== lastContext.dialog) {
      if (dlg) out.push((accName(dlg) ? accName(dlg) + '，' : '') + (ROLE_ZH[roleOf(dlg)] || '對話方塊'));
      lastContext.dialog = dlg;
    }
    let lm = null, p = el;
    while (p && p !== document.body) { const r = roleOf(p); if (r && LANDMARKS.includes(r)) { lm = p; break; } p = p.parentElement; }
    if (lm !== lastContext.landmark) {
      if (lm) out.push((accName(lm) ? accName(lm) + '，' : '') + ROLE_ZH[roleOf(lm)]);
      lastContext.landmark = lm;
    }
    const list = el.closest('ul,ol,[role="list"]');
    if (list !== lastContext.list) {
      if (list) out.push(describe(list));
      else if (lastContext.list) out.push('離開清單');
      lastContext.list = list;
    }
    return out;
  }

  function setCursor(el, opts) {
    opts = opts || {};
    if (cursorEl) cursorEl.classList.remove('srsim-cursor');
    cursorEl = el;
    if (!el) return;
    el.classList.add('srsim-cursor');
    if (opts.scroll !== false) { try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { /* ignore */ } }
    document.dispatchEvent(new CustomEvent('srsim:cursor', { detail: { el: el, source: opts.source || 'browse' } }));
  }

  function moveCursor(dir, filter, label) {
    const units = collectUnits();
    if (!units.length) return;
    let idx = cursorEl ? units.indexOf(cursorEl) : -1;
    if (idx === -1 && cursorEl) {
      // 游標元素已不存在，找文件順序中最接近的
      idx = units.findIndex(function (u) { return cursorEl.compareDocumentPosition(u) & Node.DOCUMENT_POSITION_FOLLOWING; });
      if (idx === -1) idx = units.length; if (dir > 0) idx -= 1;
    }
    let i = idx;
    for (;;) {
      i += dir;
      if (i < 0 || i >= units.length) {
        speak(label ? '沒有更多' + label : (dir > 0 ? '文件結尾' : '文件開頭'));
        return;
      }
      if (!filter || filter(units[i])) break;
    }
    const el = units[i];
    setCursor(el);
    const ctx = contextAnnouncements(el);
    speak(ctx.concat([describe(el, { ownTextOnly: true })]).join('，'));
  }

  function activateCursor() {
    if (!cursorEl) return false;
    let target = cursorEl;
    if (!isFocusable(target)) {
      const inner = target.querySelector('a[href],button,input,select,textarea,summary,[tabindex]');
      if (inner && roleOf(target) === 'heading') target = inner;
    }
    if (isFocusable(target)) {
      target.focus({ preventScroll: false });
      if (target.matches('input[type="text"],input[type="search"],input[type="email"],input[type="tel"],textarea,select')) {
        return true; // 進入編輯（表單模式），不再 click
      }
      target.click();
      return true;
    }
    // 非可聚焦元素：模擬 NVDA 在虛擬游標位置點擊
    target.click();
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* 事件                                                                 */
  /* ------------------------------------------------------------------ */
  let lastFocused = null;

  document.addEventListener('focusin', function (e) {
    const el = e.target;
    if (!(el instanceof Element) || el.closest('#srsim-ui')) return;
    lastFocused = el;
    setCursor(el, { source: 'focus', scroll: false });
    const ctx = contextAnnouncements(el);
    let text = describe(el);
    if (isEditable(el)) text += '，編輯模式';
    speak(ctx.concat([text]).join('，'));
  });

  document.addEventListener('keydown', function (e) {
    unlockByGesture();
    if (e.target instanceof Element && e.target.closest('#srsim-ui')) return;
    const active = document.activeElement;
    const editing = isEditable(active);

    // Ctrl 單獨按下：停止朗讀（NVDA 習慣）
    if (e.key === 'Control' && !e.altKey && !e.shiftKey) { stop(); return; }

    if (e.ctrlKey && e.altKey && !e.shiftKey) {
      if (e.key.toLowerCase() === 't') { e.preventDefault(); speak(document.title + '，頁面'); return; }
      if (e.key.toLowerCase() === 'r') { e.preventDefault(); speak(lastSpoken); return; }
      if (e.key.toLowerCase() === 'b') { e.preventDefault(); toggleBlindfold(); return; }
      return;
    }

    if (editing) {
      // 編輯模式：Esc 離開回到瀏覽模式（不在對話方塊內時）
      if (e.key === 'Escape' && !active.closest('dialog[open]')) {
        e.preventDefault(); active.blur(); speak('瀏覽模式');
      }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const k = e.key;
    // 選項按鈕、滑桿等本身就用方向鍵操作的控制項：交給瀏覽器
    if (k.startsWith('Arrow') && active && (active.matches('input[type="radio"],input[type="range"],[role="radio"],[role="tab"],[role="option"],[role="menuitem"],[role="slider"]'))) return;
    if (k === 'ArrowDown') { e.preventDefault(); moveCursor(1); return; }
    if (k === 'ArrowUp') { e.preventDefault(); moveCursor(-1); return; }
    const dir = e.shiftKey ? -1 : 1;
    const lk = k.toLowerCase();
    if (lk === 'h') { e.preventDefault(); moveCursor(dir, function (u) { return roleOf(u) === 'heading'; }, '標題'); return; }
    if (lk === 'k') { e.preventDefault(); moveCursor(dir, function (u) { return roleOf(u) === 'link'; }, '連結'); return; }
    if (lk === 'b') { e.preventDefault(); moveCursor(dir, function (u) { return roleOf(u) === 'button'; }, '按鈕'); return; }
    if (lk === 'f') { e.preventDefault(); moveCursor(dir, function (u) { return ['textbox', 'searchbox', 'checkbox', 'radio', 'combobox', 'listbox', 'slider', 'button'].includes(roleOf(u)); }, '表單欄位'); return; }
    if (lk === 'g') { e.preventDefault(); moveCursor(dir, function (u) { return roleOf(u) === 'img'; }, '圖形'); return; }
    if (/^[1-6]$/.test(k)) { e.preventDefault(); moveCursor(dir, function (u) { return roleOf(u) === 'heading' && headingLevel(u) === k; }, '第' + k + '級標題'); return; }
    if (k === 'Enter') {
      // 游標就在焦點元素上：交給瀏覽器原生行為
      if (cursorEl && cursorEl === active) return;
      if (cursorEl) { e.preventDefault(); activateCursor(); }
    }
  }, true);

  document.addEventListener('pointerdown', unlockByGesture, true);

  // 打字回音
  document.addEventListener('input', function (e) {
    const el = e.target;
    if (!(el instanceof Element) || el.closest('#srsim-ui')) return;
    if (!settings.echo) return;
    if (!isEditable(el) || el.tagName === 'SELECT') return;
    if (e.inputType && e.inputType.startsWith('insertText') && e.data) {
      speak(e.data.length === 1 && e.data === ' ' ? '空格' : e.data);
    } else if (e.inputType && e.inputType.startsWith('delete')) {
      speak('刪除');
    }
  });

  document.addEventListener('change', function (e) {
    const el = e.target;
    if (!(el instanceof Element) || el.closest('#srsim-ui')) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'select') { speak(valueOf(el)); return; }
    if (tag === 'input' && el.type === 'checkbox') { speak(el.checked ? '已勾選' : '未勾選'); return; }
    if (tag === 'input' && el.type === 'radio') { speak(accName(el) + '，選項按鈕，已選取'); }
  });

  // 由腳本改變的 aria-checked / aria-expanded
  const attrObserver = new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      const el = m.target;
      if (!(el instanceof Element) || el !== document.activeElement) return;
      if (m.attributeName === 'aria-checked') speak(stateOf(el).join(' '));
      if (m.attributeName === 'aria-expanded') speak(el.getAttribute('aria-expanded') === 'true' ? '已展開' : '已收合');
      if (m.attributeName === 'aria-pressed') speak(el.getAttribute('aria-pressed') === 'true' ? '已按下' : '未按下');
    });
  });

  // aria-live
  const liveQueue = new Map();
  let liveTimer = null;
  const liveObserver = new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      let t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (!t) return;
      const region = t.closest('[aria-live]:not([aria-live="off"]),[role="status"],[role="alert"],[role="log"],output');
      if (!region || region.closest('#srsim-ui')) return;
      liveQueue.set(region, true);
    });
    if (liveQueue.size) {
      clearTimeout(liveTimer);
      liveTimer = setTimeout(function () {
        liveQueue.forEach(function (_, region) {
          const text = textOf(region);
          if (!text) return;
          const assertive = region.getAttribute('aria-live') === 'assertive' || region.getAttribute('role') === 'alert';
          speak(text, { interrupt: assertive });
        });
        liveQueue.clear();
      }, 120);
    }
  });

  /* ------------------------------------------------------------------ */
  /* 介面：字幕列、設定、黑幕                                             */
  /* ------------------------------------------------------------------ */
  const css = '\n#srsim-ui{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;font-family:system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;color:#f8fafc}\n#srsim-bar{background:#0f172a;border-top:3px solid #f59e0b;padding:.6rem 1rem;display:flex;gap:1rem;align-items:center;min-height:64px;box-shadow:0 -4px 20px rgba(0,0,0,.25)}\n#srsim-bar .srsim-cap{flex:1;min-width:0}\n#srsim-bar .srsim-now{font-size:1.15rem;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n#srsim-bar .srsim-prev{font-size:.8rem;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n#srsim-bar .srsim-tag{font-size:.7rem;letter-spacing:.1em;color:#f59e0b;font-weight:700;white-space:nowrap}\n#srsim-bar button{background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:.5rem;padding:.4rem .7rem;font-size:.85rem;cursor:pointer;white-space:nowrap}\n#srsim-bar button:hover{background:#334155}\n#srsim-bar button.on{background:#f59e0b;color:#0f172a;border-color:#f59e0b}\n#srsim-panel{position:fixed;right:1rem;bottom:84px;width:min(380px,calc(100vw - 2rem));background:#0f172a;border:1px solid #334155;border-radius:.75rem;padding:1rem;font-size:.9rem;display:none;box-shadow:0 10px 40px rgba(0,0,0,.4)}\n#srsim-panel.open{display:block}\n#srsim-panel h3{margin:0 0 .6rem;font-size:1rem;color:#f59e0b}\n#srsim-panel label{display:block;margin:.5rem 0 .2rem;color:#cbd5e1}\n#srsim-panel select,#srsim-panel input[type=range]{width:100%}\n#srsim-panel select{background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:.4rem;padding:.35rem}\n#srsim-panel .row{display:flex;gap:.5rem;align-items:center;margin-top:.6rem}\n#srsim-panel .row button{flex:1}\n#srsim-panel button{background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:.5rem;padding:.4rem .7rem;cursor:pointer}\n#srsim-panel .warn{background:#7c2d12;color:#fed7aa;padding:.5rem .6rem;border-radius:.4rem;margin-top:.6rem;line-height:1.4}\n#srsim-panel .ok{color:#86efac;margin-top:.4rem}\n#srsim-panel kbd{background:#1e293b;border:1px solid #475569;border-radius:.3rem;padding:0 .35rem;font-family:inherit}\n#srsim-panel table{width:100%;border-collapse:collapse}\n#srsim-panel td{padding:.2rem .3rem;border-bottom:1px solid #1e293b;vertical-align:top}\n#srsim-blind{position:fixed;inset:0;bottom:64px;background:#000;z-index:2147482999;display:none;color:#334155;align-items:center;justify-content:center;font-size:1.5rem;letter-spacing:.2em}\n#srsim-blind.on{display:flex}\n#srsim-hint{position:fixed;left:50%;top:1rem;transform:translateX(-50%);background:#f59e0b;color:#0f172a;padding:.6rem 1.2rem;border-radius:999px;font-weight:700;z-index:2147483001;display:none;box-shadow:0 4px 16px rgba(0,0,0,.3)}\n#srsim-hint.on{display:block}\n.srsim-cursor{outline:3px dashed #f59e0b !important;outline-offset:3px !important;box-shadow:0 0 0 6px rgba(245,158,11,.25) !important}\nbody{padding-bottom:80px !important}\n';

  function buildUI() {
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    const ui = document.createElement('div');
    ui.id = 'srsim-ui'; ui.setAttribute('aria-hidden', 'true');
    ui.innerHTML =
      '<div id="srsim-blind">黑幕模式（閉眼中）</div>' +
      '<div id="srsim-hint">請按任意鍵（例如 Tab）開始朗讀</div>' +
      '<div id="srsim-panel">' +
        '<h3>報讀模擬器設定</h3>' +
        '<label>語音</label><select id="srsim-voice"></select>' +
        '<div id="srsim-vstatus"></div>' +
        '<label>語速：<span id="srsim-rate-v"></span></label><input id="srsim-rate" type="range" min="0.6" max="2" step="0.1">' +
        '<label><input id="srsim-echo" type="checkbox"> 打字回音（每打一個字就唸）</label>' +
        '<div class="row"><button id="srsim-test" type="button">測試語音</button><button id="srsim-help" type="button">按鍵說明</button></div>' +
        '<div id="srsim-keys" style="display:none;margin-top:.6rem"><table>' +
          '<tr><td><kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd></td><td>下一個／上一個可操作元素</td></tr>' +
          '<tr><td><kbd>↓</kbd> / <kbd>↑</kbd></td><td>逐段朗讀（瀏覽模式）</td></tr>' +
          '<tr><td><kbd>H</kbd> / <kbd>1</kbd>～<kbd>6</kbd></td><td>下一個標題／指定層級標題</td></tr>' +
          '<tr><td><kbd>K</kbd> <kbd>B</kbd> <kbd>F</kbd> <kbd>G</kbd></td><td>下一個連結／按鈕／表單欄位／圖形（加 Shift 往上）</td></tr>' +
          '<tr><td><kbd>Enter</kbd></td><td>啟動游標所在元素</td></tr>' +
          '<tr><td><kbd>Space</kbd></td><td>勾選／按下（在焦點上）</td></tr>' +
          '<tr><td><kbd>Esc</kbd></td><td>離開輸入框回到瀏覽模式；關閉對話方塊</td></tr>' +
          '<tr><td><kbd>Ctrl</kbd></td><td>停止朗讀</td></tr>' +
          '<tr><td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd></td><td>唸出頁面標題</td></tr>' +
          '<tr><td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>R</kbd></td><td>重唸上一句</td></tr>' +
          '<tr><td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd></td><td>黑幕開關</td></tr>' +
        '</table></div>' +
      '</div>' +
      '<div id="srsim-bar">' +
        '<div class="srsim-tag">🔊 報讀<br>模擬</div>' +
        '<div class="srsim-cap"><div class="srsim-now" id="srsim-now">（尚未朗讀）</div><div class="srsim-prev" id="srsim-prev"></div></div>' +
        '<button id="srsim-blind-btn" type="button" title="Ctrl+Alt+B">🕶 黑幕</button>' +
        '<button id="srsim-settings-btn" type="button">⚙ 設定</button>' +
      '</div>';
    document.body.appendChild(ui);
    ui.querySelectorAll('button,select,input').forEach(function (b) { b.tabIndex = -1; });

    const $ = function (id) { return document.getElementById(id); };
    $('srsim-settings-btn').addEventListener('click', function () { $('srsim-panel').classList.toggle('open'); });
    $('srsim-help').addEventListener('click', function () { const k = $('srsim-keys'); k.style.display = k.style.display === 'none' ? 'block' : 'none'; });
    $('srsim-blind-btn').addEventListener('click', toggleBlindfold);
    $('srsim-test').addEventListener('click', function () { unlockByGesture(); speak('你好，這是報讀模擬器的測試語音。搜尋，編輯區，空白。'); });
    $('srsim-voice').addEventListener('change', function (e) { settings.voice = e.target.value; saveSettings(); currentVoice = pickVoice(); updateVoiceStatus(); speak('已切換語音'); });
    const rate = $('srsim-rate'); rate.value = settings.rate; $('srsim-rate-v').textContent = settings.rate + 'x';
    rate.addEventListener('input', function (e) { settings.rate = parseFloat(e.target.value); $('srsim-rate-v').textContent = settings.rate + 'x'; saveSettings(); });
    rate.addEventListener('change', function () { speak('語速 ' + settings.rate); });
    const echo = $('srsim-echo'); echo.checked = settings.echo;
    echo.addEventListener('change', function (e) { settings.echo = e.target.checked; saveSettings(); });
    if (settings.blindfold) applyBlindfold();
    renderVoiceOptions(); updateVoiceStatus();
  }

  function renderVoiceOptions() {
    const sel = document.getElementById('srsim-voice'); if (!sel) return;
    sel.innerHTML = '';
    if (!voices.length) { sel.innerHTML = '<option value="">（載入中或此瀏覽器無語音）</option>'; return; }
    const auto = document.createElement('option'); auto.value = ''; auto.textContent = '自動（優先 zh-TW）'; sel.appendChild(auto);
    voices.slice().sort(function (a, b) { return (/^zh/i.test(b.lang) ? 1 : 0) - (/^zh/i.test(a.lang) ? 1 : 0); }).forEach(function (v) {
      const o = document.createElement('option'); o.value = v.name; o.textContent = v.name + ' (' + v.lang + ')'; if (v.name === settings.voice) o.selected = true; sel.appendChild(o);
    });
  }
  function updateVoiceStatus() {
    const el = document.getElementById('srsim-vstatus'); if (!el) return;
    if (!synth) { el.innerHTML = '<div class="warn">此瀏覽器不支援語音合成，只會顯示字幕。請改用 Chrome 或 Edge。</div>'; return; }
    if (!voices.length) { el.innerHTML = ''; return; }
    if (hasChineseVoice()) { el.innerHTML = '<div class="ok">目前語音：' + currentVoice.name + ' (' + currentVoice.lang + ')</div>'; }
    else { el.innerHTML = '<div class="warn">找不到中文語音。Windows 請到「設定 → 時間與語言 → 語音」新增「中文（台灣）」，或改用 Edge 瀏覽器（內建線上中文語音）。macOS 請到「系統設定 → 輔助使用 → 朗讀內容 → 系統語音」下載中文語音。</div>'; }
  }
  function caption(text) {
    const now = document.getElementById('srsim-now'); const prev = document.getElementById('srsim-prev');
    if (!now) return;
    if (now.textContent && now.textContent !== '（尚未朗讀）') prev.textContent = now.textContent;
    now.textContent = text;
  }
  function showGestureHint(on) { const h = document.getElementById('srsim-hint'); if (h) h.classList.toggle('on', !!on); }
  function toggleBlindfold() { settings.blindfold = !settings.blindfold; saveSettings(); applyBlindfold(); speak(settings.blindfold ? '黑幕已開啟' : '黑幕已關閉'); }
  function applyBlindfold() {
    const b = document.getElementById('srsim-blind'); const btn = document.getElementById('srsim-blind-btn');
    if (b) b.classList.toggle('on', settings.blindfold); if (btn) btn.classList.toggle('on', settings.blindfold);
  }

  /* ------------------------------------------------------------------ */
  /* 啟動                                                                 */
  /* ------------------------------------------------------------------ */
  function init() {
    buildUI();
    if (synth) {
      refreshVoices();
      synth.addEventListener('voiceschanged', refreshVoices);
    }
    liveObserver.observe(document.body, { childList: true, characterData: true, subtree: true });
    attrObserver.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['aria-checked', 'aria-expanded', 'aria-pressed'] });
    // 頁面載入朗讀標題
    setTimeout(function () {
      if (document.activeElement && document.activeElement !== document.body) return; // 已有焦點者由 focusin 處理
      speak(document.title + '，頁面');
    }, 150);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.SRSim = {
    speak: speak, stop: stop, describe: describe, accName: accName, roleOf: roleOf,
    settings: settings, get cursor() { return cursorEl; }, get voice() { return currentVoice; }, hasChineseVoice: hasChineseVoice, setCursor: setCursor, collectUnits: collectUnits,
  };
})();

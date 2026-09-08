/* shop.js — 兩版「小舖」共用的商品資料與購物車（純前端、localStorage） */
(function () {
  'use strict';
  const PRODUCTS = [
    { id: 'bt-pro', name: '藍牙耳機 Pro', price: 2990, tags: ['耳機', '藍牙', '無線'], img: 'DSC_0417.svg', desc: '主動降噪，續航 30 小時。' },
    { id: 'wired-lite', name: '有線耳機 Lite', price: 590, tags: ['耳機', '有線'], img: 'DSC_0418.svg', desc: '3.5mm 接頭，附麥克風。' },
    { id: 'anc-over', name: '降噪耳罩式耳機', price: 4990, tags: ['耳機', '藍牙', '降噪'], img: 'DSC_0419.svg', desc: '耳罩式設計，長時間配戴舒適。' },
    { id: 'bottle', name: '不鏽鋼保溫瓶', price: 890, tags: ['生活', '保溫'], img: 'DSC_0420.svg', desc: '500ml，保溫 12 小時。' },
    { id: 'notebook', name: '方格筆記本', price: 180, tags: ['文具'], img: 'DSC_0421.svg', desc: 'A5，160 頁。' },
    { id: 'tote', name: '帆布袋', price: 450, tags: ['生活', '袋'], img: 'DSC_0422.svg', desc: '厚磅帆布，可機洗。' },
  ];

  function version() {
    return /\/lab\/bad\//.test(location.pathname) ? 'bad' : 'good';
  }
  const cartKey = function () { return 'shop.cart.' + version(); };

  function getCart() {
    try { return JSON.parse(localStorage.getItem(cartKey())) || []; } catch (e) { return []; }
  }
  function setCart(items) {
    localStorage.setItem(cartKey(), JSON.stringify(items));
    document.dispatchEvent(new CustomEvent('shop:cart', { detail: { items: items } }));
  }
  function addToCart(id) {
    const items = getCart();
    const found = items.find(function (i) { return i.id === id; });
    if (found) found.qty += 1; else items.push({ id: id, qty: 1 });
    setCart(items);
    return items;
  }
  function cartCount() { return getCart().reduce(function (n, i) { return n + i.qty; }, 0); }
  function clearCart() { setCart([]); }

  function search(q) {
    q = (q || '').trim();
    if (!q) return PRODUCTS.slice();
    return PRODUCTS.filter(function (p) {
      return p.name.includes(q) || p.tags.some(function (t) { return q.includes(t) || t.includes(q); });
    });
  }
  function byId(id) { return PRODUCTS.find(function (p) { return p.id === id; }); }
  function money(n) { return 'NT$ ' + n.toLocaleString('zh-TW'); }
  function query(name) { return new URLSearchParams(location.search).get(name) || ''; }

  window.Shop = { PRODUCTS: PRODUCTS, version: version, getCart: getCart, addToCart: addToCart, cartCount: cartCount, clearCart: clearCart, search: search, byId: byId, money: money, query: query };
})();

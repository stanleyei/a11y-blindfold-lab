/* icons.js — 網站共用的內嵌 SVG 圖示（預設為裝飾性） */
(function () {
  'use strict';

  var paths = {
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    blindfold: '<path d="M3 12c2.5-3 5.5-4.5 9-4.5s6.5 1.5 9 4.5c-2.5 3-5.5 4.5-9 4.5S5.5 15 3 12Z"/><path d="m4 4 16 16"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/>',
    warning: '<path d="M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    volume: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6"/><path d="M18 6a8 8 0 0 1 0 12"/>',
    tag: '<path d="M20 13 13 20l-9-9V4h7l9 9Z"/><circle cx="8.5" cy="8.5" r="1.5"/>',
    megaphone: '<path d="m3 11 14-6v14L3 13v-2Z"/><path d="M7 14v5a2 2 0 0 0 2 2h2l-1-6"/><path d="M20 9v6"/>',
    celebration: '<path d="m4 20 5-14 9 9-14 5Z"/><path d="m7 15 2 2"/><path d="M14 4V2"/><path d="m18 7 2-2"/><path d="M20 12h2"/>',
    'square-empty': '<rect x="4" y="4" width="16" height="16" rx="3"/>',
    'square-check': '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 2.7 2.7L16.5 9"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>'
  };

  function svg(name, className) {
    if (!paths[name]) return '';
    return '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + (className || '') + '" style="width:1em;height:1em;display:inline-block;vertical-align:-0.125em;flex:none">' + paths[name] + '</svg>';
  }

  function hydrate(root) {
    (root || document).querySelectorAll('[data-site-icon]').forEach(function (el) {
      el.innerHTML = svg(el.getAttribute('data-site-icon'), el.getAttribute('data-icon-class') || '');
    });
  }

  window.SiteIcons = { svg: svg, hydrate: hydrate };
  document.addEventListener('DOMContentLoaded', function () { hydrate(document); });
})();

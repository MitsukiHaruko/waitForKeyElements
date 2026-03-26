// ==UserScript==
// @name         GAZELL3D
// @namespace    https://github.com/anonymoize/GAZELL3D/
// @version      1.9.8.1
// @description  Reimagine UNIT3D-based torrent pages for readability with a two-column layout, richer metadata presentation, cleaner torrent naming, and minor quality-of-life tweaks.
// @match        https://aither.cc/torrents/*
// @match        https://aither.cc/torrents*
// @updateURL    https://mitsukiharuko.github.io/waitForKeyElements/GAZELL3D.user.js
// @downloadURL  https://mitsukiharuko.github.io/waitForKeyElements/GAZELL3D.user.js
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      raw.githubusercontent.com
// @connect      aither.cc
// @icon         https://aither.cc/favicon.ico
// ==/UserScript==

(function () {
  'use strict';

document.addEventListener('readystatechange', () => {
  if (document.readyState === 'interactive') document.documentElement.style.visibility = 'visible';
});

const SELECTOR = 'tr[data-gz-sync-id]';
const STORAGE_KEY = 'gz_collapsed_groups_v1';

  function loadState() {
    try {
      return GM_getValue(STORAGE_KEY, {});
    } catch {
      return {};
    }
  }

  function saveState(state) {
    GM_setValue(STORAGE_KEY, state);
  }

  function buildCollapsibleGroups() {
    const rows = Array.from(document.querySelectorAll(SELECTOR));
    if (rows.length < 2) return false;

    const groups = [];
    let header = null, members = [];

    rows.forEach(row => {
      const txt = row.querySelector('td.gz-col-type')?.innerText.trim() ?? '';
      if (txt) {
        if (header) groups.push({header, members});
        header = row;
        members = [];
      } else if (header) {
        members.push(row);
      }
    });
    if (header) groups.push({header, members});
    if (!groups.length) return false;

    const state = loadState();

    groups.forEach((group, index) => {
      const cell = group.header.querySelector('td.gz-col-type');
      if (!cell) return;

      const name = cell.innerText.trim();
      if (!name) return;

      if (group.header.dataset.gzProcessed) return;
      group.header.dataset.gzProcessed = "1";

      const key = name + '|' + index;

      const ph = document.createElement('tr');
      ph.className = 'gz-group-placeholder';
      ph.style.cursor = 'pointer';
      ph.innerHTML = `<td colspan="6" style="padding:6px 12px; border-bottom:1px solid #444; color:#ccc;">
          <strong>${name}</strong> (${group.members.length + 1})
      </td>`;

      let collapsed = !!state[key];
      let inserted = false;

      function applyState() {
        if (collapsed) {
          group.header.style.display = 'none';
          group.members.forEach(r => r.style.display = 'none');

          if (!inserted && group.header.parentNode) {
            group.header.after(ph);
            inserted = true;
          }
        } else {
          group.header.style.display = '';
          group.members.forEach(r => r.style.display = '');

          if (inserted) {
            ph.remove();
            inserted = false;
          }
        }
      }

      function toggle() {
        collapsed = !collapsed;
        state[key] = collapsed;
        saveState(state);
        applyState();
      }

      applyState();

      cell.style.cursor = 'pointer';
      cell.title = "Click to collapse / expand group";

      cell.onclick = e => {
        e.stopPropagation();
        toggle();
      };

      ph.onclick = toggle;
    });

    console.log(`[GZ Collapsible] ${groups.length} groups ready`);

    document.querySelectorAll(`
      tr[data-gz-sync-id],
      .similar-torrents__torrents tbody tr,
      .data-table-wrapper tbody tr,
      section.panelV2[x-data="torrentGroup"] tr
    `).forEach(el => {
      el.style.visibility = '';
    });

    const container = document.querySelector('section.panelV2[x-data="torrentGroup"]');
    if (container) container.style.setProperty('--pseudo-before-display', 'none');

    return true;
  }

  function waitForCollapsibleRows(maxAttempts = 180, attempt = 0) {
    if (attempt > maxAttempts) {
      console.warn("[GZ Collapsible] Gave up waiting for rows after", maxAttempts, "attempts");
      document.querySelectorAll(`
        tr[data-gz-sync-id],
        .similar-torrents__torrents tbody tr,
        .data-table-wrapper tbody tr,
        section.panelV2[x-data="torrentGroup"] tr
      `).forEach(el => el.style.visibility = '');
      return;
    }

    const rows = document.querySelectorAll(SELECTOR);

    if (rows.length >= 2) {
      buildCollapsibleGroups();
      return;
    }

    if (!document.hidden) {
      requestAnimationFrame(() => waitForCollapsibleRows(maxAttempts, attempt + 1));
    } else {
      setTimeout(() => waitForCollapsibleRows(maxAttempts, attempt + 1), 120);
    }
  }

  function startCollapsingLogic() {
    if (document.querySelector(SELECTOR)) {
      buildCollapsibleGroups();
    } else {
      waitForCollapsibleRows();
    }
  }

  // Mutation fallback
  let rowsObserver = null;
  function setupMutationFallback() {
    if (rowsObserver) return;
    const root = document.querySelector('main, section.panelV2[x-data="torrentGroup"], .similar-torrents__torrents, .data-table-wrapper') || document.body;

    rowsObserver = new MutationObserver(() => {
      if (document.querySelector(SELECTOR)) {
        buildCollapsibleGroups();
        if (rowsObserver) {
          rowsObserver.disconnect();
          rowsObserver = null;
        }
      }
    });

    rowsObserver.observe(root, { childList: true, subtree: true });
  }

  //  Kick-off
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startCollapsingLogic();
      setupMutationFallback();
    });
  } else {
    startCollapsingLogic();
    setupMutationFallback();
  }

  // Safety net
  setTimeout(() => {
    if (!document.querySelector(SELECTOR)) {
      console.warn("[GZ Collapsible] Still no rows after 4s — giving one last try");
      startCollapsingLogic();
    }
  }, 4000);

  // Default configuration - will be overridden by user storage
  const DEFAULT_CONFIG = Object.freeze({
    removeTorrentIcons: true,
    enableGazellifySimilar: true,
    enableGazellifyDetail: false,
    enableGazellifySearch: false,
    enableOriginalTitleTooltip: false,
    showEditButton: true,
    enableSideLayout: true,
    enableGazelleButtons: true,
    enableGazelleTorrentLayout: true,
    enableTorrentDropdowns: true,
    enableComponentColors: false,
    baseFontSize: 100,
    componentColors: {
      videoCodec: '#e6e6e6',
      bitDepth: '#e6e6e6',
      resolution: '#00bcd4',
      country: '#e6e6e6',
      service: '#00a3d9',
      source: '#b266ff',
      remux: '#B8860B',
      seasonEpisode: '#e6e6e6',
      language: '#e6e6e6',
      audio: '#1976D2',
      atmos: '#1976D2',
      hdr: '#388E3C',
      hybrid: '#e6e6e6',
      cut: '#e6e6e6',
      repack: '#e6e6e6',
      scene: '#C2185B',
      group: '#e6e6e6',
    },
  });

  // Load user config from storage, falling back to defaults
  const loadUserConfig = () => {
    try {
      const stored = GM_getValue('gz_config', null);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          componentColors: {
            ...DEFAULT_CONFIG.componentColors,
            ...(parsed.componentColors || {})
          }
        };
      }
    } catch (e) {
      console.warn('GAZELL3D: Failed to load config from storage', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  };

  // Save user config to storage
  const saveUserConfig = (config) => {
    try {
      GM_setValue('gz_config', JSON.stringify(config));
      return true;
    } catch (e) {
      console.error('GAZELL3D: Failed to save config to storage', e);
      return false;
    }
  };

  // Load API key from storage
  const loadApiKey = () => {
    try {
      return GM_getValue('gz_api_key', '') || '';
    } catch (e) {
      return '';
    }
  };

  // Save API key to storage
  const saveApiKey = (key) => {
    try {
      GM_setValue('gz_api_key', key || '');
      return true;
    } catch (e) {
      console.error('GAZELL3D: Failed to save API key to storage', e);
      return false;
    }
  };

  // Active config - loaded from storage at runtime
  let CONFIG = loadUserConfig();
  let AITHER_API_KEY = loadApiKey();


  // Utility for making authenticated API calls
  const gmFetchJson = (url, opts = {}, method = 'GET', timeout = 15000) => {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        timeout,
        ...opts,
        url: url.toString(),
        ontimeout: () => reject(new Error(`Request timed out after ${timeout}ms`)),
        onerror: (err) => reject(err || new Error('Failed to fetch')),
        onload: (response) => {
          try {
            resolve(JSON.parse(response.responseText));
          } catch (e) {
            reject(new Error('Failed to parse JSON response'));
          }
        }
      });
    });
  };

  // Utility for fetching raw HTML/text
  const gmFetchText = (url, opts = {}, method = 'GET', timeout = 15000) => {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        timeout,
        ...opts,
        url: url.toString(),
        ontimeout: () => reject(new Error(`Request timed out after ${timeout}ms`)),
        onerror: (err) => reject(err || new Error('Failed to fetch')),
        onload: (response) => {
          if (response.status >= 200 && response.status < 300) {
            resolve(response.responseText);
          } else {
            reject(new Error(`HTTP Error ${response.status}`));
          }
        }
      });
    });
  };

  // Default sequence order - can be customized by user
  const DEFAULT_GAZELLIFY_SEQUENCE = Object.freeze([
    'videoCodec',
    'bitDepth',
    'resolution',
    'country',
    'service',
    'source',
    'remux',
    'seasonEpisode',
    'language',
    'audio',
    'atmos',
    'hdr',
    'hybrid',
    'cut',
    'repack',
    'scene',
    'group',
  ]);

  // Human-readable labels for sequence items
  const SEQUENCE_LABELS = Object.freeze({
    videoCodec: 'Video Codec',
    bitDepth: 'Bit Depth',
    resolution: 'Resolution',
    country: 'Country',
    service: 'Streaming Service',
    source: 'Source',
    remux: 'Remux',
    seasonEpisode: 'Season/Episode',
    language: 'Language',
    audio: 'Audio Codec',
    atmos: 'Atmos',
    hdr: 'HDR',
    hybrid: 'Hybrid',
    cut: 'Cut (DC, Extended, etc.)',
    repack: 'Repack/Proper',
    scene: 'Scene',
    group: 'Release Group',
  });

  // Load sequence config from storage (order + disabled items)
  const loadGazellifySequence = () => {
    try {
      const stored = GM_getValue('gz_sequence_v2', null);
      if (stored) {
        const parsed = JSON.parse(stored);
        const order = parsed.order || [];
        const disabled = new Set(parsed.disabled || []);

        // Validate that all default items are present in order
        const parsedSet = new Set(order);
        if (order.length === DEFAULT_GAZELLIFY_SEQUENCE.length &&
          DEFAULT_GAZELLIFY_SEQUENCE.every(item => parsedSet.has(item))) {
          return { order, disabled };
        }
      }
    } catch (e) {
      console.warn('GAZELL3D: Failed to load sequence from storage', e);
    }
    return { order: [...DEFAULT_GAZELLIFY_SEQUENCE], disabled: new Set() };
  };

  // Save sequence config to storage
  const saveGazellifySequence = (order, disabled) => {
    try {
      const data = {
        order,
        disabled: [...disabled] // Convert Set to array for JSON
      };
      GM_setValue('gz_sequence_v2', JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('GAZELL3D: Failed to save sequence to storage', e);
      return false;
    }
  };

  // Active sequence config - loaded from storage at runtime
  const SEQUENCE_CONFIG = loadGazellifySequence();
  let GAZELLIFY_SEQUENCE = SEQUENCE_CONFIG.order.filter(key => !SEQUENCE_CONFIG.disabled.has(key));

  const SELECTORS = Object.freeze({
    similarArticle: 'main.page__torrent-similar--index article',
    torrentArticle: 'main.page__torrent--show article',
    torrentSearchPage: 'main.page__torrent--index',
    torrentGroup: 'section.panelV2[x-data="torrentGroup"]',
    metaSection: 'section.meta',
    torrentButtons: 'menu.torrent__buttons',
    tagBar: '.torrent__tags',
    searchBox: 'search',
    layout: '.gz-similar-layout',
    torrentTable: '.similar-torrents__torrents',
    searchResults: '.torrent-search--list__name',
  });



  const STYLE = `
  .page__torrent-similar--index { visibility: visible !important; }

    /* Reduce outer padding on the article when using side layout */
    main.page__torrent-similar--index article {
      padding-left: 0.75rem !important;
      padding-right: 0.75rem !important;
    }

    .gz-similar-layout {
      display: flex;
      gap: 1.25rem;
      width: 100%;
      margin-top: 0.5rem;
      align-items: flex-start;
    }

    .gz-similar-layout__column {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      min-width: 0;
    }

    .gz-similar-layout__column--left {
      flex: 1 1 auto;
    }

    .gz-similar-layout__column--right {
      flex: 0 0 18.75em;
      max-width: 18.75em;
      width: 100%;
    }

    .gz-panel {
      display: flex;
      flex-direction: column;
      width: 100%;
      margin-bottom: 1rem;
      overflow: hidden;
    }

    .gz-panel .panel__body {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .gz-panel .meta__backdrop {
      display: none;
    }

    .gz-panel .meta__title-link {
      text-align: center;
      text-decoration: none;
      color: inherit;
      transition: opacity 0.15s ease;
    }

    .gz-panel .meta__title-link:hover {
      opacity: 0.85;
    }

    .gz-panel .meta__title {
      font-size: 1.15em;
      font-weight: 600;
      line-height: 1.3;
      margin: 0;
    }

    .gz-detail-title {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
    }

    .gz-detail-title__heading {
      font-size: 1.4em;
      font-weight: 700;
      text-align: center;
      color: inherit;
      line-height: 1.25;
    }

    .gz-detail-title__subheading {
      font-size: 0.9em;
      text-align: center;
      color: inherit;
      opacity: 0.65;
    }

    .gz-panel .meta__poster-link {
      width: 100%;
      display: block;
      align-self: stretch;
      float: none !important;
      border-radius: 0; /* Cover fills panel */
      overflow: hidden;
      box-shadow: none;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .gz-panel .meta__poster-link:hover {
      box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.4);
    }

    .gz-panel .meta__poster {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 0;
      float: none !important;
    }

    .gz-panel .work__tags,
    .gz-panel .meta__ids {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0;
      margin: 0;
      font-size: 0.85em;
    }

    .gz-panel .meta__ids li,
    .gz-panel .work__tags li {
      list-style: none;
      white-space: nowrap;
      flex: 0 0 auto;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .gz-panel .meta__ids img {
      height: 16px;
      width: auto;
      opacity: 0.8;
      transition: opacity 0.15s ease;
    }

    .gz-panel .meta__ids a:hover img {
      opacity: 1;
    }

    .gz-inline-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      justify-content: center;
      width: 100%;
    }

    .gz-inline-buttons .form__group {
      display: flex;
      flex: 1 1 calc(50% - 0.2rem);
      min-width: 0;
    }

    .gz-inline-buttons .form__button {
      flex: 1;
      white-space: nowrap;
      padding: 0.4rem 0.5rem;
      justify-content: center;
      font-size: 0.8em;
      border-radius: 0.5rem;
    }

    .gz-panel .meta__description {
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      font-size: 0.85em;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.8);
    }

    /* Redesigned movie info layout (like Tron Legacy screenshot) */
    .gz-movie-info-group {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 0.25rem;
      align-items: baseline;
      font-size: 0.85em;
      line-height: 1.4;
    }

    .gz-movie-info-group .gz-chip-heading {
      color: rgba(255, 255, 255, 0.9);
      font-weight: 700;
      margin: 0;
      margin-right: 0.25rem;
      font-size: 1em;
      text-transform: none;
      letter-spacing: normal;
      flex: 0 0 auto;
    }

    .gz-movie-info-group .gz-chip-heading::after {
      content: ':';
    }

    .gz-movie-info-content {
      color: rgba(255, 255, 255, 0.7);
      flex: 1 1 auto;
      word-wrap: break-word;
    }

    .gz-movie-info-content a {
      color: inherit;
      text-decoration: none;
    }

    .gz-movie-info-content a:hover {
      text-decoration: underline;
    }

    .gz-left-panel {
      margin-top: 0;
    }

    .gz-left-panel .panel__header {
      cursor: default;
    }

    .gz-cast-grid {
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: 0 !important;
    }

    .gz-cast-row {
      display: flex;
      padding: 0.6rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      font-size: 0.85em;
      transition: background 0.1s;
    }

    .gz-cast-row:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    .gz-cast-row:last-child {
      border-bottom: none;
    }

    .gz-cast-actor {
      flex: 0 0 45%;
      text-align: right;
      padding-right: 1.5rem;
      color: rgba(255, 255, 255, 0.7);
    }

    .gz-cast-character {
      flex: 1;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
    }

    .gz-cast-actor a {
      color: inherit;
      text-decoration: none;
    }

    .gz-cast-actor a:hover {
      text-decoration: underline;
      color: #fff;
    }

    .gz-cast-toggle {
      display: flex;
      justify-content: flex-end;
      padding: 0.5rem 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .gz-cast-toggle-btn {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      font-size: 0.8em;
      padding: 0.2rem 0;
      transition: color 0.15s;
    }

    .gz-cast-toggle-btn:hover {
      color: #fff;
      text-decoration: underline;
    }

    .gz-panel .gz-meta-divider {
      border: none;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      margin: 0.25rem 0;
    }

    .gz-panel .work__tags li::after {
      content: none !important;
    }

    .gz-panel .work__tags li {
      padding: 0.15rem 0.3rem;
      background: none;
      border: none;
      border-radius: 0;
      font-size: 0.85em;
      color: rgba(255, 255, 255, 0.8);
    }

    .gz-panel .work__tags li a {
      color: inherit !important;
      text-decoration: none !important;
      display: inline-block;
    }

    .gz-panel .work__tags li a:hover {
      color: rgba(255, 255, 255, 1);
      text-decoration: none;
    }

    .gz-panel .work__tags li span {
      color: inherit;
    }

    /* Header section with centered title and action links (ANT-style) */
    .gz-page-header {
      text-align: center;
      margin-bottom: 1.25rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .gz-page-header__title {
      font-size: 1.6em;
      font-weight: 600;
      margin: 0 0 0.75rem;
      color: inherit;
    }

    .gz-page-header__title a {
      color: inherit;
      text-decoration: none;
    }

    .gz-page-header__title a:hover {
      text-decoration: underline;
    }

    .gz-page-header__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.25rem 0.5rem;
      font-size: 0.9em;
    }

    .gz-page-header__actions a,
    .gz-page-header__actions button {
      color: rgba(255, 255, 255, 0.75);
      text-decoration: none;
      background: none;
      border: none;
      padding: 0;
      font: inherit;
      cursor: pointer;
      transition: color 0.15s ease;
    }

    .gz-page-header__actions a:hover,
    .gz-page-header__actions button:hover {
      color: rgba(255, 255, 255, 1);
      text-decoration: underline;
    }

    .gz-page-header__actions .gz-separator {
      color: rgba(255, 255, 255, 0.3);
      user-select: none;
    }

    .gz-search-title {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      line-height: 1.2;
    }

    .gz-search-title__heading {
      font-size: 1.10em;
      font-weight: 600;
      color: inherit;
      transition: opacity 0.15s ease;
    }

    .gz-search-title__subheading {
      font-size: 0.75em;
      color: inherit;
      opacity: 0.7;
      margin-top: 0.30rem;
      transition: opacity 0.15s ease;
    }

    .torrent-search--list__name:hover .gz-search-title__heading,
    .torrent-search--list__name:hover .gz-search-title__subheading {
      opacity: 1;
    }

    /* Position context for the hidden original text span (for Seadex compatibility) */
    .torrent-search--list__name {
      position: relative;
    }

    .gz-tooltip {
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      background: var(--gz-tooltip-bg, rgba(0, 0, 0, 0.85));
      color: var(--gz-tooltip-color, #fff);
      border: 1px solid var(--gz-tooltip-border, rgba(255, 255, 255, 0.15));
      padding: 0.4rem 0.75rem;
      border-radius: 0.45rem;
      font-size: 1.25rem;
      line-height: 1.35;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.1s ease, transform 0.1s ease;
      max-width: 600px;
      word-break: break-word;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
    }

    .gz-tooltip--visible {
      opacity: 1;
      transform: translateY(0);
    }

    .gz-label--unknown {
      color: #ffd95e;
      font-weight: 600;
    }

    @media (max-width: 1100px) {
      .gz-similar-layout {
        flex-direction: column;
      }

      .gz-similar-layout__column--right {
        max-width: none;
        flex: 1 1 auto;
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .gz-panel {
        margin-bottom: 0;
        flex: 1 1 calc(50% - 0.5rem);
      }
    }

    @media (max-width: 700px) {
      .gz-similar-layout__column--right {
        flex-direction: column;
      }
      .gz-panel {
        flex: 1 1 100%;
      }
    }

    .gz-actions-cell {
      white-space: nowrap;
      text-align: center;
      font-size: 0.9em;
      font-weight: normal;
    }

    .gz-actions-cell a, .gz-actions-cell button {
      display: inline-block;
      cursor: pointer;
      color: inherit;
      text-decoration: none;
      border: none;
      background: none;
      padding: 0;
      font: inherit;
    }

    .gz-actions-cell a:hover, .gz-actions-cell button:hover {
      text-decoration: underline;
    }

    .gz-torrent-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9em;
      margin-top: 0;
    }

    .gz-torrent-table th {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 2px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.7);
      font-weight: 600;
      white-space: nowrap;
    }

    .gz-torrent-table td {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      vertical-align: middle;
    }

    .gz-torrent-table .gz-col-ep {
      width: 60px;
      white-space: nowrap;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 600;
    }

    .gz-torrent-table .gz-col-type {
      width: 80px;
      white-space: nowrap;
    }

    .gz-torrent-table .gz-col-name {
      /* Takes remaining space */
    }

    .gz-torrent-table .gz-col-actions {
      width: 150px;
      white-space: nowrap;
      padding-left: 8px !important;
    }

    .gz-torrent-table .gz-col-size {
      width: 80px;
      white-space: nowrap;
      text-align: right;
    }

    .gz-torrent-table .gz-col-stat {
      width: 50px;
      white-space: nowrap;
      text-align: center;
    }

    .gz-torrent-table .ep-hidden {
      color: transparent;
    }

    .gz-torrent-table .torrent-name-link {
        font-weight: 600;
        text-decoration: none;
        color: inherit;
        font-size: 1.05em;
    }

    .gz-torrent-table .gz-torrent-icons {
        display: inline-flex;
        gap: 6px;
        margin-left: 12px;
        vertical-align: middle;
    }

    .gz-torrent-table .gz-torrent-icons i {
        font-size: 0.9em;
        opacity: 0.8;
    }

    .gz-season-header {
       background: rgba(255, 255, 255, 0.06);
    }

    .gz-season-header td {
        font-weight: 700;
        font-size: 1.1em;
        padding: 12px;
        color: rgba(255, 255, 255, 0.95);
    }

    .gz-group-header {
       background: rgba(255, 255, 255, 0.03);
       border-bottom: 2px solid rgba(255, 255, 255, 0.05);
    }

    .gz-group-header td {
        font-weight: 700;
        padding: 8px 12px;
        font-size: 0.95em;
        color: rgba(255, 255, 255, 0.85);
        text-align: left;
    }

    /* Torrent Info Dropdown Styles */
    .gz-dropdown-row {
      background: rgba(0, 0, 0, 0.15);
    }

    .gz-dropdown-row td {
      padding: 0 !important;
    }

    .gz-dropdown-container {
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      /* Prevent layout shift */
      width: 100%;
      box-sizing: border-box;
    }

    /* Ensure gazelle table doesn't shift when dropdown opens */
    .gz-torrent-table {
      table-layout: fixed;
      width: 100%;
    }

    .gz-dropdown-header {
      font-size: 0.85em;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .gz-dropdown-header a {
      color: inherit;
      text-decoration: none;
    }

    .gz-dropdown-header a:hover {
      text-decoration: underline;
    }

    .gz-dropdown-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 0;
      align-items: center;
    }

    .gz-dropdown-tab {
      padding: 8px 16px;
      cursor: pointer;
      font-size: 0.9em;
      color: rgba(255, 255, 255, 0.7);
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      transition: all 0.15s ease;
      margin-bottom: -1px;
    }

    .gz-dropdown-tab:hover {
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.03);
    }

    .gz-dropdown-tab.active {
      color: #eaeeecff;
      border-bottom-color: #eaeeecff;
    }

    .gz-dropdown-panel {
      display: none;
      position: relative;
    }

    .gz-dropdown-panel.active {
      display: block;
    }

    .gz-panel-copy-btn {
      margin-left: auto;
      padding: 4px 12px;
      font-size: 0.85em;
      background: transparent;
      border: none;
      border-radius: 4px;
      color: rgba(255, 255, 255, 0.5);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .gz-panel-copy-btn:hover {
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.05);
    }

    .gz-panel-copy-btn.copied {
      color: #eaeeecff;
    }

    .gz-dropdown-description {
      font-size: 0.9em;
      line-height: 1.35;
      color: rgba(255, 255, 255, 0.85);
    }

    /* Collapse multiple consecutive br tags to reduce excessive blank lines */
    .gz-dropdown-description br + br {
      display: block;
      content: '';
      margin-top: 0.5em;
    }

    .gz-dropdown-description:empty::after {
      content: 'No description available.';
      color: rgba(255, 255, 255, 0.5);
      font-style: italic;
    }

    .gz-dropdown-filelist {
    }

    .gz-dropdown-mediainfo {
    }

    .gz-dropdown-filelist table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85em;
    }

    .gz-dropdown-filelist th,
    .gz-dropdown-filelist td {
      padding: 6px 10px;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .gz-dropdown-filelist th {
      color: rgba(255, 255, 255, 0.6);
      font-weight: 600;
    }

    .gz-dropdown-filelist td:last-child {
      text-align: right;
      white-space: nowrap;
    }

    .gz-dropdown-mediainfo pre {
      margin: 0;
      padding: 12px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 6px;
      font-size: 0.8em;
      font-family: 'Monaco', 'Consolas', monospace;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-word;
      color: rgba(255, 255, 255, 0.85);
    }

    .gz-dropdown-loading {
      text-align: center;
      padding: 20px;
      color: rgba(255, 255, 255, 0.6);
    }

    .gz-dropdown-error {
      text-align: center;
      padding: 20px;
      color: #db7676;
    }

    .gz-torrent-table .torrent-name-link.gz-clickable {
      cursor: pointer;
    }

    .gz-torrent-table .torrent-name-link.gz-clickable:hover {
      text-decoration: underline;
    }

    /* BBCode Styles */
    .gz-bbcode-img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 4px 0;
    }

    .gz-bbcode-quote {
      margin: 4px 0;
      padding: 8px 12px;
      border-left: 3px solid rgba(118, 219, 166, 0.6);
      background: rgba(255, 255, 255, 0.03);
      border-radius: 0 4px 4px 0;
    }

    .gz-bbcode-quote cite {
      display: block;
      font-weight: 600;
      margin-bottom: 6px;
      color: rgba(255, 255, 255, 0.7);
    }

    .gz-bbcode-code {
      margin: 4px 0;
      padding: 8px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 0.85em;
      overflow-x: auto;
    }

    .gz-bbcode-spoiler,
    .gz-bbcode-comparison {
      margin: 4px 0;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }

    .gz-bbcode-spoiler summary,
    .gz-bbcode-comparison summary {
      padding: 6px 10px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.03);
      font-weight: 500;
    }

    .gz-bbcode-spoiler[open] summary,
    .gz-bbcode-comparison[open] summary {
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .gz-bbcode-spoiler-content {
      padding: 8px 10px;
    }

    .gz-bbcode-note {
      margin: 4px 0;
      padding: 8px 12px;
      background: rgba(118, 219, 166, 0.08);
      border: 1px solid rgba(118, 219, 166, 0.3);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.9);
    }

    .gz-bbcode-alert {
      margin: 4px 0;
      padding: 8px 12px;
      background: rgba(219, 118, 118, 0.08);
      border: 1px solid rgba(219, 118, 118, 0.3);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.9);
    }

    .gz-bbcode-list {
      margin: 4px 0;
      padding-left: 20px;
      list-style-type: disc;
    }

    .gz-bbcode-list li {
      margin: 2px 0;
      padding-left: 4px;
    }

    /* BBCode Heading Styles */
    .gz-bbcode-heading {
      font-weight: 700;
      color: rgba(255, 255, 255, 0.95);
      margin: 6px 0 4px;
      line-height: 1.25;
    }

    .gz-bbcode-h1 {
      font-size: 1.5em;
    }

    .gz-bbcode-h2 {
      font-size: 1.35em;
    }

    .gz-bbcode-h3 {
      font-size: 1.2em;
    }

    .gz-bbcode-h4 {
      font-size: 1.1em;
    }

    .gz-bbcode-h5 {
      font-size: 1em;
    }

    .gz-bbcode-h6 {
      font-size: 0.9em;
    }

    /* BBCode Table Styles */
    .gz-bbcode-table {
      width: auto !important;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      margin: 10px 0 !important;
      background: rgba(0, 0, 0, 0.25) !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      border-radius: 6px !important;
      overflow: hidden !important;
    }

    .gz-bbcode-table tr {
      border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
    }

    .gz-bbcode-table tr:last-child {
      border-bottom: none !important;
    }

    .gz-bbcode-table td {
      padding: 12px 16px !important;
      vertical-align: middle !important;
      line-height: 1.5 !important;
    }

    .gz-bbcode-table td:first-child {
      font-weight: 500 !important;
      color: rgba(255, 255, 255, 0.75) !important;
      white-space: nowrap !important;
      padding-right: 48px !important;
      border-right: 1px solid rgba(255, 255, 255, 0.1) !important;
    }

    .gz-bbcode-table td:last-child {
      padding-left: 24px !important;
    }

    .gz-bbcode-table th {
      padding: 12px 16px !important;
      text-align: left !important;
      font-weight: 600 !important;
      background: rgba(255, 255, 255, 0.04) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
      color: rgba(255, 255, 255, 0.9) !important;
    }

    /* BBCode Horizontal Rule */
    .gz-bbcode-hr {
      border: none;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      margin: 16px 0;
    }

    /* File List Tree Styles */
    .gz-filelist-root-info {
      margin-bottom: 10px;
      padding: 8px 12px;
      background: rgba(118, 219, 166, 0.06);
      border-radius: 4px;
      font-size: 0.9em;
      color: rgba(255, 255, 255, 0.8);
    }

    .gz-filelist-root-info strong {
      color: rgba(118, 219, 166, 0.9);
    }

    .gz-filelist-folder-row {
      cursor: pointer;
    }

    .gz-filelist-folder-row:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .gz-folder-toggle {
      display: inline-block;
      width: 12px;
      margin-right: 4px;
      font-size: 0.8em;
      color: rgba(255, 255, 255, 0.6);
      transition: transform 0.15s ease;
    }

    .gz-folder-icon {
      margin-right: 6px;
    }

    .gz-folder-name {
      font-weight: 600;
      color: rgba(255, 255, 255, 0.95);
    }

    .gz-folder-count {
      font-weight: 400;
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.9em;
      margin-left: 6px;
    }

    .gz-filelist-file-row td:first-child {
      color: rgba(255, 255, 255, 0.85);
    }

    .gz-tree-indent {
      display: inline-block !important;
      flex-shrink: 0;
      height: 1em;
      vertical-align: middle;
    }

    /* MediaInfo Summary Styles */
    .gz-mediainfo-summary {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 0.9em;
    }

    .gz-mediainfo-filename {
      font-weight: 700;
      font-size: 1.05em;
      color: rgba(255, 255, 255, 0.6);
      word-break: break-all;
      padding: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      cursor: pointer;
      transition: background 0.15s ease;
      margin: -16px -16px 0 -16px;
      border-radius: 8px 8px 0 0;
    }

    .gz-mediainfo-filename:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .gz-mediainfo-filename::before {
      content: 'Show ';
      font-weight: 400;
      color: rgba(255, 255, 255, 0.6);
    }

    .gz-mediainfo-filename.expanded::before {
      content: 'Hide ';
    }

    .gz-mediainfo-raw-inline {
      display: none;
      margin: 12px -16px;
      padding: 12px 16px;
      background: rgba(0, 0, 0, 0.25);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      max-height: 400px;
      overflow: auto;
    }

    .gz-mediainfo-raw-inline.visible {
      display: block;
    }

    .gz-mediainfo-raw-inline pre {
      margin: 0;
      font-size: 0.8em;
      font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-word;
      color: rgba(255, 255, 255, 0.85);
    }

    .gz-mediainfo-summary-content {
      padding-top: 16px;
    }

    .gz-mediainfo-columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 24px;
    }

    .gz-mediainfo-column {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .gz-mediainfo-column-title {
      font-weight: 700;
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 4px;
    }

    .gz-mediainfo-row {
      display: flex;
      gap: 8px;
      line-height: 1.5;
    }

    .gz-mediainfo-row-label {
      color: rgba(255, 255, 255, 0.6);
      min-width: 70px;
      flex-shrink: 0;
    }

    .gz-mediainfo-row-value {
      color: rgba(255, 255, 255, 0.95);
    }

    .gz-mediainfo-section-title {
      font-weight: 700;
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: rgba(255, 255, 255, 0.5);
      margin-top: 16px;
      margin-bottom: 8px;
    }

    .gz-mediainfo-audio-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .gz-mediainfo-audio-item {
      display: flex;
      gap: 8px;
      line-height: 1.5;
    }

    .gz-mediainfo-audio-num {
      color: rgba(255, 255, 255, 0.5);
      min-width: 20px;
      flex-shrink: 0;
    }

    .gz-mediainfo-audio-details {
      color: rgba(255, 255, 255, 0.9);
    }

    .gz-mediainfo-audio-title {
      color: rgba(255, 255, 255, 0.6);
    }

    .gz-mediainfo-subtitles-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 12px;
      color: rgba(255, 255, 255, 0.85);
      line-height: 1.6;
    }

    .gz-mediainfo-subtitles-list--detailed {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .gz-mediainfo-subtitle-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .gz-mediainfo-subtitle-item--detailed {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .gz-mediainfo-subtitle-num {
      color: rgba(255, 255, 255, 0.5);
      font-weight: 600;
      min-width: 28px;
    }

    .gz-mediainfo-subtitle-details {
      color: rgba(255, 255, 255, 0.85);
    }

    .gz-mediainfo-subtitle-title {
      color: rgba(255, 255, 255, 0.6);
    }

    .gz-mediainfo-subtitle-flags {
      color: rgba(219, 166, 118, 0.9);
      font-size: 0.9em;
    }

    .gz-mediainfo-subtitle-forced {
      color: rgba(219, 166, 118, 0.9);
      font-size: 0.85em;
      font-weight: 600;
    }

    .gz-mediainfo-encode-settings {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 6px;
      padding: 12px;
      font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
      font-size: 0.8em;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.8);
      word-break: break-all;
      white-space: pre-wrap;
      max-height: 200px;
      overflow-y: auto;
    }

    /* Legacy section styles for backwards compatibility */
    .gz-mediainfo-section {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .gz-mediainfo-label {
      font-weight: 600;
      color: rgba(255, 255, 255, 0.7);
      min-width: 80px;
      flex-shrink: 0;
    }

    .gz-mediainfo-value {
      color: rgba(255, 255, 255, 0.9);
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .gz-mediainfo-raw-container {
      margin-top: 8px;
    }

    .gz-mediainfo-raw-container summary {
      cursor: pointer;
      color: rgba(118, 219, 166, 0.9);
      font-size: 0.85em;
      padding: 6px 0;
    }

    .gz-mediainfo-raw-container summary:hover {
      text-decoration: underline;
    }

    .gz-mediainfo-raw {
      margin-top: 8px;
      max-height: 300px;
      overflow: auto;
    }

    /* Trump Report Modal Styles */
    .gz-trump-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }

    .gz-trump-modal {
      background: rgba(30, 30, 35, 0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 24px;
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }

    .gz-trump-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .gz-trump-header h3 {
      margin: 0;
      font-size: 1.2em;
      color: #fff;
    }

    .gz-trump-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      font-size: 1.5em;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: color 0.15s ease;
    }

    .gz-trump-close:hover {
      color: #fff;
    }

    .gz-trump-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .gz-trump-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .gz-trump-field label {
      font-size: 0.85em;
      color: rgba(255, 255, 255, 0.7);
      font-weight: 500;
    }

    .gz-trump-field .reported-torrent {
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.9em;
      word-break: break-word;
    }

    .gz-trump-select,
    .gz-trump-input,
    .gz-trump-textarea {
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      color: #fff;
      font-size: 0.9em;
      font-family: inherit;
      transition: border-color 0.15s ease, background 0.15s ease;
    }

    .gz-trump-select:focus,
    .gz-trump-input:focus,
    .gz-trump-textarea:focus {
      outline: none;
      border-color: rgba(118, 219, 166, 0.6);
      background: rgba(255, 255, 255, 0.08);
    }

    .gz-trump-select option {
      background: rgb(30, 30, 35);
      color: #fff;
    }

    .gz-trump-textarea {
      min-height: 100px;
      resize: vertical;
    }

    .gz-trump-buttons {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 8px;
    }

    .gz-trump-btn {
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 0.9em;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      border: none;
    }

    .gz-trump-btn--cancel {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.8);
    }

    .gz-trump-btn--cancel:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
    }

    .gz-trump-btn--submit {
      background: rgba(118, 219, 166, 0.85);
      color: rgb(20, 20, 25);
    }

    .gz-trump-btn--submit:hover {
      background: rgba(118, 219, 166, 1);
    }

    .gz-trump-btn--submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Toast Notification Styles */
    .gz-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 14px 20px;
      border-radius: 8px;
      font-size: 0.9em;
      z-index: 10001;
      max-width: 400px;
      word-break: break-word;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
      animation: gz-toast-slide-in 0.3s ease;
    }

    @keyframes gz-toast-slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .gz-toast--success {
      background: rgba(118, 219, 166, 0.95);
      color: rgb(20, 20, 25);
    }

    .gz-toast--error {
      background: rgba(219, 118, 118, 0.95);
      color: #fff;
    }

    .gz-toast--info {
      background: rgba(118, 166, 219, 0.95);
      color: #fff;
    }

    /* Config Button (Footer) */
    .gz-config-link {
      cursor: pointer;
      color: inherit;
      opacity: 0.8;
      transition: opacity 0.15s ease;
      font-size: 0.9em;
      margin-top: 8px;
      display: inline-block;
    }

    .gz-config-link:hover {
      opacity: 1;
      text-decoration: underline;
    }

    /* Config Modal Styles */
    .gz-config-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }

    .gz-config-modal {
      background: rgba(30, 30, 35, 0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 24px;
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }

    .gz-config-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .gz-config-title {
      font-size: 1.15em;
      font-weight: 600;
      color: #fff;
      margin: 0;
    }

    .gz-config-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      font-size: 1.5em;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: color 0.15s ease;
    }

    .gz-config-close:hover {
      color: #fff;
    }

    .gz-config-section {
      margin-bottom: 20px;
    }

    .gz-config-section-title {
      font-size: 0.85em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 12px;
    }

    .gz-config-field {
      margin-bottom: 14px;
    }

    .gz-config-field:last-child {
      margin-bottom: 0;
    }

    .gz-config-label {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.9em;
    }

    .gz-config-label input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: rgba(118, 219, 166, 0.9);
    }

    .gz-config-input-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .gz-config-input-label {
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.9em;
    }

    .gz-config-input {
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      color: #fff;
      font-size: 0.9em;
      font-family: inherit;
      transition: border-color 0.15s ease, background 0.15s ease;
    }

    .gz-config-input:focus {
      outline: none;
      border-color: rgba(118, 219, 166, 0.6);
      background: rgba(255, 255, 255, 0.08);
    }

    .gz-config-input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }

    .gz-config-buttons {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .gz-config-btn {
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 0.9em;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      border: none;
    }

    .gz-config-btn--cancel {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.8);
    }

    .gz-config-btn--cancel:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
    }

    .gz-config-btn--save {
      background: rgba(118, 219, 166, 0.85);
      color: rgb(20, 20, 25);
    }

    .gz-config-btn--save:hover {
      background: rgba(118, 219, 166, 1);
    }

    /* Sequence Ordering (Drag & Drop) */
    .gz-sequence-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      max-height: 280px;
      overflow-y: auto;
    }

    .gz-sequence-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      cursor: grab;
      transition: all 0.15s ease;
      user-select: none;
    }

    .gz-sequence-item:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .gz-sequence-item:active {
      cursor: grabbing;
    }

    .gz-sequence-item.dragging {
      opacity: 0.5;
      background: rgba(118, 219, 166, 0.1);
      border-color: rgba(118, 219, 166, 0.3);
    }

    .gz-sequence-item.drag-over {
      border-color: rgba(118, 219, 166, 0.6);
      background: rgba(118, 219, 166, 0.15);
    }

    .gz-sequence-handle {
      display: flex;
      flex-direction: column;
      gap: 2px;
      opacity: 0.5;
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.8em;
    }

    .gz-sequence-handle::before {
      content: '⋮⋮';
      letter-spacing: -2px;
    }

    .gz-sequence-label {
      flex: 1;
      font-size: 0.9em;
      color: rgba(255, 255, 255, 0.9);
    }

    .gz-sequence-key {
      font-size: 0.75em;
      color: rgba(255, 255, 255, 0.4);
      font-family: monospace;
    }

    .gz-sequence-reset {
      margin-top: 8px;
      padding: 6px 12px;
      font-size: 0.8em;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .gz-sequence-reset:hover {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.9);
    }

    .gz-sequence-toggle {
      width: 16px;
      height: 16px;
      accent-color: rgba(118, 219, 166, 0.9);
      cursor: pointer;
      flex-shrink: 0;
    }

    .gz-sequence-item.disabled {
      opacity: 0.5;
      background: rgba(255, 255, 255, 0.02);
    }

    .gz-sequence-item.disabled .gz-sequence-label {
      text-decoration: line-through;
      color: rgba(255, 255, 255, 0.5);
    }

    /* Native UNIT3D BBCode rendered styles */
    .bbcode-rendered { font-size: 15px; line-height: 1.5; word-wrap: break-word; color: rgba(255, 255, 255, 0.85); margin: 0; }
    .bbcode-rendered b, .bbcode-rendered strong { font-weight: 600; }
    .bbcode-rendered a { background-color: transparent; color: #5dade2; text-decoration: none; }
    .bbcode-rendered a:hover { text-decoration: underline; }
    .bbcode-rendered hr { border-bottom: 1px solid rgba(255,255,255,0.1); height: 1px; margin: 24px 0; border: 0; background-color: rgba(255,255,255,0.1); }
    .bbcode-rendered details { padding: 0 6px; margin-bottom: 2px; display: inline-block; max-width: 100%; border-left: 2px solid rgba(255,255,255,0.1); }
    .bbcode-rendered details summary { cursor: pointer; display: list-item; padding: 4px; font-weight: 600; }
    .bbcode-rendered details:not([open]) > *:not(summary) { display: none !important; }
    .bbcode-rendered h1, .bbcode-rendered h2, .bbcode-rendered h3, .bbcode-rendered h4, .bbcode-rendered h5, .bbcode-rendered h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
    .bbcode-rendered h1 { margin: 0.67em 0; padding-bottom: 0.3em; font-size: 30px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .bbcode-rendered h2 { padding-bottom: 0.3em; font-size: 23px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .bbcode-rendered h3 { font-size: 19px; }
    .bbcode-rendered h4 { font-size: 15px; }
    .bbcode-rendered h5 { font-size: 13px; }
    .bbcode-rendered h6 { font-size: 13px; color: rgba(255,255,255,0.5); }
    .bbcode-rendered blockquote {
        margin: 12px 2px; padding: 0.25em 0.25em 0.25em 1em; color: rgba(255,255,255,0.6);
        border-left: 0.25em solid rgba(255,255,255,0.2); font-size: 15px; background-color: rgba(0,0,0,0.2);
        border-radius: 3px 6px 6px 3px / 8px 6px 6px 8px;
    }
    .bbcode-rendered blockquote > cite { font-size: 12px; font-weight: bold; }
    .bbcode-rendered p, .bbcode-rendered blockquote, .bbcode-rendered ul, .bbcode-rendered ol, .bbcode-rendered dl, .bbcode-rendered table,
    .bbcode-rendered .bbcode-rendered__center, .bbcode-rendered .bbcode-rendered__left, .bbcode-rendered .bbcode-rendered__right,
    .bbcode-rendered .bbcode-rendered__alert, .bbcode-rendered .bbcode-rendered__note, .bbcode-rendered .bbcode-rendered__clipboard {
        margin-top: 12px; margin-bottom: 12px;
    }
    .bbcode-rendered ul, .bbcode-rendered ol { padding-left: 2em; }
    .bbcode-rendered ol { list-style-type: decimal; }
    .bbcode-rendered ol[type='a'] { list-style-type: lower-alpha; }
    .bbcode-rendered ol[type='i'] { list-style-type: lower-roman; }
    .bbcode-rendered li > p { margin-top: 16px; }
    .bbcode-rendered li + li { margin-top: 0.25em; }
    .bbcode-rendered > li, .bbcode-rendered :not(ul):not(ol) > li { list-style-position: inside; list-style-type: circle; }
    .bbcode-rendered table { border-collapse: collapse; display: block; width: max-content; max-width: 100%; overflow: auto; }
    .bbcode-rendered th { font-weight: 600; }
    .bbcode-rendered th, .bbcode-rendered td { padding: 6px 13px; border: 1px solid rgba(255,255,255,0.1) !important; background-color: rgba(255,255,255,0.02); }
    .bbcode-rendered tr { border-top: 1px solid rgba(255,255,255,0.1); }
    .bbcode-rendered tr:nth-child(2n), .bbcode-rendered tr:nth-child(2n) td { background-color: rgba(255,255,255,0.05); }
    .bbcode-rendered img { max-width: 100%; }
    .bbcode-rendered code, .bbcode-rendered kbd, .bbcode-rendered pre { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; }
    .bbcode-rendered pre { font-size: 12px; word-wrap: normal; overflow: auto; word-break: break-word; white-space: pre-wrap; margin: 0; padding: 12px; border-radius: 6px; flex: 1; min-width: 0; }
    .bbcode-rendered code { padding: 0.2em 0.4em; margin: 0; font-size: 13px; background-color: rgba(255,255,255,0.05); border-radius: 6px; }
    .bbcode-rendered pre code { display: inline; padding: 0; background-color: transparent; }
    .bbcode-rendered .bbcode-rendered__clipboard { display: flex; justify-content: space-between; background-color: rgba(0,0,0,0.25); border-radius: 6px; position: relative; overflow: auto; }
    .bbcode-rendered__clipboard-button { display: block; background: transparent; border: none; margin: 6px; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 1.1em; padding: 4px; }
    .bbcode-rendered__clipboard-button:hover, .bbcode-rendered__clipboard-button:focus { color: rgba(255,255,255,0.9); }
    .bbcode-rendered__alert { border-radius: 5px; padding: 8px; border: 2px solid #e74c3c; }
    .bbcode-rendered__alert::before { content: 'Alert: '; color: #e74c3c; display: inline-block; padding-right: 1ch; }
    .bbcode-rendered__note { border-radius: 4px; padding: 8px; border: 2px solid #f39c12; }
    .bbcode-rendered__note::before { content: 'Note: '; color: #f39c12; display: inline-block; padding-right: 1ch; }

    /* Comparison Block */
    .comparison__screenshots { display: flex; flex-direction: column; align-items: center; position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; overflow-y: auto; z-index: 10000; background-color: rgba(0,0,0,0.95); list-style-type: none; margin: 0 !important; padding: 0 !important; }
    .comparison__row { display: flex; flex-direction: row; align-items: center; list-style-type: none; margin: 0; padding: unset !important; margin-left: max(0px, 50% - 50vw); }
    .comparison__image-container { margin: unset !important; }
    .comparison__image--hidden, .comparison__image-container--hidden { visibility: hidden; width: 0px; }
    .comparison__figure { margin: unset !important; }
    .comparison__image { image-rendering: crisp-edges; max-width: max-content !important; max-height: max-content !important; }
    .comparison__figcaption { position: fixed; width: 100%; text-align: center; top: 4px; left: calc(50vw - 50%); text-shadow: -2px 0 black, 0 2px black, 2px 0 black, 0 -2px black; color: white; font-size: 18px; z-index: 10001; }
    .comparison__text { font-weight: 700; margin-bottom: 8px; }
    .comparison__divider { font-weight: 300; color: rgba(255,255,255,0.4); }
    .comparison__button { font-weight: 300; background-color: transparent; color: #5dade2; border: none; cursor: pointer; text-decoration: underline; padding: 0 4px; }
  `;

  const READY_STATES = ['complete', 'interactive'];

  const $ = (selector, scope = document) => (scope ? scope.querySelector(selector) : null);
  const $$ = (selector, scope = document) => (scope ? Array.from(scope.querySelectorAll(selector)) : []);
  const normalizeText = (value = '') => String(value).replace(/\s+/g, ' ').trim();
  const getText = (node) => normalizeText(node?.textContent || '');
  const create = (tag, className = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
  };
  const appendAll = (parent, nodes = []) => nodes.filter(Boolean).forEach((node) => parent.appendChild(node));
  const removeNode = (node) => {
    if (node) node.remove();
  };
  const tokenizeWords = (text) =>
    (text || '')
      .split(/[^A-Za-z0-9]+/)
      .map((token) => token.trim().toUpperCase())
      .filter(Boolean);
  const setOriginalTitle = (element, originalText) => {
    if (!element || element.dataset.gzOriginal) return;
    const source = originalText ?? element.textContent ?? '';
    const value = normalizeText(source);
    if (value) element.dataset.gzOriginal = value;
  };
  const applyUnknownHighlight = (element, items = '') => {
    if (!element) return;
    element.textContent = '';

    let parsedItems = Array.isArray(items) ? items : [];
    if (!Array.isArray(items)) {
      const str = items || '';
      parsedItems = str.split(' / ').map(p => ({ category: 'unknown', value: p }));
    }

    parsedItems.forEach((item, index) => {
      const { category, value } = item;

      if (/unknown/i.test(value)) {
        const regex = /unknown/gi;
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(value))) {
          if (match.index > lastIndex) {
            element.appendChild(document.createTextNode(value.slice(lastIndex, match.index)));
          }
          const span = create('span', 'gz-label--unknown');
          span.textContent = match[0];
          element.appendChild(span);
          lastIndex = regex.lastIndex;
        }
        if (lastIndex < value.length) {
          element.appendChild(document.createTextNode(value.slice(lastIndex)));
        }
      } else {
        const span = create('span');
        span.textContent = value;
        if (CONFIG.enableComponentColors !== false) {
          const color = CONFIG.componentColors?.[category];
          if (color && color !== '#ffffff' && color !== '#e6e6e6') {
            span.style.color = color;
          }
          if (['resolution', 'source', 'remux', 'service', 'audio', 'atmos', 'hdr', 'scene'].includes(category)) {
            span.style.fontWeight = 'bold';
          }
        }
        element.appendChild(span);
      }

      if (index < parsedItems.length - 1) {
        const separator = create('span');
        separator.textContent = ' / ';
        separator.style.opacity = '0.65';
        element.appendChild(separator);
      }
    });
  };
  const findMetadataStartIndex = (text = '') => {
    // 1. TV Shows: Priority on Season/Episode patterns.
    // This allows unique title modifiers (like "AKA Title") to exist between Year and Season.
    const tvPattern = /\b(?:S\d{1,3}(?:E\d{1,3})?|E\d{1,3}|Season\s*\d+|Complete(?:\s*Series)?|OVA|OAD|NCED|NCOP)\b/i;
    const tvMatch = text.match(tvPattern);
    if (tvMatch) {
      return tvMatch.index;
    }

    // 2. Movies: Priority on Year.
    // If a Year is present, we assume everything after it is metadata.
    // This handles cases like "Movie Title 1999 Language 1080p..."
    const yearMatch = text.match(/\b(?:19|20)\d{2}\b/);
    if (yearMatch) {
      return yearMatch.index + yearMatch[0].length;
    }

    // 3. Fallback: If no Season or Year, look for the start of common technical tags.
    const patterns = [
      /\b(?:2160p|4320p|1080p|720p|576p|480p|1080i|720i|576i|480i|360p|240p|144p|8K|4K|2K|SD)\b/i,
      /\b(?:Blu-?ray|WEB(?:-?DL|Rip)?|HDTV|UHD|DVD(?:\d|R)?|BD|BRRip|BDRip|DVDRip|NTSC|PAL|SECAM|LaserDisc|VHS|PPV|VOD|REMUX|ISO)\b/i,
      /\b(?:H\.?26[45]|HEVC|AVC|x265|x264|MPEG-?2|MPEG-?4|VP9|AV1|VC-?1|XviD|DivX)\b/i,
      /\b(?:DTS(?::?X|-?HD)?|TrueHD|Atmos|DD(?:\+|P|-?EX)?|Dolby(?:[\s\.]?Digital)?|FLAC|AAC|AC-?3|E-?AC-?3|PCM|LPCM|Opus|Vorbis|WMA|MP3)\b/i,
      /\b(?:HDR10\+?|DV|HLG|SDR|10.?bit)\b/i,
      /\b(?:JAPANESE|ENGLISH|KOREAN|FRENCH|GERMAN|SPANISH|ITALIAN|RUSSIAN|HINDI|THAI|CHINESE|MANDARIN|CANTONESE|PORTUGUESE|POLISH|FINNISH|SWEDISH|NORWEGIAN|DANISH|DUTCH|TURKISH|LATINO|MULTI(?:-?AUDIO)?|DUAL(?:-?AUDIO)?)\b/i,
      /\b(?:MKV|MP4|AVI|WMV|M4V|TS)\b/i,
    ];

    let startIndex = Number.POSITIVE_INFINITY;
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match && match.index < startIndex) {
        startIndex = match.index;
      }
    }

    if (!Number.isFinite(startIndex)) return 0;
    return startIndex;
  };
  const normalizeSceneGroupName = (value = '') =>
    String(value)
      .replace(/[^A-Za-z0-9]+/g, '')
      .toUpperCase();
  const CONFIG_URL = 'https://raw.githubusercontent.com/anonymoize/GAZELL3D/main/config.json';
  const CACHE_KEY = typeof GM_info !== 'undefined' ? 'GAZELL3D_CONFIG_' + GM_info.script.version : 'GAZELL3D_CONFIG_V2';
  const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

  let SCENE_RELEASE_GROUPS = new Set();
  let SERVICE_TOKENS = [];
  let COUNTRY_MAP = {};
  let LANGUAGE_MAP = {};
  let TAG_STYLES = {};
  let RELEASE_GROUP_BLOCK_TOKENS = new Set();

  const loadConfig = async () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          console.log('GAZELL3D: Loaded config from cache');
          return data;
        }
      }
    } catch (e) {
      console.warn('GAZELL3D: Cache read error', e);
    }

    console.log('GAZELL3D: Fetching config...');
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: CONFIG_URL,
        onload: (response) => {
          if (response.status >= 200 && response.status < 300) {
            try {
              const data = JSON.parse(response.responseText);
              try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                  timestamp: Date.now(),
                  data
                }));
              } catch (e) {
                console.warn('GAZELL3D: Cache write error', e);
              }
              resolve(data);
            } catch (e) {
              reject(new Error('Config parse failed: ' + e.message));
            }
          } else {
            reject(new Error('Config fetch failed with status: ' + response.status));
          }
        },
        onerror: (err) => reject(new Error('Config fetch error: ' + err))
      });
    });
  };

  const initReleaseGroupBlockTokens = () => {
    const tokens = new Set([
      'WEB', 'DL', 'DUAL', 'AUDIO', 'SUBBED', 'DUBBED', 'MULTI', 'MULTISUB',
      'REMUX', 'REPACK', 'PROPER', 'LIMITED', 'COMPLETE', 'UNCENSORED',
      'UNRATED', 'THEATRICAL', 'EXTENDED', 'PACK', 'COLLECTION', 'SAMPLE',
      'HDR', 'SDR', 'ATMOS', 'DOLBY', 'TRUEHD', 'COMMENTARY',
    ]);
    const addTokens = (values) => {
      values.forEach((value) => tokenizeWords(value).forEach((token) => tokens.add(token)));
    };
    addTokens(RESOLUTIONS);
    addTokens(SERVICE_TOKENS);
    addTokens(SOURCE_PATTERNS.map((pattern) => pattern.value));
    addTokens(VIDEO_CODEC_PATTERNS.map((pattern) => pattern.value));
    addTokens(AUDIO_CODEC_PATTERNS.map((pattern) => pattern.value));
    addTokens(HDR_PATTERNS.map((pattern) => pattern.value));
    addTokens(CUT_PATTERNS.map((pattern) => pattern.value));
    return tokens;
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const parseColorString = (value) => {
    if (!value) return null;
    const rgbMatch = value.match(/rgba?\(([^)]+)\)/i);
    if (rgbMatch) {
      const parts = rgbMatch[1].split(',').map((part) => part.trim());
      if (parts.length >= 3) {
        const [r, g, b] = parts.slice(0, 3).map((part) => clamp(parseInt(part, 10) || 0, 0, 255));
        const a = parts[3] !== undefined ? clamp(parseFloat(parts[3]) || 0, 0, 1) : 1;
        return { r, g, b, a };
      }
    }
    return null;
  };
  const getRelativeLuminance = (color) => {
    if (!color) return 0;
    const toLinear = (component) => {
      const channel = component / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b);
  };
  const getEffectiveBackgroundColor = () => {
    const nodes = [document.body, document.documentElement];
    for (const node of nodes) {
      if (!node) continue;
      const value = window.getComputedStyle(node).backgroundColor;
      const color = parseColorString(value);
      if (color && color.a > 0) return color;
    }
    return { r: 17, g: 17, b: 17, a: 1 };
  };
  let cachedTooltipTheme;
  const getTooltipTheme = () => {
    if (cachedTooltipTheme) return cachedTooltipTheme;
    const bgColor = getEffectiveBackgroundColor();
    const isLightBackground = getRelativeLuminance(bgColor) > 0.5;
    cachedTooltipTheme = isLightBackground
      ? {
        bg: 'rgba(0, 0, 0, 0.82)',
        color: 'rgba(255, 255, 255, 0.95)',
        border: 'rgba(0, 0, 0, 0.25)',
      }
      : {
        bg: 'rgba(255, 255, 255, 0.96)',
        color: 'rgba(8, 11, 25, 0.95)',
        border: 'rgba(255, 255, 255, 0.35)',
      };
    return cachedTooltipTheme;
  };
  const applyTooltipTheme = (element) => {
    if (!element) return;
    const theme = getTooltipTheme();
    element.style.setProperty('--gz-tooltip-bg', theme.bg);
    element.style.setProperty('--gz-tooltip-color', theme.color);
    element.style.setProperty('--gz-tooltip-border', theme.border);
  };

  let tooltipElement;
  let tooltipTarget = null;
  let tooltipInitialized = false;

  const ensureTooltipElement = () => {
    if (tooltipElement) return tooltipElement;
    tooltipElement = create('div', 'gz-tooltip');
    applyTooltipTheme(tooltipElement);
    document.body.appendChild(tooltipElement);
    return tooltipElement;
  };

  const hideTooltip = () => {
    if (!tooltipElement) return;
    tooltipElement.classList.remove('gz-tooltip--visible');
  };

  const positionTooltip = (event) => {
    if (!tooltipElement) return;
    const offset = 16;
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const maxX = window.innerWidth - tooltipRect.width - 12;
    const maxY = window.innerHeight - tooltipRect.height - 12;
    const nextX = Math.min(Math.max(event.clientX + offset, 12), Math.max(12, maxX));
    const nextY = Math.min(Math.max(event.clientY + offset, 12), Math.max(12, maxY));
    tooltipElement.style.left = `${nextX}px`;
    tooltipElement.style.top = `${nextY}px`;
  };

  const showTooltip = (text) => {
    if (!text) return;
    const element = ensureTooltipElement();
    element.textContent = text;
    element.classList.add('gz-tooltip--visible');
  };

  const getTooltipTarget = (node) => (node instanceof Element ? node.closest('[data-gz-original]') : null);

  const handleTooltipEnter = (event) => {
    const target = getTooltipTarget(event.target);
    if (!target) return;
    const text = target.dataset.gzOriginal;
    if (!text) return;
    tooltipTarget = target;
    showTooltip(text);
    positionTooltip(event);
  };

  const handleTooltipLeave = (event) => {
    if (!tooltipTarget) return;
    const current = getTooltipTarget(event.target);
    if (current !== tooltipTarget) return;
    const next = getTooltipTarget(event.relatedTarget);
    if (next === tooltipTarget) return;
    tooltipTarget = null;
    hideTooltip();
  };

  const handleTooltipMove = (event) => {
    if (!tooltipTarget || !tooltipElement || !tooltipElement.classList.contains('gz-tooltip--visible')) return;
    positionTooltip(event);
  };

  const initTooltip = () => {
    if (tooltipInitialized) return;
    tooltipInitialized = true;
    document.addEventListener('mouseover', handleTooltipEnter);
    document.addEventListener('mouseout', handleTooltipLeave);
    document.addEventListener('mousemove', handleTooltipMove);
  };


  const ready = (cb) => {
    if (READY_STATES.includes(document.readyState)) {
      cb();
    } else {
      document.addEventListener('DOMContentLoaded', cb, { once: true });
    }
  };

  const injectStyles = (css) => {
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(css);
    } else {
      const tag = document.createElement('style');
      tag.textContent = css;
      document.head.appendChild(tag);
    }
  };

  const findPanelByHeading = (text) => {
    if (!text) return null;
    const target = normalizeText(text).toLowerCase();
    return $$('section.panelV2').find((panel) => getText(panel.querySelector('.panel__heading')).toLowerCase() === target);
  };

  const VIDEO_CODEC_PATTERNS = [
    { regex: /\bHEVC\b|\bH\.?265\b|\bH265\b|\bx265\b/i, value: 'H.265' },
    { regex: /\bAVC\b|\bH\.?264\b|\bH264\b|\bx264\b/i, value: 'H.264' },
    { regex: /\bVVC\b|\bH\.?266\b|\bH266\b|\bx266\b/i, value: 'H.266' },
    { regex: /\bAV1\b/i, value: 'AV1' },
    { regex: /\bVC-?1\b/i, value: 'VC-1' },
    { regex: /\bMPEG-?2\b/i, value: 'MPEG-2' },
    { regex: /\bMPEG-?1\b/i, value: 'MPEG-1' },
    { regex: /\bMPEG\b/i, value: 'MPEG' },
    { regex: /\bXvid\b/i, value: 'Xvid' },
    { regex: /\bDivX\b/i, value: 'DivX' },
    { regex: /\bJPEG2000\b/i, value: 'JPEG2000' },
  ];

  const RESOLUTIONS = ['4320p', '2160p', '1080p', '1080i', '720p', '576p', '576i', '540p', '480p', '480i', "360p", '240p', '144p'];

  const SOURCE_PATTERNS = [
    { regex: /\bUHD[\s-]*Blu-?ray\b/i, value: 'UHD BluRay' },
    { regex: /\bBlu-?ray\b/i, value: 'BluRay' },
    { regex: /\bWEB[-\s]?DL\b/i, value: 'WEB-DL' },
    { regex: /\bWEBRip\b/i, value: 'WEBRip' },
    { regex: /\bDVD(?:Rip)?\b|\bNTSC DVD[59]\b|\bPAL DVD[59]\b|\bDVD[59]\b/i, value: 'DVD' },
    { regex: /\bHD-?DVD\b|\bHDDVD\b/i, value: 'HD DVD' },
    { regex: /\bHDTV\b/i, value: 'HDTV' },
    { regex: /\bLaserDisc\b/i, value: 'LaserDisc' },
    { regex: /\bVHS\b/i, value: 'VHS' },
    { regex: /\bTV[-\s]?Rip\b|\bTV\b/i, value: 'TV' },
    { regex: /\bDCP\b/i, value: 'DCP' },
  ];

  const AUDIO_CHANNEL_PATTERN = /\b(?:1\.0|2\.0|2\.1|3\.0|3\.1|4\.0|4\.1|5\.0|5\.1|6\.1|7\.1)\b/i;

  const AUDIO_CODEC_PATTERNS = [
    { regex: /\bDTS-?HD\s*MA\b/i, value: 'DTS-HD MA' },
    { regex: /\bDTS-?HD\s*HRA\b/i, value: 'DTS-HD HRA' },
    { regex: /\bDTS-?HD\b/i, value: 'DTS-HD' },
    { regex: /\bDTS:?X\b/i, value: 'DTS:X' },
    { regex: /\bDTS-?ES\b/i, value: 'DTS-ES' },
    { regex: /\bDTS\b/i, value: 'DTS' },
    { regex: /\bTrueHD\b/i, value: 'TrueHD' },
    { regex: /\bDolby\s+Digital\s+EX\b|\bDD-?EX\b/i, value: 'DD-EX' },
    { regex: /DD\+|DDP|\bE-?AC-?3\b/i, value: 'DD+' },
    { regex: /\bDD\b|\bDolby Digital\b/i, value: 'DD' },
    { regex: /\bAAC\b/i, value: 'AAC' },
    { regex: /\bOpus\b/i, value: 'Opus' },
    { regex: /\bFLAC\b/i, value: 'FLAC' },
    { regex: /\bVorbis\b/i, value: 'Vorbis' },
    { regex: /\bLPCM\b|\bPCM\b/i, value: 'LPCM' },
    { regex: /\bMP3\b/i, value: 'MP3' },
    { regex: /\bMP2\b/i, value: 'MP2' }
  ];

  const HDR_PATTERNS = [
    { regex: /\bDV\s+HDR10\+/i, value: 'DV HDR10+' },
    { regex: /\bDV\s+HDR\b/i, value: 'DV HDR' },
    { regex: /\bHDR10\+/i, value: 'HDR10+' },
    { regex: /\bHLG\b/i, value: 'HLG' },
    { regex: /\bDV\b/i, value: 'DV' },
    { regex: /\bHDR\b/i, value: 'HDR' },
  ];

  const CUT_PATTERNS = [
    { regex: /Director'?s\s+Cut/i, value: "Director's Cut" },
    { regex: /\bTheatrical\b/i, value: 'Theatrical' },
    { regex: /\bExtended\b/i, value: 'Extended' },
    { regex: /\bUnrated\b/i, value: 'Unrated' },
    { regex: /\bRegraded\b/i, value: 'Regraded' },
    { regex: /\bRedux\b/i, value: 'Redux' },
    { regex: /\bSpecial\s+Edition\b/i, value: 'Special Edition' },
    { regex: /\bSuper\s+Duper\s+Cut\b/i, value: 'Super Duper Cut' },
    { regex: /\bOpen\s+Matte\b/i, value: 'Open Matte' },
    { regex: /\bUncensored\b/i, value: 'Uncensored' },
    { regex: /\bUncut\b/i, value: 'Uncut' },
    { regex: /\bRemastered\b/i, value: 'Remastered' },
    { regex: /\bRestored\b/i, value: 'Restored' },
    { regex: /\bAnniversary\s+Edition\b/i, value: 'Anniversary Edition' },
    { regex: /\bUltimate\s+Edition\b/i, value: 'Ultimate Edition' },
    { regex: /\bCollector'?s\s+Edition\b/i, value: "Collector's Edition" },
    { regex: /\bFinal\s+Cut\b/i, value: 'Final Cut' },
    { regex: /\bIMAX\b/i, value: 'IMAX' },
    { regex: /\bWorkprint\b/i, value: 'Workprint' },
  ];



  const isBlockedReleaseToken = (token) => {
    const value = token ? token.toUpperCase() : '';
    if (!value) return false;
    if (RELEASE_GROUP_BLOCK_TOKENS.has(value)) return true;
    if (/^\d{1,4}$/.test(value)) return true;
    if (/^(?:S|E)\d{1,3}$/i.test(value)) return true;
    return false;
  };

  const getReleaseGroupTokens = (candidate) => {
    const tokens = tokenizeWords(candidate);
    if (!tokens.length) return null;
    return tokens.some((token) => isBlockedReleaseToken(token)) ? null : tokens;
  };

  const extractReleaseGroup = (normalized) => {
    let best = null;
    let index = normalized.indexOf('-');
    while (index !== -1) {
      const candidate = normalized.slice(index + 1).trim();
      const tokens = candidate && /\w/.test(candidate) ? getReleaseGroupTokens(candidate) : null;
      if (tokens) {
        const score = tokens.length * 100 + candidate.length;
        if (!best || score > best.score) {
          best = { score, value: candidate, index };
        }
      }
      index = normalized.indexOf('-', index + 1);
    }
    if (best) {
      return {
        group: best.value,
        baseTitle: normalized.slice(0, best.index).trim(),
      };
    }
    return { group: 'NOGRP', baseTitle: normalized };
  };

  const formatTorrentName = (name, { typeLabel } = {}) => {
    if (!name) return '';
    const normalized = name.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    const { group, baseTitle } = extractReleaseGroup(normalized);

    const getMatchFromPatterns = (patterns, text) => {
      const found = patterns.find((pattern) => pattern.regex.test(text));
      return found ? found.value : '';
    };

    const videoCodec = getMatchFromPatterns(VIDEO_CODEC_PATTERNS, baseTitle) || 'UNKNOWN';
    const bitDepth =
      /\bHi10P\b.*\bx264\b/i.test(baseTitle) ? 'Hi10P' : '';
    const resolution =
      RESOLUTIONS.find((res) => new RegExp(`\\b${res}\\b`, 'i').test(baseTitle)) || 'UNKNOWN';
    const source = (() => {
      const discPattern = /\b(?:(NTSC|PAL)\s*)?(?:([1-9]\d*)x)?DVD([59])\b/gi;
      const discMatches = Array.from(baseTitle.matchAll(discPattern));
      if (discMatches.length) {
        const parts = discMatches.map(([, region, count, size]) =>
          region ? `${region} ${count ? `${count}x` : ''}DVD${size}` : `${count ? `${count}x` : ''}DVD${size}`
        );
        const uniqueParts = parts.filter((value, index, arr) => arr.indexOf(value) === index);
        return uniqueParts.join(' / ');
      }
      return getMatchFromPatterns(SOURCE_PATTERNS, baseTitle) || 'UNKNOWN';
    })();

    const isWebSource = /\bWEB(?:[-\s]?DL|Rip)\b/i.test(baseTitle);
    const metadataStart = findMetadataStartIndex(baseTitle);
    const metadataSlice = metadataStart ? baseTitle.slice(metadataStart) : baseTitle;
    const service =
      isWebSource
        ? (() => {
          const serviceRegex = new RegExp(
            `\\b(${SERVICE_TOKENS.join('|')})\\b(?=[^\\n]*\\bWEB(?:-?DL|Rip)\\b)`,
            'i'
          );
          const fallbackRegex = new RegExp(`\\b(${SERVICE_TOKENS.join('|')})\\b`, 'i');
          const match = serviceRegex.exec(metadataSlice) || fallbackRegex.exec(metadataSlice);
          if (!match) return '';
          const token = match[1];
          return SERVICE_TOKENS.find((candidate) => candidate.toLowerCase() === token.toLowerCase()) || token;
        })()
        : '';

    const isFullDisc =
      typeof typeLabel === 'string' && typeLabel.trim().toLowerCase().includes('full disc');
    const hasDiscContext = /\b(?:PAL|NTSC|SECAM|DVD\d?|Blu-ray|BD|UHD)\b/i.test(baseTitle);
    const country =
      isFullDisc || hasDiscContext
        ? (() => {
          const countryRegex = new RegExp(
            `\\b(${Object.keys(COUNTRY_MAP).join('|')})\\b`,
            'i'
          );
          const match = countryRegex.exec(baseTitle);
          if (!match) return '';
          const token = match[1].toUpperCase();
          return COUNTRY_MAP[token] || token;
        })()
        : '';

    const seasonEpisode = (() => {
      const patterns = [
        /S\d{2}E\d{2}(?:E\d{2})+/i,
        /S\d{2}E\d{2}-E\d{2}/i,
        /S\d{2}E\d{2}/i,
        /S\d{2}-S\d{2}/i,
        /S\d{2}/i,
      ];
      const matchPattern = patterns.find((pattern) => pattern.test(baseTitle));
      return matchPattern ? baseTitle.match(matchPattern)[0].toUpperCase() : '';
    })();

    const language = (() => {
      if (/Dual[-\s]?Audio/i.test(baseTitle)) {
        return 'Dual-Audio';
      }
      if (/\bDubbed\b/i.test(baseTitle)) {
        return 'Dubbed';
      }
      const languageRegex = new RegExp(
        `\\b(${Object.keys(LANGUAGE_MAP).join('|')})\\b`,
        'i'
      );
      const match = languageRegex.exec(metadataSlice);
      if (!match) return '';
      const key = match[1].toUpperCase();
      if (service && key === service) {
        return '';
      }
      return LANGUAGE_MAP[key] || match[1];
    })();

    const audioCodec = getMatchFromPatterns(AUDIO_CODEC_PATTERNS, baseTitle) || 'UNKNOWN';
    const audioChannels = (() => {
      const match = AUDIO_CHANNEL_PATTERN.exec(baseTitle);
      return match ? match[0].toUpperCase() : '';
    })();
    const audioCodecWithChannels = [audioCodec, audioChannels].filter(Boolean).join(' ');
    const atmos = /\bAtmos\b/i.test(baseTitle) ? 'Atmos' : '';
    const hdr = getMatchFromPatterns(HDR_PATTERNS, baseTitle);
    const hybrid = /\bHybrid\b/i.test(baseTitle) ? 'Hybrid' : '';
    const remux = /\bRemux\b/i.test(baseTitle) ? 'Remux' : '';
    const repackProper = (() => {
      const match = /\b(REPACK(?:\d+)?|PROPER(?:\d+)?)\b/i.exec(baseTitle);
      return match ? match[1].toUpperCase() : '';
    })();
    const cut = getMatchFromPatterns(CUT_PATTERNS, baseTitle);
    const scene = (() => {
      if (!group || group === 'NOGRP') return '';
      const normalizedGroupName = normalizeSceneGroupName(group);
      if (!normalizedGroupName) return '';
      return SCENE_RELEASE_GROUPS.has(normalizedGroupName) ? 'Scene' : '';
    })();

    const partValues = {
      videoCodec,
      bitDepth,
      resolution,
      country,
      service,
      source,
      remux,
      seasonEpisode,
      language,
      audio: audioCodecWithChannels,
      atmos,
      hdr,
      hybrid,
      cut,
      repack: repackProper,
      scene,
      group: group || 'NOGRP',
    };

    const isSimilarPage = window.location.pathname.includes('/similar');
    const shouldHideSeasonEpisode = CONFIG.enableGazelleTorrentLayout && isSimilarPage;

    return GAZELLIFY_SEQUENCE
      .filter((key) => !(shouldHideSeasonEpisode && key === 'seasonEpisode'))
      .map((key) => ({ category: key, value: partValues[key] }))
      .filter((part) => Boolean(part.value));
  };

  const buildSearchDisplay = (text) => {
    const normalized = normalizeText(text);
    if (!normalized) return { heading: '', subtitle: [] };
    const yearMatch = normalized.match(/\b(19|20)\d{2}\b/);
    let headingTitle = normalized;
    let yearText = '';
    if (yearMatch) {
      yearText = yearMatch[0];
      headingTitle = normalized.slice(0, yearMatch.index).replace(/[-–_.]+$/g, '').trim();
    }
    if (!headingTitle) headingTitle = normalized;

    const heading = yearText ? `${headingTitle} (${yearText})` : headingTitle;
    const subtitle = formatTorrentName(normalized);
    return { heading, subtitle };
  };

  const updateDetailTitle = () => {
    if (!CONFIG.enableGazellifyDetail) return;
    const headline = document.querySelector('.torrent__name');
    if (!headline || headline.dataset.gzDetail === '1') return;
    setOriginalTitle(headline);
    const metaTitle = document.querySelector('.meta__title');
    if (!metaTitle) return;
    const titleText = getText(metaTitle.childNodes[0] || '');
    if (!titleText) return;
    const yearNode = metaTitle.querySelector('span');
    const yearText = yearNode ? yearNode.textContent.replace(/[()]/g, '').trim() : '';
    const heading = yearText ? `${titleText} (${yearText})` : titleText;
    const originalHeadline = headline.dataset.gzOriginal || headline.textContent || '';
    const subtitle = formatTorrentName(originalHeadline);
    if (!subtitle || subtitle.length === 0) return;

    const wrapper = create('div', 'gz-detail-title');
    const headingEl = create('div', 'gz-detail-title__heading');
    headingEl.textContent = heading;
    const subEl = create('div', 'gz-detail-title__subheading');
    applyUnknownHighlight(subEl, subtitle);
    wrapper.append(subEl);

    headline.textContent = '';
    headline.appendChild(wrapper);
    headline.dataset.gzDetail = '1';
  };

  const gazellifySearchResults = () => {
    if (!CONFIG.enableGazellifySearch) return;
    $$(SELECTORS.searchResults).forEach((link) => {
      if (!link || link.dataset.gzSearch === '1') return;
      setOriginalTitle(link);
      const container = link.closest('.torrent-search--list__overview')?.closest('tr');
      const popupTitle = container?.querySelector('.meta__poster-popup-title');
      const popupYear = container?.querySelector('.meta__poster-popup-year');
      const popupHeading = popupTitle ? popupTitle.childNodes[0]?.textContent.trim() : '';
      const popupYearText = popupYear ? popupYear.textContent.replace(/[()]/g, '').trim() : '';
      const raw = normalizeText(link.dataset.gzOriginal || link.textContent || '');
      if (!raw) return;
      const { heading, subtitle } = popupHeading
        ? {
          heading: popupYearText ? `${popupHeading} (${popupYearText})` : popupHeading,
          subtitle: formatTorrentName(raw),
        }
        : buildSearchDisplay(raw);
      if (!heading || !subtitle || subtitle.length === 0) return;

      link.textContent = '';
      const wrapper = create('div', 'gz-search-title');
      const headingEl = create('div', 'gz-search-title__heading');
      headingEl.textContent = heading;
      const subEl = create('div', 'gz-search-title__subheading');
      applyUnknownHighlight(subEl, subtitle);
      wrapper.append(headingEl, subEl);

      // Add a visually-hidden span with the original release name for Seadex compatibility
      // Seadex's getReleaseByReleaseName reads innerText to match release groups
      const hiddenOriginal = create('span', 'gz-hidden-original');
      hiddenOriginal.textContent = raw;
      hiddenOriginal.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
      hiddenOriginal.setAttribute('aria-hidden', 'true');

      link.appendChild(wrapper);
      link.appendChild(hiddenOriginal);
      link.dataset.gzSearch = '1';
    });
  };

  const watchSearchResults = () => {
    if (!CONFIG.enableGazellifySearch) return;
    if (searchResultsObserver) {
      searchResultsObserver.disconnect();
      searchResultsObserver = null;
    }
    const searchPage = $(SELECTORS.torrentSearchPage);
    if (!searchPage) return;
    searchResultsObserver = new MutationObserver(() => gazellifySearchResults());
    searchResultsObserver.observe(searchPage, { childList: true, subtree: true });
  };

  const findTorrentTypeForHeading = (heading) => {
    const row = heading.closest('tr');
    if (!row) return '';
    let current = row;
    while (current) {
      const typeCell = current.querySelector('.similar-torrents__type');
      if (typeCell) return typeCell.textContent.replace(/\s+/g, ' ').trim();
      current = current.previousElementSibling;
    }
    return '';
  };

  const gazellify = () => {
    if (!CONFIG.enableGazellifySimilar) return;
    const panel = $(SELECTORS.torrentGroup);
    if (!panel) return;
    $$('.torrent-search--grouped__name', panel).forEach((heading) => {
      const link = $('a', heading);
      if (!link) return;
      setOriginalTitle(link);
      const sourceText = link.dataset.gzOriginal || link.textContent || '';
      const formatted = formatTorrentName(sourceText, {
        typeLabel: findTorrentTypeForHeading(heading),
      });
      if (formatted && formatted.length > 0) {
        applyUnknownHighlight(link, formatted);
      }
    });
  };

  let torrentIconObserver;
  let torrentIconTarget;
  let searchResultsObserver;

  const stripTorrentDecorations = () => {
    $$('.torrent-icons').forEach((node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (
          child.nodeType === 1 &&
          (child.hasAttribute('data-seadex') ||
            child.classList.contains('torrent-icons__torrent-trump') ||
            child.classList.contains('torrent-icons__personal-release') ||
            child.classList.contains('torrent-icons__internal'))
        ) {
          return;
        }
        child.remove();
      });
    });

    if (!CONFIG.showEditButton) {
      $$('.torrent-search--grouped__edit a[title="Edit"]').forEach((node) => node.remove());
    }
  };

  const applyGazelleButtons = () => {
    if (!CONFIG.enableGazelleButtons) return;

    const tables = $$(SELECTORS.torrentTable);
    if (!tables.length) return;

    tables.forEach((table) => {
      // Check/Update Header
      const actionsHeader = table.querySelector('.similar-torrents__actions-header');
      if (actionsHeader && actionsHeader.getAttribute('colspan') !== '1') {
        actionsHeader.setAttribute('colspan', '1');
      }

      // Update Rows
      $$('tbody tr', table).forEach((row) => {
        // Check if already processed
        if (row.querySelector('.gz-actions-cell')) return;

        const editCell = row.querySelector('.torrent-search--grouped__edit');
        const bookmarkCell = row.querySelector('.torrent-search--grouped__bookmark');
        const downloadCell = row.querySelector('.torrent-search--grouped__download');

        if (!editCell && !bookmarkCell && !downloadCell) return;

        const newCell = create('td', 'gz-actions-cell');
        const parts = [];

        // Edit Button
        if (editCell) {
          if (CONFIG.showEditButton) {
            const link = $('a', editCell);
            if (link) {
              link.textContent = 'ED';
              link.removeAttribute('title');
              parts.push(link);
            }
          }
          editCell.remove();
        }

        // Bookmark Button
        if (bookmarkCell) {
          const btn = $('button', bookmarkCell);
          if (btn) {
            // Preserve the button but replace content
            btn.textContent = 'BM';
            parts.push(btn);
          }
          bookmarkCell.remove();
        }

        // Download Button
        if (downloadCell) {
          const link = $('a', downloadCell);
          if (link) {
            link.textContent = 'DL';
            parts.push(link);
          }
          downloadCell.remove();
        }

        // Assemble: [ ED | BM | DL ]
        newCell.appendChild(document.createTextNode('[ '));
        parts.forEach((part, index) => {
          if (index > 0) {
            newCell.appendChild(document.createTextNode(' | '));
          }
          newCell.appendChild(part);
        });
        newCell.appendChild(document.createTextNode(' ]'));

        // Insert new cell where the others were.
        const overview = row.querySelector('.torrent-search--grouped__overview');
        if (overview) {
          overview.insertAdjacentElement('afterend', newCell);
        } else {
          // Fallback
          const size = row.querySelector('.torrent-search--grouped__size');
          if (size) {
            size.insertAdjacentElement('beforebegin', newCell);
          }
        }
      });
    });
  };

  const watchTorrentDecorations = () => {
    if (!CONFIG.removeTorrentIcons && !CONFIG.enableGazelleButtons) return;

    const runTransforms = () => {
      if (CONFIG.removeTorrentIcons) stripTorrentDecorations();
      if (CONFIG.enableGazelleButtons) applyGazelleButtons();
    };

    runTransforms();

    // Observe the main torrent container group to catch changes (pagination, filters, expanding seasons)
    const targetNode = $(SELECTORS.torrentGroup);

    if (!targetNode) {
      // Fallback to table if group not found, though group is safer for multi-table pages
      const table = $(SELECTORS.torrentTable);
      if (!table) {
        if (torrentIconObserver) {
          torrentIconObserver.disconnect();
          torrentIconObserver = null;
          torrentIconTarget = null;
        }
        return;
      }
      if (torrentIconTarget === table) return;
      if (torrentIconObserver) torrentIconObserver.disconnect();
      torrentIconObserver = new MutationObserver(runTransforms);
      torrentIconObserver.observe(table, { childList: true, subtree: true });
      torrentIconTarget = table;
      return;
    }

    if (torrentIconTarget === targetNode) return;

    if (torrentIconObserver) {
      torrentIconObserver.disconnect();
    }

    torrentIconObserver = new MutationObserver(runTransforms);
    torrentIconObserver.observe(targetNode, { childList: true, subtree: true });
    torrentIconTarget = targetNode;
  };

  const createLayoutContainer = (article, referenceNode = null) => {
    const layout = create('div', 'gz-similar-layout');
    const left = create('div', 'gz-similar-layout__column gz-similar-layout__column--left');
    const right = create('div', 'gz-similar-layout__column gz-similar-layout__column--right');

    layout.append(left, right);

    const insertBefore = referenceNode || article.firstElementChild || null;
    if (insertBefore) {
      article.insertBefore(layout, insertBefore);
    } else {
      article.appendChild(layout);
    }

    return { layout, left, right };
  };

  const createMetaPanels = (meta, isSimilarPage = false) => {
    if (!meta) return { panels: [], leftPanels: [] };

    const panels = [];
    const leftPanels = [];

    const createPanel = (title) => {
      const panel = create('section', 'panelV2 gz-panel');
      if (title) {
        const header = create('header', 'panel__header');
        const heading = create('h2', 'panel__heading');
        heading.textContent = title;
        header.appendChild(heading);
        panel.appendChild(header);
      }
      const content = create('div', 'panel__body');
      panel.appendChild(content);
      return { panel, content };
    };

    // 1. Cover Panel
    const poster = $('.meta__poster-link', meta);
    const buttons = $('.torrent__buttons', meta);
    if (poster || buttons) {
      const { panel, content } = createPanel('Cover');
      if (poster && !buttons) {
        content.style.padding = '0'; // If it's just the image, remove padding for a cleaner look
      }
      if (poster) content.appendChild(poster);
      if (buttons) content.appendChild(buttons);
      panels.push(panel);
    }

    // 2. Tags Panel
    const tags = $('.work__tags', meta);
    if (tags) {
      const { panel, content } = createPanel('Tags');
      content.appendChild(tags);
      panels.push(panel);
    }

    // 3. Links Panel
    const metaIds = $('.meta__ids', meta);
    if (metaIds) {
      const { panel, content } = createPanel('Links');
      content.appendChild(metaIds);
      panels.push(panel);
    }

    // 4. Synopsis Panel (similar page only)
    const description = $('.meta__description', meta);
    if (description && isSimilarPage) {
      const synopsisSection = create('section', 'panelV2 gz-left-panel');
      const synopsisHeader = create('header', 'panel__header');
      const synopsisHeading = create('h2', 'panel__heading');
      synopsisHeading.textContent = 'Synopsis';
      synopsisHeader.appendChild(synopsisHeading);
      synopsisSection.appendChild(synopsisHeader);
      const synopsisBody = create('div', 'panel__body');
      synopsisBody.style.padding = '1rem';
      description.style.margin = '0';
      description.style.padding = '0';
      description.style.border = 'none';
      description.style.background = 'transparent';
      description.style.fontSize = '0.9em';
      description.style.lineHeight = '1.6';
      synopsisBody.appendChild(description);
      synopsisSection.appendChild(synopsisBody);
      leftPanels.push(synopsisSection);
    }

    // 5. Movie Info Panel
    const infoSections = [];
    const processChipSection = (label, displayTitle) => {
      const match = $$('.meta__chip-container', meta).find(
        (section) => getText(section.querySelector('.meta__heading')).toLowerCase() === label
      );
      if (!match) return false;

      const chips = $$('.meta-chip', match);
      if (chips.length > 0) {

        const appendItems = (items, heading) => {
          if (!items.length) return false;
          const row = create('div', 'gz-movie-info-group');
          const hr = create('h3', 'gz-chip-heading');
          hr.textContent = heading;
          row.appendChild(hr);

          const content = create('div', 'gz-movie-info-content');
          items.forEach((item, idx) => {
            if (item.url) {
              const a = create('a', '');
              a.href = item.url;
              a.textContent = item.name;
              content.appendChild(a);
            } else {
              content.appendChild(document.createTextNode(item.name));
            }
            if (idx < items.length - 1) {
              content.appendChild(document.createTextNode(', '));
            }
          });
          row.appendChild(content);
          infoSections.push(row);
          return true;
        };

        if (label === 'cast' && isSimilarPage) {
          const actors = chips.map(chip => {
            const nameEl = chip.querySelector('.meta-chip__name'); // Actor
            const charEl = chip.querySelector('.meta-chip__value'); // Character
            const url = chip.tagName === 'A' ? chip.href : (chip.querySelector('a') ? chip.querySelector('a').href : '');
            return {
              name: nameEl ? getText(nameEl) : '',
              char: charEl ? getText(charEl) : '',
              url
            };
          }).filter(a => a.name);

          if (actors.length) {
            const castSection = create('section', 'panelV2 gz-left-panel');
            const castHeader = create('header', 'panel__header');
            const castHeading = create('h2', 'panel__heading');
            castHeading.textContent = displayTitle;
            castHeader.appendChild(castHeading);

            // Add show all / show less toggle
            const CAST_DEFAULT_COUNT = 6;
            if (actors.length > CAST_DEFAULT_COUNT) {
              const toggleActions = create('div', 'panel__actions');
              const toggleBtn = create('a', 'gz-cast-toggle-btn');
              toggleBtn.textContent = 'Show All';
              toggleBtn.href = '#';
              toggleActions.appendChild(toggleBtn);
              castHeader.appendChild(toggleActions);
            }

            castSection.appendChild(castHeader);
            const castBody = create('div', 'panel__body gz-cast-grid');

            actors.forEach((actor, idx) => {
              const row = create('div', 'gz-cast-row');
              if (idx >= CAST_DEFAULT_COUNT) {
                row.style.display = 'none';
                row.classList.add('gz-cast-hidden');
              }
              const actorName = create('div', 'gz-cast-actor');
              if (actor.url) {
                const a = create('a', '');
                a.href = actor.url;
                a.textContent = actor.name;
                actorName.appendChild(a);
              } else {
                actorName.textContent = actor.name;
              }
              const charName = create('div', 'gz-cast-character');
              charName.textContent = actor.char;
              row.appendChild(actorName);
              row.appendChild(charName);
              castBody.appendChild(row);
            });
            castSection.appendChild(castBody);

            // Wire up toggle
            if (actors.length > CAST_DEFAULT_COUNT) {
              const toggleBtn = castSection.querySelector('.gz-cast-toggle-btn');
              let expanded = false;
              toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                expanded = !expanded;
                castBody.querySelectorAll('.gz-cast-hidden').forEach(row => {
                  row.style.display = expanded ? '' : 'none';
                });
                toggleBtn.textContent = expanded ? 'Show Less' : 'Show All';
              });
            }

            leftPanels.push(castSection);
          }
          return true;
        } else if (label === 'cast') {
          // On torrent page, skip cast entirely
          return true;
        } else if (label === 'crew' || label === 'extra information') {
          const grouped = {};
          chips.forEach(chip => {
            const nameEl = chip.querySelector('.meta-chip__name'); // Role / Company
            const valEl = chip.querySelector('.meta-chip__value'); // Person / Genre
            const url = chip.tagName === 'A' ? chip.href : (chip.querySelector('a') ? chip.querySelector('a').href : '');

            const roleText = nameEl ? getText(nameEl) : 'Other';
            let valText = valEl ? getText(valEl) : '';
            if (!valText && nameEl) valText = getText(nameEl);

            if (valText && roleText) {
              if (!grouped[roleText]) grouped[roleText] = [];
              const cleanVal = valText.replace(/\\s+/g, ' ').trim();
              if (cleanVal && !grouped[roleText].find(i => i.name === cleanVal)) {
                grouped[roleText].push({ name: cleanVal, url });
              }
            }
          });

          let added = false;
          for (const [role, items] of Object.entries(grouped)) {
            let roleLabel = role;
            if (items.length > 1 && !role.toLowerCase().endsWith('s')) roleLabel += 's';
            appendItems(items, roleLabel);
            added = true;
          }
          return added;
        } else {
          const items = chips.map(chip => {
            const valEl = chip.querySelector('.meta-chip__value');
            const url = chip.tagName === 'A' ? chip.href : (chip.querySelector('a') ? chip.querySelector('a').href : '');
            const name = valEl ? getText(valEl) : (chip.querySelector('.meta-chip__name') ? getText(chip.querySelector('.meta-chip__name')) : '');
            return { name, url };
          }).filter(i => i.name);
          appendItems(items, displayTitle);
          return true;
        }
      }
      return false;
    };

    // Convert multiple specific roles typically found on Unit3D pages
    processChipSection('directors', 'Directors');
    processChipSection('writers', 'Writers');
    processChipSection('producers', 'Producers');
    processChipSection('composers', 'Composers');
    processChipSection('cinematographers', 'Cinematographers');
    // Fallback for general cast/crew chips
    processChipSection('cast', 'Cast');
    processChipSection('crew', 'Crew');
    processChipSection('extra information', 'Extra Information');

    if (infoSections.length > 0) {
      const { panel, content } = createPanel('Movie Info');
      infoSections.forEach((section, idx) => {
        content.appendChild(section);
      });
      panels.push(panel);
    }

    meta.remove();
    return { panels, leftPanels };
  };

  const expandAllTorrentGroups = () => {
    const section = $(SELECTORS.torrentGroup);
    if (!section) return;
    $$('.torrent-search--grouped__dropdown', section).forEach((dropdown) => {
      dropdown.setAttribute('open', '');
    });
  };

  // =====================
  // Torrent Dropdown Feature
  // =====================

  // Cache for fetched torrent data
  let torrentDataCache = null;
  let torrentDataPromise = null;

  // Extract TMDB ID from the page
  const getTmdbIdFromPage = () => {
    const tmdbLink = document.querySelector('li.meta__tmdb > a.meta-id-tag');
    if (tmdbLink && tmdbLink.title) {
      const match = tmdbLink.title.match(/:\s*(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
    return null;
  };

  // Fetch all torrents for a given TMDB ID (with pagination support)
  const fetchTorrentsByTmdb = async (tmdbId) => {
    if (torrentDataCache) return torrentDataCache;
    if (torrentDataPromise) return torrentDataPromise;

    if (!AITHER_API_KEY || AITHER_API_KEY === 'YOUR_API_KEY_HERE') {
      console.warn('GAZELL3D: Aither API key not configured');
      return null;
    }

    torrentDataPromise = (async () => {
      try {
        const dataMap = new Map();
        let currentPage = 1;
        let hasMorePages = true;
        const perPage = 100;

        while (hasMorePages) {
          const response = await gmFetchJson(
            `https://aither.cc/api/torrents/filter?perPage=${perPage}&page=${currentPage}&tmdbId=${tmdbId}`,
            {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${AITHER_API_KEY}`
              }
            }
          );

          if (!response || !response.data) {
            if (currentPage === 1) {
              console.warn('GAZELL3D: Empty API response');
              return null;
            }
            // No more data on subsequent page, we're done
            break;
          }

          // Add torrents from this page to the map
          response.data.forEach(torrent => {
            dataMap.set(torrent.id, torrent.attributes);
          });

          // Check if there are more pages to fetch
          // If we got fewer results than perPage, we've reached the last page
          if (response.data.length < perPage) {
            hasMorePages = false;
          } else {
            currentPage++;
            // Safety limit to prevent infinite loops (max 20 pages = 2000 torrents)
            if (currentPage > 20) {
              console.warn('GAZELL3D: Reached maximum page limit (20 pages)');
              hasMorePages = false;
            }
          }
        }

        if (dataMap.size > 0) {
          console.log(`GAZELL3D: Fetched ${dataMap.size} torrents across ${currentPage} page(s)`);
        }

        torrentDataCache = dataMap;
        return dataMap;
      } catch (err) {
        console.error('GAZELL3D: Failed to fetch torrent data', err);
        return null;
      }
    })();

    return torrentDataPromise;
  };

  // Format bytes to human readable
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Format date string
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const sanitizeUrl = (url, isImage) => {
    let sanitized = url;
    if (sanitized.startsWith('/')) {
      sanitized = 'https://aither.cc' + sanitized;
    } else if (!/^https?:\/\/|^irc:\/\/|^ftp:\/\/|^sftp:\/\/|^magnet:/i.test(sanitized)) {
      sanitized = 'https://' + sanitized;
    }
    if (/^javascript:/i.test(sanitized) || /^data:/i.test(sanitized) || /^vbscript:/i.test(sanitized)) {
      return 'Broken link';
    }
    return sanitized;
  };

  const handleBlockElementSpacing = (sourceObj, tagStartIndex, tagStopIndex) => {
    let source = sourceObj.source;
    let index = sourceObj.index;

    // Remove up to 2 line breaks AFTER the tag
    for (let i = 0; i < 2; i++) {
      let maxIdx = source.length - 1;
      if (tagStopIndex + 2 <= maxIdx && source.substring(tagStopIndex + 1, tagStopIndex + 3) === "\r\n") {
        source = source.substring(0, tagStopIndex + 1) + source.substring(tagStopIndex + 3);
      } else if (tagStopIndex + 1 <= maxIdx && source.charAt(tagStopIndex + 1) === "\n") {
        source = source.substring(0, tagStopIndex + 1) + source.substring(tagStopIndex + 2);
      }
    }

    // Remove up to 2 line breaks BEFORE the tag
    if (tagStartIndex >= 2 && source.substring(tagStartIndex - 2, tagStartIndex) === "\r\n") {
      source = source.substring(0, tagStartIndex - 2) + source.substring(tagStartIndex);
      index -= 2;
    } else if (tagStartIndex >= 1 && source.charAt(tagStartIndex - 1) === "\n") {
      source = source.substring(0, tagStartIndex - 1) + source.substring(tagStartIndex);
      index -= 1;
    }

    sourceObj.source = source;
    sourceObj.index = index;
  };

  const parseBBCode = (text) => {
    if (!text) return '';
    let source = text;

    // Escape HTML first
    source = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    // Void elements
    source = source.replace(/\[\*\]/g, '<li>');
    source = source.replace(/\[hr\]/gi, '<hr>');

    // Links & Images
    source = source.replace(/\[url](.*?)\[\/url]/gi, (m, p1) => `<a href="${sanitizeUrl(p1)}">${sanitizeUrl(p1)}</a>`);
    source = source.replace(/\[url=(.*?)](.*?)\[\/url]/gi, (m, p1, p2) => `<a href="${sanitizeUrl(p1)}">${p2}</a>`);
    source = source.replace(/\[img](.*?)\[\/img]/gi, (m, p1) => `<img src="${sanitizeUrl(p1)}" loading="lazy" class="img-responsive" style="display: inline !important;">`);
    source = source.replace(/\[img width=(\d+)](.*?)\[\/img]/gi, (m, p1, p2) => `<img src="${sanitizeUrl(p2)}" loading="lazy" width="${p1}px">`);
    source = source.replace(/\[img=(\d+)(?:x\d+)?](.*?)\[\/img]/gi, (m, p1, p2) => `<img src="${sanitizeUrl(p2)}" loading="lazy" width="${p1}px">`);

    // Youtube & Video
    const videoIframe = (m, p1) => `<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/${p1}?rel=0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    source = source.replace(/\[youtube]([a-z0-9_-]{11})\[\/youtube]/gi, videoIframe);
    source = source.replace(/\[video]([a-z0-9_-]{11})\[\/video]/gi, videoIframe);
    source = source.replace(/\[video=&quot;youtube&quot;]([a-z0-9_-]{11})\[\/video]/gi, videoIframe);

    // Comparisons (Basic fallback for JS)
    source = source.replace(/\[comparison=(.*?)]\s*(.*?)\s*\[\/comparison]/gis, (m, p1, p2) => {
      const comparates = p1.split(/\s*,\s*/).filter(c => c.trim().length > 0);
      const urls = p2.split(/\s*(?:,|\s)\s*/).filter(u => u.trim().length > 0);

      if (comparates.length === 0 || urls.length === 0) return 'Broken comparison';
      const validatedUrls = urls.map(u => sanitizeUrl(u, true));

      const chunkedUrls = [];
      for (let i = 0; i < validatedUrls.length; i += comparates.length) {
        chunkedUrls.push(validatedUrls.slice(i, i + comparates.length));
      }

      let html = `<div class="comparison" x-data="{ show: false }">`;
      html += `<div class="comparison__text">`;
      comparates.forEach((comp, idx) => {
        html += (idx === comparates.length - 1) ? `${comp}:` : `${comp} <span class="comparison__divider">vs</span> `;
      });
      html += ` <button class="comparison__button" x-on:click.prevent="show = true; $nextTick(() => $refs.screenshots.focus())" x-on:keydown.escape.window="show = false">Show</button>`;
      html += `</div>`;

      html += `<ul class="comparison__screenshots" tabindex="-1" x-ref="screenshots" x-show="show" x-cloak `;
      html += `x-on:click="show = false" `;
      html += `x-on:keydown.down.window="if (show) { $event.preventDefault(); $event.stopPropagation(); $el.scrollBy(0, $el.getElementsByTagName('li')[0].offsetHeight); }" `;
      html += `x-on:keydown.up.window="if (show) { $event.preventDefault(); $event.stopPropagation(); $el.scrollBy(0, -1 * $el.getElementsByTagName('li')[0].offsetHeight); }">`;

      chunkedUrls.forEach((row, rowIdx) => {
        html += `<li>`;
        html += `<ul class="comparison__row" x-data="{ screen: 1 }" `;
        html += `x-on:keydown.window="if (isFinite($event.key) && 1 <= $event.key && $event.key <= ${comparates.length}) { screen = $event.key; }" `;
        html += `x-on:keydown.left.window="if (show) { $event.preventDefault(); $event.stopPropagation(); screen = screen == 1 ? ${comparates.length} : screen - 1; }" `;
        html += `x-on:keydown.right.window="if (show) { $event.preventDefault(); $event.stopPropagation(); screen = screen == ${comparates.length} ? 1 : screen + 1; }" `;
        html += `x-on:mousemove.window="screen = Math.ceil(($event.clientX * ${comparates.length}) / window.innerWidth)">`;

        row.forEach((url, urlIdx) => {
          const iteration = urlIdx + 1;
          html += `<li class="comparison__image-container" x-bind:class="screen != ${iteration} && 'comparison__image-container--hidden'">`;
          html += `<figure class="comparison__figure">`;
          if (rowIdx === 0) { // first row gets figcaption
            html += `<figcaption class="comparison__figcaption">${comparates[urlIdx]}</figcaption>`;
          }
          html += `<img class="comparison__image" src="${url}" loading="lazy" x-bind:class="screen != ${iteration} && 'comparison__image--hidden'" />`;
          html += `</figure></li>`;
        });
        html += `</ul></li>`;
      });
      html += `</ul></div>`;
      return html;
    });

    const parsers = {
      h1: { open: /^\[h1\]/i, close: '[/h1]', openHtml: '<h1>', closeHtml: '</h1>', block: true },
      h2: { open: /^\[h2\]/i, close: '[/h2]', openHtml: '<h2>', closeHtml: '</h2>', block: true },
      h3: { open: /^\[h3\]/i, close: '[/h3]', openHtml: '<h3>', closeHtml: '</h3>', block: true },
      h4: { open: /^\[h4\]/i, close: '[/h4]', openHtml: '<h4>', closeHtml: '</h4>', block: true },
      h5: { open: /^\[h5\]/i, close: '[/h5]', openHtml: '<h5>', closeHtml: '</h5>', block: true },
      h6: { open: /^\[h6\]/i, close: '[/h6]', openHtml: '<h6>', closeHtml: '</h6>', block: true },
      bold: { open: /^\[b\]/i, close: '[/b]', openHtml: '<b>', closeHtml: '</b>', block: false },
      italic: { open: /^\[i\]/i, close: '[/i]', openHtml: '<i>', closeHtml: '</i>', block: false },
      underline: { open: /^\[u\]/i, close: '[/u]', openHtml: '<u>', closeHtml: '</u>', block: false },
      linethrough: { open: /^\[s\]/i, close: '[/s]', openHtml: '<s>', closeHtml: '</s>', block: false },
      size: {
        open: /^\[size=(\d+)\]/i, close: '[/size]', openHtml: '', closeHtml: '</span>', block: false,
        handler: (m) => `<span style="font-size: clamp(10px, ${m[1]}px, 100px);">`
      },
      font: {
        open: /^\[font=([a-z0-9 ]+)\]/i, close: '[/font]', openHtml: '', closeHtml: '</span>', block: false,
        handler: (m) => `<span style="font-family: ${m[1]};">`
      },
      color: {
        open: /^\[color=(\#[a-f0-9]{3,4}|\#[a-f0-9]{6}|\#[a-f0-9]{8}|[a-z]+)\]/i, close: '[/color]', openHtml: '', closeHtml: '</span>', block: false,
        handler: (m) => `<span style="color: ${m[1]};">`
      },
      center: { open: /^\[center\]/i, close: '[/center]', openHtml: '<div class="bbcode-rendered__center" style="text-align: center;">', closeHtml: '</div>', block: true },
      left: { open: /^\[left\]/i, close: '[/left]', openHtml: '<div class="bbcode-rendered__left" style="text-align: left;">', closeHtml: '</div>', block: true },
      right: { open: /^\[right\]/i, close: '[/right]', openHtml: '<div class="bbcode-rendered__right" style="text-align: right;">', closeHtml: '</div>', block: true },
      quote: { open: /^\[quote\]/i, close: '[/quote]', openHtml: '<blockquote>', closeHtml: '</blockquote>', block: true },
      namedquote: {
        open: /^\[quote=(.*?)\]/i, close: '[/quote]', openHtml: '', closeHtml: '</p></blockquote>', block: true,
        handler: (m) => `<blockquote><i class="fas fa-quote-left"></i> <cite>Quoting ${m[1]}:</cite><p>`
      },
      orderedlistnumerical: { open: /^\[list=1\]/i, close: '[/list]', openHtml: '<ol>', closeHtml: '</ol>', block: true },
      orderedlistalpha: { open: /^\[list=a\]/i, close: '[/list]', openHtml: '<ol type="a">', closeHtml: '</ol>', block: true },
      unorderedlist: { open: /^\[list\]/i, close: '[/list]', openHtml: '<ul>', closeHtml: '</ul>', block: true },
      code: { open: /^\[code\]/i, close: '[/code]', openHtml: '<div class="bbcode-rendered__clipboard" x-data="clipboardButton"><pre><code>', closeHtml: '</code></pre><div class="bbcode-rendered__clipboard-container"><button class="bbcode-rendered__clipboard-button" x-bind="button" title="Copy"><i class="fa fa-clone"></i></button></div></div>', block: true },
      pre: { open: /^\[pre\]/i, close: '[/pre]', openHtml: '<code>', closeHtml: '</code>', block: false },
      alert: { open: /^\[alert\]/i, close: '[/alert]', openHtml: '<div class="bbcode-rendered__alert">', closeHtml: '</div>', block: true },
      note: { open: /^\[note\]/i, close: '[/note]', openHtml: '<div class="bbcode-rendered__note">', closeHtml: '</div>', block: true },
      sub: { open: /^\[sub\]/i, close: '[/sub]', openHtml: '<sub>', closeHtml: '</sub>', block: false },
      sup: { open: /^\[sup\]/i, close: '[/sup]', openHtml: '<sup>', closeHtml: '</sup>', block: false },
      small: { open: /^\[small\]/i, close: '[/small]', openHtml: '<small>', closeHtml: '</small>', block: false },
      table: { open: /^\[table\]/i, close: '[/table]', openHtml: '<table>', closeHtml: '</table>', block: true },
      tablerow: { open: /^\[tr\]/i, close: '[/tr]', openHtml: '<tr>', closeHtml: '</tr>', block: true },
      tableheader: { open: /^\[th\]/i, close: '[/th]', openHtml: '<th>', closeHtml: '</th>', block: true },
      tabledata: { open: /^\[td\]/i, close: '[/td]', openHtml: '<td>', closeHtml: '</td>', block: true },
      spoiler: { open: /^\[spoiler\]/i, close: '[/spoiler]', openHtml: '<details><summary>Spoiler</summary><div style="text-align:left;">', closeHtml: '</div></details>', block: false },
      namedspoiler: {
        open: /^\[spoiler=(.*?)\]/i, close: '[/spoiler]', openHtml: '', closeHtml: '</div></details>', block: false,
        handler: (m) => `<details><summary>${m[1]}</summary><div style="text-align:left;">`
      }
    };

    let openedElements = [];
    let state = { source, index: 0 };

    while (state.index < state.source.length) {
      state.index = state.source.indexOf('[', state.index);
      if (state.index === -1) break;
      if (state.index + 1 >= state.source.length) break;

      if (state.source[state.index + 1] === '/' && openedElements.length > 0) {
        let name = openedElements[openedElements.length - 1];
        let el = parsers[name];
        let tag = state.source.substring(state.index, state.index + el.close.length);

        if (tag.toLowerCase() === el.close.toLowerCase()) {
          openedElements.pop();
          state.source = state.source.substring(0, state.index) + el.closeHtml + state.source.substring(state.index + el.close.length);

          if (el.block) {
            handleBlockElementSpacing(state, state.index, state.index + el.closeHtml.length - 1);
          }
        } else {
          openedElements.push(name);
        }
      } else {
        let remainingText = state.source.substring(state.index);
        let matched = false;

        for (const [name, el] of Object.entries(parsers)) {
          const match = remainingText.match(el.open);
          if (match) {
            let replacement = el.handler ? el.handler(match) : el.openHtml;
            state.source = state.source.substring(0, state.index) + replacement + state.source.substring(state.index + match[0].length);

            if (el.block) {
              handleBlockElementSpacing(state, state.index, state.index + replacement.length - 1);
            }

            openedElements.push(name);
            matched = true;
            break;
          }
        }

        if (!matched) {
          state.index++;
        }
      }
    }

    while (openedElements.length > 0) {
      let name = openedElements.pop();
      state.source += parsers[name].closeHtml;
    }

    state.source = state.source.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>');

    return `<div class="bbcode-rendered">${state.source}</div>`;
  };

  // MediaInfo parser - extracts key info into a summary
  const parseMediaInfo = (raw) => {
    if (!raw) return { summary: null, raw: '' };

    const lines = raw.split('\n');
    const info = {
      completeName: '',
      format: '',
      duration: '',
      fileSize: '',
      overallBitrate: '',
      video: [],
      audio: [],
      subtitles: [],
      encodingSettings: ''
    };

    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Detect section headers (handle both "Video" and "Video #1" formats)
      if (/^General$/i.test(trimmed) || /^General\s/i.test(trimmed)) {
        currentSection = 'general';
      } else if (/^Video(?:\s|$)/i.test(trimmed)) {
        currentSection = 'video';
        info.video.push({});
      } else if (/^Audio(?:\s|$)/i.test(trimmed)) {
        currentSection = 'audio';
        info.audio.push({});
      } else if (/^Text(?:\s|$)/i.test(trimmed)) {
        currentSection = 'text';
        info.subtitles.push({});
      } else if (/^Menu(?:\s|$)/i.test(trimmed)) {
        currentSection = 'menu';
      } else if (trimmed.includes(':')) {
        // Parse key: value pairs, accounting for multi-colon values
        const colonIdx = trimmed.indexOf(':');
        const key = trimmed.substring(0, colonIdx).trim();
        const value = trimmed.substring(colonIdx + 1).trim();
        const keyLower = key.toLowerCase();

        if (currentSection === 'general') {
          if (keyLower === 'complete name') info.completeName = value;
          if (keyLower === 'format') info.format = value;
          if (keyLower === 'duration') info.duration = value;
          if (keyLower === 'file size') info.fileSize = value;
          if (keyLower === 'overall bit rate') info.overallBitrate = value;
        } else if (currentSection === 'video' && info.video.length > 0) {
          const v = info.video[info.video.length - 1];
          if (keyLower === 'format') v.format = value;
          if (keyLower === 'width') v.width = value;
          if (keyLower === 'height') v.height = value;
          if (keyLower === 'display aspect ratio') v.aspectRatio = value;
          if (keyLower === 'bit depth') v.bitDepth = value;
          if (keyLower === 'frame rate') v.frameRate = value;
          if (keyLower === 'bit rate') v.bitrate = value;
          if (keyLower === 'hdr format') v.hdr = value;
          if (keyLower === 'encoding settings') {
            v.encodingSettings = value;
            info.encodingSettings = value;
          }
        } else if (currentSection === 'audio' && info.audio.length > 0) {
          const a = info.audio[info.audio.length - 1];
          if (keyLower === 'format') a.format = value;
          if (keyLower === 'commercial name') a.name = value;
          if (keyLower === 'channel(s)') a.channels = value;
          if (keyLower === 'language') a.language = value;
          if (keyLower === 'bit rate') a.bitrate = value;
          if (keyLower === 'title') a.title = value;
        } else if (currentSection === 'text' && info.subtitles.length > 0) {
          const s = info.subtitles[info.subtitles.length - 1];
          if (keyLower === 'format') s.format = value;
          if (keyLower === 'language') s.language = value;
          if (keyLower === 'title') s.title = value;
          if (keyLower === 'forced') s.forced = value.toLowerCase() === 'yes';
          if (keyLower === 'default') s.default = value.toLowerCase() === 'yes';
        }
      }
    }

    return { summary: info, raw };
  };


  // BDInfo parser - handles BDInfo format which is different from MediaInfo
  const parseBDInfo = (raw) => {
    if (!raw) return { summary: null, raw: '' };

    const lines = raw.split('\n');
    const info = {
      discTitle: '',
      discLabel: '',
      discSize: '',
      length: '',
      totalBitrate: '',
      video: [],
      audio: [],
      subtitles: []
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Parse key: value lines
      if (trimmed.includes(':')) {
        const colonIdx = trimmed.indexOf(':');
        const key = trimmed.substring(0, colonIdx).trim().toLowerCase();
        const value = trimmed.substring(colonIdx + 1).trim();

        if (key === 'disc title') info.discTitle = value;
        else if (key === 'disc label') info.discLabel = value;
        else if (key === 'disc size') info.discSize = value;
        else if (key === 'length') info.length = value;
        else if (key === 'total bitrate') info.totalBitrate = value;
        else if (key === 'video') {
          // Video: MPEG-4 AVC Video / 35949 kbps / 1080p / 23.976 fps / 16:9 / High Profile 4.1
          const parts = value.split('/').map(p => p.trim());
          info.video.push({
            format: parts[0] || '',
            bitrate: parts[1] || '',
            resolution: parts[2] || '',
            frameRate: parts[3] || '',
            aspectRatio: parts[4] || '',
            profile: parts[5] || ''
          });
        } else if (key === 'audio') {
          // Audio: Japanese / LPCM Audio / 2.0 / 48 kHz / 2304 kbps / 24-bit
          const parts = value.split('/').map(p => p.trim());
          info.audio.push({
            language: parts[0] || '',
            format: parts[1] || '',
            channels: parts[2] || '',
            sampleRate: parts[3] || '',
            bitrate: parts[4] || '',
            bitDepth: parts[5] || ''
          });
        } else if (key === 'subtitle') {
          // Subtitle: English / 50.053 kbps
          const parts = value.split('/').map(p => p.trim());
          info.subtitles.push({
            language: parts[0] || '',
            bitrate: parts[1] || ''
          });
        }
      }
    }

    return { summary: info, raw };
  };

  // Render BDInfo summary as HTML (matches MediaInfo styling)
  const renderBDInfoSummary = (info, rawContent = '') => {
    const container = create('div', 'gz-mediainfo-summary');

    // Disc title/label header (clickable to show/hide raw content)
    const titleStr = info.discTitle || info.discLabel || 'BDInfo';

    const title = create('div', 'gz-mediainfo-filename');
    title.textContent = titleStr;
    container.appendChild(title);

    // Raw content section (hidden by default, appears between header and summary)
    const rawSection = create('div', 'gz-mediainfo-raw-inline');
    const rawPre = create('pre');
    rawPre.textContent = rawContent;
    rawSection.appendChild(rawPre);
    container.appendChild(rawSection);

    // Click handler to toggle raw content visibility
    title.addEventListener('click', () => {
      title.classList.toggle('expanded');
      rawSection.classList.toggle('visible');
    });

    // Summary content wrapper
    const summaryContent = create('div', 'gz-mediainfo-summary-content');

    // Columns container (Disc Info + Video side by side)
    const hasGeneral = info.discSize || info.length || info.totalBitrate;
    const hasVideo = info.video.length > 0;

    if (hasGeneral || hasVideo) {
      const columns = create('div', 'gz-mediainfo-columns');

      // Disc Info column (like General in MediaInfo)
      if (hasGeneral) {
        const discCol = create('div', 'gz-mediainfo-column');
        discCol.innerHTML = `<div class="gz-mediainfo-column-title">Disc Info</div>`;

        if (info.discSize) {
          discCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Size</span>
              <span class="gz-mediainfo-row-value">${info.discSize}</span>
            </div>`;
        }
        if (info.length) {
          discCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Length</span>
              <span class="gz-mediainfo-row-value">${info.length}</span>
            </div>`;
        }
        if (info.totalBitrate) {
          discCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Bitrate</span>
              <span class="gz-mediainfo-row-value">${info.totalBitrate}</span>
            </div>`;
        }
        columns.appendChild(discCol);
      }

      // Video column
      if (hasVideo) {
        const v = info.video[0]; // Use first video track
        const videoCol = create('div', 'gz-mediainfo-column');
        videoCol.innerHTML = `<div class="gz-mediainfo-column-title">Video</div>`;

        if (v.format) {
          videoCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Format</span>
              <span class="gz-mediainfo-row-value">${v.format}</span>
            </div>`;
        }
        if (v.resolution) {
          videoCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Resolution</span>
              <span class="gz-mediainfo-row-value">${v.resolution}</span>
            </div>`;
        }
        if (v.aspectRatio) {
          videoCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Aspect ratio</span>
              <span class="gz-mediainfo-row-value">${v.aspectRatio}</span>
            </div>`;
        }
        if (v.frameRate) {
          videoCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Frame rate</span>
              <span class="gz-mediainfo-row-value">${v.frameRate}</span>
            </div>`;
        }
        if (v.bitrate) {
          videoCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Bit rate</span>
              <span class="gz-mediainfo-row-value">${v.bitrate}</span>
            </div>`;
        }
        if (v.profile) {
          videoCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Profile</span>
              <span class="gz-mediainfo-row-value">${v.profile}</span>
            </div>`;
        }

        columns.appendChild(videoCol);
      }

      summaryContent.appendChild(columns);
    }

    // Audio section (numbered tracks like MediaInfo)
    if (info.audio.length > 0) {
      const audioSection = create('div', 'gz-mediainfo-audio-section');
      audioSection.innerHTML = `<div class="gz-mediainfo-section-title">Audio</div>`;

      const audioList = create('div', 'gz-mediainfo-audio-list');
      info.audio.forEach((a, i) => {
        const audioItem = create('div', 'gz-mediainfo-audio-item');
        const num = `${i + 1}.`;
        const lang = a.language || 'Unknown';
        const format = a.format || 'Unknown';

        // Parse channels to a cleaner format
        let channels = a.channels || '';
        const channelMatch = channels.match(/(\d+(?:\.\d+)?)/);
        if (channelMatch) {
          channels = `${channelMatch[1]}ch`;
        }

        // Format bitrate (remove 'kbps' redundancy if needed)
        const bitrate = a.bitrate || '';
        const sampleRate = a.sampleRate || '';
        const bitDepth = a.bitDepth || '';

        // Build the detail string
        const detailParts = [lang, format, channels, bitrate].filter(Boolean);

        // Add extended info if available
        const extendedParts = [sampleRate, bitDepth].filter(Boolean);
        const extendedInfo = extendedParts.length > 0 ? ` (${extendedParts.join(' / ')})` : '';

        audioItem.innerHTML = `
          <span class="gz-mediainfo-audio-num">${num}</span>
          <span class="gz-mediainfo-audio-details">${detailParts.join(' / ')}<span class="gz-mediainfo-audio-title">${extendedInfo}</span></span>
        `;
        audioList.appendChild(audioItem);
      });

      audioSection.appendChild(audioList);
      summaryContent.appendChild(audioSection);
    }

    // Subtitles section
    if (info.subtitles.length > 0) {
      const subSection = create('div', 'gz-mediainfo-subtitles-section');
      subSection.innerHTML = `<div class="gz-mediainfo-section-title">Subtitles</div>`;

      const subList = create('div', 'gz-mediainfo-subtitles-list');

      // Group subtitles by language
      const subtitleMap = new Map();
      info.subtitles.forEach(s => {
        const lang = s.language || 'Unknown';
        const key = lang.toLowerCase();
        if (!subtitleMap.has(key)) {
          subtitleMap.set(key, { language: lang, count: 0 });
        }
        subtitleMap.get(key).count++;
      });

      // Render each unique language
      const uniqueLanguages = Array.from(subtitleMap.values());
      uniqueLanguages.forEach((sub, index) => {
        const item = create('span', 'gz-mediainfo-subtitle-item');
        let text = sub.language;

        // Add count if more than 1
        if (sub.count > 1) {
          text += ` (${sub.count})`;
        }

        // Add separator except for last item
        if (index < uniqueLanguages.length - 1) {
          text += ',';
        }

        item.innerHTML = text;
        subList.appendChild(item);
      });

      subSection.appendChild(subList);
      summaryContent.appendChild(subSection);
    }

    container.appendChild(summaryContent);
    return container;
  };

  // Render parsed MediaInfo as HTML
  const renderMediaInfoSummary = (info, rawContent = '') => {
    const container = create('div', 'gz-mediainfo-summary');

    // Filename header (clickable to show/hide raw content)
    const filenameStr = info.completeName
      ? (info.completeName.split(/[/\\]/).pop() || info.completeName)
      : 'MediaInfo';

    const filename = create('div', 'gz-mediainfo-filename');
    filename.textContent = filenameStr;
    container.appendChild(filename);

    // Raw content section (hidden by default, appears between header and summary)
    const rawSection = create('div', 'gz-mediainfo-raw-inline');
    const rawPre = create('pre');
    rawPre.textContent = rawContent;
    rawSection.appendChild(rawPre);
    container.appendChild(rawSection);

    // Click handler to toggle raw content visibility
    filename.addEventListener('click', () => {
      filename.classList.toggle('expanded');
      rawSection.classList.toggle('visible');
    });

    // Summary content wrapper
    const summaryContent = create('div', 'gz-mediainfo-summary-content');

    // Columns container (General + Video side by side)
    const hasGeneral = info.format || info.duration || info.overallBitrate || info.fileSize;
    const hasVideo = info.video.length > 0;

    if (hasGeneral || hasVideo) {
      const columns = create('div', 'gz-mediainfo-columns');

      // General column
      if (hasGeneral) {
        const generalCol = create('div', 'gz-mediainfo-column');
        generalCol.innerHTML = `<div class="gz-mediainfo-column-title">General</div>`;

        if (info.format) {
          generalCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Format</span>
              <span class="gz-mediainfo-row-value">${info.format}</span>
            </div>`;
        }
        if (info.duration) {
          generalCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Duration</span>
              <span class="gz-mediainfo-row-value">${info.duration}</span>
            </div>`;
        }
        if (info.overallBitrate) {
          generalCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Bitrate</span>
              <span class="gz-mediainfo-row-value">${info.overallBitrate}</span>
            </div>`;
        }
        if (info.fileSize) {
          generalCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Size</span>
              <span class="gz-mediainfo-row-value">${info.fileSize}</span>
            </div>`;
        }
        columns.appendChild(generalCol);
      }

      // Video column
      if (hasVideo) {
        const v = info.video[0]; // Use first video track
        const videoCol = create('div', 'gz-mediainfo-column');
        videoCol.innerHTML = `<div class="gz-mediainfo-column-title">Video</div>`;

        const formatStr = v.format ? `${v.format}${v.bitDepth ? ` (${v.bitDepth})` : ''}` : '';
        if (formatStr) {
          videoCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Format</span>
              <span class="gz-mediainfo-row-value">${formatStr}</span>
            </div>`;
        }

        const resolution = v.width && v.height ? `${v.width} × ${v.height}` : '';
        if (resolution) {
          videoCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Resolution</span>
              <span class="gz-mediainfo-row-value">${resolution}</span>
            </div>`;
        }

        if (v.aspectRatio) {
          videoCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Aspect ratio</span>
              <span class="gz-mediainfo-row-value">${v.aspectRatio}</span>
            </div>`;
        }

        if (v.frameRate) {
          videoCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Frame rate</span>
              <span class="gz-mediainfo-row-value">${v.frameRate}</span>
            </div>`;
        }

        if (v.bitrate) {
          videoCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">Bit rate</span>
              <span class="gz-mediainfo-row-value">${v.bitrate}</span>
            </div>`;
        }

        if (v.hdr) {
          videoCol.innerHTML += `
            <div class="gz-mediainfo-row">
              <span class="gz-mediainfo-row-label">HDR</span>
              <span class="gz-mediainfo-row-value">${v.hdr}</span>
            </div>`;
        }

        columns.appendChild(videoCol);
      }

      summaryContent.appendChild(columns);
    }

    // Audio section
    if (info.audio.length > 0) {
      const audioSection = create('div', 'gz-mediainfo-audio-section');
      audioSection.innerHTML = `<div class="gz-mediainfo-section-title">Audio</div>`;

      const audioList = create('div', 'gz-mediainfo-audio-list');
      info.audio.forEach((a, i) => {
        const audioItem = create('div', 'gz-mediainfo-audio-item');
        const num = `${i + 1}.`;
        const lang = a.language || 'Unknown';
        const format = a.name || a.format || 'Unknown';

        // Parse channels to a cleaner format (e.g., "8 channels" -> "8ch")
        let channels = a.channels || '';
        const channelMatch = channels.match(/(\d+)\s*channel/i);
        if (channelMatch) {
          const numChannels = parseInt(channelMatch[1], 10);
          // Map common channel counts to standard formats
          const channelMap = { 1: '1.0ch', 2: '2.0ch', 3: '2.1ch', 6: '5.1ch', 7: '6.1ch', 8: '7.1ch' };
          channels = channelMap[numChannels] || `${numChannels}ch`;
        }

        // Format bitrate (e.g., "1 536 kb/s" -> "1536kb/s")
        const bitrate = a.bitrate ? a.bitrate.replace(/\s+/g, '') : '';

        // Build the detail string: Language / Format / Channels / Bitrate
        const detailParts = [lang, format, channels, bitrate].filter(Boolean);

        // Title/Description (for commentary tracks, etc.)
        const title = a.title ? ` / ${a.title}` : '';

        audioItem.innerHTML = `
          <span class="gz-mediainfo-audio-num">${num}</span>
          <span class="gz-mediainfo-audio-details">${detailParts.join(' / ')}<span class="gz-mediainfo-audio-title">${title}</span></span>
        `;
        audioList.appendChild(audioItem);
      });

      audioSection.appendChild(audioList);
      summaryContent.appendChild(audioSection);
    }

    // Subtitles section - show each track individually with details
    if (info.subtitles.length > 0) {
      const subSection = create('div', 'gz-mediainfo-subtitles-section');
      subSection.innerHTML = `<div class="gz-mediainfo-section-title">Subtitles</div>`;

      const subList = create('div', 'gz-mediainfo-subtitles-list gz-mediainfo-subtitles-list--detailed');

      // Render each subtitle track individually
      info.subtitles.forEach((s, index) => {
        const item = create('div', 'gz-mediainfo-subtitle-item gz-mediainfo-subtitle-item--detailed');

        const trackNum = `#${index + 1}:`;
        const lang = s.language || 'Unknown';
        const format = s.format || '';
        const title = s.title || '';

        // Build flags array
        const flags = [];
        if (s.forced) flags.push('forced');
        if (s.default) flags.push('default');

        // Build the display text
        let text = `<span class="gz-mediainfo-subtitle-num">${trackNum}</span>`;
        text += `<span class="gz-mediainfo-subtitle-details">`;
        text += `${lang}`;
        if (format) text += ` ${format}`;
        if (title) text += ` <span class="gz-mediainfo-subtitle-title">[${title}]</span>`;
        if (flags.length > 0) {
          text += ` <span class="gz-mediainfo-subtitle-flags">(${flags.join(', ')})</span>`;
        }
        text += `</span>`;

        item.innerHTML = text;
        subList.appendChild(item);
      });

      subSection.appendChild(subList);
      summaryContent.appendChild(subSection);
    }

    // Encode Settings section
    if (info.encodingSettings) {
      const encodeSection = create('div', 'gz-mediainfo-encode-section');
      encodeSection.innerHTML = `<div class="gz-mediainfo-section-title">Encode Settings</div>`;

      const settingsBlock = create('div', 'gz-mediainfo-encode-settings');
      settingsBlock.textContent = info.encodingSettings;
      encodeSection.appendChild(settingsBlock);
      summaryContent.appendChild(encodeSection);
    }

    container.appendChild(summaryContent);
    return container;
  };


  // Render the dropdown content for a torrent
  const renderTorrentDropdown = (torrentData, colSpan) => {
    const container = create('div', 'gz-dropdown-container');

    // Header: Uploaded by X on Date
    const header = create('div', 'gz-dropdown-header');
    const uploader = torrentData.uploader || 'Anonymous';
    const uploadDate = formatDate(torrentData.created_at);
    const uploaderDisplay = uploader === 'Anonymous'
      ? `<strong>${uploader}</strong>`
      : `<a href="https://aither.cc/users/${uploader}" target="_blank" rel="noopener"><strong>${uploader}</strong></a>`;
    header.innerHTML = `Uploaded by ${uploaderDisplay} on <span>${uploadDate}</span>`;
    container.appendChild(header);

    // Tabs
    const tabs = create('div', 'gz-dropdown-tabs');
    const panels = create('div', 'gz-dropdown-panels');

    // Determine which tabs to show
    const tabsConfig = [
      { id: 'description', label: 'Description', hasContent: true },
      { id: 'filelist', label: 'Files', hasContent: torrentData.files && torrentData.files.length > 0 }
    ];

    // Mediainfo / Bdinfo - show whichever is not empty, prefer mediainfo if both exist
    const hasMediainfo = torrentData.media_info && torrentData.media_info.trim();
    const hasBdinfo = torrentData.bd_info && torrentData.bd_info.trim();
    if (hasMediainfo) {
      tabsConfig.push({ id: 'mediainfo', label: 'MediaInfo', hasContent: true, content: torrentData.media_info });
    } else if (hasBdinfo) {
      tabsConfig.push({ id: 'bdinfo', label: 'BDInfo', hasContent: true, content: torrentData.bd_info });
    }

    // Create tabs and panels
    tabsConfig.forEach((config, index) => {
      if (!config.hasContent && config.id !== 'description') return;

      const tab = create('button', 'gz-dropdown-tab');
      tab.textContent = config.label;
      tab.dataset.tab = config.id;
      if (index === 0) tab.classList.add('active');

      const panel = create('div', 'gz-dropdown-panel');
      panel.dataset.panel = config.id;
      if (index === 0) panel.classList.add('active');

      // Store raw content for copying
      let rawCopyContent = '';

      // Populate panel content
      if (config.id === 'description') {
        panel.classList.add('gz-dropdown-description');
        rawCopyContent = torrentData.description || '';
        panel.innerHTML = parseBBCode(rawCopyContent);
      } else if (config.id === 'filelist') {
        panel.classList.add('gz-dropdown-filelist');

        // Build raw file list content for copying
        const fileLines = [];
        if (torrentData.folder) {
          fileLines.push(`Folder: ${torrentData.folder}`);
          fileLines.push('');
        }
        if (torrentData.files) {
          torrentData.files.forEach(file => {
            const fileName = file.name || file;
            const fileSize = file.size ? ` (${formatBytes(file.size)})` : '';
            fileLines.push(`${fileName}${fileSize}`);
          });
        }
        rawCopyContent = fileLines.join('\n');

        // Show root folder name if available
        if (torrentData.folder) {
          const folderInfo = create('div', 'gz-filelist-root-info');
          folderInfo.innerHTML = `<strong>Folder:</strong> ${torrentData.folder}`;
          panel.appendChild(folderInfo);
        }

        // Natural sort function
        const naturalSort = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

        // Build a nested tree structure
        const buildTree = (files) => {
          const root = { folders: {}, files: [] };

          files.forEach(file => {
            const filePath = file.name || file;
            const parts = filePath.split('/');
            let current = root;

            // Navigate/create folder structure
            for (let i = 0; i < parts.length - 1; i++) {
              const folderName = parts[i];
              if (!current.folders[folderName]) {
                current.folders[folderName] = { folders: {}, files: [] };
              }
              current = current.folders[folderName];
            }

            // Add file to the deepest folder
            current.files.push({
              name: parts[parts.length - 1],
              size: file.size
            });
          });

          return root;
        };

        // Count all files recursively in a folder
        const countFiles = (node) => {
          let count = node.files.length;
          Object.values(node.folders).forEach(subfolder => {
            count += countFiles(subfolder);
          });
          return count;
        };

        // Recursively render the tree
        let folderIdCounter = 0;
        const renderTree = (node, depth = 0, parentId = null) => {
          const rows = [];
          const indentPx = depth * 28; // Indentation in pixels (bigger for visibility)

          // Get sorted folder names and file names
          const folderNames = Object.keys(node.folders).sort(naturalSort);
          const sortedFiles = [...node.files].sort((a, b) => naturalSort(a.name, b.name));

          // Render folders first
          folderNames.forEach(folderName => {
            const folder = node.folders[folderName];
            const fileCount = countFiles(folder);
            const folderId = `f${++folderIdCounter}`;
            const isHidden = parentId !== null;

            // Folder row (clickable)
            rows.push(`
              <tr class="gz-filelist-folder-row" data-folder-id="${folderId}" ${parentId ? `data-parent="${parentId}"` : ''} data-depth="${depth}" ${isHidden ? 'style="display:none;"' : ''}>
                <td>
                  <span class="gz-tree-indent" style="display:inline-block; width:${indentPx}px; min-width:${indentPx}px;"></span>
                  <span class="gz-folder-toggle">▶</span>
                  <span class="gz-folder-icon">📁</span>
                  <span class="gz-folder-name">${folderName}</span>
                  <span class="gz-folder-count">(${fileCount} files)</span>
                </td>
                <td></td>
              </tr>
            `);

            // Recursively render subfolders and files
            rows.push(...renderTree(folder, depth + 1, folderId));
          });

          // Render files
          // Files at root level (depth 0) should have no indent
          // Files inside folders are already shown after expanding parent, so they use same indent as folder
          const fileIndentPx = indentPx;
          sortedFiles.forEach(file => {
            const isHidden = parentId !== null;
            rows.push(`
              <tr class="gz-filelist-file-row" ${parentId ? `data-parent="${parentId}"` : ''} data-depth="${depth}" ${isHidden ? 'style="display:none;"' : ''}>
                <td>
                  <span class="gz-tree-indent" style="display:inline-block; width:${fileIndentPx}px; min-width:${fileIndentPx}px;"></span>
                  ${file.name}
                </td>
                <td>${formatBytes(file.size)}</td>
              </tr>
            `);
          });

          return rows;
        };

        // Create table
        const table = create('table');
        table.innerHTML = `
          <thead>
            <tr>
              <th>Name</th>
              <th style="text-align: right; width: 100px;">Size</th>
            </tr>
          </thead>
          <tbody>
            ${torrentData.files ? renderTree(buildTree(torrentData.files)).join('') : '<tr><td colspan="2">No files found</td></tr>'}
          </tbody>
        `;

        // Add click handlers for folder expansion
        table.querySelectorAll('.gz-filelist-folder-row').forEach(folderRow => {
          folderRow.addEventListener('click', () => {
            const folderId = folderRow.dataset.folderId;
            const toggle = folderRow.querySelector('.gz-folder-toggle');
            const isExpanded = toggle.textContent === '▼';

            if (isExpanded) {
              // Collapse: hide all nested rows recursively
              const hideRecursive = (parentId) => {
                table.querySelectorAll(`tr[data-parent="${parentId}"]`).forEach(row => {
                  row.style.display = 'none';
                  // Also collapse any expanded subfolders
                  if (row.classList.contains('gz-filelist-folder-row')) {
                    const nestedToggle = row.querySelector('.gz-folder-toggle');
                    if (nestedToggle) nestedToggle.textContent = '▶';
                    hideRecursive(row.dataset.folderId);
                  }
                });
              };
              hideRecursive(folderId);
              toggle.textContent = '▶';
            } else {
              // Expand: show direct children only
              table.querySelectorAll(`tr[data-parent="${folderId}"]`).forEach(row => {
                row.style.display = '';
              });
              toggle.textContent = '▼';
            }
          });
        });

        // Debug: Log tree structure
        const allRows = table.querySelectorAll('tbody tr');
        const hiddenRows = Array.from(allRows).filter(r => r.style.display === 'none');
        console.log('GAZELL3D: File tree rendered. Total rows:', allRows.length, 'Hidden:', hiddenRows.length);

        panel.appendChild(table);
      } else if (config.id === 'mediainfo' || config.id === 'bdinfo') {
        panel.classList.add('gz-dropdown-mediainfo');
        rawCopyContent = config.content;

        // Parse and display summary based on type
        if (config.id === 'bdinfo') {
          const parsed = parseBDInfo(config.content);
          if (parsed.summary) {
            panel.appendChild(renderBDInfoSummary(parsed.summary, config.content));
          }
        } else {
          const parsed = parseMediaInfo(config.content);
          if (parsed.summary) {
            panel.appendChild(renderMediaInfoSummary(parsed.summary, config.content));
          }
        }
      }

      // Store raw content on the panel for later
      panel.dataset.rawContent = rawCopyContent || '';

      tab.addEventListener('click', () => {
        // Remove active from all tabs and panels
        tabs.querySelectorAll('.gz-dropdown-tab').forEach(t => t.classList.remove('active'));
        panels.querySelectorAll('.gz-dropdown-panel').forEach(p => p.classList.remove('active'));
        // Add active to clicked tab and corresponding panel
        tab.classList.add('active');
        panel.classList.add('active');
      });

      tabs.appendChild(tab);
      panels.appendChild(panel);
    });

    // Add single copy button to tabs row
    const copyBtn = create('button', 'gz-panel-copy-btn');
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const activePanel = panels.querySelector('.gz-dropdown-panel.active');
      const rawContent = activePanel?.dataset.rawContent || '';
      if (!rawContent) return;

      try {
        await navigator.clipboard.writeText(rawContent);
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('GAZELL3D: Failed to copy:', err);
        copyBtn.textContent = 'Failed';
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
        }, 2000);
      }
    });
    tabs.appendChild(copyBtn);

    container.appendChild(tabs);
    container.appendChild(panels);

    return container;
  };

  // Create a loading dropdown row
  const createLoadingDropdownRow = (colSpan) => {
    const dropdownRow = create('tr', 'gz-dropdown-row');
    const td = create('td');
    td.setAttribute('colspan', colSpan);
    td.innerHTML = '<div class="gz-dropdown-loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    dropdownRow.appendChild(td);
    return dropdownRow;
  };

  // Create an error dropdown row
  const createErrorDropdownRow = (colSpan, message) => {
    const dropdownRow = create('tr', 'gz-dropdown-row');
    const td = create('td');
    td.setAttribute('colspan', colSpan);
    td.innerHTML = `<div class="gz-dropdown-error">${message}</div>`;
    dropdownRow.appendChild(td);
    return dropdownRow;
  };

  // ============================================
  // Trump Report Feature
  // ============================================

  // Global registry to track all torrents on the page with their season groups
  const trumpTorrentRegistry = {
    torrents: new Map(), // Map<torrentId, { name, seasonGroup }>
    clear() {
      this.torrents.clear();
    },
    register(torrentId, name, seasonGroup = null) {
      this.torrents.set(torrentId, { name, seasonGroup });
    },
    getEligibleTorrents(reportedTorrentId, seasonGroup, isTV) {
      const eligible = [];
      this.torrents.forEach((data, id) => {
        if (id === reportedTorrentId) return; // Exclude self
        // For TV shows, only include torrents from the same season
        if (isTV && seasonGroup && data.seasonGroup !== seasonGroup) return;
        eligible.push({ id, name: data.name });
      });
      return eligible;
    }
  };

  // Show a toast notification
  const showToast = (message, type = 'info', duration = 5000) => {
    // Remove any existing toast
    const existing = document.querySelector('.gz-toast');
    if (existing) existing.remove();

    const toast = create('div', `gz-toast gz-toast--${type}`);
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'gz-toast-slide-in 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  // Submit Trump Report to API
  const submitTrumpReport = async (payload) => {
    const url = 'https://aither.cc/api/trumping-reports/create';

    try {
      const response = await gmFetchJson(
        url,
        {
          headers: {
            'Authorization': `Bearer ${AITHER_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          data: JSON.stringify(payload)
        },
        'POST',
        30000
      );

      return response;
    } catch (error) {
      console.error('GAZELL3D: Trump report submission failed:', error);
      throw error;
    }
  };

  // Show Trump Report Modal
  const showTrumpReportModal = (reportedTorrentId, reportedTorrentName, seasonGroup, isTV) => {
    // Get eligible torrents for the dropdown
    const eligibleTorrents = trumpTorrentRegistry.getEligibleTorrents(reportedTorrentId, seasonGroup, isTV);

    if (eligibleTorrents.length === 0) {
      showToast('No other torrents available in this season group to trump with.', 'error');
      return;
    }

    // Create overlay
    const overlay = create('div', 'gz-trump-overlay');

    // Create modal
    const modal = create('div', 'gz-trump-modal');
    modal.innerHTML = `
      <div class="gz-trump-header">
        <h3>Submit Trump Report</h3>
        <button class="gz-trump-close" type="button">&times;</button>
      </div>
      <form class="gz-trump-form">
        <div class="gz-trump-field">
          <label>Reported Torrent (to be trumped)</label>
          <div class="reported-torrent">${reportedTorrentName}</div>
        </div>
        <div class="gz-trump-field">
          <label for="gz-trump-torrent">Trumping Torrent (superior release)</label>
          <select id="gz-trump-torrent" class="gz-trump-select" required>
            <option value="">Select a torrent...</option>
            ${eligibleTorrents.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
          </select>
        </div>
        <div class="gz-trump-field">
          <label for="gz-trump-message">Reason for Trump Report</label>
          <textarea id="gz-trump-message" class="gz-trump-textarea" required placeholder="Explain why the reported torrent should be trumped by the selected torrent..."></textarea>
        </div>
        <div class="gz-trump-field">
          <label for="gz-trump-screenshots-reported">Screenshots of Reported Torrent (optional)</label>
          <input id="gz-trump-screenshots-reported" class="gz-trump-input" type="url" placeholder="https://example.com/screenshot.png" />
        </div>
        <div class="gz-trump-field">
          <label for="gz-trump-screenshots-trumping">Screenshots of Trumping Torrent (optional)</label>
          <input id="gz-trump-screenshots-trumping" class="gz-trump-input" type="url" placeholder="https://example.com/screenshot.png" />
        </div>
        <div class="gz-trump-buttons">
          <button type="button" class="gz-trump-btn gz-trump-btn--cancel">Cancel</button>
          <button type="submit" class="gz-trump-btn gz-trump-btn--submit">Submit Report</button>
        </div>
      </form>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close handlers
    const closeModal = () => overlay.remove();

    overlay.querySelector('.gz-trump-close').addEventListener('click', closeModal);
    overlay.querySelector('.gz-trump-btn--cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Escape key closes modal
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Form submission
    const form = modal.querySelector('.gz-trump-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const trumpingTorrentId = document.getElementById('gz-trump-torrent').value;
      const message = document.getElementById('gz-trump-message').value.trim();
      const screenshotsReported = document.getElementById('gz-trump-screenshots-reported').value.trim();
      const screenshotsTrumping = document.getElementById('gz-trump-screenshots-trumping').value.trim();

      if (!trumpingTorrentId || !message) {
        showToast('Please select a torrent and provide a reason.', 'error');
        return;
      }

      const submitBtn = modal.querySelector('.gz-trump-btn--submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      try {
        const payload = {
          reported_torrent_id: parseInt(reportedTorrentId, 10),
          trumping_torrent_id: parseInt(trumpingTorrentId, 10),
          message: message
        };

        // Add optional screenshot fields if provided
        if (screenshotsReported) {
          payload.screenshots_reported_torrent = screenshotsReported;
        }
        if (screenshotsTrumping) {
          payload.screenshots_trumping_torrent = screenshotsTrumping;
        }

        const response = await submitTrumpReport(payload);

        closeModal();

        if (response.success) {
          showToast(`Trump report submitted successfully! ${response.message || ''}`, 'success', 7000);
        } else {
          showToast(`Error: ${response.message || 'Unknown error occurred'}`, 'error', 7000);
        }
      } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Report';
        showToast(`Failed to submit report: ${error.message || 'Network error'}`, 'error', 7000);
      }
    });

    // Focus the select element
    setTimeout(() => document.getElementById('gz-trump-torrent')?.focus(), 100);
  };

  const gazellifyTorrentLayout = (article) => {
    const section = $(SELECTORS.torrentGroup, article);
    if (!section) return;

    // Clear the trump torrent registry for fresh population
    trumpTorrentRegistry.clear();

    // Hide the panel header ("Torrents" label) to reduce vertical gap
    const panelHeader = section.querySelector('header.panel__header');
    if (panelHeader) {
      panelHeader.style.display = 'none';
    }

    // 1. Detect Mode
    // TV Mode: Has 'summary[x-bind="season"]' or 'summary[x-bind="specials"]' inside details
    const seasonDetails = Array.from(section.querySelectorAll('summary[x-bind="season"], summary[x-bind="specials"], summary[x-bind="complete"]'))
      .map(summary => summary.closest('details'))
      .filter(Boolean);

    const isSeasonLayout = seasonDetails.length > 0;

    // Movie Mode: If no seasons, look for the main torrent table rows directly
    let movieRows = [];
    if (!isSeasonLayout) {
      // Use querySelectorAll to get rows from ALL tbodys (essential for movies with multiple types)
      // Flatten NodeList to Array
      const tableRows = section.querySelectorAll('.similar-torrents__torrents tbody tr, .data-table-wrapper table tbody tr');
      if (tableRows.length > 0) {
        movieRows = Array.from(tableRows);
      } else {
        return; // Nothing to process
      }
    }

    const newTable = create('table', 'gz-torrent-table');

    const thead = create('thead');
    // Conditionally include Actions header
    const actionsHeader = CONFIG.enableGazelleButtons ? '<th class="gz-col-actions">Actions</th>' : '';
    // NOTE: Episode/Season header removed; using mini-headers instead.

    thead.innerHTML = `
        <tr>
            <th class="gz-col-type">Type</th>
            <th class="gz-col-name">Release</th>
            ${actionsHeader}
            <th class="gz-col-size">Size</th>
            <th class="gz-col-stat" title="Seeders"><i class="fas fa-arrow-up"></i></th>
            <th class="gz-col-stat" title="Leechers"><i class="fas fa-arrow-down"></i></th>
            <th class="gz-col-stat" title="Snatched"><i class="fas fa-save"></i></th>
        </tr>
    `;
    newTable.appendChild(thead);

    const tbody = create('tbody');
    let rowIdCounter = 0;

    // Shared row processing logic
    // seasonGroup: identifier for the season (e.g., 'S01', 'S02') used for trump report filtering
    const processRows = (rows, episodeId, seasonGroup = null) => {
      // Insert Group Header (Mini-header) if Season Layout
      // This replaces the Episode/Season column
      if (isSeasonLayout && episodeId) {
        const groupRow = create('tr', 'gz-group-header');
        // Colspan: Type(1) + Rel(1) + Act?(1) + Size(1) + Snatch(1) + Seed(1) + Leech(1) = 6 or 7
        const colSpan = CONFIG.enableGazelleButtons ? 7 : 6;
        groupRow.innerHTML = `<td colspan="${colSpan}">${episodeId}</td>`;
        tbody.appendChild(groupRow);
      }

      let currentType = '';
      let lastPrintedType = null;
      let firstInGroup = true;

      rows.forEach(row => {
        // Extract Type if present (rowspan header)
        const typeHeader = row.querySelector('.similar-torrents__type');
        if (typeHeader) {
          currentType = normalizeText(typeHeader.textContent);
        }

        const nameLink = row.querySelector('.torrent-search--grouped__name a');
        if (!nameLink) return;

        // Assign Sync ID
        const syncId = `gz-sync-${++rowIdCounter}`;
        row.dataset.gzSyncId = syncId;

        const newRow = create('tr');
        newRow.dataset.gzSyncId = syncId;

        // 1. Episode/Season Column -> REMOVED (Replaced by header)

        // 2. Type Column
        const tdType = create('td', 'gz-col-type');
        if (currentType !== lastPrintedType) {
          tdType.textContent = currentType;
          lastPrintedType = currentType;
        }
        newRow.appendChild(tdType);

        // 3. Release Column (Name + Icons)
        const tdName = create('td', 'gz-col-name');
        const iconSpan = create('span', 'gz-torrent-icons');

        const updateIcons = () => {
          iconSpan.innerHTML = '';
          const originalIcons = row.querySelector('.torrent-icons');
          if (originalIcons) {
            // Create a copy of children array since we may modify the original
            const iconsToProcess = Array.from(originalIcons.children);
            iconsToProcess.forEach(icon => {
              // Filter text nodes but keep elements
              if (icon.nodeType !== 1) return;

              // Check if this is a Seadex icon - these need special handling
              const isSeadex = icon.hasAttribute('data-seadex');

              // Apply filtering logic
              const isKeep = isSeadex ||
                icon.classList.contains('torrent-icons__torrent-trump') ||
                icon.classList.contains('torrent-icons__personal-release') ||
                icon.classList.contains('torrent-icons__internal');

              if (CONFIG.removeTorrentIcons && !isKeep) {
                return;
              }

              // Skip comment icon always
              if (icon.classList.contains('fa-comment-alt-plus') || icon.classList.contains('torrent-icons__comments')) return;

              // For Seadex icons: MOVE them instead of cloning to preserve event listeners
              // The original table is hidden anyway, so this is safe
              if (isSeadex) {
                iconSpan.appendChild(icon);
              } else {
                iconSpan.appendChild(icon.cloneNode(true));
              }
            });
          }
        };
        updateIcons(); // Initial population

        const newLink = nameLink.cloneNode(true);
        newLink.className = 'torrent-name-link';

        // Extract torrent ID from URL for dropdown feature
        const torrentUrl = nameLink.href || '';
        const torrentIdMatch = torrentUrl.match(/\/torrents\/(\d+)/);
        const torrentId = torrentIdMatch ? torrentIdMatch[1] : null;
        const torrentName = getText(nameLink);
        // Build display name with episode ID and type for better identification
        // Format: "S01E01 [WEB-DL] Release Name" or "[WEB-DL] Release Name" for movies
        const typePart = currentType ? `[${currentType}]` : '';
        const episodePart = episodeId ? `${episodeId} ` : '';
        const torrentDisplayName = `${episodePart}${typePart} ${torrentName}`.trim();

        // Register torrent in the trump report registry for season-aware filtering
        if (torrentId) {
          trumpTorrentRegistry.register(torrentId, torrentDisplayName, seasonGroup);
        }

        // Add dropdown functionality if enabled
        if (CONFIG.enableTorrentDropdowns && torrentId) {
          newLink.classList.add('gz-clickable');
          newLink.dataset.torrentId = torrentId;

          newLink.addEventListener('click', async (e) => {
            // Ctrl+click or Cmd+click: let the browser handle it natively
            // (the browser already opens <a> links in a new tab on Ctrl/Cmd+click)
            if (e.ctrlKey || e.metaKey) {
              return;
            }

            e.preventDefault();
            e.stopPropagation();

            const colSpan = CONFIG.enableGazelleButtons ? 7 : 6;
            const existingDropdown = newRow.nextElementSibling;

            // Toggle existing dropdown
            if (existingDropdown && existingDropdown.classList.contains('gz-dropdown-row')) {
              existingDropdown.remove();
              return;
            }

            // Create loading state
            const loadingRow = createLoadingDropdownRow(colSpan);
            newRow.insertAdjacentElement('afterend', loadingRow);

            // Fetch torrent data
            const tmdbId = getTmdbIdFromPage();
            if (!tmdbId) {
              loadingRow.replaceWith(createErrorDropdownRow(colSpan, 'Could not detect TMDB ID'));
              return;
            }

            const torrentDataMap = await fetchTorrentsByTmdb(tmdbId);
            if (!torrentDataMap) {
              loadingRow.replaceWith(createErrorDropdownRow(colSpan, 'Failed to fetch torrent data. Check API key.'));
              return;
            }

            const torrentData = torrentDataMap.get(torrentId);
            if (!torrentData) {
              loadingRow.replaceWith(createErrorDropdownRow(colSpan, 'Torrent data not found in API response'));
              return;
            }

            // Render dropdown
            const dropdownRow = create('tr', 'gz-dropdown-row');
            const td = create('td');
            td.setAttribute('colspan', colSpan);
            td.appendChild(renderTorrentDropdown(torrentData, colSpan));
            dropdownRow.appendChild(td);

            loadingRow.replaceWith(dropdownRow);
          });
        }

        // Appending Order: Name then Icons (Icons on the right)
        tdName.appendChild(newLink);
        tdName.appendChild(iconSpan);
        newRow.appendChild(tdName);

        // 4. Actions Column [ ED | BM | DL ] - Only if Enabled
        if (CONFIG.enableGazelleButtons) {
          const tdActions = create('td', 'gz-actions-cell');
          const actions = [];

          // Edit
          if (CONFIG.showEditButton) {
            const editLink = row.querySelector('.torrent-search--grouped__edit a');
            if (editLink) {
              const el = create('a');
              el.href = editLink.href;
              el.textContent = 'ED';
              el.title = 'Edit';
              actions.push(el);
            }
          }

          // Bookmark or Torrent Page link (depending on dropdown mode)
          if (CONFIG.enableTorrentDropdowns && torrentUrl) {
            // When dropdowns are enabled, show TP (Torrent Page) link instead of bookmark
            const tp = create('a');
            tp.href = torrentUrl;
            tp.textContent = 'TP';
            tp.title = 'Torrent Page';
            tp.target = '_blank';
            tp.rel = 'noopener';
            actions.push(tp);
          } else {
            // Normal bookmark button
            const bookmarkBtn = row.querySelector('.torrent-search--grouped__bookmark button');
            if (bookmarkBtn) {
              const bmClone = bookmarkBtn.cloneNode(true);
              bmClone.textContent = 'BM';
              bmClone.title = 'Bookmark';
              bmClone.classList.remove('form__button');
              bmClone.style.background = 'none';
              bmClone.style.border = 'none';
              bmClone.style.cursor = 'pointer';
              bmClone.style.padding = '0';
              bmClone.style.color = 'inherit';
              actions.push(bmClone);
            }
          }

          // Download
          const dlLink = row.querySelector('.torrent-search--grouped__download a');
          if (dlLink) {
            const dl = create('a');
            dl.href = dlLink.href;
            dl.textContent = 'DL';
            dl.title = 'Download';
            actions.push(dl);
          }

          // Trump Report Button
          if (torrentId) {
            const tr = create('button');
            tr.textContent = 'TR';
            tr.title = 'Trump Report';
            tr.style.background = 'none';
            tr.style.border = 'none';
            tr.style.cursor = 'pointer';
            tr.style.padding = '0';
            tr.style.color = 'inherit';
            tr.style.font = 'inherit';
            tr.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              showTrumpReportModal(torrentId, torrentDisplayName, seasonGroup, isSeasonLayout);
            });
            actions.push(tr);
          }

          actions.forEach((act, idx) => {
            tdActions.appendChild(act);
            if (idx < actions.length - 1) {
              tdActions.appendChild(document.createTextNode(' | '));
            }
          });

          if (actions.length > 0) {
            tdActions.prepend(document.createTextNode('[ '));
            tdActions.appendChild(document.createTextNode(' ]'));
          }
          newRow.appendChild(tdActions);
        }

        // 5. Size
        const tdSize = create('td', 'gz-col-size');
        const sizeCell = row.querySelector('.torrent-search--grouped__size');
        tdSize.textContent = getText(sizeCell);
        newRow.appendChild(tdSize);

        // 6. Seeders
        const tdSeeders = create('td', 'gz-col-stat');
        const seedersCell = row.querySelector('.torrent-search--grouped__seeders, .torrent__seeder-count');
        const seedersLink = seedersCell ? (seedersCell.tagName === 'A' ? seedersCell : seedersCell.querySelector('a')) : null;
        if (seedersLink) {
          const link = create('a');
          link.href = seedersLink.href;
          link.textContent = getText(seedersCell);
          link.style.color = 'inherit';
          link.style.textDecoration = 'none';
          tdSeeders.appendChild(link);
        } else {
          tdSeeders.textContent = getText(seedersCell);
        }
        tdSeeders.style.color = '#76dba6';
        if (seedersCell) {
          if (seedersCell.classList) {
            seedersCell.classList.forEach(cls => {
              if (cls.startsWith('torrent-activity-indicator--')) {
                tdSeeders.classList.add(cls);
              }
            });
          }
          if (seedersCell.title) tdSeeders.title = seedersCell.title;
        }
        newRow.appendChild(tdSeeders);

        // 7. Leechers
        const tdLeechers = create('td', 'gz-col-stat');
        const leechersCell = row.querySelector('.torrent-search--grouped__leechers, .torrent__leecher-count');
        const leechersLink = leechersCell ? (leechersCell.tagName === 'A' ? leechersCell : leechersCell.querySelector('a')) : null;
        if (leechersLink) {
          const link = create('a');
          link.href = leechersLink.href;
          link.textContent = getText(leechersCell);
          link.style.color = 'inherit';
          link.style.textDecoration = 'none';
          tdLeechers.appendChild(link);
        } else {
          tdLeechers.textContent = getText(leechersCell);
        }
        tdLeechers.style.color = '#db7676';
        if (leechersCell) {
          if (leechersCell.classList) {
            leechersCell.classList.forEach(cls => {
              if (cls.startsWith('torrent-activity-indicator--')) {
                tdLeechers.classList.add(cls);
              }
            });
          }
          if (leechersCell.title) tdLeechers.title = leechersCell.title;
        }
        newRow.appendChild(tdLeechers);

        // 8. Snatched
        const tdSnatched = create('td', 'gz-col-stat');
        const snatchedCell = row.querySelector('.torrent-search--grouped__completed, .torrent__times-completed-count');
        const snatchedLink = snatchedCell ? (snatchedCell.tagName === 'A' ? snatchedCell : snatchedCell.querySelector('a')) : null;
        if (snatchedLink) {
          const link = create('a');
          link.href = snatchedLink.href;
          link.textContent = getText(snatchedCell);
          link.style.color = 'inherit';
          link.style.textDecoration = 'none';
          tdSnatched.appendChild(link);
        } else {
          tdSnatched.textContent = getText(snatchedCell);
        }
        if (snatchedCell) {
          if (snatchedCell.classList) {
            snatchedCell.classList.forEach(cls => {
              if (cls.startsWith('torrent-activity-indicator--')) {
                tdSnatched.classList.add(cls);
              }
            });
          }
          if (snatchedCell.title) tdSnatched.title = snatchedCell.title;
        }
        newRow.appendChild(tdSnatched);

        tbody.appendChild(newRow);
      });
    };

    if (isSeasonLayout) {
      // Find "Complete pack" section to merge into "Specials"
      const completePackSection = seasonDetails.find(s => {
        const summary = s.querySelector('summary');
        return summary && summary.getAttribute('x-bind') === 'complete';
      });

      // Filter out "Complete pack" from normal processing - it will be merged into "Specials"
      const filteredSeasonDetails = seasonDetails.filter(s => {
        const summary = s.querySelector('summary');
        return !(summary && summary.getAttribute('x-bind') === 'complete');
      });

      // Sort seasons: Regular seasons first (numeric descending), then Specials (last)
      filteredSeasonDetails.sort((a, b) => {
        const ta = normalizeText(getText(a.querySelector('summary')));
        const tb = normalizeText(getText(b.querySelector('summary')));

        // Check for Specials
        const isSpecA = ta.toLowerCase().includes('special');
        const isSpecB = tb.toLowerCase().includes('special');
        if (isSpecA && !isSpecB) return 1;
        if (!isSpecA && isSpecB) return -1;
        if (isSpecA && isSpecB) return 0;

        // Sort by Season Number (Descending)
        const na = parseInt((ta.match(/\d+/) || ['0'])[0]);
        const nb = parseInt((tb.match(/\d+/) || ['0'])[0]);
        return nb - na;
      });

      filteredSeasonDetails.forEach(season => {
        const seasonSummary = normalizeText(getText(season.querySelector('summary')));

        // Determine prefix (S01 or S00 for Specials)
        const isSpecials = seasonSummary.toLowerCase().includes('special');
        let seasonPrefix = 'S??';
        if (isSpecials) {
          seasonPrefix = 'S00';
        } else {
          const seasonNumMatch = seasonSummary.match(/(\d+)/);
          if (seasonNumMatch) {
            seasonPrefix = `S${seasonNumMatch[0].padStart(2, '0')}`;
          }
        }

        // Header Row (Main Season Header)
        // Colspan: 6 (base) or 7 (with actions)
        const colSpan = CONFIG.enableGazelleButtons ? 7 : 6;
        const seasonRow = create('tr', 'gz-season-header');
        seasonRow.innerHTML = `<td colspan="${colSpan}">${seasonSummary}</td>`;
        tbody.appendChild(seasonRow);

        // If this is "Specials", also process "Complete pack" rows first with S00 label
        if (isSpecials && completePackSection) {
          const completeTable = completePackSection.querySelector('table');
          if (completeTable) {
            processRows($$('tbody tr', completeTable), 'S00', 'S00');
          }
        }

        // 1. Check for Season Packs (mixed content)
        const packSummaries = Array.from(season.querySelectorAll('summary[x-bind="pack"]'));
        // Include both Episode and Special inner items
        const episodeSummaries = Array.from(season.querySelectorAll('summary[x-bind="episode"], summary[x-bind="special"]'));
        const hasEpisodes = episodeSummaries.length > 0;

        if (packSummaries.length > 0) {
          packSummaries.forEach(packSummary => {
            const packDetails = packSummary.closest('details');
            const table = packDetails.querySelector('table');
            // If episodes exist, use "S01" to distinguish packs from episodes.
            // If NO episodes exist, the main Season header is enough; hide the mini-header.
            const label = hasEpisodes ? seasonPrefix : '';
            if (table) processRows($$('tbody tr', table), label, seasonPrefix);
          });
        }

        // 2. Check for nested episodes
        if (hasEpisodes) {
          // Handle Episodic/Special content
          episodeSummaries.forEach(epSummary => {
            const epDetails = epSummary.closest('details');
            const epText = normalizeText(getText(epSummary));
            // Match "Episode 1" or "Special 1" or simple numbers
            const epNumMatch = epText.match(/(?:Episode|Special)\s*(\d+)/i) || epText.match(/(\d+)/);
            const epNum = epNumMatch ? epNumMatch[1].padStart(2, '0') : '??';
            const epId = `${seasonPrefix}E${epNum}`;

            const table = epDetails.querySelector('table');
            if (table) processRows($$('tbody tr', table), epId, seasonPrefix);
          });
        }

        // 3. Fallback: Direct table if NO packs and NO episodes
        if (packSummaries.length === 0 && !hasEpisodes) {
          // Handle Direct content (no nested structure found)
          const table = season.querySelector('table');
          if (table) {
            // Pass empty string to avoid duplicating the Season header
            processRows($$('tbody tr', table), '', seasonPrefix);
          }
        }
      });

      // Handle edge case: If there's a "Complete pack" but no "Specials" section,
      // create a "Specials" header and process the complete pack under it
      if (completePackSection && !filteredSeasonDetails.some(s => {
        const summary = normalizeText(getText(s.querySelector('summary')));
        return summary.toLowerCase().includes('special');
      })) {
        const colSpan = CONFIG.enableGazelleButtons ? 7 : 6;
        const seasonRow = create('tr', 'gz-season-header');
        seasonRow.innerHTML = `<td colspan="${colSpan}">Specials</td>`;
        tbody.appendChild(seasonRow);

        const completeTable = completePackSection.querySelector('table');
        if (completeTable) {
          processRows($$('tbody tr', completeTable), 'S00', 'S00');
        }
      }
    } else {
      // Movie Layout (Flat)
      processRows(movieRows, '', null);
    }

    newTable.appendChild(tbody);

    const wrapper = section.querySelector('.data-table-wrapper') || section;

    // Hide original content locally instead of removing it from DOM
    // This allows other scripts (like Seadex) to find the original rows and modify them
    Array.from(wrapper.children).forEach(child => {
      if (!child.classList.contains('gz-torrent-table')) {
        child.style.display = 'none';
      }
    });

    wrapper.appendChild(newTable);

    // Observe the original hidden wrapper for changes (like Async Seadex icons)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Only process when nodes are ADDED, not removed
          // This prevents race conditions when we move icons (which triggers remove mutations)
          const target = mutation.target;
          if (target.matches && (target.matches('.torrent-icons') || target.closest('.torrent-icons'))) {
            const row = target.closest('tr');
            const syncId = row ? row.dataset.gzSyncId : null;
            if (syncId) {
              const newRow = newTable.querySelector(`tr[data-gz-sync-id="${syncId}"]`);
              if (newRow) {
                const iconSpan = newRow.querySelector('.gz-torrent-icons');
                if (iconSpan) {
                  // Process only the newly added nodes, don't rebuild everything
                  mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;

                    // Check if this is a Seadex icon (or contains one)
                    const isSeadexDirect = node.hasAttribute && node.hasAttribute('data-seadex');
                    const containsSeadex = node.querySelector && node.querySelector('[data-seadex]');
                    const seadexElement = isSeadexDirect ? node : containsSeadex;

                    if (seadexElement) {
                      // For Seadex icons: MOVE them to preserve event listeners
                      // Find the containing li if wrapped, otherwise move the element directly
                      const elementToMove = seadexElement.closest('li') || seadexElement;
                      iconSpan.appendChild(elementToMove);
                    } else {
                      // Check if it's another "keep" icon
                      const isKeep = node.classList && (
                        node.classList.contains('torrent-icons__torrent-trump') ||
                        node.classList.contains('torrent-icons__personal-release') ||
                        node.classList.contains('torrent-icons__internal')
                      );

                      if (!CONFIG.removeTorrentIcons || isKeep) {
                        // Skip comment icons
                        if (node.classList && (node.classList.contains('fa-comment-alt-plus') || node.classList.contains('torrent-icons__comments'))) return;
                        iconSpan.appendChild(node.cloneNode(true));
                      }
                    }
                  });
                }
              }
            }
          }
        }
      });
    });

    observer.observe(wrapper, { childList: true, subtree: true });

    // Remove "Expand all" button
    const expandBtn = section.querySelector('.panel__actions button[x-bind="all"]');
    if (expandBtn) expandBtn.parentElement.remove();
  };

  const buildSimilarLayout = (article = $(SELECTORS.similarArticle)) => {
    if (!article) return false;

    gazellify();

    if (CONFIG.enableGazelleTorrentLayout) {
      gazellifyTorrentLayout(article);
      const filters = article.querySelector('.compact-search.similar-torrents__filters');
      if (filters) filters.remove();
    } else {
      expandAllTorrentGroups();
      watchTorrentDecorations();
    }

    if (article.querySelector(':scope > .gz-similar-layout')) return true;
    if (!CONFIG.enableSideLayout) return true;

    const meta = $(SELECTORS.metaSection, article);
    const torrents = $(SELECTORS.torrentGroup, article);
    if (!meta || !torrents) return false;

    // Create the page header with title and action links
    const createPageHeader = () => {
      const header = create('div', 'gz-page-header');

      // Extract and clone the title
      const titleLink = meta.querySelector('.meta__title-link');
      if (titleLink) {
        const titleEl = create('h1', 'gz-page-header__title');
        const titleAnchor = titleLink.cloneNode(true);
        titleAnchor.className = '';
        titleEl.appendChild(titleAnchor);
        header.appendChild(titleEl);
      }

      // Extract action links from the dropdown menu
      const dropdown = meta.querySelector('.meta__dropdown');
      if (dropdown) {
        const actionsEl = create('div', 'gz-page-header__actions');
        const items = dropdown.querySelectorAll('li');

        items.forEach((item, index) => {
          const link = item.querySelector('a');
          const form = item.querySelector('form');

          if (link) {
            const newLink = link.cloneNode(true);
            newLink.className = '';
            actionsEl.appendChild(newLink);
          } else if (form) {
            // Clone the entire form to preserve functionality
            const newForm = form.cloneNode(true);
            newForm.style.display = 'inline';
            actionsEl.appendChild(newForm);
          }

          // Add separator between items
          if (index < items.length - 1) {
            const sep = create('span', 'gz-separator');
            sep.textContent = '|';
            actionsEl.appendChild(sep);
          }
        });

        if (actionsEl.children.length > 0) {
          header.appendChild(actionsEl);
        }
      }

      // Remove the original dropdown and title from meta (since they're now in header)
      const actionsDiv = meta.querySelector('.meta__actions');
      if (actionsDiv) actionsDiv.remove();

      return header;
    };

    const extraPanels = ['requests', 'playlists', 'collection', 'Also downloaded']
      .map((label) => findPanelByHeading(label))
      .filter(Boolean);

    removeNode($(SELECTORS.searchBox, article));

    // Create and insert the page header before the layout
    const pageHeader = createPageHeader();

    const { layout, left, right } = createLayoutContainer(article, article.firstElementChild);

    // Insert header before the layout
    if (pageHeader.children.length > 0) {
      layout.parentNode.insertBefore(pageHeader, layout);
    }

    // Wrap torrent table in a panelV2 with a 'Torrents' heading
    const torrentsPanel = create('section', 'panelV2');
    const torrentsHeader = create('header', 'panel__header');
    const torrentsHeading = create('h2', 'panel__heading');
    torrentsHeading.textContent = 'Torrents';
    torrentsHeader.appendChild(torrentsHeading);
    torrentsPanel.appendChild(torrentsHeader);
    torrentsPanel.appendChild(torrents);
    appendAll(left, [torrentsPanel]);

    const { panels, leftPanels } = createMetaPanels(meta, true);
    if (!panels.length && !leftPanels.length) return false;

    // Insert left panels (Synopsis, Cast) right after torrents, before extra panels
    leftPanels.forEach(panel => left.appendChild(panel));
    appendAll(left, extraPanels);

    panels.forEach(panel => right.appendChild(panel));

    return true;
  };

  const buildTorrentLayout = (article = $(SELECTORS.torrentArticle)) => {
    if (!article) return false;

    updateDetailTitle();

    if (article.querySelector(':scope > .gz-similar-layout')) return true;
    if (!CONFIG.enableSideLayout) return true;

    const meta = $(SELECTORS.metaSection, article);
    if (!meta) return false;

    // Create the page header with title and action links (same as similar page)
    const createPageHeader = () => {
      const header = create('div', 'gz-page-header');

      // Extract and clone the title
      const titleLink = meta.querySelector('.meta__title-link');
      if (titleLink) {
        const titleEl = create('h1', 'gz-page-header__title');
        const titleAnchor = titleLink.cloneNode(true);
        titleAnchor.className = '';
        titleEl.appendChild(titleAnchor);
        header.appendChild(titleEl);
      }

      // Extract action links from the dropdown menu
      const dropdown = meta.querySelector('.meta__dropdown');
      if (dropdown) {
        const actionsEl = create('div', 'gz-page-header__actions');
        const items = dropdown.querySelectorAll('li');

        items.forEach((item, index) => {
          const link = item.querySelector('a');
          const form = item.querySelector('form');

          if (link) {
            const newLink = link.cloneNode(true);
            newLink.className = '';
            actionsEl.appendChild(newLink);
          } else if (form) {
            // Clone the entire form to preserve functionality
            const newForm = form.cloneNode(true);
            newForm.style.display = 'inline';
            actionsEl.appendChild(newForm);
          }

          // Add separator between items
          if (index < items.length - 1) {
            const sep = create('span', 'gz-separator');
            sep.textContent = '|';
            actionsEl.appendChild(sep);
          }
        });

        if (actionsEl.children.length > 0) {
          header.appendChild(actionsEl);
        }
      }

      // Remove the original dropdown from meta (since it's now in header)
      const actionsDiv = meta.querySelector('.meta__actions');
      if (actionsDiv) actionsDiv.remove();

      return header;
    };

    const torrentButtons = $(SELECTORS.torrentButtons, article);

    // Keep .torrent__tags as a direct child of article for Seadex compatibility
    // Seadex uses 'article > ul.torrent__tags' selector which requires direct child
    const torrentTags = article.querySelector(':scope > ul.torrent__tags');

    const fragment = document.createDocumentFragment();
    Array.from(article.children).forEach((child) => {
      if (child === meta || child === torrentButtons) return;
      // Skip torrent tags - we'll handle it specially for Seadex compatibility
      if (child === torrentTags) return;
      fragment.appendChild(child);
    });

    // Create and insert the page header before the layout
    const pageHeader = createPageHeader();

    const { layout, left, right } = createLayoutContainer(article, meta);

    // Insert header before the layout
    if (pageHeader.children.length > 0) {
      layout.parentNode.insertBefore(pageHeader, layout);
    }

    left.appendChild(fragment);

    // Keep torrent buttons in their original form (don't convert to inline buttons)
    if (torrentButtons) {
      left.insertBefore(torrentButtons, left.firstElementChild || null);
    }

    // For Seadex compatibility: Keep the original .torrent__tags as a hidden direct child of article
    // Seadex will add its icon there. We'll observe it and sync any Seadex icons to our visible layout.
    if (torrentTags) {
      // Clone the tags to display in the layout
      const visibleTags = torrentTags.cloneNode(true);
      visibleTags.classList.add('gz-visible-tags');

      // Insert visible tags at the beginning of the left column (or wherever appropriate)
      left.insertBefore(visibleTags, left.firstElementChild || null);

      // Hide the original but keep it for Seadex to find
      torrentTags.style.display = 'none';

      // Observe the hidden original for Seadex icons
      const tagsObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              // Check if a Seadex icon was added (it has data-seadex attribute)
              if (node.nodeType === 1) {
                const seadexIcon = node.querySelector ?
                  (node.hasAttribute('data-seadex') ? node : node.querySelector('[data-seadex]')) :
                  null;
                if (seadexIcon || (node.hasAttribute && node.hasAttribute('data-seadex'))) {
                  // Move the Seadex element to visible tags (preserves click handlers)
                  const elementToMove = seadexIcon || node;
                  // Find the corresponding li in visible tags, or append to visible tags
                  visibleTags.appendChild(elementToMove.closest('li') || elementToMove);
                }
              }
            });
          }
        });
      });

      tagsObserver.observe(torrentTags, { childList: true, subtree: true });
    }

    const { panels } = createMetaPanels(meta, false);
    if (!panels.length) return false;
    panels.forEach(panel => right.appendChild(panel));

    return true;
  };

  const initPage = () => {
    if ($(SELECTORS.layout)) return true;

    const similarArticle = $(SELECTORS.similarArticle);
    if (similarArticle) {
      return buildSimilarLayout(similarArticle);
    }

    const torrentArticle = $(SELECTORS.torrentArticle);
    if (torrentArticle) {
      return buildTorrentLayout(torrentArticle);
    }

    const searchPage = $(SELECTORS.torrentSearchPage);
    if (searchPage) {
      if (CONFIG.enableGazellifySearch) {
        gazellifySearchResults();
        watchSearchResults();
      }
      return true;
    }

    return false;
  };

  // Config option definitions for the modal
  const CONFIG_OPTIONS = [
    { key: 'removeTorrentIcons', label: 'Remove torrent icons' },
    { key: 'enableGazellifySimilar', label: 'Gazellify similar page titles' },
    { key: 'enableGazellifyDetail', label: 'Gazellify detail page titles' },
    { key: 'enableGazellifySearch', label: 'Gazellify search page titles' },
    { key: 'enableOriginalTitleTooltip', label: 'Show original title tooltip' },
    { key: 'showEditButton', label: 'Show edit button' },
    { key: 'enableSideLayout', label: 'Enable side layout' },
    { key: 'enableGazelleButtons', label: 'Enable Gazelle-style buttons' },
    { key: 'enableGazelleTorrentLayout', label: 'Enable Gazelle torrent table layout' },
    { key: 'enableTorrentDropdowns', label: 'Enable torrent dropdowns (requires API key)' },
    { key: 'enableComponentColors', label: 'Enable component colors in Gazellify names' },
    { key: 'baseFontSize', label: 'Base Font Size (%)', type: 'number', min: 50, max: 200 },
  ];

  // Create and show config modal
  const showConfigModal = () => {
    // Remove any existing modal
    const existing = document.querySelector('.gz-config-overlay');
    if (existing) existing.remove();

    const overlay = create('div', 'gz-config-overlay');
    const modal = create('div', 'gz-config-modal');

    // Header
    const header = create('div', 'gz-config-header');
    const title = create('h3', 'gz-config-title');
    title.textContent = '⚙️ GAZELL3D Settings';
    const closeBtn = create('button', 'gz-config-close');
    closeBtn.textContent = '×';
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // API Key Section
    const apiSection = create('div', 'gz-config-section');
    const apiTitle = create('div', 'gz-config-section-title');
    apiTitle.textContent = 'API Key';
    apiSection.appendChild(apiTitle);

    const apiField = create('div', 'gz-config-input-field');
    const apiLabel = create('label', 'gz-config-input-label');
    apiLabel.textContent = 'Aither API Key (required for dropdowns)';
    apiLabel.setAttribute('for', 'gz-api-key-input');
    const apiInput = create('input', 'gz-config-input');
    apiInput.type = 'password';
    apiInput.id = 'gz-api-key-input';
    apiInput.placeholder = 'Enter your API key...';
    apiInput.value = AITHER_API_KEY || '';
    apiField.appendChild(apiLabel);
    apiField.appendChild(apiInput);
    apiSection.appendChild(apiField);
    modal.appendChild(apiSection);

    // Options Section
    const optionsSection = create('div', 'gz-config-section');
    const optionsTitle = create('div', 'gz-config-section-title');
    optionsTitle.textContent = 'Options';
    optionsSection.appendChild(optionsTitle);

    const inputs = {};
    CONFIG_OPTIONS.forEach(opt => {
      const field = create('div', 'gz-config-field');
      const label = create('label', 'gz-config-label');

      if (opt.type === 'number') {
        const input = create('input');
        input.type = 'number';
        input.min = opt.min || 0;
        input.max = opt.max || 1000;
        input.value = CONFIG[opt.key] ?? DEFAULT_CONFIG[opt.key];
        input.style.width = '60px';
        input.style.marginRight = '8px';
        inputs[opt.key] = input;

        label.appendChild(input);
        label.appendChild(document.createTextNode(opt.label));
      } else {
        const checkbox = create('input');
        checkbox.type = 'checkbox';
        checkbox.checked = CONFIG[opt.key] ?? DEFAULT_CONFIG[opt.key];
        inputs[opt.key] = checkbox;

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(opt.label));
      }

      field.appendChild(label);
      optionsSection.appendChild(field);
    });
    modal.appendChild(optionsSection);

    // Colors Section
    const colorsSection = create('div', 'gz-config-section');
    const colorsTitle = create('div', 'gz-config-section-title');
    colorsTitle.textContent = 'Component Colors';
    colorsSection.appendChild(colorsTitle);

    const colorsGrid = create('div');
    colorsGrid.style.display = 'grid';
    colorsGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    colorsGrid.style.gap = '8px';

    const colorInputs = {};
    Object.keys(DEFAULT_CONFIG.componentColors).forEach(key => {
      const field = create('div', 'gz-config-field');
      const label = create('label', 'gz-config-label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';

      const input = create('input');
      input.type = 'color';
      input.value = CONFIG.componentColors[key] || DEFAULT_CONFIG.componentColors[key];
      input.style.marginRight = '8px';
      input.style.cursor = 'pointer';

      colorInputs[key] = input;

      label.appendChild(input);
      label.appendChild(document.createTextNode(SEQUENCE_LABELS[key] || key));
      field.appendChild(label);
      colorsGrid.appendChild(field);
    });

    colorsSection.appendChild(colorsGrid);
    modal.appendChild(colorsSection);

    // Sequence Order Section
    const sequenceSection = create('div', 'gz-config-section');
    const sequenceTitle = create('div', 'gz-config-section-title');
    sequenceTitle.textContent = 'Torrent Name Sequence Order';
    sequenceSection.appendChild(sequenceTitle);

    const sequenceDesc = create('div', 'gz-config-input-label');
    sequenceDesc.textContent = 'Drag to reorder, toggle checkbox to enable/disable:';
    sequenceDesc.style.marginBottom = '10px';
    sequenceSection.appendChild(sequenceDesc);

    const sequenceList = create('div', 'gz-sequence-list');
    let currentSequence = [...SEQUENCE_CONFIG.order];
    let disabledItems = new Set(SEQUENCE_CONFIG.disabled);

    const createSequenceItem = (key) => {
      const isDisabled = disabledItems.has(key);
      const item = create('div', 'gz-sequence-item' + (isDisabled ? ' disabled' : ''));
      item.draggable = true;
      item.dataset.key = key;

      // Toggle checkbox
      const toggle = create('input', 'gz-sequence-toggle');
      toggle.type = 'checkbox';
      toggle.checked = !isDisabled;
      toggle.title = isDisabled ? 'Enable this component' : 'Disable this component';
      toggle.onclick = (e) => {
        e.stopPropagation();
        if (toggle.checked) {
          disabledItems.delete(key);
        } else {
          disabledItems.add(key);
        }
        renderSequenceList();
      };

      const handle = create('span', 'gz-sequence-handle');
      const label = create('span', 'gz-sequence-label');
      label.textContent = SEQUENCE_LABELS[key] || key;
      const keySpan = create('span', 'gz-sequence-key');
      keySpan.textContent = key;

      item.appendChild(toggle);
      item.appendChild(handle);
      item.appendChild(label);
      item.appendChild(keySpan);

      // Drag events
      item.addEventListener('dragstart', (e) => {
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', key);
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        document.querySelectorAll('.gz-sequence-item').forEach(el => el.classList.remove('drag-over'));
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const dragging = document.querySelector('.gz-sequence-item.dragging');
        if (dragging && dragging !== item) {
          item.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        const draggedKey = e.dataTransfer.getData('text/plain');
        const targetKey = item.dataset.key;

        if (draggedKey && draggedKey !== targetKey) {
          const draggedIndex = currentSequence.indexOf(draggedKey);
          const targetIndex = currentSequence.indexOf(targetKey);

          if (draggedIndex !== -1 && targetIndex !== -1) {
            // Remove from old position
            currentSequence.splice(draggedIndex, 1);
            // Insert at new position
            currentSequence.splice(targetIndex, 0, draggedKey);

            // Re-render list
            renderSequenceList();
          }
        }
      });

      return item;
    };

    const renderSequenceList = () => {
      sequenceList.innerHTML = '';
      currentSequence.forEach(key => {
        sequenceList.appendChild(createSequenceItem(key));
      });
    };

    renderSequenceList();
    sequenceSection.appendChild(sequenceList);

    // Reset button
    const resetBtn = create('button', 'gz-sequence-reset');
    resetBtn.textContent = '↺ Reset to Default';
    resetBtn.onclick = () => {
      currentSequence = [...DEFAULT_GAZELLIFY_SEQUENCE];
      disabledItems = new Set();
      renderSequenceList();
    };
    sequenceSection.appendChild(resetBtn);

    modal.appendChild(sequenceSection);

    // Buttons
    const buttons = create('div', 'gz-config-buttons');
    const cancelBtn = create('button', 'gz-config-btn gz-config-btn--cancel');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => overlay.remove();

    const saveBtn = create('button', 'gz-config-btn gz-config-btn--save');
    saveBtn.textContent = 'Save & Reload';
    saveBtn.onclick = () => {
      // Save API key
      const newApiKey = apiInput.value.trim();
      saveApiKey(newApiKey);

      // Save config options
      const newConfig = {};
      CONFIG_OPTIONS.forEach(opt => {
        if (opt.type === 'number') {
          newConfig[opt.key] = parseInt(inputs[opt.key].value, 10) || DEFAULT_CONFIG[opt.key];
        } else {
          newConfig[opt.key] = inputs[opt.key].checked;
        }
      });

      newConfig.componentColors = {};
      Object.keys(DEFAULT_CONFIG.componentColors).forEach(key => {
        newConfig.componentColors[key] = colorInputs[key].value;
      });

      saveUserConfig(newConfig);

      // Save sequence order and disabled items
      saveGazellifySequence(currentSequence, disabledItems);

      // Reload to apply changes
      overlay.remove();
      window.location.reload();
    };

    buttons.appendChild(cancelBtn);
    buttons.appendChild(saveBtn);
    modal.appendChild(buttons);

    overlay.appendChild(modal);
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };

    document.body.appendChild(overlay);
  };

  // Inject config button into footer
  const injectConfigButton = () => {
    // Find the footer section with "Torrenting - Modernized"
    const footerSections = document.querySelectorAll('.footer__section');
    let targetSection = null;

    for (const section of footerSections) {
      const p = section.querySelector('p');
      if (p && p.textContent.includes('Torrenting')) {
        targetSection = section;
        break;
      }
    }

    if (!targetSection) return;

    // Check if already injected
    if (targetSection.querySelector('.gz-config-link')) return;

    const configLink = create('span', 'gz-config-link');
    configLink.textContent = '⚙️ GAZELL3D Config';
    configLink.onclick = showConfigModal;
    targetSection.appendChild(configLink);
  };

  const initApp = async () => {
    try {
      const config = await loadConfig();
      SCENE_RELEASE_GROUPS = new Set((config.SCENE_RELEASE_GROUPS || []).map(normalizeSceneGroupName));
      SERVICE_TOKENS = config.SERVICE_TOKENS || [];
      COUNTRY_MAP = config.COUNTRY_MAP || {};
      LANGUAGE_MAP = config.LANGUAGE_MAP || {};
      TAG_STYLES = config.TAG_STYLES || {};

      // Initialize dependent sets
      RELEASE_GROUP_BLOCK_TOKENS = initReleaseGroupBlockTokens();

      const baseZoom = (CONFIG.baseFontSize || 100) / 100;
      const dynamicStyles = baseZoom !== 1 ? `
        main.page__torrent-similar--index article,
        main.page__torrent--show article {
          zoom: ${baseZoom};
        }
        .comparison__screenshots {
          zoom: ${1 / baseZoom};
        }
      ` : '';

      injectStyles(STYLE + dynamicStyles);
      if (CONFIG.enableOriginalTitleTooltip) {
        initTooltip();
      }

      // Inject config button into footer
      injectConfigButton();

      if (initPage()) return;

      const observer = new MutationObserver(() => {
        if (initPage()) observer.disconnect();
      });

      observer.observe(document.body, { childList: true, subtree: true });

    } catch (e) {
      console.error('GAZELL3D: Initialization failed', e);
    }
  };

  ready(initApp);
})();

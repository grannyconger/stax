// ============================================================
//  $tax Hall of Fame — app.js
//  Fetches directly from Google Sheets API v4
// ============================================================

'use strict';

// ------------------------------------------------------------
//  Global State
// ------------------------------------------------------------
let allData           = [];
let customViewsData   = [];
let uniqueGamesGlobal = [];
let currentSortMode   = 'networth';
let roiChartInstance  = null;
let dedupEnabled      = true;

// Filled from the backend payload — no hardcoded school year anywhere.
let CLASSES_PRESENT = [];   // [{ label, raw, season }] newest season first
let CUSTOM_VIEWS    = [];   // [{ name, periods[], performer, season }]
let CURRENT_SEASON  = null; // e.g. 2027
let SEASONS         = [];   // e.g. [2027, 2026, 2025, ...]

// The computer opponent's fixed starting investment in Build Your Stax.
const COMP_INV           = 214657.66;
const SEASON_SENTINEL    = 'BEST_OF_SEASON';

const ROI_BRACKETS = [
  { label: 'Lost Money', min: -Infinity, max: 0   },
  { label: '0 – 25%',   min: 0,         max: 25  },
  { label: '25 – 50%',  min: 25,        max: 50  },
  { label: '50 – 100%', min: 50,        max: 100 },
  { label: '100%+',     min: 100,       max: Infinity }
];

// CLASS_MAP and CUSTOM_VIEWS now come from the backend (see bootstrap below).



// ============================================================
//  Bootstrap
// ============================================================
window.addEventListener('DOMContentLoaded', function () {
  injectStyles();

  // We call your Apps Script URL instead of the Google API
  fetch(CONFIG.WEB_APP_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('Backend error: ' + res.status);
      return res.json();
    })
    .then(function (json) {
      if (json.error) {
        showError(json.error);
        return;
      }
      // The backend is the single source of truth for classes and seasons.
      // If an older Code.gs is still deployed, derive them here instead so
      // the page keeps working either way.
      var recs = json.records || [];
      if (json.classes && json.classes.length) {
        CLASSES_PRESENT = json.classes;
        CUSTOM_VIEWS    = json.customViews   || [];
        SEASONS         = json.seasons       || [];
        CURRENT_SEASON  = json.currentSeason || (SEASONS.length ? SEASONS[0] : null);
      } else {
        deriveViewsFromRecords(recs);
      }
      initializeDashboard(recs);
    })
    .catch(function (err) {
      showError('Could not load data. ' + err.message);
    });
});

// ============================================================
//  Inject CSS
// ============================================================
function injectStyles() {
  var style = document.createElement('style');
  style.textContent = [

    // ---- Dedup toggle (all screen sizes) ----
    '.dedup-toggle-wrap {',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 10px;',
    '  background: rgba(212,175,55,0.1);',
    '  border: 1px solid rgba(212,175,55,0.3);',
    '  border-radius: 4px;',
    '  padding: 8px 14px;',
    '}',
    '.dedup-toggle-wrap .form-check-label {',
    '  font-size: 0.78rem;',
    '  font-weight: 700;',
    '  text-transform: uppercase;',
    '  letter-spacing: 1px;',
    '  color: var(--olive-dark);',
    '  cursor: pointer;',
    '  margin: 0;',
    '  white-space: nowrap;',
    '}',
    '.form-check-input:checked {',
    '  background-color: var(--gold) !important;',
    '  border-color: var(--gold-dark) !important;',
    '}',

    // ---- Data-quality flag marker ----
    '.data-flag {',
    '  font-size: 0.85em;',
    '  cursor: help;',
    '  opacity: 0.9;',
    '}',
    '.data-flag-repaired    { color: #e8a838; }',
    '.data-flag-unparseable { color: #e74c3c; }',

    // ---- Overall leaderboard: current season, stacked centered ----
    '.overall-entry {',
    '  display: flex;',
    '  flex-direction: column;',
    '  align-items: center;',
    '  justify-content: center;',
    '  padding: 4px 0;',
    '  text-align: center;',
    '}',
    '.overall-entry .entry-name {',
    '  font-size: 1rem;',
    '  font-weight: 700;',
    '  color: var(--cream);',
    '  white-space: nowrap;',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '  max-width: 100%;',
    '}',
    '.overall-entry .entry-value {',
    '  font-family: monospace;',
    '  font-size: 0.95rem;',
    '  font-weight: 700;',
    '  color: var(--gold);',
    '  margin-top: 1px;',
    '}',

    // ---- Mobile: investor leaderboard 2-line layout ----
    '@media (max-width: 767px) {',

    // Wealth gap overflow fix
    '  .game-stat {',
    '    font-size: clamp(1.3rem, 5.5vw, 3rem) !important;',
    '    word-break: break-word;',
    '  }',

    // Hide columns on mobile: Top Asset (col 5), Date (col 6)
    '  #leaderboardBody tr td:nth-child(5),',
    '  #leaderboardBody tr td:nth-child(6),',
    '  #leaderboard-table thead th:nth-child(5),',
    '  #leaderboard-table thead th:nth-child(6) {',
    '    display: none !important;',
    '  }',

    // Mobile investor row: 2-line structure
    // Row cells use flex so name+period sit on line 1, portfolio on line 2
    '  #leaderboardBody tr {',
    '    display: grid;',
    '    grid-template-columns: 48px 1fr auto;',
    '    grid-template-rows: auto auto;',
    '    padding: 10px 0;',
    '    border-bottom: 1px solid rgba(212,175,55,0.2);',
    '    cursor: pointer;',
    '  }',
    '  #leaderboardBody tr:hover { background: var(--olive-dark); }',
    '  #leaderboardBody tr td {',
    '    display: block !important;',
    '    border: none !important;',
    '    padding: 2px 8px !important;',
    '    transform: none !important;',
    '    vertical-align: middle;',
    '  }',
    // Rank: col 1, spans both rows
    '  #leaderboardBody tr td:nth-child(1) {',
    '    grid-column: 1;',
    '    grid-row: 1 / 3;',
    '    display: flex !important;',
    '    align-items: center;',
    '    justify-content: center;',
    '    font-size: 1.2rem;',
    '  }',
    // Investor name: col 2, row 1
    '  #leaderboardBody tr td:nth-child(2) {',
    '    grid-column: 2;',
    '    grid-row: 1;',
    '    font-size: 0.9rem;',
    '    white-space: nowrap;',
    '    overflow: hidden;',
    '    text-overflow: ellipsis;',
    '  }',
    // Period: col 3, row 1
    '  #leaderboardBody tr td:nth-child(3) {',
    '    grid-column: 3;',
    '    grid-row: 1;',
    '    font-size: 0.75rem;',
    '    color: rgba(244,241,234,0.6);',
    '    white-space: nowrap;',
    '    text-align: right;',
    '  }',
    // Portfolio value: spans cols 2-3, row 2. Hide ROI small text.
    '  #leaderboardBody tr td:nth-child(4) {',
    '    grid-column: 2 / 4;',
    '    grid-row: 2;',
    '    font-size: 1rem;',
    '  }',
    '  #leaderboardBody tr td:nth-child(4) small {',
    '    display: none !important;',
    '  }',
    '  #leaderboardBody tr td:nth-child(4) .currency {',
    '    font-size: 1rem;',
    '  }',

    // Disable default hover transform on mobile
    '  .table-hover tbody tr:hover td { transform: none !important; }',

    // ---- Mobile: game leaderboard — hide Wealth Gap col ----
    '  #gameLeaderboardBody tr td:nth-child(7),',
    '  #game-table thead th:nth-child(7) {',
    '    display: none !important;',
    '  }',

    // ---- Mobile: team table — only Rank + Team Name ----
    '  #teamLeaderboardBody tr td:nth-child(3),',
    '  #teamLeaderboardBody tr td:nth-child(4),',
    '  #team-table thead th:nth-child(3),',
    '  #team-table thead th:nth-child(4) {',
    '    display: none !important;',
    '  }',
    '  #teamLeaderboardBody tr td:nth-child(2) { font-size: 1rem; }',

    '}'  // end @media
  ].join('\n');

  document.head.appendChild(style);
}


// ============================================================
//  Error Display
// ============================================================
function showError(msg) {
  var el = document.getElementById('statusMessage');
  if (el) el.innerHTML = '<div class="alert alert-danger rounded-0 shadow"><strong>Error:</strong> ' + msg + '</div>';
}


// ============================================================
//  Utilities
// ============================================================
function safeNum(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  var n = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  return isNaN(n) ? 0 : n;
}

function formatCurrency(n) {
  if (typeof n !== 'number' || isNaN(n)) return 'N/A';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(ts) {
  if (!ts) return '—';
  var d = new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toTitleCase(str) {
  return String(str || '').toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

/**
 * Fallback for an older backend that sends only "records".
 * Works out each class's label and school year from its raw name, so the
 * dropdown and the season views still build correctly.
 */
function deriveClassInfo(raw) {
  var s = String(raw || '').trim();
  var m = s.match(/([0-9][AB])\b/i);
  var period = m ? m[1].toUpperCase() : null;

  var y = s.match(/(\d{4})\s*-\s*(\d{2,4})/);
  var season = null;
  if (y) {
    season = y[2].length === 2 ? parseInt(String(y[1]).substring(0, 2) + y[2], 10)
                               : parseInt(y[2], 10);
  }
  var isMkt = /\bmkt\b|marketing/i.test(s);

  if (season && period) return { label: season + ' ' + (isMkt ? 'Marketing' : period), season: season };
  if (season && isMkt)  return { label: season + ' Marketing', season: season };
  return { label: s, season: season };
}

function deriveViewsFromRecords(recs) {
  var seasonSet = {}, seen = {};
  CLASSES_PRESENT = [];

  recs.forEach(function (r) {
    var raw = r.rawClassPeriod || r.classPeriod || 'Unknown';
    var info = deriveClassInfo(raw);
    // Keep whatever label the backend already produced, if it gave one
    if (r.classPeriod && r.classPeriod !== raw) info.label = r.classPeriod;
    r.classPeriod = info.label;
    r.season      = info.season;
    if (info.season) seasonSet[info.season] = true;
    if (!seen[info.label]) {
      seen[info.label] = true;
      CLASSES_PRESENT.push({ label: info.label, raw: raw, season: info.season });
    }
  });

  SEASONS = Object.keys(seasonSet).map(Number).sort(function (a, b) { return b - a; });
  CURRENT_SEASON = SEASONS.length ? SEASONS[0] : null;

  CUSTOM_VIEWS = [];
  SEASONS.forEach(function (yr) {
    var periods = [];
    recs.forEach(function (r) {
      if (r.season === yr) {
        var rp = String(r.rawClassPeriod || '').toLowerCase();
        if (rp && periods.indexOf(rp) === -1) periods.push(rp);
      }
    });
    CUSTOM_VIEWS.push({ name: 'BEST OF ' + yr, periods: periods, performer: null, season: yr });
  });
  ['savings account', 'certificate of deposit', 'index fund', 'individual stocks',
   'government bonds', 'crop commodity', 'gold'].forEach(function (p) {
    CUSTOM_VIEWS.push({ name: 'TOP ' + p.toUpperCase(), periods: [], performer: p, season: null });
  });

  CLASSES_PRESENT.sort(function (a, b) {
    if (a.season !== b.season) return (b.season || 0) - (a.season || 0);
    return a.label < b.label ? -1 : 1;
  });
}

/** Records from the newest season present in the data. */
function currentSeasonRecords() {
  if (CURRENT_SEASON === null || CURRENT_SEASON === undefined) return [];
  return allData.filter(function (r) { return r.season === CURRENT_SEASON; });
}

/** Rows whose portfolio/invested figures could not be read are excluded
 *  from averages, rankings and charts, but still shown so they can be fixed. */
function isScorable(r) {
  return r.dataFlag !== 'unparseable';
}

/** Small warning marker shown beside a value that needed interpretation. */
function flagMarker(r) {
  if (!r || !r.dataFlag) return '';
  var title = r.dataFlag === 'unparseable'
    ? 'Entry could not be read' + (r.sheetRow ? ' (sheet row ' + r.sheetRow + ')' : '') +
      '. Excluded from averages and ranking.'
    : 'Entry was reformatted from a malformed value' +
      (r.sheetRow ? ' (sheet row ' + r.sheetRow + ')' : '') + '. Worth verifying.';
  return ' <span class="data-flag data-flag-' + r.dataFlag + '" title="' +
         escHtml(title) + '">&#9888;</span>';
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}


// ============================================================
//  Initialize Dashboard
// ============================================================
function initializeDashboard(records) {
  if (!records || records.length === 0) {
    showError('No records found in the Reflections sheet. Check that the sheet is shared and the tab is named exactly "Reflections".');
    return;
  }

  var now  = new Date();
  var tsEl = document.getElementById('lastUpdated');
  if (tsEl) {
    tsEl.textContent = 'Last updated: '
      + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      + ' '
      + now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  }

  var statusEl = document.getElementById('statusMessage');
  if (statusEl) statusEl.style.display = 'none';

  var navEl = document.getElementById('navTabs');
  if (navEl) navEl.style.setProperty('display', 'flex', 'important');

  var indivEl = document.getElementById('indivView');
  if (indivEl) indivEl.style.display = 'block';

  allData         = records;
  customViewsData = CUSTOM_VIEWS;

  // Pre-compute numeric fields
  allData.forEach(function (row) {
    // The backend now sends real numbers. safeNum stays as a safety net so an
    // older cached payload of strings still works.
    row.numericValue         = safeNum(row.portfolioValue);
    row.totalInvestedNumeric = safeNum(row.totalInvested);
    row.expensesNumeric      = safeNum(row.expensesFromLifeEvents);
    row.totalReturnNumeric   = safeNum(row.totalReturn);
    if (row.season === undefined) row.season = null;

    row.roi = row.totalInvestedNumeric > 0
      ? ((row.numericValue - row.totalInvestedNumeric) / row.totalInvestedNumeric) * 100
      : 0;

    var stRatio     = row.totalInvestedNumeric > 0 ? (row.numericValue / row.totalInvestedNumeric) : 1;
    row.studentCAGR = stRatio > 0 ? (Math.pow(stRatio, 1 / 20) - 1) * 100 : 0;

    var compPort      = safeNum(row.computerNetWorth);
    row.compPortfolio = compPort;
    var compRatio     = COMP_INV > 0 ? (compPort / COMP_INV) : 1;
    row.compCAGR      = compRatio > 0 ? (Math.pow(compRatio, 1 / 20) - 1) * 100 : 0;
    row.margin        = row.numericValue - row.compPortfolio;

    var bm = String(row.beatMarket || '').toLowerCase();
    row.beatMarketBool = (bm === 'yes' || bm === 'true' || bm === '1');

    row.teamMatchKey = (row.teamName && row.teamName.toLowerCase() !== 'no team' && row.teamName.trim() !== '')
      ? row.teamName.trim().toLowerCase()
      : 'none';
  });

  // Add IDs to tables for CSS targeting
  var leaderTbl = document.querySelector('#leaderboardBody')        ? document.querySelector('#leaderboardBody').closest('table')        : null;
  var gameTbl   = document.querySelector('#gameLeaderboardBody')    ? document.querySelector('#gameLeaderboardBody').closest('table')    : null;
  var teamTbl   = document.querySelector('#teamLeaderboardBody')    ? document.querySelector('#teamLeaderboardBody').closest('table')    : null;
  if (leaderTbl) leaderTbl.id = 'leaderboard-table';
  if (gameTbl)   gameTbl.id   = 'game-table';
  if (teamTbl)   teamTbl.id   = 'team-table';

  // Hide BTM chart card entirely (removed feature)
  var btmCard = document.getElementById('btmChartWrap');
  if (btmCard) {
    var parentCard = btmCard.closest('.chart-card');
    if (parentCard) parentCard.style.display = 'none';
  }

  populateDropdowns();
  injectDedupToggle();
  updateLeaderboard();
  renderGameView();
  renderTeamView();

  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) {
    new bootstrap.Tooltip(el);
  });
}


// ============================================================
//  Dedup Toggle — both mobile and desktop
// ============================================================
function injectDedupToggle() {
  if (document.getElementById('dedupToggle')) return;

  var sortBar = document.querySelector('#indivView .d-flex.flex-column.flex-lg-row');
  if (!sortBar) return;

  var wrap = document.createElement('div');
  wrap.className = 'dedup-toggle-wrap mt-3 mt-lg-0';
  wrap.innerHTML = ''
    + '<div class="form-check form-switch mb-0">'
    + '  <input class="form-check-input" type="checkbox" id="dedupToggle" checked>'
    + '  <label class="form-check-label" for="dedupToggle">Best Score Only</label>'
    + '</div>';
  sortBar.appendChild(wrap);

  document.getElementById('dedupToggle').addEventListener('change', function () {
    dedupEnabled = this.checked;
    updateLeaderboard();
  });
}


// ============================================================
//  Deduplication — highest portfolio per student
// ============================================================
function deduplicateRecords(records) {
  var best = {};
  records.forEach(function (r) {
    var key = r.fullName.trim().toLowerCase();
    if (!best[key] || r.numericValue > best[key].numericValue) best[key] = r;
  });
  return Object.values(best);
}


// ============================================================
//  Tab Switching
// ============================================================
function switchTab(tab) {
  ['indiv', 'game', 'team'].forEach(function (t) {
    var view = document.getElementById(t === 'indiv' ? 'indivView' : t === 'game' ? 'gameView' : 'teamView');
    var btn  = document.getElementById(t === 'indiv' ? 'tabIndiv'  : t === 'game' ? 'tabGame'  : 'tabTeam');
    if (view) view.style.display = 'none';
    if (btn)  btn.classList.remove('active');
  });
  var activeView = document.getElementById(tab === 'indiv' ? 'indivView' : tab === 'game' ? 'gameView' : 'teamView');
  var activeBtn  = document.getElementById(tab === 'indiv' ? 'tabIndiv'  : tab === 'game' ? 'tabGame'  : 'tabTeam');
  if (activeView) activeView.style.display = 'block';
  if (activeBtn)  activeBtn.classList.add('active');
}


// ============================================================
//  Populate Dropdowns
// ============================================================
function populateDropdowns() {
  var selectIndiv = document.getElementById('classFilter');
  if (selectIndiv) {
    selectIndiv.innerHTML = '';

    var addOpt = function (value, text) {
      var opt = document.createElement('option');
      opt.value = value;
      opt.textContent = text;
      selectIndiv.appendChild(opt);
    };

    addOpt('ALL TIME', '🏆 ALL TIME RECORDS');

    // Newest season first, each followed by its class periods.
    // The asset ("TOP ...") views sit under the current season, as before.
    SEASONS.forEach(function (yr, seasonIdx) {
      var bestName = 'BEST OF ' + yr;
      if (CUSTOM_VIEWS.some(function (v) { return v.name === bestName; })) {
        addOpt('CUSTOM_' + bestName, '⭐ ' + bestName);
      }

      CLASSES_PRESENT
        .filter(function (c) { return c.season === yr; })
        .forEach(function (c) { addOpt(c.label, c.label); });

      if (seasonIdx === 0) {
        CUSTOM_VIEWS
          .filter(function (v) { return v.performer; })
          .forEach(function (v) { addOpt('CUSTOM_' + v.name, v.name); });
      }
    });

    // Any class whose season could not be determined
    CLASSES_PRESENT
      .filter(function (c) { return SEASONS.indexOf(c.season) === -1; })
      .forEach(function (c) { addOpt(c.label, c.label); });
  }

  var validGameSet = new Set();
  allData.forEach(function (r) {
    if (r.teamMatchKey !== 'none' && r.timestamp) {
      var d = new Date(r.timestamp);
      if (!isNaN(d) && r.classPeriod) {
        var dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        validGameSet.add(dateKey + ' | ' + r.classPeriod);
      }
    }
  });

  uniqueGamesGlobal = Array.from(validGameSet).sort(function (a, b) {
    return new Date(b.split(' | ')[0]) - new Date(a.split(' | ')[0]);
  });

  var selectGame = document.getElementById('gameFilter');
  if (selectGame) {
    selectGame.innerHTML = '';
    if (CURRENT_SEASON) {
      var bestOpt = document.createElement('option');
      bestOpt.value       = SEASON_SENTINEL;
      bestOpt.textContent = '⭐ BEST OF ' + CURRENT_SEASON + ' (Season)';
      selectGame.appendChild(bestOpt);
    }

    uniqueGamesGlobal.forEach(function (g) {
      var opt = document.createElement('option');
      opt.value = g; opt.textContent = g;
      selectGame.appendChild(opt);
    });

    // If the current season has no team entries yet (normal early in the
    // year), open on the most recent game that does, so the tab is not blank.
    var seasonHasTeams = currentSeasonRecords().some(function (r) {
      return r.teamMatchKey !== 'none' && isScorable(r);
    });
    if (!seasonHasTeams && uniqueGamesGlobal.length > 0) {
      selectGame.value = uniqueGamesGlobal[0];
    }
  }
}


// ============================================================
//  Asset Helpers
// ============================================================
function getAssetBadgeClass(asset) {
  var a = String(asset || '').toLowerCase();
  if (a.includes('stocks'))                          return 'asset-stocks';
  if (a.includes('index'))                           return 'asset-index';
  if (a.includes('savings'))                         return 'asset-savings';
  if (a.includes('cd') || a.includes('certificate')) return 'asset-cd';
  if (a.includes('bonds'))                           return 'asset-bonds';
  if (a.includes('crop'))                            return 'asset-crop';
  if (a.includes('gold'))                            return 'asset-gold';
  return 'asset-na';
}

function getAssetLabel(asset) {
  var a = String(asset || '').trim();
  return a === '' || a.toLowerCase() === 'none' ? 'N/A' : a;
}


// ============================================================
//  Sort Mode
// ============================================================
function setSortMode(mode) {
  currentSortMode = mode;
  updateLeaderboard();
}


// ============================================================
//  Filter Records
// ============================================================
function getFilteredRecords(filterValue) {
  var fv = String(filterValue || '').trim();
  if (fv === 'ALL TIME') return allData.slice();

  if (fv.startsWith('CUSTOM_')) {
    var viewName = fv.replace('CUSTOM_', '');
    var view     = CUSTOM_VIEWS.find(function (v) { return v.name === viewName; });
    if (!view) return [];
    if (view.performer) {
      var perf = view.performer.toLowerCase();
      return allData.filter(function (r) {
        return String(r.highestPerformer || '').toLowerCase().includes(perf);
      });
    }
    if (view.periods && view.periods.length > 0) {
      return allData.filter(function (r) {
        return view.periods.includes(String(r.rawClassPeriod || '').toLowerCase());
      });
    }
    return [];
  }

  var topMatch = CUSTOM_VIEWS.find(function (v) { return v.name === fv && v.performer; });
  if (topMatch) {
    var perf2 = topMatch.performer.toLowerCase();
    return allData.filter(function (r) {
      return String(r.highestPerformer || '').toLowerCase().includes(perf2);
    });
  }

  return allData.filter(function (r) { return r.classPeriod === fv; });
}


// ============================================================
//  Investors Leaderboard
// ============================================================
function updateLeaderboard() {
  var filterEl = document.getElementById('classFilter');
  var searchEl = document.getElementById('searchInput');
  if (!filterEl) return;

  var filterValue = filterEl.value;
  var searchTerm  = searchEl ? searchEl.value.trim().toLowerCase() : '';

  var filtered = getFilteredRecords(filterValue).filter(isScorable);
  if (dedupEnabled) filtered = deduplicateRecords(filtered);

  if (searchTerm) {
    filtered = filtered.filter(function (r) {
      return r.fullName.toLowerCase().includes(searchTerm);
    });
  }

  filtered.sort(function (a, b) {
    return currentSortMode === 'roi' ? b.roi - a.roi : b.numericValue - a.numericValue;
  });

  updateIndivStats(filtered);

  var tbody = document.getElementById('leaderboardBody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:rgba(244,241,234,0.5);padding:30px;">No records found.</td></tr>';
    return;
  }

  var allDataIndexes = filtered.map(function (r) { return allData.indexOf(r); });
  var html = '';

  filtered.forEach(function (row, idx) {
    var rank       = idx + 1;
    var medal      = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    var star       = row.beatMarketBool ? ' ⭐' : '';
    var roiColor   = row.roi >= 0 ? '#2ecc71' : '#e74c3c';
    var badgeClass = getAssetBadgeClass(row.highestPerformer);
    var assetLabel = getAssetLabel(row.highestPerformer);
    var delay      = Math.min(idx * 40, 800);
    var idxJson    = escHtml(JSON.stringify(allDataIndexes));

    html += '<tr class="animated-row" style="animation-delay:' + delay + 'ms" onclick="openPlayerModal(' + idx + ',' + idxJson + ')">';
    // col 1: rank
    html += '<td class="rank-col">' + medal + '</td>';
    // col 2: name
    html += '<td><strong>' + escHtml(row.fullName) + '</strong>' + star + flagMarker(row) + '</td>';
    // col 3: period
    html += '<td>' + escHtml(row.classPeriod) + '</td>';
    // col 4: portfolio + ROI (ROI hidden on mobile via CSS)
    html += '<td><span class="currency">' + formatCurrency(row.numericValue) + '</span>'
          + '<br><small style="color:' + roiColor + ';font-weight:700;">' + row.roi.toFixed(1) + '% ROI</small></td>';
    // col 5: top asset (hidden on mobile)
    html += '<td><span class="badge ' + badgeClass + '">' + escHtml(assetLabel) + '</span></td>';
    // col 6: date (hidden on mobile)
    html += '<td><small>' + formatDate(row.timestamp) + '</small></td>';
    html += '</tr>';
  });

  tbody.innerHTML = html;
}

function updateIndivStats(filtered) {
  filtered = filtered.filter(isScorable);
  var avgEl = document.getElementById('statAvgVal');
  if (avgEl) {
    if (filtered.length === 0) {
      avgEl.textContent = '--';
    } else {
      var sum = filtered.reduce(function (acc, r) { return acc + r.numericValue; }, 0);
      avgEl.textContent = formatCurrency(sum / filtered.length);
    }
  }
  var highEl = document.getElementById('statTopHigh');
  if (highEl) highEl.textContent = getMostCommonAsset(filtered, 'highestPerformer');
  var lowEl  = document.getElementById('statTopLow');
  if (lowEl)  lowEl.textContent  = getMostCommonAsset(filtered, 'lowestPerformer');
}

function getMostCommonAsset(records, field) {
  var counts = {};
  records.forEach(function (r) {
    var val = String(r[field] || '').trim().toLowerCase();
    if (val && val !== 'none' && val !== 'n/a') counts[val] = (counts[val] || 0) + 1;
  });
  var keys = Object.keys(counts);
  if (keys.length === 0) return '--';
  keys.sort(function (a, b) { return counts[b] - counts[a]; });
  return toTitleCase(keys[0]);
}


// ============================================================
//  Player Modal
// ============================================================
function openPlayerModal(filteredIdx, allDataIndexes) {
  var dataIdx = Array.isArray(allDataIndexes) ? allDataIndexes[filteredIdx] : filteredIdx;
  var row = allData[dataIdx];
  if (!row) return;

  var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };

  var nameEl = document.getElementById('modalName');
  if (nameEl) nameEl.innerHTML = escHtml(row.fullName) + flagMarker(row);
  set('modalPortfolio',   formatCurrency(row.numericValue));
  set('modalInvested',    row.totalInvestedNumeric  > 0  ? formatCurrency(row.totalInvestedNumeric)  : 'N/A');
  set('modalExpenses',    row.expensesNumeric        > 0  ? formatCurrency(row.expensesNumeric)        : 'N/A');
  set('modalTotalReturn', row.totalReturnNumeric    !== 0 ? formatCurrency(row.totalReturnNumeric)    : 'N/A');

  var roiEl = document.getElementById('modalROI');
  if (roiEl) { roiEl.textContent = row.roi.toFixed(2) + '%'; roiEl.style.color = row.roi >= 0 ? '#27ae60' : '#e74c3c'; }

  var cagrEl = document.getElementById('modalStCAGR');
  if (cagrEl) { cagrEl.textContent = row.studentCAGR.toFixed(2) + '%'; cagrEl.style.color = row.studentCAGR >= 0 ? '#27ae60' : '#e74c3c'; }

  var hasComp     = row.compPortfolio > 0;
  var compDivider = document.getElementById('modalCompDivider');
  var compRow     = document.getElementById('modalCompRow');
  var marginRow   = document.getElementById('modalMarginRow');
  if (compDivider) compDivider.style.display = hasComp ? '' : 'none';
  if (compRow)     compRow.style.display     = hasComp ? '' : 'none';
  if (marginRow)   marginRow.style.display   = hasComp ? '' : 'none';

  if (hasComp) {
    set('modalComputer', formatCurrency(row.compPortfolio));
    var compCagrEl = document.getElementById('modalCompCAGR');
    if (compCagrEl) { compCagrEl.textContent = row.compCAGR.toFixed(2) + '%'; compCagrEl.style.color = row.compCAGR >= 0 ? '#27ae60' : '#e74c3c'; }
    var marginEl = document.getElementById('modalMargin');
    if (marginEl) {
      marginEl.textContent = (row.margin >= 0 ? '+' : '') + formatCurrency(row.margin);
      marginEl.style.color = row.margin >= 0 ? '#27ae60' : '#e74c3c';
    }
  }

  set('modalHigh',  getAssetLabel(row.highestPerformer));
  set('modalLow',   getAssetLabel(row.lowestPerformer));
  set('modalClass', row.classPeriod);

  bootstrap.Modal.getOrCreateInstance(document.getElementById('playerModal')).show();
}


// ============================================================
//  Game Analytics View
// ============================================================
function renderGameView() {
  renderGlobalStats();
  renderGameLeaderboard();
  renderROIChart();
}

// ---- Global Stats ----
function renderGlobalStats() {
  // Win rate — 2026 only
  var cohort2026 = currentSeasonRecords();
  cohort2026 = cohort2026.filter(isScorable);
  var winRateEl = document.getElementById('gameStatWinRate');
  if (winRateEl) {
    if (cohort2026.length === 0) {
      winRateEl.textContent = 'N/A';
    } else {
      var winners = cohort2026.filter(function (r) { return r.beatMarketBool; }).length;
      winRateEl.innerHTML = '<span class="win-rate-pulse">' + ((winners / cohort2026.length) * 100).toFixed(1) + '%</span>';
    }
  }

  // Overall leaderboard: 2026 only, stacked centered layout
  var data2026  = currentSeasonRecords();
  data2026 = data2026.filter(isScorable);
  var sorted    = (dedupEnabled ? deduplicateRecords(data2026) : data2026.slice())
    .sort(function (a, b) { return b.numericValue - a.numericValue; });

  var overallEl = document.getElementById('gameStatOverall');
  if (overallEl) {
    if (sorted.length === 0) {
      overallEl.textContent = '--';
    } else {
      var medals = ['🥇', '🥈', '🥉'];
      var html   = '';
      sorted.slice(0, 3).forEach(function (r, i) {
        html += '<div class="overall-entry">'
              + '<div class="entry-name">' + medals[i] + ' ' + escHtml(r.fullName) + '</div>'
              + '<div class="entry-value">' + formatCurrency(r.numericValue) + '</div>'
              + '</div>';
      });
      overallEl.innerHTML = html;

      // Override the overall-list text-align for this centered layout
      overallEl.style.textAlign  = 'center';
      overallEl.style.width      = '100%';
    }
  }

  // Largest wealth gap — all time
  var gapEl = document.getElementById('gameStatGap');
  if (gapEl) {
    var maxGap = 0;
    var pm     = {};
    allData.filter(isScorable).forEach(function (r) {
      if (!pm[r.classPeriod]) pm[r.classPeriod] = [];
      pm[r.classPeriod].push(r.numericValue);
    });
    Object.values(pm).forEach(function (vals) {
      if (vals.length < 2) return;
      var gap = Math.max.apply(null, vals) - Math.min.apply(null, vals);
      if (gap > maxGap) maxGap = gap;
    });
    gapEl.textContent = maxGap > 0 ? formatCurrency(maxGap) : 'N/A';
  }
}

// ---- Game leaderboard: 2026 only ----
function renderGameLeaderboard() {
  var data2026 = currentSeasonRecords();

  var periodMap = {};
  data2026.filter(isScorable).forEach(function (r) {
    var key = r.classPeriod || 'Unknown';
    if (!periodMap[key]) periodMap[key] = [];
    periodMap[key].push(r);
  });

  var games = Object.keys(periodMap).map(function (period) {
    var players = periodMap[period];
    var avgROI  = players.reduce(function (s, r) { return s + r.roi; }, 0) / players.length;
    var winRate = (players.filter(function (r) { return r.beatMarketBool; }).length / players.length) * 100;
    var vals    = players.map(function (r) { return r.numericValue; });
    var gap     = vals.length > 1 ? Math.max.apply(null, vals) - Math.min.apply(null, vals) : 0;
    var dates   = players.map(function (r) { return new Date(r.timestamp); }).filter(function (d) { return !isNaN(d); });
    var dateStr = dates.length > 0
      ? new Date(Math.min.apply(null, dates)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—';
    return { period: period, players: players.length, avgROI: avgROI, winRate: winRate, gap: gap, dateStr: dateStr };
  });

  games.sort(function (a, b) { return b.avgROI - a.avgROI; });

  var tbody = document.getElementById('gameLeaderboardBody');
  if (!tbody) return;

  if (games.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:rgba(244,241,234,0.5);padding:30px;">No ' + (CURRENT_SEASON || '') + ' game data found.</td></tr>';
    return;
  }

  var html = '';
  games.forEach(function (g, idx) {
    var rank     = idx + 1;
    var medal    = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    var roiColor = g.avgROI  >= 0  ? '#2ecc71' : '#e74c3c';
    var winColor = g.winRate >= 50 ? '#2ecc71' : '#e74c3c';
    html += '<tr onclick="openGameModal(\'' + escHtml(g.period) + '\')">';
    html += '<td class="rank-col">' + medal + '</td>';
    html += '<td><strong>' + escHtml(g.period) + '</strong></td>';
    html += '<td><small>' + escHtml(g.dateStr) + '</small></td>';
    html += '<td>' + g.players + '</td>';
    html += '<td style="color:' + winColor + ';font-weight:700;">' + g.winRate.toFixed(1) + '%</td>';
    html += '<td style="color:' + roiColor + ';font-weight:700;">' + g.avgROI.toFixed(1) + '%</td>';
    html += '<td class="currency">' + formatCurrency(g.gap) + '</td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;
}


// ============================================================
//  ROI Distribution Chart
// ============================================================
function renderROIChart() {
  var canvas = document.getElementById('roiChart');
  var wrap   = document.getElementById('roiChartWrap');
  if (!canvas || !wrap) return;

  var counts = ROI_BRACKETS.map(function () { return 0; });
  var valid  = 0;

  allData.filter(isScorable).forEach(function (r) {
    if (r.totalInvestedNumeric <= 0) return;
    valid++;
    for (var i = 0; i < ROI_BRACKETS.length; i++) {
      if (r.roi >= ROI_BRACKETS[i].min && r.roi < ROI_BRACKETS[i].max) { counts[i]++; break; }
    }
  });

  if (valid === 0) {
    wrap.innerHTML = '<div class="chart-empty">Not enough data to display this chart.</div>';
    return;
  }

  if (roiChartInstance) { roiChartInstance.destroy(); roiChartInstance = null; }

  roiChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ROI_BRACKETS.map(function (b) { return b.label; }),
      datasets: [{
        label: 'Students',
        data: counts,
        backgroundColor: ['#e74c3c','#e8a838','#ebd186','#9ab0a6','#d4af37'],
        borderColor:     ['#c0392b','#c47d10','#cbb36b','#7d9389','#a88a2c'],
        borderWidth: 2, borderRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (ctx) {
          var pct = valid > 0 ? ((ctx.parsed.y / valid) * 100).toFixed(1) : '0';
          return ctx.parsed.y + ' students (' + pct + '%)';
        }}}
      },
      scales: {
        x: { ticks: { color: '#f4f1ea', font: { family: 'Montserrat', weight: '600' } }, grid: { color: 'rgba(212,175,55,0.15)' } },
        y: { beginAtZero: true,
          ticks: { color: '#f4f1ea', font: { family: 'Montserrat' }, stepSize: 1, callback: function (v) { return Number.isInteger(v) ? v : ''; } },
          grid: { color: 'rgba(212,175,55,0.15)' } }
      }
    }
  });
}


// ============================================================
//  Game Modal
// ============================================================
function openGameModal(period) {
  var players = allData.filter(function (r) { return r.classPeriod === period; });
  players.sort(function (a, b) { return b.numericValue - a.numericValue; });

  var titleEl = document.getElementById('listModalTitle');
  if (titleEl) titleEl.textContent = period + ' — Roster';

  var tbody = document.getElementById('listModalBody');
  if (!tbody) return;

  if (players.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center list-player-text" style="padding:20px;">No players found.</td></tr>';
  } else {
    var html = '';
    players.forEach(function (r) {
      var star = r.beatMarketBool ? ' ⭐' : '';
      html += '<tr>';
      html += '<td class="list-player-text"><strong>' + escHtml(r.fullName) + '</strong>' + star + flagMarker(r) + '</td>';
      html += '<td class="currency" style="text-shadow:none;color:var(--olive-dark)!important;">' + formatCurrency(r.numericValue) + '</td>';
      html += '<td><span class="badge ' + getAssetBadgeClass(r.highestPerformer) + '">' + escHtml(getAssetLabel(r.highestPerformer)) + '</span></td>';
      html += '</tr>';
    });
    tbody.innerHTML = html;
  }
  bootstrap.Modal.getOrCreateInstance(document.getElementById('listModal')).show();
}


// ============================================================
//  Team View
// ============================================================
function renderTeamView() {
  var gameFilterEl = document.getElementById('gameFilter');
  var tbody        = document.getElementById('teamLeaderboardBody');

  if (!gameFilterEl) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="color:rgba(244,241,234,0.5);padding:30px;">No team data found.</td></tr>';
    return;
  }

  var selectedGame = gameFilterEl.value;
  if (selectedGame === SEASON_SENTINEL) { renderBestOfSeasonTeams(); return; }

  if (!selectedGame || uniqueGamesGlobal.length === 0) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="color:rgba(244,241,234,0.5);padding:30px;">No team data found.</td></tr>';
    return;
  }

  var parts       = selectedGame.split(' | ');
  var gameDateStr = parts[0] ? parts[0].trim() : '';
  var gamePeriod  = parts[1] ? parts[1].trim() : '';

  var gamePlayers = allData.filter(function (r) {
    if (r.classPeriod !== gamePeriod) return false;
    var d = new Date(r.timestamp);
    if (isNaN(d)) return false;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) === gameDateStr;
  });

  renderTeamTable(gamePlayers, gamePeriod, gameDateStr);
}

function renderBestOfSeasonTeams() {
  var tbody = document.getElementById('teamLeaderboardBody');
  var seasonPlayers = currentSeasonRecords().filter(function (r) {
    return r.teamMatchKey !== 'none' && isScorable(r);
  });

  var teamMap = {};
  seasonPlayers.forEach(function (r) {
    if (!teamMap[r.teamMatchKey]) teamMap[r.teamMatchKey] = { displayName: r.teamName.trim(), members: {} };
    var key = r.fullName.trim().toLowerCase();
    if (!teamMap[r.teamMatchKey].members[key] || r.numericValue > teamMap[r.teamMatchKey].members[key].numericValue) {
      teamMap[r.teamMatchKey].members[key] = r;
    }
  });

  var teams = Object.values(teamMap).map(function (t) {
    var memberList = Object.values(t.members);
    var total      = memberList.reduce(function (s, r) { return s + r.numericValue; }, 0);
    var average    = memberList.length > 0 ? total / memberList.length : 0;
    return { displayName: t.displayName, members: memberList, average: average };
  });

  teams.sort(function (a, b) { return b.average - a.average; });

  if (!tbody) return;

  if (teams.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="color:rgba(244,241,234,0.5);padding:30px;">No team data found for the ' + (CURRENT_SEASON || '') + ' season.</td></tr>';
    return;
  }

  var html = '';
  teams.forEach(function (team, idx) {
    var rank        = idx + 1;
    var medal       = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    var memberNames = team.members
      .slice().sort(function (a, b) { return b.numericValue - a.numericValue; })
      .map(function (r) { return escHtml(r.fullName); }).join(', ');

    html += '<tr onclick="openBestOfSeasonTeamModal(\'' + escHtml(team.displayName) + '\')">';
    html += '<td class="rank-col">' + medal + '</td>';
    html += '<td><strong>' + escHtml(team.displayName) + '</strong></td>';
    html += '<td><small style="line-height:1.8;">' + memberNames + '</small></td>';
    html += '<td><span class="currency">' + formatCurrency(team.average) + '</span></td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

function renderTeamTable(gamePlayers, gamePeriod, gameDateStr) {
  var teamMap = {};
  gamePlayers.filter(isScorable).forEach(function (r) {
    if (r.teamMatchKey === 'none') return;
    if (!teamMap[r.teamMatchKey]) teamMap[r.teamMatchKey] = { displayName: r.teamName.trim(), members: [] };
    teamMap[r.teamMatchKey].members.push(r);
  });

  var teams = Object.values(teamMap).map(function (t) {
    var total   = t.members.reduce(function (s, r) { return s + r.numericValue; }, 0);
    var average = t.members.length > 0 ? total / t.members.length : 0;
    return { displayName: t.displayName, members: t.members, average: average };
  });

  teams.sort(function (a, b) { return b.average - a.average; });

  var tbody = document.getElementById('teamLeaderboardBody');
  if (!tbody) return;

  if (teams.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="color:rgba(244,241,234,0.5);padding:30px;">No teams found for this game.</td></tr>';
    return;
  }

  var html = '';
  teams.forEach(function (team, idx) {
    var rank        = idx + 1;
    var medal       = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    var memberNames = team.members
      .slice().sort(function (a, b) { return b.numericValue - a.numericValue; })
      .map(function (r) { return escHtml(r.fullName); }).join(', ');

    html += '<tr onclick="openTeamModal(\'' + escHtml(team.displayName) + '\',\'' + escHtml(gamePeriod) + '\',\'' + escHtml(gameDateStr) + '\')">';
    html += '<td class="rank-col">' + medal + '</td>';
    html += '<td><strong>' + escHtml(team.displayName) + '</strong></td>';
    html += '<td><small style="line-height:1.8;">' + memberNames + '</small></td>';
    html += '<td><span class="currency">' + formatCurrency(team.average) + '</span></td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;
}


// ============================================================
//  Team Modals
// ============================================================
function openTeamModal(teamName, period, gameDateStr) {
  var teamKey = teamName.trim().toLowerCase();
  var members = allData.filter(function (r) {
    if (r.teamMatchKey !== teamKey || r.classPeriod !== period) return false;
    var d = new Date(r.timestamp);
    if (isNaN(d)) return false;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) === gameDateStr;
  });
  members.sort(function (a, b) { return b.numericValue - a.numericValue; });
  renderTeamModalBody(teamName, members);
}

function openBestOfSeasonTeamModal(teamName) {
  var teamKey = teamName.trim().toLowerCase();
  var raw = currentSeasonRecords().filter(function (r) {
    return r.teamMatchKey === teamKey;
  });
  var best = {};
  raw.forEach(function (r) {
    var key = r.fullName.trim().toLowerCase();
    if (!best[key] || r.numericValue > best[key].numericValue) best[key] = r;
  });
  var members = Object.values(best).sort(function (a, b) { return b.numericValue - a.numericValue; });
  renderTeamModalBody(teamName, members);
}

function renderTeamModalBody(teamName, members) {
  var titleEl = document.getElementById('teamModalTitle');
  if (titleEl) titleEl.textContent = toTitleCase(teamName) + ' — Team Roster';

  var tbody = document.getElementById('teamModalBody');
  if (!tbody) return;

  if (members.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center list-player-text" style="padding:20px;">No members found.</td></tr>';
  } else {
    var html = '';
    members.forEach(function (r) {
      var star = r.beatMarketBool ? ' ⭐' : '';
      html += '<tr>';
      html += '<td class="list-player-text"><strong>' + escHtml(r.fullName) + '</strong>' + star + '</td>';
      html += '<td class="currency" style="text-shadow:none;color:var(--olive-dark)!important;">' + formatCurrency(r.numericValue) + '</td>';
      html += '<td><span class="badge ' + getAssetBadgeClass(r.highestPerformer) + '">' + escHtml(getAssetLabel(r.highestPerformer)) + '</span></td>';
      html += '</tr>';
    });
    tbody.innerHTML = html;
  }
  bootstrap.Modal.getOrCreateInstance(document.getElementById('teamModal')).show();
}

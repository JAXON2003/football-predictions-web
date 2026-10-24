import { validateFeed, validatePerformance, percent } from './domain.mjs';
export const storageKey = 'matchday:preferences:v1';
export function preferences() {
  try {
    const p = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return { saved: Array.isArray(p.saved) ? p.saved.filter(v => typeof v === 'string').slice(0, 500) : [], picks: p.picks && typeof p.picks === 'object' && !Array.isArray(p.picks) ? p.picks : {} };
  } catch { return { saved: [], picks: {} }; }
}
export function savePreferences(p) {
  try { localStorage.setItem(storageKey, JSON.stringify(p)); return true; }
  catch { const n = document.querySelector('#storage-notice'); if (n) { n.hidden = false; n.textContent = 'Browser storage is unavailable. Your choices work for this visit but cannot be saved.'; } return false; }
}
export function updateShell(feed) {
  const p = preferences();
  const ids = new Set(feed?.forecasts.map(r => r.fixture_id) || []);
  const counts = { matches: feed?.forecasts.length, saved: p.saved.filter(id => ids.has(id)).length, picks: Object.keys(p.picks).filter(id => ids.has(id)).length };
  document.querySelectorAll('[data-count]').forEach(el => { el.textContent = counts[el.dataset.count] || ''; });
  if (!feed) return;
  try {
    const report = validatePerformance(feed.performance);
    document.querySelector('#pulse-rate').textContent = report.metrics ? percent(report.metrics.accuracy) : '—';
    document.querySelector('#pulse-note').textContent = report.scored_matches ? `${report.scored_matches} eligible completed matches. Double chance: ${percent(report.metrics.selected_double_chance_success)}. Small samples fluctuate.` : 'Awaiting eligible completed matches. No hit rate claimed yet.';
    document.querySelector('#pulse-meter').style.width = `${(report.metrics?.accuracy || 0) * 100}%`;
  } catch {
    document.querySelector('#pulse-rate').textContent = '—';
    document.querySelector('#pulse-meter').style.width = '0%';
    document.querySelector('#pulse-note').textContent = 'Performance report unavailable.';
  }
  document.querySelector('#sidebar-updated').textContent = `Data observed ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(feed.data_observed_at_utc))} UTC`;
}
// Forecast pages pass their already validated feed; other pages load only the public file.
if (!document.querySelector('#forecast-grid')) {
  fetch('./data/predictions.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('Unavailable'); return r.json(); }).then(data => updateShell(validateFeed(data))).catch(() => { document.querySelector('#pulse-note').textContent = 'Verified feed unavailable.'; });
}

// Native select fallback remains available without JavaScript or Popover support.
function enhanceSelect(select) {
  if (!('showPopover' in HTMLElement.prototype) || select.dataset.enhanced) return;
  select.dataset.enhanced = 'true';
  const label = select.getAttribute('aria-label') || select.labels?.[0]?.childNodes[0]?.textContent.trim() || 'Choose an option';
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'select-trigger';
  trigger.dataset.selectFor = select.id;
  trigger.setAttribute('aria-haspopup','listbox'); trigger.setAttribute('aria-expanded','false');
  const menu = document.createElement('div');
  menu.id = `${select.id}-menu`; menu.className = 'select-menu'; menu.popover = 'auto';
  menu.setAttribute('role','listbox'); menu.setAttribute('aria-label',label);
  trigger.setAttribute('aria-controls',menu.id);
  select.insertAdjacentElement('afterend',trigger); trigger.insertAdjacentElement('afterend',menu);
  select.classList.add('enhanced-select'); select.tabIndex = -1; select.setAttribute('aria-hidden','true');
  let typeahead = '', lastKey = 0;
  const choices = () => [...menu.querySelectorAll('[role="option"]:not([disabled])')];
  const focusChoice = item => {
    if (!item) return;
    item.focus({preventScroll:true});
    if (item.offsetTop < menu.scrollTop) menu.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = item.offsetTop + item.offsetHeight - menu.clientHeight;
  };
  const sync = () => {
    trigger.replaceChildren();
    const value = document.createElement('span'); value.textContent = select.selectedOptions[0]?.textContent || 'Choose';
    const arrow = document.createElement('span'); arrow.textContent = '⌄'; arrow.setAttribute('aria-hidden','true');
    trigger.append(value,arrow); trigger.setAttribute('aria-label',`${label}: ${value.textContent}`); trigger.disabled = select.disabled;
    menu.replaceChildren();
    for (const option of select.options) {
      const item = document.createElement('button'); item.type = 'button'; item.tabIndex = -1;
      item.setAttribute('role','option'); item.setAttribute('aria-selected',String(option.selected)); item.disabled = option.disabled;
      item.dataset.value = option.value; item.textContent = option.textContent;
      item.addEventListener('click', () => { select.value = option.value; select.dispatchEvent(new Event('change',{bubbles:true})); menu.hidePopover(); trigger.focus({preventScroll:true}); });
      menu.append(item);
    }
  };
  const position = () => {
    const rect = trigger.getBoundingClientRect(), width = Math.min(Math.max(rect.width,220),innerWidth-24);
    menu.style.width = `${width}px`;
    menu.style.left = `${Math.max(12,Math.min(rect.left,innerWidth-width-12))}px`;
    const height = Math.min(menu.scrollHeight,Math.min(320,innerHeight*.45));
    menu.style.top = `${rect.bottom+height+10>innerHeight ? Math.max(12,rect.top-height-6) : rect.bottom+6}px`;
  };
  const open = last => {
    sync(); menu.showPopover(); position();
    const items = choices(); focusChoice(last ? items.at(-1) : items.find(el => el.getAttribute('aria-selected') === 'true') || items[0]);
  };
  trigger.addEventListener('click', () => { if (menu.matches(':popover-open')) menu.hidePopover(); else open(false); });
  trigger.addEventListener('keydown', event => {
    if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) { event.preventDefault(); open(event.key === 'End'); }
  });
  menu.addEventListener('toggle', () => trigger.setAttribute('aria-expanded',String(menu.matches(':popover-open'))));
  menu.addEventListener('keydown', event => {
    const items = choices(), current = items.indexOf(document.activeElement);
    if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length-1 : (current+(event.key === 'ArrowDown' ? 1 : -1)+items.length)%items.length; focusChoice(items[next]);
    } else if (event.key === 'Escape') { event.preventDefault(); menu.hidePopover(); trigger.focus({preventScroll:true}); }
    else if (event.key === 'Tab') { menu.hidePopover(); trigger.focus({preventScroll:true}); }
    else if (event.key.length === 1 && /\S/.test(event.key)) {
      if (event.key === ' ') return;
      const now = Date.now(); typeahead = now-lastKey>700 ? event.key : typeahead+event.key; lastKey = now;
      focusChoice(items.find(item => item.textContent.toLocaleLowerCase().startsWith(typeahead.toLocaleLowerCase())));
    }
  });
  select.addEventListener('change',sync);
  new MutationObserver(sync).observe(select,{childList:true,subtree:true});
  document.addEventListener('controlsupdated',sync);
  window.addEventListener('resize',() => { if (menu.matches(':popover-open')) position(); });
  // Re-anchor while the page scrolls; focus/scroll must not immediately close
  // a menu opened on a control further down the performance page.
  window.addEventListener('scroll',event => {
    if (!menu.matches(':popover-open') || menu.contains(event.target)) return;
    const rect = trigger.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) menu.hidePopover();
    else position();
  },true);
  sync();
}
document.querySelectorAll('select[id]').forEach(enhanceSelect);

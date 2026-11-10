// Daily update tool: edits a copy of CITY_DATA and downloads it as a new data.js.
const $ = s => document.querySelector(s);
const DRAFT_KEY = 'city-admin-draft';
let data = JSON.parse(JSON.stringify(window.CITY_DATA));
let changes = 0;

const USERNAME = /^[a-z0-9._]{1,30}$/;   // Instagram usernames are always lowercase
const clean = s => s.trim().replace(/^@/, '');
const find = name => data.citizens.find(c => c.name === name);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// "@shop", "shop.handle", "shop.com" or "https://shop.com" -> a safe https link (or '' if it isn't one)
function toLink(raw) {
  const s = (raw || '').trim();
  if (!s) return '';
  if (/^@?[a-z0-9._]{1,30}$/i.test(s) && !/\.(com|in|co|net|org|io|shop|store|app)$/i.test(s)) return 'https://www.instagram.com/' + s.replace(/^@/, '').toLowerCase() + '/';
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : '';
  } catch { return ''; }
}

function refresh() {
  $('#name').textContent = CITY_CONFIG.name;
  $('#s-day').textContent = data.day;
  $('#s-cit').textContent = data.citizens.length.toLocaleString();
  $('#s-work').textContent = data.citizens.filter(c => c.job).length.toLocaleString();
  $('#day').value = data.day;
  $('#names').innerHTML = data.citizens.slice(-2000).map(c => `<option value="${c.name}">`).join('');
  $('#changes').innerHTML = changes ? `<b>${changes} change${changes === 1 ? '' : 's'}</b> not saved yet. Download data.js when you're done.` : 'No changes yet.';
}
function changed(n = 1) {
  changes += n;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ data, changes, at: Date.now() })); } catch {}
  refresh();
}
function say(id, lines) { $(id).innerHTML = lines.join('\n'); }

// unsaved work from an earlier visit
try {
  const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  if (d && d.changes) {
    $('#draft').hidden = false;
    $('#draft-info').textContent = `${d.changes} change(s) from ${new Date(d.at).toLocaleString()}, Day ${d.data.day}, ${d.data.citizens.length} citizens.`;
    $('#draft-yes').onclick = () => { data = d.data; changes = d.changes; $('#draft').hidden = true; refresh(); };
    $('#draft-no').onclick = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} $('#draft').hidden = true; };
  }
} catch {}

$('#next-day').onclick = () => { data.day += 1; changed(); };
$('#day').onchange = e => { const v = parseInt(e.target.value, 10); if (v > 0) { data.day = v; changed(); } };

$('#add-followers').onclick = () => {
  const added = [], skipped = [];
  for (const raw of $('#followers').value.split(/\r?\n/)) {
    const name = clean(raw);
    if (!USERNAME.test(name) || ['follow', 'following', 'remove', 'message', 'followers'].includes(name)) continue;
    if (find(name) || added.includes(name)) { skipped.push(name); continue; }
    data.citizens.push({ name, job: '', joined: data.day, comments: 0 });
    added.push(name);
  }
  say('#out-followers', [`🏠 ${added.length} new home${added.length === 1 ? '' : 's'} built.`, ...(skipped.length ? [`<span class="warn">Already in the city: ${skipped.length}</span>`] : [])]);
  if (added.length) { $('#followers').value = ''; changed(added.length); }
};

$('#apply-comments').onclick = () => {
  const out = [], warn = [];
  let n = 0;
  for (const raw of $('#comments').value.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const m = raw.match(/^\s*@?([A-Za-z0-9._]{1,30})\s*(?:[:\-–]\s*(.+))?$/);
    if (!m) { warn.push(`Couldn't read: "${raw.trim()}" (use username: job)`); continue; }
    const name = m[1].toLowerCase();
    // username: job | Business name | @handle or website
    const [jobPart = '', bizPart = '', linkPart = ''] = (m[2] || '').split('|').map(x => x.trim());
    let job = jobPart.slice(0, 40);
    let c = find(name);
    if (!c) { c = { name, job: '', joined: data.day, comments: 0 }; data.citizens.push(c); out.push(`🏠 @${name} wasn't in the city yet, so they got a home too.`); }
    c.comments = (c.comments || 0) + 1;
    if (job) {
      const rare = RARE_JOBS.find(r => r === job.toLowerCase());
      if (rare) {
        const holder = data.citizens.find(x => x !== c && (x.job || '').toLowerCase() === rare);
        if (holder) { warn.push(`👑 ${job} is taken by @${holder.name}, so @${name} became Apprentice ${rare}.`); job = 'Apprentice ' + rare; }
      }
      job = job[0].toUpperCase() + job.slice(1);
      const t = jobType(job);
      out.push(`${t.emoji} @${name} now works as: ${job} (${t.label})`);
      c.job = job;
    } else if (!bizPart) out.push(`💬 @${name} +1 comment (${c.comments} total)`);
    if (bizPart) {
      c.business = bizPart.slice(0, 40);
      const link = toLink(linkPart);
      if (link) c.link = link; else delete c.link;
      if (linkPart && !link) warn.push(`🔗 Couldn't use "${linkPart}" as a link for @${name}. Shop sign added without a link.`);
      out.push(`🏪 @${name} put up a shop sign: ${c.business}${link ? ' → ' + link : ''}`);
    }
    n++;
  }
  say('#out-comments', [...out.map(esc), ...warn.map(w => `<span class="warn">${esc(w)}</span>`)]);
  if (n) { $('#comments').value = ''; changed(n); }
};

$('#set-hl').onclick = () => {
  const c = find(clean($('#hl-name').value).toLowerCase());
  if (!c) return say('#out-hl', ['<span class="warn">No citizen with that name.</span>']);
  if (!c.job) return say('#out-hl', ['<span class="warn">That citizen has no job yet.</span>']);
  data.highlight = { name: c.name, job: c.job, note: $('#hl-note').value.trim() };
  say('#out-hl', [`🏆 @${c.name} (${c.job}) is the weird job of the day.`]);
  changed();
};

$('#add-event').onclick = () => {
  const text = $('#event').value.trim();
  if (!text) return;
  (data.events ||= []).unshift({ day: data.day, text });
  $('#event').value = '';
  say('#out-event', [`📰 Added to Day ${data.day}.`]);
  changed();
};

$('#feature').onclick = () => {
  const c = find(clean($('#biz').value).toLowerCase());
  if (!c || !c.business) return say('#out-biz', ['<span class="warn">No citizen with a business by that name.</span>']);
  c.featured = !c.featured;
  if (!c.featured) delete c.featured;
  say('#out-biz', [esc(c.featured ? `⭐ ${c.business} is now featured.` : `${c.business} is no longer featured.`)]);
  changed();
};
$('#unbiz').onclick = () => {
  const c = find(clean($('#biz').value).toLowerCase());
  if (!c || !c.business) return say('#out-biz', ['<span class="warn">No citizen with a business by that name.</span>']);
  const was = c.business;
  delete c.business; delete c.link; delete c.featured;
  say('#out-biz', [esc(`🗑️ Removed the shop sign for ${was}.`)]);
  changed();
};

$('#do-remove').onclick = () => {
  const name = clean($('#remove').value).toLowerCase();
  const i = data.citizens.findIndex(c => c.name === name);
  if (i < 0) return say('#out-remove', ['<span class="warn">No citizen with that name.</span>']);
  data.citizens.splice(i, 1);
  if (data.highlight && data.highlight.name === name) data.highlight = null;
  $('#remove').value = '';
  say('#out-remove', [`🗑️ @${name} was removed.`]);
  changed();
};

$('#reset').onclick = () => {
  if (!confirm('Start a brand-new empty city at Day 1? This clears all citizens in this page (your old data.js file stays until you replace it).')) return;
  data = { day: 1, highlight: null, events: [{ day: 1, text: 'The city was founded. Follow to get your home.' }], citizens: [] };
  changed();
};

$('#download').onclick = () => {
  const text = '// This file holds the whole city. Update it with admin.html, then replace this file.\nwindow.CITY_DATA = ' + JSON.stringify(data, null, 1) + ';\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
  a.download = 'data.js';
  a.click();
  changes = 0;
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
  refresh();
};

refresh();

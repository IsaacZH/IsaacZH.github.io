import http from "node:http";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const galleryRoot = path.join(root, 'src', '.vuepress', 'public', 'images', 'gallery');
const seedPath = path.join(root, 'src', '.vuepress', 'data', 'gallery-seed.ts');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const IMG_MIME = { '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.gif':'image/gif', '.avif':'image/avif' };

function toTitleCase(raw) {
  return raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
}
function normalizeText(v) {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function walk(dir, acc = []) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, acc);
    else if (IMAGE_EXT.has(path.extname(e.name).toLowerCase())) acc.push(full);
  }
  return acc;
}

async function getPhotos() {
  const images = await walk(galleryRoot);
  images.sort((a, b) => a.localeCompare(b));
  const photos = [];
  for (const imgPath of images) {
    const ext = path.extname(imgPath);
    const base = path.basename(imgPath, ext);
    const dir = path.dirname(imgPath);
    const relPath = path.relative(galleryRoot, imgPath).split(path.sep).join('/');
    let meta = null, hasMeta = false;
    for (const mExt of ['.meta.json', '.json']) {
      try { meta = JSON.parse(await fs.readFile(path.join(dir, base + mExt), 'utf8')); hasMeta = true; break; } catch {}
    }
    if (!meta) {
      const stat = await fs.stat(imgPath);
      meta = {
        requiredMeta: { year: new Date(stat.mtimeMs).getFullYear(), medium: 'digital' },
        alt: toTitleCase(base),
        createdAt: new Date(stat.mtimeMs).toISOString().slice(0, 10),
        tags: [relPath.split('/')[0]?.toLowerCase() || 'general'],
        description: '', facets: {}, featured: false, disabled: false
      };
    }
    photos.push({ id: 'local-' + normalizeText(relPath.replace(path.extname(relPath), '')), relPath, hasMeta, meta });
  }
  return photos;
}

async function savePhoto(relPath, meta) {
  const ext = path.extname(relPath);
  const base = path.basename(relPath, ext);
  const dir = path.dirname(path.join(galleryRoot, relPath));
  await fs.writeFile(path.join(dir, base + '.meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
}

// ©¤©¤ Seed (URL-based) image management ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

async function parseSeedFile() {
  let raw;
  try { raw = await fs.readFile(seedPath, 'utf8'); } catch { return { raw: '', start: -1, end: -1, items: [] }; }
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start < 0 || end < 0) return { raw, start, end, items: [] };
  try {
    const items = new Function('return ' + raw.slice(start, end + 1))();
    return { raw, start, end, items };
  } catch (e) {
    console.error('Failed to parse gallery-seed.ts:', e);
    return { raw, start, end, items: [] };
  }
}

function generateSeedArray(items) {
  return '[\n' + items.map(item => {
    const req = item.requiredMeta || {};
    let body = [
      `    id: ${JSON.stringify(item.id)}`,
      `    slug: ${JSON.stringify(item.slug || '')}`,
      `    src: ${JSON.stringify(item.src)}`,
      `    alt: ${JSON.stringify(item.alt || '')}`,
      `    requiredMeta: { year: ${req.year || new Date().getFullYear()}, medium: ${JSON.stringify(req.medium || 'digital')} }`,
      `    tags: ${JSON.stringify(item.tags || [])}`,
      `    createdAt: ${JSON.stringify(item.createdAt || '')}`,
      `    width: ${item.width || 1600}`,
      `    height: ${item.height || 1067}`,
    ].join(',\n');
    if (item.description) body += `,\n    description: ${JSON.stringify(item.description)}`;
    if (item.facets && Object.keys(item.facets).length) body += `,\n    facets: ${JSON.stringify(item.facets)}`;
    if (item.featured) body += ',\n    featured: true';
    if (item.disabled) body += ',\n    disabled: true';
    return '  {\n' + body + ',\n  }';
  }).join(',\n') + '\n]';
}

async function getSeeds() {
  const { items } = await parseSeedFile();
  return items.map(item => ({
    id: item.id,
    relPath: item.id,
    src: item.src,
    isSeed: true,
    hasMeta: true,
    meta: {
      alt: item.alt || '',
      createdAt: item.createdAt || '',
      requiredMeta: item.requiredMeta || { year: new Date().getFullYear(), medium: 'digital' },
      tags: Array.isArray(item.tags) ? item.tags : [],
      description: item.description || '',
      facets: item.facets || {},
      featured: !!item.featured,
      disabled: !!item.disabled,
      slug: item.slug || '',
      width: item.width,
      height: item.height,
    }
  }));
}

async function saveSeedItem(id, updates) {
  const { raw, start, end, items } = await parseSeedFile();
  const idx = items.findIndex(item => item.id === id);
  if (idx < 0) throw new Error('Seed item not found: ' + id);
  const existing = items[idx];
  const req = updates.requiredMeta || {};
  items[idx] = {
    id: existing.id,
    slug: updates.slug || existing.slug || '',
    src: updates.src || existing.src,
    alt: updates.alt || existing.alt || '',
    requiredMeta: {
      year: req.year || existing.requiredMeta?.year || new Date().getFullYear(),
      medium: req.medium || existing.requiredMeta?.medium || 'digital',
    },
    tags: updates.tags || existing.tags || [],
    createdAt: updates.createdAt || existing.createdAt || '',
    width: updates.width || existing.width || 1600,
    height: updates.height || existing.height || 1067,
    ...(updates.description ? { description: updates.description } : {}),
    ...(updates.facets && Object.keys(updates.facets).length ? { facets: updates.facets } : {}),
    ...(updates.featured ? { featured: true } : {}),
    ...(updates.disabled ? { disabled: true } : {}),
  };
  const newRaw = raw.slice(0, start) + generateSeedArray(items) + raw.slice(end + 1);
  await fs.writeFile(seedPath, newRaw, 'utf8');
}

async function addSeedItem(src, alt) {
  const { raw, start, end, items } = await parseSeedFile();
  let base;
  try { base = path.basename(new URL(src).pathname, path.extname(new URL(src).pathname)); } catch { base = 'photo'; }
  const id = 'seed-' + normalizeText(base) + '-' + Date.now().toString(36);
  const item = {
    id, slug: normalizeText(base), src,
    alt: alt || toTitleCase(base),
    requiredMeta: { year: new Date().getFullYear(), medium: 'digital' },
    tags: [], createdAt: new Date().toISOString().slice(0, 10),
    width: 1600, height: 1067,
  };
  items.push(item);
  const newRaw = raw.slice(0, start) + generateSeedArray(items) + raw.slice(end + 1);
  await fs.writeFile(seedPath, newRaw, 'utf8');
  return id;
}

async function initAllMeta() {
  const images = await walk(galleryRoot);
  for (const imgPath of images) {
    const ext = path.extname(imgPath);
    const base = path.basename(imgPath, ext);
    const dir = path.dirname(imgPath);
    const metaPath = path.join(dir, base + '.meta.json');
    if (await fs.access(metaPath).then(() => true).catch(() => false)) continue;
    const relPath = path.relative(galleryRoot, imgPath);
    const stat = await fs.stat(imgPath);
    const meta = {
      requiredMeta: { year: new Date(stat.mtimeMs).getFullYear(), medium: 'digital' },
      alt: toTitleCase(base),
      createdAt: new Date(stat.mtimeMs).toISOString().slice(0, 10),
      tags: [relPath.split(path.sep)[0]?.toLowerCase() || 'general'],
      description: '', facets: {}, featured: false, disabled: false
    };
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  }
}

function runSync() {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['scripts/generate-gallery-data.mjs'], { cwd: root, shell: true });
    let out = '';
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => out += d);
    proc.on('close', code => code === 0 ? resolve(out) : reject(new Error(out)));
  });
}

async function readBody(req) {
  return new Promise((res, rej) => {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => res(b));
    req.on('error', rej);
  });
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gallery Admin</title>
<style>
:root{--bg:#111;--bg2:#1a1a1a;--bg3:#222;--bd:#2a2a2a;--tx:#e0e0e0;--mu:#777;--ac:#7c9bff;--ok:#4caf50;--warn:#ff9800}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--tx);display:flex;flex-direction:column;font-size:14px}
header{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--bd);flex-shrink:0}
header h1{font-size:15px;font-weight:600;margin-right:6px}
button{background:#2a2a2a;border:1px solid #3a3a3a;color:#ddd;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:13px}
button:hover{border-color:#4a4a4a}
.main{display:flex;flex:1;min-height:0}
#sidebar{width:300px;display:flex;flex-direction:column;border-right:1px solid var(--bd);min-height:0;flex-shrink:0}
#sw{padding:8px;border-bottom:1px solid var(--bd);display:flex;gap:6px}
#search{flex:1;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:6px;padding:7px 10px;outline:none;font-size:13px}
#search:focus{border-color:var(--ac)}
#grid{flex:1;overflow:auto;padding:8px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;align-content:start}
.card{position:relative;aspect-ratio:1;border:2px solid transparent;border-radius:6px;overflow:hidden;background:#1f1f1f;cursor:pointer}
.card:hover{border-color:#3d3d3d}
.card.sel{border-color:var(--ac)}
.card img{width:100%;height:100%;object-fit:cover;display:block}
.dot{position:absolute;top:4px;right:4px;width:8px;height:8px;border-radius:50%}
.dot.y{background:var(--ok)}
.dot.n{background:var(--warn)}
.url-badge{position:absolute;top:4px;left:4px;background:#5577cc;color:#fff;font-size:9px;font-weight:600;padding:1px 5px;border-radius:3px;pointer-events:none;letter-spacing:.04em}
.clabel{position:absolute;left:0;right:0;bottom:0;padding:2px 6px;font-size:10px;background:rgba(0,0,0,.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
#editor{flex:1;overflow:auto;padding:18px 22px}
.ph{color:var(--mu);margin-top:60px;text-align:center;font-size:15px}
.prev{margin-bottom:14px;text-align:center}
.prev img{max-width:100%;max-height:240px;border-radius:8px;background:var(--bg2);object-fit:contain}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.f{margin-bottom:10px}
.f label{display:block;color:#aaa;font-size:11px;letter-spacing:.04em;text-transform:uppercase;margin-bottom:4px}
input,textarea,select{width:100%;background:var(--bg3);border:1px solid var(--bd);color:var(--tx);border-radius:6px;padding:8px 10px;outline:none;font-size:13px}
textarea{min-height:80px;resize:vertical}
input:focus,textarea:focus,select:focus{border-color:var(--ac)}
.ck-row{display:flex;gap:14px;margin:10px 0}
.st{display:inline-block;min-height:18px;font-size:12px;color:var(--mu)}
.st.ok{color:var(--ok)}
.st.warn{color:var(--warn)}
</style>
</head>
<body>
<header>
  <h1>Gallery Admin</h1>
  <button onclick="initMeta()">Init Meta</button>
  <button onclick="doSync()">Sync</button>
  <button onclick="addUrlPhoto()" style="background:#1a2a4a;border-color:#3355aa;color:#aaccff">+ URL Photo</button>
  <span id="hs" class="st"></span>
  <span style="margin-left:auto" id="cnt">0 photos</span>
</header>
<div class="main">
  <aside id="sidebar">
    <div id="sw"><input id="search" placeholder="Search name / tag / url\u2026" autocomplete="off"></div>
    <div id="grid"></div>
  </aside>
  <main id="editor"><div class="ph">&larr; Select a photo to edit its metadata</div></main>
</div>
<script>
var all = [], filt = [], sel = null, dirty = false;

function byId(id){ return document.getElementById(id); }
function esc(v){ return String(v||'').replace(/[&<>"']/g,function(s){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]);}); }
function setStatus(id, text, cls){ var el=byId(id); if(!el)return; el.textContent=text||''; el.className='st'+(cls?' '+cls:''); }

async function load(){
  var r = await fetch('/api/photos');
  all = await r.json();
  filt = all.slice();
  renderGrid();
  byId('cnt').textContent = all.length + ' photos';
}

function imgSrcFor(p){
  return p.isSeed ? p.src : '/img?path='+encodeURIComponent(p.relPath);
}

function renderGrid(){
  byId('grid').innerHTML = filt.map(function(p){
    var s = sel && sel.relPath===p.relPath ? 'sel' : '';
    var d = p.hasMeta ? 'y' : 'n';
    var lbl = esc((p.meta&&p.meta.alt) || p.relPath);
    var badge = p.isSeed ? '<span class="url-badge">URL</span>' : '';
    return '<div class="card '+s+'" data-path="'+esc(p.relPath)+'">'+
      '<img src="'+imgSrcFor(p)+'" loading="lazy">'+
      badge+
      '<span class="dot '+d+'"></span>'+
      '<span class="clabel">'+lbl+'</span>'+
      '</div>';
  }).join('');
}

function filterGrid(q){
  var lq=(q||'').toLowerCase();
  filt = lq ? all.filter(function(p){
    var tags=((p.meta&&p.meta.tags)||[]).join(' ').toLowerCase();
    var alt=((p.meta&&p.meta.alt)||'').toLowerCase();
    var src=(p.src||'').toLowerCase();
    return p.relPath.toLowerCase().indexOf(lq)>=0||alt.indexOf(lq)>=0||tags.indexOf(lq)>=0||src.indexOf(lq)>=0;
  }) : all.slice();
  renderGrid();
}

function pick(relPath){
  if(!relPath) return;
  if(dirty && sel && !confirm('Discard unsaved changes?')) return;
  var next = all.find(function(p){ return p.relPath===relPath; });
  if(!next) return;
  sel = next;
  dirty = false;
  renderGrid();
  renderEditor();
}

function markDirty(){
  dirty = true;
  setStatus('ss','Unsaved','warn');
}

function renderEditor(){
  if(!sel){ byId('editor').innerHTML='<div class="ph">&larr; Select a photo to edit its metadata</div>'; return; }
  var m=sel.meta||{};
  var req=m.requiredMeta||{};
  var isSeed=!!sel.isSeed;
  var previewSrc=isSeed ? esc(sel.src||'') : '/img?path='+encodeURIComponent(sel.relPath);

  var html=
    '<div class="prev"><img src="'+previewSrc+'"></div>'+
    (isSeed
      ? '<div class="f"><label>Image URL</label><input id="src" type="url" value="'+esc(sel.src||'')+'"></div>'
      : '<div class="f"><label>Path</label><input type="text" value="'+esc(sel.relPath)+'" disabled></div>'
    )+
    '<div class="row">'+
      '<div class="f"><label>Alt text</label><input id="alt" type="text" value="'+esc(m.alt||'')+'"></div>'+
      '<div class="f"><label>Date</label><input id="createdAt" type="date" value="'+esc(m.createdAt||'')+'"></div>'+
    '</div>'+
    '<div class="row">'+
      '<div class="f"><label>Year</label><input id="year" type="number" value="'+esc(req.year||'')+'"></div>'+
      '<div class="f"><label>Medium</label><select id="medium">'+
        ['digital','film'].map(function(v){return '<option value="'+v+'"'+(((req.medium||'digital')===v)?' selected':'')+'>'+v+'</option>';}).join('')+
      '</select></div>'+
    '</div>'+
    (isSeed
      ? '<div class="row">'+
          '<div class="f"><label>Slug</label><input id="slug" type="text" value="'+esc(m.slug||'')+'"></div>'+
          '<div class="f" style="display:flex;gap:6px">'+
            '<div style="flex:1"><label style="display:block;color:#aaa;font-size:11px;text-transform:uppercase;margin-bottom:4px">Width</label><input id="width" type="number" value="'+esc(m.width||'')+'"></div>'+
            '<div style="flex:1"><label style="display:block;color:#aaa;font-size:11px;text-transform:uppercase;margin-bottom:4px">Height</label><input id="height" type="number" value="'+esc(m.height||'')+'"></div>'+
          '</div>'+
        '</div>'
      : ''
    )+
    '<div class="f"><label>Tags (comma separated)</label><input id="tags" type="text" value="'+esc(((m.tags||[]).join(', ')))+'"></div>'+
    '<div class="f"><label>Description</label><textarea id="desc">'+esc(m.description||'')+'</textarea></div>'+
    '<div class="ck-row">'+
      '<label><input id="featured" type="checkbox"'+(m.featured?' checked':'')+'>  Featured</label>'+
      '<label><input id="disabled_" type="checkbox"'+(m.disabled?' checked':'')+'>  Disabled</label>'+
    '</div>'+
    '<div style="display:flex;gap:10px;align-items:center;margin-top:8px">'+
      '<button onclick="saveMeta()">Save</button>'+
      '<span id="ss" class="st"></span>'+
    '</div>';

  byId('editor').innerHTML=html;

  var fields=['alt','createdAt','year','medium','tags','desc','featured','disabled_'];
  if(isSeed) fields=fields.concat(['src','slug','width','height']);
  fields.forEach(function(id){
    var el=byId(id); if(!el) return;
    el.addEventListener('input',markDirty);
    el.addEventListener('change',markDirty);
  });
}

async function saveMeta(){
  if(!sel) return;
  setStatus('ss','Saving\u2026','warn');
  var tags=byId('tags').value.split(',').map(function(t){return t.trim();}).filter(Boolean);
  var payload={
    requiredMeta:{year:Number(byId('year').value)||new Date().getFullYear(),medium:byId('medium').value||'digital'},
    alt:(byId('alt').value||'').trim(),
    createdAt:byId('createdAt').value,
    tags:tags,
    description:byId('desc').value,
    facets:(sel.meta&&sel.meta.facets)||{},
    featured:!!byId('featured').checked,
    disabled:!!byId('disabled_').checked
  };
  var r;
  if(sel.isSeed){
    payload.src=byId('src').value.trim();
    payload.slug=byId('slug').value.trim();
    payload.width=Number(byId('width').value)||undefined;
    payload.height=Number(byId('height').value)||undefined;
    r=await fetch('/api/seed?id='+encodeURIComponent(sel.id||sel.relPath),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  } else {
    r=await fetch('/api/photo?path='+encodeURIComponent(sel.relPath),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  }
  if(!r.ok){setStatus('ss','Save failed','warn');return;}
  if(sel.isSeed && payload.src) sel.src=payload.src;
  sel.meta=Object.assign({},sel.meta,payload,{slug:payload.slug,width:payload.width,height:payload.height});
  sel.hasMeta=true; dirty=false;
  var i=all.findIndex(function(p){return p.relPath===sel.relPath;});
  if(i>=0) all[i]=sel;
  setStatus('ss','Saved \u2714','ok');
  renderGrid();
}

async function addUrlPhoto(){
  var url=prompt('Image URL:');
  if(!url||!url.trim()) return;
  var alt=prompt('Alt text (optional):','')||'';
  setStatus('hs','Adding\u2026','warn');
  var r=await fetch('/api/seed/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({src:url.trim(),alt:alt.trim()})});
  if(!r.ok){setStatus('hs','Add failed','warn');return;}
  await load();
  setStatus('hs','Added \u2714','ok');
  setTimeout(function(){setStatus('hs','','');},2500);
}

async function initMeta(){
  setStatus('hs','Initializing\u2026','warn');
  await fetch('/api/init',{method:'POST'});
  await load();
  setStatus('hs','Done \u2714','ok');
  setTimeout(function(){setStatus('hs','','');},2500);
}

async function doSync(){
  setStatus('hs','Syncing\u2026','warn');
  await fetch('/api/sync',{method:'POST'});
  setStatus('hs','Synced \u2714','ok');
  setTimeout(function(){setStatus('hs','','');},2500);
}

byId('search').addEventListener('input', function(e){ filterGrid(e.target.value); });
byId('grid').addEventListener('click', function(e){
  var card = e.target.closest('[data-path]');
  if(card) pick(card.dataset.path);
});

load();
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      send(res, 200, 'text/html; charset=utf-8', HTML); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/photos') {
      const [locals, seeds] = await Promise.all([getPhotos(), getSeeds()]);
      send(res, 200, 'application/json', JSON.stringify([...locals, ...seeds])); return;
    }
    if (req.method === 'PUT' && url.pathname === '/api/photo') {
      const relPath = url.searchParams.get('path');
      if (!relPath) { send(res, 400, 'application/json', '{"error":"missing path"}'); return; }
      await savePhoto(relPath, JSON.parse(await readBody(req)));
      send(res, 200, 'application/json', '{"ok":true}'); return;
    }
    if (req.method === 'PUT' && url.pathname === '/api/seed') {
      const id = url.searchParams.get('id');
      if (!id) { send(res, 400, 'application/json', '{"error":"missing id"}'); return; }
      await saveSeedItem(id, JSON.parse(await readBody(req)));
      send(res, 200, 'application/json', '{"ok":true}'); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/seed/add') {
      const body = JSON.parse(await readBody(req));
      if (!body.src) { send(res, 400, 'application/json', '{"error":"missing src"}'); return; }
      const id = await addSeedItem(body.src, body.alt || '');
      send(res, 200, 'application/json', JSON.stringify({ ok: true, id })); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/init') {
      await initAllMeta(); send(res, 200, 'application/json', '{"ok":true}'); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/sync') {
      const out = await runSync(); send(res, 200, 'text/plain', out); return;
    }
    if (req.method === 'GET' && url.pathname === '/img') {
      const relPath = url.searchParams.get('path');
      if (!relPath) { res.writeHead(400); res.end(); return; }
      const abs = path.resolve(galleryRoot, relPath);
      if (!abs.startsWith(galleryRoot)) { res.writeHead(403); res.end(); return; }
      const ext = path.extname(abs).toLowerCase();
      try {
        const stat = await fs.stat(abs);
        res.writeHead(200, {
          'Content-Type': IMG_MIME[ext] || 'image/jpeg',
          'Content-Length': stat.size,
          'Cache-Control': 'max-age=60'
        });
        createReadStream(abs).pipe(res);
      } catch { res.writeHead(404); res.end(); }
      return;
    }
    res.writeHead(404); res.end();
  } catch (err) {
    console.error(err);
    send(res, 500, 'application/json', JSON.stringify({ error: String(err) }));
  }
});

server.listen(PORT, () => {
  console.log('\nGallery Admin  ¡ú  http://localhost:' + PORT);
  console.log('Ctrl+C to stop\n');
});

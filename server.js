// Samket sync server: node server.js  (no dependencies)
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
    const m = l.match(/^(\w+)=(.*)$/);
    m && (process.env[m[1]] ??= m[2].trim());
  });
} catch {}

const P = process.env.PORT || 3000;
const KEY = process.env.SYNC_KEY || 'samket';
const F = path.join(process.env.DATA_DIR || __dirname, 'data.json');
const W = path.join(__dirname, 'dist');
const H = (p, s) => crypto.scryptSync(p, s, 32).toString('hex');
const RL = {};
const rl = q => {
  const k = q.headers['x-forwarded-for'] || q.socket.remoteAddress;
  const n = Date.now();
  RL[k] = (RL[k] || []).filter(t => n - t < 6e4);
  RL[k].push(n);
  return RL[k].length > 20;
};

let S = { seq: 0, docs: {}, users: {} };
try { S = JSON.parse(fs.readFileSync(F)); } catch {}
S.users = S.users || {};

const save = () => fs.writeFileSync(F, JSON.stringify(S));
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const J = (r, c, o) => {
  r.writeHead(c, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' });
  r.end(JSON.stringify(o));
};
const docs = t => Object.values(S.docs).filter(d => d.type === t && !d.del);
const stock = id => docs('move').filter(m => m.item === id).reduce((a, m) => a + m.q, 0) + docs('unit').filter(u => u.itemId === id && u.status === 'in_stock').length;
const body = (q, f) => {
  let b = '';
  q.on('data', c => { b += c; if (b.length > 2e7) q.destroy(); })
   .on('end', () => { try { f(JSON.parse(b || '{}')); } catch { f({}); } });
};
const nx = p => 1 + Math.max(0, ...Object.values(S.docs).map(d => {
  const m = String(d.code || '').match(new RegExp('^' + p + '-(\\d+)$'));
  return m ? +m[1] : 0;
}));
const dg = v => String(v || '').replace(/\D/g, '');
const TGT = process.env.TG_BOT_TOKEN;
const TGS = process.env.TG_STAFF_CHAT;
S.tg = S.tg || {};
let off = 0;

const tg = (m, b) => TGT ? fetch(`https://api.telegram.org/bot${TGT}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json()).catch(() => 0) : Promise.resolve(0);

if (TGT) {
  setInterval(async () => {
    const j = await tg('getUpdates', { offset: off, timeout: 0 });
    for (const u of (j && j.result) || []) {
      off = u.update_id + 1;
      const m = u.message;
      const c = ((m && m.text || '').match(/^\/start\s+(\S+)/) || [])[1];
      if (c) {
        S.tg[c.toUpperCase()] = m.chat.id;
        save();
        tg('sendMessage', { chat_id: m.chat.id, text: 'Samket: you will get updates for ticket ' + c.toUpperCase() + ' here.' });
      }
    }
  }, 8000);
}

http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  if (q.method === 'OPTIONS') return J(r, 200, {});
  
  if (u.pathname === '/api/sync' && q.method === 'POST') {
    if (q.headers['x-key'] !== KEY) return J(r, 401, {});
    return body(q, ({ since = 0, docs: ds = [] }) => {
      for (const d of ds) {
        const e = S.docs[d.id];
        if (!e || d.ts > e.ts || (d.ts === e.ts && d.dev > e.dev)) S.docs[d.id] = { ...d, seq: ++S.seq };
      }
      save();
      J(r, 200, { seq: S.seq, docs: Object.values(S.docs).filter(d => d.seq > since) });
    });
  }
  
  if (u.pathname === '/api/cfg') return J(r, 200, { bot: process.env.TG_BOT_USERNAME || '' });
  
  if (u.pathname === '/api/notify' && q.method === 'POST') {
    if (q.headers['x-key'] !== KEY) return J(r, 401, {});
    return body(q, async x => {
      const id = S.tg[String(x.code || '').toUpperCase()];
      if (id) await tg('sendMessage', { chat_id: id, text: String(x.text || '').slice(0, 500) });
      J(r, 200, { sent: !!id });
    });
  }
  
  if (u.pathname === '/api/purchase' && q.method === 'POST') {
    if (rl(q)) return J(r, 429, {});
    return body(q, x => {
      const c = String(x.code || '').trim();
      const p = dg(x.phone);
      let s = docs('sale').find(y => y.code === c.toUpperCase());
      if (!s) {
        const n = docs('unit').find(y => y.serial === c);
        s = n && docs('sale').find(y => y.id === n.saleId);
      }
      if (!s || !p || dg(s.phone) !== p) return J(r, 404, {});
      J(r, 200, { code: s.code, date: s.date, name: s.name, phone: s.phone, lines: s.lines, total: s.total, disc: s.disc, pay: s.pay, void: s.void });
    });
  }
  
  if (u.pathname === '/api/claimreq' && q.method === 'POST') {
    if (rl(q)) return J(r, 429, {});
    return body(q, x => {
      const n = docs('unit').find(y => y.serial === String(x.serial || '').trim());
      const s = n && docs('sale').find(y => y.id === n.saleId);
      if (!s || dg(s.phone) !== dg(x.phone) || !n.until || n.until < new Date().toISOString().slice(0, 10)) return J(r, 400, {});
      const id = 'w' + Date.now().toString(36);
      const code = 'WC-WEB-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      S.docs[id] = { id, type: 'claim', code, serial: n.serial, itemId: n.itemId, saleId: n.saleId, issue: String(x.issue || '').slice(0, 300), status: 'Open', date: Date.now(), ts: Date.now(), dev: 'web', seq: ++S.seq };
      save();
      J(r, 200, { code });
    });
  }
  
  if (u.pathname === '/api/pub') return J(r, 200, docs('item').filter(i => i.pub).map(i => ({ id: i.id, name: i.name, cat: i.cat, price: i.price, war: i.war, img: i.img, stock: stock(i.id) })));
  
  if (u.pathname === '/api/track') {
    const t = docs('ticket').find(x => x.code === (u.searchParams.get('c') || '').toUpperCase());
    return t ? J(r, 200, { code: t.code, device: t.device, status: t.status, work: t.work, war: t.war, done: t.done }) : J(r, 404, {});
  }
  
  if (u.pathname === '/api/req' && q.method === 'POST') {
    if (rl(q)) return J(r, 429, {});
    return body(q, x => {
      const s = (v, n) => String(v || '').slice(0, n);
      const phone = s(x.phone, 30).replace(/\s/g, '');
      if (!s(x.name, 80) || !phone || !s(x.dtype, 20) || !s(x.issue, 400)) return J(r, 400, {});
      const id = 'w' + Date.now().toString(36);
      const code = 'R-' + nx('R');
      if (String(x.password || '').length >= 4 && !S.users[phone]) {
        const salt = crypto.randomBytes(8).toString('hex');
        S.users[phone] = { salt, hash: H(x.password, salt) };
      }
      S.docs[id] = { id, type: 'ticket', code, name: s(x.name, 80), phone, email: s(x.email, 80), dtype: s(x.dtype, 20), device: (s(x.dtype, 20) + ' ' + s(x.device, 80)).trim(), imei: s(x.imei, 40), issue: s(x.issue, 400), status: 'Requested', war: 0, cost: 0, date: Date.now(), done: null, ts: Date.now(), dev: 'web', seq: ++S.seq };
      save();
      if (TGS) tg('sendMessage', { chat_id: TGS, text: 'New repair request ' + code + ': ' + s(x.name, 80) + ' ' + phone + ' - ' + s(x.issue, 200) });
      J(r, 200, { code });
    });
  }
  
  if (u.pathname === '/api/my' && q.method === 'POST') {
    if (rl(q)) return J(r, 429, {});
    return body(q, x => {
      const p = String(x.phone || '').replace(/\s/g, '');
      const a = S.users[p];
      if (!a || H(String(x.password || ''), a.salt) !== a.hash) return J(r, 401, {});
      J(r, 200, docs('ticket').filter(t => String(t.phone || '').replace(/\s/g, '') === p).map(t => ({ code: t.code, device: t.device, status: t.status, work: t.work, done: t.done, war: t.war })));
    });
  }
  
  let p = path.normalize(u.pathname === '/' ? '/index.html' : u.pathname);
  let f = path.join(W, p);
  if (!f.startsWith(W)) f = path.join(W, 'index.html');
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    if (path.extname(p)) { r.writeHead(404); return r.end('Not found'); }
    f = path.join(W, 'index.html');
  }
  r.writeHead(200, { 'content-type': T[path.extname(f)] || 'text/plain' });
  fs.createReadStream(f).pipe(r);
}).listen(P, () => console.log('Samket running on http://localhost:' + P));
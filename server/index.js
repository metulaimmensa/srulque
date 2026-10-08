/* Srulque leaderboard — Yandex Cloud Function (Node.js).
   Storage: an Object Storage bucket mounted into the function as a folder (STORE_DIR).
   Every score is recomputed here by replaying the game with core.js; the client's own number is ignored.

   Public:
   POST ?action=ticket  {device}                       -> {ticket, seed}
   POST ?action=submit  {ticket, device, nick, clicks} -> {score, best, improved, rank, total, nickPending}
   GET  ?action=top     [&device=...]                   -> {top:[{name,score,hits,date}], me, total}

   Moderation (env MODERATION): "post" by default — nicknames are shown at once (filtered; the owner can hide/rename/ban in the admin page).
   MODERATION=pre shows a nickname only after the owner approves it; until then the table shows "Игрок XXXX".
   Admin (env ADMIN_KEY, long random string): POST ?action=admin {key, op, ...}
     op: list | approve {device} | rename {device,nick} | hide {device} | delete {device, ban} | unban {device} | words {words:[...]}
*/
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Core = require('./core.js');

const DIR = process.env.STORE_DIR || '/function/storage/data';
const MODE = (process.env.MODERATION || 'post').toLowerCase() === 'pre' ? 'pre' : 'post';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const TICKET_TTL = 6 * 3600 * 1000;     // a ticket can be used within 6 hours
const WALL_SLACK = 3;                    // seconds: real time may not be shorter than game time minus this
const TOP_N = 50;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

const reply = (code, obj) => ({ statusCode: code, headers: CORS, body: JSON.stringify(obj) });
const fail = (code, error) => reply(code, { error });
const idOk = s => typeof s === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(s);
const tag = device => crypto.createHash('sha256').update(String(device)).digest('hex').slice(0, 4).toUpperCase();

function sub(d) { const p = path.join(DIR, d); fs.mkdirSync(p, { recursive: true }); return p; }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; } }
function writeJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj)); }   // one object per file; no rename (bucket mounts may not support it)
const scoreFile = device => path.join(sub('scores'), device + '.json');
const banFile = device => path.join(sub('bans'), device + '.json');

/* ---------- nickname filter (first line of defence; moderation is the second) ---------- */
const BAD = [
  // profanity / slurs
  'хуй', 'хуе', 'хуё', 'хуя', 'пизд', 'ебат', 'ебан', 'ебал', 'ёбан', 'еблан', 'бляд', 'блят', 'сука', 'суки', 'мудак', 'пидор', 'пидар', 'гандон', 'залуп', 'шлюх', 'дроч', 'хохол', 'хохл', 'жиды', 'жидо', 'жидя', 'чурк', 'хач', 'ниггер', 'негр',
  'fuck', 'shit', 'cunt', 'nigger', 'nigga', 'faggot', 'whore', 'bitch', 'retard',
  'huy', 'hui', 'xuy', 'xui', 'pizd', 'ebat', 'eban', 'blya', 'blyat', 'blyad', 'suka', 'mudak', 'pidor', 'pidar', 'pidr', 'gandon', 'zalup', 'shluh', 'hohol', 'zhid',
  // nazism / extremism / terrorism
  'гитлер', 'hitler', 'нацист', 'nazi', 'зигхайл', 'siegheil', 'heil', 'хайль', '1488', 'вермахт', 'ss88', 'reich', 'рейх', 'свастик', 'swastik', 'игил', 'isis', 'талибан', 'taliban', 'джихад', 'jihad', 'шахид', 'терро', 'terror', 'бандер', 'bander', 'азов', 'azov', 'колумбайн', 'columbine', 'скулшут', 'schoolshoot',
  // drugs
  'нарко', 'героин', 'heroin', 'кокаин', 'cocaine', 'kokain', 'кокс', 'мефедрон', 'мефф', 'mefedron', 'амфетамин', 'amphetamin', 'спайс', 'закладк', 'zakladk', 'гидра', 'hydra', 'лсд', 'марихуан', 'marijuan', 'ганджа', 'weed', 'шишки',
  // politics and war
  'путин', 'putin', 'зеленск', 'zelensk', 'навальн', 'navaln', 'z0v', 'zov', 'kremlin', 'кремл', 'байден', 'biden', 'трамп', 'trump', 'хамас', 'hamas',
  // sexual
  'секс', 'sex', 'порн', 'porn', 'член', 'dick', 'penis', 'вагин', 'vagin', 'сиськ', 'boob', 'минет', 'анальн', 'cock', 'pussy', 'onlyfans'
];
const TO_CYR = { '0': 'о', '3': 'з', '4': 'ч', '6': 'б', '@': 'а', 'a': 'а', 'e': 'е', 'o': 'о', 'p': 'р', 'c': 'с', 'x': 'х', 'y': 'у', 'k': 'к', 'b': 'б', 'h': 'н', 'm': 'м', 't': 'т' };
const TO_LAT = { 'а': 'a', 'е': 'e', 'ё': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'к': 'k', 'в': 'b', 'н': 'h', 'м': 'm', 'т': 't', 'і': 'i', 'и': 'i',
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };
function extraWords() { const w = readJson(path.join(sub('config'), 'words.json')); return Array.isArray(w) ? w : []; }
function nickProblem(raw) {
  if (typeof raw !== 'string') return 'empty';
  const n = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (n.length < 2 || n.length > 16) return 'length';
  if (!/^[\p{L}\p{N} _.\-]+$/u.test(n)) return 'chars';
  if (/[\p{L}]/u.test(n) && /\p{Script=Latin}/u.test(n) && /\p{Script=Cyrillic}/u.test(n) && !/\s/.test(n)) {
    // mixed alphabets inside one word is a classic filter bypass; allowed only across separate words
    const words = n.split(/[ _.\-]+/);
    if (words.some(w => /\p{Script=Latin}/u.test(w) && /\p{Script=Cyrillic}/u.test(w))) return 'mixed';
  }
  const flat = n.toLowerCase().replace(/[\s_.\-]/g, '');
  const forms = [flat, flat.replace(/./gu, ch => TO_CYR[ch] || ch), flat.replace(/./gu, ch => TO_LAT[ch] || ch), flat.replace(/./gu, ch => TO_LAT[ch] || ch).replace(/x/g, 'h')];
  const list = BAD.concat(extraWords().map(w => String(w).toLowerCase()).filter(Boolean));
  if (list.some(w => forms.some(f => f.includes(w)))) return 'word';
  return null;
}
const cleanNick = raw => nickProblem(raw) ? null : raw.normalize('NFC').replace(/\s+/g, ' ').trim();

/* ---------- table ---------- */
const shown = e => (MODE === 'post' || e.approved) && e.nick ? e.nick : 'Игрок ' + tag(e.device);
function allScores() {
  const d = sub('scores');
  return fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => {
    const e = readJson(path.join(d, f));
    if (e && !e.device) e.device = f.slice(0, -5);
    return e;
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.date - b.date);
}
const rankOf = (list, device) => list.findIndex(e => e.device === device) + 1;

function ticket(body) {
  if (!idOk(body.device)) return fail(400, 'bad device');
  const id = crypto.randomBytes(12).toString('base64url');
  const seed = crypto.randomBytes(4).readUInt32BE(0);
  writeJson(path.join(sub('tickets'), id + '.json'), { seed, device: body.device, created: Date.now() });
  sweepTickets();
  return reply(200, { ticket: id, seed, v: Core.VERSION });
}

function submit(body) {
  const { ticket: id, device, clicks } = body;
  if (!idOk(id) || !idOk(device)) return fail(400, 'bad request');
  if (!Array.isArray(clicks) || clicks.length > 20000) return fail(400, 'bad clicks');
  const nick = cleanNick(body.nick);
  if (!nick) return fail(400, 'bad nick');
  const tfile = path.join(sub('tickets'), id + '.json');
  const t = readJson(tfile);
  if (!t) return fail(409, 'ticket unknown or used');
  try { fs.unlinkSync(tfile); } catch (_) { return fail(409, 'ticket used'); }   // one ticket = one result
  if (t.device !== device) return fail(403, 'ticket of another device');
  if (Date.now() - t.created > TICKET_TTL) return fail(410, 'ticket expired');
  if (readJson(banFile(device))) return fail(403, 'banned');

  const r = Core.replay(t.seed, clicks);
  if (!r.valid) return fail(422, 'replay rejected: ' + r.reason);
  if ((Date.now() - t.created) / 1000 < r.seconds - WALL_SLACK) return fail(422, 'faster than real time');

  const sfile = scoreFile(device);
  const prev = readJson(sfile);
  const sameNick = prev && prev.nick === nick;
  const approved = sameNick ? !!prev.approved : false;            // a new or changed nickname needs approval again
  const improved = !prev || r.score > prev.score;
  const entry = improved
    ? { device, nick, approved, score: r.score, hits: r.hits, blue: r.blue, miss: r.miss, seconds: Math.round(r.seconds * 10) / 10, date: Date.now() }
    : Object.assign(prev, { device, nick, approved });
  if (improved || !sameNick) writeJson(sfile, entry);
  const list = allScores();
  return reply(200, { score: r.score, best: entry.score, improved, rank: rankOf(list, device), total: list.length,
    nickPending: MODE === 'pre' && !approved, name: shown(entry) });
}

function top(q) {
  const list = allScores();
  let me = null;
  if (idOk(q.device)) {
    const own = list.find(e => e.device === q.device);
    if (own) me = { rank: rankOf(list, q.device), score: own.score, name: shown(own), nickPending: MODE === 'pre' && !own.approved };
  }
  return reply(200, { top: list.slice(0, TOP_N).map(e => ({ name: shown(e), nick: shown(e), score: e.score, hits: e.hits, date: e.date })), me, total: list.length });
}

/* ---------- admin ---------- */
function keyOk(k) {
  if (!ADMIN_KEY || ADMIN_KEY.length < 24 || typeof k !== 'string') return false;
  const a = crypto.createHash('sha256').update(k).digest(), b = crypto.createHash('sha256').update(ADMIN_KEY).digest();
  return crypto.timingSafeEqual(a, b);
}
function admin(body) {
  if (!keyOk(body.key)) return fail(403, 'forbidden');
  const dev = body.device;
  const need = () => idOk(dev) ? null : fail(400, 'bad device');
  switch (body.op) {
    case 'list': {
      const bans = fs.readdirSync(sub('bans')).filter(f => f.endsWith('.json')).map(f => Object.assign({ device: f.slice(0, -5) }, readJson(path.join(sub('bans'), f))));
      return reply(200, { mode: MODE, entries: allScores().map(e => ({ device: e.device, tag: tag(e.device), nick: e.nick, approved: !!e.approved, score: e.score, hits: e.hits, date: e.date })), bans, words: extraWords() });
    }
    case 'approve': case 'hide': case 'rename': {
      const bad = need(); if (bad) return bad;
      const e = readJson(scoreFile(dev)); if (!e) return fail(404, 'no such player');
      if (body.op === 'approve') e.approved = true;
      if (body.op === 'hide') { e.approved = false; e.nick = ''; }
      if (body.op === 'rename') {
        const n = typeof body.nick === 'string' ? body.nick.normalize('NFC').replace(/\s+/g, ' ').trim() : '';
        if (n.length < 2 || n.length > 16 || !/^[\p{L}\p{N} _.\-]+$/u.test(n)) return fail(400, 'bad nick');
        e.nick = n; e.approved = true;
      }
      e.device = dev; writeJson(scoreFile(dev), e);
      return reply(200, { ok: true });
    }
    case 'delete': {
      const bad = need(); if (bad) return bad;
      const e = readJson(scoreFile(dev));
      try { fs.unlinkSync(scoreFile(dev)); } catch (_) {}
      if (body.ban) writeJson(banFile(dev), { nick: e && e.nick || '', date: Date.now() });
      return reply(200, { ok: true });
    }
    case 'unban': {
      const bad = need(); if (bad) return bad;
      try { fs.unlinkSync(banFile(dev)); } catch (_) {}
      return reply(200, { ok: true });
    }
    case 'words': {
      if (!Array.isArray(body.words)) return fail(400, 'bad words');
      const words = [...new Set(body.words.map(w => String(w).toLowerCase().trim()).filter(w => w.length >= 2 && w.length <= 32))].slice(0, 500);
      writeJson(path.join(sub('config'), 'words.json'), words);
      return reply(200, { ok: true, words });
    }
    default: return fail(400, 'unknown op');
  }
}

let lastSweep = 0;
function sweepTickets() {
  if (Date.now() - lastSweep < 600000) return;
  lastSweep = Date.now();
  const d = sub('tickets');
  for (const f of fs.readdirSync(d)) {
    const t = readJson(path.join(d, f));
    if (!t || Date.now() - t.created > TICKET_TTL) { try { fs.unlinkSync(path.join(d, f)); } catch (_) {} }
  }
}

module.exports.handler = async function (event) {
  try {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
    const q = event.queryStringParameters || {};
    let body = {};
    if (event.body) {
      const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
      if (raw.length > 400000) return fail(413, 'too large');
      try { body = JSON.parse(raw); } catch (_) { return fail(400, 'bad json'); }
    }
    switch (q.action) {
      case 'ticket': return ticket(body);
      case 'submit': return submit(body);
      case 'top': return top(q);
      case 'admin': return admin(body);
      default: return fail(404, 'unknown action');
    }
  } catch (e) {
    console.error(e);
    return fail(500, 'server error');
  }
};
module.exports._cleanNick = cleanNick;
module.exports._nickProblem = nickProblem;

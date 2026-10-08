/* Srulque leaderboard — Yandex Cloud Function (Node.js).
   Storage: an Object Storage bucket mounted into the function as a folder (STORE_DIR).
   Every score is recomputed here by replaying the game with core.js; the client's own number is ignored.

   POST ?action=ticket  {device}                      -> {ticket, seed}
   POST ?action=submit  {ticket, device, nick, clicks} -> {score, best, rank, total, improved}
   GET  ?action=top     [&device=...]                  -> {top:[{nick,score,hits,date}], me:{rank,score}|null, total}
*/
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Core = require('./core.js');

const DIR = process.env.STORE_DIR || '/function/storage/data';
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

function sub(d) { const p = path.join(DIR, d); fs.mkdirSync(p, { recursive: true }); return p; }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; } }
function writeJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj)); }   // one object per file; no rename (bucket mounts may not support it)

/* nicknames: 2..16 chars, letters/digits/space/_-., no obvious profanity */
const BAD = ['хуй', 'хуе', 'хуё', 'хуя', 'пизд', 'ебат', 'ебан', 'ебал', 'ёбан', 'еблан', 'бляд', 'блят', 'сука', 'суки', 'мудак', 'пидор', 'пидар', 'гандон', 'залуп', 'шлюх', 'дроч',
  'fuck', 'shit', 'cunt', 'nigger', 'nigga', 'faggot', 'whore', 'bitch',
  'huy', 'hui', 'xuy', 'xui', 'pizd', 'ebat', 'eban', 'blya', 'blyat', 'blyad', 'suka', 'mudak', 'pidor', 'pidar', 'pidr', 'gandon', 'zalup', 'shluh'];
// fold look-alike letters both ways so "Fuсk" (Cyrillic с) or "p1d0r" are caught
const TO_CYR = { '0': 'о', '3': 'з', '4': 'ч', '6': 'б', '@': 'а', 'a': 'а', 'e': 'е', 'o': 'о', 'p': 'р', 'c': 'с', 'x': 'х', 'y': 'у', 'k': 'к', 'b': 'б', 'h': 'н', 'm': 'м', 't': 'т' };
const TO_LAT = { 'а': 'a', 'е': 'e', 'ё': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'к': 'k', 'в': 'b', 'н': 'h', 'м': 'm', 'т': 't', 'і': 'i', 'и': 'i',
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };
function cleanNick(raw) {
  if (typeof raw !== 'string') return null;
  const n = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (n.length < 2 || n.length > 16) return null;
  if (!/^[\p{L}\p{N} _.\-]+$/u.test(n)) return null;
  const flat = n.toLowerCase().replace(/[\s_.\-]/g, '');
  const cyr = flat.replace(/./gu, ch => TO_CYR[ch] || ch);
  const lat = flat.replace(/./gu, ch => TO_LAT[ch] || ch).replace(/c(?=k)/g, 'c').replace(/x/g, 'h');
  const lat2 = flat.replace(/./gu, ch => TO_LAT[ch] || ch);
  if (BAD.some(w => flat.includes(w) || cyr.includes(w) || lat.includes(w) || lat2.includes(w))) return null;
  return n;
}

function allScores() {
  const d = sub('scores');
  return fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => readJson(path.join(d, f))).filter(Boolean)
    .sort((a, b) => b.score - a.score || a.date - b.date);
}

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

  const r = Core.replay(t.seed, clicks);
  if (!r.valid) return fail(422, 'replay rejected: ' + r.reason);
  if ((Date.now() - t.created) / 1000 < r.seconds - WALL_SLACK) return fail(422, 'faster than real time');

  const sfile = path.join(sub('scores'), device + '.json');
  const prev = readJson(sfile);
  const entry = { nick, score: r.score, hits: r.hits, blue: r.blue, miss: r.miss, seconds: Math.round(r.seconds * 10) / 10, date: Date.now() };
  const improved = !prev || r.score > prev.score;
  if (improved) writeJson(sfile, entry);
  else if (prev.nick !== nick) writeJson(sfile, Object.assign(prev, { nick }));   // nickname change keeps the best score
  const list = allScores();
  const ref = improved ? entry : prev;
  const mine = list.findIndex(e => e.date === ref.date && e.nick === nick);
  return reply(200, { score: r.score, best: improved ? r.score : prev.score, improved, rank: mine + 1, total: list.length });
}

function top(q) {
  const list = allScores();
  let me = null;
  if (idOk(q.device)) {
    const own = readJson(path.join(sub('scores'), q.device + '.json'));
    if (own) me = { rank: list.findIndex(e => e.date === own.date && e.nick === own.nick) + 1, score: own.score, nick: own.nick };
  }
  return reply(200, { top: list.slice(0, TOP_N).map(e => ({ nick: e.nick, score: e.score, hits: e.hits, date: e.date })), me, total: list.length });
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
      default: return fail(404, 'unknown action');
    }
  } catch (e) {
    console.error(e);
    return fail(500, 'server error');
  }
};
module.exports._cleanNick = cleanNick;

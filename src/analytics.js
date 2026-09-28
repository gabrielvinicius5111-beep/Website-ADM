const DAY = 86400000;
const enc = new TextEncoder();
const headers = {
  'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, private',
  'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY', 'x-robots-tag': 'noindex, nofollow',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
};
export function device(ua) {
  if (/ipad|tablet|kindle|silk|android(?!.*mobile)/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android/i.test(ua)) return 'celular';
  return 'computador';
}
export function maskIP(ip) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip.split('.').slice(0, 3).join('.') + '.0/24';
  if (ip.includes(':')) {
    const parts = ip.split('::');
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    const expanded = parts.length === 2 ? [...left, ...Array(Math.max(0, 8-left.length-right.length)).fill('0'), ...right] : left;
    return expanded.slice(0, 3).map(p => parseInt(p, 16).toString(16)).join(':') + '::/48';
  }
  return 'indisponível';
}
export async function fingerprint(secret, value) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value))), x => x.toString(16).padStart(2,'0')).join('');
}
function configured(env) {
  return env.ANALYTICS_DB && env.ANALYTICS_HASH_SECRET?.length >= 32;
}
export async function recordVisit(request, env, now = Date.now()) {
  if (!configured(env)) return;
  const ua = (request.headers.get('user-agent') || '').slice(0, 1024);
  if (/bot|crawler|spider|headless|preview|monitor/i.test(ua)) return;
  if (request.headers.get('sec-gpc') === '1' || request.headers.get('dnt') === '1') return;
  if (/prefetch|prerender/i.test(request.headers.get('purpose') || request.headers.get('sec-purpose') || '')) return;
  const ip = request.headers.get('cf-connecting-ip');
  const id = ip ? await fingerprint(env.ANALYTICS_HASH_SECRET, 'visitor:' + ip + '\n' + ua) : null;
  await env.ANALYTICS_DB.prepare('INSERT INTO visits (visited_at, visitor_hash, ip_masked, device) VALUES (?, ?, ?, ?)')
    .bind(now, id, maskIP(ip || ''), device(ua)).run();
}
export async function cleanup(env, now = Date.now()) {
  if (!env.ANALYTICS_DB) return;
  await env.ANALYTICS_DB.batch([
    env.ANALYTICS_DB.prepare('DELETE FROM visits WHERE visited_at < ?').bind(now - 30*DAY),
    env.ANALYTICS_DB.prepare('DELETE FROM auth_attempts WHERE bucket < ?').bind(Math.floor(now / 900000) - 1)
  ]);
}
function response(body, status = 200, extra = {}) {
  return new Response(body, {status, headers:{...headers, ...extra}});
}
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function admin(request, env, now = Date.now()) {
  if (!configured(env) || !env.ADMIN_USERNAME || env.ADMIN_PASSWORD?.length < 32 || !env.ADMIN_PASSWORD)
    return response('Painel indisponível. Configure o banco e os secrets conforme o README.', 503);
  if (new URL(request.url).protocol !== 'https:') return response('Use HTTPS para acessar o painel.', 403);
  if (request.method !== 'GET') return response('Método não permitido.', 405, {'allow':'GET'});
  const challenge = () => response('Acesso restrito ao administrador.', 401, {'www-authenticate':'Basic realm="ADM privado", charset="UTF-8"'});
  const auth = request.headers.get('authorization') || '';
  if (!auth) return challenge();
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const key = await fingerprint(env.ANALYTICS_HASH_SECRET, 'auth:' + ip);
  const bucket = Math.floor(now / 900000);
  const attempt = await env.ANALYTICS_DB.prepare('INSERT INTO auth_attempts (ip_hash, bucket, attempts) VALUES (?, ?, 1) ON CONFLICT(ip_hash, bucket) DO UPDATE SET attempts = attempts + 1 RETURNING attempts').bind(key, bucket).first();
  if (attempt.attempts > 30) return response('Limite de acessos. Aguarde até 15 minutos.', 429, {'retry-after':String(900 - Math.floor(now/1000)%900)});
  let supplied = '';
  try { if (auth.startsWith('Basic ') && auth.length < 4096) supplied = atob(auth.slice(6)); } catch {}
  const expected = env.ADMIN_USERNAME + ':' + env.ADMIN_PASSWORD;
  const a = await fingerprint(env.ANALYTICS_HASH_SECRET, supplied);
  const b = await fingerprint(env.ANALYTICS_HASH_SECRET, expected);
  let mismatch = 0;
  for (let i=0;i<a.length;i++) mismatch |= a.charCodeAt(i)^b.charCodeAt(i);
  if (mismatch) return challenge();
  const url = new URL(request.url);
  if (url.pathname !== '/admin' && url.pathname !== '/admin/') return response('Não encontrado.',404);
  const days = [1,7,30].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
  const since = now-days*DAY;
  const results = await env.ANALYTICS_DB.batch([
    env.ANALYTICS_DB.prepare('SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors FROM visits WHERE visited_at >= ?').bind(since),
    env.ANALYTICS_DB.prepare('SELECT device, COUNT(*) AS total FROM visits WHERE visited_at >= ? GROUP BY device').bind(since),
    env.ANALYTICS_DB.prepare('SELECT visited_at, ip_masked, device FROM visits WHERE visited_at >= ? ORDER BY visited_at DESC, id DESC LIMIT 100').bind(since)
  ]);
  const totals = results[0].results[0];
  const rows = results[2].results.map(r => `<tr><td>${escapeHTML(new Date(r.visited_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))}</td><td>${escapeHTML(r.ip_masked)}</td><td>${escapeHTML(r.device)}</td></tr>`).join('');
  return response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ADM · Estatísticas privadas</title><style>body{margin:0;background:#f3f5f7;color:#172a3a;font:16px system-ui}main{max-width:1050px;margin:auto;padding:28px 18px}header{background:#172a3a;color:white;padding:24px;border-radius:16px}h1{margin:8px 0}p{line-height:1.6}.cards{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}.card{background:white;border-radius:14px;padding:24px;flex:1;min-width:180px}.number{font-size:40px;font-weight:700}a,button{color:#172a3a}select,button{padding:12px;border:1px solid #bac5cd;border-radius:8px;background:white;font:inherit}.table{overflow:auto;background:white;border-radius:14px}table{border-collapse:collapse;width:100%;white-space:nowrap}td,th{padding:15px;text-align:left;border-bottom:1px solid #e7ebee}small{color:#506575}</style><main><header><small style="color:#d9e4ec">A.D.M. • ACESSO RESTRITO</small><h1>Estatísticas do site</h1><p>Visitas dos últimos ${days} dia(s). Horários de Brasília.</p></header><form><p><label for="days">Período </label><select id="days" name="days">${[1,7,30].map(d=>`<option value="${d}" ${d===days?'selected':''}>Últimos ${d} dia(s)</option>`).join('')}</select> <button>Atualizar</button></p></form><section class="cards"><div class="card">Visualizações<div class="number">${totals.views}</div></div><div class="card">Visitantes únicos estimados<div class="number">${totals.visitors}</div></div></section><p>${results[1].results.map(r=>`${escapeHTML(r.device)}: <strong>${r.total}</strong>`).join(' · ') || 'Sem visitas no período.'}</p><h2>100 registros mais recentes</h2><div class="table"><table><thead><tr><th>Data e hora</th><th>IP mascarado</th><th>Dispositivo estimado</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Nenhuma visita registrada.</td></tr>'}</tbody></table></div><p><small>Retenção: 30 dias, com exclusão diária. Identificação por hash protegido de IP + User-Agent, sem cookies. Redes compartilhadas, troca de IP e navegador afetam a estimativa. Robôs conhecidos, preferências DNT/GPC e o painel não são contados. O tipo de dispositivo é estimado; o modelo exato não é garantido.</small></p><p><small>Abra este painel em uma janela anônima e feche todas as janelas anônimas ao terminar. O navegador guarda a autenticação HTTP durante a sessão.</small></p><a href="/">Voltar ao site</a></main></html>`);
}

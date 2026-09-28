import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.js';
import {recordVisit, cleanup, device, maskIP} from '../src/analytics.js';
function setup() {
 const db = new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../migrations/0001_analytics.sql',import.meta.url),'utf8'));
 const adapter = {prepare(sql) { return {args:[], bind(...args){this.args=args;return this;}, async run(){return db.prepare(sql).run(...this.args);}, async first(){return db.prepare(sql).get(...this.args);}, async all(){return {results:db.prepare(sql).all(...this.args)};}}; }, async batch(stmts){return Promise.all(stmts.map(s=>s.all()));}};
 return {db, env:{ANALYTICS_DB:adapter,ANALYTICS_HASH_SECRET:'h'.repeat(48),ADMIN_USERNAME:'admin',ADMIN_PASSWORD:'p'.repeat(48),ASSETS:{fetch:async()=>new Response('<html>public</html>',{headers:{'content-type':'text/html'}})}}};
}
const req = (path='/', extra={}) => new Request('https://site.example'+path,{headers:{'user-agent':'Mozilla Android Mobile','cf-connecting-ip':'203.0.113.42',...extra}});
const auth = {authorization:'Basic '+btoa('admin:'+ 'p'.repeat(48))};
test('IP masking and device classification',()=>{
 assert.equal(maskIP('203.0.113.42'),'203.0.113.0/24');
 assert.equal(maskIP('2001:db8::abcd'),'2001:db8:0::/48');
 assert.equal(maskIP('::1'),'0:0:0::/48');
 assert.equal(device('iPad'),'tablet'); assert.equal(device('Android Mobile'),'celular'); assert.equal(device('Windows NT'),'computador');
});
test('backend counts pages, protects IP, excludes assets/admin/bots/privacy signals',async()=>{
 const {db,env}=setup(); const jobs=[];const ctx={waitUntil:p=>jobs.push(p)};
 await worker.fetch(req('/?cpf=123'),env,ctx); await worker.fetch(req('/index.html'),env,ctx);
 await worker.fetch(req('/styles.css'),env,ctx); await worker.fetch(req('/admin'),env,ctx);
 await worker.fetch(req('/',{'dnt':'1'}),env,ctx);await worker.fetch(req('/',{'sec-gpc':'1'}),env,ctx);
 await worker.fetch(req('/',{'user-agent':'Googlebot'}),env,ctx);await Promise.all(jobs);
 const rows=db.prepare('SELECT * FROM visits').all(); assert.equal(rows.length,2);
 assert.equal(rows[0].visitor_hash,rows[1].visitor_hash);assert.equal(rows[0].ip_masked,'203.0.113.0/24');
 assert.ok(!JSON.stringify(rows).includes('203.0.113.42')); assert.ok(!JSON.stringify(rows).includes('cpf'));
 const page=await worker.fetch(req('/admin',auth),env,ctx);assert.equal(page.status,200); assert.match(await page.text(),/Visualizações/);
 assert.equal(page.headers.get('cache-control'),'no-store, private');
});
test('authentication fails closed, denies wrong secrets, limits attempts and guards subpaths',async()=>{
 const {env}=setup();const ctx={waitUntil:()=>{}};
 assert.equal((await worker.fetch(req('/admin'),env,ctx)).status,401);
 assert.equal((await worker.fetch(req('/admin/data'),env,ctx)).status,401);
 assert.equal((await worker.fetch(req('/admin'),{...env,ADMIN_PASSWORD:''},ctx)).status,503);
 for(let i=0;i<30;i++) assert.equal((await worker.fetch(req('/admin',{authorization:'Basic '+btoa('bad:bad')}),env,ctx)).status,401);
 assert.equal((await worker.fetch(req('/admin',auth),env,ctx)).status,429);
});
test('retention deletes old records and expired auth attempts',async()=>{
 const {db,env}=setup();const now=Date.now();
 await recordVisit(req(),env,now-31*86400000);await recordVisit(req(),env,now);
 db.prepare('INSERT INTO auth_attempts VALUES (?, ?, ?)').run('old',1,1);
 await cleanup(env,now);assert.equal(db.prepare('SELECT COUNT(*) n FROM visits').get().n,1);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM auth_attempts').get().n,0);
});
test('CPF and CNPJ validation remain routed through original backend',async()=>{
 const {env}=setup(); for(const type of ['cpf','cnpj']) {
 const res=await worker.fetch(req('/api/consultar-'+type+'?'+type+'=1'),env,{});assert.equal(res.status,400);
 }
});
test('period metrics deduplicate visitors and omit expired records',async()=>{
 const {env}=setup();const now=Date.now();
 await recordVisit(req(),env,now);await recordVisit(req(),env,now);
 await recordVisit(req('/',{'cf-connecting-ip':'198.51.100.9'}),env,now);
 await recordVisit(req('/',{'cf-connecting-ip':'198.51.100.10'}),env,now-31*86400000);
 const html=await (await worker.fetch(req('/admin?days=30',auth),env,{})).text();
 assert.match(html,/Visualizações<div class="number">3/);
 assert.match(html,/Visitantes únicos estimados<div class="number">2/);
 assert.ok(!html.includes('198.51.100.9'));
});
test('analytics outage does not break public website; scheduled handler runs cleanup',async()=>{
 const {db,env}=setup();const jobs=[];const ctx={waitUntil:p=>jobs.push(p)};
 const broken={...env,ANALYTICS_DB:{prepare(){throw new Error('offline');}}};
 assert.equal((await worker.fetch(req(),broken,ctx)).status,200);await Promise.all(jobs);
 assert.equal((await worker.fetch(req('/admin',auth),broken,ctx)).status,503);
 await recordVisit(req(),env,Date.now()-31*86400000);
 await worker.scheduled({},env,ctx);await Promise.all(jobs);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM visits').get().n,0);
});

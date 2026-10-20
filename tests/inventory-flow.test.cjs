const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const ts = require('typescript');
const crypto = require('node:crypto');
let pg;
const admin = '11111111-1111-1111-1111-111111111111';
const staff = '22222222-2222-2222-2222-222222222222';
async function actor(email='rifkah@qomaruddin.com',id=admin) {
 await pg.query("select set_config('test.email',$1,false), set_config('test.uid',$2,false)",[email,id]);
}
async function rpc(name,args) {
 const placeholders=args.map((_,i)=>`$${i+1}`).join(',');
 return (await pg.query(`select dapur_db.${name}(${placeholders}) as result`,args)).rows[0].result;
}
const at = (day,hour) => `2026-01-${day}T${hour}:00+07:00`;
async function create(qty=10,name='Beras',uom='Kg') {
 const id=crypto.randomUUID();
 await rpc('inventory_create_item',[id,name,'Pokok',uom,qty,at('19','13:00'),'Stok fisik awal']);return id;
}
async function movement(item,kind,qty,time,extra={}) {
 return rpc('inventory_record_movement',[extra.id||crypto.randomUUID(),item,kind,qty,time,extra.person||'Pegawai dapur',extra.supplier||'Pemasok',extra.note||'Catatan',extra.reversed||null]);
}
async function snapshot(date='2026-01-20') { return rpc('inventory_snapshot',[date]); }
test.before(async()=>{
 pg=new PGlite();
 await pg.exec(`create schema dapur_db; create schema auth; create role authenticated; create role anon;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email',current_setting('test.email',true)) $$;`);
 await pg.exec(fs.readFileSync('supabase/migrations/20261021_inventory_ledger.sql','utf8'));
});
test.beforeEach(async()=>{ await pg.exec('reset role; truncate dapur_db.inventory_recaps,dapur_db.inventory_movements,dapur_db.inventory_items cascade;');await actor();});
test.after(async()=>{ await pg?.close(); });
test('existing opening + evening incoming - morning withdrawal carries across dates',async()=>{
 const id=await create(10);await movement(id,'in',20,at('19','18:00'));await movement(id,'out',7,at('20','05:00'));
 const s=await snapshot();assert.equal(Number(s.items[0].balance),23);
 assert.equal(Number(s.report.rows[0].opening),10);assert.equal(Number(s.report.rows[0].incoming),20);assert.equal(Number(s.report.rows[0].outgoing),7);assert.equal(Number(s.report.rows[0].closing),23);
 const next=await snapshot('2026-01-22');assert.equal(Number(next.report.rows[0].opening),23);assert.equal(Number(next.report.rows[0].closing),23);
});
test('14:00 belongs to next usage date; 13:59 stays in current date',async()=>{
 const id=await create();await movement(id,'in',2,at('20','13:59'));await movement(id,'in',3,at('20','14:00'));
 assert.equal(Number((await snapshot()).report.rows[0].incoming),2);assert.equal(Number((await snapshot('2026-01-21')).report.rows[0].incoming),3);
});
test('retrying identical transaction does not double stock',async()=>{
 const item=await create();const id=crypto.randomUUID();await movement(item,'in',5,at('19','17:00'),{id});await movement(item,'in',5,at('19','17:00'),{id});
 assert.equal(Number((await snapshot()).items[0].balance),15);
 await assert.rejects(movement(item,'in',6,at('19','17:00'),{id}),/data lain/);
});
test('insufficient withdrawal rolls back and keeps balance intact',async()=>{
 const id=await create(5);await assert.rejects(movement(id,'out',6,at('20','05:00')),/tidak mencukupi/);
 assert.equal(Number((await snapshot()).items[0].balance),5);
});
test('backdated outgoing cannot borrow from later incoming',async()=>{
 const id=await create(0);await movement(id,'in',10,at('20','08:00'));
 await assert.rejects(movement(id,'out',4,at('20','06:00')),/tidak mencukupi/);
});
test('physical count records discrepancy separately, never as outgoing',async()=>{
 const id=await create(10);await movement(id,'in',5,at('19','18:00'));await movement(id,'out',3,at('20','05:00'));await movement(id,'count',11,at('20','12:30'));
 const r=(await snapshot()).report.rows[0];assert.equal(Number(r.outgoing),3);assert.equal(Number(r.adjustment),-1);assert.equal(Number(r.closing),11);
 await assert.rejects(movement(id,'in',1,at('20','09:00')),/hitung fisik/);
});
test('staff can withdraw but cannot receive, initialize or recap',async()=>{
 const id=await create();await actor('masak@qomaruddin.com',staff);
 await movement(id,'out',2,at('20','06:00'));assert.equal(Number((await snapshot()).items[0].balance),8);
 await assert.rejects(movement(id,'in',1,at('20','08:00')),/berhak/);
 await assert.rejects(create(1,'Gula'),/Hanya admin/);
 await assert.rejects(rpc('inventory_save_recap',[crypto.randomUUID(),'2026-01-20','']),/Hanya admin/);
});
test('unrecognized and unauthenticated accounts cannot read stock',async()=>{
 await actor('unknown@example.com',staff);await assert.rejects(snapshot(),/akses/);
 await actor('rifkah@qomaruddin.com','');await assert.rejects(snapshot(),/akses/);
});
test('reversal preserves original and cannot be applied twice',async()=>{
 const item=await create();const out=await movement(item,'out',4,at('20','06:00'));
 await movement(item,'reversal',0,at('20','07:00'),{reversed:out});assert.equal(Number((await snapshot()).items[0].balance),10);
 assert.equal((await snapshot()).movements.find(m=>m.id===out).reversed,true);
 await assert.rejects(movement(item,'reversal',0,at('20','08:00'),{reversed:out}));
});
test('saved recap is immutable when late transactions are entered',async()=>{
 const item=await create();await movement(item,'in',5,at('19','18:00'));
 const id=crypto.randomUUID();await rpc('inventory_save_recap',[id,'2026-01-20','Rekap admin']);
 await movement(item,'out',3,at('20','08:00'));
 const s=await snapshot();assert.equal(Number(s.recaps[0].rows[0].closing),15);assert.equal(Number(s.report.rows[0].closing),12);
 await rpc('inventory_save_recap',[id,'2026-01-20','Rekap admin']);assert.equal((await snapshot()).recaps.length,1);
});
test('name and unit identify separate items; duplicate name/unit rejected',async()=>{
 await create(5);await create(2,'Beras','Zak');await assert.rejects(create(3,' beras ','kg'));
 assert.equal((await snapshot()).items.length,2);
});
test('invalid quantities, future dates and missing pickup name rejected',async()=>{
 const id=await create();await assert.rejects(movement(id,'in',-1,at('20','08:00')));
 await assert.rejects(movement(id,'out',0,at('20','08:00')));
 await assert.rejects(movement(id,'in',1,'2099-01-01T10:00:00Z'));
 await assert.rejects(rpc('inventory_record_movement',[crypto.randomUUID(),id,'out',1,at('20','08:00'),'','','',null]),/Nama pengambil/);
});
test('authenticated role writes only via authorized RPC, never raw tables',async()=>{
 await pg.exec('grant usage on schema dapur_db,auth to authenticated; grant execute on all functions in schema auth to authenticated; set role authenticated;');
 const id=await create();assert.ok(id);assert.equal((await snapshot()).items.length,1);
 await assert.rejects(pg.query('delete from dapur_db.inventory_movements'),/permission denied/);
 await pg.exec('reset role;');
});
test('migration reapplication preserves transactions',async()=>{
 await create();await pg.exec(fs.readFileSync('supabase/migrations/20261021_inventory_ledger.sql','utf8'));
 assert.equal(Number((await snapshot()).items[0].balance),10);
});
test('legacy migration carries latest balances once and preserves existing ledger stock',async()=>{
 await pg.exec('create table dapur_db.stock_opname_docs(date date primary key, items jsonb);');
 try {
  await create(10,'Beras');
  await pg.query('insert into dapur_db.stock_opname_docs values ($1,$2),($3,$4)',[
   '2026-01-01',JSON.stringify([{name:'Gula',uom:'Kg',stokAkhir:8},{name:'Rusak',uom:'Kg',stokAkhir:7}]),
   '2026-01-02',JSON.stringify([{name:'Gula',uom:'Kg',stokAkhir:3},{name:'Beras',uom:'Kg',stokAkhir:99},{name:'Habis',uom:'pcs',stokAkhir:0},{name:'Rusak',uom:'Kg',stokAkhir:'invalid'}])
  ]);
  const migration=fs.readFileSync('supabase/migrations/20261022_inventory_existing_stock.sql','utf8');
  await pg.exec(migration);
  await pg.exec(migration);
  const s=await snapshot();
  assert.equal(s.items.length,3);
  assert.equal(Number(s.items.find(i=>i.name==='Beras').balance),10);
  assert.equal(Number(s.items.find(i=>i.name==='Gula').balance),3);
  assert.equal(Number(s.items.find(i=>i.name==='Habis').balance),0);
  const rows=await pg.query("select * from dapur_db.inventory_movements where actor_email='migrasi-stok-lama'");
  assert.equal(rows.rows.length,2);
  assert.ok(rows.rows.every(r=>r.kind==='opening' && r.note.includes('2026-01-02')));
 } finally { await pg.exec('drop table dapur_db.stock_opname_docs;'); }
});
test('recap can be viewed in the morning before cooking is complete',async()=>{
 const id=await create(10);
 await movement(id,'in',5,at('19','18:00'));
 await movement(id,'out',2,at('20','06:00'));
 await movement(id,'out',3,at('20','10:00'));
 const r=await rpc('inventory_report',['2026-01-20',at('20','08:00')]);
 assert.equal(Number(r.rows[0].closing),13);
 assert.equal(Number(r.rows[0].outgoing),2);
 assert.equal(Date.parse(r.end_at),Date.parse(at('20','08:00')));
});
test('two simultaneous withdrawals cannot overspend shared balance',async()=>{
 const id=await create(10);
 const result=await Promise.allSettled([movement(id,'out',7,at('20','06:00')),movement(id,'out',7,at('20','06:00'))]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(Number((await snapshot()).items[0].balance),3);
});
test('midday report uses requested cutoff and excludes afternoon receipts',async()=>{
 const id=await create(10);await movement(id,'in',5,at('19','19:00'));await movement(id,'out',3,at('20','06:00'));await movement(id,'out',2,at('20','13:00'));await movement(id,'in',20,at('20','18:00'));
 const r=await rpc('inventory_report',['2026-01-20',at('20','12:00')]);
 assert.equal(Number(r.rows[0].closing),12);assert.equal(Number(r.rows[0].outgoing),3);
 assert.equal(Date.parse(r.end_at),Date.parse(at('20','12:00')));
 assert.equal(Number((await snapshot()).report.rows[0].closing),10);
 assert.equal(Number((await snapshot('2026-01-21')).report.rows[0].incoming),20);
});
const mod={exports:{}};
new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/inventory.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod.exports);
test('WIB helper dates and units match report semantics',()=>{
 assert.equal(mod.exports.inventoryReportDate('2026-01-19T23:00'),'2026-01-20');
 assert.equal(mod.exports.inventoryReportDate('2026-01-20T13:59'),'2026-01-20');
 assert.equal(mod.exports.inventoryReportDate('2026-01-20T14:00'),'2026-01-21');
 assert.throws(()=>mod.exports.toInventoryTimestamp('2026-02-30T12:00'));
 const rows=mod.exports.latestLegacyBalances({'2026-01-01':[{name:'Beras',uom:'Kg',stokAkhir:10}], '2026-01-03':[{name:'Beras',uom:'Kg',stokAkhir:7},{name:'Beras',uom:'Zak',stokAkhir:2}]});assert.equal(rows.length,2);assert.equal(rows[0].stokAkhir,7);
});

function editor(role='admin',fail=false) {
 const state=[], effects=[];let index=0;
 const calls=[];
 const item={id:'item-1',name:'Beras',category:'Pokok',uom:'Kg',balance:10,opening_at:at('19','13:00')};
 const data={role,items:[item],movements:[],recaps:[],report:{report_date:'2026-01-20',start_at:at('19','14:00'),end_at:at('20','13:00'),rows:[]}};
 const react={createElement:(type,props,...children)=>({type,props:props||{},children}),useState(initial){const i=index++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},useRef(initial){const i=index++;if(!(i in state))state[i]={current:initial};return state[i];},useCallback:fn=>fn,useEffect(fn){const i=index++;if(!(i in state)){state[i]=true;effects.push(fn);}}};react.default=react;
 global.window={addEventListener(){},removeEventListener(){}};
 const db={async rpc(name,args){calls.push({name,args});if(name==='inventory_snapshot')return{data,error:null};return fail?{error:{message:'Koneksi gagal'}}:{data:args.p_id,error:null};}};
 const module={exports:{}};
 const source=ts.transpileModule(fs.readFileSync('src/components/InventoryLedgerView.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
 new Function('require','exports',source)(name=>name==='react'?react:name==='../lib/supabase'?{supabase:db}:mod.exports,module.exports);
 return {calls,async render(){index=0;const tree=module.exports.default({selectedDate:'2026-01-20',stockMap:{},loggedInUser:{fullName:'Pegawai'},initialMode:'out'});const nodes=[];const visit=n=>{if(Array.isArray(n))return n.forEach(visit);if(!n||typeof n!=='object')return;nodes.push(n);visit(n.children);};visit(tree);while(effects.length)effects.shift()();await new Promise(resolve=>setImmediate(resolve));return nodes;}};
}
const textOf=n=>n.children?.flat(Infinity).filter(x=>typeof x==='string').join('')||'';
test('staff interface exposes withdrawal, hides admin-only actions',async()=>{
 const ui=editor('staff');await ui.render();const nodes=await ui.render();
 assert.ok(nodes.some(n=>textOf(n)==='Catat pengambilan dapur'));
 assert.ok(!nodes.some(n=>textOf(n)==='Barang masuk'));
 assert.ok(!nodes.some(n=>textOf(n)==='Hitung fisik'));
});
test('failed form submit preserves quantity and retries with identical transaction ID',async()=>{
 const ui=editor('staff',true);await ui.render();let nodes=await ui.render();
 nodes.find(n=>n.type==='select'&&n.props.required).props.onChange({target:{value:'item-1'}});
 nodes=await ui.render();nodes.find(n=>n.type==='input'&&n.props.type==='number').props.onChange({target:{value:'3'}});
 nodes=await ui.render();nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 await new Promise(resolve=>setImmediate(resolve));nodes=await ui.render();
 assert.equal(nodes.find(n=>n.type==='input'&&n.props.type==='number').props.value,'3');
 assert.ok(nodes.some(n=>n.props.role==='alert'));
 nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));
 const writes=ui.calls.filter(c=>c.name==='inventory_record_movement');assert.equal(writes.length,2);assert.equal(writes[0].args.p_id,writes[1].args.p_id);
});

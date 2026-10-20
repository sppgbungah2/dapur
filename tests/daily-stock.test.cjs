const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const helpers = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/dailyStock.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(helpers);
const row = (patch = {}) => ({ id: 'rice', name: 'Beras', uom: 'Kg', stock: 10, incoming: 5, usage: 3, physical: 11, note: '', ...patch });
const items = () => ({ kering: [row()], basah: [row({ id: 'fish', name: 'Ikan', physical: '' })] });
let db;
async function actor(email = 'rifkah@qomaruddin.com') {
  await db.query("select set_config('test.email',$1,false)", [email]);
}
async function save(date, revision, data) {
  return (await db.query('select dapur_db.save_daily_stock($1,$2,$3) as doc', [date, revision, data])).rows[0].doc;
}
test.before(async () => {
  db = new PGlite();
  await db.exec(`create schema dapur_db; create schema auth; create role authenticated; create role anon;
    create function auth.uid() returns uuid language sql as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;
    create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('email',current_setting('test.email',true)) $$;`);
  await db.exec(fs.readFileSync('supabase/migrations/20261023_daily_stock_opname.sql', 'utf8'));
});
test.beforeEach(async () => {
  await db.exec('reset role; truncate dapur_db.daily_stock_opname;');
  await actor();
});
test.after(async () => { await db.close(); });
test('two warehouses save together and remain distinct on the same date', async () => {
  const saved = await save('2026-10-20', 0, items());
  assert.equal(saved.items.kering[0].physical, 11);
  assert.equal(saved.items.basah[0].physical, '');
  assert.equal(saved.revision, 1);
  const next = items(); next.basah[0].physical = 10;
  const updated = await save('2026-10-20', 1, next);
  assert.equal(updated.revision, 2);
  assert.equal(updated.items.kering[0].physical, 11);
});
test('retry is idempotent and stale changes cannot overwrite saved work', async () => {
  await save('2026-10-20', 0, items());
  assert.equal((await save('2026-10-20', 0, items())).revision, 1);
  const changed = items(); changed.kering[0].stock = 20;
  await assert.rejects(save('2026-10-20', 0, changed), /admin lain/);
});
test('invalid warehouse prevents the whole day being partially saved', async () => {
  const invalid = items(); invalid.basah[0].usage = 100;
  await assert.rejects(save('2026-10-20', 0, invalid), /Pemakaian/);
  assert.equal((await db.query('select count(*) from dapur_db.daily_stock_opname')).rows[0].count, 0);
  invalid.basah[0].usage = null;
  await assert.rejects(save('2026-10-20', 0, invalid), /angka/);
});
test('month returns leap-day documents and preceding saved day for carry forward', async () => {
  await save('2024-01-30', 0, items());
  await save('2024-01-31', 0, items());
  await save('2024-02-29', 0, items());
  await save('2024-03-01', 0, items());
  const result = (await db.query("select dapur_db.daily_stock_month('2024-02-01') as result")).rows[0].result;
  assert.deepEqual(result.docs.map(d => d.date), ['2024-01-31', '2024-02-29']);
});
test('staff reads but cannot change daily stock; unknown users cannot read', async () => {
  await actor('masak@qomaruddin.com');
  await assert.rejects(save('2026-10-20', 0, items()), /Hanya admin/);
  assert.equal((await db.query("select dapur_db.daily_stock_month('2026-10-01') as result")).rows[0].result.admin, false);
  await actor('stranger@example.com');
  await assert.rejects(db.query("select dapur_db.daily_stock_month('2026-10-01')"), /ditolak/);
});
test('same name in separate warehouses allowed; duplicate within one warehouse rejected', async () => {
  const same = { kering: [row()], basah: [row()] };
  await save('2026-10-20', 0, same);
  same.kering.push(row({ id: 'other' }));
  await assert.rejects(save('2026-10-21', 0, same), /dua kali/);
});
test('card balance, signed difference and blank physical count stay distinct', () => {
  assert.equal(helpers.cardBalance(row()), 12);
  assert.equal(helpers.stockDifference(row()), -1);
  assert.equal(helpers.stockDifference(row({ physical: 15 })), 3);
  assert.equal(helpers.stockDifference(row({ physical: '' })), '');
  assert.equal(helpers.stockDifference(row({ physical: 0 })), -12);
});
test('new day carries physical balance, resets activity and never shares mutable rows', () => {
  const previous = { date: '2026-10-20', revision: 1, items: items() };
  const next = helpers.nextDailyStock(previous);
  assert.equal(next.kering[0].stock, 11);
  assert.equal(next.basah[0].stock, 12);
  assert.equal(next.kering[0].physical, '');
  assert.equal(next.kering[0].incoming, 0);
  next.kering[0].name = 'Changed';
  assert.equal(previous.items.kering[0].name, 'Beras');
});
test('CSV includes both warehouses and validation rejects missing counts except physical', () => {
  const data = items();
  assert.doesNotThrow(() => helpers.validateDailyStock(data));
  const csv = helpers.dailyStockCsv({ date: '2026-10-20', revision: 1, items: data });
  assert.ok(csv.includes('"kering"') && csv.includes('"basah"') && csv.includes('"-1"'));
  data.kering[0].stock = '';
  assert.throws(() => helpers.validateDailyStock(data), /Periksa/);
});
function dailyEditor(fail = false) {
  const state = [], effects = [], storage = new Map(), calls = [];
  let index = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(value) { const i = index++; if (!(i in state)) state[i] = value; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useRef(value) { const i = index++; if (!(i in state)) state[i] = { current: value }; return state[i]; },
    useEffect(fn) { const i = index++; if (!(i in state)) { state[i] = true; effects.push(fn); } }
  };
  react.default = react;
  global.window = { addEventListener() {}, removeEventListener() {} };
  global.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const client = { async rpc(name, args) {
    calls.push({ name, args });
    if (name === 'daily_stock_month') return { data: { admin: true, docs: [{ date: '2026-10-20', revision: 1, items: items() }] } };
    return fail ? { error: { message: 'Koneksi terputus' } } : { data: { date: args.p_date, revision: 2, items: args.p_items } };
  } };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('src/components/DailyStockOpnameView.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', source)(name => name === 'react' ? react : name === '../lib/supabase' ? { supabase: client } : helpers, exports);
  return { calls, storage, async render() {
    index = 0;
    const root = exports.default({ selectedDate: '2026-10-20', loggedInUser: { id: 'admin' } });
    const nodes = [];
    const visit = n => { if (Array.isArray(n)) return n.forEach(visit); if (!n || typeof n !== 'object') return; nodes.push(n); visit(n.children); };
    visit(root);
    while (effects.length) effects.shift()();
    await new Promise(resolve => setImmediate(resolve));
    return nodes;
  } };
}
const text = node => (node.children || []).flat(Infinity).filter(v => typeof v === 'string' || typeof v === 'number').join('');
test('monthly screen has one card per date and opens both warehouses without time inputs', async () => {
  const ui = dailyEditor();
  await ui.render(); let nodes = await ui.render();
  const cards = nodes.filter(n => n.type === 'button' && n.children.some(child => child?.type === 'span' && child.children[0] === 20));
  assert.equal(cards.length, 1); cards[0].props.onClick();
  nodes = await ui.render();
  assert.ok(nodes.some(n => n.type === 'h3' && text(n) === 'Gudang Kering'));
  assert.ok(nodes.some(n => n.type === 'h3' && text(n) === 'Gudang Basah'));
  assert.equal(nodes.filter(n => n.type === 'table').length, 2);
  assert.ok(!nodes.some(n => ['time', 'datetime-local'].includes(n.props.type)));
});
test('failed daily save keeps edited quantity and a recoverable draft per date', async () => {
  const ui = dailyEditor(true);
  await ui.render(); let nodes = await ui.render();
  nodes.find(n => n.type === 'button' && n.children.some(child => child?.type === 'span' && child.children[0] === 20)).props.onClick();
  nodes = await ui.render();
  nodes.find(n => n.props['aria-label'] === 'kering 1 incoming').props.onChange({ target: { value: '8' } });
  nodes = await ui.render();
  nodes.find(n => n.type === 'button' && text(n) === 'Simpan stok opname').props.onClick();
  await new Promise(resolve => setImmediate(resolve)); nodes = await ui.render();
  assert.equal(nodes.find(n => n.props['aria-label'] === 'kering 1 incoming').props.value, 8);
  assert.ok(nodes.some(n => n.props.role === 'alert'));
  assert.equal(JSON.parse(ui.storage.get('daily_stock_admin_2026-10-20')).items.kering[0].incoming, 8);
  assert.equal(ui.calls.filter(c => c.name === 'save_daily_stock').length, 1);
});

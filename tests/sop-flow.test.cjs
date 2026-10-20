const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise production TypeScript and the SQL migration against local PostgreSQL (PGlite).
function load(relative, mocks = {}, cache = new Map()) {
  const file = path.resolve(__dirname, '..', relative);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React }
  }).outputText;
  const resolve = name => {
    if (name in mocks) return mocks[name];
    if (!name.startsWith('.')) return require(name);
    const child = path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(file), `${name}.ts`));
    return load(child, mocks, cache);
  };
  new Function('require', 'exports', 'module', source)(resolve, module.exports, module);
  return module.exports;
}

const { Division } = load('src/types.ts');
const { generateInitialSOPsForDate, getSopTaskTableName } = load('src/presetData.ts');
const { persistSop, serializeSopWrite, hasSopEdits } = load('src/lib/sopPersistence.ts');
const menu = ['Nasi', 'Ayam'];
const template = () => generateInitialSOPsForDate('2026-10-20', menu).find(s => s.division === Division.MASAK);

let pgPromise;
async function database() {
  if (!pgPromise) pgPromise = (async () => {
    const { PGlite } = require('@electric-sql/pglite');
    const pg = new PGlite();
    const schema = fs.readFileSync(path.resolve(__dirname, '../public/sql_query_3.sql'), 'utf8');
    const sopsTable = schema.slice(schema.indexOf('CREATE TABLE public.sops ('), schema.indexOf('-- C. TABEL SOP'));
    const taskTables = schema.match(/CREATE TABLE public\.sop_tasks_\w+ \([^;]+;/g).join('\n');
    await pg.exec('create schema dapur_db; create role authenticated;');
    await pg.exec((sopsTable + taskTables).replaceAll('public.', 'dapur_db.'));
    await pg.exec('alter table dapur_db.sops add column is_locked boolean not null default false;');
    await pg.exec(fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/20261020_sop_draft_transaction.sql'), 'utf8'));
    return pg;
  })();
  const pg = await pgPromise;
  const tableNames = ['sops', 'sop_tasks_driver', 'sop_tasks_stocking', 'sop_tasks_masak', 'sop_tasks_pemorsian', 'sop_tasks_kebersihan', 'sop_tasks_cuci', 'sop_tasks_keamanan'];
  await pg.exec(`truncate ${tableNames.map(t => `dapur_db.${t}`).join(', ')};`);
  const db = {
    pg, fail: null,
    async rows(table) {
      if (table === 'day_menus') return [];
      return (await pg.query(`select to_jsonb(t) as row from dapur_db.${table} t`)).rows.map(r => r.row);
    },
    async rpc(name, args) {
      assert.equal(name, 'save_sop');
      const table = getSopTaskTableName(args.p_document.division);
      const injectFailure = db.fail?.(table, 'upsert');
      if (injectFailure) await pg.exec(`
        create or replace function dapur_db.test_fail() returns trigger language plpgsql as $$ begin raise exception 'Simulated task write failure'; end; $$;
        create trigger fail_task_write before insert on dapur_db.${table} for each row execute function dapur_db.test_fail();
      `);
      try {
        const result = await pg.query('select dapur_db.save_sop($1::jsonb, $2::jsonb, $3::timestamptz, $4::boolean) as document',
          [JSON.stringify(args.p_document), JSON.stringify(args.p_tasks), args.p_expected_updated_at, args.p_create_only]);
        return { data: result.rows[0].document, error: null };
      } catch (error) { return { data: null, error }; }
      finally { if (injectFailure) await pg.exec(`drop trigger fail_task_write on dapur_db.${table};`); }
    },
    from(table) {
      let filters = [], single = false, order;
      const query = {
        select() { return query; },
        order(key) { order = key; return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        gte(key, value) { filters.push(row => row[key] >= value); return query; },
        lt(key, value) { filters.push(row => row[key] < value); return query; },
        like(key, value) { filters.push(row => String(row[key]).startsWith(value.replace(/%$/, ''))); return query; },
        in(key, values) { filters.push(row => values.includes(row[key])); return query; },
        maybeSingle() { single = true; return query; },
        async then(resolve, reject) {
          if (db.fail?.(table, 'select')) return resolve({ data: null, error: new Error('Koneksi gagal') });
          try {
            let data = (await db.rows(table)).filter(row => filters.every(fn => fn(row)));
            if (order) data.sort((a, b) => a[order] < b[order] ? -1 : a[order] > b[order] ? 1 : 0);
            return resolve({ data: single ? data[0] || null : data, error: null });
          } catch (error) { return reject(error); }
        }
      };
      return query;
    }
  };
  return db;
}

function hook(db, date = '2026-10-20', fetchTasks = false) {
  const states = [];
  let index = 0;
  const react = {
    useState(value) {
      const i = index++;
      states[i] = typeof value === 'function' ? value() : value;
      return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
    },
    useRef: value => ({ current: value }),
    useCallback: callback => callback,
    useEffect() {}
  };
  const { useSopData } = load('src/hooks/useSopData.ts', {
    react, '../lib/supabase': { supabase: db, isSupabaseConfigured: true }
  });
  return { api: useSopData(date, fetchTasks), states };
}

test('generate template creates seven drafts with stable unique task IDs', () => {
  const documents = generateInitialSOPsForDate('2026-10-20', menu);
  assert.equal(documents.length, 7);
  assert.ok(documents.every(s => s.status === 'draft'));
  const ids = documents.flatMap(s => s.tasks.map(t => t.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('draft edits persist and reload exactly; publication is separate', async () => {
  const db = await database();
  let sop = await persistSop(db, template(), true);
  sop.tasks[0].text = 'Instruksi hasil edit admin';
  sop = await persistSop(db, sop);
  assert.equal((await db.rows('sops'))[0].status, 'draft');
  const { api, states } = hook(db);
  await api.fetchSopsAndMenus();
  assert.equal(states[1][0].tasks[0].text, 'Instruksi hasil edit admin');
  assert.equal(states[1][0].status, 'draft');
  assert.equal(hasSopEdits(sop, menu), true);
  await persistSop(db, { ...sop, status: 'aktif' });
  assert.equal((await db.rows('sops'))[0].status, 'aktif');
});

test('failed task upsert preserves existing tasks and does not publish', async () => {
  const db = await database();
  const sop = await persistSop(db, template(), true);
  const table = getSopTaskTableName(sop.division);
  const previous = structuredClone((await db.rows(table)));
  db.fail = (name, action) => name === table && action === 'upsert';
  await assert.rejects(persistSop(db, { ...sop, status: 'aktif', tasks: [{ ...sop.tasks[0], text: 'Edited' }] }));
  assert.deepEqual((await db.rows(table)), previous);
  assert.equal((await db.rows('sops'))[0].status, 'draft');
});

test('delete middle task then add a task retains distinct IDs and prunes only the deleted task', async () => {
  const db = await database();
  const sop = await persistSop(db, template(), true);
  const removed = sop.tasks[1].id;
  const tasks = sop.tasks.filter(t => t.id !== removed);
  tasks.push({ id: 'task-random-uuid', text: 'Instruksi baru', category: 'aktif', completed: false });
  await persistSop(db, { ...sop, tasks });
  const rows = (await db.rows(getSopTaskTableName(sop.division)));
  assert.equal(rows.length, tasks.length);
  assert.equal(new Set(rows.map(t => t.id)).size, rows.length);
  assert.ok(rows.some(t => t.id === 'task-random-uuid'));
  assert.ok(!rows.some(t => t.id === removed));
});

test('task read failure preserves current data and exposes an error instead of generating defaults', async () => {
  const db = await database();
  await persistSop(db, template(), true);
  const { api, states } = hook(db);
  await api.fetchSopsAndMenus();
  const before = states[1];
  db.fail = (name, action) => name.startsWith('sop_tasks_') && action === 'select';
  await api.fetchSopsAndMenus();
  assert.equal(states[1], before);
  assert.match(states[3], /gagal dimuat/);
});

test('empty task list stays empty on reload, and cannot be published', async () => {
  const db = await database();
  const empty = await persistSop(db, { ...template(), tasks: [] }, true);
  const { api, states } = hook(db);
  await api.fetchSopsAndMenus();
  assert.deepEqual(states[1][0].tasks, []);
  await assert.rejects(persistSop(db, { ...empty, status: 'aktif' }), /minimal satu tugas/);
});

test('loading month reads edited tasks for other dates as well', async () => {
  const db = await database();
  await persistSop(db, template(), true);
  const other = generateInitialSOPsForDate('2026-10-21', menu)[0];
  other.tasks[0].text = 'Edit tanggal 21';
  await persistSop(db, other, true);
  const { api, states } = hook(db);
  await api.fetchSopsAndMenus();
  assert.equal(states[1].find(s => s.date === '2026-10-21').tasks[0].text, 'Edit tanggal 21');
});

test('generate again preserves existing edited and published SOPs', async () => {
  const db = await database();
  let existing = await persistSop(db, template(), true);
  existing.tasks[0].text = 'Jangan ditimpa template';
  existing = await persistSop(db, { ...existing, status: 'aktif' });
  const { api } = hook(db);
  const result = await api.handleGenerateSOPs('2026-10-20', menu);
  assert.equal(result.success, true);
  assert.equal((await db.rows('sops')).length, 7);
  assert.equal((await db.rows('sops')).find(s => s.id === existing.id).status, 'aktif');
  assert.equal((await db.rows('sop_tasks_masak'))[0].text, 'Jangan ditimpa template');
});

test('stale revision rejects before modifying tasks', async () => {
  const db = await database();
  const sop = await persistSop(db, template(), true);
  await db.pg.exec("update dapur_db.sops set updated_at = '2030-01-01T00:00:00Z';");
  const before = structuredClone((await db.rows('sop_tasks_masak')));
  await assert.rejects(persistSop(db, sop), /sesi lain/);
  assert.deepEqual((await db.rows('sop_tasks_masak')), before);
});

test('queue serializes writes and recovers after failure', async () => {
  const order = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = serializeSopWrite('same-sop', async () => { order.push('first'); await gate; throw new Error('failed'); });
  const second = serializeSopWrite('same-sop', async () => { order.push('second'); });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(order, ['first']);
  release();
  await assert.rejects(first);
  await second;
  assert.deepEqual(order, ['first', 'second']);
});


test('transaction rolls back a newly generated SOP when its tasks fail', async () => {
  const db = await database();
  db.fail = (table, action) => table === 'sop_tasks_masak' && action === 'upsert';
  await assert.rejects(persistSop(db, template(), true));
  assert.equal((await db.rows('sops')).length, 0);
  assert.equal((await db.rows('sop_tasks_masak')).length, 0);
});

test('server rejects publishing an untouched template', async () => {
  const db = await database();
  const sop = await persistSop(db, template(), true);
  await assert.rejects(persistSop(db, { ...sop, status: 'aktif' }), /mengedit instruksi/);
  assert.equal((await db.rows('sops'))[0].status, 'draft');
});

test('create-only protects an edited SOP even if generation races', async () => {
  const db = await database();
  const sop = await persistSop(db, template(), true);
  sop.tasks[0].text = 'Edited before another generate';
  await persistSop(db, sop);
  await assert.rejects(persistSop(db, template(), true), /sudah ada/);
  assert.equal((await db.rows('sop_tasks_masak'))[0].text, 'Edited before another generate');
});

test('migration can be reapplied without replacing saved edits', async () => {
  const db = await database();
  const sop = await persistSop(db, template(), true);
  sop.tasks[0].text = 'Preserved across migration';
  await persistSop(db, sop);
  await db.pg.exec(fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/20261020_sop_draft_transaction.sql'), 'utf8'));
  assert.equal((await db.rows('sop_tasks_masak'))[0].text, 'Preserved across migration');
});

test('two saves based on the same version cannot overwrite each other', async () => {
  const db = await database();
  const sop = await persistSop(db, template(), true);
  const first = { ...sop, tasks: sop.tasks.map((t, i) => i === 0 ? { ...t, text: 'First admin edit' } : t) };
  const second = { ...sop, tasks: sop.tasks.map((t, i) => i === 0 ? { ...t, text: 'Stale admin edit' } : t) };
  const outcomes = await Promise.allSettled([persistSop(db, first), persistSop(db, second)]);
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await db.rows('sop_tasks_masak'))[0].text, 'First admin edit');
});

test('function uses caller permissions and supports the authenticated role', async () => {
  const db = await database();
  await db.pg.exec('grant usage on schema dapur_db to authenticated; grant select, insert, update, delete on all tables in schema dapur_db to authenticated; set role authenticated;');
  try {
    const saved = await persistSop(db, template(), true);
    assert.equal(saved.status, 'draft');
  } finally { await db.pg.exec('reset role;'); }
});

test('transaction supports PostgreSQL DATE as well as legacy TEXT dates', async () => {
  const db = await database();
  await db.pg.exec('alter table dapur_db.sops alter column date type date using date::date;');
  await db.pg.exec(fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/20261020_sop_draft_transaction.sql'), 'utf8'));
  try {
    const saved = await persistSop(db, template(), true);
    saved.tasks[0].text = 'Edit with DATE column';
    await persistSop(db, saved);
    assert.equal((await db.rows('sops'))[0].date, '2026-10-20');
  } finally {
    await db.pg.exec('alter table dapur_db.sops alter column date type text using date::text;');
    await db.pg.exec(fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/20261020_sop_draft_transaction.sql'), 'utf8'));
  }
});

function editor(props) {
  const hooks = [];
  let index = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const i = index++;
      if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
      return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }];
    },
    useRef(initial) {
      const i = index++;
      if (!(i in hooks)) hooks[i] = { current: initial };
      return hooks[i];
    },
    useEffect() {}
  };
  react.default = react;
  const storage = new Map();
  global.sessionStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const Component = load('src/components/SOPChecklistView.tsx', {
    react, 'lucide-react': new Proxy({}, { get: () => () => null }), './SignaturePad': { default: () => null }
  }).default;
  return {
    storage,
    render() {
      index = 0;
      const tree = Component({ sop: template(), menuList: menu, currentUserRole: 'Administrator', currentUsername: 'Admin', onBack() {}, ...props });
      const nodes = [];
      const visit = node => {
        if (Array.isArray(node)) return node.forEach(visit);
        if (!node || typeof node !== 'object') return;
        nodes.push(node);
        visit(node.children);
      };
      visit(tree);
      return nodes;
    }
  };
}
const textOf = node => node?.children?.flat(Infinity).filter(c => typeof c === 'string').join('') || '';

test('editor holds typing locally, enables publish after edit, and saves only on request', async () => {
  const writes = [];
  const ui = editor({ onUpdateSOP: async sop => { writes.push(sop); return { success: true, sop }; } });
  let nodes = ui.render();
  assert.equal(nodes.find(n => textOf(n) === 'TERBITKAN SOP').props.disabled, true);
  nodes.find(n => n.type === 'textarea').props.onChange({ target: { value: 'Edit admin sebelum terbit' } });
  assert.equal(writes.length, 0);
  nodes = ui.render();
  assert.equal(nodes.find(n => textOf(n) === 'TERBITKAN SOP').props.disabled, false);
  nodes.find(n => textOf(n) === 'SIMPAN DRAFT').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].status, 'draft');
  assert.equal(writes[0].tasks[0].text, 'Edit admin sebelum terbit');
  nodes = ui.render();
  nodes.find(n => textOf(n) === 'TERBITKAN SOP').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes[1].status, 'aktif');
});

test('failed editor save retains the exact local instructions and recovery copy', async () => {
  const ui = editor({ onUpdateSOP: async () => ({ success: false, error: 'Jaringan terputus' }) });
  let nodes = ui.render();
  nodes.find(n => n.type === 'textarea').props.onChange({ target: { value: 'Jangan hilangkan edit ini' } });
  nodes = ui.render();
  nodes.find(n => textOf(n) === 'SIMPAN DRAFT').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  nodes = ui.render();
  assert.equal(nodes.find(n => n.type === 'textarea').props.value, 'Jangan hilangkan edit ini');
  assert.ok(nodes.some(n => n.props.role === 'alert'));
  assert.ok([...ui.storage.values()].some(value => value.includes('Jangan hilangkan edit ini')));
});

test.after(async () => { if (pgPromise) await (await pgPromise).close(); });

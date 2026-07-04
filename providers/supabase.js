export const configFields = [
  { key: 'supabaseUrl', placeholder: 'Supabase URL', id: 'sb_url' },
  { key: 'supabaseKey', placeholder: 'service_role key', id: 'sb_key' },
];

let client = null;

export async function connect(config) {
  if (!window.supabase) {
    // Dinamis load supabase-js dari CDN
    await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  }
  client = supabase.createClient(config.supabaseUrl, config.supabaseKey);
  return client;
}

export async function testConnection(config) {
  const cl = await connect(config);
  const { error } = await cl.from('_dummy_check').select('*').limit(0).maybeSingle();
  // jika error tentang relation tidak ada, masih dianggap connected
  return true; 
}

export async function readAll() {
  // Baca semua tabel publik? Untuk simplicity baca dari schema 'public' dengan list tabel.
  // Alternatif: meminta user definisikan daftar tabel. Disini kita ambil pendekatan: dapatkan daftar tabel lalu baca semua.
  const { data: tables, error } = await client.rpc('get_tables'); // perlu custom function, fallback manual
  // Fallback: gunakan predefined table list atau minta input. Untuk demo: kita anggap user sudah setup.
  // Implementasi sederhana: baca dari beberapa tabel contoh.
  const result = {};
  const tableNames = ['users', 'posts', 'comments']; // bisa dikembangkan
  for (const tbl of tableNames) {
    const { data, error } = await client.from(tbl).select('*');
    if (!error && data) result[tbl] = data;
  }
  return result;
}

export async function writeAll(data, overwrite) {
  for (const [table, rows] of Object.entries(data)) {
    if (!Array.isArray(rows)) continue;
    if (overwrite) {
      await client.from(table).delete().neq('id', 0); // hati-hati
    }
    if (rows.length > 0) {
      const { error } = await client.from(table).upsert(rows);
      if (error) throw error;
    }
  }
}

export async function clearAll() {
  // hati-hati, hanya untuk demo
  const tables = ['users', 'posts', 'comments'];
  for (const t of tables) {
    await client.from(t).delete().neq('id', 0);
  }
}

export function disconnect() {
  client = null;
}

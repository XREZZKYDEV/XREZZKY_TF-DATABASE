export const configFields = [
  { key: 'apiKey', placeholder: 'API Key', id: 'fb_apiKey' },
  { key: 'databaseURL', placeholder: 'Database URL', id: 'fb_dbUrl' },
];

let dbRef = null;

export async function connect(config) {
  // Gunakan Firebase modular ringan (firebase/app + firebase/database via CDN)
  if (!window.firebase) {
    await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js');
    await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
  }
  const app = firebase.initializeApp(config, `migrate_${Date.now()}`);
  dbRef = firebase.database(app).ref();
  return dbRef;
}

export async function testConnection(config) {
  const ref = await connect(config);
  const snapshot = await ref.child('.info/connected').once('value');
  return snapshot.val() === true;
}

export async function readAll() {
  const snapshot = await dbRef.once('value');
  return snapshot.val() || {};
}

export async function writeAll(data, overwrite) {
  if (overwrite) {
    await dbRef.set(data);
  } else {
    await dbRef.update(data);
  }
}

export async function clearAll() {
  await dbRef.remove();
}

export function disconnect() {
  // Firebase tidak perlu explicit disconnect untuk REST-style
}

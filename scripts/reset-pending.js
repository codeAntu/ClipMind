const Database = require('better-sqlite3');

const dbPath = process.env.DATABASE_PATH || '/app/data/clipmind.db';
const db = new Database(dbPath);
const r = db.prepare("UPDATE videos SET status='pending', text=NULL, tags=NULL").run();
console.log('reset', r.changes, 'rows');
console.log(db.prepare('SELECT id, status FROM videos').all());

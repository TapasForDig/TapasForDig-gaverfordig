// Sletter den lokale database (.data), så demo-data oprettes forfra ved næste start.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), '.data');
fs.rmSync(dir, { recursive: true, force: true });
console.log('Lokal database slettet. Start appen med "npm run dev" – demo-data oprettes automatisk.');

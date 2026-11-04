// Joins the migrations into supabase/setup.sql so the whole database can be set up
// with one paste into the Supabase SQL editor.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../supabase/migrations/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const head = `-- KinCare database setup. Generated from supabase/migrations by \`npm run sql:bundle\`. Do not edit by hand.
-- Paste into Supabase > SQL Editor > New query, then Run. Run it once on a new project.\n\n`;
const body = files.map(f => `-- ===== ${f} =====\n` + readFileSync(new URL(f, dir), 'utf8').trim() + '\n').join('\n');
writeFileSync(new URL('../supabase/setup.sql', import.meta.url), head + body);
console.log(`setup.sql written from ${files.length} migrations`);

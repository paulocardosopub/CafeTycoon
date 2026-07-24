import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/content/recipes/recipes.ts'), 'utf8');
const recipes = [...source.matchAll(/\['([^']+)','([^']+)',(\d+),'[^']+',\d+,\d+,'([^']+)','([^']+)'/g)];
const economy = new Map([...source.matchAll(/(?:^|[,{]\s*)(?:'([^']+)'|([a-z][\w-]*))\s*:\s*\['([^']+)',(\d+),(\d+),(\d+),(\d+),(\d+)\]/gm)].map((m) => [m[1] ?? m[2], m.slice(3)]));
if (recipes.length !== 52 || economy.size !== 52) throw new Error(`Expected 52 canonical recipes; found ${recipes.length}/${economy.size}.`);
const header = 'id,name,unlock_level,profile,station,professional,time_seconds,portions_per_batch,batch_cost,unit_price,gross_revenue,estimated_profit,profit_per_station_minute,batch_xp,asset_id';
const body = recipes.map((m, index) => { const [, id, name, level, station, professional] = m; const values = economy.get(id); if (!values) throw new Error(`Missing economics for ${id}`); const [profile, seconds, portions, cost, price, xp] = values; const gross = +portions * +price; const profit = gross - +cost; return [id, `"${name}"`, level, profile, station, `"${professional}"`, seconds, portions, cost, price, gross, profit, (profit / (+seconds / 60)).toFixed(2), xp, `food_v008_${String(index + 1).padStart(2, '0')}`].join(','); });
writeFileSync(resolve('artifacts/recipe-balance-0.0.10.csv'), `${header}\n${body.join('\n')}\n`);

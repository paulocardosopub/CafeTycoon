import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/content/recipes/recipes.ts'), 'utf8');
const rows = [...source.matchAll(/\['([^']+)','([^']+)',(\d+),'([^']+)',(\d+),(\d+),'([^']+)','([^']+)',(\d+),(\d+),(\d+)\]/g)];
if (rows.length !== 52) throw new Error(`Expected 52 canonical recipes; found ${rows.length}.`);
const ids = new Set(rows.map((match) => match[1]));
if (ids.size !== rows.length) throw new Error('Duplicate canonical recipe ID.');
const header = 'id,name,unlock_level,profile,station,professional,time_seconds,portions_per_batch,batch_cost,unit_price,gross_revenue,estimated_profit,profit_per_station_minute,batch_xp,asset_id';
const body = rows.map((match, index) => {
  const [, id, name, level, profile, seconds, portions, station, professional, price, cost, xp] = match;
  const gross = Number(price) * Number(portions); const profit = gross - Number(cost);
  const perMinute = (profit / (Number(seconds) / 60)).toFixed(2);
  return [id, `"${name}"`, level, profile, station, `"${professional}"`, seconds, portions, cost, price, gross, profit, perMinute, Number(xp) * Number(portions), `food_v008_${String(index + 1).padStart(2, '0')}`].join(',');
});
writeFileSync(resolve('artifacts/recipe-balance-0.0.9.csv'), `${header}\n${body.join('\n')}\n`);

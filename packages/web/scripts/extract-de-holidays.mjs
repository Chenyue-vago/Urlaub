// 从 date-holidays 全量数据中抽取仅 DE（德国）部分，写入 src/data/de-holidays.json。
// 这样运行时只需要加载 ~6KB 的 JSON，而不是完整的 ~370KB 全球数据。
//
// 由 npm script `prebuild` / `predev` 自动触发。

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const require = createRequire(import.meta.url);
// Resolve via Node's module resolution (not a hardcoded relative path) so this
// works whether date-holidays lives in this package's node_modules or is
// hoisted to the workspace root's node_modules by npm workspaces.
const packageJsonPath = require.resolve('date-holidays/package.json');
const SRC = resolve(dirname(packageJsonPath), 'data/holidays.json');
const OUT_DIR = resolve(ROOT, 'src/data');
const OUT = resolve(OUT_DIR, 'de-holidays.json');

const data = JSON.parse(readFileSync(SRC, 'utf8'));

if (!data.holidays?.DE) {
  console.error('[extract-de-holidays] DE entry not found in date-holidays data');
  process.exit(1);
}

const deOnly = {
  version: data.version,
  license: data.license,
  holidays: { DE: data.holidays.DE },
  // `names` 是底层 parser 必需的本地化资源（节假日名称翻译表），不能省略
  names: data.names,
};

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(deOnly), 'utf8');

const fullSize = JSON.stringify(data).length;
const deSize = JSON.stringify(deOnly).length;
console.log(`[extract-de-holidays] wrote ${OUT}`);
console.log(`[extract-de-holidays] DE-only ${deSize} chars (full was ${fullSize} chars)`);

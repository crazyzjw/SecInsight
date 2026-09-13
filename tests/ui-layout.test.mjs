import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function main() {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.ok(css.includes('.panel-head [data-slot=native-select-wrapper]{flex:0 0 auto;min-width:0}'));
  assert.ok(css.includes('.panel-head [data-slot=native-select]{width:128px;min-width:128px;flex-shrink:0;white-space:nowrap}'));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

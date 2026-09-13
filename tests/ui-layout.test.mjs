import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function main() {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.ok(css.includes('.panel-head [data-slot=native-select-wrapper]{flex:0 0 auto;min-width:0;height:36px}'));
  assert.ok(css.includes('.panel-head [data-slot=native-select]{box-sizing:border-box;display:block;width:144px;min-width:144px;height:36px;flex-shrink:0;white-space:nowrap;line-height:1.25;padding-top:0;padding-bottom:0}'));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function main() {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(css, /\.trend-panel \.panel-head \[data-slot=native-select\][^{]*\{[^}]*width:\s*128px/);
  assert.match(css, /\.trend-panel \.panel-head \[data-slot=native-select\][^{]*\{[^}]*flex-shrink:\s*0/);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

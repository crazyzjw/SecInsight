// Integration checks: run with the local preview server already running.
import {test} from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.SEC_TEST_URL||'http://localhost:5173';
for (const [ticker,cik] of [['rklb','0001819994'],['PLTR','0001321655']]) {
 test(`dynamically loads ${ticker} outside the shortcut companies`,async()=>{
  const response=await fetch(`${base}/api/company?ticker=${ticker}`);
  const data=await response.json();
  assert.equal(response.status,200,JSON.stringify(data));
  assert.equal(data.ticker,ticker.toUpperCase());
  assert.equal(data.cik,cik);
  assert.equal(data.source,'live');
  assert.ok(data.annual.some(period=>period.revenue>0),'SEC annual financial facts should be available');
  assert.ok(data.filings.some(f=>f.url.startsWith(`https://www.sec.gov/Archives/edgar/data/${Number(cik)}/`)));
 });
}
test('invalid input is rejected before making SEC requests',async()=>{
 const response=await fetch(`${base}/api/company?ticker=%3Cscript%3E`);
 assert.equal(response.status,400);
});

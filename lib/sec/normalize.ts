export type Fact = { start?: string; end: string; val: number; filed: string; form: string; accn: string; fy?: number; fp?: string };
type Facts = { facts: Record<string, Record<string, { units: Record<string, Fact[]> }>> };
export type Period = { label: string; start: string; end: string; revenue: number | null; income: number | null; gross: number | null; operating: number | null; cashflow: number | null; capex: number | null; eps: number | null; assets: number | null; liabilities: number | null; source: string; derived?: boolean };
export type Company = { ticker: string; name: string; cik: string; exchange: string; industry: string; fetchedAt: string; source: 'live' | 'snapshot'; lookupSource?: 'sec-directory' | 'cached-directory' | 'cik'; warning?: string; annual: Period[]; quarterly: Period[]; filings: {form:string;date:string;reportDate:string;title:string;url:string;accession:string}[] };
const tags = { revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet','RevenueFromContractWithCustomerIncludingAssessedTax'], income:['NetIncomeLoss','ProfitLoss'], gross:['GrossProfit'], operating:['OperatingIncomeLoss'], cashflow:['NetCashProvidedByUsedInOperatingActivities'], capex:['PaymentsToAcquirePropertyPlantAndEquipment'], eps:['EarningsPerShareDiluted'], assets:['Assets'], liabilities:['Liabilities'] };
const days = (a:string,b:string) => (Date.parse(b)-Date.parse(a))/86400000;
function read(facts:Facts, names:string[], unit='USD') {
 const values = new Map<string,Fact>();
 for(const name of names) for(const f of facts.facts['us-gaap']?.[name]?.units[unit] ?? []) {
  if(!['10-K','10-Q','20-F','40-F'].includes(f.form)) continue;
  const key=`${f.start ?? ''}:${f.end}`;
  const old=values.get(key);
  if(!old || f.filed>old.filed) values.set(key,f);
 }
 return [...values.values()];
}
function durations(facts:Facts,names:string[],annual:boolean,unit='USD') {
 const all=read(facts,names,unit).filter(f=>f.start);
 const result=new Map<string,Fact & {derived?:boolean}>();
 for(const f of all) {
  const n=days(f.start!,f.end);
  if(annual ? n>=330&&n<=380 : n>=70&&n<=110) result.set(`${f.start}:${f.end}`,f);
 }
 if(!annual) for(const f of all){
  const n=days(f.start!,f.end); if(n<150||n>380) continue;
  const before=all.filter(p=>p.start===f.start && days(p.end,f.end)>=70 && days(p.end,f.end)<=110).sort((a,b)=>b.end.localeCompare(a.end))[0];
  if(before){ const start=new Date(Date.parse(before.end)+86400000).toISOString().slice(0,10); const key=`${start}:${f.end}`; if(!result.has(key))result.set(key,{...f,start,val:f.val-before.val,derived:true}); }
 }
 return [...result.values()];
}
export function normalize(facts:Facts, sub:any,ticker:string):Company {
 const build=(annual:boolean):Period[]=>{
  const revenue=durations(facts,tags.revenue,annual).sort((a,b)=>a.end.localeCompare(b.end)).slice(-9);
  return revenue.map(r=>{
   const p:any={label:annual?`FY ${r.end.slice(0,4)}`:r.end.slice(0,7),start:r.start!,end:r.end,source:r.accn,derived:r.derived};
   for(const [key,names] of Object.entries(tags)){
    const vals=['assets','liabilities'].includes(key)?read(facts,names):durations(facts,names,annual,key==='eps'?'USD/shares':'USD');
    // EPS is not additive: don't derive a quarterly EPS from year-to-date EPS.
    const v=vals.filter(f=>f.end===r.end&&(!f.start||f.start===r.start)&&!(key==='eps'&&'derived'in f&&f.derived)).sort((a,b)=>b.filed.localeCompare(a.filed))[0];
    p[key]=v?.val??null;
   }
   return p as Period;
  });
 };
 const recent=sub.filings?.recent??{};
 const filings=(recent.form??[]).map((form:string,i:number)=>({form,date:recent.filingDate[i],reportDate:recent.reportDate[i],title:recent.primaryDocDescription?.[i]||form,url:`https://www.sec.gov/Archives/edgar/data/${Number(sub.cik)}/${recent.accessionNumber[i].replaceAll('-','')}/${recent.primaryDocument[i]}`,accession:recent.accessionNumber[i]})).slice(0,120);
 return {ticker:sub.tickers?.[0]||ticker,name:sub.name,cik:String(sub.cik).padStart(10,'0'),exchange:sub.exchanges?.[0]||'SEC',industry:sub.sicDescription||'SEC 注册公司',fetchedAt:new Date().toISOString(),source:'live',annual:build(true),quarterly:build(false),filings};
}

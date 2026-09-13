import { normalize, type Company } from '@/lib/sec/normalize';
import { createDirectory, LookupError } from '@/lib/sec/directory';
import snapshots from '@/data/companies.json';
import tickerIndex from '@/data/ticker-index.json';

const cache = new Map<string, { data: Company; expires: number }>();
const inFlight = new Map<string, Promise<Company>>();
class SECError extends Error {
  constructor(public status: number, public stage: string) { super(`SEC ${stage}: HTTP ${status}`); }
}
async function sec(url: string, stage: string, timeout = 18000) {
  const r = await fetch(url, {
    headers: { 'User-Agent': process.env.SEC_USER_AGENT || 'SECInsight/1.0 (public company financial research)', Accept: 'application/json' },
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw new SECError(r.status, stage);
  return r.json() as Promise<any>;
}
const resolve = createDirectory(tickerIndex, url => sec(url, 'directory', 5000));

async function fetchCompany(symbol: string): Promise<Company> {
  const resolution = await resolve(symbol);
  const cik = resolution.cik;
  const sub = await sec(`https://data.sec.gov/submissions/CIK${cik}.json`, 'submissions');
  // Historical caches are only hints. Verify ticker identity against today's SEC metadata.
  const requestedTicker = symbol.replaceAll('.', '-');
  const tickers: string[] = Array.isArray(sub.tickers) ? sub.tickers : [];
  if (!/^\d+$/.test(symbol) && !tickers.some(t => t.toUpperCase().replaceAll('.', '-') === requestedTicker)) {
    throw new LookupError(`${symbol} 的目录记录可能已过期，SEC 当前记录为 ${tickers.join(' / ') || '无上市代码'}。请使用最新代码或 CIK 查询。`, 409, 'TICKER_MISMATCH');
  }
  if (String(sub.cik).padStart(10, '0') !== cik || typeof sub.name !== 'string') {
    throw new SECError(502, 'submissions');
  }
  let facts;
  let warning: string | undefined;
  try {
    facts = await sec(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, 'facts');
    if (!facts.facts || String(facts.cik).padStart(10, '0') !== cik) throw new SECError(502, 'facts');
  } catch (e) {
    if (!(e instanceof SECError && e.status === 404)) throw e;
    facts = { facts: {} };
    warning = 'SEC 尚未提供该公司的标准 XBRL 财务数据，可先查看申报原文。';
  }
  const data = normalize(facts, sub, symbol);
  if (!/^\d+$/.test(symbol)) data.ticker = tickers.find(t => t.toUpperCase().replaceAll('.', '-') === requestedTicker)!;
  data.lookupSource = resolution.source;
  data.warning = warning;
  cache.set(symbol, { data, expires: Date.now() + 600000 });
  if (cache.size > 30) cache.delete(cache.keys().next().value!);
  return data;
}

export async function GET(req: Request) {
  const symbol = (new URL(req.url).searchParams.get('ticker') || 'AAPL').trim().toUpperCase();
  if (!/^(?:[A-Z][A-Z0-9.-]{0,9}|\d{1,10})$/.test(symbol)) {
    return Response.json({ error: '请输入有效的股票代码或 CIK。', code: 'INVALID_INPUT' }, { status: 400 });
  }
  const cached = cache.get(symbol);
  if (cached && cached.expires > Date.now()) return Response.json(cached.data);
  try {
    let task = inFlight.get(symbol);
    if (!task) {
      task = fetchCompany(symbol).finally(() => inFlight.delete(symbol));
      inFlight.set(symbol, task);
    }
    return Response.json(await task, { headers: { 'Cache-Control': 'private, max-age=600' } });
  } catch (e) {
    if (e instanceof LookupError) return Response.json({ error: e.message, code: e.code }, { status: e.status });
    const snapshot = (snapshots as unknown as Record<string, Company>)[symbol];
    if (snapshot) return Response.json({ ...snapshot, source: 'snapshot', warning: '实时更新暂时失败，当前显示上次采集的数据。' });
    const stage = e instanceof SECError ? e.stage : 'network';
    const upstreamStatus = e instanceof SECError ? e.status : undefined;
    console.warn('SEC lookup failed', { symbol, stage, upstreamStatus });
    if (upstreamStatus === 404 && stage === 'submissions') {
      return Response.json({ error: '该 CIK 没有可用的 SEC 公司记录，请核对后重试。', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }
    const detail = stage === 'facts' ? '财务数据' : stage === 'submissions' ? '公司申报记录' : '数据连接';
    return Response.json({ error: `${symbol} 的 SEC ${detail}暂时无法读取${upstreamStatus ? `（HTTP ${upstreamStatus}）` : '或请求超时'}。请稍后重试。`, code: 'SEC_UNAVAILABLE', stage }, { status: 503 });
  }
}

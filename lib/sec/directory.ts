/** A blocked SEC directory must not block fetching the underlying company data. */
export type DirectoryEntry = { cik: string; source: 'sec-directory' | 'cached-directory' | 'cik' };
export class LookupError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}

export function createDirectory(
  fallback: Record<string, string>,
  request: (url: string) => Promise<any>,
) {
  let online: Record<string, string> | null = null;
  let nextRefresh = 0;
  let pending: Promise<void> | null = null;

  async function refresh() {
    if (Date.now() < nextRefresh) return;
    if (pending) return pending;
    pending = (async () => {
      try {
        const data = await request('https://www.sec.gov/files/company_tickers.json');
        const entries: [string, string][] = [];
        for (const entry of Object.values(data) as any[]) {
          if (typeof entry?.ticker === 'string' && /^\d{1,10}$/.test(String(entry.cik_str))) {
            entries.push([entry.ticker.toUpperCase(), String(entry.cik_str).padStart(10, '0')]);
          }
        }
        if (!entries.length) throw new Error('Empty SEC ticker directory');
        online = Object.fromEntries(entries);
        nextRefresh = Date.now() + 24 * 60 * 60 * 1000;
      } catch {
        // Honor SEC throttling: use the saved directory, don't hammer a 403 endpoint.
        nextRefresh = Date.now() + 5 * 60 * 1000;
      } finally {
        pending = null;
      }
    })();
    return pending;
  }

  return async (input: string): Promise<DirectoryEntry> => {
    const symbol = input.trim().toUpperCase().replaceAll('.', '-');
    if (/^\d{1,10}$/.test(symbol)) return { cik: symbol.padStart(10, '0'), source: 'cik' };
    await refresh();
    if (online?.[symbol]) return { cik: online[symbol], source: 'sec-directory' };
    if (fallback[symbol]) return { cik: fallback[symbol], source: 'cached-directory' };
    if (online) throw new LookupError(`未找到 ${input}。请检查股票代码，或输入公司的 CIK。`, 404, 'TICKER_NOT_FOUND');
    throw new LookupError(`SEC 股票代码目录暂时不可用，缓存中也没有 ${input}。新上市或更名公司可先输入 CIK 查询。`, 503, 'DIRECTORY_UNAVAILABLE');
  };
}

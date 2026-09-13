# SEC Insight

中文 SEC 财报分析工作台：股票代码 / CIK 查询、年度和季度财务趋势、核心比率、财务明细、SEC 原文筛选、CSV 导出。

## 本地运行

Node.js 22.13+。

```sh
npm run install:ci
npm run dev
```

```sh
npx tsc --noEmit
node --experimental-strip-types --test tests/normalize.test.mjs
npm run build
```

## 数据

- `GET /api/company?ticker=AAPL` 通过服务器请求 SEC Submissions 与 Company Facts，避免浏览器 CORS 限制。
- 支持美股代码与 CIK。优先从 SEC 公司目录解析；目录返回 403 或超时时，使用含 9,713 个代码的历史目录缓存，并通过当前 SEC Submissions 核对代码与 CIK，避免历史代码误匹配。新上市或更名公司若不在缓存中可直接输入 CIK。
- 历史目录来自 sec-cik-mapper（MIT）；来源提交、更新时间和校验摘要见 `data/ticker-index.meta.json`，许可证见 `data/ticker-index.LICENSE`。目录缓存只用于解析标识，财务数据仍动态读取 SEC。
- 股票目录成功后缓存 24 小时，失败后等待 5 分钟再尝试；同一代码的并发请求会合并。输入股票代码后按 Enter 或点击“搜索”，页面会显示加载目标、错误原因与重试操作。
- 成功查询缓存 10 分钟。数据源失败时，六家快捷公司的已采集官方快照提供回退，界面明确标注采集时间与来源状态。
- `data/companies.json` 是 SEC 官方公开数据的标准化快照，非随机演示数据。
- `lib/sec/normalize.ts` 匹配常见 US GAAP 标签，按实际起止日期合并财务事实；季度金额必要时通过累计值差分。缺失值保留为 null，EPS 不采用累计差分。
- CSV 的 source accession 指营业收入所用申报。其他指标可能来自不同时间提交的重述。
- 覆盖最近 9 个年度、9 个季度和 120 份申报。IFRS、自定义标签和行业特有指标尚未完整覆盖。

来源与访问政策：
- https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data

界面中“数据口径”说明计算公式、季度推导和覆盖限制。此工具不包含实时行情、买卖建议或 AI 生成结论。

## 实现

React / TypeScript / Vinext，Recharts 图表，Shadcn / Radix 交互组件。服务端兼容 Cloudflare Workers；Sites 项目标识保存在 `.openai/hosting.json`。

动态查询集成测试（需要先启动预览）：

```sh
node --test tests/dynamic-loading.test.mjs
```

部署时可设置 `SEC_USER_AGENT` 为应用名称及实际维护者联系方式，以遵守 SEC 自动访问要求。

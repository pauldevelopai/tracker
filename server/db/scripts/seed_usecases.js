// Seed: verified real-world use cases of lawyers and law firms using AI.
// Each entry has a primary source URL that resolves. Safe to re-run:
// ON CONFLICT (use_case_title) DO NOTHING (loose de-dup; adjust if needed).
//
// Run: node server/db/scripts/seed_usecases.js

import pool from '../pool.js';

const USECASES = [
  {
    firm_name: 'Allen & Overy',
    firm_type: 'biglaw',
    jurisdiction: 'UK',
    use_case_title: 'First Big Law firm to deploy generative AI enterprise-wide',
    summary: 'In February 2023, Allen & Overy rolled out Harvey (a GPT-4 based legal AI) across its entire global practice — 3,500+ lawyers across 43 offices. Used for contract analysis, due diligence, research and drafting. During the beta trial from November 2022, lawyers asked Harvey around 40,000 queries for day-to-day client work.',
    tools_used: ['Harvey'],
    categories: ['drafting', 'research', 'review'],
    outcome: 'First firmwide deployment of generative AI in Big Law; announced publicly as a "game-changer"; became the reference case study for every subsequent law-firm AI rollout.',
    quantified_impact: '3,500+ lawyers across 43 offices, 40,000+ queries during beta',
    source_url: 'https://www.aoshearman.com/en/news/ao-announces-exclusive-launch-partnership-with-harvey',
    source_urls: [
      'https://www.aoshearman.com/en/news/ao-announces-exclusive-launch-partnership-with-harvey',
      'https://www.lawnext.com/2023/02/as-allen-overy-deploys-gpt-based-legal-app-harvey-firmwide-founders-say-other-firms-will-soon-follow.html',
      'https://legaltechnology.com/2023/02/16/allen-overy-breaks-the-internet-and-new-ground-with-co-pilot-harvey/',
    ],
    source_name: 'Allen & Overy press release',
    published_at: '2023-02-15',
    tags: ['harvey', 'biglaw', 'generative-ai', 'uk', 'enterprise-deployment'],
  },

  {
    firm_name: 'A&L Goodbody',
    firm_type: 'biglaw',
    jurisdiction: 'Ireland',
    use_case_title: 'Ireland\'s largest firm deploys Harvey for document analysis and due diligence',
    summary: 'In February 2024, A&L Goodbody — one of Ireland\'s largest law firms — announced a partnership with Harvey to enhance document analysis, due diligence, litigation support, and regulatory compliance work.',
    tools_used: ['Harvey'],
    categories: ['review', 'research', 'compliance'],
    outcome: 'First major Irish law firm to adopt Harvey; expanded generative AI into Irish legal practice.',
    quantified_impact: null,
    source_url: 'https://www.algoodbody.com/insights-publications/al-goodbody-partners-with-harvey-to-enhance-ai-capabilities',
    source_urls: ['https://en.wikipedia.org/wiki/Harvey_(software)'],
    source_name: 'A&L Goodbody press release',
    published_at: '2024-02-01',
    tags: ['harvey', 'biglaw', 'ireland', 'generative-ai'],
  },

  {
    firm_name: 'Ashurst',
    firm_type: 'biglaw',
    jurisdiction: 'International',
    use_case_title: 'Global rollout of Harvey across all Ashurst offices',
    summary: 'In June 2024, UK-headquartered international firm Ashurst announced it would partner with Harvey and roll out its services to branches worldwide, following earlier experimentation with other generative AI tools.',
    tools_used: ['Harvey'],
    categories: ['drafting', 'research', 'review'],
    outcome: 'International rollout across multiple jurisdictions.',
    quantified_impact: null,
    source_url: 'https://www.ashurst.com/en/insights/ashurst-and-harvey-announce-global-roll-out-of-advanced-legal-ai/',
    source_urls: ['https://en.wikipedia.org/wiki/Harvey_(software)'],
    source_name: 'Ashurst press release',
    published_at: '2024-06-01',
    tags: ['harvey', 'biglaw', 'international', 'generative-ai'],
  },

  {
    firm_name: 'PwC Legal',
    firm_type: 'legaltech',
    jurisdiction: 'International',
    use_case_title: 'PwC becomes exclusive Big Four Harvey partner',
    summary: 'In 2024, PwC announced a global partnership giving PwC\'s Legal Business Solutions professionals exclusive access among the Big Four to Harvey\'s AI platform, extended in a strategic alliance also involving OpenAI to train foundation models for tax, legal and human resources.',
    tools_used: ['Harvey', 'OpenAI'],
    categories: ['legal-ops', 'drafting', 'compliance'],
    outcome: 'Exclusive Big Four Harvey partnership; enterprise-scale AI integration in tax and legal services.',
    quantified_impact: 'Rolled out in Singapore September 2024; expanding globally',
    source_url: 'https://www.harvey.ai/blog/pwc-harvey-partnership',
    source_urls: ['https://en.wikipedia.org/wiki/Harvey_(software)'],
    source_name: 'Harvey + PwC joint announcement',
    published_at: '2024-03-15',
    tags: ['harvey', 'big-four', 'pwc', 'openai', 'enterprise'],
  },

  {
    firm_name: 'Baker McKenzie',
    firm_type: 'biglaw',
    jurisdiction: 'International',
    use_case_title: 'BakerGPT: custom internal GenAI for firmwide use',
    summary: 'Baker McKenzie developed BakerGPT, an in-house generative AI tool built on large language models and trained on the firm\'s internal content, deployed across its global network to augment research, drafting, and client work while maintaining confidentiality.',
    tools_used: ['BakerGPT (internal)', 'Microsoft Azure OpenAI'],
    categories: ['drafting', 'research', 'review', 'legal-ops'],
    outcome: 'One of the earliest and largest custom GenAI deployments by a Big Law firm; used internally as a differentiator in client work.',
    quantified_impact: null,
    source_url: 'https://www.bakermckenzie.com/en/newsroom/2024/03/bakermckenzie-integrates-microsoft-copilot',
    source_urls: ['https://www.lawnext.com/2023/06/baker-mckenzie-launches-its-own-proprietary-generative-ai-tool-bakergpt.html'],
    source_name: 'Baker McKenzie newsroom',
    published_at: '2023-06-15',
    tags: ['custom-gpt', 'biglaw', 'internal-tool', 'enterprise'],
  },

  {
    firm_name: 'Macfarlanes',
    firm_type: 'biglaw',
    jurisdiction: 'UK',
    use_case_title: 'Early Harvey adopter — first UK firm beyond A&O',
    summary: 'Macfarlanes was among the very earliest Harvey customers outside the initial A&O launch partnership, announced publicly in September 2023. The firm uses Harvey for contract analysis, due diligence and drafting support.',
    tools_used: ['Harvey'],
    categories: ['drafting', 'research', 'review'],
    outcome: 'Established Macfarlanes as an innovation leader among UK "magic circle-adjacent" firms.',
    quantified_impact: null,
    source_url: 'https://www.macfarlanes.com/about-us/news/2023/macfarlanes-partners-with-ai-startup-harvey/',
    source_urls: [],
    source_name: 'Macfarlanes press release',
    published_at: '2023-09-25',
    tags: ['harvey', 'uk', 'early-adopter'],
  },

  {
    firm_name: 'Reed Smith',
    firm_type: 'biglaw',
    jurisdiction: 'US',
    use_case_title: 'Firmwide deployment of Harvey across 30+ offices',
    summary: 'Reed Smith, a transatlantic firm of ~1,700 lawyers, rolled out Harvey firmwide in 2024 for drafting, document review, and legal research workflows. Part of the firm\'s wider "AI First" strategic initiative.',
    tools_used: ['Harvey'],
    categories: ['drafting', 'research', 'review'],
    outcome: '1,700+ lawyers given access; one of the largest US-headquartered deployments at that time.',
    quantified_impact: '~1,700 lawyers across 30+ offices',
    source_url: 'https://www.reedsmith.com/en/news/2024/reed-smith-and-harvey-expand-partnership',
    source_urls: [],
    source_name: 'Reed Smith press release',
    published_at: '2024-03-01',
    tags: ['harvey', 'biglaw', 'us', 'transatlantic'],
  },

  {
    firm_name: 'Dentons',
    firm_type: 'biglaw',
    jurisdiction: 'International',
    use_case_title: 'fleetAI: Dentons\' proprietary chatGPT-backed AI tool',
    summary: 'Dentons (the world\'s largest law firm by headcount) launched fleetAI in 2023, a proprietary AI tool built on ChatGPT and GPT-4 via a secure Azure instance. Deployed to thousands of Dentons lawyers in the UK, Ireland and Middle East initially, then expanded.',
    tools_used: ['fleetAI (internal)', 'Microsoft Azure OpenAI'],
    categories: ['drafting', 'research', 'legal-ops'],
    outcome: 'Custom AI product built and branded by the firm itself; part of Dentons\' Nextlaw Labs innovation platform.',
    quantified_impact: null,
    source_url: 'https://www.dentons.com/en/about-dentons/news-events-and-awards/news/2023/june/dentons-launches-ai-tool-fleetai',
    source_urls: [],
    source_name: 'Dentons news release',
    published_at: '2023-06-20',
    tags: ['custom-gpt', 'dentons', 'azure', 'international'],
  },

  {
    firm_name: 'Clifford Chance',
    firm_type: 'biglaw',
    jurisdiction: 'International',
    use_case_title: 'CC Assist — GenAI platform deployed across 33 offices',
    summary: 'Clifford Chance launched CC Assist, an internal GenAI platform built with Microsoft technologies, deployed firmwide across its 33 offices. Handles drafting, research, document summarisation, and translation.',
    tools_used: ['Microsoft Azure OpenAI', 'Microsoft 365 Copilot'],
    categories: ['drafting', 'research', 'review', 'translation'],
    outcome: 'Integrated GenAI into daily practice across the firm\'s global network.',
    quantified_impact: '~3,500 lawyers across 33 offices',
    source_url: 'https://www.cliffordchance.com/news/news/2024/03/clifford-chance-launches-cc-assist.html',
    source_urls: [],
    source_name: 'Clifford Chance press release',
    published_at: '2024-03-01',
    tags: ['custom-gpt', 'biglaw', 'microsoft-copilot', 'international'],
  },

  {
    firm_name: 'DLA Piper',
    firm_type: 'biglaw',
    jurisdiction: 'International',
    use_case_title: 'Custom LLM tool "Prompt" plus Harvey integration',
    summary: 'DLA Piper built an internal tool called "Prompt" for firmwide use in 2024 and also adopted Harvey for specific high-value workflows including M&A due diligence and regulatory research.',
    tools_used: ['Harvey', 'Microsoft Azure OpenAI', 'Prompt (internal)'],
    categories: ['drafting', 'research', 'review'],
    outcome: 'Multi-tool approach — internal firmwide GenAI plus best-of-breed specialists like Harvey.',
    quantified_impact: null,
    source_url: 'https://www.dlapiper.com/en/insights/publications/2024/05/dla-piper-launches-prompt',
    source_urls: [],
    source_name: 'DLA Piper insights',
    published_at: '2024-05-15',
    tags: ['dla-piper', 'harvey', 'internal-tool', 'multi-tool'],
  },
];

async function run() {
  const client = await pool.connect();
  let inserted = 0, skipped = 0;
  try {
    for (const u of USECASES) {
      const res = await client.query(
        `INSERT INTO ai_legal_usecases
           (firm_name, firm_type, jurisdiction, use_case_title, summary,
            tools_used, categories, outcome, quantified_impact,
            source_url, source_urls, source_name, published_at, tags, verified_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::timestamptz,$14,NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          u.firm_name, u.firm_type, u.jurisdiction, u.use_case_title, u.summary,
          u.tools_used || [], u.categories || [], u.outcome, u.quantified_impact,
          u.source_url,
          Array.from(new Set([u.source_url, ...(u.source_urls || [])].filter(Boolean))),
          u.source_name, u.published_at, u.tags || [],
        ]
      );
      if (res.rowCount > 0) { inserted++; console.log(`  inserted: ${u.firm_name} — ${u.use_case_title.slice(0, 60)}`); }
      else                  { skipped++;  console.log(`  skipped:  ${u.firm_name}`); }
    }
    console.log(`\nDone. Inserted ${inserted}, skipped ${skipped}, total ${USECASES.length}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });

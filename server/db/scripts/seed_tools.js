// Seed: tools + methods for lawyers using AI.
// "tool" = a specific software product; "method" = a workflow/approach.
// Safe to re-run: ON CONFLICT (kind, name) DO NOTHING.
//
// Run: node server/db/scripts/seed_tools.js

import pool from '../pool.js';

const ITEMS = [
  // ── Tools ────────────────────────────────────────────────────────────────
  {
    name: 'Harvey', kind: 'tool', vendor: 'Counsel AI Corporation',
    category: 'general',
    description: 'GenAI platform for legal and professional services built on OpenAI, Anthropic and Google foundation models. Custom-trained for law, including a bespoke case-law model. Used for drafting, contract analysis, due diligence, regulatory research, and litigation support.',
    url: 'https://www.harvey.ai/',
    pricing: 'enterprise',
    strengths: 'Deep partnerships with BigLaw (A&O Shearman, Ashurst, Macfarlanes, Reed Smith) and Big Four (PwC). Purpose-built for legal workflows. Backed by OpenAI and Sequoia.',
    limitations: 'Enterprise pricing not disclosed publicly; heavy lift to onboard. Reports suggest six-figure annual commitments for mid-sized firm deployments.',
    source_urls: ['https://www.harvey.ai/', 'https://en.wikipedia.org/wiki/Harvey_(software)'],
    tags: ['harvey', 'openai', 'enterprise', 'biglaw'],
  },
  {
    name: 'CoCounsel', kind: 'tool', vendor: 'Thomson Reuters',
    category: 'research',
    description: 'Legal AI assistant originally built by Casetext (acquired by Thomson Reuters in August 2023 for $650M). Handles document review, legal research, contract analysis, deposition prep, and database queries. Integrated with Westlaw and Practical Law.',
    url: 'https://legal.thomsonreuters.com/en/c/cocounsel',
    pricing: 'paid',
    strengths: 'Integrated into the Thomson Reuters legal stack (Westlaw, Practical Law). Mature product with existing user base.',
    limitations: 'Premium Thomson Reuters subscription required; tied into the TR ecosystem.',
    source_urls: ['https://legal.thomsonreuters.com/en/c/cocounsel'],
    tags: ['thomson-reuters', 'casetext', 'westlaw', 'research'],
  },
  {
    name: 'Lexis+ AI', kind: 'tool', vendor: 'LexisNexis',
    category: 'research',
    description: 'GenAI-powered legal research tool integrated with LexisNexis content. Summarises judgments, drafts documents, answers legal questions with citations to authority, and suggests relevant precedents.',
    url: 'https://www.lexisnexis.com/en-us/products/lexis-plus-ai.page',
    pricing: 'paid',
    strengths: 'Citations anchored to primary-source legal content. Available across US, UK, Australia, France and other markets. Competitive with Westlaw.',
    limitations: 'LexisNexis subscription required. Coverage varies by jurisdiction.',
    source_urls: ['https://www.lexisnexis.com/en-us/products/lexis-plus-ai.page'],
    tags: ['lexisnexis', 'research', 'citations'],
  },
  {
    name: 'Westlaw Precision with AI-Assisted Research', kind: 'tool', vendor: 'Thomson Reuters',
    category: 'research',
    description: 'Thomson Reuters\' generative AI layer over Westlaw\'s legal database. Answers natural-language legal questions with citations, and surfaces related authorities.',
    url: 'https://legal.thomsonreuters.com/en/products/westlaw-precision',
    pricing: 'paid',
    strengths: 'Rooted in Westlaw\'s primary-source content and KeyCite. Strong for US and Canadian research.',
    limitations: 'Requires Westlaw Precision tier (premium above base Westlaw).',
    source_urls: ['https://legal.thomsonreuters.com/en/products/westlaw-precision'],
    tags: ['thomson-reuters', 'westlaw', 'research'],
  },
  {
    name: 'Spellbook', kind: 'tool', vendor: 'Spellbook (Rally)',
    category: 'drafting',
    description: 'GPT-4-powered contract drafting and review tool that runs inside Microsoft Word. Suggests language, flags issues, reviews drafts against playbooks.',
    url: 'https://www.spellbook.legal/',
    pricing: 'paid',
    strengths: 'Works natively in Word — no new interface to learn. Strong for transactional lawyers doing NDAs, commercial contracts, SaaS agreements.',
    limitations: 'Focused on drafting — not a general-purpose legal AI. Pricing per seat adds up for larger teams.',
    source_urls: ['https://www.spellbook.legal/'],
    tags: ['drafting', 'contracts', 'word-plugin', 'gpt-4'],
  },
  {
    name: 'Relativity aiR for Review', kind: 'tool', vendor: 'Relativity',
    category: 'ediscovery',
    description: 'GenAI layer for Relativity\'s eDiscovery platform. Uses LLMs to review, classify and summarise documents during discovery, dramatically reducing the time spent on first-pass review.',
    url: 'https://www.relativity.com/data-solutions/air/',
    pricing: 'enterprise',
    strengths: 'Embedded in Relativity — the dominant eDiscovery platform. Strong for large litigation and investigation document sets.',
    limitations: 'Requires Relativity subscription. eDiscovery-specific.',
    source_urls: ['https://www.relativity.com/data-solutions/air/'],
    tags: ['ediscovery', 'relativity', 'document-review'],
  },
  {
    name: 'Everlaw', kind: 'tool', vendor: 'Everlaw',
    category: 'ediscovery',
    description: 'Cloud-native eDiscovery and litigation platform with AI assistant features for document review, depositions, and case analytics.',
    url: 'https://www.everlaw.com/',
    pricing: 'enterprise',
    strengths: 'Modern UI, cloud-first architecture. Strong collaboration features. AI review features competitive with Relativity aiR.',
    limitations: 'Primarily US focused. Enterprise pricing.',
    source_urls: ['https://www.everlaw.com/'],
    tags: ['ediscovery', 'litigation', 'cloud'],
  },
  {
    name: 'Luminance', kind: 'tool', vendor: 'Luminance',
    category: 'review',
    description: 'AI-powered contract analysis platform using proprietary LegalFusion LLM alongside a long-standing pattern-recognition engine. Used for due diligence, contract review, negotiation.',
    url: 'https://www.luminance.com/',
    pricing: 'enterprise',
    strengths: 'One of the earliest legal AI platforms (pre-LLM era); now combines classical ML with GenAI. Strong for M&A due diligence.',
    limitations: 'Enterprise pricing; predominantly used for transactional review, not litigation.',
    source_urls: ['https://www.luminance.com/'],
    tags: ['contract-analysis', 'due-diligence', 'm-and-a'],
  },
  {
    name: 'Kira Systems (Litera)', kind: 'tool', vendor: 'Litera',
    category: 'review',
    description: 'Contract analysis platform now part of Litera. Extracts, reviews and analyses contract clauses at scale. Widely used for due diligence and lease review.',
    url: 'https://www.litera.com/products/contract-review',
    pricing: 'enterprise',
    strengths: 'Extensive pre-trained model library for common clause types. Mature product with large BigLaw customer base.',
    limitations: 'Pattern-matching focus; newer GenAI entrants may outperform for open-ended analysis.',
    source_urls: ['https://www.litera.com/products/contract-review'],
    tags: ['contract-analysis', 'due-diligence', 'litera'],
  },
  {
    name: 'DraftWise', kind: 'tool', vendor: 'DraftWise',
    category: 'drafting',
    description: 'GenAI-powered deal drafting platform that searches a firm\'s precedents and negotiation data to suggest drafting and negotiation strategies.',
    url: 'https://www.draftwise.com/',
    pricing: 'enterprise',
    strengths: 'Taps a firm\'s own deal data — playbook-aware drafting. Good for repeat transactional work.',
    limitations: 'Requires firm to have digitised precedents; heavy onboarding.',
    source_urls: ['https://www.draftwise.com/'],
    tags: ['drafting', 'deal-data', 'negotiation'],
  },
  {
    name: 'Legora', kind: 'tool', vendor: 'Legora',
    category: 'general',
    description: 'European legal AI platform (originally Leya, rebranded Legora) that handles drafting, review, research and citations across multiple languages. Known for transparent pricing vs Harvey.',
    url: 'https://www.legora.com/',
    pricing: 'paid',
    strengths: 'Strong European-language coverage (Swedish, Dutch, French, German). Pricing more accessible than Harvey.',
    limitations: 'Newer product — smaller installed base than US competitors.',
    source_urls: ['https://www.legora.com/'],
    tags: ['europe', 'multi-language', 'drafting', 'research'],
  },
  {
    name: 'Microsoft 365 Copilot', kind: 'tool', vendor: 'Microsoft',
    category: 'general',
    description: 'Microsoft\'s enterprise GenAI assistant integrated across Word, Outlook, Teams, PowerPoint, Excel, and Windows. Widely deployed at law firms for general productivity, email, drafting support.',
    url: 'https://www.microsoft.com/en-us/microsoft-365/copilot',
    pricing: 'paid',
    strengths: 'Ubiquitous enterprise presence. Secure per Microsoft\'s data controls. Works inside existing tools.',
    limitations: 'Not legal-specific. No citations to legal primary sources. Requires Microsoft 365 E3/E5.',
    source_urls: ['https://www.microsoft.com/en-us/microsoft-365/copilot'],
    tags: ['microsoft', 'general-productivity', 'copilot'],
  },
  {
    name: 'ChatGPT Enterprise', kind: 'tool', vendor: 'OpenAI',
    category: 'general',
    description: 'OpenAI\'s enterprise-grade ChatGPT with data-protection guarantees (no training on your data, SOC 2 Type 2). Widely used at law firms for general-purpose drafting, research, and workflow support.',
    url: 'https://openai.com/enterprise/',
    pricing: 'paid',
    strengths: 'Strongest frontier model (GPT-4/5). SOC 2, GDPR compliant. Large context windows. Easy to onboard.',
    limitations: 'Not legal-specific; no citations to authority. Needs guardrails to avoid hallucinated case law.',
    source_urls: ['https://openai.com/enterprise/'],
    tags: ['openai', 'chatgpt', 'enterprise', 'general'],
  },
  {
    name: 'Claude for Enterprise', kind: 'tool', vendor: 'Anthropic',
    category: 'general',
    description: 'Anthropic\'s enterprise-grade Claude — long-context (200k+), strong at nuanced reasoning, widely used in legal for summarising large documents, analysing contracts, and research.',
    url: 'https://www.anthropic.com/enterprise',
    pricing: 'paid',
    strengths: 'Very long context (200k tokens) good for whole-contract or whole-brief analysis. Strong at following complex instructions.',
    limitations: 'Not legal-specific. No authority citations. Newer to the enterprise market than OpenAI.',
    source_urls: ['https://www.anthropic.com/enterprise'],
    tags: ['anthropic', 'claude', 'enterprise', 'long-context'],
  },

  // ── Methods (workflows / approaches) ─────────────────────────────────────
  {
    name: 'Contract review with LLM + playbook',
    kind: 'method',
    vendor: null,
    category: 'review',
    description: 'Classic workflow: maintain a firm "playbook" describing preferred clause language and redlines; feed the counterparty draft + playbook to a GenAI model; have it propose redlines and flag deviations. Can run in Spellbook, Harvey, or a custom LLM wrapper.',
    url: null,
    pricing: null,
    strengths: 'Codifies institutional knowledge. Dramatically reduces turnaround on repeat contracts. Junior associates learn from playbook-driven feedback.',
    limitations: 'Playbook must be well-maintained. Novel terms outside the playbook still need human judgement.',
    source_urls: ['https://www.spellbook.legal/use-cases/contract-review'],
    tags: ['playbook', 'contract-review', 'workflow'],
  },
  {
    name: 'Due diligence summarisation via long-context LLM',
    kind: 'method',
    vendor: null,
    category: 'review',
    description: 'Bundle all due-diligence documents (up to millions of tokens) and feed them to a long-context model (Claude, Gemini 1.5) with a structured extraction prompt: "For each document, output {type, parties, term, red flags, obligations}." Reviewer triages the summary instead of reading raw docs.',
    url: null,
    pricing: null,
    strengths: 'Massive time savings on DD bundles. Structured output slots directly into DD reports.',
    limitations: 'Hallucination risk for novel document types. Requires human verification of red flags.',
    source_urls: ['https://www.anthropic.com/news/claude-long-context'],
    tags: ['due-diligence', 'long-context', 'extraction'],
  },
  {
    name: 'Deposition summary with ASR + LLM',
    kind: 'method',
    vendor: null,
    category: 'litigation',
    description: 'Feed deposition transcripts (from Whisper/AssemblyAI ASR or court stenographer) into an LLM with structured prompts: "Summarise each topic; flag key admissions; draft Q/A index." Litigation teams use this to compress 8-hour depositions into 2-page summaries.',
    url: null,
    pricing: null,
    strengths: 'Turns hundreds of pages into a usable trial preparation tool. Enables rapid cross-reference during trial.',
    limitations: 'Hallucination risk on nuanced exchanges. Human verification essential for admissions used in trial.',
    source_urls: [],
    tags: ['depositions', 'litigation', 'trial-prep', 'asr'],
  },
  {
    name: 'Regulatory change monitoring via LLM classification',
    kind: 'method',
    vendor: null,
    category: 'compliance',
    description: 'Ingest regulator feeds (RSS, press pages) via a scraper; feed each item through an LLM classifier prompted: "is this a material change to [relevant framework]? What\'s the effective date? What\'s the action required?" Produces a daily/weekly change register.',
    url: null,
    pricing: null,
    strengths: 'Automates a traditionally manual compliance task. Scales across many frameworks and jurisdictions.',
    limitations: 'Classifier needs ongoing prompt refinement. False positives noisy for legal teams.',
    source_urls: [],
    tags: ['regtech', 'classification', 'compliance', 'monitoring'],
  },
  {
    name: 'RAG over firm\'s knowledge base',
    kind: 'method',
    vendor: null,
    category: 'research',
    description: 'Embed a firm\'s memoranda, know-how, engagement files, and client deliverables into a vector database (pgvector, Pinecone). Expose to lawyers via a chat interface that retrieves the most relevant items and has Claude/GPT answer using only those sources. Each answer cites the original firm document.',
    url: null,
    pricing: null,
    strengths: 'Unlocks the firm\'s "tribal knowledge" for every lawyer regardless of seniority. Answers are grounded in firm work-product.',
    limitations: 'Content-security and engagement-confidentiality must be enforced at the retrieval level. Requires ongoing re-indexing.',
    source_urls: ['https://www.pinecone.io/learn/rag/'],
    tags: ['rag', 'knowledge-base', 'vector-search', 'research'],
  },
  {
    name: 'Prompt engineering for legal research',
    kind: 'method',
    vendor: null,
    category: 'research',
    description: 'Purpose-designed prompts that produce more useful legal-research output: (a) "role-first" — tell the model it\'s a specialist in jurisdiction X; (b) "chain of authorities" — ask for a list of authorities BEFORE summary; (c) "adversarial" — ask for the strongest counter-argument; (d) "citation check" — paste the claim + ask it to find supporting primary source.',
    url: null,
    pricing: null,
    strengths: 'No tool investment needed. Immediately improves quality of off-the-shelf LLM output for legal work.',
    limitations: 'Doesn\'t prevent hallucinated citations — authorities must still be verified in Westlaw/Lexis.',
    source_urls: ['https://www.lawnext.com/category/prompt-engineering'],
    tags: ['prompt-engineering', 'workflow', 'research'],
  },
  {
    name: 'AI-augmented client intake',
    kind: 'method',
    vendor: null,
    category: 'intake',
    description: 'Chat-based intake bot that walks new clients through structured questions, identifies conflicts, drafts an initial engagement letter, and hands off to the matter-opening lawyer with a populated profile.',
    url: null,
    pricing: null,
    strengths: 'Reduces admin time for partners. Captures more detail than a phone call. Scales 24/7.',
    limitations: 'Careful UX needed to avoid prospective client confusion. Conflicts check still needs human oversight.',
    source_urls: [],
    tags: ['intake', 'chatbot', 'workflow'],
  },
];

async function run() {
  const client = await pool.connect();
  let inserted = 0, skipped = 0;
  try {
    for (const t of ITEMS) {
      const res = await client.query(
        `INSERT INTO ai_legal_tools
           (name, kind, vendor, category, description, url, pricing,
            strengths, limitations, integrations, source_urls, tags, verified_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
         ON CONFLICT (kind, name) DO NOTHING
         RETURNING id`,
        [
          t.name, t.kind, t.vendor, t.category, t.description, t.url, t.pricing,
          t.strengths, t.limitations, t.integrations || [],
          t.source_urls || [], t.tags || [],
        ]
      );
      if (res.rowCount > 0) { inserted++; console.log(`  inserted ${t.kind}: ${t.name}`); }
      else                  { skipped++;  console.log(`  skipped:  ${t.name}`); }
    }
    console.log(`\nDone. Inserted ${inserted}, skipped ${skipped}, total ${ITEMS.length}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });

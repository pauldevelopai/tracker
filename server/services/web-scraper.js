import axios from 'axios';
import * as cheerio from 'cheerio';

const TIMEOUT = 10000;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Fetch and extract article text from a URL
export async function scrapeArticle(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: TIMEOUT,
      headers: { 'User-Agent': USER_AGENT },
      maxRedirects: 3,
    });
    const $ = cheerio.load(data);

    // Remove noise
    $('script, style, nav, footer, header, aside, .sidebar, .ad, .advertisement, .social-share, .comments').remove();

    // Try common article selectors
    const selectors = ['article', '[role="main"]', '.post-content', '.article-body', '.entry-content', '.story-body', 'main'];
    let text = '';
    for (const sel of selectors) {
      const el = $(sel);
      if (el.length && el.text().trim().length > 200) {
        text = el.text().trim();
        break;
      }
    }
    if (!text) text = $('body').text().trim();

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();

    // Extract metadata
    const title = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || '';
    const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
    const publishDate = $('meta[property="article:published_time"]').attr('content') || $('time').attr('datetime') || '';

    return {
      url,
      title: title.slice(0, 300),
      description: description.slice(0, 500),
      text: text.slice(0, 5000), // Cap to avoid huge payloads
      publishDate,
      success: true,
    };
  } catch (err) {
    return { url, title: '', description: '', text: '', publishDate: '', success: false, error: err.message };
  }
}

// Scrape multiple URLs concurrently (with rate limiting)
export async function scrapeMultiple(urls, concurrency = 3) {
  const results = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(url => scrapeArticle(url)));
    for (const r of batchResults) {
      results.push(r.status === 'fulfilled' ? r.value : { url: '', success: false, error: r.reason?.message });
    }
    // Small delay between batches to be polite
    if (i + concurrency < urls.length) await new Promise(r => setTimeout(r, 1000));
  }
  return results;
}

// Sector-specific news sources to scrape (50+ sources)
const SECTOR_SOURCES = {
  media: [
    // Journalism & media innovation
    { url: 'https://www.niemanlab.org/', name: 'Nieman Lab', selector: '.article-list a, .river-post a, h2 a' },
    { url: 'https://gijn.org/stories/', name: 'GIJN', selector: '.post-title a, article a' },
    { url: 'https://reutersinstitute.politics.ox.ac.uk/news', name: 'Reuters Institute', selector: 'article a, .views-row a' },
    { url: 'https://www.journalismai.info/blog', name: 'JournalismAI', selector: 'article a, .blog-post a' },
    { url: 'https://www.cjr.org/', name: 'Columbia Journalism Review', selector: 'article a, .lede a' },
    { url: 'https://www.poynter.org/', name: 'Poynter', selector: 'article a, h3 a, .entry-title a' },
    { url: 'https://mediashift.org/', name: 'MediaShift', selector: 'article a, h2 a' },
    { url: 'https://www.digitalnewsreport.org/', name: 'Digital News Report', selector: 'article a, .post a' },
    { url: 'https://wan-ifra.org/news/', name: 'WAN-IFRA', selector: 'article a, h3 a' },
    { url: 'https://www.inma.org/blogs/', name: 'INMA', selector: 'article a, h3 a' },
    // Press freedom & media development
    { url: 'https://cpj.org/', name: 'CPJ', selector: 'article a, h3 a' },
    { url: 'https://rsf.org/en/news', name: 'RSF', selector: 'article a, h3 a' },
    { url: 'https://gfmd.info/news/', name: 'GFMD', selector: 'article a, h3 a' },
    { url: 'https://www.icfj.org/news', name: 'ICFJ', selector: 'article a, h3 a' },
    { url: 'https://ijnet.org/en/stories', name: 'IJNet', selector: 'article a, h3 a' },
    // African media
    { url: 'https://journalism.co.za/', name: 'Journalism.co.za', selector: 'article a, h2 a' },
    { url: 'https://www.dailymaverick.co.za/section/opinionistas/', name: 'Daily Maverick', selector: 'article a, h3 a' },
    { url: 'https://mg.co.za/tag/media/', name: 'Mail & Guardian Media', selector: 'article a, h3 a' },
    { url: 'https://www.highwayafrica.com/', name: 'Highway Africa', selector: 'article a, h3 a' },
    // Digital publishing
    { url: 'https://www.journalism.co.uk/news/', name: 'Journalism.co.uk', selector: 'article a, h3 a' },
    { url: 'https://www.pressgazette.co.uk/category/media/', name: 'Press Gazette', selector: 'article a, h3 a' },
    { url: 'https://digiday.com/media/', name: 'Digiday Media', selector: 'article a, h3 a' },
  ],
  legal: [
    // Legal tech & AI in law
    { url: 'https://www.artificiallawyer.com/', name: 'Artificial Lawyer', selector: 'article a, .entry-title a' },
    { url: 'https://www.law.com/legaltechnews/', name: 'Legal Tech News', selector: 'article a, .headline a' },
    { url: 'https://www.lawsitesblog.com/', name: 'LawSites', selector: 'article a, h2 a' },
    { url: 'https://www.legalitprofessionals.com/', name: 'Legal IT Professionals', selector: 'article a, h3 a' },
    { url: 'https://www.legaltechnology.com/', name: 'Legal Technology', selector: 'article a, h3 a' },
    { url: 'https://www.lawtechnologytoday.org/', name: 'Law Technology Today', selector: 'article a, h3 a' },
    // Legal regulation & policy
    { url: 'https://www.lawgazette.co.uk/practice/technology/', name: 'Law Gazette Tech', selector: 'article a, h3 a' },
    { url: 'https://www.americanbar.org/groups/centers_commissions/center-for-innovation/', name: 'ABA Innovation', selector: 'article a, h3 a' },
    { url: 'https://legal-tech-blog.de/', name: 'Legal Tech Blog', selector: 'article a, h2 a' },
  ],
  general_ai: [
    // Major AI news
    { url: 'https://www.technologyreview.com/topic/artificial-intelligence/', name: 'MIT Tech Review', selector: 'article a' },
    { url: 'https://www.theverge.com/ai-artificial-intelligence', name: 'The Verge AI', selector: 'article a, h2 a' },
    { url: 'https://techcrunch.com/category/artificial-intelligence/', name: 'TechCrunch AI', selector: 'article a, h3 a' },
    { url: 'https://www.wired.com/tag/artificial-intelligence/', name: 'WIRED AI', selector: 'article a, h3 a' },
    { url: 'https://venturebeat.com/category/ai/', name: 'VentureBeat AI', selector: 'article a, h3 a' },
    // AI ethics & policy
    { url: 'https://aiethicist.org/', name: 'AI Ethicist', selector: 'article a, .post-title a' },
    { url: 'https://www.fast.ai/', name: 'fast.ai', selector: 'article a, h3 a' },
    { url: 'https://hai.stanford.edu/news', name: 'Stanford HAI', selector: 'article a, h3 a' },
    { url: 'https://www.partnershiponai.org/news/', name: 'Partnership on AI', selector: 'article a, h3 a' },
    { url: 'https://montrealethics.ai/blog/', name: 'Montreal AI Ethics', selector: 'article a, h3 a' },
    { url: 'https://algorithmwatch.org/en/', name: 'AlgorithmWatch', selector: 'article a, h3 a' },
    // AI tools & implementation
    { url: 'https://www.deeplearning.ai/the-batch/', name: 'DeepLearning.AI Batch', selector: 'article a, h3 a' },
    { url: 'https://huggingface.co/blog', name: 'Hugging Face Blog', selector: 'article a, h3 a' },
    { url: 'https://openai.com/blog', name: 'OpenAI Blog', selector: 'article a, h3 a' },
    { url: 'https://www.anthropic.com/news', name: 'Anthropic News', selector: 'article a, h3 a' },
    { url: 'https://blog.google/technology/ai/', name: 'Google AI Blog', selector: 'article a, h3 a' },
    // AI regulation
    { url: 'https://www.adalovelaceinstitute.org/news/', name: 'Ada Lovelace Institute', selector: 'article a, h3 a' },
    { url: 'https://cdt.org/area-of-focus/privacy-data/', name: 'CDT', selector: 'article a, h3 a' },
    { url: 'https://www.accessnow.org/news/', name: 'Access Now', selector: 'article a, h3 a' },
  ],
};

// Scrape latest headlines from sector news sources
// Phase 1: Quick headline scan across all sources (fast)
// Phase 2: Claude filters for relevance (cheap)
// Phase 3: Deep scrape only the worthwhile articles (targeted)
export async function scrapeSectorNews(sectorName) {
  const sectorKey = sectorName.toLowerCase();
  const sources = [...(SECTOR_SOURCES[sectorKey] || []), ...SECTOR_SOURCES.general_ai];
  const allHeadlines = [];
  let sourcesScanned = 0;
  let sourcesFailed = 0;

  console.log(`[Scraper] Scanning ${sources.length} sources for ${sectorName}...`);

  // Phase 1: Fast headline scan — 5 concurrent, 4 headlines per source max
  const batches = [];
  for (let i = 0; i < sources.length; i += 5) {
    batches.push(sources.slice(i, i + 5));
  }

  for (const batch of batches) {
    const batchResults = await Promise.allSettled(batch.map(async (source) => {
      const { data } = await axios.get(source.url, {
        timeout: 8000,
        headers: { 'User-Agent': USER_AGENT },
        maxRedirects: 3,
      });
      const $ = cheerio.load(data);
      const links = [];
      $(source.selector || 'article a, h2 a, h3 a').each((i, el) => {
        if (i >= 4) return false;
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href && text && text.length > 15 && text.length < 300 && !href.includes('#') && !href.includes('javascript:')) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, source.url).toString();
          if (!links.find(l => l.url === fullUrl)) {
            links.push({ url: fullUrl, title: text.slice(0, 200), source: source.name });
          }
        }
      });
      return { source: source.name, links };
    }));

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allHeadlines.push(...result.value.links);
        sourcesScanned++;
      } else {
        sourcesFailed++;
      }
    }
    // Brief pause between batches
    if (batches.indexOf(batch) < batches.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[Scraper] Scanned ${sourcesScanned}/${sources.length} sources (${sourcesFailed} failed), found ${allHeadlines.length} headlines`);

  // Deduplicate
  const seen = new Set();
  const unique = allHeadlines.filter(a => {
    const key = a.url.replace(/[?#].*/, ''); // strip query params for dedup
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) return [];

  // Phase 2: Quick Claude filter — which headlines are worth deep-scraping?
  // This is a fast, cheap call — just headline text, no article content
  const headlineList = unique.slice(0, 100).map((h, i) => `${i+1}. "${h.title}" (${h.source})`).join('\n');

  let worthwhile = unique.slice(0, 15); // fallback: just take first 15

  try {
    const { callClaude } = await import('./claude.js');
    const filterResult = await callClaude({
      system: `You filter news headlines for relevance to AI training, AI ethics, AI policy, AI tools, and journalism/legal tech.
Given a list of headlines, return ONLY the numbers of headlines that are directly relevant to:
- AI developments that affect how professionals work
- AI tools, platforms, or techniques worth knowing about
- AI regulation, ethics, or policy changes
- AI in journalism, media, or legal practice
- Training, education, or skill development related to AI

Ignore: generic business news, entertainment, sports, weather, politics unrelated to AI, social media drama.

Output format: just comma-separated numbers, nothing else. Example: 1,3,5,12,15`,
      userContent: `Filter these ${sectorName} sector headlines for AI relevance:\n\n${headlineList}`,
      maxTokens: 200,
      temperature: 0.1,
    });

    const selectedNums = filterResult.match(/\d+/g)?.map(n => parseInt(n) - 1) || [];
    if (selectedNums.length > 0) {
      worthwhile = selectedNums
        .filter(n => n >= 0 && n < unique.length)
        .slice(0, 20)
        .map(n => unique[n]);
      console.log(`[Scraper] Claude selected ${worthwhile.length}/${unique.length} headlines as relevant`);
    }
  } catch (e) {
    console.log(`[Scraper] Claude filter failed, using top ${worthwhile.length} headlines: ${e.message}`);
  }

  // Phase 3: Deep scrape only the worthwhile articles
  console.log(`[Scraper] Deep-scraping ${worthwhile.length} articles...`);
  const scraped = await scrapeMultiple(worthwhile.map(a => a.url), 4);

  return worthwhile.map((article, i) => ({
    ...article,
    fullText: scraped[i]?.text?.slice(0, 2000) || '',
    description: scraped[i]?.description || '',
    publishDate: scraped[i]?.publishDate || '',
    scraped: scraped[i]?.success || false,
  }));
}

// ========================================================================
// LEAD PROSPECTING SCRAPER
// Scrapes directories, association lists, and industry pages for potential
// organisations to sell AI training to
// ========================================================================

const LEAD_SOURCES = {
  media: [
    // Media directories & associations
    { url: 'https://gijn.org/network/', name: 'GIJN Member Network', type: 'directory', selector: 'article a, .member a, h3 a, .card a' },
    { url: 'https://wan-ifra.org/members/', name: 'WAN-IFRA Members', type: 'directory', selector: 'article a, .member a, h3 a' },
    { url: 'https://gfmd.info/members/', name: 'GFMD Members', type: 'directory', selector: 'article a, .member a, h3 a' },
    { url: 'https://www.icfj.org/our-work/knight-international-journalism-fellowships', name: 'ICFJ Knight Fellows', type: 'directory', selector: 'article a, h3 a' },
    // African media directories
    { url: 'https://journalism.co.za/resources/', name: 'SA Media Directory', type: 'directory', selector: 'article a, h3 a, li a' },
    { url: 'https://www.amdi.africa/', name: 'African Media Development Initiative', type: 'directory', selector: 'article a, h3 a' },
    { url: 'https://africacheck.org/partners', name: 'Africa Check Partners', type: 'directory', selector: 'article a, h3 a, .partner a' },
    { url: 'https://www.misa.org/members/', name: 'MISA Members (Southern Africa)', type: 'directory', selector: 'article a, h3 a, li a' },
    // European/exiled media
    { url: 'https://rsf.org/en/barometer', name: 'RSF Press Freedom Index', type: 'directory', selector: 'article a, h3 a' },
    { url: 'https://www.mappingmediafreedomineurope.eu/', name: 'EU Media Freedom Map', type: 'directory', selector: 'article a, h3 a' },
    { url: 'https://www.journalismfund.eu/supported-projects', name: 'Journalism Fund EU Projects', type: 'directory', selector: 'article a, h3 a' },
    // Newsroom innovation
    { url: 'https://www.lenfestinstitute.org/solution-set/', name: 'Lenfest Solution Set', type: 'directory', selector: 'article a, h3 a' },
    { url: 'https://www.americanpressinstitute.org/', name: 'American Press Institute', type: 'directory', selector: 'article a, h3 a' },
    { url: 'https://newsinitiative.withgoogle.com/programs/', name: 'Google News Initiative', type: 'directory', selector: 'article a, h3 a' },
    // Media training providers (competitors & partners)
    { url: 'https://datajournalism.com/', name: 'Data Journalism', type: 'directory', selector: 'article a, h3 a' },
    { url: 'https://www.internews.org/areas-of-expertise/', name: 'Internews', type: 'directory', selector: 'article a, h3 a' },
    // Foundations funding media
    { url: 'https://www.luminate.group/what-we-do/', name: 'Luminate Group', type: 'funder', selector: 'article a, h3 a' },
    { url: 'https://www.opensocietyfoundations.org/what-we-do/themes/journalism', name: 'Open Society (Journalism)', type: 'funder', selector: 'article a, h3 a' },
    { url: 'https://www.macfound.org/programs/journalism-media/', name: 'MacArthur (Journalism)', type: 'funder', selector: 'article a, h3 a' },
  ],
  legal: [
    // Legal tech directories
    { url: 'https://www.artificiallawyer.com/legal-tech-list/', name: 'Artificial Lawyer Directory', type: 'directory', selector: 'article a, h3 a, li a' },
    { url: 'https://law-tech-a2j.org/', name: 'Law Tech A2J', type: 'directory', selector: 'article a, h3 a' },
    // Law societies & associations
    { url: 'https://www.lawsociety.org.uk/topics/research/technology-and-law', name: 'Law Society UK Tech', type: 'directory', selector: 'article a, h3 a' },
    { url: 'https://www.ibanet.org/', name: 'International Bar Association', type: 'directory', selector: 'article a, h3 a' },
    { url: 'https://www.lawsociety.org.za/', name: 'Law Society of SA', type: 'directory', selector: 'article a, h3 a, li a' },
    // Pro bono / access to justice
    { url: 'https://www.probono.org.za/', name: 'ProBono.org SA', type: 'directory', selector: 'article a, h3 a' },
    { url: 'https://www.a2justice.org/', name: 'A2Justice', type: 'directory', selector: 'article a, h3 a' },
    // Legal innovation hubs
    { url: 'https://legal-tech-blog.de/legal-tech-map/', name: 'Legal Tech Map', type: 'directory', selector: 'article a, h3 a, li a' },
    { url: 'https://www.legalgeek.co/', name: 'Legal Geek', type: 'directory', selector: 'article a, h3 a' },
    // Legal AI companies (potential partners)
    { url: 'https://www.legaltechhub.io/', name: 'Legal Tech Hub', type: 'directory', selector: 'article a, h3 a, .card a' },
  ],
  general: [
    // AI ethics & governance orgs (need training themselves)
    { url: 'https://www.partnershiponai.org/partners/', name: 'Partnership on AI Members', type: 'directory', selector: 'article a, h3 a, .partner a' },
    { url: 'https://www.weforum.org/communities/global-ai-council/', name: 'WEF AI Council', type: 'directory', selector: 'article a, h3 a' },
    // Training / education (competitors & partners)
    { url: 'https://www.coursera.org/search?query=AI%20ethics', name: 'Coursera AI Ethics', type: 'competitor', selector: 'a[data-click-key], h3 a' },
    // African tech hubs
    { url: 'https://www.afrilabs.com/members/', name: 'AfriLabs Members', type: 'directory', selector: 'article a, h3 a, .member a' },
    { url: 'https://gloafrica.com/', name: 'GLO Africa', type: 'directory', selector: 'article a, h3 a' },
    // Development / donor orgs
    { url: 'https://www.usaid.gov/digital-development', name: 'USAID Digital', type: 'funder', selector: 'article a, h3 a' },
    { url: 'https://www.dfid.gov.uk/', name: 'UK Aid', type: 'funder', selector: 'article a, h3 a' },
    { url: 'https://www.sida.se/en/for-partners', name: 'SIDA', type: 'funder', selector: 'article a, h3 a' },
    { url: 'https://www.giz.de/en/worldwide/programmes.html', name: 'GIZ', type: 'funder', selector: 'article a, h3 a' },
  ],
};

// Scrape directories and listings for potential lead organisations
export async function scrapeLeadProspects(sectorName) {
  const sectorKey = sectorName?.toLowerCase() || 'general';
  const sources = [...(LEAD_SOURCES[sectorKey] || []), ...LEAD_SOURCES.general];
  const allOrgs = [];
  let sourcesScanned = 0;

  console.log(`[LeadScraper] Scanning ${sources.length} directories for ${sectorName || 'all sectors'}...`);

  // Scrape in batches of 5
  const batches = [];
  for (let i = 0; i < sources.length; i += 5) {
    batches.push(sources.slice(i, i + 5));
  }

  for (const batch of batches) {
    const results = await Promise.allSettled(batch.map(async (source) => {
      const { data } = await axios.get(source.url, {
        timeout: 10000,
        headers: { 'User-Agent': USER_AGENT },
        maxRedirects: 3,
      });
      const $ = cheerio.load(data);
      const items = [];

      // Extract org names and links
      $(source.selector || 'article a, h3 a, li a, .card a').each((i, el) => {
        if (i >= 15) return false; // max 15 per source
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (text && text.length > 3 && text.length < 150 && !text.includes('Read more') && !text.includes('Learn more')) {
          const fullUrl = href && href.startsWith('http') ? href : (href ? new URL(href, source.url).toString() : null);
          items.push({
            name: text.slice(0, 150),
            url: fullUrl,
            source: source.name,
            sourceType: source.type,
          });
        }
      });

      // Also try to get meta description for context
      const description = $('meta[name="description"]').attr('content') || '';

      return { source: source.name, items, description };
    }));

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.items.length > 0) {
        allOrgs.push(...result.value.items);
        sourcesScanned++;
        console.log(`[LeadScraper] ${result.value.source}: ${result.value.items.length} items`);
      }
    }

    if (batches.indexOf(batch) < batches.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[LeadScraper] Scanned ${sourcesScanned} sources, found ${allOrgs.length} raw items`);

  // Deduplicate by name (case-insensitive)
  const seen = new Set();
  const unique = allOrgs.filter(o => {
    const key = o.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key.length < 3 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) return [];

  // Claude filters for actual organisations that could be leads
  try {
    const { callClaude } = await import('./claude.js');
    const orgList = unique.slice(0, 150).map((o, i) => `${i+1}. "${o.name}" (from ${o.source}, type: ${o.sourceType})`).join('\n');

    const filterResult = await callClaude({
      system: `You are identifying potential client organisations for Develop AI, which sells AI training, ethical AI policy creation, AI legal frameworks, and AI security protocols to media organisations, law firms, NGOs, foundations, and professional associations.

From this list of scraped names, identify which ones are REAL ORGANISATIONS (not page headings, menu items, or generic text) that could plausibly need AI training or AI governance services.

For each real organisation, rate them:
- HOT: Media company, newsroom, law firm, NGO, or foundation that clearly works in journalism, legal, or development
- WARM: Professional association, training body, or tech org that could need AI ethics/policy work
- COLD: Tangentially related — might need AI training but unclear

Return as JSON array: [{"num": 1, "rating": "hot"}, {"num": 5, "rating": "warm"}]
Only include real organisations. Skip menu items, article titles, generic phrases.`,
      userContent: `Classify these ${unique.length} scraped items for ${sectorName || 'cross-sector'} lead potential:\n\n${orgList}`,
      maxTokens: 2000,
      temperature: 0.1,
    });

    // Parse JSON from Claude response
    const jsonMatch = filterResult.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const classified = JSON.parse(jsonMatch[0]);
      const prospects = classified
        .filter(c => c.num > 0 && c.num <= unique.length)
        .map(c => ({
          ...unique[c.num - 1],
          warmth: c.rating,
        }));

      console.log(`[LeadScraper] Claude classified ${prospects.length} as real organisations (${prospects.filter(p => p.warmth === 'hot').length} hot, ${prospects.filter(p => p.warmth === 'warm').length} warm, ${prospects.filter(p => p.warmth === 'cold').length} cold)`);
      return prospects;
    }
  } catch (e) {
    console.log(`[LeadScraper] Claude classification failed: ${e.message}`);
  }

  // Fallback: return all unique items as cold
  return unique.slice(0, 50).map(o => ({ ...o, warmth: 'cold' }));
}

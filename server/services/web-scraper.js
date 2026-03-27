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

// Sector-specific news sources to scrape
const SECTOR_SOURCES = {
  media: [
    { url: 'https://www.niemanlab.org/', name: 'Nieman Lab', selector: '.article-list a, .river-post a' },
    { url: 'https://gijn.org/stories/', name: 'GIJN', selector: '.post-title a, article a' },
    { url: 'https://reutersinstitute.politics.ox.ac.uk/news', name: 'Reuters Institute', selector: 'article a, .views-row a' },
    { url: 'https://www.journalismai.info/blog', name: 'JournalismAI', selector: 'article a, .blog-post a' },
    { url: 'https://www.cjr.org/', name: 'Columbia Journalism Review', selector: 'article a, .lede a' },
  ],
  legal: [
    { url: 'https://www.artificiallawyer.com/', name: 'Artificial Lawyer', selector: 'article a, .entry-title a' },
    { url: 'https://www.law.com/legaltechnews/', name: 'Legal Tech News', selector: 'article a, .headline a' },
  ],
  general_ai: [
    { url: 'https://www.technologyreview.com/topic/artificial-intelligence/', name: 'MIT Tech Review', selector: 'article a' },
    { url: 'https://aiethicist.org/', name: 'AI Ethicist', selector: 'article a, .post-title a' },
  ],
};

// Scrape latest headlines from sector news sources
export async function scrapeSectorNews(sectorName) {
  const sectorKey = sectorName.toLowerCase();
  const sources = [...(SECTOR_SOURCES[sectorKey] || []), ...SECTOR_SOURCES.general_ai];
  const allArticles = [];

  for (const source of sources) {
    try {
      const { data } = await axios.get(source.url, {
        timeout: TIMEOUT,
        headers: { 'User-Agent': USER_AGENT },
        maxRedirects: 3,
      });
      const $ = cheerio.load(data);

      // Extract headline links
      const links = [];
      $(source.selector || 'article a, h2 a, h3 a').each((i, el) => {
        if (i >= 8) return false; // Max 8 per source
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href && text && text.length > 15 && !href.includes('#')) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, source.url).toString();
          if (!links.find(l => l.url === fullUrl)) {
            links.push({ url: fullUrl, title: text.slice(0, 200), source: source.name });
          }
        }
      });

      allArticles.push(...links);
      console.log(`[Scraper] ${source.name}: ${links.length} headlines`);
    } catch (err) {
      console.log(`[Scraper] ${source.name} failed: ${err.message}`);
    }
  }

  // Deduplicate by URL
  const seen = new Set();
  const unique = allArticles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  // Scrape top articles for full content (max 10)
  const topArticles = unique.slice(0, 10);
  const scraped = await scrapeMultiple(topArticles.map(a => a.url), 3);

  // Merge headline data with scraped content
  return topArticles.map((article, i) => ({
    ...article,
    fullText: scraped[i]?.text?.slice(0, 2000) || '',
    description: scraped[i]?.description || '',
    publishDate: scraped[i]?.publishDate || '',
    scraped: scraped[i]?.success || false,
  }));
}

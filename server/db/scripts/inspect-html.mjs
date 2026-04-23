import fs from 'node:fs';
import * as cheerio from 'cheerio';

const path = process.argv[2];
const focus = process.argv[3];
if (!path) { console.error('usage: node inspect-html.mjs <file> [focus-selector]'); process.exit(1); }

const html = fs.readFileSync(path, 'utf8');
const $ = cheerio.load(html);

if (focus) {
  const els = $(focus);
  console.log(`=== ${els.length} × ${focus} ===`);
  els.slice(0, 5).each((i, el) => {
    const $el = $(el);
    console.log(`\n[${i}] classes: "${$el.attr('class') || ''}"`);
    console.log(`    children: ${$el.children().length}`);
    console.log(`    text: ${$el.text().trim().replace(/\s+/g, ' ').slice(0, 200)}`);
    console.log(`    first link: ${$el.find('a').first().attr('href')}`);
    console.log(`    heading: ${$el.find('h1,h2,h3,h4,h5').first().text().trim().slice(0, 120)}`);
    console.log(`    time: ${$el.find('time').first().attr('datetime') || $el.find('time').first().text().trim().slice(0, 40)}`);
  });
  process.exit(0);
}

const candidates = [
  'article', 'article.news-item', '.news-item', '.post', '.search-result',
  'li[class*=result]', 'li[class*=news]', 'li[class*=item]',
  'div[class*=result]', 'div[class*=news]', 'div[class*=post]', 'div[class*=card]',
  'div[class*=article]', 'div[class*=teaser]', '.content-block', '.listing-item',
  '.views-row', '.card', '.tile',
];
const textCandidates = ['h3 a', 'h2 a', 'h4 a', 'a[href*=news]', 'a[href*=press]', 'time', '[datetime]'];

console.log('--- structural ---');
for (const sel of candidates) {
  const n = $(sel).length;
  if (n > 0) console.log(String(n).padStart(4) + ' × ' + sel);
}
console.log('--- anchor/date ---');
for (const sel of textCandidates) {
  const n = $(sel).length;
  if (n > 0) console.log(String(n).padStart(4) + ' × ' + sel);
}

// Also show the first structural candidate with 3-50 matches
for (const sel of candidates) {
  const els = $(sel);
  if (els.length >= 3 && els.length <= 50) {
    console.log('\n--- sample (first 2) of ' + sel + ' ---');
    for (let i = 0; i < 2; i++) {
      const el = els.eq(i);
      console.log(`[${i}] classes: "${el.attr('class')}"`);
      console.log(`    children: ${el.children().length}`);
      console.log(`    text: ${el.text().trim().replace(/\s+/g, ' ').slice(0, 120)}`);
      console.log(`    first link: ${el.find('a').first().attr('href')}`);
      console.log(`    heading text: ${el.find('h1,h2,h3,h4').first().text().trim().slice(0, 100)}`);
    }
    break;
  }
}

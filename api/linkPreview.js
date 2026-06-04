const https = require('https');
const http  = require('http');

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 4000, headers: { 'User-Agent': 'ZEnode-Bot/1.0' } }, (res) => {
      if (res.statusCode !== 200) return reject(new Error('non-200'));
      let data = '';
      res.on('data', c => { data += c; if (data.length > 80000) req.destroy(); });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function meta(html, prop) {
  for (const re of [
    new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${prop}["']`, 'i'),
    new RegExp(`<meta[^>]*name=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'),
  ]) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

async function fetchLinkPreview(text) {
  const urls = text.match(URL_RE);
  if (!urls?.length) return null;
  const url = urls[0];
  if (/\.(png|jpg|jpeg|gif|webp|mp4|mp3|pdf)$/i.test(url)) return null;
  try {
    const html    = await fetchRaw(url);
    const title   = meta(html,'title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    const desc    = meta(html,'description');
    const image   = meta(html,'image');
    const siteName = meta(html,'site_name');
    if (!title) return null;
    return { url, title: title.slice(0,120), description: desc?.slice(0,200)||null, image: image||null, siteName: siteName || new URL(url).hostname };
  } catch { return null; }
}

module.exports = { fetchLinkPreview };

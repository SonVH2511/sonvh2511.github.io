const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'posts.json');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 404) return res; 
      if (res.status === 403) { 
         console.warn(`[!] HTTP 403 on ${url}, probably rate limited.`);
         return res;
      }
    } catch (e) {
      if (i === retries - 1) throw e;
    }
  }
}

async function getLatestCommitDate(owner, repo, ref, filePath) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(filePath)}&sha=${ref}&per_page=1`;
  const headers = { 'User-Agent': 'NodeJS' };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }

  const res = await fetchWithRetry(url, { headers });
  if (!res || !res.ok) return null;
  const data = await res.json();
  if (data && data.length > 0) {
    return new Date(data[0].commit.committer.date);
  }
  return null;
}

async function processPosts() {
  console.log("Starting metadata update...");
  const fileContent = fs.readFileSync(DATA_PATH, 'utf-8');
  const data = JSON.parse(fileContent);
  const posts = data.posts || {};

  for (const slug of Object.keys(posts)) {
    const post = posts[slug];
    if (post.external) continue; 

    const candidates = post.candidates || [];
    let foundValid = false;

    for (const rawUrl of candidates) {
      if (!rawUrl.includes("raw.githubusercontent.com")) continue;

      const match = rawUrl.match(/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)/);
      if (!match) continue;

      const [, owner, repo, ref, filePath] = match;

      // 1. Fetch Markdown content to count words
      const contentRes = await fetchWithRetry(rawUrl);
      if (!contentRes || !contentRes.ok) continue;

      const text = await contentRes.text();
      if (!text.trim()) continue;

      const words = text.trim().split(/\s+/).length;
      post.wordCount = words;
      post.readingTime = Math.ceil(words / 250) + " min";

      // 2. Fetch Commit Data for dates
      const commitDate = await getLatestCommitDate(owner, repo, ref, filePath);
      if (commitDate) {
        const yyyy = commitDate.getFullYear();
        const mm = String(commitDate.getMonth() + 1).padStart(2, '0');
        const dd = String(commitDate.getDate()).padStart(2, '0');
        const dateString = `${yyyy}-${mm}-${dd}`;

        post.updatedAt = dateString;
        if (!post.publishedAt) {
          post.publishedAt = dateString;
        }
      }

      console.log(`[+] Updated metadata for ${slug}: ${words} words, ${post.readingTime}, Last updated: ${post.updatedAt}`);
      foundValid = true;
      break;
    }

    if (!foundValid) {
      console.log(`[-] Could not fetch data or invalid format for ${slug}`);
    }
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log("Finished updating posts.json");
}

processPosts().catch(console.error);

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'posts.json');
const READING_WORDS_PER_MINUTE = 220;

function parseCliArgs(argv) {
  const options = {
    token: process.env.GITHUB_TOKEN || ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--token') {
      options.token = argv[index + 1] || '';
      index += 1;
    }
  }

  return options;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 404) return res;
      if (res.status === 403) {
        console.warn(`[!] HTTP 403 on ${url}, rate limited. Waiting ${2000 * (i + 1)}ms before retry...`);
        await sleep(2000 * (i + 1)); // 2s, 4s, 6s backoff
        continue;
      }
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(1000 * (i + 1));
    }
  }
}

async function getLatestCommitDate(owner, repo, ref, filePath, githubToken) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(filePath)}&sha=${ref}&per_page=1`;
  const headers = { 'User-Agent': 'NodeJS' };
  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`;
  }

  const res = await fetchWithRetry(url, { headers });
  if (!res || !res.ok) return null;
  const data = await res.json();
  if (data && data.length > 0) {
    return new Date(data[0].commit.committer.date);
  }
  return null;
}

async function fetchGitHubContent(owner, repo, ref, filePath, githubToken) {
  if (!githubToken) {
    return null;
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`;
  const headers = {
    'User-Agent': 'NodeJS',
    'Authorization': `token ${githubToken}`,
    'Accept': 'application/vnd.github.v3.raw'
  };

  const res = await fetchWithRetry(url, { headers });
  if (!res || !res.ok) {
    return null;
  }

  return res.text();
}

function stripMarkdownForReadingMetrics(markdown) {
  return String(markdown || '')
    .replace(/^\uFEFF/, '')
    .replace(/^---[\t ]*\r?\n[\s\S]*?\r?\n---[\t ]*(?:\r?\n|$)/, '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]+`/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1 ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6})\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*\|/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[*_~]/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text) {
  const normalized = stripMarkdownForReadingMetrics(text);
  if (!normalized) {
    return 0;
  }

  const matches = normalized.match(/[\p{L}\p{N}][\p{L}\p{N}'’._-]*/gu);
  return matches ? matches.length : 0;
}

function formatReadingTime(wordCount) {
  const minutes = Math.max(1, Math.ceil(wordCount / READING_WORDS_PER_MINUTE));
  return `${minutes} min`;
}

async function processPosts(githubToken) {
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
      let text = await fetchGitHubContent(owner, repo, ref, filePath, githubToken);
      if (!text) {
        const contentRes = await fetchWithRetry(rawUrl);
        if (!contentRes || !contentRes.ok) continue;
        text = await contentRes.text();
      }
      if (!text.trim()) continue;

      const words = countWords(text);
      post.wordCount = words;
      post.readingTime = formatReadingTime(words);

      // 2. Fetch Commit Data for dates
      const commitDate = await getLatestCommitDate(owner, repo, ref, filePath, githubToken);
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

const cliOptions = parseCliArgs(process.argv.slice(2));
processPosts(cliOptions.token).catch(console.error);

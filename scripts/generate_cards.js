const fs = require('fs');
const path = require('path');

const username = process.env.GITHUB_USERNAME || 'Doulor';
const token = process.env.GITHUB_TOKEN || '';
const outDir = path.join(process.cwd(), 'assets');

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'Doulor-profile-card-generator',
};

if (token) headers.Authorization = `Bearer ${token}`;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function github(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
}

async function fetchAllRepos() {
  const repos = [];
  let page = 1;
  while (true) {
    const batch = await github(`https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=updated`);
    repos.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return repos.filter((repo) => !repo.fork);
}

function card(width, height, body) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFF7ED" stop-opacity="0.92"/>
      <stop offset="0.48" stop-color="#FED7AA" stop-opacity="0.62"/>
      <stop offset="1" stop-color="#FDBA74" stop-opacity="0.32"/>
    </linearGradient>
    <linearGradient id="orange" x1="0" y1="0" x2="${width}" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#EA580C"/>
      <stop offset="1" stop-color="#FDBA74"/>
    </linearGradient>
    <filter id="soft" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#9A3412" flood-opacity="0.13"/>
    </filter>
  </defs>
  <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="28" fill="url(#bg)" filter="url(#soft)"/>
  <circle cx="${width - 92}" cy="70" r="72" fill="#F97316" opacity="0.10"/>
  <circle cx="88" cy="${height - 54}" r="64" fill="#FB923C" opacity="0.10"/>
  ${body}
</svg>
`;
}

function metric(x, label, value) {
  return `<g transform="translate(${x} 190)">
    <rect width="150" height="74" rx="22" fill="#FFFFFF" fill-opacity="0.46"/>
    <text x="22" y="28" fill="#EA580C" font-family="Consolas, monospace" font-size="13" font-weight="700">${esc(label)}</text>
    <text x="22" y="58" fill="#431407" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="800">${esc(value)}</text>
  </g>`;
}

function statsSvg(user, repos) {
  const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const totalForks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
  const updated = new Date().toISOString().slice(0, 10);
  return card(1000, 310, `
  <text x="54" y="68" fill="#9A3412" font-family="Consolas, monospace" font-size="15" font-weight="700" letter-spacing="2">LIVE PROFILE CARD</text>
  <text x="54" y="116" fill="#431407" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="800">${esc(user.name || username)}</text>
  <text x="54" y="150" fill="#7C2D12" font-family="Segoe UI, Arial, sans-serif" font-size="17">AI assisted creation gallery</text>
  <text x="54" y="174" fill="#9A3412" font-family="Consolas, monospace" font-size="13">updated ${updated} · data from GitHub API</text>
  ${metric(54, 'repos', user.public_repos)}
  ${metric(224, 'stars', totalStars)}
  ${metric(394, 'forks', totalForks)}
  ${metric(564, 'followers', user.followers)}
  <g transform="translate(782 72)">
    <rect width="142" height="142" rx="36" fill="#FFFFFF" fill-opacity="0.42"/>
    <circle cx="71" cy="58" r="28" fill="#F97316" fill-opacity="0.18"/>
    <text x="32" y="62" fill="#EA580C" font-family="Consolas, monospace" font-size="22" font-weight="900">AI</text>
    <text x="27" y="104" fill="#9A3412" font-family="Consolas, monospace" font-size="14" font-weight="800">FIRST</text>
  </g>`);
}

function languagesSvg(repos) {
  const counts = new Map();
  for (const repo of repos) {
    if (!repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) || 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1;
  const colors = ['#EA580C', '#F97316', '#FB923C', '#FDBA74', '#FED7AA', '#C2410C', '#9A3412', '#7C2D12'];
  let offset = 54;
  const bars = entries.slice(0, 8).map(([lang, count], index) => {
    const width = Math.max(36, Math.round((count / total) * 650));
    const y = 124 + index * 31;
    return `<g>
      <text x="54" y="${y}" fill="#431407" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="700">${esc(lang)}</text>
      <rect x="190" y="${y - 15}" width="650" height="14" rx="7" fill="#FFFFFF" fill-opacity="0.52"/>
      <rect x="190" y="${y - 15}" width="${width}" height="14" rx="7" fill="${colors[index % colors.length]}" fill-opacity="0.9"/>
      <text x="860" y="${y}" fill="#9A3412" font-family="Consolas, monospace" font-size="13">${count}</text>
    </g>`;
  }).join('\n');

  const strip = entries.slice(0, 8).map(([, count], index) => {
    const width = Math.round((count / total) * 892);
    const segment = `<rect x="${offset}" y="82" width="${width}" height="16" fill="${colors[index % colors.length]}" opacity="0.9"/>`;
    offset += width;
    return segment;
  }).join('\n');

  return card(1000, 410, `
  <text x="54" y="62" fill="#9A3412" font-family="Consolas, monospace" font-size="15" font-weight="700" letter-spacing="2">LANGUAGE MIX</text>
  <text x="230" y="62" fill="#7C2D12" font-family="Segoe UI, Arial, sans-serif" font-size="14">counted by public repositories</text>
  <clipPath id="stripClip"><rect x="54" y="82" width="892" height="16" rx="8"/></clipPath>
  <g clip-path="url(#stripClip)">${strip}</g>
  ${bars}`);
}

function reposSvg(repos) {
  const names = [
    'AIExtension-for-Powertoys-CMDPalette',
    'Starfall',
    'Blog',
    'Home',
    'ElytraFlip',
    'DNSHE-Panel',
    'MC-web',
    'TBlog',
  ];
  const byName = new Map(repos.map((repo) => [repo.name, repo]));
  const selected = names.map((name) => byName.get(name)).filter(Boolean);
  const tiles = selected.map((repo, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 54 + col * 446;
    const y = 98 + row * 108;
    const desc = repo.description || 'AI assisted project';
    return `<g transform="translate(${x} ${y})">
      <rect width="404" height="82" rx="22" fill="#FFFFFF" fill-opacity="0.48"/>
      <text x="22" y="31" fill="#431407" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="800">${esc(repo.name)}</text>
      <text x="22" y="55" fill="#7C2D12" font-family="Segoe UI, Arial, sans-serif" font-size="13">${esc(desc.slice(0, 42))}${desc.length > 42 ? '...' : ''}</text>
      <text x="314" y="31" fill="#EA580C" font-family="Consolas, monospace" font-size="13" font-weight="700">star ${repo.stargazers_count}</text>
      <text x="314" y="55" fill="#9A3412" font-family="Consolas, monospace" font-size="13">${esc(repo.language || 'Mixed')}</text>
    </g>`;
  }).join('\n');

  return card(1000, 560, `
  <text x="54" y="64" fill="#9A3412" font-family="Consolas, monospace" font-size="15" font-weight="700" letter-spacing="2">PROJECT CARDS</text>
  <text x="220" y="64" fill="#7C2D12" font-family="Segoe UI, Arial, sans-serif" font-size="14">generated from GitHub API</text>
  ${tiles}`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const userFile = process.env.GITHUB_USER_JSON;
  const reposFile = process.env.GITHUB_REPOS_JSON;
  const [user, repos] = userFile && reposFile
    ? [
        JSON.parse(fs.readFileSync(userFile, 'utf8')),
        JSON.parse(fs.readFileSync(reposFile, 'utf8')).filter((repo) => !repo.fork),
      ]
    : await Promise.all([
        github(`https://api.github.com/users/${username}`),
        fetchAllRepos(),
      ]);
  fs.writeFileSync(path.join(outDir, 'stats.svg'), statsSvg(user, repos));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { prepareProjectExportData, generateHtmlDocument } from './html-generator';

export interface GitHubPublishConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
}

const STORAGE_KEY = 'web_guide_github_config';

export async function getGitHubConfig(): Promise<GitHubPublishConfig> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    return (
      res[STORAGE_KEY] || {
        token: '',
        owner: 'namlhn',
        repo: 'Web-Guide-Builder',
        branch: 'main',
      }
    );
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved
    ? JSON.parse(saved)
    : {
        token: '',
        owner: 'namlhn',
        repo: 'Web-Guide-Builder',
        branch: 'main',
      };
}

export async function saveGitHubConfig(config: GitHubPublishConfig): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: config });
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}

// Convert unicode string to base64
function utf8ToBase64(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    })
  );
}

// Slugify string for clean filename
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function publishProjectToGitHub(
  projectId: string,
  config: GitHubPublishConfig
): Promise<{ liveUrl: string; filename: string }> {
  const { token, owner, repo, branch = 'main' } = config;

  if (!token.trim()) {
    throw new Error('Vui lòng nhập GitHub Personal Access Token để xuất bản.');
  }
  if (!owner.trim() || !repo.trim()) {
    throw new Error('Vui lòng nhập thông tin Owner và Repository.');
  }

  // 1. Prepare export data & generate HTML
  const exportData = await prepareProjectExportData(projectId);
  const htmlContent = generateHtmlDocument(exportData);

  const slug = slugify(exportData.project.title) || 'tai-lieu-huong-dan';
  const filename = `${slug}.html`;
  const filePath = `docs/${filename}`;

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `Bearer ${token.trim()}`,
    'Content-Type': 'application/json',
  };

  // 2. Check if file already exists to get SHA
  let existingSha: string | undefined = undefined;
  try {
    const getRes = await fetch(`${apiUrl}?ref=${branch}`, { headers });
    if (getRes.ok) {
      const data = await getRes.json();
      existingSha = data.sha;
    }
  } catch (err) {
    console.warn('Could not fetch existing file sha:', err);
  }

  // 3. Put file into docs/ directory
  const base64Content = utf8ToBase64(htmlContent);
  const putBody = {
    message: `docs: xuất bản hướng dẫn "${exportData.project.title}"`,
    content: base64Content,
    branch,
    ...(existingSha ? { sha: existingSha } : {}),
  };

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(putBody),
  });

  if (!putRes.ok) {
    const errorJson = await putRes.json().catch(() => ({}));
    throw new Error(
      errorJson.message || `Lỗi từ GitHub API (${putRes.status}): Kiểm tra quyền Token và tên Repository`
    );
  }

  // Live URL on GitHub Pages
  const liveUrl = `https://${owner}.github.io/${repo}/docs/${filename}`;

  return { liveUrl, filename };
}

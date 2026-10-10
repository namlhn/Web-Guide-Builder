import { repo } from '../db/repository';
import { rasterizeAnnotationsToImage } from '../annotations/canvas';
import type { Project, Feature, GuideStep } from '../types';

// XSS sanitization helper
export function escapeHtml(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatVietnameseDate(timestamp: number): string {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${mins} ngày ${day}/${month}/${year}`;
}

export interface ExportData {
  project: Project;
  features: {
    feature: Feature;
    steps: {
      step: GuideStep;
      annotatedImageDataUrl: string;
    }[];
  }[];
}

export async function prepareProjectExportData(projectId: string): Promise<ExportData> {
  const project = await repo.getProject(projectId);
  if (!project) {
    throw new Error('Không tìm thấy dự án để xuất');
  }

  const features = await repo.getFeaturesByProject(projectId);
  const exportFeatures: ExportData['features'] = [];

  for (const feat of features) {
    const steps = await repo.getStepsByFeature(feat.id);
    const exportSteps: ExportData['features'][0]['steps'] = [];

    for (const step of steps) {
      let finalImg = '';
      if (step.imageId) {
        const stored = await repo.getImage(step.imageId);
        if (stored?.dataUrl) {
          // Rasterize annotations onto the screenshot copy
          finalImg = await rasterizeAnnotationsToImage(stored.dataUrl, step.annotations || []);
        }
      }

      exportSteps.push({
        step,
        annotatedImageDataUrl: finalImg,
      });
    }

    exportFeatures.push({
      feature: feat,
      steps: exportSteps,
    });
  }

  return { project, features: exportFeatures };
}

export function generateHtmlDocument(data: ExportData): string {
  const { project, features } = data;
  const exportedAt = formatVietnameseDate(Date.now());
  const safeProjectTitle = escapeHtml(project.title);
  const safeProjectDesc = escapeHtml(project.description);

  let totalSteps = 0;
  features.forEach((f) => (totalSteps += f.steps.length));

  // Build Table of Contents HTML
  const tocHtml = features
    .map((f, fIdx) => {
      const featTitle = escapeHtml(f.feature.title);
      const stepLinks = f.steps
        .map((s, sIdx) => {
          const stepTitle = escapeHtml(s.step.title);
          return `
            <a class="toc-step" href="#step-${s.step.id}">
              <span class="toc-step-num">${sIdx + 1}</span>
              <span class="toc-step-title">${stepTitle}</span>
            </a>
          `;
        })
        .join('');

      return `
        <div class="toc-group">
          <a class="toc-feat" href="#feature-${f.feature.id}">
            <span class="toc-feat-idx">${fIdx + 1}.</span>
            <span>${featTitle}</span>
          </a>
          <div class="toc-steps">${stepLinks}</div>
        </div>
      `;
    })
    .join('');

  // Build Main Content HTML
  let globalStepCounter = 1;
  const contentHtml = features
    .map((f, fIdx) => {
      const featTitle = escapeHtml(f.feature.title);
      const featDesc = escapeHtml(f.feature.description);

      const stepsHtml = f.steps
        .map((s) => {
          const stepTitle = escapeHtml(s.step.title);
          const stepDesc = escapeHtml(s.step.description).replace(/\n/g, '<br/>');
          const sourceUrl = s.step.sourceUrl ? escapeHtml(s.step.sourceUrl) : null;
          const currentCounter = globalStepCounter++;

          return `
            <article class="step-card" id="step-${s.step.id}">
              <header class="step-header">
                <div class="step-badge">Bước ${currentCounter}</div>
                <h3 class="step-title">${stepTitle}</h3>
              </header>

              ${
                sourceUrl
                  ? `<div class="step-meta">
                      <span class="meta-label">Đường dẫn trang:</span>
                      <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="meta-url">${sourceUrl}</a>
                    </div>`
                  : ''
              }

              ${
                s.annotatedImageDataUrl
                  ? `<div class="step-image-wrap">
                      <img src="${s.annotatedImageDataUrl}" alt="${stepTitle}" class="step-image" onclick="openLightbox(this.src)" />
                      <div class="image-hint">🔍 Nhấp vào ảnh để xem kích thước lớn</div>
                    </div>`
                  : `<div class="step-no-image">Không có ảnh chụp màn hình cho bước này</div>`
              }

              ${
                stepDesc
                  ? `<div class="step-body">
                      <div class="step-desc-title">Mô tả và thao tác thực hiện:</div>
                      <div class="step-desc">${stepDesc}</div>
                    </div>`
                  : ''
              }
            </article>
          `;
        })
        .join('');

      return `
        <section class="feature-section" id="feature-${f.feature.id}">
          <div class="feature-header">
            <span class="feature-tag">Tính năng ${fIdx + 1}</span>
            <h2 class="feature-title">${featTitle}</h2>
            ${featDesc ? `<p class="feature-desc">${featDesc}</p>` : ''}
          </div>
          <div class="steps-container">
            ${stepsHtml || '<div class="empty-steps">Chưa có bước hướng dẫn nào trong tính năng này.</div>'}
          </div>
        </section>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeProjectTitle} — Tài liệu hướng dẫn</title>
  <style>
    :root {
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --primary-light: #eff6ff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --bg-page: #f8fafc;
      --bg-card: #ffffff;
      --border-color: #e2e8f0;
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 14px;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.05);
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
      --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.03);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg-page);
      color: var(--text-main);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    /* Layout */
    .app-layout {
      display: flex;
      min-height: 100vh;
    }

    /* Sidebar / TOC */
    .sidebar {
      width: 320px;
      background: var(--bg-card);
      border-right: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      padding: 24px 16px;
      flex-shrink: 0;
    }

    .brand-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--primary);
      margin-bottom: 6px;
    }

    .sidebar-doc-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .toc-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 12px;
    }

    .toc-group {
      margin-bottom: 18px;
    }

    .toc-feat {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-main);
      text-decoration: none;
      padding: 6px 8px;
      border-radius: var(--radius-sm);
      transition: background 0.15s;
    }

    .toc-feat:hover {
      background: var(--primary-light);
      color: var(--primary);
    }

    .toc-feat-idx {
      color: var(--primary);
    }

    .toc-steps {
      margin-left: 12px;
      padding-left: 8px;
      border-left: 2px solid var(--border-color);
      margin-top: 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .toc-step {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-muted);
      text-decoration: none;
      padding: 5px 8px;
      border-radius: var(--radius-sm);
      transition: all 0.15s;
    }

    .toc-step:hover {
      background: var(--primary-light);
      color: var(--primary);
    }

    .toc-step-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #e2e8f0;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-main);
      flex-shrink: 0;
    }

    .toc-step:hover .toc-step-num {
      background: var(--primary);
      color: #fff;
    }

    .toc-step-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Main Content */
    .main-content {
      flex: 1;
      padding: 40px 48px;
      max-width: 1040px;
    }

    /* Cover / Header Banner */
    .doc-cover {
      background: var(--bg-card);
      border-radius: var(--radius-lg);
      padding: 36px 40px;
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-sm);
      margin-bottom: 40px;
    }

    .cover-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      background: var(--primary-light);
      color: var(--primary);
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .doc-main-title {
      font-size: 28px;
      font-weight: 800;
      color: var(--text-main);
      margin-bottom: 12px;
      line-height: 1.3;
    }

    .doc-description {
      font-size: 15px;
      color: var(--text-muted);
      margin-bottom: 24px;
    }

    .doc-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
      font-size: 13px;
      color: var(--text-muted);
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .stat-val {
      font-weight: 600;
      color: var(--text-main);
    }

    .btn-print {
      margin-left: auto;
      background: var(--primary);
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-print:hover {
      background: var(--primary-hover);
    }

    /* Feature Section */
    .feature-section {
      margin-bottom: 48px;
    }

    .feature-header {
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--border-color);
    }

    .feature-tag {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--primary);
      display: block;
      margin-bottom: 4px;
    }

    .feature-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 6px;
    }

    .feature-desc {
      font-size: 14px;
      color: var(--text-muted);
    }

    /* Steps */
    .steps-container {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .step-card {
      background: var(--bg-card);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      scroll-margin-top: 24px;
    }

    .step-header {
      padding: 18px 24px;
      background: #ffffff;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .step-badge {
      background: var(--primary);
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 20px;
      flex-shrink: 0;
    }

    .step-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-main);
    }

    .step-meta {
      padding: 8px 24px;
      background: #f8fafc;
      font-size: 13px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .meta-label {
      color: var(--text-muted);
      font-weight: 500;
    }

    .meta-url {
      color: var(--primary);
      text-decoration: none;
      word-break: break-all;
    }

    .meta-url:hover {
      text-decoration: underline;
    }

    .step-image-wrap {
      position: relative;
      background: #0f172a;
      text-align: center;
      padding: 12px;
    }

    .step-image {
      max-width: 100%;
      height: auto;
      border-radius: var(--radius-sm);
      display: block;
      margin: 0 auto;
      box-shadow: var(--shadow-md);
      cursor: zoom-in;
      transition: transform 0.2s;
    }

    .step-image:hover {
      transform: scale(1.005);
    }

    .image-hint {
      position: absolute;
      bottom: 18px;
      right: 20px;
      background: rgba(15, 23, 42, 0.75);
      color: #ffffff;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      backdrop-filter: blur(4px);
    }

    .step-no-image {
      padding: 40px;
      text-align: center;
      color: var(--text-muted);
      font-style: italic;
      background: #f1f5f9;
    }

    .step-body {
      padding: 20px 24px;
    }

    .step-desc-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .step-desc {
      font-size: 15px;
      color: #334155;
      line-height: 1.7;
    }

    .empty-steps {
      padding: 32px;
      text-align: center;
      color: var(--text-muted);
      background: #fff;
      border: 1px dashed var(--border-color);
      border-radius: var(--radius-md);
    }

    /* Lightbox Modal */
    .lightbox {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.88);
      z-index: 9999;
      justify-content: center;
      align-items: center;
      cursor: zoom-out;
      padding: 20px;
    }

    .lightbox.active {
      display: flex;
    }

    .lightbox-img {
      max-width: 95%;
      max-height: 95%;
      border-radius: 8px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }

    /* Print styling */
    @media print {
      .sidebar, .btn-print, .image-hint {
        display: none !important;
      }
      .main-content {
        padding: 0 !important;
        max-width: 100% !important;
      }
      .app-layout {
        display: block !important;
      }
      .step-card {
        page-break-inside: avoid;
        break-inside: avoid;
        border: 1px solid #ccc !important;
        margin-bottom: 24px !important;
      }
      .step-image-wrap {
        background: transparent !important;
        padding: 0 !important;
      }
      body {
        background: #ffffff !important;
      }
    }

    @media (max-width: 768px) {
      .app-layout {
        flex-direction: column;
      }
      .sidebar {
        width: 100%;
        height: auto;
        position: relative;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
      }
      .main-content {
        padding: 20px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="brand-title">Web Guide Builder</div>
      <div class="sidebar-doc-title">${safeProjectTitle}</div>
      <div class="toc-title">Mục lục hướng dẫn</div>
      <nav class="toc-nav">
        ${tocHtml}
      </nav>
    </aside>

    <main class="main-content">
      <header class="doc-cover">
        <span class="cover-badge">Tài liệu hướng dẫn trực quan</span>
        <h1 class="doc-main-title">${safeProjectTitle}</h1>
        ${safeProjectDesc ? `<p class="doc-description">${safeProjectDesc}</p>` : ''}
        <div class="doc-stats">
          <div class="stat-item">
            <span>Tính năng:</span>
            <span class="stat-val">${features.length}</span>
          </div>
          <div class="stat-item">
            <span>Tổng số bước:</span>
            <span class="stat-val">${totalSteps}</span>
          </div>
          <div class="stat-item">
            <span>Thời điểm xuất:</span>
            <span class="stat-val">${exportedAt}</span>
          </div>
          <button class="btn-print" onclick="window.print()">🖨️ In / Lưu PDF</button>
        </div>
      </header>

      ${contentHtml}
    </main>
  </div>

  <div id="lightbox" class="lightbox" onclick="closeLightbox()">
    <img id="lightbox-img" class="lightbox-img" src="" alt="Enlarged screenshot" />
  </div>

  <script>
    function openLightbox(src) {
      var box = document.getElementById('lightbox');
      var img = document.getElementById('lightbox-img');
      img.src = src;
      box.classList.add('active');
    }

    function closeLightbox() {
      var box = document.getElementById('lightbox');
      box.classList.remove('active');
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeLightbox();
    });
  </script>
</body>
</html>`;
}

// Download HTML file trigger in browser
export function downloadHtmlFile(filename: string, htmlContent: string) {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

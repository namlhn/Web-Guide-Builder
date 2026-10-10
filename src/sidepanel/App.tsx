import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Download,
  Upload,
  BookOpen,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
  Globe,
  Copy,
  Share2,
} from 'lucide-react';
import { repo } from '../db/repository';
import { seedDemoGuideProject } from '../db/demo-data';
import { prepareProjectExportData, generateHtmlDocument, downloadHtmlFile } from '../export/html-generator';
import {
  getGitHubConfig,
  saveGitHubConfig,
  publishProjectToGitHub,
  type GitHubPublishConfig,
} from '../export/github-publisher';
import type { Project, Feature, GuideStep, ExtensionMessage, MessageResponse } from '../types';
import '../shared/styles.css';
import './sidepanel.css';

export function SidePanelApp() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [features, setFeatures] = useState<Feature[]>([]);
  const [activeFeatureId, setActiveFeatureId] = useState<string>('');
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [stepThumbnails, setStepThumbnails] = useState<Record<string, string>>({});

  const [isCapturing, setIsCapturing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [projectModal, setProjectModal] = useState<{ open: boolean; mode: 'create' | 'edit'; title: string; desc: string } | null>(null);
  const [featureModal, setFeatureModal] = useState<{ open: boolean; mode: 'create' | 'edit'; id?: string; title: string; desc: string } | null>(null);
  const [stepModal, setStepModal] = useState<{ open: boolean; step: GuideStep | null; title: string; desc: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'project' | 'feature' | 'step'; id: string; name: string } | null>(null);
  const [githubModal, setGithubModal] = useState<{
    open: boolean;
    config: GitHubPublishConfig;
    isPublishing: boolean;
    publishedUrl?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Load all projects on startup
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async (preferredId?: string) => {
    try {
      const all = await repo.getAllProjects();
      setProjects(all);
      if (all.length > 0) {
        const nextId = preferredId && all.some((p) => p.id === preferredId) ? preferredId : all[0].id;
        setActiveProjectId(nextId);
      } else {
        setActiveProjectId('');
        setFeatures([]);
        setSteps([]);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Không thể tải danh sách dự án');
    }
  };

  // When activeProjectId changes, load its features
  useEffect(() => {
    if (!activeProjectId) {
      setFeatures([]);
      setActiveFeatureId('');
      return;
    }
    loadFeatures();
  }, [activeProjectId]);

  const loadFeatures = async (preferredFeatureId?: string) => {
    try {
      const feats = await repo.getFeaturesByProject(activeProjectId);
      setFeatures(feats);
      if (feats.length > 0) {
        const nextFeatId =
          preferredFeatureId && feats.some((f) => f.id === preferredFeatureId)
            ? preferredFeatureId
            : feats[0].id;
        setActiveFeatureId(nextFeatId);
      } else {
        setActiveFeatureId('');
        setSteps([]);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Không thể tải danh sách tính năng');
    }
  };

  // When activeFeatureId changes, load its steps
  useEffect(() => {
    if (!activeFeatureId) {
      setSteps([]);
      return;
    }
    loadSteps();
  }, [activeFeatureId]);

  const loadSteps = async () => {
    try {
      const st = await repo.getStepsByFeature(activeFeatureId);
      setSteps(st);

      // Fetch thumbnails
      const thumbs: Record<string, string> = {};
      for (const step of st) {
        if (step.imageId) {
          const img = await repo.getImage(step.imageId);
          if (img?.dataUrl) {
            thumbs[step.id] = img.dataUrl;
          }
        }
      }
      setStepThumbnails(thumbs);
    } catch (err) {
      console.error(err);
      showToast('error', 'Không thể tải các bước hướng dẫn');
    }
  };

  // ================= CAPTURE WORKFLOW =================
  const handleCaptureStep = async () => {
    if (!activeProjectId) {
      showToast('error', 'Vui lòng chọn hoặc tạo dự án trước khi chụp');
      return;
    }
    if (!activeFeatureId) {
      showToast('error', 'Vui lòng chọn hoặc tạo một tính năng trước khi chụp');
      return;
    }

    if (isCapturing) return;
    setIsCapturing(true);

    try {
      // Check if running in Chrome Extension environment
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const response: MessageResponse<{ dataUrl: string; sourceUrl?: string; tabTitle?: string }> =
          await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'CAPTURE_ACTIVE_TAB' } as ExtensionMessage, (res) => {
              resolve(res || { success: false, error: 'Không nhận được phản hồi từ tiện ích' });
            });
          });

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Lỗi chụp màn hình');
        }

        const { dataUrl, sourceUrl, tabTitle } = response.data;

        // Measure image natural dimensions
        const dims = await getImageDimensions(dataUrl);

        // Save image to DB
        const savedImg = await repo.saveImage(dataUrl, dims.width, dims.height);

        // Create step
        const stepNum = steps.length + 1;
        const newStep = await repo.createStep({
          featureId: activeFeatureId,
          title: tabTitle ? `Bước ${stepNum}: ${tabTitle}` : `Bước ${stepNum}`,
          description: '',
          imageId: savedImg.id,
          sourceUrl: sourceUrl,
        });

        await loadSteps();
        showToast('success', `Đã chụp và thêm "${newStep.title}" thành công!`);
      } else {
        throw new Error('Tính năng chụp tự động chỉ hoạt động khi chạy tiện ích trên Chrome/Edge.');
      }
    } catch (err) {
      console.error(err);
      showToast('error', err instanceof Error ? err.message : 'Chụp màn hình thất bại');
    } finally {
      setIsCapturing(false);
    }
  };

  // Helper to load natural width/height from data URL
  const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 1024, height: img.naturalHeight || 640 });
      img.onerror = () => resolve({ width: 1024, height: 640 });
      img.src = dataUrl;
    });
  };

  // File upload fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!activeFeatureId) {
      showToast('error', 'Vui lòng chọn hoặc tạo tính năng trước');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const dims = await getImageDimensions(dataUrl);
        const savedImg = await repo.saveImage(dataUrl, dims.width, dims.height);

        const stepNum = steps.length + 1;
        const newStep = await repo.createStep({
          featureId: activeFeatureId,
          title: `Bước ${stepNum}: ${file.name.replace(/\.[^/.]+$/, '')}`,
          description: '',
          imageId: savedImg.id,
        });

        await loadSteps();
        showToast('success', `Đã tải ảnh lên và tạo "${newStep.title}"`);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      showToast('error', 'Tải ảnh thất bại');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Open Step in Editor tab
  const handleOpenEditor = (stepId: string) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'OPEN_EDITOR', stepId } as ExtensionMessage);
    } else {
      window.open(`editor.html?stepId=${stepId}`, '_blank');
    }
  };

  // Reordering steps
  const handleMoveStep = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;

    setSteps(newSteps);
    await repo.reorderSteps(
      activeFeatureId,
      newSteps.map((s) => s.id)
    );
  };

  // Reordering features
  const handleMoveFeature = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= features.length) return;

    const newFeats = [...features];
    const temp = newFeats[index];
    newFeats[index] = newFeats[targetIndex];
    newFeats[targetIndex] = temp;

    setFeatures(newFeats);
    await repo.reorderFeatures(
      activeProjectId,
      newFeats.map((f) => f.id)
    );
  };

  // Export HTML
  const handleExportHtml = async () => {
    if (!activeProjectId) {
      showToast('error', 'Vui lòng chọn một dự án để xuất');
      return;
    }

    setIsExporting(true);
    try {
      const currentProj = projects.find((p) => p.id === activeProjectId);
      const exportData = await prepareProjectExportData(activeProjectId);
      const htmlString = generateHtmlDocument(exportData);

      const cleanTitle = (currentProj?.title || 'Huong-Dan')
        .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/g, '-')
        .replace(/-+/g, '-');
      const filename = `${cleanTitle}-huong-dan.html`;

      downloadHtmlFile(filename, htmlString);
      showToast('success', `Đã xuất tài liệu HTML thành công: ${filename}`);
    } catch (err) {
      console.error(err);
      showToast('error', err instanceof Error ? err.message : 'Xuất tài liệu HTML thất bại');
    } finally {
      setIsExporting(false);
    }
  };

  // Seed demo data
  const handleSeedDemo = async () => {
    try {
      const demoProj = await seedDemoGuideProject();
      await loadProjects(demoProj.id);
      showToast('success', 'Đã khởi tạo tài liệu mẫu thành công!');
    } catch (err) {
      console.error(err);
      showToast('error', 'Khởi tạo tài liệu mẫu thất bại');
    }
  };

  // Open GitHub publish modal
  const handleOpenGitHubModal = async () => {
    const config = await getGitHubConfig();
    setGithubModal({
      open: true,
      config,
      isPublishing: false,
      publishedUrl: undefined,
    });
  };

  // Publish to GitHub Pages
  const handlePublishGitHub = async () => {
    if (!githubModal || !activeProjectId) return;
    setGithubModal((prev) => (prev ? { ...prev, isPublishing: true } : null));

    try {
      await saveGitHubConfig(githubModal.config);
      const res = await publishProjectToGitHub(activeProjectId, githubModal.config);
      setGithubModal((prev) =>
        prev
          ? {
              ...prev,
              isPublishing: false,
              publishedUrl: res.liveUrl,
            }
          : null
      );
      // Auto copy to clipboard
      await navigator.clipboard.writeText(res.liveUrl);
      showToast('success', 'Đã xuất bản lên GitHub Pages & sao chép link!');
    } catch (err) {
      console.error(err);
      setGithubModal((prev) => (prev ? { ...prev, isPublishing: false } : null));
      showToast('error', err instanceof Error ? err.message : 'Xuất bản lên GitHub thất bại');
    }
  };

  const currentProject = projects.find((p) => p.id === activeProjectId);
  const currentFeature = features.find((f) => f.id === activeFeatureId);

  return (
    <div className="sidepanel-root">
      {/* Toast Alert */}
      {toast && (
        <div className={`toast-bar ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="panel-header">
        <div className="panel-brand">
          <BookOpen className="brand-icon" size={20} />
          <div>
            <h1 className="brand-text">Web Guide Builder</h1>
            <span className="brand-sub">Tạo tài liệu hướng dẫn nhanh</span>
          </div>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          title="Tạo bộ hướng dẫn mẫu để trải nghiệm"
          onClick={handleSeedDemo}
        >
          <Sparkles size={14} className="text-warning" />
          <span>Dữ liệu mẫu</span>
        </button>
      </header>

      {/* Project Selector Bar */}
      <section className="section-card">
        <div className="section-row">
          <label className="form-label mb-0">Dự án:</label>
          <div className="flex-1 flex gap-2">
            <select
              className="form-select project-dropdown"
              value={activeProjectId}
              onChange={(e) => setActiveProjectId(e.target.value)}
            >
              {projects.length === 0 && <option value="">(Chưa có dự án)</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            <button
              className="btn btn-secondary btn-sm"
              title="Tạo dự án mới"
              onClick={() => setProjectModal({ open: true, mode: 'create', title: '', desc: '' })}
            >
              <Plus size={15} />
            </button>

            {currentProject && (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  title="Sửa tên dự án"
                  onClick={() =>
                    setProjectModal({
                      open: true,
                      mode: 'edit',
                      title: currentProject.title,
                      desc: currentProject.description || '',
                    })
                  }
                >
                  <Edit2 size={13} />
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  title="Xóa dự án"
                  onClick={() =>
                    setDeleteConfirm({
                      type: 'project',
                      id: currentProject.id,
                      name: currentProject.title,
                    })
                  }
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Feature Selector / Tabs */}
      {currentProject ? (
        <section className="section-card">
          <div className="flex items-center justify-between mb-2">
            <span className="section-title">
              <Layers size={14} />
              <span>Tính năng / Nhóm bước ({features.length})</span>
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() =>
                setFeatureModal({
                  open: true,
                  mode: 'create',
                  title: '',
                  desc: '',
                })
              }
            >
              <Plus size={13} />
              <span>Thêm tính năng</span>
            </button>
          </div>

          {features.length === 0 ? (
            <div className="empty-box">
              <p>Chưa có tính năng nào trong dự án này.</p>
              <button
                className="btn btn-primary btn-sm mt-2"
                onClick={() =>
                  setFeatureModal({
                    open: true,
                    mode: 'create',
                    title: '1. Khởi đầu',
                    desc: '',
                  })
                }
              >
                + Thêm tính năng đầu tiên
              </button>
            </div>
          ) : (
            <div className="features-list">
              {features.map((feat, idx) => (
                <div
                  key={feat.id}
                  className={`feature-item ${feat.id === activeFeatureId ? 'feature-item-active' : ''}`}
                  onClick={() => setActiveFeatureId(feat.id)}
                >
                  <div className="feature-info">
                    <span className="feature-idx">{idx + 1}.</span>
                    <span className="feature-name">{feat.title}</span>
                  </div>

                  <div className="feature-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="icon-btn"
                      title="Chuyển lên"
                      disabled={idx === 0}
                      onClick={() => handleMoveFeature(idx, 'up')}
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      className="icon-btn"
                      title="Chuyển xuống"
                      disabled={idx === features.length - 1}
                      onClick={() => handleMoveFeature(idx, 'down')}
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      className="icon-btn"
                      title="Đổi tên tính năng"
                      onClick={() =>
                        setFeatureModal({
                          open: true,
                          mode: 'edit',
                          id: feat.id,
                          title: feat.title,
                          desc: feat.description || '',
                        })
                      }
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      className="icon-btn text-danger"
                      title="Xóa tính năng"
                      onClick={() =>
                        setDeleteConfirm({
                          type: 'feature',
                          id: feat.id,
                          name: feat.title,
                        })
                      }
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* Capture Actions Bar */}
      {currentFeature && (
        <section className="section-card capture-card">
          <div className="capture-header">
            <span className="active-feat-label">Đang ghi nhận cho: <strong>{currentFeature.title}</strong></span>
          </div>

          <div className="capture-buttons">
            <button
              className="btn btn-primary btn-capture"
              disabled={isCapturing}
              onClick={handleCaptureStep}
            >
              {isCapturing ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>Đang chụp tab...</span>
                </>
              ) : (
                <>
                  <Camera size={16} />
                  <span>Chụp bước mới</span>
                </>
              )}
            </button>

            <button
              className="btn btn-secondary btn-sm"
              title="Tải ảnh có sẵn từ máy tính"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              <span>Tải ảnh</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>
          <p className="capture-tip">
            Mở website cần hướng dẫn trên tab chính, sau đó bấm <strong>Chụp bước mới</strong> để tự động chụp và gắn bước.
          </p>
        </section>
      )}

      {/* Steps List */}
      {currentFeature && (
        <section className="section-card flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="section-title">
              <FileText size={14} />
              <span>Danh sách các bước ({steps.length})</span>
            </span>
          </div>

          {steps.length === 0 ? (
            <div className="empty-box">
              <Camera size={28} className="text-gray-400 mb-1" />
              <p>Chưa có bước nào trong tính năng này.</p>
              <p className="text-sm text-gray-500">Bấm "Chụp bước mới" ở trên để chụp màn hình đầu tiên.</p>
            </div>
          ) : (
            <div className="steps-list">
              {steps.map((step, idx) => (
                <div key={step.id} className="step-item">
                  <div className="step-thumb-wrap">
                    {stepThumbnails[step.id] ? (
                      <img src={stepThumbnails[step.id]} alt="" className="step-thumb" />
                    ) : (
                      <div className="step-thumb-empty">Không có ảnh</div>
                    )}
                    <span className="step-badge-num">{idx + 1}</span>
                  </div>

                  <div className="step-item-info">
                    <h4 className="step-item-title">{step.title}</h4>
                    {step.description && <p className="step-item-desc">{step.description}</p>}
                    <span className="step-item-anno-count">
                      {step.annotations.length > 0
                        ? `📌 ${step.annotations.length} chú thích`
                        : 'Chưa có chú thích'}
                    </span>
                  </div>

                  <div className="step-item-actions">
                    <button
                      className="btn btn-primary btn-sm btn-edit-anno"
                      title="Mở trình vẽ chú thích ảnh"
                      onClick={() => handleOpenEditor(step.id)}
                    >
                      <ExternalLink size={12} />
                      <span>Biên tập</span>
                    </button>

                    <div className="step-item-sub-actions">
                      <button
                        className="icon-btn"
                        title="Chuyển lên"
                        disabled={idx === 0}
                        onClick={() => handleMoveStep(idx, 'up')}
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        className="icon-btn"
                        title="Chuyển xuống"
                        disabled={idx === steps.length - 1}
                        onClick={() => handleMoveStep(idx, 'down')}
                      >
                        <ChevronDown size={13} />
                      </button>
                      <button
                        className="icon-btn"
                        title="Sửa tên / mô tả bước"
                        onClick={() =>
                          setStepModal({
                            open: true,
                            step,
                            title: step.title,
                            desc: step.description || '',
                          })
                        }
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="icon-btn text-danger"
                        title="Xóa bước này"
                        onClick={() =>
                          setDeleteConfirm({
                            type: 'step',
                            id: step.id,
                            name: step.title,
                          })
                        }
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Bottom Actions Footer */}
      <footer className="panel-footer">
        <div className="flex gap-2">
          <button
            className="btn btn-secondary flex-1"
            disabled={!activeProjectId || isExporting}
            onClick={handleExportHtml}
            title="Tải file HTML về máy tính (hoạt động offline)"
          >
            {isExporting ? (
              <>
                <RefreshCw size={15} className="spin" />
                <span>Đang kết xuất...</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span>Tải HTML</span>
              </>
            )}
          </button>

          <button
            className="btn btn-primary flex-1"
            disabled={!activeProjectId}
            onClick={handleOpenGitHubModal}
            title="Xuất bản lên GitHub Pages & lấy đường link chia sẻ"
          >
            <Globe size={15} />
            <span>Tạo link online</span>
          </button>
        </div>
      </footer>

      {/* ================= MODALS ================= */}

      {/* Project Modal */}
      {projectModal?.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                {projectModal.mode === 'create' ? 'Tạo dự án hướng dẫn mới' : 'Chỉnh sửa thông tin dự án'}
              </h3>
            </div>
            <div className="modal-body">
              <div>
                <label className="form-label">Tên dự án / Tài liệu (*):</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Hướng dẫn quản trị hệ thống"
                  value={projectModal.title}
                  onChange={(e) => setProjectModal({ ...projectModal, title: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label">Mô tả tổng quan:</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Mô tả mục đích của tài liệu..."
                  value={projectModal.desc}
                  onChange={(e) => setProjectModal({ ...projectModal, desc: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setProjectModal(null)}>
                Hủy
              </button>
              <button
                className="btn btn-primary"
                disabled={!projectModal.title.trim()}
                onClick={async () => {
                  if (projectModal.mode === 'create') {
                    const newP = await repo.createProject({
                      title: projectModal.title,
                      description: projectModal.desc,
                    });
                    // Create an initial default feature for convenience
                    await repo.createFeature({
                      projectId: newP.id,
                      title: '1. Hướng dẫn ban đầu',
                    });
                    await loadProjects(newP.id);
                    showToast('success', `Đã tạo dự án "${newP.title}"`);
                  } else if (activeProjectId) {
                    await repo.updateProject(activeProjectId, {
                      title: projectModal.title,
                      description: projectModal.desc,
                    });
                    await loadProjects(activeProjectId);
                    showToast('success', 'Đã cập nhật dự án');
                  }
                  setProjectModal(null);
                }}
              >
                Lưu dự án
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature Modal */}
      {featureModal?.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                {featureModal.mode === 'create' ? 'Thêm tính năng / nhóm bước mới' : 'Chỉnh sửa tính năng'}
              </h3>
            </div>
            <div className="modal-body">
              <div>
                <label className="form-label">Tên tính năng (*):</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: 1. Đăng nhập hệ thống"
                  value={featureModal.title}
                  onChange={(e) => setFeatureModal({ ...featureModal, title: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label">Mô tả tính năng:</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Mô tả các thao tác trong phần này..."
                  value={featureModal.desc}
                  onChange={(e) => setFeatureModal({ ...featureModal, desc: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setFeatureModal(null)}>
                Hủy
              </button>
              <button
                className="btn btn-primary"
                disabled={!featureModal.title.trim()}
                onClick={async () => {
                  if (featureModal.mode === 'create') {
                    const newF = await repo.createFeature({
                      projectId: activeProjectId,
                      title: featureModal.title,
                      description: featureModal.desc,
                    });
                    await loadFeatures(newF.id);
                    showToast('success', `Đã thêm tính năng "${newF.title}"`);
                  } else if (featureModal.id) {
                    await repo.updateFeature(featureModal.id, {
                      title: featureModal.title,
                      description: featureModal.desc,
                    });
                    await loadFeatures(featureModal.id);
                    showToast('success', 'Đã cập nhật tính năng');
                  }
                  setFeatureModal(null);
                }}
              >
                Lưu tính năng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step Modal */}
      {stepModal?.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Chỉnh sửa thông tin bước</h3>
            </div>
            <div className="modal-body">
              <div>
                <label className="form-label">Tiêu đề bước (*):</label>
                <input
                  type="text"
                  className="form-input"
                  value={stepModal.title}
                  onChange={(e) => setStepModal({ ...stepModal, title: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label">Mô tả / Thao tác người dùng:</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Ví dụ: Nhấn vào nút 'Đăng nhập', điền email và mật khẩu rồi bấm Tiếp tục..."
                  value={stepModal.desc}
                  onChange={(e) => setStepModal({ ...stepModal, desc: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStepModal(null)}>
                Hủy
              </button>
              <button
                className="btn btn-primary"
                disabled={!stepModal.title.trim()}
                onClick={async () => {
                  if (stepModal.step) {
                    await repo.updateStep(stepModal.step.id, {
                      title: stepModal.title,
                      description: stepModal.desc,
                    });
                    await loadSteps();
                    showToast('success', 'Đã cập nhật thông tin bước');
                  }
                  setStepModal(null);
                }}
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title text-danger">Xác nhận xóa</h3>
            </div>
            <div className="modal-body">
              <p>
                Bạn có chắc chắn muốn xóa{' '}
                <strong>
                  {deleteConfirm.type === 'project'
                    ? `toàn bộ dự án "${deleteConfirm.name}"`
                    : deleteConfirm.type === 'feature'
                    ? `tính năng "${deleteConfirm.name}"`
                    : `bước "${deleteConfirm.name}"`}
                </strong>
                ?
              </p>
              <p className="text-sm text-gray-500">
                Thao tác này sẽ dọn dẹp các ảnh chụp màn hình liên quan và không thể khôi phục lại.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Hủy
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  if (deleteConfirm.type === 'project') {
                    await repo.deleteProject(deleteConfirm.id);
                    await loadProjects();
                    showToast('success', 'Đã xóa dự án thành công');
                  } else if (deleteConfirm.type === 'feature') {
                    await repo.deleteFeature(deleteConfirm.id);
                    await loadFeatures();
                    showToast('success', 'Đã xóa tính năng');
                  } else if (deleteConfirm.type === 'step') {
                    await repo.deleteStep(deleteConfirm.id);
                    await loadSteps();
                    showToast('success', 'Đã xóa bước');
                  }
                  setDeleteConfirm(null);
                }}
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Pages Publish Modal */}
      {githubModal?.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2">
                <Globe size={18} className="text-primary" />
                <span>Xuất bản &amp; Chia sẻ qua GitHub Pages</span>
              </h3>
            </div>
            <div className="modal-body">
              {githubModal.publishedUrl ? (
                <div className="p-3 bg-success-light border border-success rounded-md">
                  <div className="flex items-center gap-2 text-success font-semibold mb-2">
                    <CheckCircle2 size={18} />
                    <span>Đã xuất bản thành công!</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    GitHub Pages đang kích hoạt liên kết cho tài liệu của bạn (thường mất từ 30s - 1 phút):
                  </p>
                  <div className="p-2 bg-white border border-gray-300 rounded text-xs font-mono break-all mb-3 text-primary">
                    {githubModal.publishedUrl}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-primary btn-sm flex-1"
                      onClick={() => {
                        navigator.clipboard.writeText(githubModal.publishedUrl || '');
                        showToast('success', 'Đã sao chép liên kết vào clipboard!');
                      }}
                    >
                      <Copy size={13} />
                      <span>Sao chép link</span>
                    </button>
                    <a
                      href={githubModal.publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm flex-1"
                    >
                      <ExternalLink size={13} />
                      <span>Mở xem trang</span>
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-600">
                    Tiện ích sẽ tự động đẩy file HTML vào thư mục <code>docs/</code> trên GitHub của bạn. GitHub Pages sẽ tự động tạo đường link công khai để chia sẻ cho bất kỳ ai.
                  </p>

                  <div>
                    <label className="form-label">GitHub Personal Access Token (*):</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="ghp_xxxxxxxxxxxx hoặc github_pat_xxxx"
                      value={githubModal.config.token}
                      onChange={(e) =>
                        setGithubModal({
                          ...githubModal,
                          config: { ...githubModal.config, token: e.target.value },
                        })
                      }
                    />
                    <div className="flex justify-between items-center mt-1">
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo&description=Web-Guide-Builder-Token"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        🔗 Nhấp để tạo Token trên GitHub (quyền repo)
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="form-label">Tài khoản GitHub:</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="namlhn"
                        value={githubModal.config.owner}
                        onChange={(e) =>
                          setGithubModal({
                            ...githubModal,
                            config: { ...githubModal.config, owner: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="form-label">Tên Repository:</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Web-Guide-Builder"
                        value={githubModal.config.repo}
                        onChange={(e) =>
                          setGithubModal({
                            ...githubModal,
                            config: { ...githubModal.config, repo: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                disabled={githubModal.isPublishing}
                onClick={() => setGithubModal(null)}
              >
                Đóng
              </button>
              {!githubModal.publishedUrl && (
                <button
                  className="btn btn-primary"
                  disabled={
                    githubModal.isPublishing ||
                    !githubModal.config.token.trim() ||
                    !githubModal.config.owner.trim() ||
                    !githubModal.config.repo.trim()
                  }
                  onClick={handlePublishGitHub}
                >
                  {githubModal.isPublishing ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Đang tải lên GitHub...</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={15} />
                      <span>Xuất bản ngay</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

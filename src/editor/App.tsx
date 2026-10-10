import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MousePointer,
  Square,
  ArrowRight,
  ListOrdered,
  Type,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Download,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { repo } from '../db/repository';
import { drawAnnotation, hitTestAnnotation } from '../annotations/canvas';
import { prepareProjectExportData, generateHtmlDocument, downloadHtmlFile } from '../export/html-generator';
import type { Project, Feature, GuideStep, StoredImage, Annotation, AnnotationStyle } from '../types';
import '../shared/styles.css';
import './editor.css';

type EditorTool = 'select' | 'rectangle' | 'arrow' | 'number' | 'text';

const COLOR_PALETTE = [
  { name: 'Đỏ', hex: '#ef4444' },
  { name: 'Xanh dương', hex: '#2563eb' },
  { name: 'Xanh lá', hex: '#10b981' },
  { name: 'Vàng cam', hex: '#f59e0b' },
  { name: 'Tím', hex: '#8b5cf6' },
  { name: 'Đen xám', hex: '#0f172a' },
  { name: 'Trắng', hex: '#ffffff' },
];

export function EditorApp() {
  const [stepId, setStepId] = useState<string>('');
  const [step, setStep] = useState<GuideStep | null>(null);
  const [feature, setFeature] = useState<Feature | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [allStepsInFeature, setAllStepsInFeature] = useState<GuideStep[]>([]);
  const [image, setImage] = useState<StoredImage | null>(null);

  // Annotations & History
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<{ past: Annotation[][]; future: Annotation[][] }>({
    past: [],
    future: [],
  });

  // Current editing state
  const [tool, setTool] = useState<EditorTool>('rectangle');
  const [activeColor, setActiveColor] = useState<string>('#ef4444');
  const [lineWidth, setLineWidth] = useState<number>(3);
  const [fontSize, setFontSize] = useState<number>(14);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Canvas interaction refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgElementRef = useRef<HTMLImageElement | null>(null);
  const isInteractingRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const tempAnnoRef = useRef<Annotation | null>(null);
  const draggingAnnoRef = useRef<{ id: string; startX: number; startY: number; origAnno: Annotation } | null>(null);

  // Show Toast
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // 1. Initial Load from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('stepId');
    if (id) {
      setStepId(id);
      loadStepData(id);
    } else {
      loadFallbackStep();
    }
  }, []);

  const loadFallbackStep = async () => {
    try {
      const projects = await repo.getAllProjects();
      if (projects.length > 0) {
        const feats = await repo.getFeaturesByProject(projects[0].id);
        if (feats.length > 0) {
          const steps = await repo.getStepsByFeature(feats[0].id);
          if (steps.length > 0) {
            setStepId(steps[0].id);
            loadStepData(steps[0].id);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadStepData = async (targetStepId: string) => {
    try {
      const currentStep = await repo.getStep(targetStepId);
      if (!currentStep) return;

      setStep(currentStep);
      setTitle(currentStep.title);
      setDescription(currentStep.description);
      setSourceUrl(currentStep.sourceUrl || '');
      setAnnotations(currentStep.annotations || []);
      setHistory({ past: [], future: [] });
      setSelectedId(null);

      // Load feature & project
      const currentFeat = await repo.getFeature(currentStep.featureId);
      if (currentFeat) {
        setFeature(currentFeat);
        const currentProj = await repo.getProject(currentFeat.projectId);
        if (currentProj) setProject(currentProj);

        const siblingSteps = await repo.getStepsByFeature(currentFeat.id);
        setAllStepsInFeature(siblingSteps);
      }

      // Load image
      if (currentStep.imageId) {
        const currentImg = await repo.getImage(currentStep.imageId);
        if (currentImg) {
          setImage(currentImg);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Không thể tải dữ liệu bước');
    }
  };

  // Switch step
  const handleSwitchStep = (targetId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('stepId', targetId);
    window.history.pushState({}, '', url.toString());
    setStepId(targetId);
    loadStepData(targetId);
  };

  // Push to history
  const updateAnnotationsWithHistory = (newAnnotations: Annotation[]) => {
    setHistory((prev) => ({
      past: [...prev.past, annotations],
      future: [],
    }));
    setAnnotations(newAnnotations);
  };

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (history.past.length === 0) return;
    const previous = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, history.past.length - 1);

    setHistory({
      past: newPast,
      future: [annotations, ...history.future],
    });
    setAnnotations(previous);
    setSelectedId(null);
  }, [history, annotations]);

  const handleRedo = useCallback(() => {
    if (history.future.length === 0) return;
    const next = history.future[0];
    const newFuture = history.future.slice(1);

    setHistory({
      past: [...history.past, annotations],
      future: newFuture,
    });
    setAnnotations(next);
    setSelectedId(null);
  }, [history, annotations]);

  // Keyboard shortcuts (Undo, Redo, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, handleUndo, handleRedo]);

  // Delete selected annotation
  const handleDeleteSelected = () => {
    if (!selectedId) return;
    const remaining = annotations.filter((a) => a.id !== selectedId);
    updateAnnotationsWithHistory(remaining);
    setSelectedId(null);
  };

  // Clear all annotations
  const handleClearAll = () => {
    if (annotations.length === 0) return;
    if (window.confirm('Bạn có chắc muốn xóa tất cả các chú thích trên ảnh này?')) {
      updateAnnotationsWithHistory([]);
      setSelectedId(null);
    }
  };

  // Redraw Canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgElementRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const naturalWidth = imgElementRef.current.naturalWidth || 1024;
    const naturalHeight = imgElementRef.current.naturalHeight || 640;
    const scaleX = canvas.width / naturalWidth;
    const scaleY = canvas.height / naturalHeight;

    const rc = {
      ctx,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      scaleX,
      scaleY,
      selectedId,
    };

    // Draw committed annotations
    for (const anno of annotations) {
      drawAnnotation(anno, rc);
    }

    // Draw in-progress temporary annotation
    if (tempAnnoRef.current) {
      drawAnnotation(tempAnnoRef.current, rc);
    }
  }, [annotations, selectedId]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas, annotations, selectedId]);

  // Adjust canvas size when image loads or window resizes
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    imgElementRef.current = img;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
      redrawCanvas();
    }
  };

  // Re-sync canvas dimensions on container resize or zoom change
  useEffect(() => {
    const img = imgElementRef.current;
    const canvas = canvasRef.current;
    if (img && canvas) {
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
      redrawCanvas();
    }
  }, [zoomLevel, redrawCanvas]);

  // Helper to get normalized 0..1 coordinates from pointer event
  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const nx = Math.max(0, Math.min(1, px / canvas.width));
    const ny = Math.max(0, Math.min(1, py / canvas.height));
    return { x: nx, y: ny };
  };

  // ================= POINTER / DRAWING INTERACTIONS =================
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = getNormalizedPoint(e);
    isInteractingRef.current = true;
    startPosRef.current = p;

    if (tool === 'select') {
      // Find clicked annotation
      let found: Annotation | null = null;
      // Search from top-most (reverse order)
      for (let i = annotations.length - 1; i >= 0; i--) {
        if (hitTestAnnotation(annotations[i], p.x, p.y)) {
          found = annotations[i];
          break;
        }
      }

      if (found) {
        setSelectedId(found.id);
        draggingAnnoRef.current = {
          id: found.id,
          startX: p.x,
          startY: p.y,
          origAnno: { ...found },
        };
      } else {
        setSelectedId(null);
        draggingAnnoRef.current = null;
      }
      return;
    }

    if (tool === 'number') {
      // Calculate next available number marker
      const existingNumbers = annotations
        .filter((a) => a.type === 'number' && typeof a.number === 'number')
        .map((a) => a.number as number);
      const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

      const newAnno: Annotation = {
        id: `anno_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'number',
        x: p.x,
        y: p.y,
        number: nextNum,
        style: { color: activeColor },
      };

      updateAnnotationsWithHistory([...annotations, newAnno]);
      setSelectedId(newAnno.id);
      isInteractingRef.current = false;
      return;
    }

    if (tool === 'text') {
      const promptText = window.prompt('Nhập nội dung ghi chú:', 'Lưu ý bước này');
      if (promptText && promptText.trim()) {
        const newAnno: Annotation = {
          id: `anno_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'text',
          x: p.x,
          y: p.y,
          text: promptText.trim(),
          style: { color: activeColor, fontSize: fontSize },
        };
        updateAnnotationsWithHistory([...annotations, newAnno]);
        setSelectedId(newAnno.id);
      }
      isInteractingRef.current = false;
      return;
    }

    // Rectangle or Arrow: start drawing
    const style: AnnotationStyle = {
      color: activeColor,
      lineWidth: lineWidth,
    };

    if (tool === 'rectangle') {
      tempAnnoRef.current = {
        id: 'temp',
        type: 'rectangle',
        x: p.x,
        y: p.y,
        width: 0.001,
        height: 0.001,
        style,
      };
    } else if (tool === 'arrow') {
      tempAnnoRef.current = {
        id: 'temp',
        type: 'arrow',
        x: p.x,
        y: p.y,
        x2: p.x,
        y2: p.y,
        style,
      };
    }
    redrawCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isInteractingRef.current) return;
    const p = getNormalizedPoint(e);

    // Dragging selected annotation
    if (tool === 'select' && draggingAnnoRef.current) {
      const { id, startX, startY, origAnno } = draggingAnnoRef.current;
      const dx = p.x - startX;
      const dy = p.y - startY;

      const updated = annotations.map((a) => {
        if (a.id !== id) return a;
        if (a.type === 'arrow') {
          return {
            ...a,
            x: Math.max(0, Math.min(1, origAnno.x + dx)),
            y: Math.max(0, Math.min(1, origAnno.y + dy)),
            x2: Math.max(0, Math.min(1, (origAnno.x2 ?? origAnno.x) + dx)),
            y2: Math.max(0, Math.min(1, (origAnno.y2 ?? origAnno.y) + dy)),
          };
        }
        return {
          ...a,
          x: Math.max(0, Math.min(1, origAnno.x + dx)),
          y: Math.max(0, Math.min(1, origAnno.y + dy)),
        };
      });

      setAnnotations(updated);
      redrawCanvas();
      return;
    }

    // Drawing rectangle
    if (tool === 'rectangle' && tempAnnoRef.current && startPosRef.current) {
      const sx = startPosRef.current.x;
      const sy = startPosRef.current.y;
      tempAnnoRef.current = {
        ...tempAnnoRef.current,
        x: Math.min(sx, p.x),
        y: Math.min(sy, p.y),
        width: Math.abs(p.x - sx),
        height: Math.abs(p.y - sy),
      };
      redrawCanvas();
      return;
    }

    // Drawing arrow
    if (tool === 'arrow' && tempAnnoRef.current && startPosRef.current) {
      tempAnnoRef.current = {
        ...tempAnnoRef.current,
        x2: p.x,
        y2: p.y,
      };
      redrawCanvas();
      return;
    }
  };

  const handlePointerUp = () => {
    if (!isInteractingRef.current) return;
    isInteractingRef.current = false;

    if (tool === 'select' && draggingAnnoRef.current) {
      // Record drag into undo history
      setHistory((prev) => ({
        past: [...prev.past, annotations],
        future: [],
      }));
      draggingAnnoRef.current = null;
      return;
    }

    if (tempAnnoRef.current) {
      const created: Annotation = {
        ...tempAnnoRef.current,
        id: `anno_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      };
      tempAnnoRef.current = null;

      // Only save if size is meaningful
      if (
        (created.type === 'rectangle' && (created.width || 0) > 0.01 && (created.height || 0) > 0.01) ||
        (created.type === 'arrow' && Math.hypot((created.x2 || 0) - created.x, (created.y2 || 0) - created.y) > 0.02)
      ) {
        updateAnnotationsWithHistory([...annotations, created]);
        setSelectedId(created.id);
      } else {
        redrawCanvas();
      }
    }
  };

  // Save Step Changes
  const handleSave = async () => {
    if (!step) return;
    setSaveStatus('saving');
    try {
      await repo.updateStep(step.id, {
        title: title.trim() || step.title,
        description: description.trim(),
        sourceUrl: sourceUrl.trim(),
        annotations: annotations,
      });
      setSaveStatus('saved');
      showToast('success', 'Đã lưu tất cả thay đổi!');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
      showToast('error', 'Lưu thay đổi thất bại');
    }
  };

  // Export HTML
  const handleExportHtml = async () => {
    if (!project) return;
    try {
      // Auto save first
      await handleSave();
      const exportData = await prepareProjectExportData(project.id);
      const htmlString = generateHtmlDocument(exportData);
      const filename = `${project.title.replace(/\s+/g, '-')}-huong-dan.html`;
      downloadHtmlFile(filename, htmlString);
      showToast('success', `Đã xuất file HTML "${filename}" thành công!`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Xuất tài liệu HTML thất bại');
    }
  };

  const currentStepIndex = allStepsInFeature.findIndex((s) => s.id === stepId);

  return (
    <div className="editor-root">
      {/* Toast Alert */}
      {toast && (
        <div className={`toast-bar ${toast.type === 'success' ? 'toast-success' : 'toast-error'} editor-toast`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="editor-header">
        <div className="header-left">
          <div className="header-breadcrumbs">
            <span className="crumb-proj">{project?.title || 'Dự án'}</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-feat">{feature?.title || 'Tính năng'}</span>
            <span className="crumb-sep">/</span>
            <strong className="crumb-step">{title || 'Bước hướng dẫn'}</strong>
          </div>
        </div>

        {/* Step Navigator */}
        {allStepsInFeature.length > 1 && (
          <div className="header-step-nav">
            <button
              className="btn btn-secondary btn-sm"
              disabled={currentStepIndex <= 0}
              onClick={() => handleSwitchStep(allStepsInFeature[currentStepIndex - 1].id)}
            >
              <ChevronLeft size={14} />
              <span>Bước trước</span>
            </button>
            <span className="step-counter">
              {currentStepIndex + 1} / {allStepsInFeature.length}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={currentStepIndex >= allStepsInFeature.length - 1}
              onClick={() => handleSwitchStep(allStepsInFeature[currentStepIndex + 1].id)}
            >
              <span>Bước tiếp theo</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        <div className="header-right">
          <button
            className={`btn ${saveStatus === 'saved' ? 'btn-success' : 'btn-primary'} btn-sm`}
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
          >
            <Save size={14} />
            <span>{saveStatus === 'saving' ? 'Đang lưu...' : saveStatus === 'saved' ? 'Đã lưu' : 'Lưu thay đổi'}</span>
          </button>

          <button className="btn btn-secondary btn-sm" onClick={handleExportHtml}>
            <Download size={14} />
            <span>Xuất HTML</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="editor-main">
        {/* Left Toolbar */}
        <aside className="editor-toolbar">
          <div className="toolbar-section">
            <span className="toolbar-title">Công cụ</span>
            <div className="tool-grid">
              <button
                className={`tool-btn ${tool === 'select' ? 'tool-active' : ''}`}
                title="Con trỏ chọn & di chuyển"
                onClick={() => setTool('select')}
              >
                <MousePointer size={18} />
                <span>Chọn</span>
              </button>

              <button
                className={`tool-btn ${tool === 'rectangle' ? 'tool-active' : ''}`}
                title="Vẽ khung chữ nhật khoanh vùng"
                onClick={() => setTool('rectangle')}
              >
                <Square size={18} />
                <span>Khung</span>
              </button>

              <button
                className={`tool-btn ${tool === 'arrow' ? 'tool-active' : ''}`}
                title="Vẽ mũi tên chỉ dẫn"
                onClick={() => setTool('arrow')}
              >
                <ArrowRight size={18} />
                <span>Mũi tên</span>
              </button>

              <button
                className={`tool-btn ${tool === 'number' ? 'tool-active' : ''}`}
                title="Đánh số thứ tự (1, 2, 3...)"
                onClick={() => setTool('number')}
              >
                <ListOrdered size={18} />
                <span>Số thứ tự</span>
              </button>

              <button
                className={`tool-btn ${tool === 'text' ? 'tool-active' : ''}`}
                title="Ghi chú văn bản"
                onClick={() => setTool('text')}
              >
                <Type size={18} />
                <span>Chữ</span>
              </button>
            </div>
          </div>

          {/* Color Palette */}
          <div className="toolbar-section">
            <span className="toolbar-title">Màu sắc</span>
            <div className="color-palette">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  className={`color-swatch ${activeColor === c.hex ? 'color-active' : ''}`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                  onClick={() => {
                    setActiveColor(c.hex);
                    if (selectedId) {
                      // Update color of currently selected annotation
                      const updated = annotations.map((a) =>
                        a.id === selectedId ? { ...a, style: { ...a.style, color: c.hex } } : a
                      );
                      updateAnnotationsWithHistory(updated);
                    }
                  }}
                />
              ))}
            </div>
          </div>

          {/* Line Width */}
          <div className="toolbar-section">
            <span className="toolbar-title">Độ dày nét: {lineWidth}px</span>
            <div className="flex gap-2">
              {[2, 3, 5].map((w) => (
                <button
                  key={w}
                  className={`btn btn-sm flex-1 ${lineWidth === w ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setLineWidth(w)}
                >
                  {w === 2 ? 'Mảnh' : w === 3 ? 'Vừa' : 'Dày'}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size for Text */}
          {tool === 'text' && (
            <div className="toolbar-section">
              <span className="toolbar-title">Cỡ chữ: {fontSize}px</span>
              <div className="flex gap-2">
                {[12, 14, 18].map((size) => (
                  <button
                    key={size}
                    className={`btn btn-sm flex-1 ${fontSize === size ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFontSize(size)}
                  >
                    {size === 12 ? 'Nhỏ' : size === 14 ? 'Vừa' : 'Lớn'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions & History */}
          <div className="toolbar-section">
            <span className="toolbar-title">Thao tác</span>
            <div className="action-buttons-col">
              <div className="flex gap-2">
                <button
                  className="btn btn-secondary btn-sm flex-1"
                  title="Hoàn tác (Ctrl+Z)"
                  disabled={history.past.length === 0}
                  onClick={handleUndo}
                >
                  <Undo2 size={14} />
                  <span>Hoàn tác</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm flex-1"
                  title="Làm lại (Ctrl+Y)"
                  disabled={history.future.length === 0}
                  onClick={handleRedo}
                >
                  <Redo2 size={14} />
                  <span>Làm lại</span>
                </button>
              </div>

              {selectedId && (
                <button className="btn btn-danger btn-sm w-full" onClick={handleDeleteSelected}>
                  <Trash2 size={14} />
                  <span>Xóa đang chọn</span>
                </button>
              )}

              {annotations.length > 0 && (
                <button className="btn btn-ghost btn-sm w-full text-danger" onClick={handleClearAll}>
                  <span>Xóa tất cả ({annotations.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Zoom controls */}
          <div className="toolbar-section mt-auto">
            <span className="toolbar-title">Thu phóng: {Math.round(zoomLevel * 100)}%</span>
            <div className="flex gap-2">
              <button
                className="btn btn-secondary btn-sm flex-1"
                disabled={zoomLevel <= 0.6}
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.2))}
              >
                <ZoomOut size={14} />
              </button>
              <button
                className="btn btn-secondary btn-sm flex-1"
                title="Vừa màn hình (100%)"
                onClick={() => setZoomLevel(1)}
              >
                <Maximize2 size={14} />
              </button>
              <button
                className="btn btn-secondary btn-sm flex-1"
                disabled={zoomLevel >= 2.0}
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
              >
                <ZoomIn size={14} />
              </button>
            </div>
          </div>
        </aside>

        {/* Center Canvas Viewport */}
        <section className="canvas-viewport">
          {image?.dataUrl ? (
            <div
              className="canvas-stage"
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'top center',
              }}
            >
              {/* Underlying Image */}
              <img
                src={image.dataUrl}
                alt="Screenshot to annotate"
                className="screenshot-base"
                onLoad={handleImageLoad}
              />
              {/* Interaction Canvas Overlay */}
              <canvas
                ref={canvasRef}
                className="annotation-canvas"
                style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />
            </div>
          ) : (
            <div className="empty-canvas">
              <p>Chưa có ảnh chụp màn hình cho bước này.</p>
              <p className="text-sm text-gray-500">
                Hãy mở thanh bên (Side Panel) để chụp màn hình tab hoặc tải ảnh lên.
              </p>
            </div>
          )}
        </section>

        {/* Right Info Sidebar */}
        <aside className="editor-sidebar-right">
          <div className="form-group">
            <label className="form-label">Tiêu đề bước:</label>
            <input
              type="text"
              className="form-input font-semibold"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Bước 1: Nhập email tài khoản"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Đường dẫn trang web (Source URL):</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="form-input text-sm"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
              />
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  title="Mở liên kết"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>

          <div className="form-group flex-1 flex flex-col">
            <label className="form-label">Mô tả chi tiết và thao tác:</label>
            <textarea
              className="form-textarea flex-1 text-sm"
              rows={8}
              placeholder="Mô tả cụ thể người dùng cần nhấp vào đâu, nhập dữ liệu gì..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* List of Annotations on this step */}
          <div className="annotations-summary">
            <label className="form-label">Các chú thích trên ảnh ({annotations.length}):</label>
            {annotations.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Chọn công cụ bên trái để vẽ chú thích lên ảnh.</p>
            ) : (
              <div className="anno-list">
                {annotations.map((a, idx) => (
                  <div
                    key={a.id}
                    className={`anno-chip ${selectedId === a.id ? 'anno-chip-selected' : ''}`}
                    onClick={() => setSelectedId(a.id)}
                  >
                    <span
                      className="anno-chip-dot"
                      style={{ backgroundColor: a.style?.color || '#ef4444' }}
                    />
                    <span className="anno-chip-label">
                      {a.type === 'rectangle'
                        ? `Khung ${idx + 1}`
                        : a.type === 'arrow'
                        ? `Mũi tên ${idx + 1}`
                        : a.type === 'number'
                        ? `Số [${a.number}]`
                        : `Chữ: "${a.text?.substring(0, 14)}..."`}
                    </span>
                    <button
                      className="anno-chip-del"
                      title="Xóa"
                      onClick={(e) => {
                        e.stopPropagation();
                        const remaining = annotations.filter((item) => item.id !== a.id);
                        updateAnnotationsWithHistory(remaining);
                        if (selectedId === a.id) setSelectedId(null);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

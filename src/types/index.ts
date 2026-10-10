export type ID = string;

export interface Project {
  id: ID;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Feature {
  id: ID;
  projectId: ID;
  title: string;
  description?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface AnnotationStyle {
  color?: string;
  lineWidth?: number;
  fontSize?: number;
  bgColor?: string;
}

export interface Annotation {
  id: ID;
  type: 'rectangle' | 'arrow' | 'number' | 'text';
  // Normalized coordinates (0..1) relative to natural image dimensions
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  number?: number;
  style?: AnnotationStyle;
  // Target coordinates for arrow (0..1)
  x2?: number;
  y2?: number;
}

export interface GuideStep {
  id: ID;
  featureId: ID;
  title: string;
  description: string;
  imageId: ID;
  sourceUrl?: string;
  order: number;
  annotations: Annotation[];
  createdAt: number;
  updatedAt: number;
}

export interface StoredImage {
  id: ID;
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes?: number;
  createdAt: number;
}

export interface CaptureResult {
  dataUrl: string;
  sourceUrl?: string;
  tabTitle?: string;
  width: number;
  height: number;
}

export type ExtensionMessage =
  | { type: 'CAPTURE_ACTIVE_TAB' }
  | { type: 'OPEN_EDITOR'; stepId: string; featureId?: string; projectId?: string }
  | { type: 'GET_ACTIVE_TAB_INFO' };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

import { db, WebGuideDatabase } from './schema';
import type { Project, Feature, GuideStep, StoredImage, Annotation } from '../types';

// Helper to generate unique IDs
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

export class GuideRepository {
  private database: WebGuideDatabase;

  constructor(database: WebGuideDatabase = db) {
    this.database = database;
  }

  // ===================== PROJECTS =====================

  async getAllProjects(): Promise<Project[]> {
    return await this.database.projects.orderBy('updatedAt').reverse().toArray();
  }

  async getProject(id: string): Promise<Project | undefined> {
    return await this.database.projects.get(id);
  }

  async createProject(data: { title: string; description?: string }): Promise<Project> {
    const now = Date.now();
    const project: Project = {
      id: generateId('proj'),
      title: data.title.trim() || 'Dự án chưa đặt tên',
      description: data.description?.trim() || '',
      createdAt: now,
      updatedAt: now,
    };
    await this.database.projects.add(project);
    return project;
  }

  async updateProject(id: string, updates: Partial<Pick<Project, 'title' | 'description'>>): Promise<void> {
    await this.database.projects.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.database.transaction('rw', [this.database.projects, this.database.features, this.database.steps, this.database.images], async () => {
      // Find all features of this project
      const features = await this.database.features.where('projectId').equals(projectId).toArray();
      const featureIds = features.map((f) => f.id);

      // Find all steps of these features
      const steps = await this.database.steps.where('featureId').anyOf(featureIds).toArray();
      const stepIds = steps.map((s) => s.id);
      const imageIds = steps.map((s) => s.imageId).filter(Boolean);

      // Delete images
      if (imageIds.length > 0) {
        await this.database.images.bulkDelete(imageIds);
      }
      // Delete steps
      if (stepIds.length > 0) {
        await this.database.steps.bulkDelete(stepIds);
      }
      // Delete features
      if (featureIds.length > 0) {
        await this.database.features.bulkDelete(featureIds);
      }
      // Delete project
      await this.database.projects.delete(projectId);
    });
  }

  // ===================== FEATURES =====================

  async getFeaturesByProject(projectId: string): Promise<Feature[]> {
    const features = await this.database.features.where('projectId').equals(projectId).toArray();
    return features.sort((a, b) => a.order - b.order);
  }

  async getFeature(id: string): Promise<Feature | undefined> {
    return await this.database.features.get(id);
  }

  async createFeature(data: { projectId: string; title: string; description?: string }): Promise<Feature> {
    const existing = await this.getFeaturesByProject(data.projectId);
    const nextOrder = existing.length > 0 ? Math.max(...existing.map((f) => f.order)) + 1 : 0;
    const now = Date.now();

    const feature: Feature = {
      id: generateId('feat'),
      projectId: data.projectId,
      title: data.title.trim() || 'Tính năng mới',
      description: data.description?.trim() || '',
      order: nextOrder,
      createdAt: now,
      updatedAt: now,
    };

    await this.database.features.add(feature);
    await this.database.projects.update(data.projectId, { updatedAt: now });
    return feature;
  }

  async updateFeature(id: string, updates: Partial<Pick<Feature, 'title' | 'description' | 'order'>>): Promise<void> {
    const feature = await this.database.features.get(id);
    if (!feature) return;

    const now = Date.now();
    await this.database.features.update(id, {
      ...updates,
      updatedAt: now,
    });
    await this.database.projects.update(feature.projectId, { updatedAt: now });
  }

  async deleteFeature(featureId: string): Promise<void> {
    await this.database.transaction('rw', [this.database.projects, this.database.features, this.database.steps, this.database.images], async () => {
      const feature = await this.database.features.get(featureId);
      if (!feature) return;

      const steps = await this.database.steps.where('featureId').equals(featureId).toArray();
      const stepIds = steps.map((s) => s.id);
      const imageIds = steps.map((s) => s.imageId).filter(Boolean);

      if (imageIds.length > 0) {
        await this.database.images.bulkDelete(imageIds);
      }
      if (stepIds.length > 0) {
        await this.database.steps.bulkDelete(stepIds);
      }
      await this.database.features.delete(featureId);
      await this.database.projects.update(feature.projectId, { updatedAt: Date.now() });
    });
  }

  async reorderFeatures(projectId: string, featureIdsInOrder: string[]): Promise<void> {
    await this.database.transaction('rw', [this.database.features, this.database.projects], async () => {
      for (let i = 0; i < featureIdsInOrder.length; i++) {
        await this.database.features.update(featureIdsInOrder[i], { order: i, updatedAt: Date.now() });
      }
      await this.database.projects.update(projectId, { updatedAt: Date.now() });
    });
  }

  // ===================== STEPS =====================

  async getStepsByFeature(featureId: string): Promise<GuideStep[]> {
    const steps = await this.database.steps.where('featureId').equals(featureId).toArray();
    return steps.sort((a, b) => a.order - b.order);
  }

  async getStep(id: string): Promise<GuideStep | undefined> {
    return await this.database.steps.get(id);
  }

  async createStep(data: {
    featureId: string;
    title: string;
    description?: string;
    imageId: string;
    sourceUrl?: string;
    annotations?: Annotation[];
  }): Promise<GuideStep> {
    const existing = await this.getStepsByFeature(data.featureId);
    const nextOrder = existing.length > 0 ? Math.max(...existing.map((s) => s.order)) + 1 : 0;
    const now = Date.now();

    const step: GuideStep = {
      id: generateId('step'),
      featureId: data.featureId,
      title: data.title.trim() || `Bước ${nextOrder + 1}`,
      description: data.description?.trim() || '',
      imageId: data.imageId,
      sourceUrl: data.sourceUrl,
      order: nextOrder,
      annotations: data.annotations || [],
      createdAt: now,
      updatedAt: now,
    };

    await this.database.steps.add(step);

    // Update feature and project timestamps
    const feature = await this.database.features.get(data.featureId);
    if (feature) {
      await this.database.features.update(feature.id, { updatedAt: now });
      await this.database.projects.update(feature.projectId, { updatedAt: now });
    }

    return step;
  }

  async updateStep(
    id: string,
    updates: Partial<Pick<GuideStep, 'title' | 'description' | 'annotations' | 'order' | 'sourceUrl'>>
  ): Promise<void> {
    const step = await this.database.steps.get(id);
    if (!step) return;

    const now = Date.now();
    await this.database.steps.update(id, {
      ...updates,
      updatedAt: now,
    });

    const feature = await this.database.features.get(step.featureId);
    if (feature) {
      await this.database.features.update(feature.id, { updatedAt: now });
      await this.database.projects.update(feature.projectId, { updatedAt: now });
    }
  }

  async deleteStep(stepId: string): Promise<void> {
    await this.database.transaction('rw', [this.database.steps, this.database.images, this.database.features, this.database.projects], async () => {
      const step = await this.database.steps.get(stepId);
      if (!step) return;

      if (step.imageId) {
        await this.database.images.delete(step.imageId);
      }
      await this.database.steps.delete(stepId);

      // Re-index remaining steps in this feature
      const remaining = await this.database.steps.where('featureId').equals(step.featureId).toArray();
      const sorted = remaining.sort((a, b) => a.order - b.order);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].order !== i) {
          await this.database.steps.update(sorted[i].id, { order: i });
        }
      }

      const feature = await this.database.features.get(step.featureId);
      if (feature) {
        const now = Date.now();
        await this.database.features.update(feature.id, { updatedAt: now });
        await this.database.projects.update(feature.projectId, { updatedAt: now });
      }
    });
  }

  async reorderSteps(featureId: string, stepIdsInOrder: string[]): Promise<void> {
    await this.database.transaction('rw', [this.database.steps, this.database.features, this.database.projects], async () => {
      const now = Date.now();
      for (let i = 0; i < stepIdsInOrder.length; i++) {
        await this.database.steps.update(stepIdsInOrder[i], { order: i, updatedAt: now });
      }
      const feature = await this.database.features.get(featureId);
      if (feature) {
        await this.database.features.update(feature.id, { updatedAt: now });
        await this.database.projects.update(feature.projectId, { updatedAt: now });
      }
    });
  }

  // ===================== IMAGES =====================

  async saveImage(dataUrl: string, width: number, height: number, mimeType = 'image/png'): Promise<StoredImage> {
    // Approximate byte size calculation from data URL
    const base64Str = dataUrl.split(',')[1] || '';
    const sizeBytes = Math.round((base64Str.length * 3) / 4);

    const image: StoredImage = {
      id: generateId('img'),
      dataUrl,
      mimeType,
      width,
      height,
      sizeBytes,
      createdAt: Date.now(),
    };

    await this.database.images.add(image);
    return image;
  }

  async getImage(id: string): Promise<StoredImage | undefined> {
    return await this.database.images.get(id);
  }

  async deleteImage(id: string): Promise<void> {
    await this.database.images.delete(id);
  }

  // ===================== STATS & CLEANUP =====================

  async getStorageStats(): Promise<{
    projectCount: number;
    featureCount: number;
    stepCount: number;
    imageCount: number;
    totalSizeBytes: number;
  }> {
    const projectCount = await this.database.projects.count();
    const featureCount = await this.database.features.count();
    const stepCount = await this.database.steps.count();
    const images = await this.database.images.toArray();

    const totalSizeBytes = images.reduce((acc, img) => acc + (img.sizeBytes || 0), 0);

    return {
      projectCount,
      featureCount,
      stepCount,
      imageCount: images.length,
      totalSizeBytes,
    };
  }

  async cleanupOrphanImages(): Promise<number> {
    const allSteps = await this.database.steps.toArray();
    const activeImageIds = new Set(allSteps.map((s) => s.imageId).filter(Boolean));
    const allImages = await this.database.images.toArray();

    const orphanIds = allImages.filter((img) => !activeImageIds.has(img.id)).map((img) => img.id);

    if (orphanIds.length > 0) {
      await this.database.images.bulkDelete(orphanIds);
    }
    return orphanIds.length;
  }
}

export const repo = new GuideRepository(db);

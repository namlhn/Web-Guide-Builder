import Dexie, { type Table } from 'dexie';
import type { Project, Feature, GuideStep, StoredImage } from '../types';

export class WebGuideDatabase extends Dexie {
  projects!: Table<Project, string>;
  features!: Table<Feature, string>;
  steps!: Table<GuideStep, string>;
  images!: Table<StoredImage, string>;

  constructor(dbName = 'WebGuideBuilderDB') {
    super(dbName);

    // Schema version 1
    this.version(1).stores({
      projects: 'id, title, createdAt, updatedAt',
      features: 'id, projectId, order, createdAt',
      steps: 'id, featureId, order, imageId, createdAt',
      images: 'id, createdAt',
    });
  }
}

export const db = new WebGuideDatabase();

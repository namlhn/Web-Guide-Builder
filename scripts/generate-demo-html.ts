import fs from 'node:fs';
import path from 'node:path';
import 'fake-indexeddb/auto';
import { db } from '../src/db/schema';
import { seedDemoGuideProject } from '../src/db/demo-data';
import { generateHtmlDocument, type ExportData } from '../src/export/html-generator';
import { repo } from '../src/db/repository';

async function generateSampleDemoHtml() {
  const project = await seedDemoGuideProject();
  const features = await repo.getFeaturesByProject(project.id);
  const exportFeatures: ExportData['features'] = [];

  for (const feat of features) {
    const steps = await repo.getStepsByFeature(feat.id);
    const exportSteps: ExportData['features'][0]['steps'] = [];

    for (const step of steps) {
      const stored = await repo.getImage(step.imageId);
      exportSteps.push({
        step,
        annotatedImageDataUrl: stored?.dataUrl || '',
      });
    }

    exportFeatures.push({
      feature: feat,
      steps: exportSteps,
    });
  }

  const html = generateHtmlDocument({
    project,
    features: exportFeatures,
  });

  const demoDir = path.resolve('demo');
  fs.mkdirSync(demoDir, { recursive: true });
  const outPath = path.join(demoDir, 'huong-dan-quan-tri-mau.html');
  fs.writeFileSync(outPath, html, 'utf-8');
  console.log(`Generated demo HTML guide at: ${outPath}`);
}

generateSampleDemoHtml().catch(console.error);

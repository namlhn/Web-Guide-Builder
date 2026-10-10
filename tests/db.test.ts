import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { WebGuideDatabase } from '../src/db/schema';
import { GuideRepository } from '../src/db/repository';

describe('WebGuideDatabase & GuideRepository', () => {
  let testDb: WebGuideDatabase;
  let repo: GuideRepository;

  beforeEach(() => {
    testDb = new WebGuideDatabase(`TestDB_${Date.now()}_${Math.random()}`);
    repo = new GuideRepository(testDb);
  });

  it('AT-01: CRUD dự án hoạt động chính xác và lưu độc lập', async () => {
    const p1 = await repo.createProject({ title: 'Dự án A', description: 'Mô tả A' });
    const p2 = await repo.createProject({ title: 'Dự án B', description: 'Mô tả B' });

    expect(p1.id).toBeDefined();
    expect(p2.id).toBeDefined();
    expect(p1.id).not.toBe(p2.id);

    const all = await repo.getAllProjects();
    expect(all.length).toBe(2);

    await repo.updateProject(p1.id, { title: 'Dự án A (đã sửa)' });
    const updatedP1 = await repo.getProject(p1.id);
    expect(updatedP1?.title).toBe('Dự án A (đã sửa)');
  });

  it('AT-02 & AT-06: CRUD tính năng và bước, kiểm tra sắp xếp order', async () => {
    const proj = await repo.createProject({ title: 'Dự án Test' });
    const feat = await repo.createFeature({ projectId: proj.id, title: 'Tính năng 1' });

    const img1 = await repo.saveImage('data:image/png;base64,mock1', 800, 600);
    const img2 = await repo.saveImage('data:image/png;base64,mock2', 800, 600);

    const s1 = await repo.createStep({
      featureId: feat.id,
      title: 'Bước 1',
      imageId: img1.id,
    });

    const s2 = await repo.createStep({
      featureId: feat.id,
      title: 'Bước 2',
      imageId: img2.id,
    });

    expect(s1.order).toBe(0);
    expect(s2.order).toBe(1);

    // Reorder steps
    await repo.reorderSteps(feat.id, [s2.id, s1.id]);
    const reordered = await repo.getStepsByFeature(feat.id);
    expect(reordered[0].id).toBe(s2.id);
    expect(reordered[0].order).toBe(0);
    expect(reordered[1].id).toBe(s1.id);
    expect(reordered[1].order).toBe(1);
  });

  it('AT-11: Xóa dự án/tính năng dọn dẹp liên hoàn và không để lại ảnh mồ côi', async () => {
    const proj = await repo.createProject({ title: 'Dự án Xóa' });
    const feat = await repo.createFeature({ projectId: proj.id, title: 'Tính năng xóa' });
    const img = await repo.saveImage('data:image/png;base64,orphanCheck', 500, 500);

    await repo.createStep({
      featureId: feat.id,
      title: 'Bước có ảnh',
      imageId: img.id,
    });

    let stats = await repo.getStorageStats();
    expect(stats.projectCount).toBe(1);
    expect(stats.featureCount).toBe(1);
    expect(stats.stepCount).toBe(1);
    expect(stats.imageCount).toBe(1);

    // Xóa dự án
    await repo.deleteProject(proj.id);

    stats = await repo.getStorageStats();
    expect(stats.projectCount).toBe(0);
    expect(stats.featureCount).toBe(0);
    expect(stats.stepCount).toBe(0);
    expect(stats.imageCount).toBe(0); // Ảnh đã được dọn sạch không còn mồ côi!
  });
});

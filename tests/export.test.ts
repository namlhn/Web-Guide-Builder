import { describe, it, expect } from 'vitest';
import { generateHtmlDocument, escapeHtml, type ExportData } from '../src/export/html-generator';

describe('HTML Export Generator', () => {
  it('AT-08: escapeHtml xử lý ký tự đặc biệt và ngăn chặn XSS', () => {
    const maliciousInput = '<script>alert("xss")</script> & <b>bold</b> "quote" \'single\'';
    const escaped = escapeHtml(maliciousInput);

    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&amp;');
    expect(escaped).toContain('&quot;quote&quot;');
    expect(escaped).toContain('&#39;single&#39;');
  });

  it('AT-07 & AT-12: Xuất tài liệu HTML hoàn chỉnh có mục lục và mở được offline', () => {
    const mockData: ExportData = {
      project: {
        id: 'p_1',
        title: 'Hướng dẫn cài đặt hệ thống & Quản trị',
        description: 'Tài liệu hướng dẫn nội bộ cho kỹ sư',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
      features: [
        {
          feature: {
            id: 'f_1',
            projectId: 'p_1',
            title: 'Tính năng 1: Cấu hình ban đầu',
            order: 0,
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
          },
          steps: [
            {
              step: {
                id: 's_1',
                featureId: 'f_1',
                title: 'Bước 1: Mở trình duyệt',
                description: 'Truy cập cổng portal và đăng nhập',
                imageId: 'img_1',
                order: 0,
                annotations: [],
                createdAt: 1700000000000,
                updatedAt: 1700000000000,
                sourceUrl: 'https://portal.example.com',
              },
              annotatedImageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            },
          ],
        },
      ],
    };

    const html = generateHtmlDocument(mockData);

    // Kiểm tra cấu trúc HTML
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Hướng dẫn cài đặt hệ thống &amp; Quản trị');
    expect(html).toContain('Mục lục hướng dẫn');

    // Kiểm tra anchor liên kết
    expect(html).toContain('href="#feature-f_1"');
    expect(html).toContain('href="#step-s_1"');
    expect(html).toContain('id="step-s_1"');

    // Kiểm tra ảnh data: URL nhúng trực tiếp
    expect(html).toContain('src="data:image/png;base64,');

    // Kiểm tra không dùng tài nguyên ngoại vi (offline 100%)
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://cdn.');
    expect(html).not.toContain('https://fonts.googleapis.com');
  });
});

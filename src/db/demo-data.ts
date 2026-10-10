import { repo } from './repository';
import type { Project, Annotation } from '../types';

// Helper to create an SVG data URL mimicking a software screen
function createMockScreenDataUrl(title: string, subtitle: string, mainColor = '#3b82f6'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="640" viewBox="0 0 1024 640">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="100%" stop-color="#f1f5f9"/>
      </linearGradient>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.08"/>
      </filter>
    </defs>
    <!-- Background -->
    <rect width="1024" height="640" fill="url(#bg)"/>
    
    <!-- App Window Frame -->
    <rect x="32" y="32" width="960" height="576" rx="12" fill="#ffffff" filter="url(#shadow)" stroke="#e2e8f0" stroke-width="1"/>
    
    <!-- Header Bar -->
    <path d="M 32 44 A 12 12 0 0 1 44 32 L 980 32 A 12 12 0 0 1 992 44 L 992 84 L 32 84 Z" fill="#1e293b"/>
    <circle cx="56" cy="58" r="6" fill="#ef4444"/>
    <circle cx="76" cy="58" r="6" fill="#f59e0b"/>
    <circle cx="96" cy="58" r="6" fill="#10b981"/>
    <text x="512" y="63" fill="#cbd5e1" font-size="14" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle" font-weight="500">https://admin.example.com/app</text>
    
    <!-- Sidebar Navigation -->
    <rect x="32" y="84" width="220" height="524" fill="#0f172a"/>
    <rect x="48" y="108" width="188" height="36" rx="6" fill="#334155"/>
    <text x="64" y="131" fill="#f8fafc" font-size="14" font-family="system-ui, -apple-system, sans-serif" font-weight="600">📊 Bảng điều khiển</text>
    
    <text x="64" y="180" fill="#94a3b8" font-size="14" font-family="system-ui, -apple-system, sans-serif">👥 Người dùng</text>
    <text x="64" y="224" fill="#94a3b8" font-size="14" font-family="system-ui, -apple-system, sans-serif">⚙️ Cài đặt hệ thống</text>
    <text x="64" y="268" fill="#94a3b8" font-size="14" font-family="system-ui, -apple-system, sans-serif">📈 Báo cáo thống kê</text>
    <text x="64" y="312" fill="#94a3b8" font-size="14" font-family="system-ui, -apple-system, sans-serif">🛡️ Bảo mật &amp; Quyền</text>

    <!-- Main Content Area -->
    <rect x="252" y="84" width="740" height="524" fill="#f8fafc"/>
    
    <!-- Card Header -->
    <rect x="284" y="112" width="676" height="88" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
    <text x="312" y="150" fill="#0f172a" font-size="20" font-family="system-ui, -apple-system, sans-serif" font-weight="bold">${title}</text>
    <text x="312" y="176" fill="#64748b" font-size="14" font-family="system-ui, -apple-system, sans-serif">${subtitle}</text>

    <!-- Content Form/Table -->
    <rect x="284" y="224" width="676" height="350" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>

    <!-- Inputs & Buttons -->
    <rect x="312" y="256" width="300" height="42" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
    <text x="328" y="282" fill="#94a3b8" font-size="14" font-family="system-ui, -apple-system, sans-serif">Nhập email hoặc tên tài khoản...</text>

    <rect x="632" y="256" width="140" height="42" rx="6" fill="${mainColor}"/>
    <text x="702" y="282" fill="#ffffff" font-size="14" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" text-anchor="middle">Tìm kiếm</text>

    <rect x="800" y="256" width="130" height="42" rx="6" fill="#10b981"/>
    <text x="865" y="282" fill="#ffffff" font-size="14" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" text-anchor="middle">+ Thêm mới</text>

    <!-- Mock Data Table Rows -->
    <rect x="312" y="324" width="620" height="36" fill="#f1f5f9" rx="4"/>
    <text x="328" y="347" fill="#475569" font-size="12" font-family="system-ui, -apple-system, sans-serif" font-weight="bold">STT</text>
    <text x="380" y="347" fill="#475569" font-size="12" font-family="system-ui, -apple-system, sans-serif" font-weight="bold">Họ và tên</text>
    <text x="560" y="347" fill="#475569" font-size="12" font-family="system-ui, -apple-system, sans-serif" font-weight="bold">Email</text>
    <text x="760" y="347" fill="#475569" font-size="12" font-family="system-ui, -apple-system, sans-serif" font-weight="bold">Trạng thái</text>

    <line x1="312" y1="400" x2="932" y2="400" stroke="#f1f5f9" stroke-width="1"/>
    <text x="328" y="388" fill="#334155" font-size="13" font-family="system-ui, -apple-system, sans-serif">1</text>
    <text x="380" y="388" fill="#334155" font-size="13" font-family="system-ui, -apple-system, sans-serif">Nguyễn Văn An</text>
    <text x="560" y="388" fill="#334155" font-size="13" font-family="system-ui, -apple-system, sans-serif">an.nguyen@example.com</text>
    <rect x="760" y="374" width="80" height="20" rx="10" fill="#dcfce7"/>
    <text x="800" y="388" fill="#15803d" font-size="11" font-family="system-ui, -apple-system, sans-serif" font-weight="600" text-anchor="middle">Đang hoạt động</text>

    <line x1="312" y1="440" x2="932" y2="440" stroke="#f1f5f9" stroke-width="1"/>
    <text x="328" y="428" fill="#334155" font-size="13" font-family="system-ui, -apple-system, sans-serif">2</text>
    <text x="380" y="428" fill="#334155" font-size="13" font-family="system-ui, -apple-system, sans-serif">Trần Thị Bích</text>
    <text x="560" y="428" fill="#334155" font-size="13" font-family="system-ui, -apple-system, sans-serif">bich.tran@example.com</text>
    <rect x="760" y="414" width="80" height="20" rx="10" fill="#fef3c7"/>
    <text x="800" y="428" fill="#b45309" font-size="11" font-family="system-ui, -apple-system, sans-serif" font-weight="600" text-anchor="middle">Chờ xác thực</text>

    <line x1="312" y1="480" x2="932" y2="480" stroke="#f1f5f9" stroke-width="1"/>
    <text x="328" y="468" fill="#334155" font-size="13" font-family="system-ui, -apple-system, sans-serif">3</text>
    <text x="380" y="468" fill="#334155" font-size="13" font-family="system-ui, -apple-system, sans-serif">Lê Hoàng Nam</text>
    <text x="560" y="468" fill="#334155" font-size="13" font-family="system-ui, -apple-system, sans-serif">nam.le@example.com</text>
    <rect x="760" y="454" width="80" height="20" rx="10" fill="#dcfce7"/>
    <text x="800" y="468" fill="#15803d" font-size="11" font-family="system-ui, -apple-system, sans-serif" font-weight="600" text-anchor="middle">Đang hoạt động</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function seedDemoGuideProject(): Promise<Project> {
  const project = await repo.createProject({
    title: 'Hướng dẫn Quản trị Hệ thống & Người dùng',
    description: 'Tài liệu hướng dẫn mẫu dành cho quản trị viên phần mềm: bao gồm thao tác đăng nhập, bảo mật và phân quyền tài khoản.',
  });

  // Feature 1: Đăng nhập & Xác thực
  const featAuth = await repo.createFeature({
    projectId: project.id,
    title: '1. Đăng nhập & Xác thực bảo mật',
    description: 'Quy trình đăng nhập vào cổng thông tin quản trị và cấu hình xác thực 2 lớp.',
  });

  const imgAuth1 = await repo.saveImage(
    createMockScreenDataUrl('Đăng nhập Hệ thống', 'Nhập tên đăng nhập và mật khẩu được cấp', '#2563eb'),
    1024,
    640
  );

  const annotationsAuth1: Annotation[] = [
    {
      id: 'anno_1',
      type: 'rectangle',
      x: 0.3,
      y: 0.38,
      width: 0.32,
      height: 0.08,
      style: { color: '#ef4444', lineWidth: 3 },
    },
    {
      id: 'anno_2',
      type: 'number',
      x: 0.28,
      y: 0.42,
      number: 1,
      style: { color: '#ef4444' },
    },
    {
      id: 'anno_3',
      type: 'text',
      x: 0.3,
      y: 0.33,
      text: 'Điền email tài khoản doanh nghiệp',
      style: { color: '#1e293b', fontSize: 13, bgColor: '#ffffff' },
    },
  ];

  await repo.createStep({
    featureId: featAuth.id,
    title: 'Bước 1: Nhập thông tin đăng nhập',
    description: 'Mở trình duyệt, truy cập địa chỉ portal quản trị. Nhập email doanh nghiệp và mật khẩu tạm thời được cung cấp qua email kích hoạt.',
    imageId: imgAuth1.id,
    sourceUrl: 'https://admin.example.com/login',
    annotations: annotationsAuth1,
  });

  // Feature 2: Quản lý Tài khoản & Phân quyền
  const featUsers = await repo.createFeature({
    projectId: project.id,
    title: '2. Quản lý Tài khoản & Phân quyền',
    description: 'Hướng dẫn tìm kiếm, thêm mới thành viên và cấu hình quyền truy cập theo vai trò.',
  });

  const imgUsers1 = await repo.saveImage(
    createMockScreenDataUrl('Danh sách Người dùng', 'Quản lý toàn bộ nhân sự và phân quyền phòng ban', '#059669'),
    1024,
    640
  );

  const annotationsUsers1: Annotation[] = [
    {
      id: 'anno_u1',
      type: 'arrow',
      x: 0.72,
      y: 0.45,
      x2: 0.85,
      y2: 0.42,
      style: { color: '#2563eb', lineWidth: 3 },
    },
    {
      id: 'anno_u2',
      type: 'rectangle',
      x: 0.77,
      y: 0.38,
      width: 0.15,
      height: 0.08,
      style: { color: '#10b981', lineWidth: 3 },
    },
    {
      id: 'anno_u3',
      type: 'number',
      x: 0.75,
      y: 0.38,
      number: 1,
      style: { color: '#10b981' },
    },
    {
      id: 'anno_u4',
      type: 'text',
      x: 0.65,
      y: 0.48,
      text: 'Nhấn nút "+ Thêm mới" để tạo tài khoản',
      style: { color: '#1e293b', fontSize: 13, bgColor: '#ffffff' },
    },
  ];

  await repo.createStep({
    featureId: featUsers.id,
    title: 'Bước 1: Mở danh sách và tạo tài khoản mới',
    description: 'Từ menu bên trái, chọn mục "Người dùng". Nhấp chuột vào nút "+ Thêm mới" màu xanh ở góc trên bên phải của bảng để mở popup nhập thông tin thành viên.',
    imageId: imgUsers1.id,
    sourceUrl: 'https://admin.example.com/users',
    annotations: annotationsUsers1,
  });

  return project;
}

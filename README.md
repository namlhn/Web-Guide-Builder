# Web Guide Builder — Chrome / Edge Extension

Extension trình duyệt giúp tạo tài liệu hướng dẫn website từ thao tác thực tế: chụp từng màn hình tab, khoanh vùng/đánh dấu chú thích trực quan, ghi chú nội dung và xuất tài liệu HTML độc lập, mở offline.

---

## 🌟 Tính năng nổi bật (Theo Plan MVP)

1. **Quản lý phân cấp Local-First (IndexedDB)**:
   - Tổ chức cấu trúc **Dự án → Tính năng → Các bước hướng dẫn**.
   - Dữ liệu lưu 100% trên máy tính người dùng (IndexedDB + Dexie), không gửi dữ liệu hay ảnh lên server bên ngoài.
   - Cơ chế dọn dẹp liên hoàn (cascading delete) khi xóa dự án/tính năng, không để lại ảnh mồ côi.

2. **Chụp màn hình tab chủ động (Side Panel API)**:
   - Chụp tức thì vùng hiển thị của website đang mở trên trình duyệt khi người dùng nhấp **"Chụp bước mới"**.
   - Cơ chế khóa trạng thái (state locking) chống click đúp.
   - Hỗ trợ tải ảnh có sẵn từ máy tính (manual upload fallback).

3. **Trình biên tập chú thích chuyên sâu (Annotation Canvas Editor)**:
   - Mở trên tab riêng rộng rãi (`editor.html`).
   - Các công cụ vẽ:
     - 🖱️ **Con trỏ (Select/Move)**: Chọn và kéo di chuyển chú thích.
     - 🔲 **Khung (Rectangle)**: Khoanh vùng phần tử kèm hiệu ứng highlight.
     - ➡️ **Mũi tên (Arrow)**: Chỉ rõ vị trí thao tác.
     - 🔢 **Đánh số (Number Marker)**: Tự động đánh số thứ tự tăng dần (1, 2, 3...).
     - ✍️ **Chữ (Text Note)**: Thẻ ghi chú nổi tương phản cao trên ảnh.
   - Bảng màu trực quan, tùy chỉnh độ dày nét và cỡ chữ.
   - **Hoàn tác / Làm lại (Undo / Redo)** với phím tắt `Ctrl+Z` / `Ctrl+Y`.
   - **Tọa độ chuẩn hóa (Normalized 0..1)**: Chú thích không bao giờ bị lệch khi đổi kích thước cửa sổ hoặc zoom.

4. **Xuất tài liệu HTML độc lập (Self-contained HTML Export)**:
   - Xuất ra duy nhất **một file `.html`**.
   - Mở trực tiếp bằng `file://` hoàn toàn offline (không cần mạng, không tải thư viện ngoài).
   - Có trang bìa, mục lục (TOC) theo từng tính năng kèm anchor nhảy mượt mà.
   - Ảnh chụp kèm chú thích được nén nhúng dưới dạng base64 `data:` URI.
   - Tích hợp Lightbox phóng to ảnh và định dạng tối ưu in ấn (`@media print` / Lưu PDF).
   - Khử độc ký tự (HTML Sanitization / XSS prevention) bảo vệ an toàn tuyệt đối.

---

## 🚀 Hướng dẫn cài đặt vào Chrome / Edge

### Bước 1: Build mã nguồn (nếu chưa build)
Thư mục `dist/` đã được build sẵn sàng. Nếu bạn chỉnh sửa mã nguồn, chỉ cần chạy:
```bash
npm run build
```

### Bước 2: Cài đặt vào trình duyệt
1. Mở trình duyệt Google Chrome hoặc Microsoft Edge.
2. Truy cập địa chỉ quản lý tiện ích:
   - Trên Chrome: `chrome://extensions`
   - Trên Edge: `edge://extensions`
3. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
4. Nhấn nút **Tải tiện ích đã giải nén (Load unpacked)**.
5. Chọn thư mục `dist` trong dự án:
   ```
   /Users/win/Documents/antigravity/bold-borg/dist
   ```
6. Tiện ích **Web Guide Builder** sẽ xuất hiện trên thanh công cụ của trình duyệt!

---

## 📖 Hướng dẫn sử dụng nhanh

1. Nhấp vào biểu tượng tiện ích trên thanh công cụ để mở **Side Panel** bên cạnh trang web.
2. Bấm nút **"Dữ liệu mẫu"** để tải sẵn một bộ hướng dẫn đầy đủ mẫu (Hướng dẫn Quản trị Hệ thống & Người dùng), hoặc bấm nút **`+`** để tạo dự án mới.
3. Chuyển sang website bạn muốn hướng dẫn, nhấp **"Chụp bước mới"** trên Side Panel. Bước mới sẽ tự động được tạo kèm ảnh màn hình tab.
4. Bấm **"Biên tập"** tại bước vừa tạo để mở canvas vẽ khung, mũi tên, số thứ tự và viết mô tả.
5. Bấm **"Lưu thay đổi"**.
6. Bấm nút **"Xuất tài liệu HTML"** để tải về file hướng dẫn mở được offline ở bất kỳ đâu!

---

## 🧪 Kiểm thử tự động (Unit Tests)

Dự án bao gồm bộ kiểm thử tự động với Vitest:
```bash
npm test
```
Tất cả kịch bản chấp nhận (Acceptance Tests: CRUD, sắp xếp, cascading delete, hit testing chú thích, XSS sanitization, HTML offline) đều được kiểm thử nghiêm ngặt và đạt 100%.

---

## 📂 File tài liệu mẫu xuất sẵn

Bạn có thể xem trước file tài liệu HTML thực tế đã được xuất tại:
- `demo/huong-dan-quan-tri-mau.html`
(Mở trực tiếp file này bằng Chrome, Edge, Safari để trải nghiệm giao diện người dùng).

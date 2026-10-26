# MUN Global Solutions Showcase Web App

Hệ thống web trực tuyến phục vụ sự kiện Model United Nations (MUN Senior) tại trường học:
- **Chủ đề sự kiện**: *"We live differently, but we have the same hope."*
- **6 Quốc gia tham dự**: China (Trung Quốc), South Africa (Nam Phi), South Korea (Hàn Quốc), Russia (Nga), Japan (Nhật Bản), France (Pháp).
- **Logo chính thức**: United Nations General Assembly (Image #1).

---

## 🚀 Các Cổng Truy Cập (Portals)

1. **Trang Chủ Sự Kiện (Hub)**: `http://localhost:3000/`
2. **Cổng Bình Chọn Học Sinh (Students' Choice)**: `http://localhost:3000/student`
   - Mỗi quốc gia chọn quốc gia của mình ở Bước 1.
   - Bình chọn cho **2 quốc gia khác** xuất sắc nhất.
   - Hệ thống tự động khóa cờ quốc gia của chính mình (chống tự bầu).
   - Hiển thị cờ sắc nét, xác nhận nộp phiếu, hiệu ứng pháo hoa ăn mừng và mã biên nhận.
3. **Phòng Chấm Điểm Ban Giám Khảo (Judge Scoring)**: `http://localhost:3000/judge`
   - Bám sát 100% tài liệu **Simple Grading Rubric**:
     - 5 tiêu chí thang điểm 1-3: Preparation, Speaking & Pronunciation, Vocabulary Usage, Teamwork & Mentor Collaboration, Active Listening & Q&A.
     - Base Score tối đa 15 điểm.
     - Ô tích chọn **Advanced Challenge Bonus (+50 Bonus Points)** khi trả lời thành công câu hỏi Q&A nâng cao.
     - Tổng điểm tối đa: 65 điểm.
     - Ô ghi nhận xét & góp ý chi tiết của Giám khảo.
4. **Bảng Xếp Hạng Trực Tiếp Sân Khấu (Live Stage)**: `http://localhost:3000/results`
   - Dành cho máy chiếu hội trường: Tự động cập nhật thời gian thực (Live 3s).
   - Bục vinh danh Podium Top 3 Students' Choice.
   - Bảng xếp hạng chi tiết Ban Giám khảo.
   - Nút **Lễ Vinh Danh Trao Giải** cho MC kích hoạt hiệu ứng pháo hoa toàn màn hình.
5. **Cổng Quản Trị & Mã QR (Admin)**: `http://localhost:3000/admin`
   - Mã PIN mặc định: `mun2026`
   - Tự động sinh **3 mã QR** để học sinh và thầy cô dùng điện thoại quét vào ngay qua Wi-Fi trường.
   - Xuất dữ liệu ra file Excel CSV (phiếu bầu học sinh & bảng điểm giám khảo).
   - Quản lý, xóa phiếu thử nghiệm, reset dữ liệu cho buổi thi chính thức.

---

## 🛠️ Hướng Dẫn Khởi Chạy

### Cách 1: Chạy trực tiếp trên máy
1. Mở thư mục dự án và nhấp đúp vào file `start.bat` (hoặc gõ lệnh `npm start` trong terminal).
2. Mở trình duyệt và truy cập `http://localhost:3000`.

### Cách 2: Chia sẻ qua mạng Wi-Fi trường học
1. Máy tính bật server theo Cách 1.
2. Mở `http://localhost:3000/admin` (PIN: `mun2026`).
3. Trang sẽ hiển thị địa chỉ IP nội bộ (Ví dụ: `http://192.168.1.15:3000`) và 3 mã QR tương ứng.
4. Chiếu mã QR lên bảng/máy chiếu hoặc in ra để học sinh và giám khảo quét bằng camera điện thoại.

### Cách 3: Đưa lên mạng Internet công cộng (Online 100%)
- **Dùng Cloudflare Tunnel (Miễn phí, không cần đăng ký tài khoản)**:
  ```bash
  npx cloudflared tunnel --url http://localhost:3000
  ```
  Terminal sẽ cấp 1 đường link công khai dạng `https://xxxx.trycloudflare.com` để bất kỳ ai có 4G/Internet đều truy cập được ngay.
- **Hoặc đưa lên Render.com / Vercel**:
  Repository đã sẵn sàng file `package.json` và `server.js` chỉ cần kết nối Git để deploy.

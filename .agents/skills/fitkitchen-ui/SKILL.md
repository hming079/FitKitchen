---
name: fitkitchen-ui
description: Thiết kế, xây dựng hoặc chỉnh sửa frontend UI của FitKitchen theo design system dùng chung; áp dụng cho Customer và Admin, kể cả khi không có mockup.
---

# Xây dựng UI FitKitchen

Các đường dẫn code bên dưới tính từ root repository. Skill này không cấp quyền thêm nghiệp vụ, API, dữ liệu hoặc thay đổi luồng ngoài yêu cầu.

1. Đọc `AGENTS.md`, `frontend/AGENTS.md` và hướng dẫn có phạm vi áp dụng. Đọc [DESIGN_SYSTEM.md](../../../docs/design/DESIGN_SYSTEM.md); `frontend/src/styles.css` là nguồn giá trị token. Tôn trọng phần Lovable quản lý và các thay đổi sẵn có.
2. Xem màn hình hiện tại hoặc màn hình tương đương gần nhất trong code và ứng dụng đang chạy. Ghi ngắn: ai dùng, tác vụ chính, thông tin cần để quyết định, hành động chính/phụ. Không tự thêm KPI, hero hay card chỉ vì thiếu mockup.
3. Tìm bằng `rg` và tái sử dụng theo thứ tự: domain component → shared component → primitive trong `frontend/src/components/ui` → mở rộng component/variant hiện có → component mới nếu các lựa chọn trước không đáp ứng. Nêu lý do nếu tạo mới; không bọc primitive bằng abstraction chỉ đổi tên.
4. Giữ hướng fresh, practical, food-focused: nền sáng hơi ấm, xanh lá đậm, lime có tiết chế. Customer ưu tiên món ăn, giá, calo/macros, mục tiêu và chọn món; Admin ưu tiên đọc dữ liệu, tìm kiếm, trạng thái và thao tác. Giữ font, icon library, spacing, radius và shadow trong tài liệu. Dùng đúng cặp foreground/background semantic; không dùng lime như màu trạng thái hay chữ nhỏ trên nền sáng.
5. Liệt kê và xây các trạng thái thực sự thuộc tác vụ: mặc định, hover, keyboard focus, disabled/pending và loading/empty/error/success khi có nguồn phát sinh. Giữ nhãn input, text trạng thái, thứ tự focus, responsive và reduced-motion. Không thêm màn hình loading/error giả vào luồng đồng bộ chỉ để đủ checklist.
6. Dùng nội dung thật của FitKitchen và nguồn dữ liệu hiện tại. Giữ `0` là `0`, thiếu dữ liệu hiển thị rõ, demo/fixture phải có nhãn khi có thể gây hiểu lầm. Không bịa trạng thái tài khoản, đơn chưa hoàn tất, rating hay nút hoạt động giả. Các ví dụ tương lai trong tài liệu không chứng minh app đã hỗ trợ chúng.
7. Chạy các lệnh có thật trong `frontend/package.json` phù hợp thay đổi; format chỉ file đã sửa. Kiểm tra các cặp màu đã dùng, desktop/mobile, bàn phím và trạng thái liên quan trên ứng dụng render. Khi đổi token toàn cục, kiểm tra Customer, login và Admin theo mức ảnh hưởng; không sửa đăng nhập hay nghiệp vụ chỉ để trình diễn.
8. Đọc và thực hiện [fitkitchen-ui-review](../fitkitchen-ui-review/SKILL.md) trước khi kết thúc. Sửa finding trong phạm vi; báo mức độ, bằng chứng, kiểm chứng thực tế và giới hạn. Không coi lint/build thành công là review trực quan.

Nếu môi trường chưa tự nhận skill, yêu cầu agent đọc file này trực tiếp; không cần cài vào tài khoản cá nhân.

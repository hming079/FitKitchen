# Kiểm chứng design system — 17/11/2026

## Thay đổi và phạm vi

Baseline: `62b71e2` trên `main`, working tree sạch khi bắt đầu. Đã đọc frontend/AGENTS.md; root trước đó chưa có AGENTS.md, tài liệu design system hoặc repository skill. React 19, TanStack Router/Start, Tailwind v4 cấu hình trong CSS; dùng Lovable Vite config, DM Sans/Space Grotesk, Lucide và primitives hiện có.

Trước: đã có nền semantic và `.dark`, thiếu success/warning/info và hướng dẫn dùng chung; Customers dùng table/input cục bộ, màu hard-code, avatar trang trí, goal pill, nút more-options không có handler và bảng tối thiểu 760px trên mobile.

Sau: giữ nền/primary/font/brand, thêm semantic status light/dark và highlight foreground; tăng tương phản destructive/input/focus; mở rộng Badge/Alert, cải thiện focus Button/Input. Customers tái sử dụng primitive, có nhãn search, note demo, count/empty đọc được và danh sách có nhãn trên mobile. Sáu bản ghi và bộ lọc tên/email/phone của route giữ nguyên. Không có API, status tài khoản, khóa/mở, lịch sử, RBAC, JWT hoặc thay đổi đăng nhập.

Tài liệu chính: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). Hai skill version control tại [.agents/skills/fitkitchen-ui](../../.agents/skills/fitkitchen-ui/SKILL.md) và [fitkitchen-ui-review](../../.agents/skills/fitkitchen-ui-review/SKILL.md), liên kết từ root/frontend AGENTS.md. Catalog của phiên Codex này đã liệt kê cả hai; chưa kiểm chứng tự động discovery ở công cụ AI khác. Có thể yêu cầu đọc file trực tiếp, không cài bản riêng cho thành viên.

## Kiểm tra tự động

Các lệnh từ `frontend`, trừ validator. Node 24.22.1; dependency cài bằng Bun frozen lockfile, không đổi package/lockfile. Browser dùng Playwright/Chromium 158 trong môi trường QA riêng vì phiên này không có Chrome DevTools MCP. Công cụ QA/thư viện hệ thống không thêm vào dependencies ứng dụng.

| Kiểm tra                                                                      | Kết quả thực tế                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test`                                                                | 2 file, 6 test qua. Đây là test hiện có cho routing/meal customization, không phải chứng nhận UI toàn app.                                                                                                                                                                                                                        |
| `npm run build`                                                               | Qua build client, SSR và Nitro/Cloudflare. Có cảnh báo inlineDynamicImports bị bỏ qua khi codeSplitting được bật; dev server cũng thông báo Vite đã hỗ trợ tsconfig paths. Đây là cấu hình Lovable hiện có. Không sửa config do Lovable cung cấp.                                                                                 |
| `npm run lint`                                                                | Chưa qua toàn repo: 369 lỗi Prettier, 6 warning. Bản gốc cùng dependency: 370 lỗi, 6 warning. Không tắt rule, không format toàn repo.                                                                                                                                                                                             |
| ESLint trên CustomerDirectory và 4 primitive đã sửa                           | 0 lỗi, 2 warning Fast Refresh ở export variants của Button/Badge đã có từ baseline.                                                                                                                                                                                                                                               |
| `./node_modules/.bin/tsc --noEmit`                                            | Chưa qua: cùng 6 lỗi ở `admin.tsx` như baseline; status `Cancelled` xung đột DemoOrder, truy cập demoMeals[0] và s.customer có thể undefined. Đã so sánh toàn bộ diagnostic sau khi chuẩn hóa số dòng/cột, nội dung giống baseline.                                                                                               |
| `prettier --check` các file mới/sửa, trừ route Admin cũ và frontend/AGENTS.md | Qua CSS, primitives, CustomerDirectory, script và Markdown/skills. Route Admin giữ format cũ vì thay đổi nhỏ; vẫn nằm trong lint toàn repo ở trên. frontend/AGENTS.md giữ nguyên từng byte của khối Lovable quản lý; format check file này và baseline cùng yêu cầu chèn dòng trắng trong khối đó, nên không áp dụng sửa tự động. |
| `node scripts/check-design-tokens.mjs`                                        | 60 cặp qua: light/dark; đủ mapping @theme và giá trị token mới; text ≥4.5:1, focus/input ≥3:1.                                                                                                                                                                                                                                    |
| Validator `skill-creator/scripts/quick_validate.py`                           | Cả hai skill hợp lệ. Kiểm tra thêm đủ ID 01–35, mỗi row có dấu hiệu/câu hỏi/cách sửa/ngoại lệ, và link nội bộ tồn tại.                                                                                                                                                                                                            |
| `git diff --check`                                                            | Qua. Không sửa file generated, backend, migrations hoặc khối LOVABLE:BEGIN/END.                                                                                                                                                                                                                                                   |

Lỗi nền được tái hiện bằng snapshot `git archive 62b71e2` và cùng node_modules, không checkout đè working tree. Không sửa logic Orders/Subscriptions ngoài phạm vi để làm typecheck xanh.

## Rendered review

Chạy `npm run dev -- --host 127.0.0.1 --port 3000`, browser profile riêng. Chờ font và transition kết thúc trước khi dùng ảnh làm bằng chứng; không coi ảnh giữa animation là trạng thái layout cuối.

| Màn hình              | Viewport / theme / trạng thái          | Quan sát và giới hạn                                                                                                                                                                                                                                                                       |
| --------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/admin` → Customers  | 1440×900 / light / 6 bản ghi           | Bảng đọc đủ tên/email/phone/goal; phân cấp heading/search/data rõ, không thêm KPI hay action giả. [Ảnh desktop](screenshots/customers-desktop.png).                                                                                                                                        |
| Customers             | Desktop / light / tìm kiếm             | Lọc `linh`, `+84 903`, `jade.le@email.com` lần lượt có 1 kết quả. Xóa query trở về 6. Không khớp: count giữ đúng 0, lời hướng dẫn tìm lại. [Empty](screenshots/customers-empty.png).                                                                                                       |
| Customers             | Desktop / light / keyboard focus       | Tab/Shift+Tab đến search; focus thật có ring 2px và offset 2px, không bị cắt trong vùng header. [Focus](screenshots/customers-focus.png).                                                                                                                                                  |
| Customers             | 390×844 / light / danh sách và empty   | Thay bảng bằng list, tên/goal trước email/phone, tất cả trường vẫn đọc được. Search cao 44px, 16px trên mobile. Mở menu rồi chọn Customers vẫn dùng được search. [Ảnh mobile](screenshots/customers-mobile.png).                                                                           |
| Customers             | 320, 768, 1024px / light               | Đo scrollWidth bằng innerWidth ở cả ba chiều rộng; không tràn ngang trang. Quan sát trực quan chi tiết tập trung vào 1440 và 390px.                                                                                                                                                        |
| Customers             | 390px / reduced-motion                 | Danh sách không có motion mới cản tác vụ. Sidebar cũ vẫn dùng transition-transform; chưa chuẩn hóa reduced-motion/focus trapping của toàn shell.                                                                                                                                           |
| Fixture primitive tạm | 1440×900 / light + dark                | Render Badge success/destructive/warning/info; Alert 4 trạng thái; Button primary/outline/destructive/disabled; Input; lime với foreground tương ứng. Có nhãn demo, không có khách thật hay handler nghiệp vụ. [Light](screenshots/tokens-light.png), [dark](screenshots/tokens-dark.png). |
| `/login`              | 1440×900 / light / mặc định            | Quan sát ảnh, typography, form và nút sau đổi token. Không submit, không kiểm chứng đăng nhập.                                                                                                                                                                                             |
| `/`                   | 1440×900 / light / hero + menu loading | Quan sát bố cục, chọn goal và action chính. Catalog còn loading lúc chụp; không xác minh Shopify/cart, dữ liệu món tải xong hay fallback.                                                                                                                                                  |

Lượt browser cuối hoàn tất với 0 pageerror/console error/warning trên các bước đã chạy. Một lượt trước từng có hydration warning về thuộc tính style của input login; không tái hiện ở lượt cuối, chưa xác định nguyên nhân. Không sửa luồng đăng nhập vì thành viên khác đang phụ trách.

Fixture chỉ phục vụ kiểm chứng đã được xóa trước build cuối; không thêm route/trang design-system demo vào ứng dụng hoặc bản build. Ảnh fixture lưu để review là minh họa component, không phải chức năng quản lý khách đã hoạt động. Chưa quan sát toàn Customers trong dark, toàn bộ dark app, thiết bị cảm ứng thật, screen reader, zoom 200%, tất cả dialog/form/sidebar hoặc luồng bất đồng bộ ngoài phạm vi.

## Tương phản

Script đọc OKLCH từ CSS, chuyển qua linear sRGB để tính WCAG relative luminance; kiểm tra gamut và một số giá trị chuẩn đen/trắng/xám. Các số dưới làm tròn để báo cáo; quyết định pass dùng giá trị chưa làm tròn.

| Cặp                                          | Light   | Dark    |
| -------------------------------------------- | ------- | ------- |
| foreground / background                      | 16.06:1 | 16.37:1 |
| primary-foreground / primary                 | 13.95:1 | 13.11:1 |
| brand-highlight-foreground / brand-highlight | 9.96:1  | 9.96:1  |
| success / success-muted                      | 6.34:1  | 8.06:1  |
| warning / warning-muted                      | 6.47:1  | 9.20:1  |
| destructive / destructive-muted              | 5.76:1  | 7.07:1  |
| info / info-muted                            | 5.31:1  | 7.80:1  |
| ring / background                            | 5.02:1  | 9.54:1  |
| input / card                                 | 3.87:1  | 5.18:1  |

Đã đối chiếu thêm màu computed của fixture bằng canvas sRGB trong browser: 78 lượt đo text/background, bao gồm default và hover primary/destructive ở cả hai theme; nhỏ nhất 5.3146:1, không có cặp dưới 4.5. Các lượt gồm nhiều cặp lặp qua trạng thái, không phải 78 token khác nhau. Disabled được quan sát trực quan, không tính vào ngưỡng chữ thường. Không đo nền ảnh/opacity của toàn website.

## Review anti-slop theo skill mới

Đã kiểm tra code và ảnh ở phạm vi trên theo cả 35 mục, không gắn nhãn “toàn app đạt”. Các ghi nhận chính:

- **Đã xử lý — #01–04:** Customers dùng semantic foreground/surface/info, Input/Label/Table hiện có; không thêm library, font hay icon. Các màn khác chưa được chuyển đổi đồng loạt.
- **Đã xử lý — #05–14:** bỏ avatar nhiều màu và goal pill; không dùng icon mặc định cho mỗi heading/row. Giữ một ranh giới cho directory vì nó gom search và kết quả; note demo riêng giúp phân biệt dữ liệu giả lập. Đây là lý do giữ container/Alert, không thêm card lồng hay KPI.
- **Đã kiểm tra — #15–21, #26–28, #34–35:** chỉ giữ bốn trường có trong fixture, mục tiêu Cut/Bulk/Maintain, số kết quả thực và nhãn demo. Không phát minh status, lịch sử, đơn chưa hoàn tất hay testimonial. Loading/error/success nghiệp vụ không áp dụng cho directory đồng bộ/read-only; không thêm trạng thái giả để đủ checklist. Ví dụ khóa tài khoản chỉ ở tài liệu và ảnh fixture.
- **Đã xử lý — #22–25:** tên khách rõ hơn metadata; tìm kiếm là thao tác thực; bỏ nút more-options không có handler. Không thêm primary CTA vào màn chỉ đọc.
- **Đã kiểm tra trong phạm vi — #29–33:** directory không thêm animation, mobile đổi cấu trúc thông tin thay vì ép bảng rộng. Đã thử keyboard search và menu trên mobile. Zoom 200%/screen reader và focus management toàn shell chưa xác minh.

Finding còn lại ngoài phần directory đã chuẩn hóa:

| Mức độ / mục                | Vị trí và bằng chứng                                                                                                                                                               | Tác động / đề xuất                                                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cần cải thiện / #01, #22    | Admin shell: breadcrumb, mô tả trang/footer và sidebar vẫn có màu hard-code nhạt; ảnh desktop/mobile cho thấy rõ khác biệt với directory dùng token.                               | Chưa thể khẳng định tương phản toàn Admin. Chuyển shell sang semantic tokens trong task riêng và đo tất cả cặp chữ/focus.                                                                               |
| Cần cải thiện / #21, #26–28 | Shell hiện có: “Saturday orders are up 18%”, “All systems operational”, static date và Export report chỉ hiện toast, không tạo file. Không có nguồn live được xác minh trong task. | Các claim/action preview có thể bị hiểu nhầm nếu xem như Admin thật. Demo note của directory làm rõ phạm vi dữ liệu; cần chuẩn hóa nội dung shell và hành vi export trước khi phát hành nghiệp vụ thật. |
| Cần cải thiện / #31, #33    | Sidebar cũ có transition-transform, chưa quản lý focus như Sheet; chỉ kiểm tra mở/chọn Customers bằng click.                                                                       | Chưa chứng minh keyboard/reduced-motion cho navigation mobile toàn diện. Tái sử dụng Sheet và kiểm chứng trong task shell, không tự mở rộng lần chuẩn hóa directory này.                                |
| Cần cải thiện / #01, #28    | MealCard/DemoMealCard cũ vẫn có chữ màu brand và truthy fallback cho macros; đọc code xác nhận, chưa kiểm tra trạng thái món render xong.                                          | Có thể mất giá trị 0 hoặc khó đọc chữ nhỏ. Chuyển dần khi làm Customer UI, giữ 0 và đo tương phản trên surface thực tế.                                                                                 |

Đây là các finding cần bàn giao, không phải khẳng định tính năng tương ứng đã hoạt động. Không thay backend, login, nghiệp vụ Orders/Subscriptions hay toàn shell chỉ để làm báo cáo “đạt”.

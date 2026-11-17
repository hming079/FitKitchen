# FitKitchen design system

## Phạm vi và sản phẩm

FitKitchen cung cấp suất ăn theo mục tiêu tập luyện: Cut, Bulk, Maintain. Customer UI giúp xem món, giá, calo/macros, chọn món, đặt hàng và theo dõi gói/thông tin cá nhân. Admin giúp người vận hành tìm dữ liệu, đọc trạng thái và thực hiện tác vụ chính xác. Customer có thể ưu tiên ảnh món; Admin ưu tiên mật độ thông tin, bảng, tìm kiếm và thao tác. Cả hai dùng cùng nền tảng **fresh, practical, food-focused**: xanh đậm, nền sáng hơi ấm, lime vừa phải, bố cục rõ ràng.

Code hiện hiển thị cả tên FitFuel/BepFit; tài liệu này không đổi logo hay nhận diện. Đọc [hướng dẫn root](../../AGENTS.md) và [frontend/AGENTS.md](../../frontend/AGENTS.md), đặc biệt phần Lovable, trước khi sửa.

Nguồn sự thật: [styles.css](../../frontend/src/styles.css) cho token, [components/ui](../../frontend/src/components/ui) cho primitive. Đây là chuẩn để áp dụng dần, không phải tuyên bố mọi trang cũ đã tuân thủ. Phạm vi tham chiếu là `/admin` → Customers: 6 bản ghi demo và tìm kiếm cục bộ, không có API quản lý khách, khóa/mở tài khoản hoặc lịch sử khách hàng.

## Màu semantic

Giá trị CSS phải là `oklch()`. Không sao chép HEX hay giá trị token vào component. Các màu nền/chữ/primary/secondary/muted/lime hiện có đã gần hướng màu được chọn nên được giữ để giảm ảnh hưởng toàn cục. `lime` là alias tương thích của `brand-highlight`; code mới dùng tên semantic và đúng foreground. Không đổi màu theo từng trang.

| Vai trò               | Utility nền                                             | Utility chữ tương ứng             | Cách dùng                                                                                 |
| --------------------- | ------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| Nền trang sáng hơi ấm | `bg-background`                                         | `text-foreground`                 | Nội dung chính, layout Customer/Admin                                                     |
| Bề mặt độc lập        | `bg-card`                                               | `text-card-foreground`            | Món ăn, danh sách có ranh giới cần thiết                                                  |
| Lớp nổi               | `bg-popover`                                            | `text-popover-foreground`         | Select/popover/menu                                                                       |
| Action chính          | `bg-primary`                                            | `text-primary-foreground`         | `Button` default; tối đa một mức ưu tiên chính trong một vùng                             |
| Bề mặt phụ            | `bg-secondary`                                          | `text-secondary-foreground`       | Vùng hỗ trợ, action phụ                                                                   |
| Bề mặt giảm nhấn      | `bg-muted`                                              | `text-muted-foreground`           | Header bảng, metadata đọc được; nội dung chính vẫn dùng foreground                        |
| Tương tác nhẹ         | `bg-accent`                                             | `text-accent-foreground`          | Hover/selection của primitive, không dùng thay trạng thái nghiệp vụ                       |
| Nhấn thương hiệu      | `bg-brand-highlight`                                    | `text-brand-highlight-foreground` | Lime có tiết chế; không dùng chữ trắng, không dùng lime làm chữ nhỏ trên nền sáng         |
| Success               | `bg-success-muted`                                      | `text-success`                    | Hoàn tất/đang hoạt động **khi có dữ liệu xác nhận**                                       |
| Warning               | `bg-warning-muted`                                      | `text-warning`                    | Cần lưu ý, ví dụ đơn chưa hoàn tất                                                        |
| Error/destructive dịu | `bg-destructive-muted`                                  | `text-destructive`                | Lỗi hoặc tài khoản đã khóa có nguồn xác nhận                                              |
| Info                  | `bg-info-muted`                                         | `text-info`                       | Thông tin hỗ trợ; Customers dùng note demo                                                |
| Trạng thái đặc        | `bg-success`, `bg-warning`, `bg-info`, `bg-destructive` | `text-<status>-foreground`        | Luôn ghép đúng cặp; destructive action dùng `Button variant="destructive"`                |
| Viền phân nhóm        | `border-border`                                         | —                                 | Separator nhẹ, không đủ làm tín hiệu duy nhất nhận biết input                             |
| Viền control          | `border-input`                                          | —                                 | Đậm hơn border để nhận ra control                                                         |
| Focus                 | `ring-ring` + offset                                    | —                                 | Button/Input có ring 2px, offset 2px nền background; luôn xem focus render trong ngữ cảnh |

`coral`, `fresh`, `lime`, chart/sidebar tokens được giữ tương thích. Coral/fresh/lime là màu thương hiệu cũ, **không thay thế** success/warning/info/destructive và không mặc nhiên đạt tương phản cho chữ nhỏ. Sidebar/chart hiện có chưa được chuyển đổi toàn bộ. Thay đổi màu toàn cục trong đợt này giới hạn ở destructive, input, ring; token brand giữ màu cũ và thêm tên theo vai trò.

### Thêm token và kiểm tra tương phản

1. Tìm token tương đương trước. Nếu thiếu vai trò thực sự, thêm biến tại `:root` và `.dark` trong `styles.css`.
2. Đăng ký `--color-<role>: var(--<role>)` trong `@theme inline` để sinh `bg-*`, `text-*`, `border-*`; xem [Tailwind theme variables](https://tailwindcss.com/docs/theme).
3. Kiểm tra foreground trên background, cả surface phụ, hover, disabled và focus. Văn bản thường mục tiêu ≥4.5:1 theo [WCAG contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html); tín hiệu control/focus cần ≥3:1 với màu kề theo [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Không dùng màu làm tín hiệu duy nhất: thêm text/nhãn phù hợp.
4. Chạy script tương phản được ghi ở phần kiểm chứng, rồi kiểm tra trình duyệt; opacity, ảnh và nền pha trộn cần đo riêng. Token đạt không đồng nghĩa mọi tổ hợp utility đạt.

### Light và dark

Light là giao diện mặc định; `.dark` hiện có đổi biến và Tailwind dark variant. Token mới có giá trị dark, status dùng chữ sáng trên nền dịu tối, solid status dùng foreground tối. `brand-highlight-foreground` luôn tối để đọc trên lime cả hai theme. Không thêm theme switcher. Có thể thử `.dark` bằng fixture/local browser; không lưu tùy chọn hay thay luồng người dùng để demo.

Chưa xem toàn bộ website trong dark: code cũ còn `bg-white`, màu hard-code và `bg-lime text-foreground` có thể không phù hợp khi foreground đổi sáng. Không tuyên bố dark mode đã hoàn thiện; kiểm tra các màn hình bị ảnh hưởng trước khi mở hỗ trợ toàn app.

## Typography, spacing và bề mặt

- **DM Sans / `font-sans`:** body, bảng, form, nhãn và button. **Space Grotesk / `font-display`:** heading trang hoặc tên món. Font được tải qua `<link>` trong `src/routes/__root.tsx`; giữ fallback sans-serif, không import font remote trong CSS hay thêm font mới.
- Ưu tiên `text-base` (16px) cho body/mobile input, `text-sm` (14px) cho bảng và nội dung hỗ trợ, `text-xs` (12px) cho metadata ngắn; không thu chữ thông tin chính để nhét thêm dữ liệu. Heading vùng `text-base font-semibold`; heading trang thường `text-2xl`/`text-3xl font-display`. Dùng `leading-relaxed` cho đoạn dài, `tabular-nums` cho số cần so sánh.
- Dùng scale Tailwind hiện có (đơn vị cơ sở 4px): 1/2/3/4/5/6/8/10/12 = 4/8/12/16/20/24/32/40/48px. Thường gap 2–3 trong nhóm, 4–6 giữa nhóm, 6–8 giữa section; gutter 4 mobile, 6–8 màn rộng. Không tạo scale riêng từng trang. Giá trị layout đặc thù (cột sidebar, aspect ratio) phải có lý do.
- `--radius` hiện 0.625rem; `rounded-sm/md/lg` dựa trên token tương ứng 6/8/10px. Dùng `rounded-lg` cho vùng dữ liệu, `rounded-md` primitive. `rounded-full` chỉ khi hình dạng có ý nghĩa (avatar, toggle), không biến mọi metadata thành pill.
- Border mảnh 1px; ưu tiên spacing/alignment hơn thêm box. Dùng shadow sẵn trong primitive; không thêm shadow cho từng row/section. Dialog/popover cần elevation, danh sách thông thường không cần.
- Icon library duy nhất đang dùng: `lucide-react`, stroke mặc định. Ưu tiên 16px cạnh text, 20px cho navigation/action, 24px khi có lý do. Icon-only action phải có accessible name; SVG trang trí `aria-hidden`. Không tự động thêm icon nền tròn vào heading/KPI.

## Responsive và accessibility baseline

Dùng breakpoint Tailwind hiện có (`sm` 640, `md` 768, `lg` 1024, `xl` 1280). Chọn thứ tự thông tin theo tác vụ trên mobile; không chỉ xếp dọc desktop. Customers dùng bảng từ `md`, danh sách contact có nhãn dưới `md`; tên và goal trước email/phone, giữ đủ dữ liệu. Bảng đối chiếu thật sự cần ngang có thể cuộn trong vùng riêng, không làm tràn trang.

Kiểm tra tối thiểu desktop và mobile 320–390px; thêm tablet/zoom 200% khi ảnh hưởng layout. Input mobile dùng 16px, control ưu tiên cao ≥44px, target tối thiểu 24px và khoảng cách đủ. Không ẩn thông tin quyết định để tiết kiệm chỗ. Form có label liên kết, lỗi gắn với field, trạng thái bất đồng bộ có `role="status"`/`alert` đúng mức khẩn. Note tĩnh không dùng alert sống. Heading theo thứ bậc, table có caption/column headers, list có nhãn khi cần. Kiểm tra Tab, Enter/Space, Escape và focus trở về trigger cho dialog/menu thực sự liên quan. Motion ngắn, chỉ phục vụ interaction; dùng `motion-reduce`/`motion-safe` khi có chuyển động không thiết yếu.

## Component và mở rộng

Tìm theo thứ tự: **domain → shared → primitive → mở rộng component hiện có → tạo mới nếu thiếu**. Đọc implementation/props trước khi dùng. Một wrapper chỉ đổi tên không phải abstraction cần thiết. Native element đúng ngữ nghĩa như `section`, `dl`, `ul` không cần một component riêng.

| Primitive có sẵn trong `frontend/src/components/ui` | Khi dùng / lưu ý                                                                                                                                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                            | default cho action chính; outline/secondary cho phụ; ghost cho nhẹ; link cho điều hướng dạng text; destructive cho thao tác rủi ro ở ngữ cảnh phù hợp. Giữ disabled/pending thật, text cụ thể.                                                              |
| `Input`, `Textarea`, `Label`, `Form`                | Form có nhãn và hướng dẫn/lỗi theo field. Không tự dựng control mất focus chỉ để có style khác.                                                                                                                                                             |
| `Select`, `Checkbox`, `RadioGroup`, `Switch`        | Chọn một từ danh sách; nhiều lựa chọn; một trong ít lựa chọn; bật/tắt ngay. Không thay checkbox bằng pill không có ngữ nghĩa.                                                                                                                               |
| `Dialog`, `AlertDialog`, `Sheet`                    | Chi tiết/tác vụ tập trung; xác nhận hậu quả; panel ở mép/mobile nav. Dùng focus management của primitive, không tự vẽ modal.                                                                                                                                |
| `Table` + subcomponents                             | Dữ liệu cần so cột; caption mô tả và header có scope; không tạo thêm DataTable engine cho một danh sách đơn giản.                                                                                                                                           |
| `Tabs`                                              | Chuyển giữa các panel đồng cấp trong cùng tác vụ, không thay navigation URL khi cần route.                                                                                                                                                                  |
| `Badge`                                             | Trạng thái ngắn: default/secondary/outline/destructive, thêm success/warning/info. Badge tĩnh không phải nút, luôn có text, không gắn mọi metadata vào badge.                                                                                               |
| `Card` + subcomponents                              | Một đối tượng/nhóm độc lập; không cần dùng card nếu section + spacing đủ rõ.                                                                                                                                                                                |
| `Alert` + description/title                         | Thông báo ảnh hưởng quyết định: default/destructive và success/warning/info. Mặc định `role="alert"`; note tĩnh override `role="note"`, thông báo kết quả không khẩn cân nhắc `role="status"`. Dùng title khi cần, không thêm heading h5 nếu phá hierarchy. |
| `Skeleton`, `Progress`, `sonner`                    | Loading/progress/toast có tác vụ thật; không dùng toast thay lỗi field cần đọc lại.                                                                                                                                                                         |
| `DropdownMenu`, `Tooltip`, `Popover`, `Pagination`  | Action hiếm, giải thích phụ, nội dung nổi, phân trang có dữ liệu thật; tooltip không giấu thông tin thiết yếu.                                                                                                                                              |

Domain/shared component hiện có: `MealCard`, `DemoMealCard`, `MealCustomizationDialog`, `CartDrawer`, `StoreHeader`, `SubscriptionPlans` trong `frontend/src/components`. Chúng giữ catalog/cart Shopify và preview theo quy ước hiện tại; không nhân bản cho trang mới. `admin/CustomerDirectory` là composition trình bày dữ liệu, nhận rows/query/callback; tìm kiếm và fixture vẫn thuộc route Admin. Các helper Admin cũ `Panel`, `DataTable`, `SearchBox`, `Modal` còn cục bộ trong `admin.tsx`; đây không phải primitive mới nên dùng cho trang mới. Mở rộng dần khi task sau chạm đúng phạm vi, tránh nhân rộng implementation cũ.

### Các trạng thái

Loading chỉ khi đang tải thật, giữ vị trí nội dung, có thông báo đọc được. Empty phân biệt chưa có bản ghi với không khớp tìm kiếm; đưa bước khắc phục phù hợp, không bịa số. Error nói việc gì thất bại và cách thử lại nếu có hành vi retry; success chỉ sau khi thao tác được xác nhận. Không đổi thiếu dữ liệu thành `0`; không đổi `0` thành “—”. Disabled action có lý do khi người dùng cần biết, không thêm hành động giả cho đủ trạng thái. Customers hiện đồng bộ/read-only nên chỉ có danh sách, lọc và empty; không thêm network loading/error giả.

## Ví dụ FitKitchen

Các snippet trạng thái tài khoản/đơn hàng/khóa bên dưới **chỉ hướng dẫn dùng design system**, không phải tính năng hay dữ liệu đang có trong Customers. Không sao chép vào route và gán status cho fixture hiện tại. Chỉ nối với nguồn đã được triển khai trong task nghiệp vụ tương lai.

```tsx
// Ví dụ trạng thái khi nguồn dữ liệu thực sự có status.
<Badge variant="success">Đang hoạt động</Badge>
<Badge variant="destructive">Đã khóa</Badge>

// Ví dụ cảnh báo, chỉ khi có đơn chưa hoàn tất đã được xác nhận.
<Alert variant="warning" role="note">
  <AlertDescription>Khách hàng còn đơn chưa hoàn tất. Kiểm tra đơn trước khi khóa tài khoản.</AlertDescription>
</Alert>

// Ví dụ visual/disabled, không có handler khóa tài khoản trong task này.
// Khi triển khai thật: dùng AlertDialog, nêu khách hàng/hậu quả, có hủy và pending/error.
<Button variant="destructive" disabled>Khóa tài khoản</Button>
```

Danh sách/empty thực tế: xem [CustomerDirectory](../../frontend/src/components/admin/customer-directory.tsx). Search có label, count giữ đúng `0`, empty hướng dẫn tìm lại; bảng chỉ chứa tên, email, phone, goal từ fixture cũ. Bỏ nút more-options không có handler và pill trang trí cho fitness goal, không tạo status/history để lấp UI.

Customer: tái dùng `MealCard`/`DemoMealCard`, giữ ảnh món, tên, giá có nguồn, mục tiêu Cut/Bulk/Maintain, calo `kcal`, protein/carbs/fat `g`. Dùng text dễ đọc cho giá trị, metadata dùng muted foreground; badge chỉ khi trạng thái cần nổi bật. Ví dụ sau chỉ là cách render, `meal` phải đến từ dữ liệu hiện có:

```tsx
<p className="text-sm text-foreground">
  {meal.calories == null ? "Chưa có calo" : `${meal.calories} kcal`}
  {" · "}
  {meal.protein == null ? "Chưa có protein" : `${meal.protein}g protein`}
</p>
```

Code món cũ vẫn có màu brand cho chữ nhỏ và truthy fallback; chưa được chuyển đổi toàn bộ trong đợt này. Không coi snippet là xác nhận đã sửa các component đó.

## Dùng skill và kiểm chứng

- Khi làm UI: đọc [fitkitchen-ui](../../.agents/skills/fitkitchen-ui/SKILL.md), rồi [fitkitchen-ui-review](../../.agents/skills/fitkitchen-ui-review/SKILL.md) trước khi hoàn thành. Nếu môi trường hỗ trợ có thể gọi `$fitkitchen-ui` / `$fitkitchen-ui-review`; nếu chưa nhận, yêu cầu đọc đúng file. Không cần cài bản riêng vào tài khoản, không bảo đảm auto-discovery cho mọi công cụ.
- Tại `frontend`: `bun install --frozen-lockfile` dùng lockfile sẵn có; `bun run dev`, `bun run lint`, `bun run test`, `bun run build`. `build:dev`, `preview`, `test:watch`, `format` cũng có trong package.json. Không có script `typecheck` hoặc `format:check`; dùng TypeScript/Prettier cục bộ: `bunx --no-install tsc --noEmit`, `bunx --no-install prettier --check <file đã sửa>`. Không chạy `format` vì nó ghi toàn repo.
- Kiểm tra token không cần dependency: `node scripts/check-design-tokens.mjs` từ `frontend`. Script đọc CSS, kiểm tra mapping/light/dark và tương phản sRGB các cặp quy định. Nền pha trộn/ảnh, focus thực tế và component vẫn cần browser.
- Kết quả đợt chuẩn hóa, ma trận viewport/state và hạn chế được ghi tại [VERIFICATION.md](VERIFICATION.md). Chạy lại kiểm chứng khi thay token/component; báo thất bại thực tế, phân biệt baseline bằng bằng chứng.

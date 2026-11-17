---
name: fitkitchen-ui-review
description: Review UI FitKitchen hoặc kiểm tra trước khi hoàn thành task UI; kiểm tra design system, mức độ tiết chế và giao diện render desktop/mobile với 35 dấu hiệu AI slop có bằng chứng.
---

# Review UI FitKitchen

## Quy trình và bằng chứng

1. Đọc `AGENTS.md`, `frontend/AGENTS.md` và [design system](../../../docs/design/DESIGN_SYSTEM.md). Xác định người dùng, tác vụ chính, dữ liệu thật/demo, hành động chính/phụ, phạm vi diff và màn hình tương đương. Đường dẫn code tính từ root repo.
2. Kiểm tra code: token trong `frontend/src/styles.css`, primitive trong `frontend/src/components/ui`, domain/shared component và nguồn dữ liệu. Token/primitive đúng chưa đủ: hỏi mỗi component có cần thiết để hoàn thành tác vụ không.
3. Chạy app, xem và chụp desktop/mobile; ghi viewport, theme, đường dẫn và trạng thái. Kiểm tra density, hierarchy, nội dung dài, zoom/reflow, tràn/cắt chữ, bảng/form/dialog/sidebar thực sự liên quan. Dùng bàn phím để xem focus/thứ tự điều hướng. Kiểm tra loading/empty/error/success/disabled nếu luồng có các trạng thái này; fixture thử nghiệm phải được xác định rõ.
4. Kiểm tra từng mục 01–35 dưới đây trên code **và** giao diện render khi có thể. Đo tương phản các cặp đã dùng, cả hover/focus; không suy ra khả năng đọc từ tên token. Khi có animation, kiểm tra reduced-motion. Không có browser thì vẫn review code và ghi rõ phần chưa xác minh.
5. Sửa vấn đề thuộc phạm vi, xem lại kết quả, chạy kiểm tra repo phù hợp. Báo finding và giới hạn theo mẫu cuối file. Không kết luận “sạch, đẹp, chuyên nghiệp” thay cho bằng chứng.

Trong các bảng: **Dấu hiệu** là điều cần tìm, **Hỏi** là câu hỏi phải trả lời, **Sửa** là hướng xử lý, **Ngoại lệ** phải có bằng chứng phù hợp ngữ cảnh. Không cấm card, icon, badge hay motion mặc định.

## A. Design system và primitive

| # / Dấu hiệu                                                            | Hỏi cụ thể                                                               | Sửa khi có vấn đề                                                                                      | Ngoại lệ hợp lý                                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 01 Token drift: màu/font/spacing/radius/shadow/border riêng dù có token | Giá trị này có vai trò nào khác token hiện có? So với màn hình gần nhất? | Đổi sang token/scale; nếu thật sự thiếu, bổ sung semantic light/dark tại nguồn chung và đo tương phản. | Kích thước ảnh, cột biểu đồ hoặc ràng buộc layout theo dữ liệu có lý do rõ.        |
| 02 Primitive reinvention: tự dựng button/input/dialog/tab/select/table  | Repo có primitive đáp ứng keyboard, focus và API này chưa?               | Dùng primitive; mở rộng variant/composition trước khi tạo mới.                                         | Không có primitive đáp ứng interaction thực tế và đã đánh giá lựa chọn hiện có.    |
| 03 Component inconsistency: cùng action/status khác kiểu giữa màn hình  | Hai trường hợp có cùng ý nghĩa, mức rủi ro và thứ bậc không?             | Đồng bộ component/variant và copy.                                                                     | Context khác thực sự, như CTA mua món và action phụ trong bảng, có lý do ghi nhận. |
| 04 Icon inconsistency: nhiều library/weight/size/style                  | Có dùng Lucide và scale 16/20/24 nhất quán trong cùng ngữ cảnh?          | Dùng library hiện có, đồng bộ stroke và kích thước.                                                    | Logo thương hiệu hoặc ký hiệu chuyên ngành cần hình dạng riêng, có nhãn.           |

## B. Container và trang trí

Luôn hỏi: có thể dùng alignment, spacing hoặc typography thay một lớp container không?

| # / Dấu hiệu                                                   | Hỏi cụ thể                                                            | Sửa khi có vấn đề                                                         | Ngoại lệ hợp lý                                                                   |
| -------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 05 Card soup: mọi đoạn nội dung có card                        | Mỗi card có phải một đối tượng hay nhóm tác vụ độc lập?               | Gom thành section/list/table, bỏ khung không cần thiết.                   | Các món ăn độc lập có ảnh, giá và lựa chọn riêng.                                 |
| 06 Nested cards: card lồng chỉ tạo khung                       | Lớp trong có quan hệ hoặc tương tác riêng hay chỉ thêm viền?          | Bỏ lớp trong, dùng gap hoặc divider.                                      | Preview tài liệu/đối tượng độc lập cần ranh giới trong dialog.                    |
| 07 Container inflation: nhiều box/nền/border/divider           | Bỏ một lớp có làm mất quan hệ nội dung không?                         | Giữ ranh giới có ý nghĩa, dùng alignment/spacing cho phần còn lại.        | Nhóm form có ràng buộc khác hoặc vùng scroll cần phân định.                       |
| 08 Decorative chrome: gradient/shadow/đường/label/nền vô nghĩa | Nó truyền đạt thông tin, trạng thái hoặc affordance gì?               | Loại hoặc giảm; giữ semantic surface và typography.                       | Overlay trên ảnh cần để chữ đọc được; shadow biểu đạt lớp nổi.                    |
| 09 Chrome-heavy UI: khung trang trí lấn át dữ liệu/action      | Khi nhìn nhanh, người dùng thấy món/khách/đơn hay các mảng nền trước? | Giảm chiều cao header, khung, padding và decoration để lộ nội dung chính. | Campaign có nội dung thị giác là nhiệm vụ chính; Admin thường không có lý do này. |

## C. Icon, badge và mẫu lặp

| # / Dấu hiệu                                                                              | Hỏi cụ thể                                                         | Sửa khi có vấn đề                                      | Ngoại lệ hợp lý                                                               |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 10 Icon inflation: icon ở mọi heading/card/KPI                                            | Bỏ icon có giảm nhận biết, điều hướng hay scan không?              | Bỏ icon không mang ý nghĩa, ưu tiên nhãn cụ thể.       | Navigation, search, trạng thái hay action quen thuộc có lợi cho scan.         |
| 11 Decorative icon treatment: icon luôn trong vòng/hộp màu                                | Nền bao icon phân biệt trạng thái hay chỉ lấp khoảng trống?        | Bỏ nền bao; để icon cạnh nhãn nếu cần.                 | Avatar/fallback nhận diện hoặc vùng bấm thật cần kích thước.                  |
| 12 Badge/pill inflation: mọi metadata thành pill                                          | Giá trị là trạng thái cần nhận nhanh hay chỉ là email/macros/goal? | Dùng text/dl/cột; giữ badge cho trạng thái đáng chú ý. | Filter/chip được chọn có interaction, hoặc trạng thái tài khoản rõ ràng.      |
| 13 Pattern monotony: section nào cũng icon + title + copy + card                          | Nội dung khác nhau có đang bị ép vào cùng cấu trúc?                | Chọn list, table, form, ảnh theo dữ liệu và tác vụ.    | Các đối tượng đồng cấp cần so sánh, ví dụ danh sách món.                      |
| 14 Template scaffolding: hero → 3 features → metrics → testimonial → CTA, hoặc 4 KPI icon | Mỗi section/KPI có yêu cầu và quyết định cụ thể nào hỗ trợ?        | Xóa section không có nhu cầu; bắt đầu từ tác vụ chính. | Landing có nội dung đã được cung cấp và funnel chứng minh cần các section đó. |

## D. Nội dung và thông tin

| # / Dấu hiệu                                                                       | Hỏi cụ thể                                                                     | Sửa khi có vấn đề                                                              | Ngoại lệ hợp lý                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 15 Information overload: quá nhiều trường cùng lúc                                 | Trường nào cần để tìm khách, chọn món hay xử lý đơn ngay?                      | Giữ trường thiết yếu, chuyển phần hiếm dùng sang chi tiết.                     | Bảng phục vụ đối chiếu nhiều trường mà người dùng thực sự cần.           |
| 16 Missing progressive disclosure: chi tiết nâng cao ngang cấp thông tin chính     | Thông tin nào ít dùng nhưng đang chiếm không gian?                             | Dùng detail/dialog/expand phù hợp, đặt nhãn dễ tìm.                            | Thông tin an toàn, giá hoặc ảnh hưởng đơn hàng phải thấy ngay.           |
| 17 Hidden critical information: disclosure giấu thông tin quyết định               | Có phải mở thêm mới thấy giá, hạn chế món, đơn chưa hoàn tất hay hậu quả khóa? | Đưa thông tin quyết định cạnh action trước khi xác nhận.                       | Thông tin phụ không làm thay đổi quyết định hiện tại.                    |
| 18 Copy bloat: mô tả dài/lặp title/giải thích điều hiển nhiên                      | Bỏ câu này có làm mất thông tin cần hành động không?                           | Rút còn hướng dẫn hoặc điều kiện cụ thể.                                       | Hậu quả khó đảo ngược hoặc lỗi có bước khắc phục cần giải thích.         |
| 19 Generic marketing copy: “seamless”, “unlock your potential”, “trusted platform” | Câu có nói điều kiểm chứng được về món/gói/giao hàng không?                    | Thay bằng dữ kiện được cung cấp hoặc bỏ.                                       | Tagline thương hiệu đã được phê duyệt, không dùng thay thông tin tác vụ. |
| 20 Implementation-facing copy: JWT/API/schema/framework trong luồng                | Người dùng có cần chi tiết kỹ thuật này để chọn cách xử lý?                    | Dùng ngôn ngữ tác vụ: “Không tải được thực đơn”; ghi chi tiết vào log phù hợp. | Công cụ phát triển có người dùng kỹ thuật cần mã lỗi/support ID.         |
| 21 Fake completeness: bịa trường/trạng thái để lấp UI                              | Mỗi field/action có nguồn và hành vi thật hoặc fixture ghi rõ không?           | Bỏ phần bịa; hiển thị thiếu dữ liệu hoặc chưa khả dụng.                        | Fixture minh họa được yêu cầu, có nhãn và tách khỏi dữ liệu thật.        |

## E. Hierarchy và hành động

Xác định một hành động chính của từng vùng nếu vùng đó có hành động; không ép thêm CTA cho danh sách chỉ đọc.

| # / Dấu hiệu                                                        | Hỏi cụ thể                                                         | Sửa khi có vấn đề                                                           | Ngoại lệ hợp lý                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| 22 Flat hierarchy: title/data/nội dung phụ/action ngang nhau        | Có nhận ra tiêu đề, dữ liệu chính và nội dung phụ trong vài giây?  | Chỉnh type scale, weight, gap và vị trí; giảm nhấn nội dung phụ.            | Dữ liệu đồng cấp trong bảng cần độ nổi bật tương đương. |
| 23 CTA competition: nhiều nút đậm trong một vùng                    | Action chính là gì, các action còn lại có thể outline/ghost không? | Giữ một primary theo tác vụ, hạ action phụ.                                 | Lựa chọn đối xứng thật sự cần trọng lượng ngang nhau.   |
| 24 Weak action context: “OK”, “Continue”, icon không nhãn           | Biết thao tác lên đối tượng nào và hậu quả trước khi bấm chưa?     | Dùng động từ cụ thể: “Khóa tài khoản”; nhãn accessible cho icon-only.       | “Đóng” trong dialog thông tin đơn giản đã rõ ngữ cảnh.  |
| 25 Rare actions dominate: export/delete/lock át tìm kiếm và dữ liệu | Tần suất và rủi ro có xứng với độ nổi bật của action?              | Đưa action hiếm vào menu/chi tiết; destructive chỉ nổi bật ở bước xác nhận. | Tác vụ xử lý sự cố khẩn cấp là mục đích chính màn hình. |

## F. Tính xác thực

Chỉ dùng dữ liệu từ ứng dụng, specification, fixture hoặc yêu cầu rõ ràng. Giữ **0 là 0** (không dùng truthy fallback cho số); dữ liệu không có phải hiển thị trạng thái thiếu. Demo phải có nhãn khi có thể bị hiểu là dữ liệu thật.

| # / Dấu hiệu                                                                                            | Hỏi cụ thể                                                            | Sửa khi có vấn đề                                                          | Ngoại lệ hợp lý                                                                        |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 26 Authenticity slop/invented proof: testimonial/rating/logo/lượng user/tỷ lệ/doanh thu/trust claim bịa | Có truy được nguồn từng tuyên bố, thời điểm và phạm vi số liệu không? | Xóa proof không có nguồn; không “làm tròn” thành thành tích.               | Nội dung được cung cấp và xác minh; demo tách biệt, ghi rõ không phải chứng thực thật. |
| 27 Vanity metrics: KPI/chart đẹp nhưng vô dụng                                                          | Chỉ số này thay đổi quyết định nào của người vận hành?                | Bỏ hoặc thay bằng thông tin phục vụ tác vụ có nguồn.                       | Báo cáo phân tích mà chỉ số là yêu cầu thật, có định nghĩa/kỳ đo.                      |
| 28 Misleading placeholders: số/người/trạng thái mẫu như thật                                            | Người xem có phân biệt được fixture, dữ liệu trống và dữ liệu thật?   | Gắn nhãn demo, giữ 0, dùng “chưa có dữ liệu” cho thiếu; không tự suy đoán. | Skeleton trong thời gian đang tải thật, không mang số liệu giả.                        |

## G. Motion và responsive

| # / Dấu hiệu                                                               | Hỏi cụ thể                                                                       | Sửa khi có vấn đề                                                                                   | Ngoại lệ hợp lý                                                                  |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 29 Motion noise: mọi thứ fade/slide/hover/animate                          | Motion giải thích thay đổi trạng thái hoặc quan hệ nào?                          | Bỏ entrance/hover không giúp thao tác; giữ phản hồi ngắn.                                           | Drawer chuyển vị trí hoặc tiến trình đang thực sự diễn ra.                       |
| 30 Blocking motion: animation trì hoãn/cản bấm                             | Người dùng có phải đợi animation để thao tác hoặc đọc?                           | Cho phép thao tác ngay, tránh stagger và khóa input theo animation.                                 | Khóa trong thời gian request thật để chống gửi trùng, có feedback.               |
| 31 Reduced-motion neglect: animation không xét preference                  | Bật prefers-reduced-motion có bỏ chuyển động không thiết yếu?                    | Dùng motion-reduce/motion-safe, giữ text thể hiện trạng thái.                                       | Chỉ báo tiến trình cần thiết nhưng cung cấp phiên bản tĩnh có ý nghĩa.           |
| 32 Desktop stacking: mobile chỉ xếp dọc desktop                            | Trên mobile, thông tin và action cần nhất có xuất hiện trước, còn đủ ngữ cảnh?   | Đổi thứ tự/nhóm thông tin; dùng list có nhãn khi bảng không đọc được.                               | Một form tuần tự đã có thứ tự phù hợp trên cả hai viewport.                      |
| 33 Weak mobile usability: bảng/dialog/form/sidebar/button tràn/cắt/quá nhỏ | Ở 320–390px và zoom 200%, đọc đủ, đóng dialog, dùng bàn phím và chạm được không? | Sửa wrap/min-width, scroll có chủ đích, dialog vừa màn hình, target tối thiểu 24px và ưu tiên 44px. | Bảng so sánh cần cuộn ngang có chỉ dẫn và vẫn truy cập được thông tin thiết yếu. |

## H. Ngữ cảnh sản phẩm

| # / Dấu hiệu                                                                     | Hỏi cụ thể                                                           | Sửa khi có vấn đề                                                                                                    | Ngoại lệ hợp lý                                                                        |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 34 Context-free design: đổi logo/tên là thành sản phẩm khác                      | Dữ liệu, nhãn và workflow phản ánh nhiệm vụ thật nào của FitKitchen? | Bổ sung thông tin tác vụ đã có nguồn, bỏ section chung chung; không thêm branding trang trí để vượt competitor test. | Primitive hoặc form liên hệ bản chất chung, không cần nhồi thuật ngữ thương hiệu.      |
| 35 Domain mismatch: bỏ qua món/calo/macros/mục tiêu/đơn/trạng thái tài khoản/gói | Có dùng đúng thuật ngữ, đơn vị và quan hệ nghiệp vụ hiện có không?   | Dùng vocabulary/dữ liệu repo; giữ kcal, g, giá và trạng thái có nghĩa; không phát minh field/API.                    | Màn hình chỉ đọc contact không cần thêm macros hay trạng thái tài khoản chưa có nguồn. |

## Ghi kết quả

Với mỗi finding, ghi:

```text
[Nghiêm trọng | Cần cải thiện | Gợi ý] — #mục — mô tả ngắn
Vị trí: route/component/file:line hoặc ảnh + viewport/theme/state
Bằng chứng: code/quan sát render cụ thể (không suy đoán)
Tác động: khó đọc/thao tác/sai dữ liệu/không nhất quán như thế nào
Đề xuất: sửa hoặc đơn giản hóa cụ thể
Kiểm chứng lại: đã làm gì, kết quả; hoặc chưa kiểm tra và nguyên nhân
```

- **Nghiêm trọng:** ngăn tác vụ, hiểu sai dữ liệu/hậu quả, mất truy cập thông tin thiết yếu. **Cần cải thiện:** gây khó dùng hoặc lệch hệ thống. **Gợi ý:** tinh chỉnh có lợi nhưng không cản tác vụ.
- Nếu giữ pattern đáng nghi, ghi số mục, vị trí và lý do nghiệp vụ/interaction có bằng chứng.
- Kèm ma trận phạm vi: route × viewport × theme × state, kiểm tra code và render riêng. Dùng “đã kiểm tra”, “không áp dụng — lý do” hoặc “chưa xác minh — nguyên nhân”; không đánh dấu đạt cho điều chưa quan sát.
- Không có finding trong phạm vi quan sát không đồng nghĩa toàn app đạt accessibility hoặc dark mode hoàn chỉnh. Nêu rủi ro ngoài phạm vi thay vì âm thầm mở rộng task.

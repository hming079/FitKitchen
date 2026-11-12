-- 1. Thêm Users
INSERT INTO users (email, password_hash, full_name, phone, fitness_goal, target_calories, role) VALUES
('admin@foodie.vn', 'hashed_pass_admin', 'Quản trị viên', '0900000000', 'MAINTAIN', 2000.00, 'ADMIN'),
('teo.tran@gmail.com', 'hashed_pass_teo', 'Trần Văn Tèo', '0912345678', 'BULK', 2800.00, 'CUSTOMER'),
('ty.le@gmail.com', 'hashed_pass_ty', 'Lê Thị Tý', '0987654321', 'CUT', 1500.00, 'CUSTOMER');

-- 2. Thêm User Addresses
INSERT INTO user_addresses (user_id, recipient_name, phone, address_detail, is_default) VALUES
(2, 'Trần Văn Tèo', '0912345678', '123 Đường Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh, TP. HCM', TRUE),
(3, 'Lê Thị Tý', '0987654321', '456 Lê Lợi, Phường Bến Nghé, Quận 1, TP. HCM', TRUE),
(2, 'Văn phòng Công ty ABC', '0912345678', 'Tòa nhà Landmark 81, Vinhomes Central Park, TP. HCM', FALSE);

-- 3. Thêm Meal Categories
INSERT INTO meal_categories (name, description) VALUES
('Eat Clean', 'Món ăn thanh đạm, ít dầu mỡ, đầy đủ dinh dưỡng'),
('Keto', 'Chế độ ăn cực ít carb, nhiều chất béo tốt và protein'),
('Bulking', 'Khẩu phần lớn, nhiều protein và carbs để tăng cơ bắp');

-- 4. Thêm Meals
INSERT INTO meals (category_id, name, description, image_url, price, calories, protein_g, carbs_g, fat_g, meal_type, is_available) VALUES
(1, 'Ức gà nướng măng tây', 'Ức gà nướng mềm áp chảo ăn kèm măng tây và gạo lứt', 'https://example.com/img/uc-ga-mang-tay.jpg', 65000, 450, 40, 45, 10, 'SINGLE', TRUE),
(3, 'Bò sốt tiêu đen', 'Thăn bò xào tiêu đen đậm đà, kèm khoai tây nghiền', 'https://example.com/img/bo-tieu-den.jpg', 95000, 600, 50, 55, 15, 'SINGLE', TRUE),
(2, 'Cá hồi áp chảo sốt chanh', 'Cá hồi Na Uy áp chảo với sốt chanh bơ', 'https://example.com/img/ca-hoi.jpg', 120000, 500, 35, 10, 30, 'SINGLE', TRUE),
(1, 'Combo 7 ngày Giảm Cân', 'Gói ăn 7 ngày bao gồm 14 bữa (trưa và tối) thiết kế chuẩn y khoa', 'https://example.com/img/combo-7-days.jpg', 850000, 1500, 120, 100, 40, 'COMBO_7_DAYS', TRUE);

-- 5. Thêm Promotions
INSERT INTO promotions (code, discount_type, discount_value, min_order_amount, is_active) VALUES
('WELCOME10', 'PERCENTAGE', 10, 100000, TRUE),
('GIAM50K', 'FIXED', 50000, 200000, TRUE);

-- 6. Thêm Carts
INSERT INTO carts (user_id) VALUES (2), (3);

-- 7. Thêm Cart Items
INSERT INTO cart_items (cart_id, meal_id, quantity, options) VALUES
(1, 1, 2, '{"extra_meat": "thêm 50g ức gà", "note": "không hành"}'),
(1, 2, 1, '{}'),
(2, 3, 1, '{"dressing": "ít sốt bơ"}');

-- 8. Thêm Customer Orders
INSERT INTO customer_orders (user_id, address_id, promotion_id, total_amount, shipping_fee, status, payment_method, payment_status, delivery_date, delivery_time_slot) VALUES
(2, 1, 1, 225000, 15000, 'COMPLETED', 'ONLINE', 'PAID', '2026-11-10', '11:00 - 12:00'),
(3, 2, NULL, 120000, 20000, 'PREPARING', 'COD', 'PENDING', '2026-11-11', '18:00 - 19:00');

-- 9. Thêm Order Items
INSERT INTO order_items (order_id, meal_id, quantity, unit_price, calories_snapshot, protein_snapshot, carbs_snapshot, fat_snapshot, options, expected_delivery_date) VALUES
(1, 1, 2, 65000, 450, 40, 45, 10, '{"extra_meat": "thêm 50g ức gà", "note": "không hành"}', '2026-11-10'),
(1, 2, 1, 95000, 600, 50, 55, 15, '{}', '2026-11-10'),
(2, 3, 1, 120000, 500, 35, 10, 30, '{"dressing": "ít sốt bơ"}', '2026-11-11');

-- 10. Thêm Subscription Plans
INSERT INTO subscription_plans (name, description, duration_days, meals_per_day, price, is_active) VALUES
('Gói Eat Clean 7 ngày', '14 bữa ăn Eat Clean, giao trưa và tối mỗi ngày', 7, 2, 850000, TRUE),
('Gói Bulking 30 ngày', '60 bữa ăn giàu protein dành cho mục tiêu tăng cơ', 30, 2, 3600000, TRUE);

-- 11. Thêm User Subscriptions
INSERT INTO user_subscriptions (user_id, plan_id, address_id, start_date, end_date, status, payment_method, payment_status, auto_renew, total_amount) VALUES
(2, 1, 1, '2026-11-12', '2026-11-18', 'ACTIVE', 'ONLINE', 'PAID', FALSE, 850000),
(3, 2, 2, '2026-11-15', '2026-12-14', 'PENDING', 'COD', 'PENDING', TRUE, 3600000);

-- 12. Thêm Subscription Deliveries
INSERT INTO subscription_deliveries (subscription_id, address_id, delivery_date, delivery_time_slot, status, notes) VALUES
(1, 1, '2026-11-12', '11:00 - 12:00', 'SCHEDULED', 'Giao đủ bữa trưa và tối'),
(1, 1, '2026-11-13', '11:00 - 12:00', 'SCHEDULED', NULL),
(2, 2, '2026-11-15', '18:00 - 19:00', 'SCHEDULED', 'Gọi trước khi giao');

-- 13. Thêm Meal Customization Options
INSERT INTO meal_customization_options (meal_id, name, description, price_adjustment, is_available) VALUES
(1, 'Up-size 50g ức gà', 'Thêm 50g ức gà nướng', 20000, TRUE),
(1, 'Thêm bơ', 'Thêm một phần bơ quả', 10000, TRUE),
(2, 'Up-size 100g thịt bò', 'Thêm 100g thăn bò', 35000, TRUE),
(3, 'Đổi sốt chanh', 'Đổi sang sốt chanh ít béo', 0, TRUE);

-- 14. Thêm Cart Item Customizations
INSERT INTO cart_item_customizations (cart_item_id, option_id, quantity) VALUES
(1, 1, 1),
(2, 3, 1),
(3, 4, 1);

-- 15. Thêm Meal Swap Requests
INSERT INTO meal_swap_requests (subscription_id, delivery_id, original_meal_id, replacement_meal_id, reason, status) VALUES
(1, 1, 2, 3, 'Khách muốn đổi sang cá hồi', 'APPROVED'),
(2, 3, 3, 1, 'Ưu tiên món ít chất béo', 'PENDING');

-- 16. Thêm Products
INSERT INTO products (name, description, category, image_url, price, stock_quantity, unit, is_available) VALUES
('Whey Protein vị vani', 'Bột đạm whey hỗ trợ bổ sung protein sau tập luyện', 'THỰC PHẨM BỔ SUNG', 'https://example.com/img/whey-vanilla.jpg', 790000, 25, 'túi', TRUE),
('Nước ép cần tây', 'Nước ép cần tây nguyên chất không đường', 'ĐỒ UỐNG', 'https://example.com/img/celery-juice.jpg', 45000, 40, 'chai', TRUE),
('Thanh protein hạt điều', 'Thanh protein tiện lợi dùng cho bữa phụ', 'ĐỒ ĂN NHẸ', 'https://example.com/img/protein-bar.jpg', 35000, 100, 'thanh', TRUE);

-- 17. Thêm Subscription Gifts
INSERT INTO subscription_gifts (plan_id, product_id, gift_name, description, quantity, status) VALUES
(1, 3, 'Tặng 2 thanh protein hạt điều', 'Quà tặng khi đăng ký gói Eat Clean 7 ngày', 2, 'PENDING');

INSERT INTO subscription_gifts (subscription_id, product_id, gift_name, description, quantity, status) VALUES
(2, 1, 'Tặng 1 túi Whey Protein vị vani', 'Quà tặng riêng cho khách hàng đăng ký gói Bulking 30 ngày', 1, 'PENDING');
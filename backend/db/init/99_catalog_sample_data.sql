INSERT INTO meal_categories (name, description) VALUES
    ('Chay', 'Món thuần chay, đạm từ đậu và nấm'),
    ('Bữa sáng', 'Bữa sáng nhanh, cân bằng năng lượng đầu ngày')
ON CONFLICT (name) DO NOTHING;

INSERT INTO meals (
    category_id, name, description, image_url, price, calories, protein_g, carbs_g, fat_g,
    meal_type, goal_type, allergen_info, is_available
)
SELECT category.id, sample.name, sample.description, sample.image_url, sample.price,
    sample.calories, sample.protein_g, sample.carbs_g, sample.fat_g,
    'SINGLE', sample.goal_type, sample.allergen_info, sample.is_available
FROM (VALUES
    ('Gỏi cuốn tôm thịt', 'Eat Clean', 'Bánh tráng cuốn tôm luộc, thịt heo, bún và rau thơm, dùng kèm sốt đậu phộng.', 'https://images.pexels.com/photos/12386446/pexels-photo-12386446.jpeg?auto=compress&cs=tinysrgb&w=800', 55000, 320, 22, 42, 7, 'CUT', 'Tôm, đậu phộng', TRUE),
    ('Salad ức gà sốt mè rang', 'Eat Clean', 'Ức gà nướng thái lát trộn rau xà lách và dưa leo cùng sốt mè rang.', 'https://images.pexels.com/photos/38714623/pexels-photo-38714623.jpeg?auto=compress&cs=tinysrgb&w=800', 59000, 380, 35, 20, 17, 'CUT', 'Mè, trứng', TRUE),
    ('Bún gà xé rau thơm', 'Eat Clean', 'Bún gạo trộn gà luộc xé sợi, giá và rau thơm, chan nước mắm chua ngọt.', 'https://images.pexels.com/photos/37097995/pexels-photo-37097995.jpeg?auto=compress&cs=tinysrgb&w=800', 55000, 420, 32, 55, 8, 'CUT', NULL, TRUE),
    ('Cá basa hấp gừng cơm gạo lứt', 'Eat Clean', 'Phi lê cá basa hấp với gừng và hành lá, ăn cùng cơm gạo lứt.', 'https://images.pexels.com/photos/11830203/pexels-photo-11830203.jpeg?auto=compress&cs=tinysrgb&w=800', 62000, 430, 30, 50, 12, 'CUT', 'Cá', TRUE),
    ('Tôm hấp bông cải xanh', 'Keto', 'Tôm sú hấp chín tới, dùng kèm bông cải xanh hấp và dầu ô liu.', 'https://images.pexels.com/photos/14448988/pexels-photo-14448988.jpeg?auto=compress&cs=tinysrgb&w=800', 79000, 340, 34, 12, 17, 'CUT', 'Tôm', TRUE),
    ('Đậu hũ non sốt nấm', 'Chay', 'Đậu hũ non hấp mềm rồi rưới sốt nấm hương và nấm đùi gà.', 'https://images.pexels.com/photos/34097498/pexels-photo-34097498.jpeg?auto=compress&cs=tinysrgb&w=800', 49000, 310, 18, 28, 14, 'CUT', 'Đậu nành', TRUE),
    ('Yến mạch hạt chia sữa chua Hy Lạp', 'Bữa sáng', 'Yến mạch và hạt chia ngâm qua đêm trong sữa chua Hy Lạp, ăn cùng trái cây.', 'https://images.pexels.com/photos/12873520/pexels-photo-12873520.jpeg?auto=compress&cs=tinysrgb&w=800', 45000, 330, 20, 42, 9, 'CUT', 'Sữa, gluten', TRUE),
    ('Ức gà áp chảo khoai lang', 'Eat Clean', 'Ức gà áp chảo với tiêu và thảo mộc, dùng kèm khoai lang nướng.', 'https://images.pexels.com/photos/36212859/pexels-photo-36212859.jpeg?auto=compress&cs=tinysrgb&w=800', 65000, 450, 42, 45, 11, 'CUT', NULL, TRUE),
    ('Bò bít tết khoai tây nướng', 'Bulking', 'Thăn bò áp chảo với bơ và hương thảo, ăn kèm khoai tây nướng.', 'https://images.pexels.com/photos/31387548/pexels-photo-31387548.jpeg?auto=compress&cs=tinysrgb&w=800', 145000, 780, 55, 60, 34, 'BULK', 'Sữa', TRUE),
    ('Cơm gà teriyaki gạo lứt', 'Bulking', 'Gà áp chảo áo sốt teriyaki, dùng với cơm gạo lứt và rau củ hấp.', 'https://images.pexels.com/photos/28442544/pexels-photo-28442544.jpeg?auto=compress&cs=tinysrgb&w=800', 75000, 720, 48, 85, 20, 'BULK', 'Đậu nành, gluten', TRUE),
    ('Poke bowl cá hồi', 'Bulking', 'Cá hồi cắt khối trộn xì dầu và mè, xếp trên cơm cùng bơ và đậu nành non.', 'https://images.pexels.com/photos/4770328/pexels-photo-4770328.jpeg?auto=compress&cs=tinysrgb&w=800', 129000, 690, 40, 70, 27, 'BULK', 'Cá, đậu nành, mè', TRUE),
    ('Phở bò thăn nhiều thịt', 'Bulking', 'Bánh phở chần nóng với phần bò thăn thái mỏng và nước dùng ninh xương bò.', 'https://images.pexels.com/photos/28510252/pexels-photo-28510252.jpeg?auto=compress&cs=tinysrgb&w=800', 79000, 650, 45, 80, 14, 'BULK', NULL, TRUE),
    ('Mì soba bò xào', 'Bulking', 'Mì soba luộc rồi xào lửa lớn với bò thái lát, ớt chuông và xì dầu.', 'https://images.pexels.com/photos/40756021/pexels-photo-40756021.jpeg?auto=compress&cs=tinysrgb&w=800', 85000, 700, 42, 82, 22, 'BULK', 'Gluten, đậu nành', FALSE),
    ('Burrito gà đậu đen', 'Bulking', 'Bánh tortilla áp chảo cuộn gà nướng, đậu đen, cơm và phô mai.', 'https://images.pexels.com/photos/37324429/pexels-photo-37324429.jpeg?auto=compress&cs=tinysrgb&w=800', 79000, 760, 46, 88, 24, 'BULK', 'Gluten, sữa', TRUE),
    ('Bánh mì trứng ốp la bơ đậu phộng', 'Bữa sáng', 'Bánh mì nướng giòn phết bơ đậu phộng và đặt trứng ốp la lên trên.', 'https://images.pexels.com/photos/16991283/pexels-photo-16991283.jpeg?auto=compress&cs=tinysrgb&w=800', 49000, 620, 28, 62, 28, 'BULK', 'Trứng, gluten, đậu phộng', TRUE),
    ('Cơm tấm sườn nướng gạo lứt', 'Bulking', 'Sườn heo ướp sả nướng, dùng kèm cơm tấm gạo lứt, trứng ốp la và đồ chua.', 'https://images.pexels.com/photos/8791778/pexels-photo-8791778.jpeg?auto=compress&cs=tinysrgb&w=800', 69000, 820, 45, 90, 30, 'BULK', 'Trứng', TRUE),
    ('Cá thu nướng sốt cà chua', 'Eat Clean', 'Cá thu nướng vàng rưới sốt cà chua nấu chậm, ăn cùng cơm.', 'https://images.pexels.com/photos/37417629/pexels-photo-37417629.jpeg?auto=compress&cs=tinysrgb&w=800', 72000, 540, 36, 52, 20, 'MAINTAIN', 'Cá', TRUE),
    ('Gà nướng sả cơm gạo lứt', 'Eat Clean', 'Gà ướp sả băm nướng vàng, dùng với cơm gạo lứt và dưa leo.', 'https://images.pexels.com/photos/14226662/pexels-photo-14226662.jpeg?auto=compress&cs=tinysrgb&w=800', 65000, 560, 40, 58, 18, 'MAINTAIN', NULL, TRUE),
    ('Salad bơ trứng cá hồi xông khói', 'Keto', 'Xà lách và bơ trộn cùng trứng luộc, cá hồi xông khói và nước cốt chanh.', 'https://images.pexels.com/photos/16106188/pexels-photo-16106188.jpeg?auto=compress&cs=tinysrgb&w=800', 99000, 520, 28, 12, 40, 'MAINTAIN', 'Cá, trứng', TRUE),
    ('Bò áp chảo bơ tỏi rau củ', 'Keto', 'Thăn bò áp chảo rưới bơ tỏi, dùng kèm cà chua bi và hương thảo.', 'https://images.pexels.com/photos/36617211/pexels-photo-36617211.jpeg?auto=compress&cs=tinysrgb&w=800', 89000, 560, 32, 10, 44, 'MAINTAIN', 'Sữa', FALSE),
    ('Cơm chay đậu hũ sả ớt', 'Chay', 'Đậu hũ chiên vàng xóc với sả ớt băm, dùng kèm cơm và rau luộc.', 'https://images.pexels.com/photos/35064908/pexels-photo-35064908.jpeg?auto=compress&cs=tinysrgb&w=800', 52000, 520, 22, 68, 18, 'MAINTAIN', 'Đậu nành', TRUE),
    ('Bún chay nấm rau củ', 'Chay', 'Bún gạo dùng với nước dùng ninh từ nấm, cải thìa, cà rốt và đậu hũ.', 'https://images.pexels.com/photos/3026808/pexels-photo-3026808.jpeg?auto=compress&cs=tinysrgb&w=800', 49000, 450, 15, 72, 11, 'MAINTAIN', 'Đậu nành', TRUE),
    ('Smoothie bowl chuối việt quất', 'Bữa sáng', 'Chuối và việt quất đông lạnh xay với sữa chua, rắc hạt rang lên trên.', 'https://images.pexels.com/photos/27848286/pexels-photo-27848286.jpeg?auto=compress&cs=tinysrgb&w=800', 55000, 400, 14, 68, 9, 'MAINTAIN', 'Sữa, hạt', TRUE),
    ('Trứng cuộn rau củ bánh mì đen', 'Bữa sáng', 'Trứng trộn sữa rồi áp chảo cuộn cà rốt và cải bó xôi, ăn cùng bánh mì đen nướng.', 'https://images.pexels.com/photos/6294370/pexels-photo-6294370.jpeg?auto=compress&cs=tinysrgb&w=800', 45000, 420, 24, 40, 18, 'MAINTAIN', 'Trứng, gluten, sữa', TRUE)
) AS sample (name, category_name, description, image_url, price, calories, protein_g, carbs_g, fat_g,
    goal_type, allergen_info, is_available)
JOIN meal_categories AS category ON category.name = sample.category_name
WHERE NOT EXISTS (SELECT 1 FROM meals WHERE meals.name = sample.name);

INSERT INTO meal_customization_options (
    meal_id, name, price_adjustment, calories_adjustment, protein_g_adjustment, carbs_g_adjustment, fat_g_adjustment
)
SELECT meals.id, sample.name, sample.price, sample.calories, sample.protein_g, sample.carbs_g, sample.fat_g
FROM (VALUES
    ('Salad ức gà sốt mè rang', 'Up-size 50g ức gà', 20000, 80, 16, 0, 2),
    ('Ức gà áp chảo khoai lang', 'Up-size 50g ức gà', 20000, 80, 16, 0, 2),
    ('Bún gà xé rau thơm', 'Thêm trứng luộc', 8000, 70, 6, 0, 5),
    ('Gà nướng sả cơm gạo lứt', 'Thêm trứng luộc', 8000, 70, 6, 0, 5),
    ('Poke bowl cá hồi', 'Up-size 100g cá hồi', 45000, 206, 20, 0, 14),
    ('Cơm gà teriyaki gạo lứt', 'Thêm 100g cơm gạo lứt', 10000, 111, 2.5, 23, 1),
    ('Cá thu nướng sốt cà chua', 'Thêm 100g cơm gạo lứt', 10000, 111, 2.5, 23, 1),
    ('Phở bò thăn nhiều thịt', 'Thêm 100g thịt bò', 35000, 200, 29, 0, 9),
    ('Bò bít tết khoai tây nướng', 'Đổi sang khoai lang', 0, -40, 0, 2, -5)
) AS sample (meal_name, name, price, calories, protein_g, carbs_g, fat_g)
JOIN meals ON meals.name = sample.meal_name
ON CONFLICT (meal_id, name) DO NOTHING;

INSERT INTO products (name, description, category, image_url, price, stock_quantity, unit)
SELECT sample.name, sample.description, sample.category, sample.image_url,
    sample.price, sample.stock_quantity, sample.unit
FROM (VALUES
    ('Sữa hạt óc chó không đường', 'Sữa từ hạt óc chó xay, không thêm đường.', 'ĐỒ UỐNG', 'https://images.pexels.com/photos/6803745/pexels-photo-6803745.jpeg?auto=compress&cs=tinysrgb&w=800', 35000, 60, 'chai'),
    ('Kombucha trà xanh', 'Trà xanh lên men có vị chua nhẹ và ga tự nhiên.', 'ĐỒ UỐNG', 'https://images.pexels.com/photos/6605199/pexels-photo-6605199.jpeg?auto=compress&cs=tinysrgb&w=800', 39000, 45, 'chai'),
    ('Hạt dinh dưỡng mix 150g', 'Hỗn hợp hạt điều, hạnh nhân và óc chó rang.', 'ĐỒ ĂN NHẸ', 'https://images.pexels.com/photos/18301125/pexels-photo-18301125.jpeg?auto=compress&cs=tinysrgb&w=800', 89000, 80, 'túi'),
    ('Granola yến mạch mật ong 400g', 'Yến mạch và các loại hạt nướng giòn với mật ong.', 'ĐỒ ĂN NHẸ', 'https://images.pexels.com/photos/31024449/pexels-photo-31024449.jpeg?auto=compress&cs=tinysrgb&w=800', 119000, 30, 'hộp'),
    ('Bánh gạo lứt ăn kiêng', 'Bánh gạo lứt sấy giòn dùng cho bữa phụ.', 'ĐỒ ĂN NHẸ', 'https://images.pexels.com/photos/13392726/pexels-photo-13392726.jpeg?auto=compress&cs=tinysrgb&w=800', 45000, 0, 'gói'),
    ('Creatine monohydrate 300g', 'Bột creatine monohydrate dùng để pha với nước.', 'THỰC PHẨM BỔ SUNG', 'https://images.unsplash.com/photo-1693996046514-0406d0773a7d?auto=format&fit=crop&w=800&q=80', 450000, 15, 'hộp')
) AS sample (name, description, category, image_url, price, stock_quantity, unit)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE products.name = sample.name);

UPDATE meals
SET image_url = sample.image_url
FROM (VALUES
    ('Ức gà nướng măng tây', 'https://images.pexels.com/photos/2418486/pexels-photo-2418486.jpeg?auto=compress&cs=tinysrgb&w=800'),
    ('Bò sốt tiêu đen', 'https://images.pexels.com/photos/769289/pexels-photo-769289.jpeg?auto=compress&cs=tinysrgb&w=800'),
    ('Cá hồi áp chảo sốt chanh', 'https://images.pexels.com/photos/2374946/pexels-photo-2374946.jpeg?auto=compress&cs=tinysrgb&w=800'),
    ('Combo 7 ngày Giảm Cân', 'https://images.pexels.com/photos/12050951/pexels-photo-12050951.jpeg?auto=compress&cs=tinysrgb&w=800')
) AS sample (name, image_url)
WHERE meals.name = sample.name AND meals.image_url LIKE 'https://example.com/%';

UPDATE products
SET image_url = sample.image_url
FROM (VALUES
    ('Whey Protein vị vani', 'https://images.unsplash.com/photo-1704650311298-4d6915d34c64?auto=format&fit=crop&w=800&q=80'),
    ('Nước ép cần tây', 'https://images.pexels.com/photos/16963894/pexels-photo-16963894.jpeg?auto=compress&cs=tinysrgb&w=800'),
    ('Thanh protein hạt điều', 'https://images.pexels.com/photos/17763560/pexels-photo-17763560.jpeg?auto=compress&cs=tinysrgb&w=800')
) AS sample (name, image_url)
WHERE products.name = sample.name AND products.image_url LIKE 'https://example.com/%';

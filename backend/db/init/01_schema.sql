-- Schema cho hệ thống E-commerce giao đồ ăn (Rút gọn & Nâng cấp cho gói thuê bao)
-- Dialect: PostgreSQL

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    fitness_goal VARCHAR(50), -- BULK, CUT, MAINTAIN
    target_calories NUMERIC(8,2),
    role VARCHAR(50) DEFAULT 'CUSTOMER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_addresses (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    recipient_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address_detail TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE
);

CREATE TABLE meal_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE meals (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT REFERENCES meal_categories(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    image_url TEXT,
    price NUMERIC(12,2) NOT NULL,
    calories NUMERIC(8,2) NOT NULL,
    protein_g NUMERIC(8,2) NOT NULL,
    carbs_g NUMERIC(8,2) NOT NULL,
    fat_g NUMERIC(8,2) NOT NULL,
    meal_type VARCHAR(50) DEFAULT 'SINGLE', -- SINGLE, COMBO_7_DAYS, TOPPING
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE promotions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL, -- PERCENTAGE, FIXED
    discount_value NUMERIC(12,2) NOT NULL,
    min_order_amount NUMERIC(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE carts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cart_items (
    id BIGSERIAL PRIMARY KEY,
    cart_id BIGINT REFERENCES carts(id) ON DELETE CASCADE,
    meal_id BIGINT REFERENCES meals(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    options JSONB, -- Lưu tùy chỉnh upsize/topping (VD: {"extra_meat": "50g bò"})
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer_orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    address_id BIGINT REFERENCES user_addresses(id) ON DELETE SET NULL,
    promotion_id BIGINT REFERENCES promotions(id) ON DELETE SET NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    shipping_fee NUMERIC(12,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PREPARING, DELIVERING, COMPLETED, CANCELLED
    payment_method VARCHAR(50) NOT NULL, -- ONLINE, COD
    payment_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PAID, FAILED
    delivery_date DATE NOT NULL,
    delivery_time_slot VARCHAR(50), -- Khung giờ giao cố định (VD: '11:00 - 12:00')
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES customer_orders(id) ON DELETE CASCADE,
    meal_id BIGINT REFERENCES meals(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL,
    calories_snapshot NUMERIC(8,2) NOT NULL,
    protein_snapshot NUMERIC(8,2) NOT NULL,
    carbs_snapshot NUMERIC(8,2) NOT NULL,
    fat_snapshot NUMERIC(8,2) NOT NULL,
    options JSONB, -- Snapshot tùy chỉnh upsize/topping lúc đặt hàng
    expected_delivery_date DATE -- Ngày dự kiến giao món này (phục vụ gói ăn nhiều ngày)
);

-- Danh mục gói thuê bao
CREATE TABLE subscription_plans (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    meals_per_day INTEGER NOT NULL CHECK (meals_per_day > 0),
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gói khách hàng đăng ký
CREATE TABLE user_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id BIGINT NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    address_id BIGINT REFERENCES user_addresses(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'PENDING',
    auto_renew BOOLEAN DEFAULT FALSE,
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date)
);

-- Lịch giao hàng của gói thuê bao
CREATE TABLE subscription_deliveries (
    id BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    address_id BIGINT REFERENCES user_addresses(id) ON DELETE SET NULL,
    delivery_date DATE NOT NULL,
    delivery_time_slot VARCHAR(50),
    status VARCHAR(50) DEFAULT 'SCHEDULED',
    notes TEXT,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (subscription_id, delivery_date)
);

-- Tùy chọn up-size/topping cho món ăn
CREATE TABLE meal_customization_options (
    id BIGSERIAL PRIMARY KEY,
    meal_id BIGINT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price_adjustment NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (meal_id, name)
);

-- Tùy chỉnh đã chọn trong giỏ hàng
CREATE TABLE cart_item_customizations (
    id BIGSERIAL PRIMARY KEY,
    cart_item_id BIGINT NOT NULL REFERENCES cart_items(id) ON DELETE CASCADE,
    option_id BIGINT NOT NULL REFERENCES meal_customization_options(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cart_item_id, option_id)
);

-- Yêu cầu đổi món trong gói thuê bao
CREATE TABLE meal_swap_requests (
    id BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    delivery_id BIGINT NOT NULL REFERENCES subscription_deliveries(id) ON DELETE CASCADE,
    original_meal_id BIGINT NOT NULL REFERENCES meals(id) ON DELETE RESTRICT,
    replacement_meal_id BIGINT NOT NULL REFERENCES meals(id) ON DELETE RESTRICT,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'PENDING',
    reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (original_meal_id <> replacement_meal_id)
);

-- Thực phẩm bổ sung và đồ uống
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    image_url TEXT,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    unit VARCHAR(50),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quà tặng của gói thuê bao
CREATE TABLE subscription_gifts (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT REFERENCES subscription_plans(id) ON DELETE CASCADE,
    subscription_id BIGINT REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
    gift_name VARCHAR(200) NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    status VARCHAR(50) DEFAULT 'PENDING',
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (plan_id IS NOT NULL OR subscription_id IS NOT NULL)
);

CREATE INDEX idx_user_subscriptions_user_id
    ON user_subscriptions(user_id);

CREATE INDEX idx_subscription_deliveries_subscription_date
    ON subscription_deliveries(subscription_id, delivery_date);

CREATE INDEX idx_meal_customization_options_meal_id
    ON meal_customization_options(meal_id);

CREATE INDEX idx_meal_swap_requests_delivery_id
    ON meal_swap_requests(delivery_id);

CREATE INDEX idx_products_category
    ON products(category);

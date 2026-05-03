-- Seed script — run AFTER creating your first user in Supabase Auth.
-- Replace 'YOUR-USER-UUID' with your actual auth.users id.

do $$
declare
  uid uuid := 'YOUR-USER-UUID';
begin

-- Profile
insert into public.profiles (id, full_name, store_name)
values (uid, 'Demo Sotuvchi', 'Daromadchi Store')
on conflict (id) do nothing;

-- Products
insert into public.products (user_id, name, sku, category, price, cost, stock) values
  (uid, 'Nike Air Max 270',       'NK-AM270-42', 'Krossovkalar', 890000,   520000,  45),
  (uid, 'Adidas Ultraboost 22',   'AD-UB22-41',  'Krossovkalar', 1120000,  680000,  23),
  (uid, 'Samsung Galaxy A54',     'SM-A54-128',  'Elektronika',  3200000, 2450000,  12),
  (uid, 'Apple AirPods Pro',      'AP-AIP-2',    'Elektronika',  2800000, 2100000,  30),
  (uid, 'Xiaomi Redmi Watch 3',   'XM-RW3-BLK',  'Soatlar',       680000,  390000,  88),
  (uid, 'Levi''s 501 Original',   'LV-501-32',   'Kiyim',         540000,  280000,  64),
  (uid, 'Sony WH-1000XM5',        'SN-WH5-BLK',  'Elektronika',  3600000, 2800000,   9),
  (uid, 'Puma RS-X Toys',         'PM-RSX-43',   'Krossovkalar',  760000,  430000,  41)
on conflict (user_id, sku) do nothing;

-- Orders (last 7 days)
insert into public.orders (user_id, order_ref, customer, product_name, amount, status, ordered_at)
select uid, ref, customer, product, amount, status::public.order_status, day from (values
  ('UZM-001842', 'Bobur Toshmatov',   'Nike Air Max 270',     890000,   'delivered', current_date),
  ('UZM-001841', 'Malika Yusupova',   'Samsung Galaxy A54',  3200000,  'processing', current_date),
  ('UZM-001840', 'Jasur Nazarov',     'Apple AirPods Pro',   2800000,  'shipped',    current_date - 1),
  ('UZM-001839', 'Dilnoza Karimova',  'Levi''s 501 Original', 540000,  'delivered',  current_date - 1),
  ('UZM-001838', 'Sherzod Alimov',    'Xiaomi Redmi Watch 3', 680000,  'delivered',  current_date - 2),
  ('UZM-001837', 'Nargiza Xolmatova', 'Sony WH-1000XM5',     3600000,  'cancelled',  current_date - 2),
  ('UZM-001836', 'Ulugbek Rahimov',   'Adidas Ultraboost 22',1120000,  'delivered',  current_date - 3),
  ('UZM-001835', 'Feruza Saidova',    'Puma RS-X Toys',       760000,  'processing', current_date - 3),
  ('UZM-001834', 'Otabek Mirzayev',   'Nike Air Max 270',     890000,  'shipped',    current_date - 4),
  ('UZM-001833', 'Gulnora Hamidova',  'Samsung Galaxy A54',  3200000,  'delivered',  current_date - 4),
  ('UZM-001832', 'Sardor Tursunov',   'Xiaomi Redmi Watch 3', 680000,  'delivered',  current_date - 5),
  ('UZM-001831', 'Zulfiya Ergasheva', 'Apple AirPods Pro',   2800000,  'delivered',  current_date - 5),
  ('UZM-001830', 'Mansur Qodirov',    'Nike Air Max 270',     890000,  'delivered',  current_date - 6),
  ('UZM-001829', 'Hulkar Nazarova',   'Levi''s 501 Original', 540000,  'shipped',    current_date - 6)
) as t(ref, customer, product, amount, status, day)
on conflict (user_id, order_ref) do nothing;

end $$;

-- Yandex Market category renames effective 2026-10-01
-- Updates existing aliases and inserts new ones for the renamed categories

-- Update existing aliases to new names
UPDATE category_aliases SET original_name = 'Чехлы и накладки для телефонов' WHERE marketplace = 'yandex_market' AND original_name = 'Чехлы для телефонов';
UPDATE category_aliases SET original_name = 'Наушники' WHERE marketplace = 'yandex_market' AND original_name = 'Наушники и гарнитуры';
UPDATE category_aliases SET original_name = 'Ноутбуки персональные' WHERE marketplace = 'yandex_market' AND original_name = 'Ноутбуки';
UPDATE category_aliases SET original_name = 'Планшетные компьютеры' WHERE marketplace = 'yandex_market' AND original_name = 'Планшеты';
UPDATE category_aliases SET original_name = 'Книги электронные' WHERE marketplace = 'yandex_market' AND original_name = 'Электронные книги';
UPDATE category_aliases SET original_name = 'Клавиатуры компьютерные' WHERE marketplace = 'yandex_market' AND original_name = 'Клавиатуры';
UPDATE category_aliases SET original_name = 'Беспроводные колонки' WHERE marketplace = 'yandex_market' AND original_name = 'Портативная акустика';
UPDATE category_aliases SET original_name = 'Акустические системы для дома' WHERE marketplace = 'yandex_market' AND original_name = 'Акустические системы';
UPDATE category_aliases SET original_name = 'Приставки игровые' WHERE marketplace = 'yandex_market' AND original_name = 'Игровые приставки';
UPDATE category_aliases SET original_name = 'Геймпад' WHERE marketplace = 'yandex_market' AND original_name = 'Геймпады';
UPDATE category_aliases SET original_name = 'Сковороды для готовки' WHERE marketplace = 'yandex_market' AND original_name = 'Сковороды';
UPDATE category_aliases SET original_name = 'Одеяла для сна' WHERE marketplace = 'yandex_market' AND original_name = 'Одеяла';
UPDATE category_aliases SET original_name = 'Картины интерьерные' WHERE marketplace = 'yandex_market' AND original_name = 'Картины';
UPDATE category_aliases SET original_name = 'Ковры напольные' WHERE marketplace = 'yandex_market' AND original_name = 'Ковры';
UPDATE category_aliases SET original_name = 'Щетки зубные' WHERE marketplace = 'yandex_market' AND original_name = 'Зубные щетки';
UPDATE category_aliases SET original_name = 'Сумки повседневные' WHERE marketplace = 'yandex_market' AND original_name = 'Сумки';
UPDATE category_aliases SET original_name = 'Чемоданы и аксессуары для чемоданов' WHERE marketplace = 'yandex_market' AND original_name = 'Чемоданы';
UPDATE category_aliases SET original_name = 'Конструкторы детские' WHERE marketplace = 'yandex_market' AND original_name = 'Конструкторы';
UPDATE category_aliases SET original_name = 'Тетради школьные' WHERE marketplace = 'yandex_market' AND original_name = 'Тетради';

-- Yandex Market category renames effective 2026-10-01
-- Idempotent: if the new name already exists (synced independently), delete the
-- stale old-name row; otherwise rename it. Re-running is always a no-op.
DO $$
DECLARE
  pair RECORD;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('Чехлы для телефонов',          'Чехлы и накладки для телефонов'),
      ('Наушники и гарнитуры',         'Наушники'),
      ('Ноутбуки',                     'Ноутбуки персональные'),
      ('Планшеты',                     'Планшетные компьютеры'),
      ('Электронные книги',            'Книги электронные'),
      ('Клавиатуры',                   'Клавиатуры компьютерные'),
      ('Портативная акустика',         'Беспроводные колонки'),
      ('Акустические системы',         'Акустические системы для дома'),
      ('Игровые приставки',            'Приставки игровые'),
      ('Геймпады',                     'Геймпад'),
      ('Сковороды',                    'Сковороды для готовки'),
      ('Одеяла',                       'Одеяла для сна'),
      ('Картины',                      'Картины интерьерные'),
      ('Ковры',                        'Ковры напольные'),
      ('Зубные щетки',                 'Щетки зубные'),
      ('Сумки',                        'Сумки повседневные'),
      ('Чемоданы',                     'Чемоданы и аксессуары для чемоданов'),
      ('Конструкторы',                 'Конструкторы детские'),
      ('Тетради',                      'Тетради школьные')
    ) AS t(old_name, new_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM category_aliases
      WHERE marketplace = 'yandex_market' AND original_name = pair.new_name
    ) THEN
      DELETE FROM category_aliases
      WHERE marketplace = 'yandex_market' AND original_name = pair.old_name;
    ELSE
      UPDATE category_aliases
      SET original_name = pair.new_name
      WHERE marketplace = 'yandex_market' AND original_name = pair.old_name;
    END IF;
  END LOOP;
END $$;

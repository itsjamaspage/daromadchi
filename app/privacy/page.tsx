'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLang, useTheme } from '@/app/providers'
import BorderGlow from '@/app/components/BorderGlow'
// The retention periods are the ones lib/billing/lifecycle.ts enforces,
// interpolated so the policy can never promise a window the sweep does not keep.
import {
  INACTIVE_WARN_DAYS, FREEZE_AFTER_WARN_DAYS, DELETE_AFTER_FREEZE_DAYS,
} from '@/lib/billing/lifecycle-constants'


const T = {
  uz: {
    title: `Maxfiylik siyosati`,
    subtitle: `Daromadchi platformasidan foydalanish orqali siz ushbu siyosatga rozilik bildirasiz.`,
    updated: `1.0-versiya · 2026-yil 11-avgust`,
    sections: [
      {
        heading: `1. Umumiy qoidalar`,
        short: `Umumiy`,
        body: `1.1. Ushbu Maxfiylik siyosati Daromadchi platformasi (https://daromadchi.uz) foydalanuvchilarining shaxsiy ma'lumotlarini yig'ish, qayta ishlash, saqlash, uzatish va himoya qilish tartibini belgilaydi.\n1.2. Shaxsiy ma'lumotlar operatori: Yakka tartibdagi tadbirkor (YATT) Xakimjonov Jamshid Jahongir o'g'li, STIR/JSHSHIR: 51608028660035, O'zbekiston Respublikasi (bundan buyon — «Operator»). «Daromadchi» — xizmat nomi.\n1.3. Ushbu siyosat «Shaxsiy ma'lumotlar to'g'risida»gi O'zbekiston Respublikasi Qonuni (2019-yil 2-iyul, ZRU-547-son) asosida, 1125-son Qonun bilan kiritilgan o'zgartishlar (2026-yil 27-martdan kuchga kirgan) hisobga olingan holda ishlab chiqilgan.\n1.4. Shaxsiy ma'lumotlarni qayta ishlash ustidan nazoratni O'zbekiston Respublikasi Adliya vazirligi huzuridagi Shaxsiylashtirish agentligi (Shaxsiy ma'lumotlar bazalarining Davlat reestrini yuritadi) va «Uzkomnazorat» davlat inspeksiyasi amalga oshiradi.\n1.5. Platformadan foydalanish orqali Foydalanuvchi ushbu Siyosat bilan tanishganini tasdiqlaydi va o'z shaxsiy ma'lumotlarini bayon etilgan hajmda qayta ishlashga, jumladan transchegaraviy uzatishga (6-bo'limga qarang) rozilik bildiradi.`,
      },
      {
        heading: `2. Yig'iladigan shaxsiy ma'lumotlar`,
        short: `Ma'lumotlar`,
        body: `2.1. Hisob ma'lumotlari (ro'yxatdan o'tishda): elektron pochta manzili (majburiy) — tizimga kirish va bildirishnomalar uchun ishlatiladi; foydalanuvchi nomi / ism (ixtiyoriy) — email'dan tashqari saqlanadigan yagona shaxs identifikatori; parol — faqat qaytarilmas kriptografik xesh (bcrypt) ko'rinishida saqlanadi, Operator ochiq matndagi parolga ega bo'lmaydi. Ro'yxatdan o'tish Google (OAuth) orqali ham mumkin — bu holda Operator Google'dan faqat elektron pochta manzili va ismni oladi; Google tokenlari saqlanmaydi.\n2.2. Telegram ma'lumotlari (ixtiyoriy): Foydalanuvchi Telegram-bildirishnomalarini ulasa, Telegram ID (raqamli identifikator) va Telegram username saqlanadi. Bu ma'lumotlar faqat Foydalanuvchi bildirishnoma botini ixtiyoriy ravishda ulaganda yig'iladi.\n2.3. Operator YIG'MAYDI: telefon raqami, foydalanuvchining IP-manzili (ma'lumotlar bazasida saqlanmaydi), qurilma yoki brauzer haqidagi ma'lumotlar (device fingerprint). IP-manzil faqat avtomatlashtirilgan hujumlardan himoyalanish (so'rovlar chastotasini cheklash) uchun operativ xotirada qisqa muddat ishlatilishi mumkin va saqlanmaydi.\n2.4. To'lov ma'lumotlari: bank kartalari rekvizitlari Operator tomonidan yig'ilmaydi va saqlanmaydi. To'lovlar Atmos to'lov agregatori (AO «National Innovative Payment Technologies») orqali qabul qilinadi; u Payme, Click, Uzcard, Humo, Visa to'lov usullarini taqdim etadi. To'lov ma'lumotlari (karta raqami, CVV) Foydalanuvchi tomonidan bevosita provayder tomonida kiritiladi va Operator infratuzilmasidan o'tmaydi. Operator faqat to'lov yozuvini saqlaydi: summa, sana, tranzaksiya identifikatori, tarif, holat va to'lovchining elektron pochta manzili (buxgalteriya va soliq hisobi maqsadlarida).`,
      },
      {
        heading: `3. Marketpleys ma'lumotlari`,
        short: `Marketpleys`,
        body: `3.1. Analitikani taqdim etish uchun Foydalanuvchi o'z marketpleys kabinetlarining (Uzum Market, Yandex Market) API-kalitlarini beradi. API-kalitlar shifrlangan holda (AES-256-CBC) saqlanadi.\n3.2. Operator marketpleys xaridorlarining shaxsiy ma'lumotlarini YIG'MAYDI va saqlamaydi — faqat sotuvchining (Foydalanuvchining) o'z ma'lumotlari qayta ishlanadi: uning mahsulotlari, qoldiqlari, buyurtmalari, do'konning moliyaviy va savdo statistikasi. Xaridorlarning ismlari, telefonlari, manzillari va boshqa shaxsiy ma'lumotlari so'ralmaydi va saqlanmaydi.\n3.3. Foydalanuvchi o'z marketpleys kabinetlarining API-kalitlarini Operatorga taqdim etishning qonuniyligi uchun mustaqil javobgar bo'ladi.`,
      },
      {
        heading: `4. Qayta ishlash maqsadlari`,
        short: `Maqsadlar`,
        body: `Operator shaxsiy ma'lumotlarni quyidagi maqsadlarda qayta ishlaydi:\n• hisob yaratish va avtorizatsiya;\n• tanlangan tarifga muvofiq analitika funksionalini taqdim etish;\n• bildirishnomalar yuborish (buyurtmalar, qoldiqlar, xavfsizlik bo'yicha), jumladan Foydalanuvchi xohishiga ko'ra Telegram orqali;\n• to'lovlarni qayta ishlash va buxgalteriya/soliq hisobini yuritish;\n• xizmat xavfsizligini ta'minlash va ruxsatsiz kirishdan himoya qilish;\n• texnik yordam va murojaatlarni ko'rib chiqish;\n• shaxssizlantirilgan ma'lumotlar asosida xizmatni yaxshilash.`,
      },
      {
        heading: `5. Huquqiy asoslar`,
        short: `Asoslar`,
        body: `• Shartnomani bajarish — xizmatni taqdim etish uchun zarur qayta ishlash uchun;\n• Foydalanuvchining roziligi — ixtiyoriy funksiyalar uchun (Telegram-bildirishnomalar, analitik cookie'lar);\n• Qonunchilik talablarini bajarish — buxgalteriya va soliq hujjatlarini saqlash uchun;\n• Operatorning qonuniy manfaati — xavfsizlikni ta'minlash va firibgarlikka qarshi kurashish uchun.`,
      },
      {
        heading: `6. Transchegaraviy uzatish va ma'lumotlar saqlanadigan joy`,
        short: `Saqlash joyi`,
        body: `6.1. Ma'lumotlar O'zbekiston Respublikasidan tashqarida joylashgan serverlarda saqlanadi — infratuzilma Finlyandiyada (Xelsinki shahri), Hetzner Online GmbH provayderining serverlarida joylashgan.\n6.2. Platformadan foydalanish orqali Foydalanuvchi o'z shaxsiy ma'lumotlarining bunday transchegaraviy qayta ishlanishiga rozilik bildiradi. ZRU-547-son Qonunning 27¹-moddasiga muvofiq, nozik bo'lmagan shaxsiy ma'lumotlar (Operator biometrik, genetik ma'lumotlarni va aloqa abonentlari ma'lumotlarini qayta ishlamaydi) qonun shartlariga rioya qilingan holda O'zbekiston Respublikasidan tashqarida saqlanishi mumkin. Operator vakolatli organ tomonidan himoya darajasining rasmiy «adekvatligi» tan olinganini da'vo qilmaydi.`,
      },
      {
        heading: `7. Uchinchi tomonlar — ma'lumotlarni qayta ishlovchilar`,
        short: `Uchinchi tomonlar`,
        body: `• Hetzner Online GmbH (Finlyandiya, Xelsinki) — ilova va ma'lumotlar bazasi xostingi.\n• Google LLC — Google orqali kirish (OAuth: email va ism) va shaxssizlantirilgan veb-analitika Google Analytics 4 (faqat Foydalanuvchi roziligi bilan; shaxsiy ma'lumotlar uzatilmaydi).\n• Telegram Messenger — bot orqali bildirishnomalarni yetkazish (Foydalanuvchi ulaganda): Telegram ID va bildirishnoma matni (mahsulot nomlari, artikullar, summalar).\n• Uzum Market, Yandex Market — sinxronizatsiya paytida Foydalanuvchining API-kaliti va uning o'z kabinetiga API so'rovlari uzatiladi.\n• Elektron pochta provayderi (SMTP) — xatlarni yetkazish: qabul qiluvchi manzili va tasdiqlash/parolni tiklash kodi.\n• Atmos (AO «National Innovative Payment Technologies», O'zbekiston) — to'lovni qabul qilish uchun to'lov agregatori (Payme, Click, Uzcard, Humo, Visa); to'lov identifikatori va summa uzatiladi, karta rekvizitlari bevosita agregatorda kiritiladi, Operatorni chetlab o'tadi.\n\nBank kartalari rekvizitlari (raqam, CVV) Operator infratuzilmasidan o'tmaydi.`,
      },
      {
        heading: `8. Cookie-fayllar`,
        short: `Cookie`,
        body: `8.1. Platforma cookie-fayllardan foydalanadi. Birinchi tashrifda rozilik banneri ko'rsatiladi.\n8.2. Cookie turlari:\n• Zarur (autentifikatsiya sessiyasi) — tizimga kirishni ta'minlaydi, muddati 30 kungacha;\n• Funksional (interfeys tili, dizayn mavzusi, panel sozlamalari) — afzalliklarni eslab qoladi, muddati 1 yilgacha / tozalanguncha;\n• Analitik (Google Analytics: _ga, _ga_*) — shaxssizlantirilgan tashriflar statistikasi, faqat Foydalanuvchi roziligidan keyin («Qabul qilish» tugmasi) yuklanadi, «Rad etish» tanlansa umuman yuklanmaydi, muddati 13 oygacha.\n8.3. Analitikaga bergan rozilikni istalgan vaqtda saytdagi cookie sozlamalari orqali o'zgartirish mumkin. Zarur cookie-larni brauzerda o'chirish tizimga kirishning imkonsizligiga olib keladi.`,
      },
      {
        heading: `9. Saqlash muddatlari`,
        short: `Saqlash muddati`,
        body: `9.1. Hisob ma'lumotlari akkaunt mavjud bo'lgan butun davr davomida saqlanadi.\n9.2. Foydalanuvchi istalgan vaqtda o'z hisobini o'chirishni so'rashi mumkin (10-bo'limga qarang), shundan so'ng u bilan bog'liq shaxsiy ma'lumotlar o'chiriladi.\n9.2.1. Uzoq vaqt ishlatilmagan bepul hisoblar. Agar bepul hisobga ${INACTIVE_WARN_DAYS} kun davomida kirilmasa, biz ogohlantirish yuboramiz. Yana ${FREEZE_AFTER_WARN_DAYS} kun kirilmasa, hisob vaqtincha muzlatiladi — bunda hech qanday ma'lumot o'chirilmaydi va bir marta kirish bilan hisob to'liq tiklanadi. Muzlatilgandan keyin ${DELETE_AFTER_FREEZE_DAYS} kun davomida ham kirilmasa, hisob va u bilan bog'liq shaxsiy ma'lumotlar o'chiriladi. Har bir bosqichda ogohlantirish yuboriladi va istalgan paytdagi bitta kirish jarayonni to'liq to'xtatadi. To'lov tarixi mavjud hisoblar bu tartibda avtomatik o'chirilmaydi.\n9.3. Moliyaviy/soliq ma'lumotlari bo'yicha izoh: to'lovlar haqidagi yozuvlar va buxgalteriya hujjatlari O'zbekiston Respublikasining buxgalteriya hisobi va soliqqa tortish to'g'risidagi qonunchiligida belgilangan muddatlar davomida, hatto hisob o'chirilgandan keyin ham saqlanadi. Hisob o'chirilganda bunday yozuvlar profil bilan bog'liqlik qismida shaxssizlantiriladi, biroq soliq hisobi uchun zarur ma'lumotlarni (summa, sana, tranzaksiya identifikatori, to'lovchi manzili) saqlab qoladi.\n9.4. Ma'lumotlar bazasining zaxira nusxalari Operator infratuzilmasida (Finlyandiyada) cheklangan rotatsiya muddati bilan saqlanadi.`,
      },
      {
        heading: `10. Shaxsiy ma'lumotlar subyektining huquqlari`,
        short: `Huquqlar`,
        body: `ZRU-547-son Qonuniga muvofiq Foydalanuvchi quyidagi huquqlarga ega:\n• o'z shaxsiy ma'lumotlarining qayta ishlanishi haqida ma'lumot olish;\n• noaniq yoki noqonuniy qayta ishlanayotgan ma'lumotlarni aniqlashtirish, bloklash yoki o'chirishni talab qilish;\n• qayta ishlashga bergan rozilikni qaytarib olish (rozilikka asoslangan qismida);\n• o'z hisobini o'chirishni talab qilish — sozlamalardagi «Hisobni o'chirish so'rovi» funksiyasi orqali yoki privacy@daromadchi.uz manziliga so'rov yuborish orqali (so'rov Operator tomonidan ko'rib chiqiladi; shaxsiy ma'lumotlar 9.3-band bo'yicha moliyaviy yozuvlar saqlangan holda o'chiriladi);\n• nazorat organiga shikoyat berish (Adliya vazirligi huzuridagi Shaxsiylashtirish agentligi / Uzkomnazorat).\n\nHuquqlarni amalga oshirish uchun — privacy@daromadchi.uz manziliga so'rov yuboring, javob muddati 30 kun.`,
      },
      {
        heading: `11. Xavfsizlik`,
        short: `Xavfsizlik`,
        body: `11.1. Qo'llaniladigan himoya choralari:\n• ma'lumotlar uzatishni shifrlash (HTTPS/TLS);\n• parollarni xeshlangan holda saqlash (bcrypt);\n• marketpleys API-kalitlarini shifrlash (AES-256-CBC);\n• kirish huquqlarini chegaralash;\n• dasturiy ta'minotni muntazam yangilash.\n11.2. Shaxsiy ma'lumotlar sizib chiqishi aniqlanganda Operator choralar ko'radi va vakolatli organ hamda ta'sirlangan Foydalanuvchilarni qonunchilikda belgilangan tartibda xabardor qiladi.`,
      },
      {
        heading: `12. Siyosatga o'zgartishlar`,
        short: `O'zgarishlar`,
        body: `Amaldagi tahrir doimo https://daromadchi.uz/privacy manzilida mavjud. Muhim o'zgarishlar bo'lganda Foydalanuvchilar email orqali yoki xizmat interfeysi orqali xabardor qilinadi.`,
      },
      {
        heading: `13. Aloqa`,
        short: `Aloqa`,
        body: `Yakka tartibdagi tadbirkor (YATT) Xakimjonov Jamshid Jahongir o'g'li, STIR/JSHSHIR: 51608028660035, O'zbekiston Respublikasi.\nMa'lumotlarni himoya qilish masalalari bo'yicha email: privacy@daromadchi.uz.`,
      },
    ],
  },
  ru: {
    title: `Политика конфиденциальности`,
    subtitle: `Используя платформу Daromadchi, вы соглашаетесь с настоящей политикой.`,
    updated: `Версия 1.0 · 11 августа 2026 г.`,
    sections: [
      {
        heading: `1. Общие положения`,
        short: `Общее`,
        body: `1.1. Настоящая Политика конфиденциальности описывает порядок сбора, обработки, хранения, передачи и защиты персональных данных пользователей платформы Daromadchi (https://daromadchi.uz).\n1.2. Оператором персональных данных является: Индивидуальный предприниматель (ЯТТ) Хакимжонов Жамшид Жахонгир угли, ИНН/ПИНФЛ: 51608028660035, Республика Узбекистан (далее — «Оператор»). «Daromadchi» — наименование сервиса.\n1.3. Настоящая Политика разработана в соответствии с Законом Республики Узбекистан «О персональных данных» от 2 июля 2019 г. № ЗРУ-547 (с изменениями, внесёнными Законом № 1125, вступившим в силу 27 марта 2026 г.).\n1.4. Надзор за обработкой персональных данных осуществляют Агентство персонализации при Министерстве юстиции Республики Узбекистан (ведёт Государственный реестр баз персональных данных) и государственная инспекция «Узкомназорат».\n1.5. Используя платформу, Пользователь подтверждает, что ознакомился с настоящей Политикой и выражает согласие на обработку своих персональных данных в описанном объёме, включая трансграничную передачу (см. раздел 6).`,
      },
      {
        heading: `2. Собираемые персональные данные`,
        short: `Данные`,
        body: `2.1. Данные учётной записи (при регистрации): адрес электронной почты (обязательно) — используется для входа и уведомлений; имя пользователя / имя (по желанию) — единственный идентификатор личности, кроме email, который сохраняется; пароль — хранится исключительно в виде необратимого криптографического хеша (bcrypt), Оператор не имеет доступа к паролю в открытом виде. Регистрация возможна также через Google (OAuth) — в этом случае Оператор получает от Google только адрес электронной почты и имя; токены Google не сохраняются.\n2.2. Данные Telegram (по желанию): если Пользователь подключает Telegram-уведомления, сохраняются Telegram ID (числовой идентификатор) и Telegram username. Эти данные собираются только при добровольном подключении Пользователем бота уведомлений.\n2.3. Оператор НЕ собирает: номер телефона, IP-адрес пользователя (не сохраняется в базе данных), данные об устройстве или браузере (device fingerprint). IP-адрес может кратковременно использоваться в оперативной памяти исключительно для защиты от автоматизированных атак (ограничение частоты запросов) и не сохраняется.\n2.4. Данные платежей: реквизиты банковских карт Оператором не собираются и не хранятся. Приём платежей осуществляется через платёжный агрегатор Atmos (AO «National Innovative Payment Technologies»), который предоставляет способы оплаты Payme, Click, Uzcard, Humo, Visa. Платёжные данные (номер карты, CVV) вводятся Пользователем непосредственно на стороне провайдера и не проходят через инфраструктуру Оператора. Оператор сохраняет только запись о платеже: сумму, дату, идентификатор транзакции, план, статус и адрес электронной почты плательщика (для целей бухгалтерского и налогового учёта).`,
      },
      {
        heading: `3. Данные маркетплейсов`,
        short: `Маркетплейсы`,
        body: `3.1. Для предоставления аналитики Пользователь предоставляет API-ключи своих кабинетов на маркетплейсах (Uzum Market, Yandex Market). API-ключи хранятся в зашифрованном виде (AES-256-CBC).\n3.2. Оператор НЕ собирает и не хранит персональные данные покупателей маркетплейсов — обрабатываются только данные самого продавца (Пользователя): его товары, остатки, заказы, финансовая и торговая статистика магазина. Имена, телефоны, адреса и иные персональные данные покупателей не запрашиваются и не сохраняются.\n3.3. Пользователь самостоятельно несёт ответственность за правомерность предоставления Оператору API-ключей своих кабинетов на маркетплейсах.`,
      },
      {
        heading: `4. Цели обработки`,
        short: `Цели`,
        body: `Оператор обрабатывает персональные данные в следующих целях:\n• регистрация учётной записи и авторизация;\n• предоставление функционала аналитики в соответствии с выбранным тарифом;\n• направление уведомлений (о заказах, остатках, безопасности), в том числе через Telegram по желанию Пользователя;\n• обработка платежей и ведение бухгалтерского/налогового учёта;\n• обеспечение безопасности сервиса и защита от несанкционированного доступа;\n• техническая поддержка и обработка обращений;\n• улучшение сервиса на основе обезличенных данных.`,
      },
      {
        heading: `5. Правовые основания`,
        short: `Основания`,
        body: `• Исполнение договора — для обработки, необходимой для предоставления сервиса;\n• Согласие Пользователя — для необязательных функций (Telegram-уведомления, аналитические cookie);\n• Исполнение требований законодательства — для хранения бухгалтерских и налоговых документов;\n• Законный интерес Оператора — для обеспечения безопасности и противодействия мошенничеству.`,
      },
      {
        heading: `6. Трансграничная передача и место хранения данных`,
        short: `Хранение`,
        body: `6.1. Данные хранятся на серверах, расположенных за пределами Республики Узбекистан — инфраструктура размещена в Финляндии (г. Хельсинки), на серверах провайдера Hetzner Online GmbH.\n6.2. Используя платформу, Пользователь даёт согласие на такую трансграничную обработку своих персональных данных. В соответствии со статьёй 27¹ Закона № ЗРУ-547, несенситивные персональные данные (Оператор не обрабатывает биометрические, генетические данные и данные абонентов связи) могут храниться за пределами Республики Узбекистан при соблюдении условий закона. Оператор не заявляет о наличии официального признания «адекватности» уровня защиты со стороны уполномоченного органа.`,
      },
      {
        heading: `7. Третьи стороны — обработчики данных`,
        short: `Третьи лица`,
        body: `• Hetzner Online GmbH (Финляндия, Хельсинки) — хостинг приложения и базы данных.\n• Google LLC — вход через Google (OAuth: email и имя) и обезличенная веб-аналитика Google Analytics 4 (только при согласии Пользователя; персональные данные не передаются).\n• Telegram Messenger — доставка уведомлений через бота (при подключении Пользователем): Telegram ID и текст уведомления (наименования товаров, артикулы, суммы).\n• Uzum Market, Yandex Market — при синхронизации передаётся API-ключ Пользователя и запросы к API его собственного кабинета.\n• Провайдер электронной почты (SMTP) — доставка писем: адрес получателя и код подтверждения/сброса пароля.\n• Atmos (AO «National Innovative Payment Technologies», Узбекистан) — платёжный агрегатор для приёма оплаты (Payme, Click, Uzcard, Humo, Visa); передаётся идентификатор платежа и сумма, реквизиты карт вводятся напрямую у агрегатора, минуя Оператора.\n\nРеквизиты банковских карт (номер, CVV) не проходят через инфраструктуру Оператора.`,
      },
      {
        heading: `8. Cookie-файлы`,
        short: `Cookie`,
        body: `8.1. Платформа использует cookie. При первом посещении отображается баннер согласия.\n8.2. Типы cookie:\n• Необходимые (сессия аутентификации) — обеспечивают вход в систему, срок до 30 дней;\n• Функциональные (язык интерфейса, тема оформления, настройки панели) — запоминают предпочтения, срок до 1 года / до очистки;\n• Аналитические (Google Analytics: _ga, _ga_*) — обезличенная статистика посещаемости, загружаются только после согласия Пользователя (кнопка «Принять»), при выборе «Отклонить» не загружаются вовсе, срок до 13 месяцев.\n8.3. Согласие на аналитику можно изменить в любой момент через настройки cookie на сайте. Отключение необходимых cookie в браузере приводит к невозможности авторизации.`,
      },
      {
        heading: `9. Сроки хранения`,
        short: `Сроки хранения`,
        body: `9.1. Данные учётной записи хранятся в течение всего периода существования аккаунта.\n9.2. Пользователь может в любой момент запросить удаление своей учётной записи (см. раздел 10), после чего связанные с ней персональные данные удаляются.\n9.2.1. Неиспользуемые бесплатные аккаунты. Если в бесплатный аккаунт не входили ${INACTIVE_WARN_DAYS} дней, мы направляем предупреждение. Если вход не выполнен ещё ${FREEZE_AFTER_WARN_DAYS} дней, аккаунт временно замораживается — при этом никакие данные не удаляются, и один вход полностью восстанавливает аккаунт. Если после заморозки вход не выполнен в течение ${DELETE_AFTER_FREEZE_DAYS} дней, аккаунт и связанные с ним персональные данные удаляются. О каждом этапе мы предупреждаем, и один вход на любом этапе полностью останавливает процесс. Аккаунты с историей платежей по этой процедуре автоматически не удаляются.\n9.3. Оговорка по финансовым/налоговым данным: записи о платежах и бухгалтерские документы сохраняются в течение сроков, установленных законодательством Республики Узбекистан о бухгалтерском учёте и налогообложении, даже после удаления учётной записи. При удалении аккаунта такие записи обезличиваются в части связи с профилем, но сохраняют данные, необходимые для налогового учёта (сумма, дата, идентификатор транзакции, адрес плательщика).\n9.4. Резервные копии базы данных хранятся на инфраструктуре Оператора (в Финляндии) с ограниченным сроком ротации.`,
      },
      {
        heading: `10. Права субъекта персональных данных`,
        short: `Права`,
        body: `В соответствии с Законом № ЗРУ-547 Пользователь имеет право:\n• получить информацию об обработке своих персональных данных;\n• требовать уточнения, блокирования или удаления неточных или незаконно обрабатываемых данных;\n• отозвать согласие на обработку (в части, основанной на согласии);\n• потребовать удаления своей учётной записи — через функцию «Запрос на удаление аккаунта» в настройках, либо направив запрос на privacy@daromadchi.uz (запрос обрабатывается Оператором; персональные данные удаляются с сохранением финансовых записей согласно п. 9.3);\n• подать жалобу в надзорный орган (Агентство персонализации при Министерстве юстиции / Узкомназорат).\n\nДля реализации прав — запрос на privacy@daromadchi.uz, срок ответа 30 дней.`,
      },
      {
        heading: `11. Безопасность`,
        short: `Безопасность`,
        body: `11.1. Применяемые меры защиты:\n• шифрование передачи данных (HTTPS/TLS);\n• хранение паролей в хешированном виде (bcrypt);\n• шифрование API-ключей маркетплейсов (AES-256-CBC);\n• разграничение прав доступа;\n• регулярное обновление программного обеспечения.\n11.2. При обнаружении утечки персональных данных Оператор принимает меры и уведомляет уполномоченный орган и затронутых Пользователей в порядке, установленном законодательством.`,
      },
      {
        heading: `12. Изменения политики`,
        short: `Изменения`,
        body: `Актуальная редакция всегда доступна по адресу https://daromadchi.uz/privacy. При существенных изменениях Пользователи уведомляются по email или через интерфейс сервиса.`,
      },
      {
        heading: `13. Контакты`,
        short: `Контакты`,
        body: `Индивидуальный предприниматель (ЯТТ) Хакимжонов Жамшид Жахонгир угли, ИНН/ПИНФЛ: 51608028660035, Республика Узбекистан.\nEmail по вопросам защиты данных: privacy@daromadchi.uz.`,
      },
    ],
  },
  en: {
    title: `Privacy Policy`,
    subtitle: `By using the Daromadchi platform, you agree to this policy.`,
    updated: `Version 1.0 · 11 August 2026`,
    sections: [
      {
        heading: `1. General provisions`,
        short: `General`,
        body: `1.1. This Privacy Policy describes how the personal data of users of the Daromadchi platform (https://daromadchi.uz) is collected, processed, stored, transferred and protected.\n1.2. The personal-data operator is: Individual Entrepreneur (YATT) Xakimjonov Jamshid Jahongir o'g'li, TIN/PINFL: 51608028660035, Republic of Uzbekistan (the "Operator"). "Daromadchi" is the name of the service.\n1.3. This Policy is drawn up in accordance with the Law of the Republic of Uzbekistan "On Personal Data" of 2 July 2019 No. ZRU-547 (as amended by Law No. 1125, in force from 27 March 2026).\n1.4. Supervision of personal-data processing is carried out by the Personalization Agency under the Ministry of Justice of the Republic of Uzbekistan (which maintains the State Register of Personal Data Bases) and the state inspectorate Uzkomnazorat.\n1.5. By using the platform, the User confirms that they have read this Policy and consents to the processing of their personal data to the extent described, including cross-border transfer (see Section 6).`,
      },
      {
        heading: `2. Personal data collected`,
        short: `Data`,
        body: `2.1. Account data (at registration): email address (required) — used for sign-in and notifications; username / name (optional) — the only identity identifier besides email that is stored; password — stored solely as an irreversible cryptographic hash (bcrypt); the Operator has no access to the plain-text password. Registration via Google (OAuth) is also possible — in that case the Operator receives only the email address and name from Google; Google tokens are not stored.\n2.2. Telegram data (optional): if the User connects Telegram notifications, the Telegram ID (numeric identifier) and Telegram username are stored. This data is collected only when the User voluntarily connects the notification bot.\n2.3. The Operator does NOT collect: phone number, the user's IP address (not stored in the database), or device/browser data (device fingerprint). An IP address may be used briefly in memory solely to protect against automated attacks (rate limiting) and is not stored.\n2.4. Payment data: bank-card details are not collected or stored by the Operator. Payments are accepted through the Atmos payment aggregator (JSC "National Innovative Payment Technologies"), which provides the Payme, Click, Uzcard, Humo and Visa payment methods. Payment details (card number, CVV) are entered by the User directly on the provider's side and never pass through the Operator's infrastructure. The Operator stores only a payment record: amount, date, transaction identifier, plan, status and the payer's email address (for accounting and tax purposes).`,
      },
      {
        heading: `3. Marketplace data`,
        short: `Marketplaces`,
        body: `3.1. To provide analytics, the User supplies the API keys of their marketplace seller accounts (Uzum Market, Yandex Market). API keys are stored encrypted (AES-256-CBC).\n3.2. The Operator does NOT collect or store the personal data of marketplace customers (buyers) — only the seller's (User's) own data is processed: their products, stock, orders, and the store's financial and sales statistics. Buyers' names, phone numbers, addresses and other personal data are neither requested nor stored.\n3.3. The User is solely responsible for the lawfulness of providing the Operator with the API keys of their marketplace accounts.`,
      },
      {
        heading: `4. Purposes of processing`,
        short: `Purposes`,
        body: `The Operator processes personal data for the following purposes:\n• account registration and authentication;\n• providing analytics functionality according to the selected plan;\n• sending notifications (about orders, stock, security), including via Telegram at the User's option;\n• processing payments and keeping accounting/tax records;\n• ensuring the security of the service and protection against unauthorised access;\n• technical support and handling of enquiries;\n• improving the service on the basis of anonymised data.`,
      },
      {
        heading: `5. Legal bases`,
        short: `Legal basis`,
        body: `• Performance of a contract — for processing necessary to provide the service;\n• The User's consent — for optional features (Telegram notifications, analytics cookies);\n• Compliance with legal requirements — for retaining accounting and tax documents;\n• The Operator's legitimate interest — for ensuring security and preventing fraud.`,
      },
      {
        heading: `6. Cross-border transfer and data location`,
        short: `Data location`,
        body: `6.1. Data is stored on servers located outside the Republic of Uzbekistan — the infrastructure is hosted in Finland (Helsinki), on servers of the provider Hetzner Online GmbH.\n6.2. By using the platform, the User consents to such cross-border processing of their personal data. In accordance with Article 27¹ of Law No. ZRU-547, non-sensitive personal data (the Operator does not process biometric or genetic data or the data of communications subscribers) may be stored outside the Republic of Uzbekistan subject to the conditions of the law. The Operator does not claim any official "adequacy" recognition of the level of protection by the authorised body.`,
      },
      {
        heading: `7. Third parties — data processors`,
        short: `Third parties`,
        body: `• Hetzner Online GmbH (Finland, Helsinki) — hosting of the application and database.\n• Google LLC — sign-in via Google (OAuth: email and name) and anonymised web analytics Google Analytics 4 (only with the User's consent; no personal data is transmitted).\n• Telegram Messenger — delivery of notifications via the bot (when connected by the User): Telegram ID and the notification text (product names, SKUs, amounts).\n• Uzum Market, Yandex Market — during synchronisation, the User's API key and requests to the API of their own seller account are transmitted.\n• Email provider (SMTP) — delivery of emails: the recipient's address and the confirmation/password-reset code.\n• Atmos (JSC "National Innovative Payment Technologies", Uzbekistan) — payment aggregator for accepting payment (Payme, Click, Uzcard, Humo, Visa); the payment identifier and amount are transmitted, card details are entered directly with the aggregator, bypassing the Operator.\n\nBank-card details (number, CVV) never pass through the Operator's infrastructure.`,
      },
      {
        heading: `8. Cookies`,
        short: `Cookies`,
        body: `8.1. The platform uses cookies. A consent banner is shown on your first visit.\n8.2. Cookie types:\n• Essential (authentication session) — enable sign-in, lifetime up to 30 days;\n• Functional (interface language, theme, panel settings) — remember your preferences, lifetime up to 1 year / until cleared;\n• Analytics (Google Analytics: _ga, _ga_*) — anonymised visit statistics, loaded only after the User's consent (the "Accept" button); if "Decline" is chosen they are not loaded at all; lifetime up to 13 months.\n8.3. Analytics consent can be changed at any time via the cookie settings on the site. Disabling essential cookies in the browser makes signing in impossible.`,
      },
      {
        heading: `9. Retention periods`,
        short: `Retention`,
        body: `9.1. Account data is retained for the entire period the account exists.\n9.2. The User may request deletion of their account at any time (see Section 10), after which the personal data associated with it is deleted.\n9.2.1. Dormant free accounts. If a free account is not signed into for ${INACTIVE_WARN_DAYS} days we send a warning. If there is still no sign-in after a further ${FREEZE_AFTER_WARN_DAYS} days, the account is temporarily frozen — no data is deleted at this stage, and a single sign-in fully restores it. If the account is not signed into for ${DELETE_AFTER_FREEZE_DAYS} days after being frozen, the account and its associated personal data are deleted. We give notice at each stage, and one sign-in at any point stops the process entirely. Accounts with payment history are not deleted automatically under this procedure.\n9.3. Financial/tax data reservation: payment records and accounting documents are retained for the periods established by the accounting and taxation legislation of the Republic of Uzbekistan, even after the account is deleted. On account deletion, such records are de-linked from the profile but keep the data required for tax accounting (amount, date, transaction identifier, payer's address).\n9.4. Database backups are kept on the Operator's infrastructure (in Finland) with a limited rotation period.`,
      },
      {
        heading: `10. Rights of the data subject`,
        short: `Rights`,
        body: `Under Law No. ZRU-547 the User has the right to:\n• obtain information about the processing of their personal data;\n• demand rectification, blocking or deletion of inaccurate or unlawfully processed data;\n• withdraw consent to processing (for the part based on consent);\n• request deletion of their account — via the "Account deletion request" feature in settings, or by sending a request to privacy@daromadchi.uz (the request is handled by the Operator; personal data is deleted while financial records are retained per clause 9.3);\n• lodge a complaint with the supervisory authority (the Personalization Agency under the Ministry of Justice / Uzkomnazorat).\n\nTo exercise these rights, send a request to privacy@daromadchi.uz; the response time is 30 days.`,
      },
      {
        heading: `11. Security`,
        short: `Security`,
        body: `11.1. Protection measures applied:\n• encryption of data in transit (HTTPS/TLS);\n• storage of passwords in hashed form (bcrypt);\n• encryption of marketplace API keys (AES-256-CBC);\n• access-rights segregation;\n• regular software updates.\n11.2. If a personal-data breach is detected, the Operator takes action and notifies the authorised body and the affected Users in the manner prescribed by law.`,
      },
      {
        heading: `12. Changes to the policy`,
        short: `Changes`,
        body: `The current version is always available at https://daromadchi.uz/privacy. In the event of material changes, Users are notified by email or through the service interface.`,
      },
      {
        heading: `13. Contacts`,
        short: `Contact`,
        body: `Individual Entrepreneur (YATT) Xakimjonov Jamshid Jahongir o'g'li, TIN/PINFL: 51608028660035, Republic of Uzbekistan.\nEmail for data-protection matters: privacy@daromadchi.uz.`,
      },
    ],
  },
}

const NAVBAR_H = 68

export default function PrivacyPage() {
  const { lang } = useLang()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const t = T[lang] ?? T.uz
  const [open, setOpen] = useState(true)
  const [active, setActive] = useState(0)
  const [flash, setFlash] = useState<number | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollLockRef = useRef(false)
  const scrollLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (scrollLockRef.current) return
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-idx'))
            setActive(idx)
          }
        })
      },
      { rootMargin: `-${NAVBAR_H + 32}px 0px -55% 0px`, threshold: 0 }
    )
    const els = document.querySelectorAll('[data-idx]')
    els.forEach((el) => observerRef.current?.observe(el))
    return () => observerRef.current?.disconnect()
  }, [lang])

  const scrollTo = (idx: number) => {
    const el = document.getElementById(`section-${idx}`)
    if (!el) return
    setActive(idx)
    const y = el.getBoundingClientRect().top + window.scrollY - NAVBAR_H - 36

    scrollLockRef.current = true
    if (scrollLockTimerRef.current) clearTimeout(scrollLockTimerRef.current)
    scrollLockTimerRef.current = setTimeout(() => { scrollLockRef.current = false }, 1000)

    window.scrollTo({ top: y, behavior: 'smooth' })
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash(idx)
    flashTimerRef.current = setTimeout(() => setFlash(null), 2000)
  }

  return (
    <div className="flex">
      {/* Sidebar */}
      <aside
        className="sticky top-[68px] self-start h-[calc(100vh-68px)] flex-shrink-0 border-r transition-all duration-300 overflow-hidden"
        style={{
          width: open ? 280 : 60,
          borderColor: 'var(--border)',
          background: 'var(--bg-card)',
        }}
      >
        {/* Toggle button */}
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-end px-4 py-5 border-b transition-colors hover:text-[var(--c1)]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          {open
            ? <ChevronLeft className="w-5 h-5 flex-shrink-0" />
            : <ChevronRight className="w-5 h-5 flex-shrink-0" />}
        </button>

        {/* Nav items */}
        <nav className="flex flex-col gap-1.5 p-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 68px - 58px)' }}>
          {t.sections.map((s, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              title={s.heading}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-semibold transition-all whitespace-nowrap overflow-hidden border"
              style={{
                color: active === i ? 'var(--c1)' : 'var(--text-base)',
                background: active === i ? (isDark ? 'rgba(131,192,249,0.10)' : 'rgba(2,132,199,0.08)') : 'transparent',
                borderColor: active === i ? 'var(--c1)' : 'transparent',
              }}
            >
              {open && <>
                <span
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{
                    background: active === i ? (isDark ? 'rgba(131,192,249,0.22)' : 'rgba(2,132,199,0.18)') : (isDark ? 'rgba(131,192,249,0.10)' : 'rgba(2,132,199,0.08)'),
                    color: 'var(--c1)',
                  }}
                >
                  {i + 1}
                </span>
                <span className="truncate">{s.short}</span>
              </>}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 px-8 py-16 relative">
        <div className="max-w-3xl mx-auto" style={{ position: 'relative', zIndex: 1 }}>
          <div className="text-center mb-14">
            <h1
              className="text-4xl sm:text-5xl font-extrabold mb-3"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}
            >
              {t.title}
            </h1>
            <p className="text-base mb-2" style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.updated}</p>
          </div>

          <div className="space-y-5">
            {t.sections.map((s, i) => (
              <div
                key={i}
                id={`section-${i}`}
                data-idx={i}
                className="scroll-mt-24"
                style={{
                  borderRadius: 16,
                  boxShadow: flash === i
                    ? '0 0 0 2px rgba(131,192,249,0.9), 0 0 28px rgba(131,192,249,0.35)'
                    : active === i
                      ? '0 0 0 1.5px rgba(131,192,249,0.5)'
                      : 'none',
                  transition: 'box-shadow 0.4s ease',
                }}
              >
                <BorderGlow
                  borderRadius={16}
                  glowColor={isDark ? "210 84 75" : "201 97 39"}
                  glowIntensity={isDark ? 1.5 : 1.0}
                  backgroundColor={active === i ? (isDark ? 'rgba(15,28,48,1)' : 'rgba(230,241,255,1)') : 'var(--bg-card)'}
                  colors={isDark
                    ? ['rgba(131,192,249,0.25)', 'rgba(100,171,240,0.18)', 'rgba(80,150,220,0.12)']
                    : ['rgba(2,132,199,0.15)', 'rgba(3,105,161,0.10)', 'rgba(14,116,200,0.08)']}
                  className="w-full"
                >
                  <div className="p-8">
                    <h2
                      className="font-bold text-base mb-3"
                      style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}
                    >
                      {s.heading}
                    </h2>
                    <p
                      className="text-base leading-relaxed whitespace-pre-line"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {s.body}
                    </p>
                  </div>
                </BorderGlow>
              </div>
            ))}
          </div>

          <p className="text-center text-sm mt-12" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} Daromadchi.{' '}
            {lang === 'uz' ? 'Barcha huquqlar himoyalangan.' : lang === 'ru' ? 'Все права защищены.' : 'All rights reserved.'}
          </p>
        </div>
      </main>
    </div>
  )
}

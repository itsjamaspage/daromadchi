'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLang, useTheme } from '@/app/providers'

function tx(lang: string, ru: string, uz: string, en: string) {
  return lang === 'ru' ? ru : lang === 'uz' ? uz : en
}

const NAVBAR_H = 68
const LAST_UPDATED = '2026-06-24'

interface SectionDef {
  short: { uz: string; ru: string; en: string }
  heading: { uz: string; ru: string; en: string }
  body: { uz: string; ru: string; en: string }
}

const SECTIONS: SectionDef[] = [
  {
    short: { uz: 'Umumiy', ru: 'Общее', en: 'Overview' },
    heading: { uz: '1. Umumiy ma\'lumot', ru: '1. Общие сведения', en: '1. Overview' },
    body: {
      uz: `Ushbu Muvofiqlik hujjati Daromadchi platformasi (veb-ilova va Chrome brauzer kengaytmasi) tomonidan shaxsiy ma'lumotlarni qayta ishlash tartibini belgilaydi. Hujjat quyidagi O'zbekiston Respublikasi qonunchiligiga muvofiq tuzilgan:\n\n• "Shaxsiy ma'lumotlar to'g'risida"gi Qonun (ZRU-547, 2019-yil 2-iyul, 2026-yil 26-martdagi o'zgartishlar bilan)\n• "Axborotlashtirish to'g'risida"gi Qonun (560-II, 2003-yil 11-dekabr)\n• Kiberxavfsizlik to'g'risidagi Prezident Farmoni (PP-6009, 2020-yil)\n• Elektron tijorat to'g'risidagi Qonun (ZRU-710, 2022-yil)\n\nDaromadchi — Uzbekiston internet-bozorlarida (Uzum Market, Wildberries, Yandex Market) savdo qiluvchi sotuvchilar uchun mo'ljallangan analitika platformasi bo'lib, daromad, xarajat, tovar qoldiqlarini birlashtiruvchi tahlil vositasini taqdim etadi.\n\nUshbu hujjat Maxfiylik siyosatiga qo'shimcha bo'lib, texnik va huquqiy jihatdan batafsilroq ma'lumot beradi.`,
      ru: `Настоящий документ описывает порядок обработки персональных данных платформой Daromadchi (веб-приложение и расширение Chrome) и составлен в соответствии со следующими нормативными актами Республики Узбекистан:\n\n• Закон «О персональных данных» (ЗРУ-547, 2 июля 2019 г., с поправками от 26 марта 2026 г.)\n• Закон «Об информатизации» (560-II, 11 декабря 2003 г.)\n• Указ Президента о кибербезопасности (ПП-6009, 2020 г.)\n• Закон об электронной коммерции (ЗРУ-710, 2022 г.)\n\nDaromadchi — аналитическая платформа для продавцов на маркетплейсах Узбекистана (Uzum Market, Wildberries, Yandex Market), предоставляющая единый инструмент для анализа выручки, расходов и товарных остатков.\n\nНастоящий документ дополняет Политику конфиденциальности и содержит более подробную техническую и правовую информацию.`,
      en: `This Compliance Document describes how the Daromadchi platform (web application and Chrome browser extension) processes personal data, and is prepared in accordance with the following laws of the Republic of Uzbekistan:\n\n• Law "On Personal Data" (ZRU-547, 2 July 2019, as amended 26 March 2026)\n• Law "On Informatization" (560-II, 11 December 2003)\n• Presidential Decree on Cybersecurity (PP-6009, 2020)\n• Law on Electronic Commerce (ZRU-710, 2022)\n\nDaromadchi is a sales analytics platform for sellers on Uzbekistan online marketplaces (Uzum Market, Wildberries, Yandex Market), providing a unified tool for tracking revenue, expenses and stock levels.\n\nThis document supplements the Privacy Policy with more detailed technical and legal information.`,
    },
  },
  {
    short: { uz: 'Operator', ru: 'Оператор', en: 'Controller' },
    heading: { uz: '2. Ma\'lumotlar operatori', ru: '2. Оператор данных', en: '2. Data Controller' },
    body: {
      uz: `Operator: Daromadchi\nFaoliyat joyi: Toshkent shahri, O'zbekiston Respublikasi\nTelegram: @daromadchi_alerts_bot\n\nDaromadchi ZRU-547 Qonuni asosida shaxsiy ma'lumotlar operatori sifatida O'zbekiston Respublikasi Hukumati huzuridagi Davlat shaxslashtirish markazi tomonidan yuritiluvchi Shaxsiy ma'lumotlar bazalarining Davlat reestriga kiritish bo'yicha ro'yxatdan o'tish jarayonini olib bormoqda.\n\nYosh chegarasi:\nDaromadchi 13 yoshdan kichik bolalarga mo'ljallanmagan. Bu biznes tahlil vositasi bo'lib, foydalanuvchilar kamida 18 yoshda bo'lishi tavsiya etiladi. Agar biz 13 yoshdan kichik shaxsga oid ma'lumotlarni to'plaganimizni aniqlasak, ular darhol o'chiriladi.`,
      ru: `Оператор: Daromadchi\nМесто деятельности: г. Ташкент, Республика Узбекистан\nTelegram: @daromadchi_alerts_bot\n\nDaromadchi проходит процедуру включения в Государственный реестр баз персональных данных, ведомый Государственным центром персонализации при Правительстве Республики Узбекистан, в качестве оператора персональных данных в соответствии с Законом ЗРУ-547.\n\nВозрастное ограничение:\nDaromadchi не предназначен для лиц младше 13 лет. Поскольку это инструмент бизнес-аналитики, пользователям рекомендуется быть не моложе 18 лет. При обнаружении данных лица младше 13 лет они будут незамедлительно удалены.`,
      en: `Controller: Daromadchi\nPlace of business: Tashkent, Republic of Uzbekistan\nTelegram: @daromadchi_alerts_bot\n\nDaromadchi is undergoing registration in the State Register of Personal Data Bases maintained by the State Personalisation Centre under the Cabinet of Ministers of the Republic of Uzbekistan, as a personal data operator under Law ZRU-547.\n\nAge restriction:\nDaromadchi is not intended for persons under 13. As a business analytics tool, users are recommended to be at least 18 years old. If we discover personal data of a person under 13 has been collected, it will be deleted immediately.`,
    },
  },
  {
    short: { uz: 'Veb-ilova', ru: 'Веб-прил.', en: 'Web App' },
    heading: { uz: '3. Veb-ilova: qayta ishlangan ma\'lumotlar', ru: '3. Веб-приложение: обрабатываемые данные', en: '3. Web Application: Data Processed' },
    body: {
      uz: `Daromadchi veb-ilovasida quyidagi ma'lumotlar qayta ishlanadi:\n\n📧 Hisob ma'lumotlari\n• Elektron pochta manzili — identifikatsiya va sessiya boshqaruvi uchun\n• Shifrlangan parol (bcrypt orqali Supabase Auth tomonidan) — biz hech qachon ochiq matn paroliga kirish imkoniga ega emasmiz\n\n🔑 Do'kon ulanish ma'lumotlari\n• Marketplace API kaliti (faqat o'qish imtiyozi bilan; AES-256-CBC bilan shifrlangan holda saqlanadi)\n• Maqsad: Uzum, Wildberries yoki Yandex Market hisobingizdan savdo ma'lumotlarini olish\n\n📊 Savdo ma'lumotlari\n• Buyurtmalar, mahsulotlar, ombor qoldiqlari, reklama xarajatlari — marketplace API orqali olinadi\n• Ushbu ma'lumotlar sizning do'koningizga tegishli va uchinchi shaxslarga uzatilmaydi\n\n📱 Telegram bildirishnomalar (ixtiyoriy)\n• Telegram chat ID — faqat savdo ogohlantirishlari yuborish uchun saqlanadi\n\n🔒 Texnik ma'lumotlar\n• IP-manzil — xavfsizlik va trafik chegaralash uchun (30 kun saqlanadi)\n• Sessiya tokeni — autentifikatsiya (Supabase tomonidan boshqariladi, 1 soat amal qiladi)\n• Brauzer turi — diagnostika maqsadida\n• Tizim jurnallari — 90 kun saqlanadi\n\nBiz TO'PLAMAYMIZ:\n• To'lov kartasi ma'lumotlari\n• Shaxsni tasdiqlovchi hujjat nusxalari\n• Biometrik ma'lumotlar\n• Boshqa maxsus toifali shaxsiy ma'lumotlar`,
      ru: `В веб-приложении Daromadchi обрабатываются следующие данные:\n\n📧 Учётные данные\n• Адрес электронной почты — для идентификации и управления сессией\n• Зашифрованный пароль (bcrypt через Supabase Auth) — мы никогда не имеем доступа к открытому тексту пароля\n\n🔑 Данные подключения магазина\n• API-ключ маркетплейса (с правами только на чтение; хранится в зашифрованном виде AES-256-CBC)\n• Цель: получение торговых данных из вашего аккаунта Uzum, Wildberries или Yandex Market\n\n📊 Торговые данные\n• Заказы, товары, складские остатки, рекламные расходы — получены через API маркетплейса\n• Эти данные принадлежат вашему магазину и не передаются третьим лицам\n\n📱 Telegram-уведомления (опционально)\n• Telegram chat ID — хранится только для отправки торговых уведомлений\n\n🔒 Технические данные\n• IP-адрес — для безопасности и ограничения трафика (хранится 30 дней)\n• Токен сессии — для аутентификации (управляется Supabase, действует 1 час)\n• Тип браузера — в диагностических целях\n• Системные журналы — хранятся 90 дней\n\nМЫ НЕ СОБИРАЕМ:\n• Данные платёжных карт\n• Копии удостоверяющих документов\n• Биометрические данные\n• Иные специальные категории персональных данных`,
      en: `The Daromadchi web application processes the following data:\n\n📧 Account data\n• Email address — for identification and session management\n• Encrypted password (bcrypt via Supabase Auth) — we never have access to the plain-text password\n\n🔑 Store connection data\n• Marketplace API key (read-only permissions; stored encrypted with AES-256-CBC)\n• Purpose: fetching trading data from your Uzum, Wildberries or Yandex Market account\n\n📊 Trading data\n• Orders, products, stock levels, ad spend — fetched via the marketplace API\n• This data belongs to your store and is not shared with third parties\n\n📱 Telegram notifications (optional)\n• Telegram chat ID — stored only for sending trade alerts\n\n🔒 Technical data\n• IP address — for security and rate limiting (retained 30 days)\n• Session token — for authentication (managed by Supabase, valid 1 hour)\n• Browser type — for diagnostic purposes\n• System logs — retained 90 days\n\nWE DO NOT COLLECT:\n• Payment card details\n• Identity document copies\n• Biometric data\n• Other special-category personal data`,
    },
  },
  {
    short: { uz: 'Kengaytma', ru: 'Расширение', en: 'Extension' },
    heading: { uz: '4. Chrome kengaytmasi: ma\'lumotlar va ruxsatlar', ru: '4. Расширение Chrome: данные и разрешения', en: '4. Chrome Extension: Data & Permissions' },
    body: {
      uz: `Daromadchi Chrome kengaytmasi quyidagi ruxsatlarga ega:\n\n• activeTab — faqat siz ochgan marketplace sahifasiga kirish (Uzum, Wildberries, Yandex Market domenlari). Boshqa saytlarga kirish yo'q. Ruxsat sahifani faollashtirish daqiqasida beriladi.\n\n• storage — API kaliti va sessiya tokenini qurilmangizda mahalliy saqlash. Faqat Daromadchi serveriga shifrlangan holda uzatiladi.\n\n• scripting — marketplace sahifalaridan (mahsulot narxi, SKU, tovar tavsifi) ma'lumot olish uchun skriptlarni kiritish.\n\n• cookies — daromadchi.uz domenida autentifikatsiya sessiyangi saqlash.\n\n• identity — Google OAuth orqali kirish (ixtiyoriy, foydalanuvchi tanloviga ko'ra).\n\nKengaytma BAJARMAYDI:\n✗ Browsing tarixingizni to'plamaydі\n✗ Boshqa saytlardagi ma'lumotlarni o'qimaydi\n✗ Parollaringizni ushlаmaydi\n✗ To'lov ma'lumotlarini to'plamaydі\n✗ Foydalanuvchi xatti-harakatlarini kuzatmaydi\n✗ Uchinchi tomonlarga ma'lumot joʻnatmaydi\n\nKengaytma FAQAT marketplace sahifalarida ishlaydi va server bilan barcha aloqa HTTPS orqali amalga oshiriladi. Mahalliy saqlash faqat texnik ma'lumotlar (token, sozlamalar) uchun ishlatiladi.\n\nKengaytma to'plagan ma'lumotlar faqat sizning Daromadchi hisobingizga bog'liq va uchinchi shaxslarga uzatilmaydi.`,
      ru: `Расширение Chrome Daromadchi имеет следующие разрешения:\n\n• activeTab — доступ только к открытой вами странице маркетплейса (домены Uzum, Wildberries, Yandex Market). Другие сайты недоступны. Разрешение предоставляется в момент активации страницы.\n\n• storage — локальное хранение API-ключа и токена сессии на вашем устройстве. Передача на сервер Daromadchi только в зашифрованном виде.\n\n• scripting — внедрение скриптов для извлечения данных со страниц маркетплейса (цена, SKU, описание товара).\n\n• cookies — хранение сессии аутентификации на домене Daromadchi (daromadchi.uz).\n\n• identity — вход через Google OAuth (по выбору пользователя, опционально).\n\nРасширение НЕ:\n✗ Не собирает историю браузера\n✗ Не читает данные с других сайтов\n✗ Не перехватывает пароли\n✗ Не собирает платёжные данные\n✗ Не отслеживает поведение пользователя\n✗ Не отправляет данные третьим лицам\n\nРасширение работает ТОЛЬКО на страницах маркетплейсов, весь обмен данными с сервером — через HTTPS. Локальное хранилище используется только для технических данных (токен, настройки).\n\nДанные, собранные расширением, привязаны исключительно к вашему аккаунту Daromadchi и не передаются третьим лицам.`,
      en: `The Daromadchi Chrome extension has the following permissions:\n\n• activeTab — access only to the marketplace page you have open (Uzum, Wildberries, Yandex Market domains). No other sites are accessible. Permission is granted at the moment the page is activated.\n\n• storage — local storage of the API key and session token on your device. Only transmitted to the Daromadchi server in encrypted form.\n\n• scripting — injecting scripts to extract data from marketplace pages (price, SKU, product description).\n\n• cookies — storing the authentication session on the Daromadchi domain (daromadchi.uz).\n\n• identity — sign-in via Google OAuth (user's choice, optional).\n\nThe extension DOES NOT:\n✗ Collect your browsing history\n✗ Read data from other websites\n✗ Intercept passwords\n✗ Collect payment information\n✗ Track user behaviour\n✗ Send data to third parties\n\nThe extension operates ONLY on marketplace pages; all server communication uses HTTPS. Local storage is used only for technical data (token, settings).\n\nData collected by the extension is tied exclusively to your Daromadchi account and is not shared with third parties.`,
    },
  },
  {
    short: { uz: 'Asos', ru: 'Основание', en: 'Legal Basis' },
    heading: { uz: '5. Ishlov berish huquqiy asoslari', ru: '5. Правовые основания обработки', en: '5. Legal Basis for Processing' },
    body: {
      uz: `ZRU-547 Qonuniga muvofiq har bir ma'lumot toifasi uchun ishlov berish asoslari:\n\n📧 Hisob ma'lumotlari (email, parol)\nAsos: Rozilik (ro'yxatdan o'tishda beriladi) + Shartnomani bajarish\n\n🔑 Marketplace API kalitlari\nAsos: Rozilik + Shartnomani bajarish (analitika xizmatini taqdim etish)\n\n📊 Savdo ma'lumotlari\nAsos: Shartnomani bajarish\n\n📱 Telegram chat ID\nAsos: Rozilik (bildirishnomalarni yoqish ixtiyoriy harakatdir)\n\n🔒 IP-manzil, texnik ma'lumotlar\nAsos: Qonuniy manfaat — tizim xavfsizligi va trafik chegaralash\n\n📋 Tizim jurnallari\nAsos: Qonuniy majburiyat — xavfsizlik monitoringi\n\nRozilikni qaytarib olish: Siz istalgan vaqtda roziligingizni qaytarib olishingiz mumkin. Buning uchun:\n• Hisobingizni o'chiring (barcha ma'lumotlar 30 kun ichida yo'q qilinadi)\n• Telegram chat ID ni o'chirish uchun: @daromadchi_alerts_bot ga murojaat qiling\n• API kalitini o'chirish uchun: Do'kon sozlamalaridagi "Ulanishni o'chirish" tugmasidan foydalaning`,
      ru: `Правовые основания обработки для каждой категории данных в соответствии с Законом ЗРУ-547:\n\n📧 Учётные данные (email, пароль)\nОснование: Согласие (предоставляется при регистрации) + Исполнение договора\n\n🔑 API-ключи маркетплейсов\nОснование: Согласие + Исполнение договора (предоставление аналитических услуг)\n\n📊 Торговые данные\nОснование: Исполнение договора\n\n📱 Telegram chat ID\nОснование: Согласие (включение уведомлений — добровольное действие)\n\n🔒 IP-адрес, технические данные\nОснование: Законный интерес — безопасность системы и ограничение трафика\n\n📋 Системные журналы\nОснование: Законная обязанность — мониторинг безопасности\n\nОтзыв согласия: согласие можно отозвать в любой момент:\n• Удалите аккаунт (все данные уничтожаются в течение 30 дней)\n• Для удаления Telegram chat ID: обратитесь через @daromadchi_alerts_bot\n• Для удаления API-ключа: используйте кнопку «Отключить» в настройках магазина`,
      en: `Legal bases for processing each data category under Law ZRU-547:\n\n📧 Account data (email, password)\nBasis: Consent (given at registration) + Contract performance\n\n🔑 Marketplace API keys\nBasis: Consent + Contract performance (providing analytics service)\n\n📊 Trading data\nBasis: Contract performance\n\n📱 Telegram chat ID\nBasis: Consent (enabling notifications is a voluntary action)\n\n🔒 IP address, technical data\nBasis: Legitimate interest — system security and rate limiting\n\n📋 System logs\nBasis: Legal obligation — security monitoring\n\nWithdrawing consent: consent can be withdrawn at any time:\n• Delete your account (all data destroyed within 30 days)\n• To remove Telegram chat ID: contact via @daromadchi_alerts_bot\n• To remove an API key: use the "Disconnect" button in store settings`,
    },
  },
  {
    short: { uz: 'Xavfsizlik', ru: 'Безопас.', en: 'Security' },
    heading: { uz: '6. Xavfsizlik choralari', ru: '6. Меры безопасности', en: '6. Security Measures' },
    body: {
      uz: `Texnik chora-tadbirlar:\n\n🔐 Shifrlash\n• Marketplace API kalitlari: AES-256-CBC (kalit muhit o'zgaruvchilarida saqlanadi, kodda emas)\n• Parollar: bcrypt (Supabase Auth) — ochiq matn parol hech qaerda saqlanmaydi\n• Tranzitda: barcha aloqa TLS 1.2+ (HTTPS) orqali\n\n🛡️ Kirish nazorati\n• Har bir foydalanuvchi faqat o'z ma'lumotlariga kirish huquqiga ega (Supabase Row Level Security)\n• JWT sessiya tokenlari 1 soatdan so'ng muddati o'tadi\n• Trafik chegaralash: API uchun daqiqada 60 so'rov; muhim yo'nalishlar uchun daqiqada 20 so'rov\n\n🏢 Infratuzilma\n• Supabase Inc. (SOC 2 Type II sertifikati, AQSh)\n• Vercel serverless platforma (ISO 27001, SOC 2)\n• Barcha ma'lumotlar bazasi ulanishlari SSL orqali shifrlangan\n\n👁️ Monitoring\n• Xavfsizlik jurnallari tizimli tekshirib turiladi\n• Ruxsatsiz kirishga urinishlar IP bo'yicha bloklash bilan qayd etiladi\n\nTashkiliy chora-tadbirlar:\n• Minimal zaruriy ma'lumot tamoyili — faqat kerakli ma'lumot to'planadi\n• Ma'lumotlarga kirish imkoniyati cheklangan — faqat zarur bo'lganda\n• Kodga kirish nazorati va versiyalar boshqaruvi (Git)`,
      ru: `Технические меры:\n\n🔐 Шифрование\n• API-ключи маркетплейсов: AES-256-CBC (ключ хранится в переменных среды, не в коде)\n• Пароли: bcrypt (Supabase Auth) — открытый текст пароля нигде не хранится\n• В транзите: вся передача данных через TLS 1.2+ (HTTPS)\n\n🛡️ Контроль доступа\n• Каждый пользователь имеет доступ только к своим данным (Supabase Row Level Security)\n• JWT-токены сессий истекают через 1 час\n• Ограничение трафика: 60 запросов в минуту на API; 20 запросов для критических маршрутов\n\n🏢 Инфраструктура\n• Supabase Inc. (сертификат SOC 2 Type II, США)\n• Vercel serverless-платформа (ISO 27001, SOC 2)\n• Все подключения к базе данных зашифрованы через SSL\n\n👁️ Мониторинг\n• Журналы безопасности регулярно проверяются\n• Попытки несанкционированного доступа фиксируются с блокировкой по IP\n\nОрганизационные меры:\n• Принцип минимально необходимых данных — собирается только необходимое\n• Ограниченный доступ к данным — только при наличии необходимости\n• Контроль доступа к коду и управление версиями (Git)`,
      en: `Technical measures:\n\n🔐 Encryption\n• Marketplace API keys: AES-256-CBC (key stored in environment variables, not in code)\n• Passwords: bcrypt (Supabase Auth) — plain-text password never stored\n• In transit: all communication via TLS 1.2+ (HTTPS)\n\n🛡️ Access control\n• Each user can only access their own data (Supabase Row Level Security)\n• JWT session tokens expire after 1 hour\n• Rate limiting: 60 requests/minute on the API; 20 requests for critical routes\n\n🏢 Infrastructure\n• Supabase Inc. (SOC 2 Type II certified, USA)\n• Vercel serverless platform (ISO 27001, SOC 2)\n• All database connections encrypted via SSL\n\n👁️ Monitoring\n• Security logs reviewed regularly\n• Unauthorised access attempts logged and IP-blocked\n\nOrganisational measures:\n• Data minimisation — only necessary data collected\n• Restricted data access — only when required\n• Code access control and version management (Git)`,
    },
  },
  {
    short: { uz: 'Saqlash', ru: 'Хранение', en: 'Retention' },
    heading: { uz: '7. Ma\'lumotlarni saqlash muddatlari', ru: '7. Сроки хранения данных', en: '7. Data Retention Schedule' },
    body: {
      uz: `Ma'lumot toifasi — Saqlash muddati:\n\n📧 Hisob ma'lumotlari (email)\nHisob faol bo'lgan muddatda + o'chirishdan so'ng 30 kun\n\n🔑 Marketplace API kalitlari\nHisob faol bo'lgan muddatda + o'chirishdan so'ng 30 kun ichida yo'q qilinadi\n\n📊 Savdo ma'lumotlari (buyurtmalar, mahsulotlar)\nHisob faol bo'lgan muddatda\n\n📱 Telegram chat ID\nBildirishnomalar o'chirilmaguncha yoki hisob o'chirilmaguncha\n\n🔒 Tizim jurnallari\n90 kun\n\n🌐 IP-manzil loglari\n30 kun\n\nHisobni o'chirish: So'rovdan 30 kun ichida barcha shaxsiy ma'lumotlar o'chiriladi yoki anonim qilinadi. Hech qanday ma'lumot belgilangan muddatdan ortiq saqlanmaydi.\n\nZRU-547 Qonuni talablariga ko'ra, ma'lumotlar zaruriyat tugaganidan keyin va eng ko'pi bilan hisob o'chirilgandan 1 yil ichida o'chiriladi.`,
      ru: `Категория данных — Срок хранения:\n\n📧 Учётные данные (email)\nПока аккаунт активен + 30 дней после удаления\n\n🔑 API-ключи маркетплейсов\nПока аккаунт активен + уничтожаются в течение 30 дней после удаления\n\n📊 Торговые данные (заказы, товары)\nПока аккаунт активен\n\n📱 Telegram chat ID\nПока уведомления не отключены или аккаунт не удалён\n\n🔒 Системные журналы\n90 дней\n\n🌐 Логи IP-адресов\n30 дней\n\nУдаление аккаунта: в течение 30 дней после запроса все персональные данные удаляются или обезличиваются. Данные не хранятся сверх установленных сроков.\n\nВ соответствии с требованиями Закона ЗРУ-547 данные удаляются по истечении необходимости и не позднее чем через 1 год после удаления аккаунта.`,
      en: `Data category — Retention period:\n\n📧 Account data (email)\nWhile account is active + 30 days after deletion\n\n🔑 Marketplace API keys\nWhile account is active + destroyed within 30 days of deletion\n\n📊 Trading data (orders, products)\nWhile account is active\n\n📱 Telegram chat ID\nUntil notifications are disabled or account is deleted\n\n🔒 System logs\n90 days\n\n🌐 IP address logs\n30 days\n\nAccount deletion: within 30 days of the request all personal data is deleted or anonymised. No data is retained beyond the stated periods.\n\nIn compliance with Law ZRU-547, data is deleted once the purpose ceases and no later than 1 year after account deletion.`,
    },
  },
  {
    short: { uz: 'Uzatish', ru: 'Передача', en: 'Transfers' },
    heading: { uz: '8. Xalqaro ma\'lumot uzatish', ru: '8. Международная передача данных', en: '8. International Data Transfers' },
    body: {
      uz: `Daromadchi quyidagi xorijiy xizmat-provayderlardan foydalanadi:\n\nSupabase Inc. (AQSh)\n• Rol: Ma'lumotlar bazasi infratuzilmasi (PostgreSQL)\n• Kafolat: SOC 2 Type II sertifikati\n• Maqsad: Hisob ma'lumotlari, API kalitlari va savdo ma'lumotlarini saqlash\n\nVercel Inc. (AQSh)\n• Rol: Serverless computing, CDN\n• Kafolat: ISO 27001, SOC 2\n• Maqsad: Veb-ilovani joylashtirish va tez yetkazib berish\n\nHuquqiy asos:\nZRU-547 Qonuniga 2026-yil 26-martda kiritilgan o'zgartishlar xorijiy bulut xizmatlaridan foydalanishga ruxsat beradi, agar axborot xavfsizligi talablari bajarilsa. Supabase va Vercelning SOC 2 / ISO 27001 sertifikatsiyalari ushbu talabga javob beradi.\n\nUshbu provayderlar o'z hisoblash operatsiyalari doirasida ma'lumotlarga kirish huquqiga ega. Ular ma'lumotlarni o'z maqsadlari uchun foydalanmaydi. Boshqa xorijiy tomonlarga ma'lumot uzatilmaydi.`,
      ru: `Daromadchi использует следующих зарубежных поставщиков услуг:\n\nSupabase Inc. (США)\n• Роль: Инфраструктура базы данных (PostgreSQL)\n• Гарантия: Сертификат SOC 2 Type II\n• Цель: Хранение учётных данных, API-ключей и торговых данных\n\nVercel Inc. (США)\n• Роль: Serverless-вычисления, CDN\n• Гарантия: ISO 27001, SOC 2\n• Цель: Размещение и быстрая доставка веб-приложения\n\nПравовое основание:\nПоправки к Закону ЗРУ-547 от 26 марта 2026 г. разрешают использование иностранных облачных сервисов при соблюдении требований информационной безопасности. Сертификации SOC 2 / ISO 27001 от Supabase и Vercel удовлетворяют этому требованию.\n\nУказанные поставщики имеют доступ к данным только в рамках своих вычислительных операций. Они не используют данные в собственных целях. Данные не передаются иным зарубежным сторонам.`,
      en: `Daromadchi uses the following international service providers:\n\nSupabase Inc. (USA)\n• Role: Database infrastructure (PostgreSQL)\n• Assurance: SOC 2 Type II certified\n• Purpose: Storing account data, API keys and trading data\n\nVercel Inc. (USA)\n• Role: Serverless computing, CDN\n• Assurance: ISO 27001, SOC 2\n• Purpose: Hosting and fast delivery of the web application\n\nLegal basis:\nAmendments to Law ZRU-547 (26 March 2026) permit use of foreign cloud services where information security requirements are met. SOC 2 / ISO 27001 certifications from Supabase and Vercel satisfy this requirement.\n\nThese providers access data only within their computing operations. They do not use data for their own purposes. No data is transferred to any other international parties.`,
    },
  },
  {
    short: { uz: 'Huquqlar', ru: 'Права', en: 'User Rights' },
    heading: { uz: '9. Foydalanuvchi huquqlari (ZRU-547)', ru: '9. Права пользователей (ЗРУ-547)', en: '9. User Rights (ZRU-547)' },
    body: {
      uz: `ZRU-547 Qonuniga asosan sizda quyidagi huquqlar mavjud:\n\n📋 Kirish huquqi\nO'zingiz haqingizdagi ma'lumotlarni ko'rish va nusxa olish\n\n✏️ To'g'irlash huquqi\nNoto'g'ri yoki to'liq bo'lmagan ma'lumotlarni tuzatish talabi\n\n🗑️ O'chirish huquqi\nShaxsiy ma'lumotlarni o'chirish talabi (texnik yoki huquqiy asoslar yo'q bo'lganda)\n\n📦 Portativlik huquqi\nO'z ma'lumotlarini boshqa xizmatga ko'chirish (mashinali o'qiladigan formatda)\n\n🚫 E'tiroz huquqi\nMa'lumotlarni qayta ishlashga rozilikni qaytarib olish\n\n⏸️ Cheklash huquqi\nMa'lumotlarni qayta ishlashni vaqtincha to'xtatish talabi\n\nSo'rovlarni yuborish:\nTelegram: @daromadchi_alerts_bot\n\nJavob muddati: 15 ish kuni (ZRU-547 Qonuni talabiga ko'ra)\n\nSudriy murojaatlar: Agar so'rovingiz qoniqarli ko'rib chiqilmasa, O'zbekiston Respublikasi Raqamli texnologiyalar vazirligiga (mdt.uz) yoki sudga murojaat qilishingiz mumkin.`,
      ru: `В соответствии с Законом ЗРУ-547 вы имеете следующие права:\n\n📋 Право на доступ\nПросмотр и получение копии данных о вас\n\n✏️ Право на исправление\nТребование исправить неточные или неполные данные\n\n🗑️ Право на удаление\nТребование удалить персональные данные (при отсутствии технических или правовых оснований для хранения)\n\n📦 Право на портируемость\nПеренос своих данных в другой сервис (в машиночитаемом формате)\n\n🚫 Право на возражение\nОтзыв согласия на обработку данных\n\n⏸️ Право на ограничение\nТребование временно приостановить обработку данных\n\nОтправка запросов:\nTelegram: @daromadchi_alerts_bot\n\nСрок ответа: 15 рабочих дней (требование Закона ЗРУ-547)\n\nСудебное обращение: если ваш запрос не был рассмотрен надлежащим образом, вы вправе обратиться в Министерство цифровых технологий Республики Узбекистан (mdt.uz) или в суд.`,
      en: `Under Law ZRU-547 you have the following rights:\n\n📋 Right of access\nView and receive a copy of data held about you\n\n✏️ Right to rectification\nRequest correction of inaccurate or incomplete data\n\n🗑️ Right to erasure\nRequest deletion of personal data (where no technical or legal basis for retention exists)\n\n📦 Right to portability\nTransfer your data to another service (in machine-readable format)\n\n🚫 Right to object\nWithdraw consent to data processing\n\n⏸️ Right to restriction\nRequest temporary suspension of data processing\n\nSubmitting requests:\nTelegram: @daromadchi_alerts_bot\n\nResponse time: 15 working days (as required by Law ZRU-547)\n\nLegal action: if your request is not handled adequately, you may contact the Ministry of Digital Technologies of the Republic of Uzbekistan (mdt.uz) or the relevant court.`,
    },
  },
  {
    short: { uz: 'Buzilish', ru: 'Нарушение', en: 'Data Breach' },
    heading: { uz: '10. Ma\'lumotlar buzilishi tartibi', ru: '10. Процедура при нарушении данных', en: '10. Data Breach Procedure' },
    body: {
      uz: `Agar ma'lumotlar xavfsizligi buzilishi yuz bersa:\n\n1️⃣ Aniqlash (0–24 soat)\nKuzatuv tizimlari va xavfsizlik jurnallari orqali buzilish aniqlanadi.\n\n2️⃣ Baholash (24–48 soat)\nBuzilishning ko'lami, sababi va ta'sir ko'rsatgan ma'lumotlar toifalari aniqlanadi.\n\n3️⃣ Saqlash (48–72 soat)\nZaifllik bartaraf etiladi, ta'sirlangan ma'lumotlar himoyalanadi.\n\n4️⃣ Xabardor qilish (72 soat ichida)\n• Ta'sirlangan foydalanuvchilarga Telegram yoki boshqa mavjud kanal orqali xabar beriladi\n• Agar buzilish katta xatarli bo'lsa — O'zbekiston Respublikasi Raqamli texnologiyalar vazirligiga ma'lum qilinadi\n• Keng ko'lamli ta'sir bo'lsa — ommaviy e'lon daromadchi.uz saytida chop etiladi\n\n5️⃣ Tahlil va tuzatish\nBuzilishning sababi o'rganiladi va qayta yuz bermaslik uchun tizimli chora-tadbirlar ko'riladi.`,
      ru: `В случае нарушения безопасности данных:\n\n1️⃣ Обнаружение (0–24 часа)\nНарушение выявляется через системы мониторинга и журналы безопасности.\n\n2️⃣ Оценка (24–48 часов)\nОпределяется масштаб, причина и категории затронутых данных.\n\n3️⃣ Локализация (48–72 часа)\nУязвимость устраняется, затронутые данные защищаются.\n\n4️⃣ Уведомление (в течение 72 часов)\n• Пострадавшие пользователи уведомляются через Telegram или доступный канал связи\n• При высоком уровне риска — уведомление Министерства цифровых технологий Республики Узбекистан\n• При широком охвате — публичное уведомление на daromadchi.uz\n\n5️⃣ Анализ и устранение\nИсследуется первопричина, принимаются системные меры по предотвращению повторения.`,
      en: `In the event of a data breach:\n\n1️⃣ Detection (0–24 hours)\nBreach identified through monitoring systems and security logs.\n\n2️⃣ Assessment (24–48 hours)\nScope, cause and categories of affected data determined.\n\n3️⃣ Containment (48–72 hours)\nVulnerability addressed, affected data secured.\n\n4️⃣ Notification (within 72 hours)\n• Affected users notified via Telegram or available communication channel\n• If high-risk: notification to the Ministry of Digital Technologies of the Republic of Uzbekistan\n• If broad impact: public notice published on daromadchi.uz\n\n5️⃣ Review and remediation\nRoot cause investigated; systematic measures taken to prevent recurrence.`,
    },
  },
  {
    short: { uz: 'Muvofiqlik', ru: 'Соответ.', en: 'Compliance' },
    heading: { uz: '11. Muvofiqlik holati va tekshirish', ru: '11. Статус соответствия и аудит', en: '11. Compliance Status & Audit' },
    body: {
      uz: `O'zbekiston qonunlariga muvofiqlik:\n\n✅ ZRU-547 "Shaxsiy ma'lumotlar to'g'risida"gi Qonun\nHolat: Bajarilmoqda — Davlat reestriga ro'yxatdan o'tish jarayoni davom etmoqda\n\n✅ ZRU-560-II "Axborotlashtirish to'g'risida"gi Qonun\nHolat: Bajarilmoqda\n\n✅ PP-6009 Kiberxavfsizlik to'g'risidagi Prezident Farmoni\nHolat: HTTPS, trafik chegaralash, monitoring joriy etilgan\n\n✅ ZRU-710 Elektron tijorat qonuni\nHolat: Bajarilmoqda\n\nXalqaro sertifikatlar (xorijiy uzatish asosi):\n✅ Supabase SOC 2 Type II sertifikati\n✅ Vercel ISO 27001 sertifikati\n\nYosh chegarasi:\nDaromadchi 13 yoshdan kichik shaxslarga mo'ljallanmagan. Bu biznes tahlil vositasi bo'lib, foydalanuvchilardan kamida 18 yosh talab etiladi.\n\nKeyingi tekshirish sanasi: 2026-yil dekabr\n\nUshbu muvofiqlik hujjati har yili va qonunchilikdagi muhim o'zgarishlardan keyin yangilanadi.`,
      ru: `Соответствие законодательству Узбекистана:\n\n✅ ЗРУ-547 Закон «О персональных данных»\nСтатус: В процессе выполнения — регистрация в Государственном реестре продолжается\n\n✅ ЗРУ-560-II Закон «Об информатизации»\nСтатус: Выполняется\n\n✅ ПП-6009 Указ Президента о кибербезопасности\nСтатус: HTTPS, ограничение трафика, мониторинг внедрены\n\n✅ ЗРУ-710 Закон об электронной коммерции\nСтатус: Выполняется\n\nМеждународные сертификаты (основание для зарубежной передачи):\n✅ Сертификат Supabase SOC 2 Type II\n✅ Сертификат Vercel ISO 27001\n\nВозрастное ограничение:\nDaromadchi не предназначен для лиц младше 13 лет. Поскольку это инструмент бизнес-аналитики, пользователи должны быть не моложе 18 лет.\n\nДата следующего аудита: декабрь 2026 г.\n\nНастоящий документ обновляется ежегодно и после существенных изменений в законодательстве.`,
      en: `Uzbekistan law compliance:\n\n✅ ZRU-547 Law "On Personal Data"\nStatus: In progress — State Register registration underway\n\n✅ ZRU-560-II Law "On Informatization"\nStatus: Compliant\n\n✅ PP-6009 Presidential Decree on Cybersecurity\nStatus: HTTPS, rate limiting and monitoring implemented\n\n✅ ZRU-710 Electronic Commerce Law\nStatus: Compliant\n\nInternational certifications (basis for international transfers):\n✅ Supabase SOC 2 Type II certification\n✅ Vercel ISO 27001 certification\n\nAge restriction:\nDaromadchi is not intended for persons under 13. As a business analytics tool, users are required to be at least 18 years old.\n\nNext audit date: December 2026\n\nThis document is updated annually and following material changes in legislation.`,
    },
  },
  {
    short: { uz: 'Aloqa', ru: 'Контакты', en: 'Contact' },
    heading: { uz: '12. Aloqa va murojaatlar', ru: '12. Контакты и обращения', en: '12. Contact' },
    body: {
      uz: `Shaxsiy ma'lumotlar bilan bog'liq barcha so'rovlar, shikoyatlar yoki huquqiy murojaatlar uchun:\n\nTelegram: @daromadchi_alerts_bot\n\nJavob muddati: 15 ish kuni (ZRU-547 Qonuni talabiga ko'ra)\n\nSo'rov turlari:\n• Ma'lumotlarni ko'rish yoki nusxa olish\n• Ma'lumotlarni o'chirish so'rovi\n• Xavfsizlik muammosi yoki buzilish xabari\n• Huquqiy murojaat yoki shikoyat\n\nRasmiy shikoyat:\nO'zbekiston Respublikasi Raqamli texnologiyalar vazirligi — mdt.uz\nToshkent shahridagi tegishli sudlar`,
      ru: `По всем вопросам, жалобам или юридическим обращениям, связанным с персональными данными:\n\nTelegram: @daromadchi_alerts_bot\n\nСрок ответа: 15 рабочих дней в соответствии с Законом ЗРУ-547\n\nТипы обращений:\n• Просмотр или получение копии данных\n• Запрос на удаление данных\n• Проблема безопасности или уведомление о нарушении\n• Юридическое обращение или жалоба\n\nОфициальная жалоба:\nМинистерство цифровых технологий Республики Узбекистан — mdt.uz\nСоответствующие суды в г. Ташкент`,
      en: `For all data-related enquiries, complaints or legal requests:\n\nTelegram: @daromadchi_alerts_bot\n\nResponse time: 15 working days under Law ZRU-547\n\nTypes of requests:\n• Viewing or obtaining a copy of your data\n• Data deletion request\n• Security issue or breach notification\n• Legal enquiry or complaint\n\nFormal complaint:\nMinistry of Digital Technologies of the Republic of Uzbekistan — mdt.uz\nRelevant courts in Tashkent city`,
    },
  },
]

export default function CompliancePage() {
  const { lang } = useLang()
  const { theme } = useTheme()
  const [open, setOpen] = useState(true)
  const [active, setActive] = useState(0)
  const [flash, setFlash] = useState<number | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const isDark = theme === 'dark'

  useEffect(() => {
    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActive(Number(entry.target.getAttribute('data-idx')))
        })
      },
      { rootMargin: `-${NAVBAR_H + 32}px 0px -55% 0px`, threshold: 0 }
    )
    document.querySelectorAll('[data-idx]').forEach(el => observerRef.current?.observe(el))
    return () => observerRef.current?.disconnect()
  }, [lang])

  function scrollTo(idx: number) {
    const el = document.getElementById(`section-${idx}`)
    if (!el) return
    setActive(idx)
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - NAVBAR_H - 16, behavior: 'smooth' })
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash(idx)
    flashTimerRef.current = setTimeout(() => setFlash(null), 2000)
  }

  const flashBg   = isDark ? 'rgba(131,192,249,0.12)' : 'rgba(2,132,199,0.08)'
  const flashBdr  = 'var(--c1)'
  const flashShadow = isDark ? '0 0 0 3px rgba(131,192,249,0.3)' : '0 0 0 3px rgba(2,132,199,0.3)'

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      <aside
        className="sticky top-[68px] self-start h-[calc(100vh-68px)] flex-shrink-0 border-r transition-all duration-300 overflow-hidden"
        style={{ width: open ? 280 : 60, borderColor: 'var(--border)', background: 'var(--bg-card)' }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-end px-4 py-5 border-b transition-colors hover:text-[var(--c1)]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          {open ? <ChevronLeft className="w-5 h-5 flex-shrink-0" /> : <ChevronRight className="w-5 h-5 flex-shrink-0" />}
        </button>

        <nav className="flex flex-col gap-1.5 p-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 68px - 58px)' }}>
          {SECTIONS.map((s, i) => {
            const label = s.short[lang as 'uz' | 'ru' | 'en'] ?? s.short.en
            const isActive = active === i
            return (
              <button
                key={i}
                onClick={() => scrollTo(i)}
                title={s.heading[lang as 'uz' | 'ru' | 'en'] ?? s.heading.en}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-semibold transition-all whitespace-nowrap overflow-hidden border"
                style={{
                  color: isActive ? 'var(--c1)' : 'var(--text-base)',
                  background: isActive ? (isDark ? 'rgba(131,192,249,0.10)' : 'rgba(2,132,199,0.08)') : 'transparent',
                  borderColor: isActive ? 'var(--c1)' : 'transparent',
                }}
              >
                {open && <>
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{
                      background: isActive ? (isDark ? 'rgba(131,192,249,0.22)' : 'rgba(2,132,199,0.18)') : (isDark ? 'rgba(131,192,249,0.10)' : 'rgba(2,132,199,0.08)'),
                      color: 'var(--c1)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="truncate">{label}</span>
                </>}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 px-5 sm:px-8 lg:px-12 py-10 pb-24 relative">
        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', zIndex: 1 }}>

          {/* Page header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <Link
                href="/"
                className="text-sm font-medium transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--c1)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                ← {tx(lang, 'Главная', 'Bosh sahifa', 'Home')}
              </Link>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-5 text-xs font-semibold uppercase tracking-wider"
              style={{ background: isDark ? 'rgba(131,192,249,0.10)' : 'rgba(2,132,199,0.08)', color: 'var(--c1)' }}>
              {tx(lang, 'Соответствие данных', 'Ma\'lumotlar Muvofiqlik', 'Data Compliance')}
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight" style={{ color: 'var(--text-base)', letterSpacing: '-0.02em' }}>
              {tx(lang,
                'Документ о соответствии данных',
                'Ma\'lumotlar Muvofiqlik Hujjati',
                'Data Compliance Document'
              )}
            </h1>
            <p className="text-base leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
              {tx(lang,
                'Описывает, как Daromadchi обрабатывает персональные данные в соответствии с законодательством Республики Узбекистан.',
                'Daromadchi qanday shaxsiy ma\'lumotlarni O\'zbekiston Respublikasi qonunchiligiga muvofiq qayta ishlashini tasvirlaydi.',
                'Describes how Daromadchi processes personal data in compliance with the laws of the Republic of Uzbekistan.'
              )}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
              {tx(lang, 'Последнее обновление', 'Oxirgi yangilanish', 'Last updated')}: {LAST_UPDATED}
            </p>
          </div>

          {/* Sections */}
          <div className="flex flex-col gap-6">
            {SECTIONS.map((s, i) => {
              const heading = s.heading[lang as 'uz' | 'ru' | 'en'] ?? s.heading.en
              const body    = s.body[lang as 'uz' | 'ru' | 'en'] ?? s.body.en
              const isFlash = flash === i
              return (
                <div
                  key={i}
                  id={`section-${i}`}
                  data-idx={i}
                  className="scroll-mt-24"
                  style={{
                    borderRadius: 16,
                    boxShadow: isFlash
                      ? '0 0 0 2px rgba(131,192,249,0.9), 0 0 28px rgba(131,192,249,0.35)'
                      : active === i
                        ? '0 0 0 1.5px rgba(131,192,249,0.5)'
                        : 'none',
                    transition: 'box-shadow 0.4s ease',
                  }}
                >
                  <div
                    className="w-full p-6 sm:p-8 rounded-2xl"
                    style={{
                      background: active === i ? (isDark ? 'rgba(15,28,48,1)' : 'rgba(230,241,255,1)') : 'var(--bg-card)',
                    }}
                  >
                    <h2 className="text-xl font-bold mb-5" style={{ color: 'var(--text-base)' }}>
                      {heading}
                    </h2>
                    <div
                      className="text-base leading-8 whitespace-pre-line"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {body}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="mt-14 pt-6 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
              © {new Date().getFullYear()} Daromadchi.{' '}
              {tx(lang, 'Все права защищены.', 'Barcha huquqlar himoyalangan.', 'All rights reserved.')}
            </p>
            <div className="flex gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
              <Link href="/privacy" className="hover:text-[var(--c1)] transition-colors">
                {tx(lang, 'Конфиденциальность', 'Maxfiylik', 'Privacy')}
              </Link>
              <Link href="/terms" className="hover:text-[var(--c1)] transition-colors">
                {tx(lang, 'Условия', 'Shartlar', 'Terms')}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

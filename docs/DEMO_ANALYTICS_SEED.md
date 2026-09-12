# Демонстрационные данные для CRM-аналитики

Набор предназначен только для визуальной проверки внутренних маршрутов `/dashboard`, `/results`, `/orders`,
`/clients` и `/catalog`. Значения не являются фактическими продажами, утверждёнными ценами или бизнес-прогнозом.

Seed создаёт 6 клиентов с префиксом `DEMO`, 15 товарных заказов, 27 товарных строк и заполняет отсутствующие пары
розничной и закупочной цены для всех 50 опубликованных товаров. Уже заданные ненулевые цены сохраняются.

Заказы распределены по возрасту от 1 до 150 дней, шести регионам и каналам `instagram`, `google`, `facebook`,
`direct`, `referral`. Присутствуют статусы `NEW`, `PROCESSING`, `DELIVERY`, `DONE` и `CANCELLED`, поэтому видны
текущие статусы, сравнение периодов, выручка, прибыль, средний чек, top products, регионы, источники, часы заказов и
90-дневный прогноз.

| Заказ | Возраст | Статус | Клиент | Состав |
| --- | ---: | --- | --- | --- |
| 01 | 1 день | DONE | DEMO Анна | Solaris ×2, Gonseen ×1 |
| 02 | 3 дня | DONE | DEMO Виктор | Dynamic ×1, Face Soap ×2 |
| 03 | 5 дней | NEW | DEMO Мария | Lord Deodorant ×2 |
| 04 | 7 дней | PROCESSING | DEMO Анна | Body Butter ×1, Conditioner ×1 |
| 05 | 10 дней | DONE | DEMO Ион | Gonseen ×3, Chocoseen ×1 |
| 06 | 14 дней | DELIVERY | DEMO Елена | Lord Parfume ×1, Lord Shower Gel ×2 |
| 07 | 21 день | CANCELLED | DEMO Сергей | Anti-Aging Serum ×1, Eye Care Balm ×1 |
| 08 | 27 дней | DONE | DEMO Виктор | Mineral Shampoo ×2, Conditioner ×2 |
| 09 | 35 дней | DONE | DEMO Мария | Solaris ×1, Dynamic ×1 |
| 10 | 43 дня | DONE | DEMO Ион | Imunseen ×2, Goldseen ×1 |
| 11 | 52 дня | CANCELLED | DEMO Елена | Lady Parfume ×1 |
| 12 | 68 дней | DONE | DEMO Сергей | Face Milk ×2, Night Cream ×1 |
| 13 | 79 дней | DONE | DEMO Анна | Gonseen ×1, Coffee Mix ×2 |
| 14 | 105 дней | DONE | DEMO Сергей | Bath Salts Camomile ×3 |
| 15 | 150 дней | DONE | DEMO Мария | Solaris ×2, Body Butter ×1 |

План можно проверить без подключения к базе:

```powershell
npm run demo:analytics:plan
```

Локальную базу заполняет команда:

```powershell
npm run demo:analytics:seed
```

Удалённая база требует явного флага:

```powershell
npm run demo:analytics:seed -- --allow-remote
```

Повторный запуск удаляет и пересоздаёт только записи с детерминированными `demo-analytics-*` идентификаторами.
Удалить демонстрационные заказы и клиентов можно так:

```powershell
npm run demo:analytics:cleanup -- --allow-remote
```

Cleanup сохраняет каталог цен. Эти значения можно заменить вручную на `/catalog`; автоматического восстановления
предыдущих цен нет.

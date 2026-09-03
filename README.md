# Dr. Nona CRM Moldova

Отдельный репозиторий внутренней CRM, backend заявок и database-модуля Dr. Nona Moldova. Публичный e-catalog находится в [EsinencuP/Dr-Nona](https://github.com/EsinencuP/Dr-Nona).

## Границы проекта

| Папка | Ответственность |
|---|---|
| `src/app/(crm)/` | Dashboard, заявки, клиенты и внутренний каталог |
| `src/app/api/` | Публичный приём заявок и Telegram webhook |
| `server/` | Валидация, application service, Telegram и persistence logic |
| `shared/` | Схема payload и общие Moldova-справочники |
| `database/` | Каноническая Prisma-схема и миграции |
| `src/data/` | Локальная проекция продуктового каталога для проверки slug/SKU |

Рабочие интерфейсные маршруты: `/dashboard`, `/orders`, `/clients`, `/catalog`. Корень перенаправляет на `/dashboard`.

## Локальный запуск

Требуются Node.js 22 (версия закреплена в `.nvmrc`) и npm 10:

```powershell
npm ci
Copy-Item .env.example .env
npm run db:generate
npm run db:push
npm run dev
```

CRM откроется на `http://127.0.0.1:3001`. Локальная SQLite-база создаётся как `database/dev.db` и не отслеживается Git.

## Environment variables

```dotenv
DATABASE_URL="file:./dev.db"
CRM_BASIC_USER=""
CRM_BASIC_PASSWORD=""
CONTACT_ALLOWED_ORIGINS="http://127.0.0.1:4173"
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
TELEGRAM_WEBHOOK_SECRET=""
```

В production `CRM_BASIC_USER` и `CRM_BASIC_PASSWORD` обязательны: без них интерфейс закрывается с `503`. API заявок остаётся доступен только через собственные проверки origin/schema/rate limit, а webhook — через Telegram secret header.

## Синхронизация каталога

После изменения товаров или brand assets в соседнем e-catalog выполните:

```powershell
npm run sync:catalog
```

По умолчанию источник — соседняя папка `../Dr Nona`. Для другого расположения задайте `ECATALOG_ROOT`.

## Проверки

```powershell
npm run db:generate
npm run typecheck
npm run lint
npm run check
npm run test
npm run build
```

Тот же набор автоматически выполняется workflow `.github/workflows/ci.yml` для каждого push и pull request.

## Production

Репозиторий деплоится с корня. Для Vercel необходимо заменить локальную SQLite-конфигурацию постоянной PostgreSQL-базой до production-запуска; файловая SQLite внутри serverless deployment не является надёжным хранилищем.

В e-catalog задайте `CRM_APPLICATIONS_API_URL=https://<crm-domain>/api/applications` и `VITE_CRM_URL=https://<crm-domain>/dashboard`. В CRM задайте production-origin e-catalog в `CONTACT_ALLOWED_ORIGINS`.

## Источник интерфейсного шаблона

Интерфейс основан на MIT-шаблоне [next-shadcn-admin-dashboard-baseui](https://github.com/arhamkhnz/next-shadcn-admin-dashboard-baseui). Оригинальная лицензия сохранена в `LICENSE`.

Архитектурные узлы и зависимости перечислены в [`.graphly/project-graph.json`](.graphly/project-graph.json).

# 🚀 MAX Hackathon - Docker Deployment

Полная Docker-инфраструктура для развёртывания бота и мини-приложения мессенджера MAX.

## 📋 Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Nginx      │────────▶│   Bot        │                 │
│  │   (Port 80)  │  /api   │   (Port 5000)│                 │
│  │   Mini App   │  /webhook│   Node.js    │                 │
│  └──────────────┘         └──────┬───────┘                 │
│                                   │                          │
│                                   ▼                          │
│                          ┌──────────────┐                   │
│                          │   SQLite     │                   │
│                          │  database    │                   │
│                          └──────────────┘                   │
│                                   │                          │
└───────────────────────────────────┼──────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   AI API (External)           │
                    │   https://v3258578...         │
                    │   - /api/text/analyze         │
                    │   - /api/vision/analyze       │
                    └───────────────────────────────┘
```

## 🚀 Быстрый старт

### 1. Клонируйте репозиторий

```bash
git clone <your-repo-url>
cd max-project
```

### 2. Создайте `.env` файл

```bash
cp .env.example .env
```

Отредактируйте `.env` и добавьте ваш токен:

```env
MAX_BOT_TOKEN=your_actual_bot_token_here
AI_API_URL=https://v3258578.hosted-by-vdsina.ru
PORT=5000
```

### 3. Запустите через Docker Compose

```bash
docker-compose up -d --build
```

### 4. Проверьте статус

```bash
docker-compose ps
```

Должно быть:
- `max-bot` (port 5000) - ✅ healthy
- `max-miniapp` (port 80) - ✅ healthy

### 5. Откройте мини-приложение

Откройте в браузере: `http://your-server-ip`

## 📁 Структура проекта

```
max-project/
├── bot/
│   ├── Dockerfile          # Node.js 20 Alpine
│   ├── package.json        # Зависимости бота
│   ├── server.js           # Express сервер + webhook
│   └── database.sqlite     # SQLite (создаётся автоматически)
├── miniapp/
│   ├── Dockerfile          # Nginx Alpine
│   ├── nginx.conf          # Конфиг Nginx
│   ├── index.html          # Главная страница
│   ├── style.css           # Стили
│   └── app.js              # Логика мини-приложения
├── docker-compose.yml      # Оркестрация контейнеров
├── .env.example            # Шаблон переменных окружения
└── README.md               # Этот файл
```

## 🔧 Команды Docker

### Запуск

```bash
# Запуск всех сервисов
docker-compose up -d

# Запуск с пересборкой
docker-compose up -d --build

# Просмотр логов
docker-compose logs -f

# Логи конкретного сервиса
docker-compose logs -f bot
docker-compose logs -f miniapp
```

### Остановка

```bash
# Остановка всех сервисов
docker-compose down

# Остановка с удалением volumes
docker-compose down -v
```

### Перезапуск

```bash
# Перезапуск всех сервисов
docker-compose restart

# Перезапуск конкретного сервиса
docker-compose restart bot
```

### Обновление

```bash
# Пересборка и перезапуск
docker-compose up -d --build
```

## 📡 API Endpoints

### Бот (Port 5000)

- `POST /webhook` - Вебхук от MAX
- `GET /api/incidents` - Список всех заявок
- `GET /api/incidents/user/:userId` - Заявки пользователя
- `GET /health` - Health check

### Мини-приложение (Port 80)

- `GET /` - Главная страница
- `GET /api/*` - Проксируется на бот (через Nginx)
- `POST /webhook` - Проксируется на бот (через Nginx)

## 🗄️ База данных

Используется **SQLite** (согласно требованиям хакатона):

- Файл: `database.sqlite` (создаётся автоматически)
- Таблица: `incidents`
- Поля: `id`, `user_id`, `text`, `photo_url`, `category`, `subcategory`, `status`, `created_at`

### Просмотр данных

```bash
# Войти в контейнер бота
docker-compose exec bot sh

# Открыть SQLite
sqlite3 database.sqlite

# Посмотреть заявки
SELECT * FROM incidents;

# Выйти
.exit
exit
```

## 🎯 Тестирование

### 1. Проверка бота

```bash
curl http://localhost:5000/health
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "database": "sqlite",
  "incidents_count": 0
}
```

### 2. Проверка мини-приложения

Откройте `http://localhost` в браузере.

### 3. Тест вебхука

```bash
curl -X POST http://localhost:5000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "update_type": "message_created",
    "message": {
      "sender": {"user_id": "test_user"},
      "body": {"text": "Течёт труба в подвале"}
    }
  }'
```

### 4. Тест AI API

```bash
curl -X POST https://v3258578.hosted-by-vdsina.ru/api/text/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "течёт труба в подвале"}'
```

## 🔐 Безопасность

- ✅ HTTPS через внешний прокси (настраивается отдельно)
- ✅ SQLite (локальная БД, нет внешних подключений)
- ✅ Environment variables для секретов
- ✅ Nginx security headers
- ✅ Health checks для мониторинга

## 📊 Мониторинг

### Логи

```bash
# Все логи
docker-compose logs -f

# Только бот
docker-compose logs -f bot

# Только мини-приложение
docker-compose logs -f miniapp
```

### Статистика

```bash
# Использование ресурсов
docker stats

# Список контейнеров
docker-compose ps
```

## 🐛 Troubleshooting

### Бот не запускается

```bash
# Проверьте логи
docker-compose logs bot

# Перезапустите
docker-compose restart bot
```

### Мини-приложение недоступно

```bash
# Проверьте, что бот работает
docker-compose ps

# Проверьте логи Nginx
docker-compose logs miniapp
```

### SQLite ошибки

```bash
# Удалите базу и перезапустите
docker-compose down -v
docker-compose up -d
```

## 📝 Примечания

- **SQLite** используется вместо PostgreSQL из-за лимита RAM (2 ГБ)
- **Mock-интеграция** - это честное указание в README (FAQ п. 13, 15)
- **AI API** работает на внешнем сервере (HTTPS)
- **MAX Bot Token** нужно получить от @MasterBot

## 🎓 Для хакатона

Этот проект демонстрирует:
- ✅ Интеграцию с MAX через вебхуки
- ✅ AI-классификацию через внешний API
- ✅ Docker-оркестрацию
- ✅ Mobile-first мини-приложение
- ✅ SQLite для хранения данных
- ✅ Production-ready конфигурацию

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи: `docker-compose logs`
2. Проверьте health: `curl http://localhost:5000/health`
3. Перезапустите: `docker-compose restart`

---

**Удачи на хакатоне!** 🚀

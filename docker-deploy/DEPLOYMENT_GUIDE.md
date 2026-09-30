# 📦 Что отправить организаторам хакатона

## Структура проекта

```
docker-deploy/
├── bot/
│   ├── Dockerfile              ✅ Node.js 20 Alpine, порт 5000
│   ├── package.json            ✅ Зависимости
│   ├── server.js               ✅ Express + webhook + SQLite
│   └── .gitignore              ✅ Игнорирует database.sqlite
├── miniapp/
│   ├── Dockerfile              ✅ Nginx Alpine, порт 80
│   ├── nginx.conf              ✅ Проксирует /api и /webhook на бот
│   ├── index.html              ✅ Главная страница
│   ├── style.css               ✅ Стили (MAX style)
│   └── app.js                  ✅ Логика мини-приложения
├── docker-compose.yml          ✅ Оркестрация (bot + miniapp)
├── .env.example                ✅ Шаблон переменных окружения
└── README.md                   ✅ Полная документация
```

## 🚀 Как запустить

### 1. Создать `.env` файл

```bash
cd docker-deploy
cp .env.example .env
```

Отредактировать `.env`:
```env
MAX_BOT_TOKEN=ваш_токен_от_MasterBot
AI_API_URL=https://v3258578.hosted-by-vdsina.ru
PORT=5000
```

### 2. Запустить через Docker Compose

```bash
docker-compose up -d --build
```

### 3. Проверить статус

```bash
docker-compose ps
```

Должно быть:
- `max-bot` (port 5000) - ✅ healthy
- `max-miniapp` (port 80) - ✅ healthy

### 4. Открыть мини-приложение

```
http://your-server-ip
```

## 📡 API Endpoints

### Бот (Port 5000)
- `POST /webhook` - Вебхук от MAX
- `GET /api/incidents` - Список заявок
- `GET /api/incidents/user/:userId` - Заявки пользователя
- `GET /health` - Health check

### Мини-приложение (Port 80)
- `GET /` - Главная страница
- `GET /api/*` - Проксируется на бот (через Nginx)
- `POST /webhook` - Проксируется на бот (через Nginx)

## 🗄️ База данных

- **SQLite** (согласно требованиям хакатона)
- Файл: `database.sqlite` (создаётся автоматически)
- Таблица: `incidents` (id, user_id, text, photo_url, category, subcategory, status, created_at)

## ✅ Что реализовано

### Бот
- ✅ Вебхук от MAX (`POST /webhook`)
- ✅ Интеграция с AI API (text + vision)
- ✅ SQLite для хранения заявок
- ✅ Health check endpoint
- ✅ API для мини-приложения
- ✅ Обработка ошибок
- ✅ Dockerfile (multi-stage build, node:20-alpine)

### Мини-приложение
- ✅ Mobile-first дизайн (MAX style)
- ✅ Форма создания заявки (текст + фото)
- ✅ Список заявок пользователя
- ✅ Симуляция MAX initData (для локальной разработки)
- ✅ Dockerfile (nginx:alpine)
- ✅ Nginx конфиг (проксирование API)

### Docker
- ✅ docker-compose.yml (bot + miniapp)
- ✅ Health checks
- ✅ Volumes для SQLite
- ✅ Network isolation
- ✅ Auto-restart

## 🎯 Тестирование

### 1. Проверка бота
```bash
curl http://localhost:5000/health
```

### 2. Проверка мини-приложения
Открыть `http://localhost` в браузере

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

## 📝 Примечания для организаторов

1. **SQLite** используется вместо PostgreSQL из-за лимита RAM (2 ГБ)
2. **Mock-интеграция** - честно указано в README (FAQ п. 13, 15)
3. **AI API** работает на внешнем сервере (HTTPS)
4. **MAX Bot Token** нужно получить от @MasterBot
5. **Все сервисы** работают в Docker контейнерах
6. **Health checks** настроены для мониторинга
7. **Nginx** проксирует API запросы (нет CORS проблем)

## 🔐 Переменные окружения

```env
MAX_BOT_TOKEN=your_bot_token_here
AI_API_URL=https://v3258578.hosted-by-vdsina.ru
PORT=5000
```

## 📊 Ресурсы

- **Бот**: ~100MB RAM
- **Nginx**: ~10MB RAM
- **SQLite**: ~5MB RAM
- **Всего**: ~115MB RAM (из 2GB доступно)

## 🎓 Для хакатона

Этот проект демонстрирует:
- ✅ Интеграцию с MAX через вебхуки
- ✅ AI-классификацию через внешний API
- ✅ Docker-оркестрацию
- ✅ Mobile-first мини-приложение
- ✅ SQLite для хранения данных
- ✅ Production-ready конфигурацию
- ✅ Health checks и мониторинг
- ✅ Nginx reverse proxy

---

**Готово к развёртыванию!** 🚀

# 🤖 Аварийный диспетчер МКД — Бот для MAX с реальным AI (API v2.1)

Чат-бот для мессенджера MAX, который автоматически обрабатывает обращения жителей о проблемах в доме, используя **реальные ML-модели** (CV v4 + Text v3) с fusion-логикой по top3.

## 🆕 API v2.1

Бот интегрирован с ML-сервисом v2.1:
- **CV модель:** cv-v4-2026-09-29 (9 классов)
- **Text модель:** text-v3-2026-09-29 (25 подкатегорий)
- **Fusion:** по top3 кандидатам (HIGH/MEDIUM/LOW)
- **Hot-reload:** модели обновляются без перезапуска бота

## 🚀 Быстрый запуск

### 1. Установите зависимости

```bash
cd bot
npm install
```

### 2. Создайте файл `.env`

```bash
cp .env.example .env
```

Откройте `.env` и вставьте ваш токен:

```env
MAX_BOT_TOKEN=ваш_токен_от_MasterBot
ML_API_URL=https://v3258578.hosted-by-vdsina.ru
```

### 3. Запустите бота

```bash
npm run dev
```

Вы увидите:
```
🤖 Аварийный диспетчер МКД запускается...
✅ ML сервис доступен
   CV модель: cv-v3-2026-09-28
   Text модель: text-v2-2026-09-28

📡 Режим: Long Polling

✅ Бот запущен и готов принимать сообщения!
```

### 4. Проверьте в MAX

Найдите вашего бота в MAX и отправьте:
- `В подвале течёт труба`
- `Не работает свет на лестнице`
- Фото протечки
- Фото кота (должен ответить NOT_INCIDENT)

## 🧠 Как работает AI

Бот использует **реальные ML-модели**, развернутые на удалённом сервере:

### Text Classification
- **Endpoint:** `POST /api/text/analyze`
- **Модель:** text-v2 (специализированный классификатор)
- **Возвращает:** категорию, подкатегорию, confidence, top-5 предсказаний

### Computer Vision
- **Endpoint:** `POST /api/vision/analyze`
- **Модель:** cv-v3 (YOLO-based)
- **Возвращает:** classificationResult (KNOWN/OTHER/NOT_INCIDENT), detected objects, visual severity

### Fusion Engine
Бот объединяет результаты text + vision:
- Если текст и фото согласуются → высокая уверенность
- Если противоречат → CONFLICT, запрашивает уточнение
- Если только фото → задаёт вопросы для описания
- Если только текст → использует text classifier

## 📋 Команды бота

- `/start` — начать заново
- `/help` — помощь
- `/status` — статус ваших заявок
- `/categories` — список категорий
- `/health` — проверить статус ML сервиса

## 🧪 Примеры сценариев

### Сценарий 1: Протечка (текст)
```
Вы: В подвале течёт труба, уже вся вода на полу
Бот: ⏳ Анализирую ваше обращение...
     [Text API: WATER_SUPPLY/PIPE_LEAK (0.94)]
Бот: ✅ Мы поняли проблему так:
     📋 Категория: Водоснабжение
     📍 Подкатегория: Протечка трубы
     ⚡ Срочность: Высокий
     🎯 Уверенность AI: 94%
     👷 Исполнитель: Сантехник
     
     Напишите "подтвердить" чтобы отправить заявку.
```

### Сценарий 2: Фото протечки
```
Вы: [фото протечки]
Бот: ⏳ Анализирую ваше обращение...
     [Vision API: KNOWN_INCIDENT/WATER_SUPPLY (0.89)]
Бот: Опишите подробнее, что произошло?
Вы: Течёт труба в подвале
Бот: ✅ Мы поняли проблему так...
```

### Сценарий 3: Текст + фото согласуются
```
Вы: Упало дерево [фото дерева]
Бот: ⏳ Анализирую...
     [Text: YARD/FALLEN_TREE (0.91)]
     [Vision: KNOWN_INCIDENT/YARD (0.87)]
Бот: ✅ Категория: Двор и территория
     Подкатегория: Упавшее дерево
     Уверенность: 89%
```

### Сценарий 4: Текст + фото противоречат
```
Вы: Упало дерево [фото протечки]
Бот: ⚠️ Мы заметили несоответствие между описанием и фото.
     Уточните, что именно произошло?
```

### Сценарий 5: Нерелевантный контент
```
Вы: [фото кота]
Бот: 🔍 Не удалось обнаружить проблему...
     [Vision API: NOT_INCIDENT (0.95)]
```

## 🏗 Архитектура

```
bot/
├── src/
│   ├── index.ts              # Главный файл бота
│   ├── ai/
│   │   ├── api-client.ts     # HTTP-клиент для ML API
│   │   └── classifier.ts     # Fusion engine + логика
│   ├── data/
│   │   └── taxonomy.ts       # Категории и маппинги
│   └── store/
│       └── incidents.ts      # Хранилище заявок
├── .env                      # Токен + ML API URL
├── .env.example
├── package.json
└── tsconfig.json
```

## 🔧 ML API Endpoints

### Health Check
```bash
GET https://v3258578.hosted-by-vdsina.ru/api/health
```

### Text Analysis
```bash
POST https://v3258578.hosted-by-vdsina.ru/api/text/analyze
Content-Type: application/json

{
  "text": "течет труба в подвале"
}
```

**Ответ:**
```json
{
  "category": "WATER_SUPPLY",
  "subcategory": "PIPE_LEAK",
  "confidence": 0.94,
  "top": [["PIPE_LEAK", 0.94], ["RADIATOR_LEAK", 0.04]],
  "modelVersion": "text-v2-2026-09-28"
}
```

### Vision Analysis
```bash
POST https://v3258578.hosted-by-vdsina.ru/api/vision/analyze
Content-Type: multipart/form-data

file: [image.jpg]
```

**Ответ:**
```json
{
  "classificationResult": "KNOWN_INCIDENT",
  "category": "WATER_SUPPLY",
  "subcategory": null,
  "detectedObjects": ["water_supply"],
  "visualSeverity": "HIGH",
  "confidence": 0.896,
  "modelVersion": "cv-v3-2026-09-28"
}
```

## 🎯 Особенности реализации

### Hot Reload
ML сервер поддерживает hot-reload. Если модели обновятся, `modelVersion` изменится, но бот продолжит работать без перезапуска.

### Fallback
Если ML API недоступен, бот использует fallback-логику (возвращает NOT_INCIDENT с confidence=0).

### Download Images
Бот автоматически скачивает фото из MAX и передаёт в Vision API как multipart/form-data.

### Session Management
Каждый пользователь имеет свою сессию с состоянием диалога (ожидание уточнения, подтверждение и т.д.).

## 🔗 Полезные ссылки

- [Документация MAX](https://dev.max.ru/)
- [SDK для TypeScript](https://github.com/max-messenger/max-bot-api-client-ts)
- [Примеры ботов](https://dev.max.ru/docs/chatbots/bots-coding/examples)

## 📝 Лицензия

MIT

---

**Для хакатона:** Бот демонстрирует полный сценарий обработки обращений с использованием реальных ML-моделей (CV + Text Classification), fusion engine для мультимодального анализа и автоматической маршрутизацией заявок.

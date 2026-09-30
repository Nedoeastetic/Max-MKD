# 🤖 Адаптация «Аварийного диспетчера» под бота в MAX

## Что такое MAX?

**MAX** — российский мессенджер от VK (бывший Mail.ru). Платформа позволяет создавать:
- **Чат-ботов** — диалоговые сценарии, которые принимают текст, фото, команды
- **Мини-приложения** — веб-приложения, открывающиеся внутри мессенджера (как Telegram Mini Apps)

Для хакатона нужна связка: **чат-бот + мини-приложение**.

---

## 📋 Пошаговый план создания бота

### Шаг 1. Получить верифицированный профиль

Бота в MAX могут создавать только:
- Юридические лица
- ИП
- Самозанятые (резиденты РФ)

**Где:** [business.max.ru](https://business.max.ru) → пройти верификацию.

> ⚠️ Для хакатона можно использовать учебный/партнёрский профиль, если организаторы предоставляют.

### Шаг 2. Создать бота

**Вариант A — через Master Bot (быстрее для тестов):**
1. Открыть в MAX диалог с [@MasterBot](https://max.ru/masterbot)
2. Следовать инструкциям
3. Получить токен бота

**Вариант B — через кабинет:**
1. [business.max.ru](https://business.max.ru) → «Чат-боты» → «Создать»
2. Заполнить карточку бота
3. Пройти модерацию
4. Получить токен

### Шаг 3. Настроить уведомления (webhook)

Бот должен получать события от MAX. Два варианта:
- **Webhook** (рекомендуется для production) — MAX сам шлёт POST-запросы на ваш сервер
- **Long Polling** (для разработки) — бот сам опрашивает сервер

```bash
# Пример настройки webhook
POST https://platform-api2.max.ru/subscriptions
Authorization: <BOT_TOKEN>
{
  "url": "https://your-server.com/webhook/max",
  "update_types": ["message_created", "bot_started", "callback"]
}
```

### Шаг 4. Подключить мини-приложение

В кабинете бота указать URL мини-приложения:
- Должен быть HTTPS
- До 1024 символов
- Приложение открывается внутри MAX

---

## 🏗 Архитектура реального бота

```
┌──────────────────────────────────────────────────────────────┐
│                     MAX Messenger                             │
│  ┌──────────────┐              ┌──────────────────────┐      │
│  │  Чат-бот     │              │  Мини-приложение     │      │
│  │  (диалог)    │              │  (интерфейс мастера) │      │
│  └──────┬───────┘              └──────────┬───────────┘      │
└─────────┼──────────────────────────────────┼─────────────────┘
          │ webhook / API                    │ WebView
          ▼                                  ▼
┌──────────────────────────────────────────────────────────────┐
│                    Backend API (Node.js)                      │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │ MAX Bot     │  │ Incident     │  │ Mini App        │    │
│  │ Controller  │  │ Service      │  │ API             │    │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘    │
│         │                │                    │              │
│         └────────┬───────┴────────────────────┘              │
│                  ▼                                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              AI Pipeline                             │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │
│  │  │  Text    │  │  Vision  │  │  Fusion Engine   │  │    │
│  │  │Classifier│  │  (YOLO)  │  │                  │  │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                  │                                           │
│                  ▼                                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Database (PostgreSQL)                   │    │
│  │  Users • Incidents • Masters • StatusHistory        │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 💻 Пример кода бота на TypeScript

### Установка

```bash
npm init -y
npm install @maxhub/max-bot-api express
npm install -D typescript @types/node @types/express tsx
```

### Базовый бот (`src/bot.ts`)

```typescript
import { Bot } from '@maxhub/max-bot-api';
import express from 'express';

const bot = new Bot(process.env.MAX_BOT_TOKEN!);
const app = express();
app.use(express.json());

// Приветствие при старте
bot.on('bot_started', async (ctx) => {
  await ctx.reply(
    '🏠 Здравствуйте! Я — Аварийный диспетчер.\n\n' +
    'Отправьте фото или опишите проблему в доме, ' +
    'и я помогу передать её исполнителю.'
  );
});

// Обработка текстовых сообщений
bot.on('message_created', async (ctx) => {
  const message = ctx.message;
  
  // Если это фото
  if (message.attachments?.some(a => a.type === 'image')) {
    await handleImageMessage(ctx);
    return;
  }
  
  // Если это текст
  if (message.body?.text) {
    await handleTextMessage(ctx, message.body.text);
    return;
  }
});

async function handleTextMessage(ctx: any, text: string) {
  // 1. Показать что идёт анализ
  await ctx.reply('⏳ Анализирую ваше обращение...');
  
  // 2. Запустить AI-анализ
  const result = await analyzeText(text);
  
  // 3. Обработать результат
  if (result.classificationResult === 'NOT_INCIDENT') {
    await ctx.reply(
      '🔍 Не удалось обнаружить проблему, связанную с домом.\n' +
      'Отправьте фото повреждения или опишите проблему.'
    );
    return;
  }
  
  // 4. Если нужны уточнения
  if (result.recommendedQuestions.length > 0) {
    const q = result.recommendedQuestions[0];
    await ctx.reply(q.text, {
      keyboard: q.options ? buildKeyboard(q.options) : undefined
    });
    return;
  }
  
  // 5. Показать карточку заявки
  await showIncidentCard(ctx, result);
}

async function handleImageMessage(ctx: any) {
  await ctx.reply('⏳ Анализирую фотографию...');
  
  // Скачать фото из MAX
  const imageUrl = await downloadAttachment(ctx.message);
  
  // Отправить в Vision API
  const visionResult = await analyzeImage(imageUrl);
  
  // Обработать результат (аналогично тексту)
  // ...
}

// Запуск
bot.start();
console.log('🤖 Бот запущен');
```

### Обработка callback-кнопок

```typescript
bot.on('callback', async (ctx) => {
  const data = ctx.callbackData;
  
  if (data === 'confirm_incident') {
    // Пользователь подтвердил заявку
    const incident = await createIncident(ctx.session);
    await ctx.editMessage(
      `✅ Заявка #${incident.id} создана!\n` +
      `Ожидайте, мастер возьмёт её в работу.`
    );
    
    // Уведомить мастеров
    await notifyMasters(incident);
  }
  
  if (data === 'master_take_INC-001') {
    // Мастер взял заявку
    await assignMaster(ctx.user.id, 'INC-001');
    await ctx.reply('✅ Вы взяли заявку в работу');
    
    // Уведомить жителя
    await notifyResident('INC-001', 'ASSIGNED');
  }
});

function buildKeyboard(options: string[]) {
  return {
    inline_keyboard: [
      options.map(opt => ({
        text: opt,
        callback_data: `answer_${opt}`
      }))
    ]
  };
}
```

### Мини-приложение для мастера

```typescript
// Express endpoint для мини-приложения
app.get('/master-app', (req, res) => {
  // MAX передаёт данные пользователя через initData
  res.sendFile(path.join(__dirname, 'public/master-app.html'));
});

// API для мини-приложения
app.get('/api/incidents', authenticateMaster, async (req, res) => {
  const incidents = await getAvailableIncidents(req.master.workerType);
  res.json(incidents);
});

app.post('/api/incidents/:id/take', authenticateMaster, async (req, res) => {
  await assignMaster(req.master.id, req.params.id);
  res.json({ success: true });
});
```

---

## 🔄 Как адаптировать текущий прототип

### Что уже готово и переносится 1-в-1:

| Компонент | Статус | Действие |
|-----------|--------|----------|
| Типы данных (`types.ts`) | ✅ Готово | Использовать как есть |
| Таксономия (`categories.ts`) | ✅ Готово | Использовать как есть |
| Mock-данные (`mockData.ts`) | ⚠️ Заменить | Подключить реальную БД |
| AI-движок (`aiEngine.ts`) | ⚠️ Заменить | Подключить реальные модели |
| Логика чата (`ResidentChat`) | 🔄 Адаптировать | Превратить в обработчики бота |
| Интерфейс мастера | 🔄 Адаптировать | Сделать мини-приложением |

### Что нужно сделать:

1. **Создать backend-сервер** (Node.js + Express/Fastify)
2. **Подключить MAX Bot API** через `@maxhub/max-bot-api`
3. **Заменить симуляцию AI** на реальные модели:
   - Text Classifier → HuggingFace / Yandex Cloud / GigaChat
   - Vision → YOLO через API (Yandex Vision / AWS Rekognition)
4. **Подключить базу данных** (PostgreSQL)
5. **Развернуть мини-приложение** на HTTPS-хостинге
6. **Настроить webhook** от MAX

---

## 🧠 Замена AI-движка на реальные модели

### Вариант 1: Yandex Cloud (рекомендуется для РФ)

```typescript
// Text classification через Yandex Cloud
async function analyzeTextReal(text: string) {
  const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${YANDEX_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      modelUri: `gpt://${YANDEX_FOLDER_ID}/yandexgpt-lite`,
      messages: [
        { role: 'system', text: CLASSIFICATION_PROMPT },
        { role: 'user', text: text }
      ]
    })
  });
  
  const data = await response.json();
  return parseClassificationResult(data);
}

// Vision через Yandex Vision API
async function analyzeImageReal(imageUrl: string) {
  const base64 = await imageToBase64(imageUrl);
  const response = await fetch('https://vision.api.cloud.yandex.net/vision/v1/analyze', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${YANDEX_TOKEN}` },
    body: JSON.stringify({
      analyze_specs: [{
        mime: 'image/jpeg',
        content: base64,
        features: [{ type: 'CLASSIFICATION' }]
      }]
    })
  });
  
  return parseVisionResult(await response.json());
}
```

### Вариант 2: GigaChat / YandexGPT для классификации

```typescript
const CLASSIFICATION_PROMPT = `
Ты — классификатор обращений жителей МКД.
Проанализируй текст и верни JSON:
{
  "classificationResult": "KNOWN_INCIDENT" | "OTHER_INCIDENT" | "NOT_INCIDENT",
  "category": string | null,
  "subcategory": string | null,
  "confidence": number (0-1),
  "urgencySignals": string[],
  "entities": string[]
}

Категории: WATER_SUPPLY, ELECTRICITY, HEATING, CLEANING, YARD, DOOR, ELEVATOR, ROOF
`;
```

### Вариант 3: Локальные модели (для хакатона)

```typescript
// Transformers.js — запуск моделей прямо в Node.js
import { pipeline } from '@xenova/transformers';

const classifier = await pipeline('text-classification', 'your-model');
const result = await classifier('В подвале течёт труба');
```

---

## 📱 Структура мини-приложения

Мини-приложение — это обычный веб-сайт, который открывается внутри MAX.

```
public/
├── master-app/
│   ├── index.html      # Точка входа
│   ├── app.js          # Логика
│   └── styles.css      # Стили
└── resident-app/
    └── index.html      # Опционально: карточка заявки для жителя
```

### Инициализация в мини-приложении

```javascript
// MAX передаёт данные через URL-параметры
const initData = new URLSearchParams(window.location.search);
const userId = initData.get('user_id');
const chatId = initData.get('chat_id');

// Отправка данных обратно в бота
window.MaxApp?.sendData({
  type: 'master_took_incident',
  incidentId: 'INC-001',
  masterId: userId
});
```

---

## 🐳 Docker для продакшена

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

```yaml
# compose.yaml
services:
  bot:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MAX_BOT_TOKEN=${MAX_BOT_TOKEN}
      - DATABASE_URL=postgresql://user:pass@db:5432/incidents
      - YANDEX_TOKEN=${YANDEX_TOKEN}
    depends_on:
      - db
  
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: incidents
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

## ✅ Чек-лист для хакатона

- [ ] Верифицированный профиль в MAX
- [ ] Создан бот, получен токен
- [ ] Настроен webhook (или Long Polling для демо)
- [ ] Backend принимает сообщения от MAX
- [ ] AI-классификация работает (хотя бы через LLM API)
- [ ] Бот отвечает на текст
- [ ] Бот отвечает на фото
- [ ] Бот задаёт уточняющие вопросы
- [ ] Бот показывает карточку заявки
- [ ] Бот создаёт заявку в БД
- [ ] Мини-приложение открывается из бота
- [ ] Мастер видит заявки в мини-приложении
- [ ] Мастер может взять заявку
- [ ] Житель получает уведомление о статусе
- [ ] Edge cases: кот → NOT_INCIDENT, неизвестное → OTHER_INCIDENT

---

## 🔗 Полезные ссылки

- [Документация MAX для разработчиков](https://dev.max.ru/)
- [API ботов MAX](https://dev.max.ru/docs-api)
- [Создание бота](https://dev.max.ru/docs/chatbots/bots-create)
- [SDK для TypeScript](https://github.com/max-messenger/max-bot-api-client-ts)
- [Примеры ботов](https://dev.max.ru/docs/chatbots/bots-coding/examples)
- [OpenAPI спецификация](https://github.com/max-messenger/api-schema)
- [Конструктор без кода](https://dev.max.ru/docs/chatbots/bots-nocode)
- [Master Bot](https://max.ru/masterbot)

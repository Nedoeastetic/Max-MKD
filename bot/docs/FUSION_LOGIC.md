# 🔗 Fusion Logic — Объединение результатов CV и Text (API v2.1)

## Принцип работы

Fusion engine объединяет результаты компьютерного зрения (CV) и текстового анализа (Text) для определения финальной категории обращения.

## Правила fusion (по убыванию уверенности)

### 1. HIGH — Полное совпадение
**Условие:** `category фото == category текста`

**Действие:** Создаём заявку сразу с высокой уверенностью.

**Пример:**
- Фото: `WATER_SUPPLY` (confidence: 0.88)
- Текст: `WATER_SUPPLY/PIPE_LEAK` (confidence: 0.94)
- **Результат:** `WATER_SUPPLY`, fusion level = HIGH

---

### 2. MEDIUM — Частичное совпадение
**Условие:** `category текста встречается в top3 фото` **ИЛИ** `category фото встречается в top3 текста`

**Действие:** Создаём заявку с пометкой `needs_review = true` (требует проверки оператором).

**Пример:**
- Фото top3: `ELECTRICITY (0.45)`, `WATER_SUPPLY (0.38)`, `NOT_INCIDENT (0.17)`
- Текст: `WATER_SUPPLY/PIPE_LEAK` (confidence: 0.92)
- **Результат:** `WATER_SUPPLY`, fusion level = MEDIUM, needs_review = true

**Почему MEDIUM?**
Категория текста (`WATER_SUPPLY`) найдена в top3 фото (вторая позиция), но не является top-1. Это означает, что модель не уверена на 100%, но текст явно указывает на водоснабжение.

---

### 3. LOW — Нет пересечений
**Условие:** Категории не пересекаются ни в top-1, ни в top3.

**Действие:** Запрашиваем уточнение у пользователя (уточняющие вопросы).

**Пример:**
- Фото: `ELECTRICITY` (confidence: 0.80)
- Текст: `WATER_SUPPLY/PIPE_LEAK` (confidence: 0.94)
- **Результат:** fusion level = LOW, запрашиваем уточнение

**Что спрашиваем:**
```
⚠️ Мы заметили несоответствие между описанием и фотографией.
Уточните, пожалуйста, что именно произошло?
```

---

## Алгоритм fusion (псевдокод)

```python
def fuse(cv_result, text_result):
    cv_cat = cv_result.get("category")
    tx_cat = text_result.get("category")
    
    # Извлекаем категории из top3
    cv_cats = [x["category"] for x in cv_result["top3"] if x["category"]]
    tx_cats = [x["category"] for x in text_result["top3"] if x["category"]]
    
    # Правило 1: HIGH — полное совпадение
    if cv_cat and tx_cat and cv_cat == tx_cat:
        return tx_cat, "HIGH", "CV и текст согласны (top-1)", False
    
    # Правило 2: MEDIUM — категория текста в top3 фото
    if tx_cat and tx_cat in cv_cats:
        return tx_cat, "MEDIUM", "Категория текста в top3 фото", True
    
    # Правило 3: MEDIUM — категория фото в top3 текста
    if cv_cat and cv_cat in tx_cats:
        return cv_cat, "MEDIUM", "Категория фото в top3 текста", True
    
    # Правило 4: LOW — нет пересечений
    return None, "LOW", "Нет пересечения, нужно уточнение", False
```

---

## Реальная реализация (TypeScript)

См. файл: `bot/src/ai/classifier.ts` → функция `handleTextAndImage()`

```typescript
// Извлекаем категории из top3
const cvCat = visionResult.category;
const txCat = textResult.category;
const cvCats = visionResult.top3?.map(x => x.category).filter(c => c !== null) || [];
const txCats = textResult.top3?.map(x => x.category).filter(c => c !== null) || [];

// Правило 1: HIGH
if (cvCat && txCat && cvCat === txCat) {
  finalCategory = txCat;
  fusionLevel = 'HIGH';
  fusionReason = 'CV и текст согласны (top-1)';
}
// Правило 2: MEDIUM
else if (txCat && cvCats.includes(txCat)) {
  finalCategory = txCat;
  fusionLevel = 'MEDIUM';
  fusionReason = 'Категория текста в top3 фото';
  needsReview = true;
}
// Правило 3: MEDIUM
else if (cvCat && txCats.includes(cvCat)) {
  finalCategory = cvCat;
  fusionLevel = 'MEDIUM';
  fusionReason = 'Категория фото в top3 текста';
  needsReview = true;
}
// Правило 4: LOW
else {
  fusionLevel = 'LOW';
  fusionReason = 'Нет пересечения, нужно уточнение';
}
```

---

## Примеры из жизни

### Пример 1: Протечка (HIGH)
**Вход:**
- Фото: протечка трубы → `WATER_SUPPLY` (0.88)
- Текст: "В подвале течёт труба" → `WATER_SUPPLY/PIPE_LEAK` (0.94)

**Fusion:**
- cv_cat = `WATER_SUPPLY`
- tx_cat = `WATER_SUPPLY`
- **Результат:** `WATER_SUPPLY`, level = HIGH, needs_review = false

**Действие:** Создаём заявку сразу.

---

### Пример 2: Электричество vs Вода (MEDIUM)
**Вход:**
- Фото: спорное изображение → top3: `ELECTRICITY (0.45)`, `WATER_SUPPLY (0.38)`, `NOT_INCIDENT (0.17)`
- Текст: "Течёт труба в подвале" → `WATER_SUPPLY/PIPE_LEAK` (0.92)

**Fusion:**
- cv_cat = `ELECTRICITY` (top-1)
- tx_cat = `WATER_SUPPLY`
- cv_cats = [`ELECTRICITY`, `WATER_SUPPLY`, `null`]
- **Проверка:** `tx_cat (WATER_SUPPLY) in cv_cats` → **TRUE**
- **Результат:** `WATER_SUPPLY`, level = MEDIUM, needs_review = true

**Действие:** Создаём заявку в водоснабжение, но помечаем для ревью.

**Почему не конфликт?**
По старому контракту (без top3) был бы конфликт (ELECTRICITY vs WATER_SUPPLY). По новому контракту — MEDIUM, так как WATER_SUPPLY найден в кандидатах фото.

---

### Пример 3: Полное несоответствие (LOW)
**Вход:**
- Фото: электрический щиток → `ELECTRICITY` (0.80)
- Текст: "Упало дерево во дворе" → `YARD/FALLEN_TREE` (0.91)

**Fusion:**
- cv_cat = `ELECTRICITY`
- tx_cat = `YARD`
- cv_cats = [`ELECTRICITY`, ...]
- tx_cats = [`YARD`, ...]
- **Проверка:** `tx_cat (YARD) in cv_cats` → **FALSE**
- **Проверка:** `cv_cat (ELECTRICITY) in tx_cats` → **FALSE**
- **Результат:** level = LOW

**Действие:** Запрашиваем уточнение у пользователя.

---

## Логирование

Каждая заявка логирует fusion-информацию:

```
🔗 Fusion [HIGH]: CV и текст согласны (top-1)
🔗 Fusion [MEDIUM]: Категория текста в top3 фото
⚠️ Заявка INC-001 требует ревью (fusion MEDIUM)
🔗 Fusion [LOW]: Нет пересечения, нужно уточнение
```

---

## Структура данных заявки

```typescript
interface Incident {
  // ... основные поля ...
  
  // Fusion metadata (API v2.1)
  fusionLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  fusionReason?: string;
  needsReview?: boolean;
  modelVersions?: { 
    cv?: string;   // например: "cv-v4-2026-09-29"
    text?: string; // например: "text-v3-2026-09-29"
  };
}
```

---

## Преимущества нового подхода

### Старый подход (без top3)
- Бинарная логика: совпадение / конфликт
- Жёсткие конфликты при малейшем расхождении
- Много false negatives (отказы от создания заявок)

### Новый подход (с top3)
- Гибкая логика: HIGH / MEDIUM / LOW
- Учёт "второго мнения" модели
- Меньше конфликтов, больше успешных заявок
- Возможность ревью для спорных случаев

---

## Тестирование

Запустите тесты fusion-логики:

```bash
cd bot
npm run test:api
```

Пример вывода:
```
📝 Text [text-v3-2026-09-29]: WATER_SUPPLY/PIPE_LEAK conf=0.982
  Top3:
    1. PIPE_LEAK (WATER_SUPPLY) - 98.2%
    2. NO_WATER (WATER_SUPPLY) - 0.4%
    3. ROOF_LEAK (ROOF) - 0.2%

📷 Vision [cv-v4-2026-09-29]: KNOWN_INCIDENT (WATER_SUPPLY) conf=0.880
  Top3:
    1. water_supply (WATER_SUPPLY) - 88.0%
    2. heating (HEATING) - 8.0%
    3. roof (ROOF) - 4.0%

🔗 Fusion [HIGH]: CV и текст согласны (top-1)
✅ Заявка INC-001 создана
```

---

## Ссылки

- [Документация API v2.1](https://v3258578.hosted-by-vdsina.ru/)
- [Веб-тестер](https://v3258578.hosted-by-vdsina.ru/) — интерактивная проверка fusion
- [Код fusion engine](bot/src/ai/classifier.ts)

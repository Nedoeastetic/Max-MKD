#!/usr/bin/env tsx
/**
 * Тестовый скрипт для проверки ML API
 * Запуск: npm run test:api
 */

import 'dotenv/config';
import { checkHealth, analyzeText, analyzeImage } from './src/ai/api-client.js';
import fs from 'fs';

const BASE_URL = process.env.ML_API_URL || 'https://v3258578.hosted-by-vdsina.ru';

async function testHealth() {
  console.log('🔍 Проверка здоровья ML API...\n');
  try {
    const health = await checkHealth();
    console.log('✅ Health check успешен:');
    console.log(`   Статус: ${health.status}`);
    console.log(`   CV модель: ${health.models.cv}`);
    console.log(`   Text модель: ${health.models.text}`);
    console.log('');
    return true;
  } catch (error) {
    console.error('❌ Health check провален:', error);
    return false;
  }
}

async function testTextAnalysis() {
  console.log('📝 Тестирование text analysis...\n');
  
  const testCases = [
    'В подвале течёт труба, уже вся вода на полу',
    'Не работает свет на лестнице',
    'Во дворе упало дерево и перекрыло проход',
    'Привет, как дела?',
    'Кот сидит на подоконнике'
  ];
  
  for (const text of testCases) {
    console.log(`Текст: "${text}"`);
    try {
      const result = await analyzeText(text);
      console.log(`  Категория: ${result.category || 'N/A'}`);
      console.log(`  Подкатегория: ${result.subcategory || 'N/A'}`);
      console.log(`  Уверенность: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`  Модель: ${result.modelVersion}`);
      if (result.top3 && result.top3.length > 0) {
        console.log(`  Top3:`);
        result.top3.forEach((item, idx) => {
          console.log(`    ${idx + 1}. ${item.subcategory} (${item.category}) - ${(item.confidence * 100).toFixed(1)}%`);
        });
      }
      console.log('');
    } catch (error) {
      console.error(`  ❌ Ошибка: ${error}`);
      console.log('');
    }
  }
}

async function testVisionAnalysis() {
  console.log('📷 Тестирование vision analysis...\n');
  
  // Создаём тестовое изображение (1x1 pixel JPEG)
  const testImageBuffer = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy' +
    'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA' +
    'AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA' +
    'AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3' +
    'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm' +
    'p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEB' +
    'AAA/APn+iiiv/9k=',
    'base64'
  );
  
  console.log('Тестовое изображение (1x1 pixel JPEG)');
  try {
    const result = await analyzeImage(testImageBuffer, 'test.jpg');
    console.log(`  Результат: ${result.classificationResult}`);
    console.log(`  Категория: ${result.category || 'N/A'}`);
    console.log(`  Уверенность: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`  Модель: ${result.modelVersion}`);
    if (result.top3 && result.top3.length > 0) {
      console.log(`  Top3:`);
      result.top3.forEach((item, idx) => {
        console.log(`    ${idx + 1}. ${item.class} (${item.category || 'null'}) - ${(item.confidence * 100).toFixed(1)}%`);
      });
    }
    console.log('');
  } catch (error) {
    console.error(`  ❌ Ошибка: ${error}`);
    console.log('');
  }
}

async function main() {
  console.log('🧪 Тестирование ML API\n');
  console.log(`Base URL: ${BASE_URL}\n`);
  console.log('─'.repeat(50) + '\n');
  
  const healthOk = await testHealth();
  if (!healthOk) {
    console.log('⚠️ ML API недоступен, пропускаем остальные тесты');
    return;
  }
  
  console.log('─'.repeat(50) + '\n');
  await testTextAnalysis();
  
  console.log('─'.repeat(50) + '\n');
  await testVisionAnalysis();
  
  console.log('─'.repeat(50));
  console.log('\n✅ Тестирование завершено!');
}

main().catch(console.error);

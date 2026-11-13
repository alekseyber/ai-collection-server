import { Telegraf } from 'telegraf';
import { createClient } from 'redis';
import { loadConfig } from './services/config/config.js';
import { AIService } from './services/ai-service/ai-service.js';
import { AllowedService } from './services/allowed-service.js';
import { KinopoiskService } from './services/kinopoisk-api-service.js';
import { setupBotHandlers } from './services/bot-handlers/setup-bot-handlers.js';

const redis = createClient({ url: 'redis://redis:6379' });
await redis.connect();

const config = await loadConfig();
const token = config.DEFAULT_TOKEN_TELEGRAM;
if (!token) { console.log('FAIL: No token'); process.exit(1); }

const bot = new Telegraf(token);
const aiService = new AIService(config);
const allowedService = new AllowedService(config);
const kinopoiskService = new KinopoiskService(config);
setupBotHandlers(bot, config, aiService, allowedService, kinopoiskService);

// Идентификаторы не хардкодим: репозиторий публичный. Для локального прогона
// задаются аргументами или переменными INJECT_CHAT_ID / INJECT_USER_ID.
const text = process.argv[2] || '/start';
const chatId = Number(process.argv[3] || process.env.INJECT_CHAT_ID);
const userId = Number(process.argv[4] || process.env.INJECT_USER_ID);
if (!chatId || !userId) {
  console.log('FAIL: не заданы chatId/userId (аргументы или INJECT_CHAT_ID / INJECT_USER_ID)');
  process.exit(1);
}

const upd = {
  update_id: Date.now(),
  message: {
    message_id: Math.floor(Math.random()*90000)+10000,
    from: { id: userId, is_bot: false, first_name: 'Aleksey', username: 'aleksey_v_b', language_code: 'ru' },
    chat: { id: chatId, type: 'supergroup', title: 'AI Test' },
    date: Math.floor(Date.now()/1000),
    text: text,
  },
};

try {
  await bot.handleUpdate(upd);
  console.log('PASS');
} catch(e) {
  console.log('FAIL: ' + e.message);
}

await redis.quit();
process.exit(0);
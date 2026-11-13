import { ErrorTelegram } from './services/errors/error-telegram.class';
import { initializeBot } from './services/bot-service';
import { redisInstance } from './services/redis-client';

// Обработка сигналов завершения
process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

async function gracefulShutdown(signal: string) {
  console.log(`Получен сигнал ${signal}, завершаем работу...`);
  try {
    await redisInstance.quit();
    console.log('Redis соединение закрыто');
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при завершении работы:', error);
    process.exit(1);
  }
}

// Запуск бота: транзиентная ошибка Telegram на старте (таймаут, протухший
// callback от прошлой сессии) не должна оставлять бота лежать — под nodemon
// процесс после падения сам не поднимается.
(async () => {
  const attempts = 3;
  for (let i = 1; i <= attempts; i++) {
    try {
      await initializeBot();
      console.log('Telegram бот запущен...');
      return;
    } catch (error) {
      new ErrorTelegram(`Ошибка инициализации бота (попытка ${i}/${attempts})`, error);
      if (i === attempts) {
        await redisInstance.quit();
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
})();

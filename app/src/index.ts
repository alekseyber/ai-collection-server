 import { initializeBot } from './modules/bot-handlers';
import { redisInstance } from './modules/redis-client';

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

// Запуск бота с обработкой неотловленных исключений
(async () => {
    try {
        await initializeBot();
        console.log('Telegram бот запущен...');
    } catch (error) {
        console.error('Критическая ошибка при запуске бота:', error);
       // await redisInstance.quit();
        process.exit(1);
    }
})();
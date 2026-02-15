import { ErrorTelegram } from 'services/errors/error-telegram.class';
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

// Запуск бота с обработкой неотловленных исключений
(async () => {
    try {
        await initializeBot();
        console.log('Telegram бот запущен...');
    } catch (error) {
        new ErrorTelegram('Критическая ошибка при запуске бота:', error);
        await redisInstance.quit();
        process.exit(1);
    }
})();
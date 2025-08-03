import { initializeBot } from './modules/bot-handlers';

// Запуск бота
initializeBot().then(() => {
    console.log('Telegram бот запущен...');
}).catch(error => {
    console.error('Ошибка при запуске бота:', error);
    process.exit(1);
});
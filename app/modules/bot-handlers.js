// Модуль с обработчиками команд бота
import TelegramBot from 'node-telegram-bot-api';
import {
    config
} from './config/config.js';
import { redisInstance } from './redis-client.js';
import {
    aiService
} from './ai-service.js';
import { allowedService } from "./allowed-service.js";

import {utils} from "./utils/utils.js";


let bot;

/**
 * Настраивает обработчики команд и сообщений бота
 */
function setupBotHandlers() {
    // Обработчик сообщений
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userMessage = msg.text.trim();

        console.log(`Получено сообщение от ${userId}: ${userMessage}`);

        // Список команд, которые не должны попадать в историю
        const serviceCommands = ['/setmodel', '/getmodel', '/modelmenu', '/setprompt', '/getprompt', '/setstartmsg', '/getstartmsg', '/clear', '/start'];
        if (serviceCommands.some(cmd => userMessage.startsWith(cmd))) {
            // Не добавляем в историю, не вызываем модель просто return
            return;
        }

        // Загружаем историю пользователя
        let history = await redisInstance.loadHistory(userId);

        // Если история пустая, добавляем системную инструкцию
        if (history.length === 0) {
            history = [
                { role: 'system', content: config.startPrompt }
            ];
        }

        // Добавляем сообщение пользователя в историю
        history.push({ role: 'user', content: userMessage });

        // Получаем выбранную модель
        const model = await redisInstance.getUserModel(userId);

        // Отправляем "печатает..." статус
        bot.sendChatAction(chatId, 'typing');

        try {
            // Получаем ответ от модели
            const response = await aiService.askModelRoutre(history, userId, model);

            if (response !== config.ERROR_MODEL_MESSAGE) {
                // Добавляем ответ модели в историю
                history.push({ role: 'assistant', content: utils.formatingResponseAiContent(response) });

                // Сохраняем обновленную историю
                await redisInstance.saveHistory(userId, history);
            }

            // Отправляем ответ пользователю
            await bot.sendMessage(chatId, response, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
            });

        } catch (error) {
            console.error('Ошибка:', error.message);
            await bot.sendMessage(chatId, 'Произошла ошибка при обработке сообщения.');
        }
    });

    // Команда /start
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        try {
            // Очищаем историю при старте
            await redisInstance.clearHistory(userId);

            await bot.sendMessage(chatId, config.startMessage);
        } catch (error) {
            console.error('Ошибка:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при обработке команды.');
        }
    });

    // Команда /clear для очистки истории
    bot.onText(/\/clear/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        await redisInstance.clearHistory(userId);
        bot.sendMessage(chatId, 'История диалога очищена!');
    });

    // Команда /setprompt для изменения системного промпта (только для админов)
    bot.onText(/\/setprompt (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const newPrompt = match[1];

        // Здесь можно добавить проверку на админа
        if (!allowedService.getAdminPermission(userId)) {
            await bot.sendMessage(chatId, 'У вас нет прав для изменения промпта.');
            return;
        }

        await redisInstance.setConfig('start_prompt', newPrompt);
        config.setStartPrompt(newPrompt);
        await bot.sendMessage(chatId, 'Системный промпт обновлен!');
    });

    // Команда /getprompt для просмотра текущего промпта
    bot.onText(/\/getprompt/, async (msg) => {
        const chatId = msg.chat.id;
        await bot.sendMessage(chatId, `Текущий системный промпт:\n${config.startPrompt}`);
    });

    // Команда /setstartmsg для изменения стартового сообщения (только для админов)
    bot.onText(/\/setstartmsg (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        try {
            if (!allowedService.getAdminPermission(userId)) {
                await bot.sendMessage(chatId, 'У вас нет прав для изменения стартового сообщения.');
                return;
            }
            const newMsg = match[1];
            await redisInstance.setConfig('start_message', newMsg);
            config.setStartMessage(newMsg);
            await bot.sendMessage(chatId, 'Стартовое сообщение обновлено!');
        } catch (error) {
            console.error('Ошибка:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при обработке команды.');
        }
    });

    // Команда /getstartmsg для просмотра текущего стартового сообщения
    bot.onText(/\/getstartmsg/, async (msg) => {
        const chatId = msg.chat.id;
        await bot.sendMessage(chatId, `Текущее стартовое сообщение:\n${config.startMessage}`);
    });

    // Команда /setmodel <model>
    bot.onText(/\/setmodel (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const model = match[1].trim();

        if (!allowedService.getModelPermissionStatus(userId, model)) {
            await bot.sendMessage(chatId, `Модель ${model} не поддерживается. Доступные: ${allowedModelsLabels}`);
            return;
        }

        await redisInstance.setUserModel(userId, model);
        await bot.sendMessage(chatId, `Модель успешно изменена на ${allowedService.getAllowedModelsLabels(userId)}`);
    });

    // Команда /getmodel
    bot.onText(/\/getmodel/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const model = await redisInstance.getUserModel(userId);


        // await redisInstance.setConfig('start_prompt', config.DEFAULT_START_PROMPT)
        //  config.setStartPrompt(config.DEFAULT_START_PROMPT);

        await bot.sendMessage(chatId, `Текущая модель: ${config.MODELS_CONFIG[model]?.text}`);
    });


    // Команда /modelmenu для выбора модели через меню
    bot.onText(/\/modelmenu/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        try {
            const { modelList } = allowedService.getModelList(userId);
           
            const inline_keyboard = modelList.map(({ text, key }) => [{
                text,
                callback_data: `setmodel_${key}`
            }]);

            const keyboard = {
                reply_markup: {
                    inline_keyboard,
                }
            };

            await bot.sendMessage(chatId, 'Выберите модель:', keyboard);
        } catch (error) {
            console.error('Ошибка:', error.message);
            await bot.sendMessage(chatId, 'Произошла ошибка при обработке команды.');
        }

    });

    // Обработчик выбора модели через инлайн-кнопки
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const userId = query.from.id;
        try {
            const queryData = query.data.replace(/setmodel_/ig, "");

            const selectedModel = allowedService.getModelPermissionSelected(userId, queryData);

            if (!selectedModel) {
                await bot.sendMessage(chatId, "Выполнение данной команды ограничен или она не найдена");
                // Нужно обязательно ответить на callback_query, чтобы убрать "часики" в Telegram
                await bot.answerCallbackQuery(query.id, { text: 'Доступ запрещён', show_alert: true });
                return;
            }

            // Сохраняем модель пользователя
            await redisInstance.setUserModel(userId, selectedModel.key);

            await bot.sendMessage(chatId, `Модель успешно изменена на ${selectedModel.text}`);

            // Обязательно отвечаем на callback_query (без этого Telegram показывает часы)
            await bot.answerCallbackQuery(query.id);

        } catch (error) {
            console.error('Ошибка в callback_query:', error);
            await bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка', show_alert: true });
        }
    });
}
// /**
//  * Инициализирует бота с токеном и настраивает обработчики
//  * @returns {Promise<TelegramBot>} - Экземпляр бота
//  */
export async function initializeBot() {
    try {
        const token = await redisInstance.getConfig('telegram_token', config.DEFAULT_TOKEN_TELEGRAM);
        config.setStartPrompt(await redisInstance.getConfig('start_prompt', config.DEFAULT_START_PROMPT));
        config.setStartMessage(await redisInstance.getConfig('start_message', config.DEFAULT_START_MESSAGE));



        bot = new TelegramBot(token, { polling: true });
        console.log('Telegram бот инициализирован');

        setupBotHandlers();
        return bot;
    } catch (error) {
        console.error('Ошибка инициализации бота:', error);
        throw error;
    }
}


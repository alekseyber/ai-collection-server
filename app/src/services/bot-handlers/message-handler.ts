import { Telegraf } from 'telegraf';
import { Context } from 'telegraf/typings/context';
import { redisInstance } from '../redis-client';
import { convert } from 'telegram-markdown-v2';
import { utils } from '../utils/utils';
import { ErrorTelegram } from '../errors/error-telegram.class';
import { BotHandlersContext } from './setup-bot-handlers';


export function handleMessage(bot: Telegraf<Context>, ctxData: BotHandlersContext): void {
    bot.on('message', async (ctx, next) => {
        const chatId = ctx.chat?.id;
        const userId = ctx.from?.id;

        if (!chatId || !userId || !('text' in ctx.message)) return;

        const text = ctx.message.text;

        // Команды, которые не попадают в историю
        const serviceCommands = [
            '/setmodel', '/getmodel', '/modelmenu',
            '/setprompt', '/getprompt', '/setstartmsg',
            '/getstartmsg', '/clear', '/start',
            '/getavpkinorating', '/on_embeddings'
        ];

        if (serviceCommands.some(cmd => text.startsWith(cmd))) {
            next();
            return; // Пропускаем, так как команды обрабатываются отдельно
        }

        const state = ctxData.userStates[String(userId)];

        if (state === 'embeddings') {
            await ctx.reply('Ожидайте, запрос отправлен');
            await ctxData.aiService.embeddingService.addEmbeddingSource(text);
            await ctx.reply('Текст добавлен в embeddings. Введите следующий.');
            next();
            return;
        }

        if (state === 'kinopoisk' && isNaN(Number(text))) {
            await ctx.reply('Введите номер страницы');
            next();
            return;
        }

        if (state === 'kinopoisk') {
            await ctx.sendChatAction('typing');
            const page = Number(text);
            try {
                const response = await ctxData.kinopoiskService.getAvpMoviesReating(page);
                const { info, csvContent } = utils.formatingKinopiskRating(response, page);
                await ctx.reply(info);
                if (csvContent) {
                    await ctx.replyWithDocument(
                        { source: Buffer.from(csvContent, 'utf8'), filename: `ratings_page_${page}.csv` },
                        { caption: '📊 Рейтинг фильмов AVP (CSV)' }
                    );
                }
            } catch (error: any) {
                new ErrorTelegram('Ошибка при получении рейтинга Kinopoisk', error, ctx);
            }
            ctxData.clearUserState(userId);
            next();
            return;
        }

        // Обычный диалог с AI
        console.log(`Получено сообщение от пользвателя ${userId}: ${text}`);
        let history = await redisInstance.loadUserHistory(userId);
        if (history.length === 0) {
            history.push({ role: 'system', content: ctxData.config.startPrompt });
        }

        history.push({ role: 'user', content: text });
        const model = await redisInstance.getUserModel(userId);

        await ctx.sendChatAction('typing');

        let responseModel: string

        try {
            responseModel = await ctxData.aiService.askModelRoute(userId, text, history, model);
            if (responseModel !== ctxData.config.ERROR_MODEL_MESSAGE) {
                history.push({ role: 'assistant', content: utils.formatingResponseAiContent(responseModel) });
                await redisInstance.saveUserHistory(userId, history);
            }

            await ctx.reply(responseModel, {
                parse_mode: 'Markdown',
                link_preview_options: { is_disabled: false }
            });
        } catch (error: any) {
            new ErrorTelegram('Ошибка при генерации ответа от модели', error, ctx);
            try {
                await ctx.reply(convert(responseModel, "remove"), {});
            } catch (e: any) {
                new ErrorTelegram('Ошибка после convert', e, ctx);
            }
        }
    });
}
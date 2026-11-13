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
      '/getavpkinorating', '/on_embeddings',
    ];

    if (serviceCommands.some(cmd => text.startsWith(cmd))) {
      next();
      return;
    }

    // AI-диалог и связанные режимы — только для авторизованных пользователей.
    // Проверка стоит до обращения к модели, чтобы неавторизованный запрос
    // не доходил до провайдера и не тратил токены.
    if (!ctxData.allowedService.getSuperUserPermission(userId)) {
      await ctx.reply('🚫 Доступ к AI только для авторизованных пользователей.');
      return;
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
            { caption: '📊 Рейтинг фильмов AVP (CSV)' },
          );
        }
      } catch (error: any) {
        new ErrorTelegram('Ошибка при получении рейтинга Kinopoisk', error, ctx);
      }
      ctxData.clearUserState(userId);
      next();
      return;
    }

    // --- Обычный диалог с AI (со streaming) ---
    console.log(`Получено сообщение от пользователя ${userId}: ${text}`);
    let history = await redisInstance.loadUserHistory(userId);
    if (history.length === 0) {
      history.push({ role: 'system', content: ctxData.config.startPrompt });
    }

    history.push({ role: 'user', content: text });
    // Дефолт берём из конфига: пустое значение означает «пользователь не выбирал модель».
    // Сохранённый выбор проверяем по списку доступных: модель могли отключить (off) или
    // удалить с диска — иначе запрос уходил в никуда и падал 404 model not found.
    const storedModel = await redisInstance.getUserModel(userId);
    const model =
      storedModel && ctxData.allowedService.getModelPermissionStatus(userId, storedModel)
        ? storedModel
        : ctxData.config.MODEL_DEFAULT.key;

    // Отправляем начальное сообщение и сразу typing
    const sentMsg = await ctx.reply('⏳ Думаю...');
    await ctx.sendChatAction('typing');

    let fullContent = '';
    let lastSentLength = 0;
    const MAX_MSG_LEN = 3900;  // Telegram лимит — 4096, оставляем запас
    let updateCount = 0;

    try {
      for await (const step of ctxData.aiService.reactAgent.runStream(history, text, model)) {
        if (step.type === 'chunk' && step.content) {
          fullContent += step.content;

          // Троттлим обновления: каждый 15-й чанк или каждые ~200ms
          updateCount++;
          if (updateCount % 15 === 0 && fullContent.length > lastSentLength + 20) {
            const displayText = fullContent.length > MAX_MSG_LEN
              ? fullContent.slice(0, MAX_MSG_LEN) + '...'
              : fullContent;
            try {
              await ctx.telegram.editMessageText(chatId, sentMsg.message_id, undefined, displayText);
              lastSentLength = fullContent.length;
            } catch {}
          }
        }

        if (step.type === 'final') {
          fullContent = step.answer;

          // Форматируем ответ, сохраняем историю
          const formatted = utils.formatingResponseAiContent(fullContent);
          history.push({ role: 'assistant', content: formatted });
          await redisInstance.saveUserHistory(userId, history);

          // Отправляем финальный ответ
          try {
            await ctx.telegram.editMessageText(chatId, sentMsg.message_id, undefined, fullContent, {
              parse_mode: 'Markdown',
              link_preview_options: { is_disabled: false },
            });
          } catch {
            // Если Markdown сломался — отправляем без форматирования
            try {
              await ctx.telegram.editMessageText(chatId, sentMsg.message_id, undefined, fullContent);
            } catch {}
          }
          return;
        }
      }

      // Если цикл завершился без final (лимит итераций)
      if (!fullContent) {
        await ctx.telegram.editMessageText(chatId, sentMsg.message_id, undefined, 'Превышен лимит итераций. Попробуй уточнить запрос.');
      }

    } catch (error: any) {
      new ErrorTelegram('Ошибка при генерации ответа', error, ctx);
      try {
        await ctx.telegram.editMessageText(chatId, sentMsg.message_id, undefined, 
          'Произошла ошибка. Попробуй ещё раз.');
      } catch {}
    }
  });
}

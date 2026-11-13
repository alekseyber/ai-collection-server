import { ErrorTelegram } from '../errors/error-telegram.class';
import { Context, Telegraf } from 'telegraf';
import { BotHandlersContext } from './setup-bot-handlers';

export function handleCallbackQuery(bot: Telegraf<Context>, ctxData: BotHandlersContext): void {
  bot.on('callback_query', async (ctx) => {
    // Ответ на callback может упасть «query is too old» — кнопку нажали, пока бот
    // перезапускался. Это не повод ронять процесс: отвечаем молча и живём дальше.
    const ack = async (text?: string): Promise<void> => {
      try {
        if (text) await ctx.answerCbQuery(text, { show_alert: true });
        else await ctx.answerCbQuery();
      } catch {
        /* устаревший callback или сеть — игнорируем */
      }
    };

    const query = ctx.callbackQuery;
    if (!('data' in query)) return await ack();

    const userId = ctx.from?.id;
    const data = query.data.replace(/setmodel_/gi, '');

    if (!userId) return await ack();

    // Кнопка режима стиля из /modelmenu: права проверяем здесь же, до записи в redis.
    if (data === 'style_toggle') {
      if (!ctxData.allowedService.getAdminPermission(userId)) {
        return await ack('Режим стиля доступен только администраторам');
      }
      const key = `style_mode:${userId}`;
      const cur = await ctxData.redisInstance.getConfig(key);
      const next = cur === '1' ? '0' : '1';
      await ctxData.redisInstance.setConfig(key, next);
      await ctx.reply(
        next === '1'
          ? '✍️ Режим стиля включён: ответы переписываются в твоей манере. Код, списки и таблицы не трогаются.'
          : '📄 Режим стиля выключен.',
      );
      await ack();
      return;
    }

    try {
      const model = ctxData.allowedService.getModelPermissionSelected(userId, data);
      if (!model) return await ack('Доступ запрещён');

      await ctxData.redisInstance.setUserModel(userId, model.key);
      await ctx.reply(`Модель изменена на ${model.text}`);
      await ack();
    } catch (error: any) {
      if (!String(error?.message || '').includes('query is too old')) {
        new ErrorTelegram('Ошибка в callback', error);
      }
      await ack();
    }
  });
}

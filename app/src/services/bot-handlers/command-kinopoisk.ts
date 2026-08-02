import { Telegraf } from 'telegraf';
import { Context } from 'telegraf/typings/context';
import { BotHandlersContext } from './setup-bot-handlers';

export function handleKinopoiskCommand(bot: Telegraf<Context>, ctxData: BotHandlersContext): void {
  bot.hears(/\/getavpkinorating/, async (ctx) => {
    const userId = ctx.from?.id;

    if (!userId) return;

    if (!ctxData.allowedService.getSuperUserPermission(userId)) {
      await ctx.reply('🚫 У вас нет прав на просмотр рейтинга AVP.');
      return;
    }

    ctxData.clearUserState(userId);
    ctxData.userStates[String(userId)] = 'kinopoisk';
    await ctx.reply('🔢 Введите номер страницы (или 1000+, чтобы получить все):');
  });
}

import { Context, Telegraf } from 'telegraf';
import { BotHandlersContext } from './setup-bot-handlers';

export function handleStartCommand(bot: Telegraf<Context>, ctxData: BotHandlersContext): void {
  bot.hears(/\/start/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctxData.redisInstance?.clearUserHistory(userId);
    ctxData.clearUserState(userId);
    await ctx.reply(ctxData.config.startMessage);
  });
}

import { Context, Telegraf } from "telegraf";
import { BotHandlersContext } from "./setup-bot-handlers";

export function handleClearCommand(bot: Telegraf<Context>, ctxData: BotHandlersContext): void {
    bot.hears(/\/clear/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        await ctxData.redisInstance?.clearUserHistory(userId);
        await ctx.reply('История диалога очищена!');
    });
}
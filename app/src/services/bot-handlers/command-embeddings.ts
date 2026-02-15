import { Context, Telegraf } from 'telegraf';
import { BotHandlersContext } from './setup-bot-handlers';



export function handleEmbeddingsCommand(bot: Telegraf<Context>, ctxData: BotHandlersContext): void {
    bot.hears(/\/on_embeddings/, async (ctx) => {
        const userId = ctx.from?.id;

        if (!userId) return;

        if (!ctxData.allowedService.getSuperUserPermission(userId)) {
            await ctx.reply('🚫 У вас нет прав на использование режима embeddings.');
            return;
        }

        ctxData.clearUserState(userId);
        ctxData.userStates[String(userId)] = 'embeddings';
        await ctx.reply('🟢 Вы вошли в режим **embeddings**.\nОтправьте текст для индексации.');
    });
}
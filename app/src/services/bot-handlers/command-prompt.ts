import { Telegraf } from 'telegraf';
import { Context } from 'telegraf/typings/context';
import { BotHandlersContext } from './setup-bot-handlers';



export function handlePromptCommands(bot: Telegraf<Context>, ctxData: BotHandlersContext): void {
    // /setprompt <текст> — установить системный промпт (только для админов)
    bot.hears(/\/setprompt (.+)/, async (ctx) => {
        const userId = ctx.from?.id;
        const newPrompt = ctx.match?.[1]?.trim();

        if (!userId || !newPrompt) return;

        if (!ctxData.allowedService.getAdminPermission(userId)) {
            await ctx.reply('❌ У вас нет прав для изменения системного промпта.');
            return;
        }

        try {
            await ctxData.redisInstance.setConfig('start_prompt', newPrompt);
            ctxData.config.startPrompt = newPrompt;
            await ctx.reply('✅ Системный промпт успешно обновлён.');
        } catch (error: any) {
            console.error('Ошибка при сохранении промпта в Redis:', error);
            await ctx.reply('⚠️ Не удалось обновить промпт.');
        }
    });

    // /getprompt — посмотреть текущий промпт
    bot.hears(/\/getprompt/, async (ctx) => {
        await ctx.reply(`📝 Текущий системный промпт:\n\n${ctxData.config.startPrompt}`);
    });
}
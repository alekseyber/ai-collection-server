import { ErrorTelegram } from "../errors/error-telegram.class";
import { Context, Telegraf } from "telegraf";
import { BotHandlersContext } from "./setup-bot-handlers";

export function handleCallbackQuery(bot: Telegraf<Context>, ctxData: BotHandlersContext): void {
    bot.on('callback_query', async (ctx) => {
        const query = ctx.callbackQuery;
        if (!('data' in query)) return await ctx.answerCbQuery();

        const userId = ctx.from?.id;
        const data = query.data.replace(/setmodel_/ig, '');

        if (!userId) return await ctx.answerCbQuery();

        try {
            const model = ctxData.allowedService.getModelPermissionSelected(userId, data);
            if (!model) {
                await ctx.answerCbQuery('Доступ запрещён', { show_alert: true });
                return;
            }

            await ctxData.redisInstance.setUserModel(userId, model.key);
            await ctx.reply(`Модель изменена на ${model.text}`);
            await ctx.answerCbQuery();
        } catch (error: any) {
            if (!error.message.includes('query is too old')) {
                new ErrorTelegram('Ошибка в callback', error);
            }
            await ctx.answerCbQuery();
        }
    });
}
import { Context, Telegraf } from "telegraf";
import { BotHandlersContext } from "./setup-bot-handlers";

export function handleModelCommands(bot: Telegraf<Context>, ctxData: BotHandlersContext): void {
    bot.hears(/\/setmodel (.+)/, async (ctx) => {
        const userId = ctx.from?.id;
        const model = ctx.match[1].trim();

        if (!userId) return;
        if (!ctxData.allowedService.getModelPermissionStatus(userId, model)) {
            return ctx.reply(`Модель ${model} недоступна.`);
        }

        await ctxData.redisInstance.setUserModel(userId, model);
        await ctx.reply(`Модель изменена на ${model}`);
    });

    bot.hears(/\/getmodel/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;
        const model = await ctxData.redisInstance.getUserModel(userId);
        await ctx.reply(`Текущая модель: ${ctxData.config.MODELS_CONFIG[model]?.text}`);
    });

    bot.hears(/\/modelmenu/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const { modelList } = ctxData.allowedService.getModelList(userId);
        const keyboard = {
            reply_markup: {
                inline_keyboard: modelList.map(m => [{ text: m.text, callback_data: `setmodel_${m.key}` }])
            }
        };
        await ctx.reply('Выберите модель:', keyboard);
    });
}
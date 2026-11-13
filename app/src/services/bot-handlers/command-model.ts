import { Context, Telegraf } from 'telegraf';
import { BotHandlersContext } from './setup-bot-handlers';

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
    const modelText =
      ctxData.config.MODELS_CONFIG[model]?.text || ctxData.config.MODEL_DEFAULT.text;
    await ctx.reply(`Текущая модель: ${modelText}`);
  });

  bot.hears(/\/modelmenu/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const { modelList } = ctxData.allowedService.getModelList(userId);
    // Пустой список — у пользователя нет прав ни на одну модель.
    // Раньше в этом случае уходила пустая inline-клавиатура, и Telegram отвечал ошибкой.
    if (modelList.length === 0) {
      return ctx.reply('🚫 Доступ к выбору модели только для авторизованных пользователей.');
    }
    const rows = modelList.map((m) => [{ text: m.text, callback_data: `setmodel_${m.key}` }]);

    // Переключатель режима стиля — только админам и только если движок настроен.
    // Держим его в этом же меню: иначе про режим никто не узнает, а /style
    // приходится помнить наизусть.
    if (
      ctxData.allowedService.getAdminPermission(userId) &&
      ctxData.aiService.stylePostprocessor?.isConfigured()
    ) {
      const flag = await ctxData.redisInstance.getConfig(`style_mode:${userId}`);
      const on = flag === '1';
      rows.push([
        {
          text: on ? '✍️ стиль: включён (нажми, чтобы выключить)' : '📄 стиль: выключен (нажми, чтобы включить)',
          callback_data: 'style_toggle',
        },
      ]);
    }

    const keyboard = { reply_markup: { inline_keyboard: rows } };
    await ctx.reply('Выберите модель:', keyboard);
  });
}

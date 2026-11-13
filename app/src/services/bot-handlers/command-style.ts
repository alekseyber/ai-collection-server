import { Telegraf, Context } from 'telegraf';
import { BotHandlersContext } from './setup-bot-handlers';

/**
 * /style on | /style off — включить или выключить переписывание ответов
 * стиль-моделью. Только для админов: модель обучена на личных текстах,
 * и в чужих диалогах её включать нельзя.
 */
export function handleStyleCommands(bot: Telegraf<Context>, ctxData: BotHandlersContext): void {
  bot.hears(/\/style(\s+(on|off))?$/i, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (!ctxData.allowedService.getAdminPermission(userId)) {
      await ctx.reply('❌ Управление режимом стиля доступно только администраторам.');
      return;
    }

    const arg = (ctx.match?.[2] || '').toLowerCase();
    const key = `style_mode:${userId}`;

    if (!arg) {
      const cur = await ctxData.redisInstance.getConfig(key);
      await ctx.reply(
        cur === '1'
          ? '✍️ Режим стиля включён: ответы переписываются в твоей манере.'
          : '📄 Режим стиля выключен. Включается командой /style on.',
      );
      return;
    }

    if (arg === 'on') {
      if (!ctxData.aiService.stylePostprocessor?.isConfigured()) {
        await ctx.reply('⚠️ Стиль-модель не настроена (нет api_url в конфиге).');
        return;
      }
      await ctxData.redisInstance.setConfig(key, '1');
      await ctx.reply('✍️ Режим стиля включён.\nОтветы будут переписаны в твоей манере. Код, списки и таблицы не трогаются.');
      return;
    }

    await ctxData.redisInstance.setConfig(key, '0');
    await ctx.reply('📄 Режим стиля выключен.');
  });
}

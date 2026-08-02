import { Context, NarrowedContext } from 'telegraf';
import { ErrorBase } from './error-base.class';
import { Message, Update } from 'telegraf/typings/core/types/typegram';

type CtxTelegraf =
  | (Context<{
      message: Update.New & Update.NonChannel & Message.TextMessage;
      update_id: number;
    }> &
      Omit<Context<Update>, keyof Context<Update>> & {
        match: RegExpExecArray;
      })
  | NarrowedContext<Context<Update>, Update.MessageUpdate<Message>>;

export class ErrorTelegram extends ErrorBase {
  public errorCode: string;
  constructor(message: string, error: any, ctx?: CtxTelegraf) {
    super(message, 'ErrorTelegram');
    this.initError(error);
    this.sendErrorRespond(ctx).then();
  }
  private initError(error: any) {
    // Проверка типа ошибки
    if (error.name === 'ErrorApp' || error.name === 'ErrorTimewebAgent') {
      return;
    }

    if (error.code === 'EFATAL') {
      this.saveLog(`Фатальная ошибка: ${error?.message}`);
    } else if (error.code && error.response) {
      this.errorCode = error?.code || '';
      this.saveLog(
        `Ошибка Telegram: code: ${error?.code || ''}, description: ${error?.description || ''}, parameters: ${error?.response?.parameters?.message || ''}, payloadText: ${error?.on?.payload?.text || ''}`,
      );
    } else {
      this.saveLog(`Системная ошибка: ${error.message}`);
    }
  }
  private async sendErrorRespond(ctx?: CtxTelegraf) {
    if (!ctx || this.errorCode == '400') {
      return;
    }
    try {
      await ctx.reply(this.currentMessage);
    } catch (e) {
      this.saveLog(`Ошибка отправки ответа оштбки`);
    }
  }
}

import { Context, Telegraf } from 'telegraf';
import { LoadConfig } from '../config/config';
import { AIService } from '../ai-service/ai-service';
import { AllowedService } from '../allowed-service';
import { KinopoiskService } from '../kinopoisk-api-service';
import { handleMessage } from './message-handler';
import { handleStartCommand } from './command-start';
import { handleClearCommand } from './command-clear';
import { handleModelCommands } from './command-model';
import { handleCallbackQuery } from './callback-handler';
import { handlePromptCommands } from './command-prompt';
import { handleKinopoiskCommand } from './command-kinopoisk';
import { handleEmbeddingsCommand } from './command-embeddings';
import { handleStyleCommands } from './command-style';
import { RedisClient, redisInstance } from '../redis-client';

export interface BotHandlersContext {
  config: LoadConfig;
  aiService: AIService;
  allowedService: AllowedService;
  kinopoiskService: KinopoiskService;
  userStates: Record<string, 'kinopoisk' | 'embeddings' | null>;
  clearUserState: (userId: number) => void;
  redisInstance: RedisClient;
}

export function setupBotHandlers(
  bot: Telegraf<Context>,
  config: LoadConfig,
  aiService: AIService,
  allowedService: AllowedService,
  kinopoiskService: KinopoiskService,
): void {
  // Состояния пользователей
  const userStates: Record<string, 'kinopoisk' | 'embeddings' | null> = {};

  const clearUserState = (userId: number) => {
    userStates[String(userId)] = null;
  };

  // Передача состояний через замыкание
  const context: BotHandlersContext = {
    userStates,
    clearUserState,
    config,
    aiService,
    allowedService,
    kinopoiskService,
    redisInstance,
  };

  // Подключаем обработчики
  handleMessage(bot, context);
  handleStartCommand(bot, context);
  handleClearCommand(bot, context);
  handleModelCommands(bot, context);
  handlePromptCommands(bot, context);
  handleKinopoiskCommand(bot, context);
  handleEmbeddingsCommand(bot, context);
  handleStyleCommands(bot, context);
  handleCallbackQuery(bot, context);
}

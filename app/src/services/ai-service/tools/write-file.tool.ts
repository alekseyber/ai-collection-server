import { Tool } from './tool.interface';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { isPathAllowed } from './safety';

export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Создать или полностью перезаписать файл. Можно писать только в scripts/, tools/, plugins/, tmp/. Если файл существует — сначала запроси подтверждение у пользователя.',
  parameters: {
    path: { type: 'string', description: 'Абсолютный путь к файлу' },
    content: { type: 'string', description: 'Содержимое файла' },
  },
  execute: async (args) => {
    const filePath = String(args.path);
    const content = String(args.content ?? '');

    if (!isPathAllowed(filePath, 'write')) {
      return JSON.stringify({
        error: 'Запрещено: можно писать только в scripts/, tools/, plugins/, tmp/',
        allowed_dirs: ['scripts', 'tools', 'plugins', 'tmp'],
      });
    }

    // Если файл существует — запрос подтверждения
    if (existsSync(filePath)) {
      return JSON.stringify({
        type: 'approval_required',
        tool: 'write_file',
        message: 'Файл уже существует. Спроси у пользователя подтверждение на перезапись.',
        details: { path: filePath, size_bytes: content.length },
      });
    }

    try {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, content, 'utf-8');
      return JSON.stringify({ success: true, path: filePath, bytes: content.length });
    } catch (err: any) {
      return JSON.stringify({ error: 'Ошибка записи: ' + err.message });
    }
  },
};
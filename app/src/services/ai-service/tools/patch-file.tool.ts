import { Tool } from './tool.interface';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';
import { isPathAllowed } from './safety';

export const patchTool: Tool = {
  name: 'patch',
  description: 'Найти и заменить текст в файле (одно вхождение). Безопаснее чем write_file.',
  parameters: {
    path: { type: 'string', description: 'Абсолютный путь к файлу' },
    old_string: { type: 'string', description: 'Текст который нужно заменить (должен быть уникальным)' },
    new_string: { type: 'string', description: 'Новый текст (может быть пустым для удаления)' },
  },
  execute: async (args) => {
    const filePath = String(args.path);
    const oldStr = String(args.old_string ?? '');
    const newStr = String(args.new_string ?? '');

    if (!isPathAllowed(filePath, 'write')) {
      return JSON.stringify({ error: 'Запрещено: patch разрешён только в scripts/, tools/, plugins/, tmp/' });
    }

    if (!existsSync(filePath)) {
      return JSON.stringify({ error: 'Файл не найден: ' + filePath });
    }

    let content = readFileSync(filePath, 'utf-8');
    if (!content.includes(oldStr)) {
      return JSON.stringify({ error: 'old_string не найден в файле' });
    }

    content = content.replace(oldStr, newStr);
    writeFileSync(filePath, content, 'utf-8');
    return JSON.stringify({ success: true, path: filePath, replaced: oldStr.length, with: newStr.length });
  },
};
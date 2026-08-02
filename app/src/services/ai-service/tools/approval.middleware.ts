/**
 * Lightweight approval middleware для инструментов.
 * Возвращает approval_required если операция опасная.
 */

import { existsSync } from 'fs';
import { SANDBOX_DIRS } from './safety';

export type ApprovalRequest = {
  type: 'approval_required';
  tool: string;
  operation: string;
  details: Record<string, string>;
};

/**
 * Проверка нужно ли подтверждение для write_file.
 * Нужно если файл уже существует (перезапись).
 */
export function checkWriteApproval(filePath: string, content: string): ApprovalRequest | null {
  if (existsSync(filePath)) {
    return {
      type: 'approval_required',
      tool: 'write_file',
      operation: 'Перезапись существующего файла',
      details: {
        path: filePath,
        size_bytes: String(content.length),
        preview: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
      },
    };
  }
  return null; // новый файл — без подтверждения
}

/**
 * Проверка нужно ли подтверждение для terminal.
 * Всегда требует подтверждения, если не в sandbox.
 */
export function checkTerminalApproval(cmd: string, cwd?: string): ApprovalRequest | null {
  const isSandbox = SANDBOX_DIRS.some(d => cwd?.startsWith(d));
  if (!isSandbox) {
    return {
      type: 'approval_required',
      tool: 'terminal',
      operation: 'Запуск shell-команды',
      details: {
        command: cmd.slice(0, 200),
        cwd: cwd || 'default',
      },
    };
  }
  return null;
}
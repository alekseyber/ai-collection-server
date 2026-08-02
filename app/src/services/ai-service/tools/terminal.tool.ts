import { Tool } from './tool.interface';
import { exec } from 'child_process';
import { promisify } from 'util';
import { isSafeCommand } from './safety';

const execAsync = promisify(exec);

export const terminalTool: Tool = {
  name: 'terminal',
  description: 'Выполнить shell-команду. Передавай команду одной строкой как в терминале (например "ls -la /tmp" или "chmod +x /tmp/file"). Только безопасные команды.',
  parameters: {
    command: { type: 'string', description: 'Команда одной строкой, как в терминале. Например: "cat /tmp/file" или "echo hello"' },
    timeout: { type: 'number', description: 'Таймаут в секундах, макс 30 (по умолч. 10)' },
  },
  execute: async (args) => {
    const cmd = String(args.command ?? '').trim();
    const timeout = Math.min(Number(args.timeout ?? 10), 30) * 1000;

    if (!cmd) {
      return JSON.stringify({ error: 'Команда пустая' });
    }

    if (!isSafeCommand(cmd)) {
      return JSON.stringify({
        error: 'Команда заблокирована safety-правилами',
        reason: 'Содержит опасные паттерны или shell-конструкции',
        command: cmd.slice(0, 200),
      });
    }

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        timeout,
        maxBuffer: 1024 * 500,
      });
      return JSON.stringify({
        exit_code: 0,
        output: stdout.slice(0, 10000),
        error: stderr ? stderr.slice(0, 2000) : null,
      });
    } catch (err: any) {
      return JSON.stringify({
        exit_code: err.code ?? 1,
        output: err.stdout?.slice(0, 10000) || '',
        error: err.stderr?.slice(0, 2000) || err.message,
      });
    }
  },
};
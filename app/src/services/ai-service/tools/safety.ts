/**
 * Safety layer for ReActAgent tools.
 *
 * - Запрет записи в защищённые директории (базовый код)
 * - Запрет опасных shell-команд
 */

/** Директории куда агент МОЖЕТ писать */
export const SANDBOX_DIRS = [
  '/tmp/',
  '/usr/src/app/scripts/',
  '/usr/src/app/tools/',
  '/usr/src/app/plugins/',
];

/** Директории которые агент НЕ МОЖЕТ менять (базовый код) */
export const PROTECTED_DIRS = [
  '/usr/src/app/src/services/ai-service/providers/',
  '/usr/src/app/src/services/ai-service/agents/',
  '/usr/src/app/src/services/config/',
  '/usr/src/app/src/services/errors/',
  '/usr/src/app/src/index.ts',
];

/** Опасные команды/паттерны — блокируются на уровне terminal */
export const BLOCKED_COMMANDS = [
  'rm -rf',
  'rm -fr',
  'dd if=',
  'fdisk',
  'sudo',
  'chmod 777',
  'chown',
  'mv /',
  'cp /',
];

export const BLOCKED_PATTERNS: RegExp[] = [
  /rm\s+-rf?\s+\//,
  />\s*\/dev\//,
  /\|.*rm\s+-rf/,
  /\/dev\/sda/,
  /\/dev\/nvme/,
  /\/boot\//,
  /\/etc\/passwd/,
  /\/etc\/shadow/,
];

/**
 * Проверка можно ли писать в указанный путь.
 */
export function isPathAllowed(path: string, mode: 'read' | 'write'): boolean {
  if (mode === 'read') return true;
  if (SANDBOX_DIRS.some(d => path.startsWith(d))) return true;
  if (PROTECTED_DIRS.some(d => path.startsWith(d))) return false;
  return false;
}

/**
 * Проверка shell-команды на безопасность.
 * Блокируются только по BLOCKED_COMMANDS и BLOCKED_PATTERNS.
 * Shell-конструкции (&&, ||, >, |) разрешены — они не опасны сами по себе.
 */
export function isSafeCommand(cmd: string): boolean {
  const lower = cmd.toLowerCase();
  if (BLOCKED_PATTERNS.some(p => p.test(cmd))) return false;
  if (BLOCKED_COMMANDS.some(b => lower.includes(b.toLowerCase()))) return false;
  return true;
}
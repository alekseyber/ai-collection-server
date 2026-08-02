import { FileAppender } from '../utils/file-writer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Получаем __filename и __dirname в стиле ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ErrorBase extends Error {
  public message: string;
  public name: string;
  private logFilePath: string = join(__dirname, 'logs/error.log');
  public currentMessage: string = 'не определено';
  public logMessage: string = 'не определено';

  constructor(message: string, name: string) {
    super(message);
    this.message = message;
    this.name = name;
  }

  protected saveLog(message: string, isNotAppendToFile?: boolean) {
    this.currentMessage = `${this.name} | ${this.message}`;
    this.logMessage = `${new Date().toISOString()} | ${this.name} | ${this.message} | ${message}`;
    console.error(this.logMessage);
    try {
      if (!isNotAppendToFile) {
        FileAppender.appendToFile(this.logFilePath, this.logMessage);
      }
    } catch (e) {
      console.error('ошибка записи в файл:', e.message);
    }
  }
}

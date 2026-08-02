import * as fs from 'fs';
import * as path from 'path';

export class FileAppender {
  /**
   * Проверяет существование директории и создаёт её, если она не существует.
   *
   * @param dir - путь к директории
   * @private
   */
  private static ensureDirExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Добавляет текст в конец файла (append).
   * Если файл не существует — будет создан.
   *
   * @param filePath - путь к файлу
   * @param text - текст для добавления
   */
  static appendToFile(filePath: string, text: string): void {
    try {
      const dir = path.dirname(filePath);
      this.ensureDirExists(dir);
      fs.appendFileSync(filePath, text + '\n', 'utf8');
    } catch (error) {
      console.error(`Ошибка при добавлении в файл ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Полностью заменяет содержимое файла указанным текстом.
   * Если файл или директория не существуют — будут созданы.
   *
   * @param filePath - путь к файлу
   * @param text - новый текст для записи
   */
  static writeToFile(filePath: string, text: string): void {
    try {
      const dir = path.dirname(filePath);
      this.ensureDirExists(dir);
      fs.writeFileSync(filePath, text + '\n', 'utf8');
    } catch (error) {
      console.error(`Ошибка при записи файла ${filePath}:`, error);
      throw error;
    }
  }
}

import { getParseMode } from "./get-parse-mode.js";

function escapeMarkdownV2(text) {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function getHasMarkdownV2Status(text) {
    // Все спецсимволы MarkdownV2, которые нужно экранировать
    const markdownV2SpecialChars = /[_*\[\]()~`>#+\-=|{}.!]/;
    return markdownV2SpecialChars.test(text);
}

function formattedText(text) {
    return {
        hasMarkdownV2: getParseMode(text)?.ok || false,
        formattedText: text,
    }

}

function formatingResponseAiContent(response) {
    const content = response?.content || response;
    return content.replace(/<|im_(start|end)|>/g, '');
}

/**
 * Преобразует строку с разделителями в массив чисел.
 * @param {string} input - Входная строка (например, "692059922,1769298937").
 * @returns {number[]} Массив чисел, соответствующих допустимым элементам строки.
 */
function parseNumbers(input) {
  if (input === undefined) return [];

  return input
    .split(',')
    .map(part => {
      const trimmed = part.trim();
      if (trimmed === '') return null; // Игнорируем пустые элементы
      const num = Number(trimmed);
      return isNaN(num) ? null : num; // Проверяем, что это число
    })
    .filter(num => num !== null); // Удаляем null значения
}


export const utils = {
    escapeMarkdownV2,
    getHasMarkdownV2Status,
    formattedText,
    formatingResponseAiContent,
    parseNumbers,
}
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

export const utils = {
    escapeMarkdownV2,
    getHasMarkdownV2Status,
    formattedText,
    formatingResponseAiContent,
}
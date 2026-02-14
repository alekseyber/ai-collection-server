import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// Создаем инстанс Axios с базовыми настройками
const apiClient: AxiosInstance = axios.create({
//  baseURL: process.env.API_BASE_URL || 'https://api.example.com', // Базовый URL
  timeout: 10000, // Таймаут запроса (мс)
  headers: {
    'Content-Type': 'application/json',
    // Добавьте общие заголовки (например, токен аутентификации)
    // 'Authorization': `Bearer ${token}`,
  },
});

// Интерцептор для запросов
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {

    // Логирование запроса
  //  console.log('Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    // Обработка ошибок запроса
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);


// Интерцептор для ответов
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Логирование успешного ответа
    console.log('Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    // Обработка ошибок ответа
    if (error.response) {
      // Сервер вернул статус 4xx/5xx
      console.error('Server Error:', error.response.status, error.response.data);
    } else if (error.request) {
      // Запрос отправлен, но ответ не получен
      console.error('No Response Received:', error.request);
    } else {
      // Ошибка при настройке запроса
      console.error('Request Setup Error:', error.message);
    }

    // Передача ошибки дальше
    return Promise.reject(error);
  }
);


// Экспортируем настроенный инстанс
export default apiClient;

// Опционально: экспортируйте типы и утилиты
export type { AxiosResponse };
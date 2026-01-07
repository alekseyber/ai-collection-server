import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { LoadConfig } from 'modules/config/config';


// Опционально: экспортируйте типы и утилиты
export type { AxiosResponse };


export class KinopoiskService {
  private config: LoadConfig;
  private apiClientKinopoisk: AxiosInstance;


  constructor(config: LoadConfig) {
    this.config = config;
    // Создаем инстанс Axios с базовыми настройками
    this.apiClientKinopoisk = axios.create({
      baseURL: 'https://kinopoiskapiunofficial.tech', // Базовый URL
      timeout: 10000, // Ждать ответ не более 10 секунд
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': config.KINOPOISK_API_KEY,
      },
    });

    // Интерцептор для запросов
    this.apiClientKinopoisk.interceptors.request.use(
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
    this.apiClientKinopoisk.interceptors.response.use(
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
  }

  public async getAvpMoviesReating(page?: number): Promise<any> {
    try {
      const response = await this.apiClientKinopoisk.get(`api/v1/kp_users/39230535/votes?page=${page || 1}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching movies:', error);
      return `Error fetching movies: ${JSON.stringify(error)}`
      //throw error;
    }
  }

}
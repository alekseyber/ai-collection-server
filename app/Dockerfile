FROM node:20
WORKDIR /usr/src/app

# Копируем package.json из текущей директории (без ../)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальные файлы проекта
COPY . .

# Запускаем приложение
CMD ["npx", "nodemon", "index.js"]

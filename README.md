# LibrarySystem
## Установка и запуск
Чтобы установить все модули, нужно перейти в каталог с проектом и использовать команду
```sh
npm install
```

http://localhost:8080/
Для запуска и тестов сервера достаточно запустить файл  **main.js**
```sh
node main.js
```
Для запуска и работы сервера в фоне лучше установить **pm2**
```sh
npm install pm2
...
pm2 start main.js
```
Подробнее о pm2 - https://pm2.keymetrics.io/

## Страницы
###### Главная страница
![index.html](demo/index.png)

###### Страница авторизация пользователя
![index.html](demo/dashLogin.png)

###### Страница пользователя
![index.html](demo/dash.png)

###### Страница авторизация администратора
![index.html](demo/adminLogin.png)

###### Страница администратора
![index.html](demo/admin.png)

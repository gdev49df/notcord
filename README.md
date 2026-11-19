# notcord

дискорд-подобная соцсеть: серверы и каналы, личные сообщения, друзья, голосовые каналы (webrtc), файлы и картинки.
стек: cloudflare workers + d1 + durable objects (websocket) + r2, фронт на чистом html/css/js.

## деплой

```bash
npm install
npx wrangler login
npx wrangler d1 create notcord            # id вставить в wrangler.jsonc (database_id)
npx wrangler r2 bucket create notcord-files
npm run db:init:remote                    # применить schema.sql
npm run deploy
```

локально: `npm run db:init && npm run dev` → http://localhost:8787

## что есть
- регистрация/вход по нику и паролю (pbkdf2)
- серверы, приглашения по ссылке `/?join=код`, текстовые и голосовые каналы
- личные сообщения и друзья
- сообщения в реальном времени, «печатает…», удаление своих сообщений
- файлы до 25 мб (картинки и видео показываются в чате)
- голос: webrtc mesh, сигналинг через durable object

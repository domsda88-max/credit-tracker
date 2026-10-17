import webpush from 'web-push';

/**
 * Генерация пары VAPID-ключей для Web Push.
 * Запуск: npm run vapid:gen
 * Результат вставьте в .env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
 */
const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('# Скопируйте в .env:');
console.log(`VAPID_PUBLIC_KEY="${publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${privateKey}"`);

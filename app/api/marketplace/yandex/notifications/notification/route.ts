// Yandex Market's "Проверка URL" checker appends "/notification" to the URL we
// enter, so it requests .../notifications/notification. Re-export the parent
// handlers so that appended path serves the identical PING ack + notification
// logic. runtime is declared locally (Next.js forbids re-exporting it).
export const runtime = 'nodejs'
export { GET, POST } from '../route'

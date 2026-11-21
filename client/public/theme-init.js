// Тема до первого кадра: никакого мигания и splash не того цвета.
// Вынесено в отдельный файл, потому что production CSP (helmet) запрещает inline-скрипты.
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem('credit-tracker-theme');
  } catch (e) {
    /* localStorage может быть недоступен — тогда используем системную тему */
  }
  if (stored === 'warm') stored = 'light';
  if (stored === 'light' || stored === 'dark') {
    document.documentElement.dataset.theme = stored;
  } else {
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = systemDark ? 'dark' : 'light';
  }
})();

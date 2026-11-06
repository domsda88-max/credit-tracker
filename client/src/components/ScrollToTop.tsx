import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * При смене маршрута прокручиваем основной контейнер (main) наверх,
 * иначе скролл остаётся на старом месте после перехода по табам.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const main = document.querySelector('main');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [pathname]);

  return null;
}
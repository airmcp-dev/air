import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);

  // 페이지 이동 시 최상단으로
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  // 스크롤 위치 감지
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollUp = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <button
      onClick={scrollUp}
      aria-label="Scroll to top"
      className={`fixed bottom-6 right-6 z-50 w-10 h-10 rounded-xl
                  bg-surface-3/80 backdrop-blur-md border border-white/[0.08]
                  flex items-center justify-center
                  text-text-muted hover:text-air-500 hover:border-air-500/30
                  transition-all duration-300
                  ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    >
      <i className="fa-solid fa-chevron-up text-xs" />
    </button>
  );
};

export default ScrollToTop;

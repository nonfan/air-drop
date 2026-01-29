// 滚动管理 Hook
import { useEffect, useState } from 'react';

export function useScroll(selector: string, threshold: number = 200) {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const element = document.querySelector(selector);
    if (!element) return;

    const handleScroll = () => {
      setShowScrollTop(element.scrollTop > threshold);
    };

    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, [selector, threshold]);

  const scrollToTop = () => {
    const element = document.querySelector(selector);
    element?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return { showScrollTop, scrollToTop };
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import iconUrl from './assets/icon.png';

// 动态设置 favicon
const setFavicon = (url: string) => {
  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;

  // 设置 apple-touch-icon
  let appleLink = document.querySelector("link[rel~='apple-touch-icon']") as HTMLLinkElement;
  if (!appleLink) {
    appleLink = document.createElement('link');
    appleLink.rel = 'apple-touch-icon';
    document.head.appendChild(appleLink);
  }
  appleLink.href = url;
};

setFavicon(iconUrl);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

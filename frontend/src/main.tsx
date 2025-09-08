import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './pages/App';
import { TopicDetail } from './pages/TopicDetail';

const Router: React.FC = () => {
  const [path, setPath] = useState<string>(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const match = path.match(/^\/topic\/(\d+)\/(\d{4})$/);
  if (match) {
    const topicId = parseInt(match[1], 10);
    const year = parseInt(match[2], 10);
    return <TopicDetail topicId={topicId} year={year} />;
  }
  return <App />;
};

const root = createRoot(document.getElementById('root')!);
root.render(<Router />);

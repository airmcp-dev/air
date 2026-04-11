import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { Home } from '@/pages/home';
import { Enterprise } from '@/pages/enterprise';
import { Support } from '@/pages/support';
import { Foundation } from '@/pages/foundation';
import NotFound from '@/pages/NotFound';

// /docs 접근 시 외부 리다이렉트
const DocsRedirect = () => {
  window.location.href = 'https://docs.airmcp.dev';
  return null;
};

// /community 접근 시 GitHub Discussions로 리다이렉트
const CommunityRedirect = () => {
  window.location.href = 'https://github.com/airmcp-dev/air/discussions';
  return null;
};

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/docs', element: <DocsRedirect /> },
      { path: '/docs/*', element: <DocsRedirect /> },
      { path: '/community', element: <CommunityRedirect /> },
      { path: '/enterprise', element: <Enterprise /> },
      { path: '/support', element: <Support /> },
      { path: '/foundation', element: <Foundation /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

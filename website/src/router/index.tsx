import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { Home } from '@/pages/home';
import { Enterprise } from '@/pages/enterprise';
import { Support } from '@/pages/support';
import { Foundation } from '@/pages/foundation';
import { Issues } from '@/pages/issues';
import NotFound from '@/pages/NotFound';

// /docs 접근 시 외부 리다이렉트
const DocsRedirect = () => {
  window.location.href = 'https://docs.airmcp.dev';
  return null;
};

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/docs', element: <DocsRedirect /> },
      { path: '/docs/*', element: <DocsRedirect /> },
      { path: '/enterprise', element: <Enterprise /> },
      { path: '/support', element: <Support /> },
      { path: '/foundation', element: <Foundation /> },
      { path: '/issues', element: <Issues /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

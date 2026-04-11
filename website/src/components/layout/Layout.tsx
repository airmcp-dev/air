import { type FC } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { ScrollToTop } from '@/components/common';

const Layout: FC = () => (
  <div className="overflow-x-hidden w-full">
    <ScrollToTop />
    <Header />
    <main className="min-h-screen pt-16">
      <Outlet />
    </main>
    <Footer />
  </div>
);

export default Layout;

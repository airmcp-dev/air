import { type FC } from 'react';
import { RouterProvider } from 'react-router-dom';
import { I18nContext } from '@/i18n';
import { useLanguageProvider } from '@/hooks';
import { router } from '@/router';

const App: FC = () => {
  const i18n = useLanguageProvider();

  return (
    <I18nContext.Provider value={i18n}>
      <RouterProvider router={router} />
    </I18nContext.Provider>
  );
};

export default App;

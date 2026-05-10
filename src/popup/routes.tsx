import { useEffect, useState } from 'react';
import { AccountListPage } from './pages/AccountListPage';
import { UnlockPage } from './pages/UnlockPage';
import type { UnlockMode } from './components/forms/UnlockForm';

type PopupRoute = 'accounts' | UnlockMode;

function readRoute(): PopupRoute {
  const hash = window.location.hash.replace('#', '');

  if (hash === 'setup' || hash === 'unlock') {
    return hash;
  }

  return 'accounts';
}

export function PopupRoutes() {
  const [route, setRoute] = useState<PopupRoute>(readRoute);

  useEffect(() => {
    const handleHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (route === 'setup' || route === 'unlock') {
    return <UnlockPage mode={route} onSubmit={() => setRoute('accounts')} />;
  }

  return <AccountListPage />;
}

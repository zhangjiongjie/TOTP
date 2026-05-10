import { useEffect, useState } from 'react';
import { AddAccountPage } from './pages/AddAccountPage';
import { AccountDetailPage } from './pages/AccountDetailPage';
import { AccountListPage } from './pages/AccountListPage';
import { UnlockPage } from './pages/UnlockPage';
import type { UnlockMode } from './components/forms/UnlockForm';

type PopupRoute =
  | { name: 'accounts' }
  | { name: 'add' }
  | { name: 'detail'; accountId: string }
  | { name: UnlockMode };

function readRoute(): PopupRoute {
  const hash = window.location.hash.replace('#', '');

  if (hash === 'add') {
    return { name: 'add' };
  }

  if (hash.startsWith('detail/')) {
    const accountId = hash.slice('detail/'.length);
    if (accountId) {
      return { name: 'detail', accountId };
    }
  }

  if (hash === 'setup' || hash === 'unlock') {
    return { name: hash };
  }

  return { name: 'accounts' };
}

export function PopupRoutes() {
  const [route, setRoute] = useState<PopupRoute>(readRoute);

  useEffect(() => {
    const handleHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  function navigate(nextRoute: PopupRoute) {
    if (nextRoute.name === 'accounts') {
      window.location.hash = '#accounts';
    } else if (nextRoute.name === 'add') {
      window.location.hash = '#add';
    } else if (nextRoute.name === 'detail') {
      window.location.hash = `#detail/${nextRoute.accountId}`;
    } else {
      window.location.hash = `#${nextRoute.name}`;
    }
    setRoute(readRoute());
  }

  if (route.name === 'setup' || route.name === 'unlock') {
    return <UnlockPage mode={route.name} onSubmit={() => navigate({ name: 'accounts' })} />;
  }

  if (route.name === 'add') {
    return (
      <AddAccountPage
        onBack={() => navigate({ name: 'accounts' })}
        onAccountCreated={(accountId) => navigate({ name: 'detail', accountId })}
      />
    );
  }

  if (route.name === 'detail') {
    return (
      <AccountDetailPage
        accountId={route.accountId}
        onBack={() => navigate({ name: 'accounts' })}
        onDeleted={() => navigate({ name: 'accounts' })}
      />
    );
  }

  return <AccountListPage />;
}

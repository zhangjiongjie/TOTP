import { AddAccountPage } from './pages/AddAccountPage';
import { AccountDetailPage } from './pages/AccountDetailPage';
import { AccountListPage } from './pages/AccountListPage';
import { SettingsPage } from './pages/SettingsPage';
import { UnlockPage } from './pages/UnlockPage';

export type PopupRoute =
  | { name: 'accounts' }
  | { name: 'add' }
  | { name: 'settings' }
  | { name: 'detail'; accountId: string }
  | { name: 'setup' | 'unlock' };

interface PopupRoutesProps {
  route: PopupRoute;
  unlockMessage?: string | null;
  onNavigate: (route: PopupRoute) => void;
  onUnlock: (password: string) => void;
}

export function readRoute(hash = window.location.hash): PopupRoute {
  const normalizedHash = hash.replace(/^#/, '');

  if (normalizedHash === 'add') {
    return { name: 'add' };
  }

  if (normalizedHash === 'settings') {
    return { name: 'settings' };
  }

  if (normalizedHash.startsWith('detail/')) {
    const accountId = normalizedHash.slice('detail/'.length);
    if (accountId) {
      return { name: 'detail', accountId };
    }
  }

  if (normalizedHash === 'setup' || normalizedHash === 'unlock') {
    return { name: normalizedHash };
  }

  return { name: 'accounts' };
}

export function writeRoute(route: PopupRoute) {
  const nextHash =
    route.name === 'accounts'
      ? '#accounts'
      : route.name === 'detail'
        ? `#detail/${route.accountId}`
        : `#${route.name}`;

  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}

export function isProtectedRoute(route: PopupRoute) {
  return route.name !== 'setup' && route.name !== 'unlock';
}

export function routesEqual(left: PopupRoute, right: PopupRoute) {
  return (
    left.name === right.name &&
    (left.name !== 'detail' || right.name !== 'detail' || left.accountId === right.accountId)
  );
}

export function PopupRoutes({
  route,
  unlockMessage = null,
  onNavigate,
  onUnlock
}: PopupRoutesProps) {
  if (route.name === 'setup' || route.name === 'unlock') {
    return (
      <UnlockPage mode={route.name} message={unlockMessage} onSubmit={onUnlock} />
    );
  }

  if (route.name === 'add') {
    return (
      <AddAccountPage
        onBack={() => onNavigate({ name: 'accounts' })}
        onAccountCreated={() => onNavigate({ name: 'accounts' })}
      />
    );
  }

  if (route.name === 'detail') {
    return (
      <AccountDetailPage
        accountId={route.accountId}
        onBack={() => onNavigate({ name: 'accounts' })}
        onDeleted={() => onNavigate({ name: 'accounts' })}
      />
    );
  }

  if (route.name === 'settings') {
    return <SettingsPage onBack={() => onNavigate({ name: 'accounts' })} />;
  }

  return (
    <AccountListPage
      onOpenAdd={() => onNavigate({ name: 'add' })}
      onOpenSettings={() => onNavigate({ name: 'settings' })}
      onOpenDetails={(accountId) => onNavigate({ name: 'detail', accountId })}
    />
  );
}

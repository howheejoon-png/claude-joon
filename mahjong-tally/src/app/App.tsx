import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { TabBar } from '../components/domain';
import { ToastProvider, useToast } from '../components/overlay';
import { Button, IconButton } from '../components/ui';
import { Dashboard } from '../pages/Dashboard';
import { GamesPage } from '../pages/GamesPage';
import { HistoryPage } from '../pages/HistoryPage';
import { JoinPage } from '../pages/JoinPage';
import { Landing } from '../pages/Landing';
import { NewGame } from '../pages/NewGame';
import { RecordRound } from '../pages/RecordRound';
import { RulesPage } from '../pages/RulesPage';
import { Settlement } from '../pages/Settlement';
import { SettingsPage } from '../pages/SettingsPage';
import { navigate, useRoute } from './router';
import { StoreProvider, useStore } from './store';

const TAB_PATHS = new Set(['/home', '/record', '/history', '/settlement', '/settings']);

function useTheme() {
  const { settings } = useStore();
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = settings.theme === 'system' ? (media.matches ? 'light' : 'dark') : settings.theme;
      document.documentElement.dataset.theme = resolved;
      try {
        localStorage.setItem('mt-theme', settings.theme);
      } catch {
        // Theme hint is a convenience only; IndexedDB holds the real setting.
      }
      const color = resolved === 'light' ? '#f3f1ea' : '#0d0f0e';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);
}

function useServiceWorker() {
  const toast = useToast();
  const [needRefresh, setNeedRefresh] = useState<null | (() => void)>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(() => () => void update(true));
      },
      onOfflineReady() {
        toast({ message: 'Ready to work offline.', tone: 'success' });
      },
    });
  }, [toast]);
  return { needRefresh, dismiss: () => setNeedRefresh(null) };
}

function Shell() {
  const store = useStore();
  const route = useRoute();
  useTheme();
  const sw = useServiceWorker();
  const toast = useToast();

  // Opening the app (or its home-screen icon) goes straight back to the game in progress.
  const resumed = useRef(false);
  useEffect(() => {
    if (store.status !== 'ready' || resumed.current) return;
    resumed.current = true;
    if (route.path === '/' && store.activeGame) navigate('/home', { replace: true });
  }, [store.status, store.activeGame, route.path]);

  // Messages from the sync loop (e.g. a change that another phone's edit made impossible).
  const lastNotice = useRef(0);
  useEffect(() => {
    const n = store.notice;
    if (n && n.id !== lastNotice.current) {
      lastNotice.current = n.id;
      toast({ message: n.message, tone: n.tone });
    }
  }, [store.notice, toast]);

  // Redirect away from pages that need house rules before they exist.
  useEffect(() => {
    if (store.status === 'ready' && route.path === '/rules' && route.params.get('target') === 'game' && !store.activeGame) {
      navigate('/settings', { replace: true });
    }
  }, [store.status, store.activeGame, route]);

  if (store.status === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center" aria-busy="true">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-surface-3" />
      </div>
    );
  }
  if (store.status === 'error') {
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <AlertTriangle className="mx-auto text-negative" size={36} />
        <h1 className="mt-4 text-[22px] font-semibold">Storage unavailable</h1>
        <p className="mt-2 text-[15px] text-ink-2">
          Mahjong Tally could not open on-device storage ({store.loadError}). Private browsing modes can block it. Open the app in a normal browser window.
        </p>
      </main>
    );
  }

  const isTab = TAB_PATHS.has(route.path);
  let page: React.ReactNode;
  const joinCode = route.path.startsWith('/join/') ? route.path.slice('/join/'.length) : null;
  switch (joinCode !== null ? '/join' : route.path) {
    case '/join':
      page = <JoinPage key={joinCode} code={joinCode ?? ''} />;
      break;
    case '/':
      page = <Landing />;
      break;
    case '/new':
      page = <NewGame />;
      break;
    case '/rules': {
      const t = route.params.get('target');
      const target = t === 'house' || t === 'game' ? t : 'setup';
      page = <RulesPage key={target} target={target} />;
      break;
    }
    case '/games':
      page = <GamesPage />;
      break;
    case '/home':
      page = <Dashboard />;
      break;
    case '/record':
      page = <RecordRound editId={route.params.get('edit') ?? undefined} />;
      break;
    case '/history':
      page = <HistoryPage openId={route.params.get('open') ?? undefined} />;
      break;
    case '/settlement':
      page = <Settlement />;
      break;
    case '/settings':
      page = <SettingsPage />;
      break;
    default:
      page = <Landing />;
  }

  return (
    <>
      {store.saveError ? (
        <div role="alert" className="sticky top-0 z-50 flex items-center gap-2 bg-negative px-4 pb-2 pt-[max(env(safe-area-inset-top),8px)] text-[13px] font-medium text-white">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1">{store.saveError}</span>
          <IconButton label="Dismiss" className="h-8 w-8 text-white hover:bg-white/10" onClick={store.dismissSaveError}>
            <X size={16} />
          </IconButton>
        </div>
      ) : null}
      {sw.needRefresh ? (
        <div className="glass fixed inset-x-3 top-[max(env(safe-area-inset-top),12px)] z-[55] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-gold/30 px-4 py-3 elev-2">
          <RefreshCw size={18} className="shrink-0 text-gold" />
          <span className="flex-1 text-[14px]">A new version is available.</span>
          <Button size="sm" variant="gold" onClick={() => sw.needRefresh?.()}>
            Update
          </Button>
          <IconButton label="Later" className="h-8 w-8" onClick={sw.dismiss}>
            <X size={16} />
          </IconButton>
        </div>
      ) : null}
      {isTab ? (
        <>
          <main key={route.path} className="mx-auto max-w-lg px-4 pt-safe animate-fade-in">
            {page}
            <div className="tab-spacer" aria-hidden="true" />
          </main>
          <TabBar path={route.path} />
        </>
      ) : (
        <div key={route.path} className="animate-fade-in">
          {page}
        </div>
      )}
    </>
  );
}

export function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreProvider>
  );
}

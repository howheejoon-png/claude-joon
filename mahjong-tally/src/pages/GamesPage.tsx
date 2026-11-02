import { useState } from 'react';
import { FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { navigate } from '../app/router';
import { useStore } from '../app/store';
import { Amount, PageHeader } from '../components/domain';
import { ConfirmDialog, Sheet, useToast } from '../components/overlay';
import { Badge, Button, Card, EmptyState, IconButton, TextInput } from '../components/ui';
import { activeRounds, gameBalances } from '../engine/game';
import type { GameSession } from '../models/types';
import { formatDateTime } from '../utils/time';

export function GamesPage() {
  const store = useStore();
  const toast = useToast();
  const [toDelete, setToDelete] = useState<GameSession | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState('');

  const open = (g: GameSession) => {
    store.openGame(g.id);
    navigate('/home');
  };

  return (
    <main className="mx-auto max-w-lg px-4 pb-16 pt-safe">
      <PageHeader title="Saved games" subtitle="Stored on this device" back={store.activeGame ? '/settings' : '/'} />
      {store.unreadable.length ? (
        <Card className="mb-3 border-negative/30 p-4 text-[13px] text-negative">
          {store.unreadable.length} saved game record{store.unreadable.length > 1 ? 's' : ''} could not be read and {store.unreadable.length > 1 ? 'were' : 'was'} left untouched:{' '}
          {store.unreadable.map((u) => u.reason).join('; ')}
        </Card>
      ) : null}
      {store.games.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={28} />}
          title="No saved games"
          body="Games you start are saved here automatically."
          action={
            <Button variant="primary" block icon={<Plus size={18} />} onClick={() => navigate(store.settings.houseRules ? '/new' : '/rules?target=setup')}>
              Start New Game
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {store.games.map((g) => {
            const balances = gameBalances(g);
            const isActive = g.id === store.settings.activeGameId;
            return (
              <Card as="li" key={g.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[16px] font-semibold">{g.name}</span>
                      {isActive ? <Badge tone="emerald">Open</Badge> : null}
                      {g.status === 'finished' ? <Badge>Finished</Badge> : null}
                    </div>
                    <div className="text-[12px] text-ink-3">
                      {activeRounds(g).length} rounds · {g.config.stakeLabel} · {formatDateTime(g.updatedAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0">
                    <IconButton
                      label={`Rename ${g.name}`}
                      onClick={() => {
                        setRenaming(g.id);
                        setName(g.name);
                      }}
                    >
                      <Pencil size={17} />
                    </IconButton>
                    <IconButton label={`Delete ${g.name}`} onClick={() => setToDelete(g)}>
                      <Trash2 size={17} />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                  {g.players.map((p) => (
                    <div key={p.id} className="rounded-xl bg-surface-2 px-1 py-2">
                      <div className="truncate text-[11px] text-ink-3">{p.name}</div>
                      <Amount cents={balances.find((b) => b.playerId === p.id)?.netCents ?? 0} className="text-[13px] font-semibold" />
                    </div>
                  ))}
                </div>
                <Button className="mt-3" block variant={isActive ? 'primary' : 'secondary'} onClick={() => open(g)}>
                  {isActive ? 'Go to scoreboard' : 'Open game'}
                </Button>
              </Card>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this game permanently?"
        confirmLabel="Delete game"
        body={
          <>
            “{toDelete?.name}” and all {toDelete ? activeRounds(toDelete).length : 0} of its rounds will be removed from this device. This cannot be undone. Export a backup first if
            you might need it.
          </>
        }
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await store.deleteGame(toDelete.id);
          setToDelete(null);
          toast({ message: 'Game deleted.', tone: 'info' });
        }}
      />
      <Sheet
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Rename game"
        labelledBy="rename-title"
        footer={
          <Button
            variant="primary"
            block
            disabled={!name.trim()}
            onClick={() => {
              if (!renaming) return;
              const r = store.renameGame(renaming, name);
              if (!r.ok) toast({ message: r.errors[0]?.message ?? 'Rename failed.', tone: 'error' });
              setRenaming(null);
            }}
          >
            Save name
          </Button>
        }
      >
        <TextInput aria-label="Game name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </Sheet>
    </main>
  );
}

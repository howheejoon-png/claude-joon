import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Database, Download, FolderOpen, Moon, Radio, RotateCcw, Scale, Smartphone, Sun, SunMoon, Upload, UserRound, Users } from 'lucide-react';
import { navigate } from '../app/router';
import { useStore } from '../app/store';
import { PageHeader, SeatBadge } from '../components/domain';
import { InstallGuide } from '../components/InstallGuide';
import { ConfirmDialog, Sheet, useToast } from '../components/overlay';
import { Button, Card, ErrorList, SectionTitle, Segmented, TextInput, cx } from '../components/ui';
import { SEAT_LABEL } from '../config/defaults';
import { activeRounds } from '../engine/game';
import { validatePlayers } from '../engine/validation';
import { SEATS, type Player, type Seat, type ValidationIssue } from '../models/types';
import { parseBackup, type BackupFile, type ThemePreference } from '../storage/schema';
import { downloadFile } from '../utils/report';
import { RulesSummary } from './RulesSummary';
import { SharePanel } from '../components/Share';

function Row({ icon, label, detail, onClick, testId }: { icon: React.ReactNode; label: string; detail?: string; onClick: () => void; testId?: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className="pressable flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-emerald">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {detail ? <span className="block truncate text-[12px] text-ink-3">{detail}</span> : null}
      </span>
      <ChevronRight size={18} className="text-ink-3" />
    </button>
  );
}

export function SettingsPage() {
  const store = useStore();
  const toast = useToast();
  const game = store.activeGame;
  const [playersOpen, setPlayersOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    navigator.storage
      ?.persisted?.()
      .then((v) => alive && setPersisted(v))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const [importState, setImportState] = useState<{ backup?: BackupFile; errors?: ValidationIssue[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportBackup = async () => {
    const backup = await store.exportBackup();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`mahjong-tally-backup-${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json');
    toast({ message: `Backup saved with ${backup.games.length} game${backup.games.length === 1 ? '' : 's'}.`, tone: 'success' });
  };

  const onFile = async (file: File) => {
    try {
      const raw: unknown = JSON.parse(await file.text());
      const parsed = parseBackup(raw);
      setImportState(parsed.ok ? { backup: parsed.value } : { errors: parsed.errors });
    } catch {
      setImportState({ errors: [{ code: 'JSON', message: 'That file is not valid JSON.', severity: 'error' }] });
    }
  };

  const runImport = async (mode: 'merge' | 'replace') => {
    if (!importState?.backup) return;
    try {
      const n = await store.importBackup(importState.backup, mode);
      toast({ message: `Imported ${n} game${n === 1 ? '' : 's'}.`, tone: 'success' });
      setImportState(null);
    } catch (e) {
      setImportState({ errors: [{ code: 'IMPORT', message: e instanceof Error ? e.message : 'Import failed.', severity: 'error' }] });
    }
  };

  return (
    <div>
      <PageHeader title="Settings" />

      <SectionTitle>Appearance</SectionTitle>
      <Segmented<ThemePreference>
        label="Theme"
        value={store.settings.theme}
        onChange={(t) => store.setTheme(t)}
        options={[
          { value: 'system', label: <span className="inline-flex items-center gap-1.5"><SunMoon size={15} /> Auto</span> },
          { value: 'dark', label: <span className="inline-flex items-center gap-1.5"><Moon size={15} /> Dark</span> },
          { value: 'light', label: <span className="inline-flex items-center gap-1.5"><Sun size={15} /> Light</span> },
        ]}
      />

      {game ? (
        <>
          <SectionTitle>Current game</SectionTitle>
          <Card as="div" className="divide-y divide-line overflow-hidden p-0">
            <Row icon={<Users size={17} />} label="Players & seats" detail={game.players.map((p) => p.name).join(', ')} onClick={() => setPlayersOpen(true)} testId="edit-players" />
            <Row icon={<Scale size={17} />} label="Scoring rules for this game" detail={`${game.config.name} · applies to new rounds`} onClick={() => navigate('/rules?target=game')} testId="edit-game-rules" />
            <Row icon={<RotateCcw size={17} />} label="Reset scoresheet" detail={`${activeRounds(game).length} rounds — restorable from History`} onClick={() => setResetOpen(true)} />
          </Card>

          <SectionTitle>Playing on several phones</SectionTitle>
          <Card as="div" className="divide-y divide-line overflow-hidden p-0">
            <Row
              icon={<Radio size={17} />}
              label={store.activeShare ? 'Live game link' : 'Share this game live'}
              detail={store.activeShare ? 'On · every phone with the link sees and records' : 'Each player follows on their own phone'}
              onClick={() => setShareOpen(true)}
              testId="settings-share"
            />
            <Row
              icon={<UserRound size={17} />}
              label="This phone belongs to"
              detail={store.me ? store.me.name : 'Not set — tap to choose'}
              onClick={() => setShareOpen(true)}
            />
          </Card>
        </>
      ) : null}

      <SectionTitle>House rules (default for new games)</SectionTitle>
      {store.settings.houseRules ? (
        <>
          <RulesSummary config={store.settings.houseRules} compact />
          <Button className="mt-2" block onClick={() => navigate('/rules?target=house')}>
            Edit payout table & house rules
          </Button>
        </>
      ) : (
        <Card className="p-4">
          <p className="text-[14px] text-ink-2">You haven’t confirmed house rules yet.</p>
          <Button className="mt-3" variant="primary" block onClick={() => navigate('/rules?target=setup')}>
            Set up house rules
          </Button>
        </Card>
      )}

      <SectionTitle>Data</SectionTitle>
      <Card as="div" className="divide-y divide-line overflow-hidden p-0">
        <Row icon={<FolderOpen size={17} />} label="Manage saved games" detail={`${store.games.length} on this device`} onClick={() => navigate('/games')} />
        <Row icon={<Download size={17} />} label="Export backup" detail="All games and rules as a .json file" onClick={exportBackup} />
        <Row icon={<Upload size={17} />} label="Import backup" detail="Verified before anything is changed" onClick={() => fileRef.current?.click()} />
        <Row icon={<Smartphone size={17} />} label="Install on your phone" detail="Works offline from the home screen" onClick={() => setInstallOpen(true)} />
      </Card>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Backup file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = '';
        }}
      />

      <Card className="mt-6 p-4">
        <div className="flex gap-3">
          <Database size={18} className="mt-0.5 shrink-0 text-gold" />
          <p className="text-[13px] leading-relaxed text-ink-3">
            Every game is saved on this phone after every change. Games you share live are also kept in your private Mahjong Tally database, so opening the game link
            restores them on any phone. Games you don’t share never leave this phone: clearing browser data deletes them, so export a backup now and then.
          </p>
          {persisted === false ? (
            <p className="mt-2 text-[13px] leading-relaxed text-gold" data-testid="storage-warning">
              This browser may clear saved games when it needs space, or when a private tab or in-app browser closes. Open the app from your home screen (Settings → Install
              on your phone) so games are kept.
            </p>
          ) : persisted ? (
            <p className="mt-2 text-[13px] text-positive">Saved games are kept permanently on this phone.</p>
          ) : null}
        </div>
      </Card>
      <p className="mt-4 text-center text-[12px] text-ink-3">Mahjong Tally v1.0 · Every point accounted for.</p>

      {game ? <PlayersSheet open={playersOpen} onClose={() => setPlayersOpen(false)} players={game.players} /> : null}
      <InstallGuide open={installOpen} onClose={() => setInstallOpen(false)} />
      <SharePanel open={shareOpen} onClose={() => setShareOpen(false)} />
      <ConfirmDialog
        open={resetOpen}
        title="Reset the scoresheet?"
        confirmLabel="Reset"
        body="Every round in this game will be deleted and all balances return to $0.00. Deleted rounds can still be restored from History until you clear them."
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          const r = store.resetGame();
          setResetOpen(false);
          toast(r.ok ? { message: 'Scoresheet reset.', tone: 'info' } : { message: r.errors[0]?.message ?? 'Reset failed.', tone: 'error' });
        }}
      />
      <Sheet open={importState !== null} onClose={() => setImportState(null)} title="Import backup" labelledBy="import-title">
        {importState?.errors ? (
          <div className="space-y-3">
            <p className="text-[14px] text-ink-2">The backup was not imported because it failed verification:</p>
            <ErrorList errors={importState.errors} />
          </div>
        ) : importState?.backup ? (
          <div className="space-y-4">
            <p className="text-[15px] text-ink-2">
              This backup contains <strong className="text-ink">{importState.backup.games.length}</strong> verified game
              {importState.backup.games.length === 1 ? '' : 's'}
              {importState.backup.exportedAt ? `, exported ${new Date(importState.backup.exportedAt).toLocaleString()}` : ''}. Every ledger was checked and balances to $0.00.
            </p>
            <Button block variant="primary" onClick={() => runImport('merge')}>
              Merge with games on this device
            </Button>
            <Button block variant="danger" onClick={() => runImport('replace')}>
              Replace all games on this device
            </Button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

function PlayersSheet({ open, onClose, players }: { open: boolean; onClose: () => void; players: Player[] }) {
  const store = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState(players);
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setDraft(players);
      setErrors([]);
    }
  }
  const issues = validatePlayers(draft);
  const setSeat = (index: number, seat: Seat) =>
    setDraft((list) => {
      const other = list.findIndex((p) => p.seat === seat);
      const current = list[index]!.seat;
      return list.map((p, i) => (i === index ? { ...p, seat } : i === other ? { ...p, seat: current } : p));
    });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Players & seats"
      labelledBy="players-title"
      footer={
        <Button
          variant="primary"
          block
          disabled={issues.some((i) => i.severity === 'error')}
          onClick={() => {
            const r = store.updatePlayers(draft);
            if (!r.ok) return setErrors(r.errors);
            toast({ message: 'Players updated.', tone: 'success' });
            onClose();
          }}
        >
          Save players
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-[13px] text-ink-3">Renaming or re-seating never changes recorded payments. Each round keeps who sat where when it was scored.</p>
        {draft.map((p, i) => (
          <div key={p.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <SeatBadge seat={p.seat} />
              <TextInput aria-label={`Player ${i + 1} name`} value={p.name} maxLength={24} onChange={(e) => setDraft((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            </div>
            <div role="radiogroup" aria-label={`Seat for ${p.name}`} className="flex gap-1.5">
              {SEATS.map((seat) => (
                <button
                  key={seat}
                  type="button"
                  role="radio"
                  aria-checked={p.seat === seat}
                  onClick={() => setSeat(i, seat)}
                  className={cx(
                    'pressable min-h-9 flex-1 rounded-lg border text-[12px] font-semibold',
                    p.seat === seat ? 'border-emerald bg-emerald-soft text-positive' : 'border-line bg-surface-2 text-ink-3',
                  )}
                >
                  {SEAT_LABEL[seat]}
                </button>
              ))}
            </div>
          </div>
        ))}
        <ErrorList errors={[...issues.filter((i) => i.severity === 'error'), ...errors]} />
      </div>
    </Sheet>
  );
}

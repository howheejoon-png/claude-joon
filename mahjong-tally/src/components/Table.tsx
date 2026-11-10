import { useState } from 'react';
import { Shuffle } from 'lucide-react';
import { useStore } from '../app/store';
import { FLOWERS, SEAT_GLYPH, SEAT_LABEL, SPIRIT_ANIMALS } from '../config/defaults';
import type { TableState } from '../engine/table';
import type { GameSession, Player, PlayerId, Seat, SpiritAnimal } from '../models/types';
import { SEATS, SPIRIT_ANIMAL_IDS } from '../models/types';
import { Sheet, useToast } from './overlay';
import { Button, ErrorList, cx } from './ui';

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

/** "🐭 Mouse · Flowers 2 蘭 夏" — a player's animal and own flowers for the hand. */
export function PlayerTraits({ player, wind, className }: { player: Player; wind?: Seat | undefined; className?: string }) {
  const animal = player.animal ? SPIRIT_ANIMALS[player.animal] : undefined;
  if (!animal && !wind) return null;
  return (
    <span className={cx('flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-3', className)}>
      {animal ? (
        <span title={`Spirit animal: ${animal.label}`}>
          <span aria-hidden="true">{animal.emoji}</span> {animal.label}
        </span>
      ) : null}
      {wind ? (
        <span title={`Own flowers: ${FLOWERS[wind].names}`}>
          Flowers {FLOWERS[wind].number} <span className="font-display">{FLOWERS[wind].glyphs}</span>
        </span>
      ) : null}
    </span>
  );
}

/** Dashboard strip: round wind, hand number and dealer. Tap to correct them. */
export function TableStrip({ game, state }: { game: GameSession; state: TableState }) {
  const [open, setOpen] = useState(false);
  const dealer = game.players.find((p) => p.id === state.dealerId);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="table-strip"
        className="pressable mb-3 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 px-3.5 py-2.5 text-left hover:border-line-strong"
      >
        <span className="flex h-10 w-9 shrink-0 items-center justify-center rounded-[10px] border border-black/10 bg-tile font-display text-[20px] font-semibold text-tile-ink shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]">
          {SEAT_GLYPH[state.prevailingWind]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink" data-testid="table-round">
            {SEAT_LABEL[state.prevailingWind]} round · Hand {state.handNumber}
          </span>
          <span className="block truncate text-[13px] text-ink-3" data-testid="table-dealer">
            {dealer ? (
              <>
                Dealer <span className="font-semibold text-gold">{dealer.name}</span>
                {state.dealerStreak > 0 ? ` · ${ordinal(state.dealerStreak + 1)} hand in a row` : ''}
              </>
            ) : (
              'Dealer not tracked · tap to set'
            )}
            {state.fullCircleDone ? ' · All four winds played' : ''}
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-semibold text-emerald">Change</span>
      </button>
      <NextHandSheet open={open} onClose={() => setOpen(false)} game={game} state={state} />
    </>
  );
}

/** Set who deals next and the round wind (for starting part-way through, or corrections). */
function NextHandSheet({ open, onClose, game, state }: { open: boolean; onClose: () => void; game: GameSession; state: TableState }) {
  const store = useStore();
  const toast = useToast();
  const [dealerId, setDealerId] = useState<PlayerId | undefined>(state.dealerId);
  const [wind, setWind] = useState<Seat>(state.prevailingWind);
  const [first, setFirst] = useState<PlayerId | undefined>(state.firstDealerId);
  const [errors, setErrors] = useState<{ message: string }[]>([]);
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setDealerId(state.dealerId);
      setWind(state.prevailingWind);
      setFirst(state.firstDealerId);
      setErrors([]);
    }
  }
  const chip = (active: boolean) =>
    cx('pressable min-h-11 rounded-xl border px-3 text-[14px] font-semibold', active ? 'border-gold bg-gold-soft text-gold' : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong');
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Next hand"
      labelledBy="next-hand-title"
      footer={
        <Button
          variant="primary"
          block
          disabled={!dealerId}
          data-testid="save-next-hand"
          onClick={() => {
            if (!dealerId) return;
            const r = store.setNextHand({ dealerId, prevailingWind: wind, ...(first ? { firstDealerId: first } : {}) });
            if (!r.ok) return setErrors(r.errors);
            toast({ message: 'Next hand updated.', tone: 'success' });
            onClose();
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-5">
        <p className="text-[14px] leading-relaxed text-ink-3">
          The app moves the deal and the round wind on by itself after each hand. Change them here if you started part-way through a game, or to correct them.
        </p>
        <div>
          <div className="mb-2 text-[14px] font-semibold text-ink">Round wind</div>
          <div role="radiogroup" aria-label="Round wind" className="grid grid-cols-4 gap-2">
            {SEATS.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={wind === s} onClick={() => setWind(s)} className={chip(wind === s)} data-testid={`next-wind-${s}`}>
                <span className="font-display">{SEAT_GLYPH[s]}</span> {SEAT_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[14px] font-semibold text-ink">Who deals the next hand?</div>
          <div role="radiogroup" aria-label="Next dealer" className="grid grid-cols-2 gap-2">
            {game.players.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={dealerId === p.id} onClick={() => setDealerId(p.id)} className={chip(dealerId === p.id)} data-testid={`next-dealer-${p.seat}`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[14px] font-semibold text-ink">First dealer of the game</div>
          <p className="mb-2 text-[13px] text-ink-3">The round wind moves on each time the deal comes back to this player.</p>
          <div role="radiogroup" aria-label="First dealer" className="grid grid-cols-2 gap-2">
            {game.players.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={first === p.id} onClick={() => setFirst(p.id)} className={chip(first === p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <ErrorList errors={errors} />
      </div>
    </Sheet>
  );
}

/** Pick each player's spirit animal (one each; picking a taken animal swaps them). */
export function AnimalPicker({
  players,
  onChange,
}: {
  players: Player[];
  onChange: (players: Player[]) => void;
}) {
  const setAnimal = (index: number, animal: SpiritAnimal | undefined) => {
    const current = players[index]!.animal;
    onChange(
      players.map((p, i) => {
        if (i === index) return animal ? { ...p, animal } : withoutAnimal(p);
        if (animal && p.animal === animal) return current ? { ...p, animal: current } : withoutAnimal(p);
        return p;
      }),
    );
  };
  const drawRandomly = () => {
    const order = [...SPIRIT_ANIMAL_IDS];
    // Fisher–Yates with crypto randomness so the draw is fair.
    for (let i = order.length - 1; i > 0; i -= 1) {
      const buf = new Uint32Array(1);
      globalThis.crypto.getRandomValues(buf);
      const j = buf[0]! % (i + 1);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    onChange(players.map((p, i) => ({ ...p, animal: order[i]! })));
  };
  return (
    <div className="space-y-3">
      {players.map((p, i) => (
        <div key={p.id} className="flex items-center gap-2">
          <span className="w-20 shrink-0 truncate text-[14px] font-medium text-ink-2">{p.name || `Player ${i + 1}`}</span>
          <div role="radiogroup" aria-label={`Spirit animal for ${p.name || `player ${i + 1}`}`} className="grid flex-1 grid-cols-4 gap-1.5">
            {SPIRIT_ANIMAL_IDS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={p.animal === a}
                aria-label={SPIRIT_ANIMALS[a].label}
                title={SPIRIT_ANIMALS[a].label}
                data-testid={`animal-${i}-${a}`}
                onClick={() => setAnimal(i, p.animal === a ? undefined : a)}
                className={cx(
                  'pressable flex min-h-10 items-center justify-center rounded-lg border text-[18px]',
                  p.animal === a ? 'border-gold bg-gold-soft' : 'border-line bg-surface-2 opacity-70 hover:opacity-100',
                )}
              >
                <span aria-hidden="true">{SPIRIT_ANIMALS[a].emoji}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button size="sm" variant="gold" block icon={<Shuffle size={14} />} onClick={drawRandomly} data-testid="draw-animals">
        Draw animals randomly
      </Button>
    </div>
  );
}

function withoutAnimal(p: Player): Player {
  const { animal: _a, ...rest } = p;
  return rest;
}

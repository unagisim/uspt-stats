// Informations d'un match mises en forme pour les exports.

import type { StoredMatch } from '../db';
import { FORMATS, replay, setsSummary, type ReplayResult } from '../engine';
import { fullName, shortName } from '../names';

import { SURFACE_LABELS as SURFACES } from '../labels';

const pad = (n: number) => String(n).padStart(2, '0');

export const formatDate = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const isoDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const name = fullName;

/** Sans accents ni caractères spéciaux, pour les noms de fichiers. */
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export interface MatchInfo {
  replay: ReplayResult;
  full: { A: string; B: string };
  short: { A: string; B: string };
  title: string;
  date: string;
  /** Tournoi, lieu, surface, format. */
  details: string[];
  score: string;
  result: string;
  fileBase: string;
}

export function matchInfo(m: StoredMatch): MatchInfo {
  const format = FORMATS[m.formatId];
  const r = replay({ format, firstServer: m.firstServer, letEnabled: m.letEnabled }, m.events);
  const full = { A: name(m.players.A), B: name(m.players.B) };
  const short = { A: shortName(m.players.A), B: shortName(m.players.B) };
  const fileNames = { A: m.players.A.nom || m.players.A.prenom, B: m.players.B.nom || m.players.B.prenom };

  const details: string[] = [];
  if (m.context.tournoi) details.push(m.context.tournoi + (m.context.tour ? ` (${m.context.tour})` : ''));
  if (m.context.lieu) details.push(m.context.lieu);
  if (m.context.surface) details.push(SURFACES[m.context.surface] ?? m.context.surface);
  details.push(`${format.label} : ${format.description}`);

  const s = r.state;
  const parts = setsSummary(s);
  if (!s.winner && (s.games.A || s.games.B)) parts.push(`${s.games.A}-${s.games.B}`);

  let result = 'Match en cours';
  if (s.winner) {
    result = `Victoire de ${full[s.winner]}`;
    if (s.endReason === 'retirement') result += ' par abandon';
    if (s.endReason === 'walkover') result += ' par forfait';
  }

  return {
    replay: r,
    full,
    short,
    title: `${full.A} contre ${full.B}`,
    date: formatDate(m.createdAt),
    details,
    score: parts.join('  ') || '–',
    result,
    fileBase: `match_${slug(fileNames.A)}-${slug(fileNames.B)}_${isoDate(m.createdAt)}`,
  };
}

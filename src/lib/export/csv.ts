// Exports CSV : séparateur « ; » et BOM UTF-8 pour une ouverture directe dans Excel en français.

import type { StoredMatch } from '../db';
import { ENDING, END_ZONE, POSITION, RALLY, SERVE_OUTCOME, SERVE_ZONE, SHOT, SPIN } from '../labels';
import { computeGameStats, computeStats } from '../stats';
import { formatTime, matchInfo } from './meta';
import { noteRows, statRows, timingRows } from './rows';

const BOM = '﻿';

export function csvCell(v: string | number | undefined | null): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const toCsv = (rows: (string | number | undefined)[][]) =>
  BOM + rows.map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';

const yes = (b: boolean) => (b ? 'oui' : '');

/** Une ligne par point joué. */
export function pointsCsv(m: StoredMatch): string {
  const info = matchInfo(m);
  const n = info.short;
  const header = [
    'N°', 'Heure', 'Set', 'Jeu', 'Jeux avant', 'Score avant', 'Jeu décisif', 'Serveur', 'Gagnant',
    'Balle de break', 'Balle de set', 'Balle de match', 'Point décisif',
    'Service', '1re balle', 'Lets', 'Zone de service', 'Fin du point', 'Coup', 'Effet',
    'Position', 'Montée au filet', 'Zone de fin', 'Échange', 'Note',
  ];
  const rows = info.replay.points.map((p, i) => {
    const d = p.details ?? {};
    const sit = p.situation;
    return [
      i + 1,
      formatTime(p.ts),
      p.setNumber,
      p.superTiebreak ? 'Super jeu décisif' : p.gameNumber,
      p.superTiebreak ? '' : `${p.gamesBefore.A}-${p.gamesBefore.B}`,
      `${p.scoreBefore.A}-${p.scoreBefore.B}`,
      yes(p.inTiebreak),
      n[p.server],
      n[p.winner],
      yes(sit.breakPoint),
      sit.setPoint ? n[sit.setPoint] : '',
      sit.matchPoint ? n[sit.matchPoint] : '',
      yes(sit.decidingPoint),
      d.serveOutcome ? SERVE_OUTCOME[d.serveOutcome] : '',
      d.firstServeIn === undefined ? '' : d.firstServeIn ? 'passée' : 'faute',
      d.lets ?? '',
      d.serveZone ? SERVE_ZONE[d.serveZone] : '',
      d.ending ? ENDING[d.ending] : '',
      d.shot ? SHOT[d.shot] : '',
      d.spin ? SPIN[d.spin] : '',
      d.position ? POSITION[d.position] : '',
      d.netApproach === undefined ? '' : d.netApproach ? 'oui' : 'non',
      d.endZone ? END_ZONE[d.endZone] : '',
      d.rally ? RALLY[d.rally] : '',
      d.note ?? '',
    ];
  });
  return toCsv([header, ...rows]);
}

/** Synthèse des stats : match entier puis chaque set. */
export function statsCsv(m: StoredMatch): string {
  const info = matchInfo(m);
  const points = info.replay.points;
  const games = info.replay.games;
  const sets = [...new Set([...points.map((p) => p.setNumber), ...games.map((g) => g.setNumber)])].sort((a, b) => a - b);
  const rows: (string | number)[][] = [
    ['Match', info.title],
    ['Date', info.date],
    ['Score', info.score],
    ['Résultat', info.result],
    ...timingRows(info.replay.timeline),
    [],
    ['Périmètre', 'Rubrique', 'Statistique', info.full.A, info.full.B],
  ];
  const scopes: [string, number | undefined][] = [['Match', undefined]];
  if (sets.length > 1) sets.forEach((k) => scopes.push([`Set ${k}`, k]));
  for (const [scope, k] of scopes) {
    const g = computeGameStats(games, k);
    // Stats par jeu : si des jeux ont été saisis sans points, ou si aucun point n'a été saisi.
    const withGames = g.hasGameOnly || points.length === 0 ? { ...g, hasGameOnly: true } : undefined;
    for (const r of statRows(computeStats(points, k), withGames)) rows.push([scope, r.section, r.label, r.a, r.b]);
  }

  const notes = noteRows(info.replay.notes, points, info.short);
  if (notes.length) {
    rows.push([], ['Notes du coach'], ['Moment', 'Joueur', 'Thèmes', 'Commentaire', 'Dernier point']);
    for (const n of notes) rows.push([n.moment, n.player, n.tags.join(', '), n.text, n.after]);
  }
  return toCsv(rows);
}

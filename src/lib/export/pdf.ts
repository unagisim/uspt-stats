// Export PDF de la feuille de match (A4). Chargé à la demande pour ne pas alourdir l'application.

import { jsPDF } from 'jspdf';
import { autoTable, type RowInput } from 'jspdf-autotable';
import type { StoredMatch } from '../db';
import { computeStats, formatDuration, type MatchStats } from '../stats';
import { formatDate, matchInfo, type MatchInfo } from './meta';
import { noteRows, statRows } from './rows';

type RGB = [number, number, number];
const BLUE: RGB = [24, 95, 165];
const GREEN: RGB = [15, 110, 86];
const BLUE_BG: RGB = [220, 235, 250];
const GREEN_BG: RGB = [214, 241, 231];
const GREY: RGB = [95, 102, 112];
const LIGHT: RGB = [236, 238, 241];

const MARGIN = 15;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const lastY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= PAGE_H - 20) return y;
  doc.addPage();
  return MARGIN;
}

function statsTable(doc: jsPDF, y: number, s: MatchStats, info: MatchInfo) {
  const body: RowInput[] = [];
  let section = '';
  for (const r of statRows(s)) {
    if (r.section !== section) {
      section = r.section;
      body.push([{ content: section, colSpan: 3, styles: { fillColor: LIGHT, fontStyle: 'bold', halign: 'left' } }]);
    }
    body.push([r.a, r.label, r.b]);
  }
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [[info.short.A, 'Statistique', info.short.B]],
    body,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 1.6, halign: 'center', lineColor: [213, 217, 223], lineWidth: 0.2 },
    headStyles: { fillColor: [255, 255, 255], textColor: [21, 23, 26], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 45 }, 2: { cellWidth: 45 } },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 0) data.cell.styles.textColor = BLUE;
      if (data.section === 'head' && data.column.index === 2) data.cell.styles.textColor = GREEN;
      if (data.section === 'body' && data.column.index === 1) data.cell.styles.textColor = GREY;
    },
  });
  return lastY(doc);
}

function momentumChart(doc: jsPDF, y: number, s: MatchStats, info: MatchInfo): number {
  const h = 40;
  const series = [0, ...s.momentum];
  const max = Math.max(3, ...series.map(Math.abs));
  const mid = y + h / 2;
  const x = (i: number) => MARGIN + (series.length > 1 ? (i / (series.length - 1)) * CONTENT_W : 0);
  const yy = (v: number) => mid - (v / max) * (h / 2 - 2);

  doc.setFillColor(...BLUE_BG);
  doc.rect(MARGIN, y, CONTENT_W, h / 2, 'F');
  doc.setFillColor(...GREEN_BG);
  doc.rect(MARGIN, mid, CONTENT_W, h / 2, 'F');

  doc.setDrawColor(180, 185, 192);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1], 0);
  for (const i of s.setStarts) doc.line(x(i), y, x(i), y + h);
  doc.setLineDashPattern([], 0);
  doc.line(MARGIN, mid, MARGIN + CONTENT_W, mid);

  doc.setDrawColor(21, 23, 26);
  doc.setLineWidth(0.5);
  for (let i = 1; i < series.length; i++) doc.line(x(i - 1), yy(series[i - 1]), x(i), yy(series[i]));

  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text(`${info.short.A} mène`, MARGIN + 1.5, y + 4);
  doc.setTextColor(...GREEN);
  doc.text(`${info.short.B} mène`, MARGIN + 1.5, y + h - 2);
  doc.setTextColor(0, 0, 0);
  return y + h;
}

function heading(doc: jsPDF, y: number, text: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(21, 23, 26);
  doc.text(text, MARGIN, y);
  doc.setFont('helvetica', 'normal');
  return y + 3;
}

export function buildMatchPdf(m: StoredMatch): { blob: Blob; fileName: string } {
  const info = matchInfo(m);
  const points = info.replay.points;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({ title: info.title, creator: 'USPT Stats' });

  // En-tête
  let y = MARGIN + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(info.title, MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...GREY);
  doc.text([info.date, ...info.details].join('  ·  '), MARGIN, y, { maxWidth: CONTENT_W });
  y += doc.splitTextToSize([info.date, ...info.details].join('  ·  '), CONTENT_W).length * 4.5 + 3;

  // Score
  doc.setFillColor(...LIGHT);
  doc.roundedRect(MARGIN, y, CONTENT_W, 16, 2, 2, 'F');
  doc.setTextColor(21, 23, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(info.score, MARGIN + 5, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const all = computeStats(points);
  const extra = all.durationMs && all.durationMs >= 60_000 ? `  ·  durée ${formatDuration(all.durationMs)}` : '';
  doc.text(`${info.result}  ·  ${all.totalPoints} points joués${extra}`, MARGIN + 5, y + 12.5);
  y += 24;

  if (points.length === 0) {
    doc.text('Aucun point saisi.', MARGIN, y);
    y += 10;
  } else {
    y = heading(doc, y, 'Momentum');
    y = momentumChart(doc, y, all, info) + 9;
  }

  const notes = noteRows(info.replay.notes, points, info.short);
  if (notes.length) {
    y = ensureSpace(doc, y, 30);
    y = heading(doc, y, `Notes du coach (${notes.length})`);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Moment', 'Joueur', 'Thèmes', 'Commentaire']],
      body: notes.map((n) => [n.moment + (n.after ? `\n${n.after}` : ''), n.player, n.tags.join(', '), n.text]),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 1.6, valign: 'top', lineColor: [213, 217, 223], lineWidth: 0.2 },
      headStyles: { fillColor: LIGHT, textColor: [21, 23, 26], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: 24 }, 2: { cellWidth: 34 } },
    });
    y = lastY(doc) + 9;
  }

  if (points.length > 0) {
    y = ensureSpace(doc, y, 40);
    y = heading(doc, y, 'Statistiques du match');
    y = statsTable(doc, y, all, info) + 9;

    const sets = [...new Set(points.map((p) => p.setNumber))];
    if (sets.length > 1) {
      for (const k of sets) {
        y = ensureSpace(doc, y, 40);
        y = heading(doc, y, `Set ${k}`);
        y = statsTable(doc, y, computeStats(points, k), info) + 9;
      }
    }
  }

  // Pied de page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(`USPT Stats · généré le ${formatDate(Date.now())}`, MARGIN, PAGE_H - 8);
    doc.text(`${i}/${pages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
  }

  return { blob: doc.output('blob'), fileName: `${info.fileBase}.pdf` };
}

// Mise en forme des noms de joueurs (sans dépendance, utilisable partout).

export interface PersonName {
  prenom: string;
  nom: string;
}

export const fullName = (p: PersonName) => `${p.prenom} ${p.nom}`.trim();

/** Nom court pour l'affichage pendant le match : "L. Martin" (ou le seul mot saisi). */
export function shortName(p: PersonName): string {
  if (!p.prenom) return p.nom;
  if (!p.nom) return p.prenom;
  return `${p.prenom.charAt(0).toLocaleUpperCase('fr')}. ${p.nom}`;
}

/** "Léo Martin" -> prénom "Léo", nom "Martin". Un seul mot est pris comme nom. */
export function splitName(input: string): PersonName {
  const parts = input.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { prenom: '', nom: parts[0] ?? '' };
  return { prenom: parts[0], nom: parts.slice(1).join(' ') };
}

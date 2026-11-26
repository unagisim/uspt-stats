// État du compte coach, sans dépendance à Firebase : l'interface peut l'afficher
// sans charger le kit Firebase (chargé à part, après l'ouverture de l'application).

export type Role = 'coach' | 'admin';

export interface Coach {
  email: string;
  role: Role;
  name?: string;
}

export const account = $state({
  /** L'état de connexion est connu (après le premier retour de Firebase). */
  ready: false,
  email: null as string | null,
  uid: null as string | null,
  role: null as Role | null,
  /** true : coach du club ; false : adresse non autorisée ; null : pas encore vérifié. */
  authorized: null as boolean | null,
  /** Un lien de connexion a été ouvert sur un appareil qui ne connaît pas l'adresse. */
  needsEmailToFinish: false,
  /** Lien de connexion envoyé (adresse). */
  linkSentTo: null as string | null,
  busy: false,
  error: '',
});

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** Module Firebase du compte, chargé à la demande. */
export const accountApi = () => import('./account');

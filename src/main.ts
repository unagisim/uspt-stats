import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { initPwa } from './lib/pwa.svelte';
import { accountApi } from './lib/cloud/state.svelte';

initPwa();

const app = mount(App, { target: document.getElementById('app')! });

// Compte coach (V2), chargé après le premier affichage pour ne pas ralentir l'ouverture.
// Termine aussi une connexion si l'application est ouverte depuis le lien reçu par e-mail.
accountApi()
  .then((m) => m.initAccount())
  .catch(() => {
    /* hors ligne au premier lancement : le compte sera disponible plus tard */
  });

export default app;

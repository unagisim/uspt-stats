<script lang="ts">
  import { onMount } from 'svelte';
  import {
    db,
    findOrCreatePlayer,
    fullName,
    SURFACES,
    uid,
    type InputMode,
    type Player,
    type Surface,
  } from '../lib/db';

  const MODES: { id: InputMode; label: string; description: string }[] = [
    {
      id: 'games',
      label: 'Jeux',
      description: 'Un tap par jeu gagné, score corrigeable : pour se concentrer sur les notes. Peu de stats.',
    },
    { id: 'quick', label: 'Rapide', description: 'Un tap par point : gagnant, ace, double faute.' },
    { id: 'standard', label: 'Standard', description: '2 à 4 taps : 1re/2e balle, fin du point et coup.' },
    { id: 'expert', label: 'Expert', description: 'En plus : zones, effet, position, longueur de l’échange.' },
  ];
  import { FORMATS, type FormatId, type Side } from '../lib/engine';

  let { onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void } = $props();

  let players = $state<Player[]>([]);
  let nameA = $state('');
  let nameB = $state('');
  let formatId = $state<FormatId>('FFT2');
  let firstServer = $state<Side>('A');
  let letEnabled = $state(false);
  let inputMode = $state<InputMode>('standard');
  let tournoi = $state('');
  let lieu = $state('');
  let surface = $state<Surface | ''>('');
  let error = $state('');
  let saving = $state(false);

  onMount(async () => {
    players = await db.players.orderBy('nom').toArray();
  });

  async function create(e: SubmitEvent) {
    e.preventDefault();
    if (!nameA.trim() || !nameB.trim()) {
      error = 'Saisissez le nom des deux joueurs.';
      return;
    }
    if (nameA.trim().toLowerCase() === nameB.trim().toLowerCase()) {
      error = 'Les deux joueurs doivent être différents.';
      return;
    }
    saving = true;
    const A = await findOrCreatePlayer(nameA);
    const B = await findOrCreatePlayer(nameB);
    const now = Date.now();
    const id = uid();
    await db.matches.add({
      id,
      createdAt: now,
      updatedAt: now,
      formatId,
      firstServer,
      letEnabled,
      inputMode,
      players: { A, B },
      context: {
        ...(tournoi.trim() ? { tournoi: tournoi.trim() } : {}),
        ...(lieu.trim() ? { lieu: lieu.trim() } : {}),
        ...(surface ? { surface } : {}),
      },
      events: [],
      status: 'in_progress',
      winner: null,
    });
    onCreated(id);
  }

  const clearError = () => (error = '');
</script>

<form class="page" onsubmit={create}>
  <header>
    <button type="button" class="ghost back" onclick={onCancel}>‹ Retour</button>
    <h1>Nouveau match</h1>
  </header>

  <datalist id="players">
    {#each players as p (p.id)}
      <option value={fullName(p)}></option>
    {/each}
  </datalist>

  <section class="card">
    <div class="field">
      <label for="pa">Joueur 1</label>
      <input id="pa" list="players" placeholder="Prénom Nom" autocomplete="off" bind:value={nameA} oninput={clearError} />
    </div>
    <div class="field">
      <label for="pb">Joueur 2</label>
      <input id="pb" list="players" placeholder="Prénom Nom" autocomplete="off" bind:value={nameB} oninput={clearError} />
    </div>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </section>

  <section class="card">
    <span class="label">Format</span>
    <div class="formats">
      {#each Object.values(FORMATS) as f (f.id)}
        <button type="button" class="choice" class:selected={formatId === f.id} onclick={() => (formatId = f.id)}>
          <strong>{f.label}</strong>
          <span>{f.description}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="card">
    <span class="label">Premier au service</span>
    <div class="toggle">
      <button type="button" class:selected={firstServer === 'A'} onclick={() => (firstServer = 'A')}>
        {nameA.trim() || 'Joueur 1'}
      </button>
      <button type="button" class:selected={firstServer === 'B'} onclick={() => (firstServer = 'B')}>
        {nameB.trim() || 'Joueur 2'}
      </button>
    </div>
    <label class="check">
      <input type="checkbox" bind:checked={letEnabled} />
      Compter les lets au service (règle ITF)
    </label>
  </section>

  <details class="card">
    <summary>Informations du match (facultatif)</summary>
    <div class="field">
      <label for="tournoi">Tournoi</label>
      <input id="tournoi" bind:value={tournoi} placeholder="Open du club" />
    </div>
    <div class="field">
      <label for="lieu">Lieu</label>
      <input id="lieu" bind:value={lieu} placeholder="Court 3" />
    </div>
    <div class="field">
      <label for="surface">Surface</label>
      <select id="surface" bind:value={surface}>
        <option value="">Non précisée</option>
        {#each Object.entries(SURFACES) as [value, text] (value)}
          <option {value}>{text}</option>
        {/each}
      </select>
    </div>
  </details>

  <section class="card">
    <span class="label">Mode de saisie (modifiable pendant le match)</span>
    <div class="formats">
      {#each MODES as m (m.id)}
        <button type="button" class="choice" class:selected={inputMode === m.id} onclick={() => (inputMode = m.id)}>
          <strong>{m.label}</strong>
          <span>{m.description}</span>
        </button>
      {/each}
    </div>
  </section>

  <button type="submit" class="primary start" disabled={saving}>Commencer le match</button>
</form>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-bottom: 32px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .back {
    padding: 0 8px;
  }
  h1 {
    font-size: 22px;
    margin: 0;
  }
  .field + .field {
    margin-top: 12px;
  }
  .label {
    display: block;
    font-size: 14px;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .formats {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .choice {
    text-align: left;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .choice span {
    font-size: 13px;
    color: var(--muted);
  }
  .selected {
    border: 2px solid var(--a-strong);
    background: var(--a-bg);
    color: var(--a);
  }
  .choice.selected span {
    color: var(--a);
  }
  .toggle {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .toggle button {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 14px 0 0;
    color: var(--text);
    font-size: 15px;
  }
  .check input {
    width: 22px;
    min-height: 22px;
    height: 22px;
  }
  summary {
    cursor: pointer;
    font-weight: 500;
    min-height: 32px;
  }
  details[open] summary {
    margin-bottom: 12px;
  }
  .start {
    min-height: 60px;
    font-size: 18px;
  }
</style>

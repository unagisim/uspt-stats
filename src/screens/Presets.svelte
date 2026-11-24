<script lang="ts">
  // Gestion des notes pré-enregistrées (notes rapides) : ajout, modification, ordre, suppression.
  import { onMount } from 'svelte';
  import { deletePreset, listPresets, reorderPresets, savePreset, type NotePreset } from '../lib/db';
  import type { NoteTag } from '../lib/engine';
  import { NOTE_TAGS } from '../lib/labels';
  import { DEFAULT_PRESETS, move, newPresets } from '../lib/presets';

  let { onBack }: { onBack: () => void } = $props();

  let presets = $state<NotePreset[]>([]);
  let loaded = $state(false);

  // Ajout
  let newText = $state('');
  let newTags = $state<NoteTag[]>([]);
  let addError = $state('');

  // Modification
  let editId = $state<number | null>(null);
  let editText = $state('');
  let editTags = $state<NoteTag[]>([]);
  let editError = $state('');

  let confirmId = $state<number | null>(null);
  let message = $state('');

  const TAGS = Object.entries(NOTE_TAGS) as [NoteTag, string][];
  const toggle = (list: NoteTag[], t: NoteTag) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]);

  async function reload() {
    presets = await listPresets();
    loaded = true;
  }
  onMount(reload);

  const missingDefaults = $derived(newPresets(presets, DEFAULT_PRESETS));

  async function add(e: SubmitEvent) {
    e.preventDefault();
    if (!newText.trim()) {
      addError = 'Écrivez le texte de la note.';
      return;
    }
    if (newPresets(presets, [{ text: newText, tags: [] }]).length === 0) {
      addError = 'Cette note existe déjà.';
      return;
    }
    try {
      await savePreset({ text: newText, tags: newTags });
    } catch {
      addError = "L'ajout a échoué. Réessayez.";
      return;
    }
    newText = '';
    newTags = [];
    message = 'Note ajoutée.';
    await reload();
  }

  function startEdit(p: NotePreset) {
    editId = p.id ?? null;
    editText = p.text;
    editTags = [...p.tags];
    editError = '';
    confirmId = null;
  }

  async function saveEdit() {
    if (editId === null) return;
    if (!editText.trim()) {
      editError = 'Le texte ne peut pas être vide.';
      return;
    }
    try {
      await savePreset({ id: editId, text: editText, tags: editTags });
    } catch {
      editError = "L'enregistrement a échoué. Réessayez.";
      return;
    }
    editId = null;
    message = 'Note modifiée.';
    await reload();
  }

  async function remove(id: number) {
    await deletePreset(id);
    confirmId = null;
    message = 'Note supprimée.';
    await reload();
  }

  async function shift(i: number, dir: -1 | 1) {
    presets = move(presets, i, dir);
    await reorderPresets($state.snapshot(presets));
  }

  async function addDefaults() {
    for (const p of missingDefaults) await savePreset(p);
    message = `${missingDefaults.length} note${missingDefaults.length > 1 ? 's' : ''} ajoutée${missingDefaults.length > 1 ? 's' : ''}.`;
    await reload();
  }
</script>

<div class="page">
  <header>
    <button class="ghost back" onclick={onBack}>‹ Retour</button>
    <h1>Notes rapides</h1>
  </header>
  <p class="hint">
    Ces notes s'enregistrent en un tap pendant le match (bouton « ✎ Note »). Elles sont gardées sur cet appareil
    et incluses dans la sauvegarde complète.
  </p>

  <form class="card add" onsubmit={add}>
    <label for="new-text">Nouvelle note</label>
    <input id="new-text" bind:value={newText} oninput={() => (addError = '')} placeholder="Recule trop en retour" autocomplete="off" />
    <div class="tags">
      {#each TAGS as [t, label] (t)}
        <button type="button" class:on={newTags.includes(t)} aria-pressed={newTags.includes(t)} onclick={() => (newTags = toggle(newTags, t))}>{label}</button>
      {/each}
    </div>
    {#if addError}<p class="error" role="alert">{addError}</p>{/if}
    <button type="submit" class="primary">Ajouter</button>
  </form>

  {#if message}<p class="hint" role="status">{message}</p>{/if}

  {#if loaded && presets.length === 0}
    <p class="hint">Aucune note rapide pour l'instant.</p>
  {/if}

  <ul>
    {#each presets as p, i (p.id)}
      <li class="card">
        {#if editId === p.id}
          <input bind:value={editText} oninput={() => (editError = '')} aria-label="Texte de la note" />
          <div class="tags">
            {#each TAGS as [t, label] (t)}
              <button class:on={editTags.includes(t)} aria-pressed={editTags.includes(t)} onclick={() => (editTags = toggle(editTags, t))}>{label}</button>
            {/each}
          </div>
          {#if editError}<p class="error" role="alert">{editError}</p>{/if}
          <div class="row2">
            <button onclick={() => (editId = null)}>Annuler</button>
            <button class="primary" onclick={saveEdit}>Enregistrer</button>
          </div>
        {:else}
          <div class="line">
            <div class="txt">
              <span>{p.text}</span>
              {#if p.tags.length}<span class="ptags">{p.tags.map((t) => NOTE_TAGS[t]).join(' · ')}</span>{/if}
            </div>
            <div class="order">
              <button aria-label="Monter" disabled={i === 0} onclick={() => shift(i, -1)}>↑</button>
              <button aria-label="Descendre" disabled={i === presets.length - 1} onclick={() => shift(i, 1)}>↓</button>
            </div>
          </div>
          {#if confirmId === p.id}
            <div class="confirm">
              <span>Supprimer cette note rapide ? Les notes déjà prises pendant les matchs sont conservées.</span>
              <div class="row2">
                <button onclick={() => (confirmId = null)}>Annuler</button>
                <button class="danger" onclick={() => remove(p.id!)}>Supprimer</button>
              </div>
            </div>
          {:else}
            <div class="row2">
              <button onclick={() => startEdit(p)}>Modifier</button>
              <button onclick={() => (confirmId = p.id ?? null)}>Supprimer</button>
            </div>
          {/if}
        {/if}
      </li>
    {/each}
  </ul>

  {#if missingDefaults.length}
    <button class="defaults" onclick={addDefaults}>
      Ajouter les notes proposées par défaut ({missingDefaults.length})
    </button>
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
  .add,
  li {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .add label {
    margin: 0;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tags button {
    min-height: 38px;
    padding: 0 10px;
    font-size: 13px;
  }
  .on {
    background: var(--a-bg);
    color: var(--a);
    border: 2px solid var(--a-strong);
    font-weight: 600;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  li {
    padding: 12px;
  }
  .line {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ptags {
    font-size: 12px;
    color: var(--warn);
  }
  .order {
    display: flex;
    gap: 4px;
  }
  .order button {
    width: 44px;
    min-height: 44px;
    padding: 0;
  }
  .order button:disabled {
    opacity: 0.35;
  }
  .row2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .row2 button {
    min-height: 44px;
  }
  .confirm {
    background: var(--danger-bg);
    color: var(--danger);
    border-radius: 10px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
  }
  .danger {
    background: var(--danger);
    border-color: var(--danger);
    color: var(--danger-bg);
    font-weight: 600;
  }
  .defaults {
    color: var(--muted);
  }
</style>

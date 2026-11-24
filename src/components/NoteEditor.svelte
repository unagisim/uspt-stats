<script lang="ts">
  // Note du coach : joueur concerné, thèmes rapides, commentaire libre (dictée si disponible).
  import { onDestroy } from 'svelte';
  import type { NoteTag, Side } from '../lib/engine';
  import { NOTE_TAGS } from '../lib/labels';

  let {
    names,
    context,
    onSave,
    onCancel,
  }: {
    names: { A: string; B: string };
    /** Moment du match affiché en titre ("Set 1 · 3-2 · 30-15"). */
    context: string;
    onSave: (note: { text: string; tags: NoteTag[]; player?: Side }) => void;
    onCancel: () => void;
  } = $props();

  let player = $state<Side | undefined>(undefined);
  let tags = $state<NoteTag[]>([]);
  let text = $state('');
  let error = $state('');

  const toggleTag = (t: NoteTag) => {
    tags = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t];
    error = '';
  };

  function save() {
    if (!text.trim() && tags.length === 0) {
      error = 'Choisissez un thème ou écrivez un commentaire.';
      return;
    }
    onSave({ text: text.trim(), tags: [...tags], ...(player ? { player } : {}) });
  }

  // ---- Dictée vocale (reconnaissance du navigateur, nécessite souvent le réseau) ----
  interface Recognition {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    start(): void;
    stop(): void;
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    onend: (() => void) | null;
    onerror: ((e: { error: string }) => void) | null;
  }
  type RecognitionCtor = new () => Recognition;
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  const SpeechCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  let recognition: Recognition | null = null;
  let listening = $state(false);

  function dictate() {
    if (!SpeechCtor) return;
    if (listening) {
      recognition?.stop();
      return;
    }
    recognition = new SpeechCtor();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (e) => {
      const said = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim();
      if (said) text = text.trim() ? `${text.trim()} ${said}` : said;
      error = '';
    };
    recognition.onerror = (e) => {
      error = e.error === 'network' ? 'La dictée nécessite une connexion réseau.' : 'Dictée indisponible.';
    };
    recognition.onend = () => (listening = false);
    listening = true;
    recognition.start();
  }

  onDestroy(() => recognition?.stop());
</script>

<section class="note card">
  <p class="title"><strong>Note du coach</strong> · {context}</p>

  <div class="who" role="group" aria-label="Joueur concerné">
    <button class:on={player === 'A'} onclick={() => (player = player === 'A' ? undefined : 'A')}>{names.A}</button>
    <button class:on={player === 'B'} onclick={() => (player = player === 'B' ? undefined : 'B')}>{names.B}</button>
    <button class:on={player === undefined} onclick={() => (player = undefined)}>Match</button>
  </div>

  <div class="tags" role="group" aria-label="Thèmes">
    {#each Object.entries(NOTE_TAGS) as [t, label] (t)}
      <button class:on={tags.includes(t as NoteTag)} aria-pressed={tags.includes(t as NoteTag)} onclick={() => toggleTag(t as NoteTag)}>
        {label}
      </button>
    {/each}
  </div>

  <div class="text">
    <textarea
      bind:value={text}
      oninput={() => (error = '')}
      rows="3"
      placeholder="Baisse la tête après la double faute, parle seul…"
      aria-label="Commentaire"
    ></textarea>
    {#if SpeechCtor}
      <button class="mic" class:rec={listening} onclick={dictate} aria-label={listening ? 'Arrêter la dictée' : 'Dicter le commentaire'}>
        {listening ? '■' : '🎤'}
      </button>
    {/if}
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <div class="actions">
    <button onclick={onCancel}>Annuler</button>
    <button class="primary" onclick={save}>Enregistrer la note</button>
  </div>
</section>

<style>
  .note {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
  }
  .title {
    margin: 0;
    font-size: 14px;
    color: var(--muted);
  }
  .title strong {
    color: var(--text);
    font-size: 16px;
  }
  .who {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tags button,
  .who button {
    min-height: 40px;
    padding: 0 10px;
    font-size: 14px;
  }
  .on {
    background: var(--a-bg);
    color: var(--a);
    border: 2px solid var(--a-strong);
    font-weight: 600;
  }
  .text {
    display: flex;
    gap: 6px;
    align-items: stretch;
  }
  textarea {
    flex: 1;
    min-height: 84px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--surface);
    padding: 10px;
    font: inherit;
    color: inherit;
    resize: vertical;
  }
  .mic {
    flex: none;
    width: 52px;
    padding: 0;
    font-size: 20px;
  }
  .mic.rec {
    background: var(--danger-bg);
    color: var(--danger);
    border-color: var(--danger);
  }
  .actions {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 8px;
    margin-top: auto;
  }
  .error {
    margin: 0;
  }
</style>

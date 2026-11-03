<script lang="ts">
  import type { AgentTask, Note, Project } from '@shared/types';
  import GlassPanel from '../GlassPanel.svelte';
  import { ui } from '../state.svelte';

  let { project, onclose }: { project: Project; onclose: () => void } = $props();

  let notes = $state<Note[]>([]);
  let draft = $state('');
  const COLORS = ['#ffe58a', '#ffc9a3', '#b9f0cb', '#b7e2ff', '#ffc4dc'];

  $effect(() => {
    const id = project.id;
    void ui.call(() => window.house.listNotes(id)).then((list) => {
      notes = list ?? [];
    });
  });

  async function persist() {
    await ui.call(() => window.house.saveNotes(project.id, $state.snapshot(notes)));
    ui.noteCounts[project.id] = notes.filter((n) => !n.done).length;
  }

  function add() {
    const text = draft.trim();
    if (!text) return;
    notes = [...notes, { id: crypto.randomUUID(), text, done: false, createdAt: Date.now() }];
    draft = '';
    void persist();
  }

  function toggle(note: Note) {
    note.done = !note.done;
    void persist();
  }

  function remove(note: Note) {
    notes = notes.filter((n) => n.id !== note.id);
    void persist();
  }

  async function delegate(note: Note) {
    const task = await ui.call(() => window.house.sendPrompt(project.id, note.text));
    if (task) {
      ui.setTask(task);
      ui.openPanel({ kind: 'chat', projectId: project.id, taskId: task.id });
    }
  }

  const tasks = $derived(ui.projectTasks(project.id).slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 12));
  const STATUS_COLOR: Record<AgentTask['status'], string> = {
    queued: 'var(--quest-running)',
    running: 'var(--quest-running)',
    waiting: 'var(--quest-waiting)',
    done: 'var(--quest-done)',
    error: 'var(--quest-error)',
    cancelled: 'var(--fg-faint)',
  };

  function color(id: string): string {
    let sum = 0;
    for (const char of id) sum += char.charCodeAt(0);
    return COLORS[sum % COLORS.length] as string;
  }
</script>

<GlassPanel title={project.name} eyebrow="Tableau de liège" color={project.color} {onclose}>
  <div class="content scroll stack">
    <form
      class="row"
      onsubmit={(event) => {
        event.preventDefault();
        add();
      }}
    >
      <input class="input grow" placeholder="Nouveau post-it…" bind:value={draft} />
      <button class="btn btn-primary" disabled={!draft.trim()}>Épingler</button>
    </form>

    <div class="cork">
      {#each notes as note (note.id)}
        <article class="note" class:done={note.done} style:background={color(note.id)}>
          <p>{note.text}</p>
          <div class="note-actions">
            <button class="mini" onclick={() => toggle(note)}>{note.done ? 'Rouvrir' : 'Fait'}</button>
            <button class="mini" onclick={() => delegate(note)}>Confier à l'agent</button>
            <button class="mini" aria-label="Retirer" onclick={() => remove(note)}>✕</button>
          </div>
        </article>
      {:else}
        <p class="empty">Rien d'épinglé pour l'instant.</p>
      {/each}
    </div>

    {#if tasks.length > 0}
      <div class="label">Tâches de l'agent</div>
      <div class="stack tasks">
        {#each tasks as task (task.id)}
          <button class="task" onclick={() => ui.openPanel({ kind: 'chat', projectId: project.id, taskId: task.id })}>
            <span class="pin" style:background={STATUS_COLOR[task.status]}></span>
            <span class="grow truncate">{task.title}</span>
            <span class="faint truncate progress">{task.progress}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</GlassPanel>

<style>
  .content {
    flex: 1;
    min-height: 0;
    padding: var(--space-4);
  }

  .cork {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-control);
    background: #c79a68;
    box-shadow: inset 0 2px 8px rgba(70, 40, 10, 0.4);
    min-height: 130px;
    align-content: start;
  }

  .note {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    color: #2c2410;
    font-size: 13px;
    border-radius: 3px;
    box-shadow: 0 4px 10px rgba(50, 30, 10, 0.35);
    transform: rotate(-0.6deg);
    transition: transform var(--duration) var(--ease-spring);
  }

  .note:nth-child(even) {
    transform: rotate(0.8deg);
  }

  .note:hover {
    transform: rotate(0deg) scale(1.02);
  }

  .note p {
    margin: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .note.done p {
    text-decoration: line-through;
    opacity: 0.6;
  }

  .note-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .mini {
    appearance: none;
    padding: 2px 6px;
    border: 1px solid rgba(60, 40, 10, 0.3);
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.45);
    color: #2c2410;
    font: 11px var(--font-text);
    cursor: pointer;
  }

  .empty {
    grid-column: 1 / -1;
    margin: auto;
    color: #3c2a12;
  }

  .tasks {
    gap: var(--space-1);
  }

  .task {
    appearance: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 6px 8px;
    border: 0;
    border-radius: var(--radius-small);
    background: var(--surface);
    color: var(--fg);
    font: 13px var(--font-text);
    text-align: left;
    cursor: pointer;
  }

  .task:hover {
    background: var(--surface-hover);
  }

  .pin {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .progress {
    max-width: 40%;
  }
</style>

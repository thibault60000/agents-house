<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import HistoryPanel from './panels/HistoryPanel.svelte';
  import { chime } from './sound';
  import type { InteractiveKind } from '../scene/house/rooms/room';
  import { World } from '../scene/world';
  import CommandPalette from './CommandPalette.svelte';
  import BoardPanel from './panels/BoardPanel.svelte';
  import ChatPanel from './panels/ChatPanel.svelte';
  import ChestPanel from './panels/ChestPanel.svelte';
  import DocsPanel from './panels/DocsPanel.svelte';
  import LogisticsPanel from './panels/LogisticsPanel.svelte';
  import RoomsPanel from './panels/RoomsPanel.svelte';
  import SettingsPanel from './panels/SettingsPanel.svelte';
  import UsagePanel from './panels/UsagePanel.svelte';
  import NightToggle from './NightToggle.svelte';
  import QuestHud from './QuestHud.svelte';
  import { setAmbient } from './sound';
  import { ui } from './state.svelte';
  import TopBar from './TopBar.svelte';
  import Welcome from './Welcome.svelte';

  let canvas = $state<HTMLCanvasElement>();
  let overlay = $state<HTMLDivElement>();
  let osDark = $state(window.matchMedia('(prefers-color-scheme: dark)').matches);
  let ready = $state(false);

  function labelFor(kind: InteractiveKind, projectId: string): string {
    const project = ui.project(projectId);
    switch (kind) {
      case 'docs': {
        const count = project?.docCount ?? 0;
        return `Documentation · ${count} fichier${count > 1 ? 's' : ''}`;
      }
      case 'pc':
        return "Parler à l'agent";
      case 'chest':
        return 'Coffre · infos du projet';
      case 'board': {
        const count = ui.noteCounts[projectId] ?? 0;
        return `Tableau · ${count} post-it${count > 1 ? 's' : ''}`;
      }
      case 'agent':
        return `${project?.name ?? 'Agent'} · parler à l'agent`;
      case 'logistics':
        return "Vue d'ensemble : le PC et chaque projet";
      case 'usage':
        return 'Consommation et production des modèles';
    }
  }

  onMount(() => {
    if (!canvas || !overlay) return;
    const world = new World(canvas, overlay, {
      labelFor,
      onPick({ kind, projectId }) {
        if (kind === 'pc' || kind === 'agent') ui.openPanel({ kind: 'chat', projectId });
        else if (projectId) ui.openPanel({ kind, projectId });
        else ui.openPanel({ kind, projectId: null });
      },
      onBubbleClick(projectId, taskId) {
        ui.openPanel({ kind: 'chat', projectId, taskId });
      },
      onFloorsChanged(floors, active) {
        ui.floors = floors;
        ui.activeFloor = active;
      },
      onNightChanged(isNight) {
        ui.isNight = isNight;
      },
    });
    ui.world = world;

    const offs = [
      window.house.onTaskEvent((event) => {
        ui.setTask(event.task);
        if (event.channel === 'task:done' || event.channel === 'task:error') {
          ui.onTaskFinished(event.task);
          const panel = ui.panel;
          if (panel?.kind === 'chat' && panel.projectId === event.task.projectId && document.hasFocus()) {
            ui.acknowledge(event.task.id);
          }
        }
      }),
      window.house.onConversations((list) => ui.setConversations(list)),
      window.house.onLimits((limits) => (ui.limits = limits)),
      window.house.onProjectDetected((project) => {
        if (!ui.detected.some((d) => d.path === project.path)) ui.detected = [...ui.detected, project];
      }),
      window.house.onStateChanged((state) => {
        ui.app = state;
      }),
      window.house.onOpenTask(({ projectId, taskId }) => {
        ui.world?.focusAgent(projectId);
        ui.openPanel({ kind: 'chat', projectId, taskId });
      }),
    ];

    void (async () => {
      const [app, tasks, claude, ides, conversations, limits] = await Promise.all([
        window.house.getState(),
        window.house.listTasks(),
        window.house.claudeStatus(),
        window.house.listIdes(),
        window.house.listConversations(),
        window.house.getLimits(),
      ]);
      ui.tasks = tasks;
      ui.claude = claude;
      ui.ides = ides;
      ui.app = app;
      ui.conversations = conversations;
      ui.limits = limits;
      ready = true;
      void ui.refreshNoteCounts();
      void ui.refreshLogistics();
    })();

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = (event: MediaQueryListEvent) => (osDark = event.matches);
    media.addEventListener('change', onScheme);

    return () => {
      for (const off of offs) off();
      media.removeEventListener('change', onScheme);
      world.dispose();
      ui.world = null;
    };
  });

  $effect(() => {
    const app = ui.app;
    if (!app || !ui.world) return;
    const world = ui.world;
    const settings = $state.snapshot(app.settings);
    const projects = $state.snapshot(app.projects);
    const rootName = app.rootPath?.split(/[\\/]/).filter(Boolean).pop() ?? 'maison';
    untrack(() => {
      world.applySettings(settings);
      world.setProjects(projects, rootName);
      ui.syncAllAgents();
      ui.syncBadges();
      void window.house.listConversations().then((list) => ui.setConversations(list));
    });
  });

  let previousAlarm = 0;
  $effect(() => {
    const level = ui.alarmLevel;
    ui.world?.setAlarm(level);
    if (level > previousAlarm && ui.app?.settings.sounds) chime('error');
    previousAlarm = level;
  });

  $effect(() => {
    const clock = setInterval(() => (ui.clock = Date.now()), 60_000);
    return () => clearInterval(clock);
  });

  $effect(() => {
    const mode = ui.app?.settings.theme ?? 'auto';
    const dark = mode === 'dark' || (mode === 'auto' && (ui.isNight || osDark));
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  });

  $effect(() => {
    const kind = ui.panel?.kind;
    const reader = kind === 'history' || kind === 'docs' || kind === 'usage' || kind === 'logistics' || kind === 'skills' || kind === 'commands' || kind === 'schedules' || kind === 'artifacts';
    ui.world?.setPanelInset(!kind ? 0 : reader ? 800 : kind === 'rooms' ? 640 : 460);
  });

  $effect(() => {
    document.documentElement.dataset.refraction = ui.app?.settings.liquidRefraction ? 'on' : 'off';
  });

  $effect(() => {
    setAmbient(ui.app?.settings.sounds ?? false);
  });

  let specularQueued = false;
  function onPointerMove(event: PointerEvent) {
    if (specularQueued) return;
    specularQueued = true;
    requestAnimationFrame(() => {
      specularQueued = false;
      for (const element of document.querySelectorAll<HTMLElement>('.glass')) {
        const rect = element.getBoundingClientRect();
        element.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        element.style.setProperty('--my', `${event.clientY - rect.top}px`);
      }
    });
  }

  function onKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      ui.paletteOpen = !ui.paletteOpen;
    } else if (event.key === 'Escape' && !ui.paletteOpen) {
      ui.panel = null;
    }
  }

  async function acceptDetected(path: string) {
    ui.detected = ui.detected.filter((d) => d.path !== path);
    const state = await ui.call(() => window.house.acceptDetected(path));
    if (state) ui.app = state;
  }

  function ignoreDetected(path: string) {
    ui.detected = ui.detected.filter((d) => d.path !== path);
    void ui.call(() => window.house.ignoreDetected(path));
  }

  const panelProject = $derived(ui.panel?.projectId ? ui.project(ui.panel.projectId) : undefined);
  const closePanel = () => (ui.panel = null);
  const needsRoot = $derived(ready && ui.app !== null && ui.app.rootPath === null && ui.app.projects.length === 0);
</script>

<svelte:window onpointermove={onPointerMove} onkeydown={onKeydown} />

<canvas class="scene" bind:this={canvas} tabindex="0" aria-label="Maison en vue isométrique"></canvas>
<div class="scene-overlay" bind:this={overlay}></div>

<svg class="filters" aria-hidden="true">
  <filter id="liquid-glass" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="1" seed="7" result="noise" />
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="16" xChannelSelector="R" yChannelSelector="G" />
  </filter>
</svg>

<TopBar />
<QuestHud />
<NightToggle />

{#if needsRoot}
  <Welcome />
{/if}

{#if ui.panel?.kind === 'chat' && panelProject}
  <ChatPanel project={panelProject} taskId={ui.panel.taskId ?? null} onclose={closePanel} />
{:else if ui.panel?.kind === 'docs' && panelProject}
  <DocsPanel project={panelProject} onclose={closePanel} />
{:else if ui.panel?.kind === 'chest' && panelProject}
  <ChestPanel project={panelProject} onclose={closePanel} />
{:else if ui.panel?.kind === 'board' && panelProject}
  <BoardPanel project={panelProject} onclose={closePanel} />
{:else if ui.panel?.kind === 'rooms'}
  <RoomsPanel onclose={closePanel} />
{:else if ui.panel?.kind === 'logistics' || ui.panel?.kind === 'schedules' || ui.panel?.kind === 'artifacts' || ui.panel?.kind === 'skills' || ui.panel?.kind === 'commands'}
  <LogisticsPanel initialTab={ui.panel.kind} initialProject={ui.panel.projectId} onclose={closePanel} />
{:else if ui.panel?.kind === 'history'}
  <HistoryPanel initialProject={ui.panel.projectId} initialSession={ui.panel.sessionId ?? null} onclose={closePanel} />
{:else if ui.panel?.kind === 'usage'}
  <UsagePanel onclose={closePanel} />
{:else if ui.panel?.kind === 'settings'}
  <SettingsPanel onclose={closePanel} />
{/if}

<CommandPalette />

<div class="toasts" aria-live="polite">
  {#each ui.detected as project (project.path)}
    <div class="toast glass">
      <div class="grow">
        <strong>Nouveau projet détecté</strong>
        <div class="faint truncate">{project.name}, l'ajouter ?</div>
      </div>
      <button class="btn btn-primary" onclick={() => acceptDetected(project.path)}>Ajouter</button>
      <button class="btn btn-ghost" onclick={() => ignoreDetected(project.path)}>Ignorer</button>
    </div>
  {/each}
  {#each ui.toasts as toast (toast.id)}
    <div class="toast glass" class:error={toast.tone === 'error'}>{toast.text}</div>
  {/each}
</div>

<style>
  .scene {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    display: block;
    outline: none;
    touch-action: none;
  }

  .filters {
    position: absolute;
    width: 0;
    height: 0;
  }

  .toasts {
    position: fixed;
    left: 12px;
    bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: min(400px, calc(100vw - 24px));
    z-index: 60;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 10px 14px;
    border-radius: 14px;
    font-size: 13px;
    background: var(--glass-bg-strong);
  }

  .toast.error {
    border-color: var(--quest-error);
    color: var(--quest-error);
  }
</style>

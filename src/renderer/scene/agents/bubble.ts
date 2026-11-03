import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export type BubbleState = 'running' | 'done' | 'error' | 'waiting';

const ICONS: Record<BubbleState, string> = { running: '!', done: '✓', error: '!', waiting: '?' };

export class QuestBubble {
  readonly object: CSS2DObject;
  private element = document.createElement('button');
  private icon = document.createElement('span');
  private label = document.createElement('span');
  private bar = document.createElement('span');
  private state: BubbleState | null = null;

  constructor(onClick: () => void) {
    this.element.type = 'button';
    this.element.className = 'quest-bubble';
    this.icon.className = 'quest-icon';
    this.label.className = 'quest-label';
    this.bar.className = 'quest-bar';
    this.element.append(this.icon, this.label, this.bar);
    this.element.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.element.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    this.object = new CSS2DObject(this.element);
    this.object.position.y = 1.5;
    this.object.center.set(0.5, 1);
    this.object.visible = false;
  }

  set(state: BubbleState | null, text = ''): void {
    if (state === null) {
      this.state = null;
      this.object.visible = false;
      this.element.style.display = 'none';
      return;
    }
    if (state !== this.state) {
      this.state = state;
      this.element.dataset.state = state;
      this.icon.textContent = ICONS[state];
    }
    this.label.textContent = text;
    this.element.title = text;
    this.element.style.removeProperty('display');
  }

  isActive(): boolean {
    return this.state !== null;
  }

  setVisible(visible: boolean): void {
    this.object.visible = visible && this.state !== null;
  }

  dispose(): void {
    this.element.remove();
  }
}

export interface AgentBadge {
  count: number;
  alert: boolean;
  title: string;
}

export class ConversationBadge {
  readonly object: CSS2DObject;
  private element = document.createElement('button');
  private active = false;

  constructor(onClick: () => void) {
    this.element.type = 'button';
    this.element.className = 'agent-badge';
    this.element.style.display = 'none';
    this.element.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.element.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    this.object = new CSS2DObject(this.element);
    this.object.position.y = 1.5;
    this.object.center.set(0.5, 1);
    this.object.visible = false;
  }

  set(badge: AgentBadge | null): void {
    this.active = badge !== null;
    if (!badge) {
      this.element.style.display = 'none';
      this.object.visible = false;
      return;
    }
    this.element.style.removeProperty('display');
    this.element.textContent = badge.count > 99 ? '99+' : String(badge.count);
    this.element.dataset.alert = String(badge.alert);
    this.element.title = badge.title;
    this.element.setAttribute('aria-label', badge.title);
  }

  setVisible(visible: boolean): void {
    this.object.visible = visible && this.active;
  }

  dispose(): void {
    this.element.remove();
  }
}

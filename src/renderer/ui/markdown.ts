import DOMPurify from 'dompurify';
import { marked } from 'marked';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noreferrer');
  }
});

export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false, gfm: true, breaks: false });
  return DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe'], FORBID_ATTR: ['style'] });
}

export function enhanceCodeBlocks(root: HTMLElement, copy: (text: string) => void): void {
  for (const pre of root.querySelectorAll('pre')) {
    if (pre.querySelector('.code-copy')) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy';
    button.textContent = 'Copier';
    button.addEventListener('click', () => {
      copy(pre.querySelector('code')?.textContent ?? pre.textContent ?? '');
      button.textContent = 'Copié';
      setTimeout(() => (button.textContent = 'Copier'), 1400);
    });
    pre.append(button);
  }
}

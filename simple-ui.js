'use strict';

(() => {
  const expandedTasks = new Set();
  const openCategories = new Set();
  let initialized = false;
  let scheduled = false;

  function taskKey(card) {
    return card?.dataset?.taskId || '';
  }

  function categoryKey(section) {
    return section.querySelector('.category-header h2')?.textContent?.trim() || '';
  }

  function formatDeadline(card) {
    const date = card.querySelector('[data-field="deadline_date"]')?.value;
    if (!date) return '';
    const time = card.querySelector('[data-field="deadline_time"]')?.value || '';
    const value = new Date(`${date}T${time || '12:00'}`);
    if (Number.isNaN(value.getTime())) return date;
    return new Intl.DateTimeFormat('da-DK', {
      day: '2-digit',
      month: 'short',
      ...(time ? { hour: '2-digit', minute: '2-digit' } : {})
    }).format(value);
  }

  function decorateCards() {
    document.querySelectorAll('.task-card').forEach((card) => {
      const key = taskKey(card);
      const actions = card.querySelector('.task-actions');
      const badges = card.querySelector('.task-badges');
      const isExpanded = expandedTasks.has(key);

      card.classList.toggle('simple-expanded', isExpanded);
      card.classList.toggle('simple-collapsed', !isExpanded);

      if (badges && !badges.querySelector('.simple-deadline-badge')) {
        const deadline = formatDeadline(card);
        if (deadline) {
          const badge = document.createElement('span');
          badge.className = 'badge simple-deadline-badge';
          badge.textContent = `Tidsfrist ${deadline}`;
          badges.appendChild(badge);
        }
      }

      let toggle = actions?.querySelector('[data-simple-task-toggle]');
      if (actions && !toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'button small simple-detail-toggle';
        toggle.dataset.simpleTaskToggle = '1';
        actions.prepend(toggle);
      }
      if (toggle) {
        toggle.textContent = isExpanded ? 'Skjul detaljer' : 'Vis detaljer';
        toggle.setAttribute('aria-expanded', String(isExpanded));
      }
    });
  }

  function decorateCategories() {
    const sections = [...document.querySelectorAll('.category')];
    if (!initialized && sections.length) {
      const first = categoryKey(sections[0]);
      if (first) openCategories.add(first);
      initialized = true;
    }

    sections.forEach((section) => {
      const key = categoryKey(section);
      const header = section.querySelector('.category-header');
      const body = section.querySelector('.category-body');
      const meta = header?.querySelector('.category-meta');
      const isOpen = openCategories.has(key);

      if (body) body.classList.toggle('collapsed', !isOpen);
      if (header) {
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', String(isOpen));
      }

      let toggle = meta?.querySelector('[data-simple-category-toggle]');
      if (meta && !toggle) {
        toggle = document.createElement('span');
        toggle.className = 'simple-category-toggle';
        toggle.dataset.simpleCategoryToggle = '1';
        meta.appendChild(toggle);
      }
      if (toggle) toggle.textContent = isOpen ? 'Skjul' : 'Vis';
    });
  }

  function decorate() {
    scheduled = false;
    decorateCategories();
    decorateCards();
  }

  function scheduleDecorate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(decorate);
  }

  function setAllCategories(open) {
    document.querySelectorAll('.category').forEach((section) => {
      const key = categoryKey(section);
      if (!key) return;
      if (open) openCategories.add(key);
      else openCategories.delete(key);
    });
    decorateCategories();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('taskRoot');
    if (!root) return;

    new MutationObserver(scheduleDecorate).observe(root, { childList: true, subtree: true });

    root.addEventListener('click', (event) => {
      const detailButton = event.target.closest('[data-simple-task-toggle]');
      if (detailButton) {
        event.preventDefault();
        event.stopPropagation();
        const card = detailButton.closest('.task-card');
        const key = taskKey(card);
        if (expandedTasks.has(key)) expandedTasks.delete(key);
        else expandedTasks.add(key);
        decorateCards();
        return;
      }

      const header = event.target.closest('.category-header');
      if (header && !event.target.closest('button,input,select,textarea,a')) {
        const section = header.closest('.category');
        const key = categoryKey(section);
        if (openCategories.has(key)) openCategories.delete(key);
        else openCategories.add(key);
        decorateCategories();
      }
    });

    root.addEventListener('keydown', (event) => {
      const header = event.target.closest('.category-header');
      if (!header || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      const section = header.closest('.category');
      const key = categoryKey(section);
      if (openCategories.has(key)) openCategories.delete(key);
      else openCategories.add(key);
      decorateCategories();
    });

    document.getElementById('expandAllBtn')?.addEventListener('click', () => setAllCategories(true));
    document.getElementById('collapseAllBtn')?.addEventListener('click', () => setAllCategories(false));
    document.getElementById('searchInput')?.addEventListener('input', (event) => {
      if (event.target.value.trim()) setAllCategories(true);
    });

    scheduleDecorate();
  });
})();

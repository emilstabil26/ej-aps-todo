'use strict';

(() => {
  const CODE_KEY = 'ejaps_team_code_v2';
  let prompting = false;

  function show(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
  }

  function askForAccess(reason = '') {
    if (prompting) return;
    prompting = true;
    const message = reason
      ? `${reason}\n\nIndtast E&J ApS adgangskoden:`
      : 'Indtast E&J ApS adgangskoden:';
    const entered = (prompt(message) || '').trim();
    prompting = false;
    if (!entered) {
      show('Appen er ikke forbundet, før adgangskoden er indtastet');
      return;
    }
    localStorage.setItem(CODE_KEY, entered);
    location.reload();
  }

  async function validateAccess() {
    const stored = (localStorage.getItem(CODE_KEY) || '').trim();
    if (!stored) {
      askForAccess();
      return false;
    }
    try {
      if (typeof request !== 'function') return false;
      await request('health');
      return true;
    } catch (error) {
      const message = String(error?.message || '');
      if (/403|adgangskod|udløbet|forkert/i.test(message)) {
        localStorage.removeItem(CODE_KEY);
        askForAccess('Den gemte adgangskode virker ikke længere.');
      }
      return false;
    }
  }

  async function openCalendarFeed() {
    try {
      if (!(await validateAccess())) return;
      const result = await request('calendar-token');
      if (!result?.token) throw new Error('Kalenderadgang kunne ikke oprettes');
      const feed = `${CALENDAR}?token=${encodeURIComponent(result.token)}`;
      try { await navigator.clipboard.writeText(feed); } catch (_) {}
      if (/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)) {
        location.href = feed.replace(/^https:/, 'webcal:');
      } else {
        prompt('Tilføj dette link som internetkalender i Google Kalender eller Outlook:', feed);
      }
    } catch (error) {
      show(error?.message || 'Kalenderen kunne ikke åbnes');
    }
  }

  function addAccessButton() {
    const host = document.querySelector('.header-actions');
    if (!host || document.getElementById('changeAccessBtn')) return;
    const button = document.createElement('button');
    button.id = 'changeAccessBtn';
    button.type = 'button';
    button.className = 'button secondary';
    button.textContent = 'Skift adgang';
    button.addEventListener('click', () => {
      localStorage.removeItem(CODE_KEY);
      askForAccess('Indtast den adgangskode, Emil og Jesper deler.');
    });
    host.appendChild(button);
  }

  document.addEventListener('DOMContentLoaded', () => {
    addAccessButton();
    const calendarBtn = document.getElementById('calendarAllBtn');
    if (calendarBtn) calendarBtn.onclick = openCalendarFeed;
    validateAccess();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => registration?.update()).catch(() => {});
    }
  });
})();

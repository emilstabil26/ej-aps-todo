'use strict';

(() => {
  function show(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
  }

  async function openCalendarFeed() {
    try {
      if (typeof request !== 'function') throw new Error('App-forbindelsen er ikke klar');
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

  document.addEventListener('DOMContentLoaded', () => {
    const calendarBtn = document.getElementById('calendarAllBtn');
    if (calendarBtn) calendarBtn.onclick = openCalendarFeed;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js?v=15').catch(() => {});
    }
  });
})();

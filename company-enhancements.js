'use strict';

(() => {
  function makeOldMessagesClickable() {
    const chat = document.getElementById('companyChat');
    if (!chat || chat.dataset.clickableMessages === '1') return;
    chat.dataset.clickableMessages = '1';

    chat.addEventListener('click', (event) => {
      if (event.target.closest('button, a, input, select, textarea, label')) return;
      const bubble = event.target.closest('.message-bubble');
      if (!bubble) return;
      const action = bubble.querySelector('[data-msg-action="transform"]');
      if (action) action.click();
    });
  }

  function moveStatusAndMilestonesIntoActivity() {
    const activityPanel = document.getElementById('activityPanel');
    const activityShell = activityPanel?.querySelector('.activity-shell');
    if (!activityPanel || !activityShell || document.getElementById('activityStatusSection')) return;

    const milestones = document.getElementById('milestones');
    const weeklyStatus = document.getElementById('weeklyStatus');
    const milestonePanel = milestones?.closest('section.panel');
    const weeklyPanel = weeklyStatus?.closest('article.panel');
    const oldDetails = milestones?.closest('details') || weeklyStatus?.closest('details');

    const statusSection = document.createElement('section');
    statusSection.id = 'activityStatusSection';
    statusSection.className = 'activity-status-section';
    statusSection.innerHTML = '<div class="activity-status-heading"><h3>Status og milepæle</h3><p>Fremdrift, milepæle og ugens status er samlet her.</p></div><div id="activityStatusCards" class="activity-status-cards"></div>';

    const toolbar = activityShell.querySelector('.activity-toolbar');
    activityShell.insertBefore(statusSection, toolbar || activityShell.children[1] || null);

    const host = statusSection.querySelector('#activityStatusCards');
    if (milestonePanel) host.appendChild(milestonePanel);
    if (weeklyPanel) host.appendChild(weeklyPanel);
    if (oldDetails) oldDetails.hidden = true;

    const headerText = activityPanel.querySelector('.activity-header p');
    if (headerText) headerText.textContent = 'Aktivitet, status og milepæle samlet ét sted.';
  }

  function addStyles() {
    if (document.getElementById('companyEnhancementStyles')) return;
    const style = document.createElement('style');
    style.id = 'companyEnhancementStyles';
    style.textContent = `
      .message-bubble{cursor:pointer}
      .message-actions,.message-actions *{cursor:auto}
      .activity-status-section{padding:14px 14px 4px;background:#f5f6f8}
      .activity-status-heading{margin-bottom:10px}
      .activity-status-heading h3{margin:0;font-size:18px}
      .activity-status-heading p{margin:3px 0 0;color:#667085;font-size:12px}
      .activity-status-cards{display:grid;gap:10px}
      .activity-status-cards>.panel{margin:0}
      .activity-status-cards .overview-grid{display:grid;gap:10px}
      @media(min-width:720px){.activity-status-cards{grid-template-columns:1fr 1fr}.activity-status-cards>.panel{height:100%}}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', () => {
    addStyles();
    makeOldMessagesClickable();
    moveStatusAndMilestonesIntoActivity();
  });
})();

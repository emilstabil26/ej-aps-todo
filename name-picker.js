'use strict';

(() => {
  const REMEMBER_KEY = 'ejaps_name_choice_v1';
  const remembered = localStorage.getItem(REMEMBER_KEY);

  if (remembered === 'Emil' || remembered === 'Jesper') {
    currentUser = remembered;
    localStorage.setItem('ejaps_user_v2', remembered);
  } else {
    currentUser = '';
    localStorage.removeItem('ejaps_user_v2');
  }

  function applyNameState() {
    const select = document.getElementById('currentUser');
    if (!select) return;
    select.value = currentUser || '';
    document.body.classList.toggle('name-required', !currentUser);

    const controls = document.querySelectorAll(
      '#addTaskBtn, #clearActivityBtn, #restoreBtn, ' +
      '#taskRoot [data-action="toggle"], #taskRoot [data-field], ' +
      '#taskRoot [data-action="delete"], #taskRoot [data-action="delete-comment"], ' +
      '#taskRoot .comment-form input, #taskRoot .comment-form button'
    );
    controls.forEach((control) => { control.disabled = !currentUser; });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('currentUser');
    if (!select) return;

    let hint = select.parentElement.querySelector('.name-choice-hint');
    if (!hint) {
      hint = document.createElement('span');
      hint.className = 'name-choice-hint';
      hint.textContent = 'Vælges én gang og huskes på enheden';
      select.parentElement.appendChild(hint);
    }

    select.value = currentUser || '';
    select.addEventListener('change', () => {
      const name = select.value;
      if (!['Emil', 'Jesper'].includes(name)) return;
      currentUser = name;
      localStorage.setItem(REMEMBER_KEY, name);
      localStorage.setItem('ejaps_user_v2', name);
      applyNameState();
      window.showToast?.(`${name} er valgt og bliver husket`);
    });

    const root = document.getElementById('taskRoot');
    if (root) new MutationObserver(applyNameState).observe(root, { childList: true, subtree: true });

    applyNameState();
  });
})();

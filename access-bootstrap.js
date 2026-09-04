'use strict';

(() => {
  const CODE_KEY='ejaps_team_code_v2';
  const params=new URLSearchParams(location.hash.slice(1));
  const fromLink=(params.get('team')||'').trim();
  if(fromLink){
    localStorage.setItem(CODE_KEY,fromLink);
    history.replaceState(null,document.title,location.pathname+location.search);
  }
  let stored=(localStorage.getItem(CODE_KEY)||'').trim();
  if(stored.startsWith('EJ-ApS-')){
    localStorage.removeItem(CODE_KEY);
    stored='';
  }
  if(!stored){
    const entered=(prompt('Sikkerhedsopdatering: indtast den nye E&J ApS adgangskode for at forbinde appen:')||'').trim();
    if(entered)localStorage.setItem(CODE_KEY,entered);
  }
})();

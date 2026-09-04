'use strict';

(() => {
  const CODE_KEY='ejaps_team_code_v2';
  const params=new URLSearchParams(location.hash.slice(1));
  const fromLink=(params.get('team')||'').trim();
  if(fromLink){
    localStorage.setItem(CODE_KEY,fromLink);
    history.replaceState(null,document.title,location.pathname+location.search);
  }
  const stored=(localStorage.getItem(CODE_KEY)||'').trim();
  if(!stored){
    const entered=(prompt('Indtast E&J ApS adgangskoden for at forbinde appen:')||'').trim();
    if(entered)localStorage.setItem(CODE_KEY,entered);
  }
})();

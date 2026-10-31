const fs=require('fs');
const files=['src/js/art.js','src/js/data.works.js','src/js/data.heroes.js','src/js/data.events.js','src/js/data.factions.js','src/js/data.battles.js','src/js/app.core.js','src/js/app.views.js','src/js/app.overlay.js'];
for(const f of files){
  try{ new Function(fs.readFileSync(f,'utf8')); console.log('OK   '+f); }
  catch(e){ console.log('FAIL '+f+' :: '+e.message); }
}

const fs = require('fs');
const code = fs.readFileSync('components/GanttView.tsx', 'utf-8');

let curDepth = 0;
let lines = code.split('\n');
let insideReturn = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('return (') && i > 1300 && i < 1360) insideReturn = true;
  if (!insideReturn) continue;
  
  const tokens = line.split(/(<div|<\/div>)/g);
  let dChange = 0;
  for (const token of tokens) {
    if (token === '<div') dChange++;
    else if (token === '</div>') dChange--;
  }
  
  if (dChange !== 0) {
      curDepth += dChange;
      console.log(i+1, curDepth, line.trim());
  }
}

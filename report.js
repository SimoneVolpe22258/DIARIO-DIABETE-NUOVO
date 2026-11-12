'use strict';
// Report locale: PDF A4 composto da pagine rasterizzate, senza servizi esterni.
window.diarioReport=(()=>{
 const WIDTH=1240,HEIGHT=1754,M=90,RIGHT=1150;
 const fmtDate=s=>{const p=String(s||'').split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s};
 const num=n=>Number(n).toLocaleString('it-IT',{maximumFractionDigits:1});
 function createPages(){let pages=[],canvas,ctx,y,page=0;
  function newPage(){canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.fillStyle='#15528a';ctx.fillRect(0,0,WIDTH,13);ctx.fillStyle='#123451';ctx.font='bold 33px Arial';ctx.fillText('DIARIO DIABETE',M,75);ctx.fillStyle='#708092';ctx.font='18px Arial';ctx.fillText('Report di monitoraggio personale  ·  by Simone Volpe',M,106);ctx.strokeStyle='#d9e5ee';ctx.beginPath();ctx.moveTo(M,125);ctx.lineTo(RIGHT,125);ctx.stroke();y=162;page++;pages.push(canvas)}
  function ensure(h){if(y+h>HEIGHT-125)newPage()}
  function line(text,{size=22,bold=false,color='#22384a',indent=0,gap=12}={}){ctx.font=`${bold?'bold ':''}${size}px Arial`;let words=String(text??'').split(/\s+/),current='';const max=RIGHT-M-indent;for(const w of words){let next=current?current+' '+w:w;if(ctx.measureText(next).width>max&&current){ensure(size*1.45);ctx.fillStyle=color;ctx.fillText(current,M+indent,y);y+=size*1.45;current=w}else current=next}if(current){ensure(size*1.45);ctx.fillStyle=color;ctx.fillText(current,M+indent,y);y+=size*1.45}y+=gap}
  function heading(s){ensure(75);y+=18;line(s,{size:30,bold:true,color:'#1265a0',gap:13})}
  function chart(rows,kind){if(rows.length<2)return;ensure(355);const left=M+60,top=y+25,w=RIGHT-left-15,h=250;let values=rows.map(r=>r.value),min=Math.min(...values),max=Math.max(...values),pad=Math.max((max-min)*.18,kind==='weight'?0.4:15);min-=pad;max+=pad;const x=i=>left+(rows.length===1?0:i/(rows.length-1))*w,yy=v=>top+(max-v)/(max-min)*h;
   ctx.strokeStyle='#e2e9ef';ctx.lineWidth=2;for(let i=0;i<=4;i++){let v=min+(max-min)*i/4,py=yy(v);ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(left+w,py);ctx.stroke();ctx.font='17px Arial';ctx.fillStyle='#596c7e';ctx.fillText(num(v),M,py+6)}
   for(let i=1;i<rows.length;i++){let a=rows[i-1],b=rows[i];ctx.beginPath();ctx.strokeStyle=kind==='weight'?'#2878d0':((a.value+b.value)/2<70?'#2878d0':(a.value+b.value)/2<=180?'#26965b':(a.value+b.value)/2<=250?'#e18a21':'#d74444');ctx.lineWidth=4;ctx.moveTo(x(i-1),yy(a.value));ctx.lineTo(x(i),yy(b.value));ctx.stroke()}
   rows.forEach((r,i)=>{ctx.fillStyle=kind==='weight'?'#2878d0':r.value<70?'#2878d0':r.value<=180?'#26965b':r.value<=250?'#e18a21':'#d74444';ctx.beginPath();ctx.arc(x(i),yy(r.value),4,0,Math.PI*2);ctx.fill()});ctx.fillStyle='#52647a';ctx.font='17px Arial';ctx.fillText(fmtDate(rows[0].date),left,top+h+32);ctx.fillText(fmtDate(rows.at(-1).date),left+w-115,top+h+32);y=top+h+62;line('I segmenti collegano rilevazioni distinte: i valori intermedi non sono stati misurati.',{size:17,color:'#627487'})}
  function finish(){pages.forEach((p,i)=>{const c=p.getContext('2d');c.strokeStyle='#d9e5ee';c.beginPath();c.moveTo(M,HEIGHT-92);c.lineTo(RIGHT,HEIGHT-92);c.stroke();c.fillStyle='#617284';c.font='17px Arial';c.fillText('Dati registrati dall’utente · Non costituisce valutazione o indicazione medica',M,HEIGHT-63);c.fillText(`${i+1} / ${pages.length}`,RIGHT-75,HEIGHT-63)});return pages}
  newPage();return {line,heading,chart,finish};
 }
 function buildPdf(pages){const enc=new TextEncoder(),parts=[],objects=[],push=s=>parts.push(typeof s==='string'?enc.encode(s):s);const ascii=s=>enc.encode(s);let offset=0;function add(chunk){push(chunk);offset+=typeof chunk==='string'?ascii(chunk).length:chunk.length}function obj(n,body){objects[n]=offset;add(`${n} 0 obj\n`);add(body);add('\nendobj\n')}
  add('%PDF-1.4\n');const n=pages.length,root=1,pagesId=2,pageStart=3,imgStart=3+n,contentStart=3+2*n;obj(root,`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);obj(pagesId,`<< /Type /Pages /Kids [${Array.from({length:n},(_,i)=>`${pageStart+i} 0 R`).join(' ')}] /Count ${n} >>`);
  for(let i=0;i<n;i++)obj(pageStart+i,`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imgStart+i} 0 R >> >> /Contents ${contentStart+i} 0 R >>`);
  for(let i=0;i<n;i++){let url=pages[i].toDataURL('image/jpeg',.84),raw=atob(url.split(',')[1]),bytes=new Uint8Array(raw.length);for(let k=0;k<raw.length;k++)bytes[k]=raw.charCodeAt(k);objects[imgStart+i]=offset;add(`${imgStart+i} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${WIDTH} /Height ${HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);add(bytes);add(`\nendstream\nendobj\n`)}
  for(let i=0;i<n;i++){let stream='q 595.28 0 0 841.89 0 0 cm /Im0 Do Q\n';obj(contentStart+i,`<< /Length ${ascii(stream).length} >>\nstream\n${stream}endstream`)}
  let xref=offset,total=contentStart+n;add(`xref\n0 ${total}\n0000000000 65535 f \n`);for(let i=1;i<total;i++)add(`${String(objects[i]).padStart(10,'0')} 00000 n \n`);add(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);return new Blob(parts,{type:'application/pdf'})}
 function generate(entries,meds,options){const {from,to,sections,notes,patient}=options;let list=entries.filter(x=>x.date>=from&&x.date<=to),gl=list.filter(x=>x.type==='glucose'&&Number.isFinite(Number(x.value))).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))),weights=list.filter(x=>x.type==='weight'&&Number.isFinite(Number(x.value))).sort((a,b)=>a.date.localeCompare(b.date)),meals=list.filter(x=>x.type==='meal').sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))),taken=list.filter(x=>x.type==='med').sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))),userNotes=list.filter(x=>x.type==='note').sort((a,b)=>a.date.localeCompare(b.date));const d=createPages();
  d.heading('Report diabetologico');d.line(`Paziente: ${patient||'Non indicato'}`,{bold:true});d.line(`Periodo: ${fmtDate(from)} - ${fmtDate(to)}`);d.line(`Generato il ${new Date().toLocaleString('it-IT')}`);d.line('Il report contiene soltanto registrazioni valide disponibili sul dispositivo al momento della generazione.',{size:19,color:'#586b7e'});
  if(sections.summary){d.heading('Riepilogo generale');if(gl.length){const vals=gl.map(x=>Number(x.value));d.line(`Glicemia: ${gl.length} rilevazioni · Media ${Math.round(vals.reduce((a,b)=>a+b,0)/vals.length)} mg/dL · Min ${Math.min(...vals)} · Max ${Math.max(...vals)} mg/dL`);for(const [label,fn] of [['< 70',v=>v<70],['70-180',v=>v>=70&&v<=180],['181-250',v=>v>180&&v<=250],['> 250',v=>v>250]])d.line(`${label} mg/dL: ${gl.filter(x=>fn(Number(x.value))).length} rilevazioni`,{size:19,gap:3});d.line('Le fasce descrivono la distribuzione dei singoli controlli, non il tempo trascorso nei relativi intervalli.',{size:17,color:'#607488'})}else d.line('Nessuna glicemia nel periodo.');if(weights.length){let diff=Number(weights.at(-1).value)-Number(weights[0].value);d.line(`Peso: ${num(weights[0].value)} kg → ${num(weights.at(-1).value)} kg · Variazione ${diff>0?'+':''}${num(diff)} kg`)}else d.line('Nessuna pesata nel periodo.');d.line(`Pasti registrati: ${meals.length} · Assunzioni registrate: ${taken.length}`)}
  // Grafici e informazioni di sintesi precedono il diario cronologico.
  if(sections.glucose){d.heading('Andamento glicemico');if(gl.length){const timed=gl.filter(x=>/^\d{2}:\d{2}$/.test(x.time||''));if(timed.length>1)d.chart(timed.map(x=>({date:x.date,value:Number(x.value)})),'glucose');else d.line('Dati insufficienti per il grafico glicemico.')}else d.line('Nessuna glicemia nel periodo.')}
  if(sections.weight){d.heading('Andamento del peso');if(weights.length){if(weights.length>1){d.line(`Variazione: ${num(Number(weights.at(-1).value)-Number(weights[0].value))} kg · ${weights.length} pesate`);d.chart(weights.map(x=>({date:x.date,value:Number(x.value)})),'weight')}else d.line(`Unica pesata: ${num(weights[0].value)} kg`)}else d.line('Nessuna pesata nel periodo.')}
  if(sections.therapy){d.heading('Terapia configurata');const active=meds.filter(m=>(!m.startDate||m.startDate<=to)&&(!m.endDate||m.endDate>=from));if(active.length)for(const m of active)d.line(`${m.name} · ${m.dose||'Dose non indicata'} · ${m.when||'Momento non indicato'}${m.startDate?' · Dal '+fmtDate(m.startDate):''}${m.endDate?' · Al '+fmtDate(m.endDate):''}`,{size:19,gap:4});else d.line('Nessun farmaco configurato nel periodo.');d.line('Le assunzioni effettivamente registrate sono riportate nel diario giornaliero.',{size:18,color:'#607488'})}
  // Un'unica sequenza temporale per giornata: glicemie, farmaci, pasti, peso e note.
  const selected=[];
  if(sections.glucose)selected.push(...gl);
  if(sections.therapy)selected.push(...taken);
  if(sections.meals)selected.push(...meals);
  if(sections.weight)selected.push(...weights);
  if(sections.notes)selected.push(...userNotes);
  const days=new Map();for(const x of selected){if(!days.has(x.date))days.set(x.date,[]);days.get(x.date).push(x)}
  d.heading('Diario giornaliero dettagliato');
  if(!days.size)d.line('Nessuna registrazione negli argomenti e nel periodo selezionati.');
  const dayName=date=>{const [yy,mm,dd]=date.split('-').map(Number);return new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(yy,mm-1,dd)))};
  for(const date of [...days.keys()].sort()){
   const rows=days.get(date).sort((a,b)=>{const ta=/^\d{2}:\d{2}$/.test(a.time||'')?a.time:'99:99',tb=/^\d{2}:\d{2}$/.test(b.time||'')?b.time:'99:99';return ta.localeCompare(tb)});
   d.heading(dayName(date).replace(/^./,c=>c.toUpperCase()));
   for(const x of rows){const time=/^\d{2}:\d{2}$/.test(x.time||'')?x.time:'Ora non registrata';let label='',description='';
    if(x.type==='glucose'){label='GLICEMIA';description=`${num(x.value)} mg/dL · ${x.context||'Senza contesto'}${x.notes?' · '+x.notes:''}`}
    else if(x.type==='med'){label='FARMACO';description=`${x.medName||meds.find(m=>m.id===x.medId)?.name||'Farmaco'} · ${x.state||'Stato non indicato'}${x.dose?' · '+x.dose:''}`}
    else if(x.type==='meal'){label='PASTO';description=`${x.context||'Pasto'} · ${x.food||'Alimenti non indicati'}${x.notes?' · '+x.notes:''}`}
    else if(x.type==='weight'){label='PESO';description=`${num(x.value)} kg`}
    else if(x.type==='note'){label='NOTA';description=x.notes||'Annotazione senza testo'}
    d.line(`${time}  |  ${label}  |  ${description}`,{size:19,gap:5});
   }
  }
  if(notes?.trim()){d.heading('Note per la diabetologa');d.line(notes.trim(),{size:22})}
  return buildPdf(d.finish());}
 return {generate};
})();

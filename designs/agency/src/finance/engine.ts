// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/* Commission engine (ported unchanged from the Commissions sandbox). Pure functions over (cfg, apps, today).
 * compute(cfg, apps, today) -> { ip: university lines, rp: RP lines, exc: exceptions, apps: per-application workings }
 * buildRun(cfg, result, date) -> the payout run for that week's pay day (Finance setup).
 * In production this runs on the server; the pages only read its output. */
import { fmtMoney } from '../data/format';
const DEFYEARS={UG:3,PG:2,RES:3,DIP:1,FDN:1,VET:2,ELICOS:1,SA:1};
const LEVELS={UG:'Undergraduate',PG:'Postgraduate coursework',RES:'Research degree',DIP:'Diploma',FDN:'Foundation',VET:'Vocational (VET/TAFE)',ELICOS:'English (ELICOS)',SA:'Study Abroad'};
const TRIG={census:'Census date',fees:'Fees paid (start of study)',withdrawal:'Withdrawal deadline (start + weeks)',enrol:'Enrolment confirmed (start of study)'};
const DEST={AU:'Australia',NZ:'New Zealand',UK:'United Kingdom',MY:'Malaysia',EU:'Europe',IE:'Ireland',US:'United States',CA:'Canada',AE:'UAE'};
const pd=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d));};
const fd=d=>d.toISOString().slice(0,10);
const addDays=(s,n)=>{const d=pd(s);d.setUTCDate(d.getUTCDate()+n);return fd(d);};
const addMonths=(s,n)=>{const d=pd(s);d.setUTCMonth(d.getUTCMonth()+n);return fd(d);};
const nice=s=>{if(!s)return '—';const d=pd(s);return d.getUTCDate()+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]+' '+d.getUTCFullYear();};
/* the pay day on or after a date (HC34): Finance setup's pay day, Thursday (4) when none is set */
const payDayFor=cfg=>{const n=Number(cfg&&cfg.settings&&cfg.settings.ops&&cfg.settings.ops.payDay);return n>=0&&n<=6&&!isNaN(n)?n:4;};
const thursdayOf=(s,cfg)=>{const d=pd(s);const k=(payDayFor(cfg)-d.getUTCDay()+7)%7;d.setUTCDate(d.getUTCDate()+k);return fd(d);};
const r2=x=>Math.round(x*100)/100;
// one money format everywhere (QC, 1 Nov): data/format.ts
const money=(x,c)=>fmtMoney(x,c||'');
function fxRate(cfg,cur,date){if(!cur||cur==='AUD')return 1;const rows=(cfg.settings.fx||[]).slice().sort((a,b)=>a.week<b.week?-1:1);let r=null;for(const w of rows){if(w.week<=date)r=w;else break;}if(!r||addDays(r.week,7)<=date)return null;return r[cur]==null||r[cur]===''?null:+r[cur];}
function bandOf(bands,n){let i=bands.findIndex(b=>n>=b[0]&&(b[1]==null||n<=b[1]));if(i<0)i=n<bands[0][0]?0:bands.length-1;return {i,from:bands[i][0],to:bands[i][1],pct:+bands[i][2]};}
const bandTxt=b=>b.map(x=>x[0]+(x[1]==null?'+':'–'+x[1])+': '+x[2]+'%').join(', ');
function windowKey(win,date){if(!date)return '';const d=pd(date),y=d.getUTCFullYear(),m=d.getUTCMonth()+1;
  if(win==='FY')return m>=4?'FY'+y+'–'+(y+1):'FY'+(y-1)+'–'+y;
  if(win==='intake2'){if(m>=4&&m<=7)return 'Apr–Jul '+y;return m>=8?'Aug '+y+'–Mar '+(y+1):'Aug '+(y-1)+'–Mar '+y;}
  if(win==='intake')return 'Intake '+date.slice(0,7);return 'CY'+y;}
const winName={CY:'calendar year (Jan–Dec)',FY:'financial year (Apr–Mar)',intake:'intake',intake2:'two intakes (Apr–Jul, Aug–Mar)'};

function compute(cfg,apps,today){
  const S=cfg.settings,U={},RP={},SC={},NO={};cfg.unis.forEach(u=>U[u.id]=u);cfg.rps.forEach(r=>RP[r.id]=r);cfg.schemes.forEach(s=>SC[s.id]=s);cfg.notices.forEach(n=>NO[n.id]=n);
  const out={ip:[],rp:[],exc:[],apps:{}};const A=Object.values(apps).sort((a,b)=>(a.intake||'')<(b.intake||'')?-1:(a.intake||'')>(b.intake||'')?1:(a.id<b.id?-1:1));
  const exc=(app,type,msg,sev)=>out.exc.push({app:app&&app.id,type,msg,sev:sev||'bad'});
  /* pass 1: university side */
  const base={};
  A.forEach(a=>{const u=U[a.uni];const r={a,u,lines:[],why:[],trigBase:null,enrolDate:a.enrolled||a.intake};base[a.id]=r;out.apps[a.id]=r;
    if(!u){exc(a,'No university terms','No terms for this university. The application cannot be priced.');return;}
    const fb=S.fallbackWeeks||4;let tb,tw;
    if(u.trigger==='census'){tb=a.census||addDays(a.intake,7*fb);tw=a.census?'Census date '+nice(a.census):'No census date known: start + '+fb+' weeks = '+nice(tb);}
    else if(u.trigger==='withdrawal'){tb=addDays(a.intake,7*fb);tw='Withdrawal deadline taken as start + '+fb+' weeks = '+nice(tb);}
    else{tb=a.intake;tw=(u.trigger==='fees'?'Fees paid':'Enrolment confirmed')+' at start of study, '+nice(tb);}
    r.trigBase=tb;r.trigWhy=tw;
    const n=Math.max(1,+u.inst||1),gap=n===2?5:n===3?4:0;
    const fixed=u.fixed&&u.fixed[a.level]!=null?+u.fixed[a.level]:null;const pct=u.levels?u.levels[a.level]:null;
    r.rateMissing=fixed==null&&(pct==null||pct==='');
    if(!a.enrolled)return;
    if(r.rateMissing)exc(a,'Rate missing',u.name+' has no rate for '+(LEVELS[a.level]||a.level)+'. Add it on the university’s terms.');
    if(u.ends&&r.enrolDate>u.ends)exc(a,'Contract ended',u.name+'’s contract ended '+nice(u.ends)+'. New enrolments after that date are held until a renewal is entered.');
    if(u.country==='AU'&&!a.studentType)exc(a,'Student type missing','Student type (new, progression or transfer) is mandatory for Australian universities. Admissions enters it.','warn');
    const cnt=fixed!=null?1:n;
    for(let k=1;k<=cnt;k++)r.lines.push({key:'ip'+k,k,n:cnt,date:k===1?tb:addMonths(tb,gap*(k-1)),fixed,pct:pct==null?null:+pct});
    const an=u.annuity;if(an&&an.on&&fixed==null){const yrs=Math.ceil(+a.courseYears||(S.courseYears&&+S.courseYears[a.level])||DEFYEARS[a.level]||2);const last=an.maxYears?Math.min(yrs,+an.maxYears):yrs;r.courseYears=yrs;
      for(let y=2;y<=last;y++)for(let p=1;p<=n;p++)r.lines.push({key:'an'+y+'-'+p,k:'Y'+y+'-'+p,y,p,n,annuity:true,date:addMonths(tb,12*(y-1)+gap*(p-1)),fixed:null,pct:pct==null?null:+pct});}
  });
  /* university tiers: rank GSP-wide within the pool */
  A.forEach(a=>{const r=base[a.id];if(!r.u||!a.enrolled||!r.u.tier||!r.lines.length)return;const t=r.u.tier;if(!(t.levels||[]).includes(a.level))return;
    const poolKey=x=>{const ux=U[x.uni];if(!ux||!ux.tier)return null;const same=(r.u.group&&ux.group===r.u.group)||x.uni===a.uni;if(!same||!(ux.tier.levels||[]).includes(x.level))return null;
      let k=windowKey(t.window==='intake'?'intake':'CY',base[x.id].trigBase);if(t.scope==='country')k+='|'+(x.nationality||'');return k;};
    const my=poolKey(a);const pool=A.filter(x=>x.enrolled&&!(x.withdrawn&&x.withdrawn.date<=base[x.id].trigBase)&&poolKey(x)===my).sort((x,y)=>(base[x.id].trigBase+x.id)<(base[y.id].trigBase+y.id)?-1:1);
    const rank=pool.findIndex(x=>x.id===a.id)+1,total=pool.length;
    const useN=t.retro?total:rank;const b=bandOf(t.bands,useN);r.uniTier={rank,total,band:b,retro:t.retro,key:my,scope:t.scope};
    r.lines.forEach(l=>{if(l.fixed==null)l.pct=b.pct;});
    const bf=t.bandFixed&&t.bandFixed[String(b.i+1)];if(bf)r.uniBonus=+bf;});
  /* amounts and statuses */
  A.forEach(a=>{const r=base[a.id];if(!r.u)return;const u=r.u;const net=Math.max(0,(+a.tuition||0)-(+a.scholarship||0));let tot=0;
    r.lines.forEach(l=>{l.amt=l.fixed!=null?l.fixed:(l.pct==null?null:r2(net/l.n*l.pct/100));if(l.amt!=null&&!l.annuity)tot+=l.amt;});
    if(u.cap&&tot>u.cap&&tot>0){const f=u.cap/tot;r.lines.forEach(l=>{if(l.amt!=null&&!l.annuity)l.amt=r2(l.amt*f);});r.capped=true;}
    if(r.uniBonus&&r.lines.length)r.lines.push({key:'ipb',k:'B',n:r.lines.length,date:r.lines[0].date,fixed:r.uniBonus,pct:null,amt:r.uniBonus,bonus:true});
    const ended=u.ends&&r.enrolDate>u.ends;
    r.lines.forEach(l=>{const wd=a.withdrawn;l.cancelled=!!(wd&&wd.date<=l.date);l.refunded=!!(wd&&wd.date>l.date&&wd.refund);
      l.paid=(a.paidIP&&a.paidIP[l.key])||null;l.inv=(a.inv&&a.inv[l.key])||null;
      l.ent=(l.cancelled||l.refunded||l.amt==null)?0:l.amt;l.held=ended&&!l.paid?'Contract ended':(l.amt==null?'Rate missing':null);
      const paidAmt=l.paid?l.paid.amt:0;l.due=r2(l.ent-paidAmt);
      if(l.cancelled)l.st=['Not payable','p-mute','Student withdrew on '+nice(wd.date)+', before this date'];
      else if(l.paid&&l.due<0)l.st=['University recovers','p-bad','Student withdrew with a refund on '+nice(wd.date)+'; the university takes back '+money(-l.due,u.cur)];
      else if(l.paid)l.st=['Paid','p-good','Received '+nice(l.paid.date)];
      else if(l.held)l.st=['Held: '+l.held.toLowerCase(),'p-bad',''];
      else if(l.inv){const dueOn=addDays(l.inv,+u.payDays||30);l.dueOn=dueOn;l.st=dueOn<today?['Payment overdue','p-bad','Invoiced '+nice(l.inv)+', due '+nice(dueOn)]:['Invoiced','p-acc','Invoiced '+nice(l.inv)+', due '+nice(dueOn)];}
      else if(l.date<=today&&!l.refunded)l.st=['Ready to invoice','p-warn','Trigger date '+nice(l.date)+' has passed'];
      else l.st=['Not yet due','p-mute','Trigger date '+nice(l.date)];
      l.gst=u.country==='AU'?r2(l.ent*(S.auGst||0)/100):0;
      const fxd=l.paid?l.paid.date:(l.date<=today?l.date:today);l.fx=fxRate(cfg,u.cur,fxd);l.aud=l.fx==null?null:r2(l.ent*l.fx);l.dueAud=l.fx==null?null:r2(l.due*l.fx);
      out.ip.push({app:a.id,l,u,a});});
    r.received=r.lines.filter(l=>l.paid&&!l.bonus&&!l.annuity).map(l=>l.paid.date).sort()[0]||null;
    r.counts=!!r.received&&!r.lines.every(l=>l.refunded||l.cancelled);
  });
  /* pass 2: RP side */
  const noticeFor=(a,r,rp)=>{if(!r.u)return null;const ed=r.enrolDate;
    const c=cfg.notices.filter(n=>{const listed=(n.rps||[]).length;if(listed&&!n.rps.includes(rp.id)&&!(rp.payee&&n.rps.includes(rp.payee)))return false;
      if(!listed){const reg=String(n.region||'');if(!(reg.startsWith(rp.region)||(reg.startsWith('Global')&&!(reg.includes('excl. Australia Onshore')&&rp.region==='Australia Onshore'))))return false;}
      if(n.start&&ed<n.start)return false;if(n.end&&ed>n.end)return false;
      if((n.dest||[]).length&&!n.dest.includes(r.u.country))return false;if((n.unis||[]).length&&!n.unis.includes(r.u.id))return false;return true;});
    const pctN=c.filter(n=>n.kind!=='milestone').sort((x,y)=>((y.rps||[]).length?2:1)-((x.rps||[]).length?2:1));
    return {pct:pctN[0]||null,ms:c.filter(n=>n.kind==='milestone'),all:c};};
  A.forEach(a=>{const r=base[a.id];const rp=RP[a.rp];r.rp=rp;if(!rp){if(a.enrolled)exc(a,'No RP','Recruitment partner '+a.rp+' is not in the RP list.');return;}
    r.payee=rp.payee&&RP[rp.payee]?RP[rp.payee]:rp;r.notice=noticeFor(a,r,rp);});
  /* which apps are boxed by a notice (they leave the RP's base tier count) */
  A.forEach(a=>{const r=base[a.id];r.boxed=!!(r.notice&&r.notice.pct&&r.notice.pct.combine==='box'&&!a.gspLead);});
  const schemeOf=rp=>rp.flat!=null&&rp.flat!==''?{type:'flat',flat:+rp.flat,name:'Own flat rate'}:(rp.scheme&&SC[rp.scheme]?SC[rp.scheme]:null);
  A.forEach(a=>{const r=base[a.id];const rp=r.rp;if(!rp||!r.u||!a.enrolled)return;const why=[];let pct=null,src='';
    const tp=r.payee||rp;const viaMP=tp.id!==rp.id;
    why.push(viaMP?'RP: '+rp.name+', mapped to Master Partner '+tp.name+'. GSP pays the Master Partner under the Master Partner’s own terms; the Master Partner pays the RP from that under their own agreement, outside GSP. The tier counts all of the Master Partner’s RPs together.':'RP: '+rp.name+'. All branches of an RP share one count and one rate.');
    const sch=schemeOf(tp);let basePct=null,baseWhy='',est=false;
    if(sch){if(sch.type==='flat'){basePct=+sch.flat;baseWhy=(sch.name==='Own flat rate'?(viaMP?'Master Partner’s own flat rate':'RP’s own flat rate'):'Scheme '+sch.id+' '+sch.name)+': '+basePct+'% of GSP’s base commission.';}
      else{const win=sch.window||'CY';const peers=A.filter(x=>base[x.id].payee&&base[x.id].payee.id===tp.id&&base[x.id].counts&&!base[x.id].boxed&&!x.gspLead);const wk=r.counts?windowKey(win,r.received):windowKey(win,today);
        const inWin=peers.filter(x=>windowKey(win,base[x.id].received)===wk).sort((x,y)=>(base[x.id].received+x.id)<(base[y.id].received+y.id)?-1:1);
        let rank=inWin.findIndex(x=>x.id===a.id)+1;if(!rank){rank=inWin.length+1;est=true;}const total=Math.max(inWin.length,rank);
        const top=sch.bands[sch.bands.length-1];let useN=rank,mode='prospective';
        if(sch.retro==='yes'){useN=total;mode='retrospective';}else if(sch.retro==='top'){if(total>=top[0]){useN=total;mode='retrospective (top band reached)';}else mode='prospective until the top band';}
        const b=bandOf(sch.bands,useN);basePct=b.pct;r.rpTier={rank,total,band:b,mode,wk,est};
        baseWhy='Scheme '+sch.id+' '+sch.name+' ('+bandTxt(sch.bands)+'), '+mode+', counted per '+(winName[win]||win)+'. '+(est?'GSP has not received this student’s commission yet, so they would be enrolment '+rank+' in '+wk+' (estimate).':'This is enrolment '+rank+' of '+total+' in '+wk+' that GSP has been paid for.')+' Band '+(b.i+1)+' → '+b.pct+'%.';}}
    else{if(S.defaultMode==='hold'){baseWhy='No commission terms for this RP. The line waits in exceptions.';exc(a,'RP has no terms',tp.name+' has no commission terms. Add them to price this line.');}
      else{basePct=+S.defaultPct;baseWhy='No commission terms for this RP: the new-contract default of '+basePct+'% applies.';exc(a,'RP has no terms',tp.name+' has no commission terms; the default '+basePct+'% was used. Confirm or add terms.','warn');}}
    if(a.gspLead){pct=+S.gspLeadPct;src='GSP lead';why.push('GSP lead: the student was added by GSP and assigned to this RP. Flat '+pct+'% of GSP’s base commission. Tiers and notices do not apply.');}
    else{const n=r.notice&&r.notice.pct;
      if(n){let np=null,nw='';if(n.kind==='tier'){const peers=A.filter(x=>base[x.id].payee&&base[x.id].payee.id===tp.id&&base[x.id].counts&&base[x.id].notice&&base[x.id].notice.pct&&base[x.id].notice.pct.id===n.id).sort((x,y)=>(base[x.id].received+x.id)<(base[y.id].received+y.id)?-1:1);
          let rank=peers.findIndex(x=>x.id===a.id)+1,e2=false;if(!rank){rank=peers.length+1;e2=true;}const total=Math.max(peers.length,rank);const b=bandOf(n.bands,n.retro==='yes'?total:rank);np=b.pct;nw=n.id+' '+n.name+' ('+bandTxt(n.bands)+'): enrolment '+rank+' under the notice'+(e2?' (estimate)':'')+' → '+np+'%.';}
        else{np=+n.flat;nw=n.id+' '+n.name+': '+np+'% of GSP’s base commission'+(n.kind==='flatfixed'?' plus '+n.fixedCur+' '+n.fixed+' per enrolment':'')+'.';}
        if(n.combine==='box'){pct=np;src=n.id;why.push('Notice applies on the enrolment date ('+nice(r.enrolDate)+'). '+nw,'The notice is a separate box: this enrolment does not count toward the RP’s standard tier, and the standard rate is not used.');if(basePct!=null)why.push('For reference, the standard terms would give '+basePct+'%.');}
        else if(n.combine==='highest'){pct=Math.max(np,basePct||0);src=pct===np?n.id:'scheme';why.push(baseWhy,'Notice: '+nw,'Highest wins: '+pct+'%.');}
        else{pct=(basePct||0)+np;src='scheme+'+n.id;why.push(baseWhy,'Notice adds on: '+nw,'Total '+pct+'%.');}
        if(n.note)why.push('Open point on this notice: '+n.note);}
      else{pct=basePct;src='scheme';why.push(baseWhy);}}
    r.rpPct=pct;r.rpSrc=src;r.rpWhy=why;
    /* lines */
    const am=S.annuityRp||'same';const apct=tp.annuityPct!=null&&tp.annuityPct!==''?+tp.annuityPct:am==='flat'?+S.annuityPct:am==='none'?0:pct;
    r.annPct=apct;r.annWhy=tp.annuityPct!=null&&tp.annuityPct!==''?'This RP has its own annuity rate: '+apct+'% of GSP’s annuity commission.':am==='flat'?'Annuity (year 2 onwards): RPs get a flat '+apct+'% of GSP’s annuity commission (Settings).':am==='none'?'Annuity (year 2 onwards) is not shared with RPs (Settings).':'Annuity (year 2 onwards) is shared at the same rate as the first year: '+(pct==null?'—':pct+'%')+' (Settings).';
    r.lines.forEach(l=>{if(l.bonus)return;const key='rp'+l.k;const ov=a.override&&a.override[key];const lp=l.annuity?apct:pct;let ent=lp==null||l.amt==null?null:r2(l.ent*lp/100);
      if(ov)ent=+ov.amt;const paid=(a.paidRP&&a.paidRP[key])||0;const due=ent==null?null:r2(ent-paid);
      const line={key,app:a.id,a,r,ip:l,cur:r.u.cur,ent,paid,due,ov,kind:'pct',label:l.annuity?'Annuity, year '+l.y+(l.n>1?', period '+l.p+' of '+l.n:''):'Commission, instalment '+l.k+(l.n>1?' of '+l.n:''),annuity:!!l.annuity,lp};
      line.payable=due!=null&&due!==0&&(due<0||!!l.paid);
      line.st=due==null?['Cannot price','p-bad']:due<0?['To recover from RP','p-bad']:due===0&&paid?['Paid','p-good']:due===0?['Nothing due','p-mute']:!l.paid?['Waiting for university payment','p-mute']:paid?['Top-up ready for payout','p-warn']:['Ready for payout','p-warn'];
      if(due<0&&a.withdrawn&&addDays(a.withdrawn.date,+S.legalDays||90)<today)exc(a,'Send to Legal','Clawback of '+money(-due,r.u.cur)+' not recovered within '+(S.legalDays||90)+' days of withdrawal. Forward to Legal.');
      out.rp.push(line);});
    const n=r.notice&&r.notice.pct;
    if(n&&n.kind==='flatfixed'&&n.fixed&&!a.gspLead){const key='fx1';const paid=(a.paidRP&&a.paidRP[key])||0;const anyPaid=r.lines.some(l=>l.paid);const ent=r.counts?+n.fixed:0;const due=r2(ent-paid);
      out.rp.push({key,app:a.id,a,r,ip:null,cur:n.fixedCur||'AUD',ent,paid,due,kind:'fixed',label:n.id+' fixed amount per enrolment',payable:due!==0&&anyPaid,st:due===0&&paid?['Paid','p-good']:!anyPaid?['Waiting for university payment','p-mute']:['Ready for payout','p-warn']});}
  });
  /* milestones: lump sums once GSP has been paid for N enrolments under the notice */
  cfg.notices.filter(n=>n.kind==='milestone').forEach(n=>{const byRp={};A.forEach(a=>{const r=base[a.id];if(!r.rp||!a.enrolled||!r.notice||!r.notice.ms.some(m=>m.id===n.id))return;(byRp[r.rp.id]=byRp[r.rp.id]||[]).push(a);});
    Object.entries(byRp).forEach(([rid,list])=>{const got=list.filter(a=>base[a.id].counts).sort((x,y)=>(base[x.id].received+x.id)<(base[y.id].received+y.id)?-1:1);
      (n.milestones||[]).forEach(([th,amt])=>{if(got.length<th){base[list[0].id].msProgress=(base[list[0].id].msProgress||[]).concat([{n,th,have:got.length,amt}]);return;}
        const a=got[th-1],key='ms-'+n.id+'-'+th,paid=(a.paidRP&&a.paidRP[key])||0,due=r2(amt-paid);
        out.rp.push({key,app:a.id,a,r:base[a.id],ip:null,cur:n.fixedCur||'AUD',ent:+amt,paid,due,kind:'milestone',label:n.id+' milestone: '+th+' paid enrolments',payable:due!==0,st:due===0?['Paid','p-good']:['Ready for payout','p-warn'],
          why:['Notice '+n.id+' '+n.name+': '+(n.milestones||[]).map(m=>m[0]+' enrolments → '+(n.fixedCur||'AUD')+' '+m[1]).join('; ')+'.','GSP has now been paid by the university for '+got.length+' enrolments under the notice; enrolment '+th+' was this student (received '+nice(base[a.id].received)+').','The bonus is due once commission is received, even after the notice has ended. It is a lump sum and is not split per student.']});});});});
  /* add GST, withholding and AUD views to RP lines */
  out.rp.forEach(x=>{const rp=x.r.payee||x.r.rp;x.gstPct=rp&&rp.gst?+S.rpGst||0:0;x.whtPct=rp&&S.wht&&S.wht[rp.region]?+S.wht[rp.region]:0;
    const fx=fxRate(cfg,x.cur,today);x.audEnt=x.ent==null||fx==null?null:r2(x.ent*fx);x.audDue=x.due==null||fx==null?null:r2(x.due*fx);});
  return out;}

/* payout run for the pay day of a date's week (Finance setup's pay day) */
function buildRun(cfg,res,date){const run={date:thursdayOf(date,cfg),payees:{},hold:[],lines:[]};const S=cfg.settings;
  res.rp.filter(x=>x.payable).forEach(x=>{const payee=x.r.payee||x.r.rp;const fixedAud=x.kind!=='pct'&&x.cur==='AUD';const payCur=fixedAud?'AUD':(payee.cur||'AUD');
    const f1=fxRate(cfg,x.cur,run.date),f2=fxRate(cfg,payCur,run.date);
    if(f1==null)run.hold.push(x.cur);if(f2==null)run.hold.push(payCur);
    const aud=f1==null?null:r2(x.due*f1);const pay=aud==null||f2==null?null:r2(aud/f2);
    const L={app:x.app,key:x.key,label:x.label,student:x.a.student,srcCur:x.cur,src:x.due,aud,payCur,pay,gst:r2((pay||0)*x.gstPct/100),wht:r2((pay||0)*x.whtPct/100),payee:payee.id};
    run.lines.push(L);const p=run.payees[payee.id]=run.payees[payee.id]||{id:payee.id,name:payee.name,bank:payee.bank||'AU',byCur:{},lines:[]};p.lines.push(L);
    const c=p.byCur[payCur]=p.byCur[payCur]||{net:0,gst:0,wht:0};c.net=r2(c.net+(pay||0));c.gst=r2(c.gst+L.gst);c.wht=r2(c.wht+L.wht);});
  run.hold=[...new Set(run.hold)];
  Object.values(run.payees).forEach(p=>{p.total={};Object.entries(p.byCur).forEach(([c,v])=>{p.total[c]=r2(v.net+v.gst-v.wht);});p.carry=Object.values(p.total).some(v=>v<0);});
  return run;}
export { compute, buildRun, thursdayOf, payDayFor, addDays, addMonths, fxRate, windowKey, nice, money, r2, LEVELS, TRIG, DEST, bandTxt, winName, DEFYEARS };

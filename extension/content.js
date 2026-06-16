// Daromadchi — Uzum content script (Yoolip style v6)
(function () {
  'use strict';

  const IS_PRODUCT = !window.location.hostname.includes('seller.') && (
    window.location.pathname.includes('/product/') ||
    window.location.pathname.includes('/item/') ||
    /\/[a-z]{2,3}\/[^/]+-\d+/.test(window.location.pathname)
  );
  if (!IS_PRODUCT) return;
  if (document.getElementById('drm-widget') || document.getElementById('drm-toggle')) return;

  (function injectCSS() {
    if (document.getElementById('drm-style')) return;
    const s = document.createElement('style');
    s.id = 'drm-style';
    s.textContent = `
      #drm-widget {
        position: fixed !important;
        bottom: 24px !important;
        right: 24px !important;
        z-index: 2147483647 !important;
        width: 360px !important;
        max-height: 55vh !important;
        overflow-y: auto !important;
        border-radius: 16px !important;
        box-shadow: 0 20px 60px rgba(0,0,0,.5) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
      }
      #drm-widget * { box-sizing: border-box !important; font-family: inherit !important; }
      #drm-widget input, #drm-widget button, #drm-widget a { all: revert; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; cursor: pointer; }
      #drm-widget input { cursor: text; }
      #drm-toggle {
        position: fixed !important;
        bottom: 80px !important;
        right: 16px !important;
        z-index: 2147483647 !important;
        width: 40px !important;
        height: 40px !important;
        border-radius: 50% !important;
        background: #7c3aed !important;
        border: none !important;
        cursor: pointer !important;
        box-shadow: 0 4px 20px rgba(124,58,237,.5) !important;
        font-size: 16px !important;
        font-weight: 900 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: #fff !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      }
    `;
    (document.head || document.documentElement).appendChild(s);
  })();

  const LANGS = {
    uz: {
      fbo:'FBO', fbs:'FBS', params:'HISOB PARAMETRLARI',
      costLabel:"Tannarx (so'm)", packLabel:"Qadoqlash (so'm)", commLabel:'Komissiya %', adLabel:'Reklama %',
      volLabel:'Hajm (litr)',
      breakdown:'XARAJATLAR TAQSIMOTI', narx:'Narx', comm:'Komissiya', delivery:'Yetkazib berish',
      returns:'Qaytarishlar (~2%)', acquiring:'Ekvayring (1.5%)',
      reklama:'Reklama', tax:'Soliq (6%)', saqlash:'Saqlash narxi alohida',
      totalMkt:'Jami Uzum', totalCost:'Jami xarajat',
      profitLabel:'TAXMINIY SOF FOYDA', marja:'marja',
      ueBtn:"+ Unit-ekonomikaga qo'shish", marketBtn:'🛒 Bozor tahlili →',
      noPrice:'Narx aniqlanmadi. Sahifani yangilang.',
      footer:'Taxminiy hisob · daromadchi.uz', taxminiy:'taxminiy',
    },
    ru: {
      fbo:'FBO', fbs:'FBS', params:'ПАРАМЕТРЫ РАСЧЁТА',
      costLabel:'Себестоимость (сум)', packLabel:'Упаковка (сум)', commLabel:'Комиссия %', adLabel:'Реклама %',
      volLabel:'Объём (л)',
      breakdown:'СТРУКТУРА ЗАТРАТ', narx:'Цена', comm:'Комиссия', delivery:'Доставка',
      returns:'Возвраты (~2%)', acquiring:'Эквайринг (1.5%)',
      reklama:'Реклама', tax:'Налог (6%)', saqlash:'Хранение отдельно',
      totalMkt:'Итого Uzum', totalCost:'Всего расходов',
      profitLabel:'ОЦ. ЧИСТАЯ ПРИБЫЛЬ', marja:'маржа',
      ueBtn:'+ В юнит-экономику', marketBtn:'🛒 Анализ рынка →',
      noPrice:'Цена не определена.',
      footer:'Примерный расчёт · daromadchi.uz', taxminiy:'прибл.',
    },
    en: {
      fbo:'FBO', fbs:'FBS', params:'CALCULATION PARAMS',
      costLabel:'Cost price (som)', packLabel:'Packaging (som)', commLabel:'Commission %', adLabel:'Ad %',
      volLabel:'Volume (L)',
      breakdown:'COST BREAKDOWN', narx:'Price', comm:'Commission', delivery:'Delivery',
      returns:'Returns (~2%)', acquiring:'Acquiring (1.5%)',
      reklama:'Advertising', tax:'Tax (6%)', saqlash:'Storage billed separately',
      totalMkt:'Total Uzum fees', totalCost:'Total costs',
      profitLabel:'EST. NET PROFIT', marja:'margin',
      ueBtn:'+ Add to unit economics', marketBtn:'🛒 Market analysis →',
      noPrice:'Price not found.',
      footer:'Estimated · daromadchi.uz', taxminiy:'approx.',
    },
  };

  // Uzum Market official category commissions (docs/marketplace-tariffs.md)
  const COMM_MAP = [
    // 5% — Telefon va gadjetlar / Kompyuter va noutbuklar
    [/telefon|gadjet|smartfon|iphone|samsung|xiaomi|redmi|kompyuter|noutbuk|laptop|notebook/i, 5],
    // 6% — Elektronika / O'yinchoqlar
    [/o.yinchoq|oyinchoq|игрушк/i, 6],
    [/elektronika|электроника/i, 6],
    // 7% — Poyabzal
    [/poyabzal|botinok|sandal|krossovk|обувь/i, 7],
    // 9% — Kiyim (bolalar) — must be before generic kiyim
    [/kiyim.*bolalar|bolalar.*kiyim|детская одежда/i, 9],
    // 9% — Sport va turizm
    [/sport|turizm|спорт/i, 9],
    // 8% — Kiyim (erkaklar / ayollar)
    [/kiyim|libos|одежда|платье|рубашка|футболка/i, 8],
    // 10% — Go'zallik / Maishiy texnika / Oziq-ovqat
    [/gozellik|gozallik|kosmetika|parfyum|parvarish|красота|косметик|парфюм|уход/i, 10],
    [/maishiy.*texnika|maishiy.*tex|бытовая техника|холодильник/i, 10],
    [/oziq|ovqat|продукт|питание/i, 10],
    // 11% — Uy va bog'
    [/uy.*bog|oshxona|mebel|uy.*jihozlar|дом.*сад|мебел|кухн/i, 11],
    // 12% — Avtomobil tovarlari
    [/avto|mashina|zapchast|автотовар|запчаст/i, 12],
  ];

  const THEME = {
    dark:  {bg:'#0f1117',card:'#1a1f2e',border:'#2a3040',text:'#e2e8f0',muted:'#94a3b8',red:'#f87171',green:'#4ade80',amber:'#f59e0b'},
    light: {bg:'#f8fafc',card:'#ffffff',border:'#e2e8f0',text:'#0f172a',muted:'#64748b',red:'#dc2626',green:'#16a34a',amber:'#d97706'},
  };

  let langKey='uz', theme='dark';
  function L() { return LANGS[langKey]; }
  function T() { return THEME[theme]; }

  function getCommission() {
    const parts = [];
    const bcEl = document.querySelector('[class*="readcrumb"],[class*="ategory"],[class*="Breadcrumb"]');
    if (bcEl) parts.push(bcEl.innerText);
    const h1El = document.querySelector('h1');
    if (h1El) parts.push(h1El.innerText);
    if (document.title) parts.push(document.title);
    const text = parts.join(' ');
    for (const [re, pct] of COMM_MAP) if (re.test(text)) return pct;
    return 10; // Boshqa toifalar: 10%
  }

  function parsePrice() {
    // Priority 1: exact class confirmed from live Uzum DOM
    const priority = [
      '.u-currency.sell-price',
      '[class*="sell-price"]',
      '[class*="sellPrice"]',
      '[class*="current-price"]',
      '[class*="currentPrice"]',
      '[class*="final-price"]',
      '[class*="finalPrice"]',
    ];
    for (const sel of priority) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const raw = el.innerText.replace(/[^\d]/g,'');
      if (raw.length >= 4 && raw.length <= 9) return parseInt(raw);
    }
    // Priority 2: scan visible elements with so'm text, skip installment context
    const candidates = [];
    for (const el of document.querySelectorAll('span,div,p,strong,b')) {
      if (el.children.length > 1) continue;
      const text = (el.innerText || '').trim();
      const raw = text.replace(/[^\d]/g,'');
      if (raw.length < 4 || raw.length > 9) continue;
      if (!/so[`'.]?m|сум/i.test(text)) continue;
      // Skip installment: parent contains "× N oy"
      let node = el, skip = false;
      for (let i=0;i<5;i++) {
        node = node.parentElement;
        if (!node) break;
        const pt = node.innerText || '';
        if (/×\s*\d+\s*oy|per-month|installment|kartasiz/i.test(pt) && pt.length < 300) { skip=true; break; }
      }
      if (skip) continue;
      const cn = (el.className||'').toLowerCase();
      if (/old|cross|strike|prev|origin|per-month|month|oy/.test(cn)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.top > 0 && rect.top < window.innerHeight)
        candidates.push({ price:parseInt(raw), top:rect.top });
    }
    if (candidates.length > 0) {
      candidates.sort((a,b)=>a.top-b.top);
      return candidates[0].price;
    }
    return null;
  }
  function parseTitle() { return (document.querySelector('h1')||{}).innerText?.trim().slice(0,70)||'Mahsulot'; }
  function getProductId() { const m=window.location.pathname.match(/-(\d{5,})/); return m?m[1]:null; }
  function fp(n) { if(n===null||n===undefined) return '—'; return Math.round(n).toLocaleString('uz-UZ')+" so'm"; }

  function calcUzum(price,{costPrice=0,packaging=0,adPct=5,fbo=true,volume=1,commPct=undefined}={}) {
    if(commPct===undefined) commPct=getCommission();
    const commission = Math.round(price*commPct/100);
    const delivery   = fbo ? Math.min(50000, volume<=1 ? 5250 : 5250 + (Math.ceil(volume)-1)*250) : 0;
    const returns    = Math.round(price*0.02);
    const acquiring  = Math.round(price*0.015);
    const adSpend    = Math.round(price*adPct/100);
    const tax        = Math.round(price*0.06);
    const mktTotal   = commission+delivery+returns+acquiring;
    const jamiTotal  = mktTotal+adSpend+tax+packaging+costPrice;
    const netProfit  = price-jamiTotal;
    const margin     = Math.round((netProfit/price)*100);
    const roi        = costPrice>0?Math.round((netProfit/costPrice)*100):null;
    return {commPct,commission,delivery,returns,acquiring,adSpend,tax,packaging,costPrice,mktTotal,jamiTotal,netProfit,margin,roi};
  }

  function pColor(m) { const t=T(); return m>=25?t.green:m>=10?t.amber:t.red; }

  function waitForPriceAndBuild(maxWait=8000) {
    const targetUrl = location.href;
    setTimeout(() => {
      if (location.href !== targetUrl) return;
      if (document.getElementById('drm-widget')) return;
      if (parsePrice()) { buildWidget(); return; }
      const deadline = Date.now() + maxWait;
      const obs = new MutationObserver(() => {
        if (location.href !== targetUrl || document.getElementById('drm-widget')) { obs.disconnect(); return; }
        if (parsePrice() || Date.now() > deadline) {
          obs.disconnect();
          if (parsePrice()) buildWidget();
        }
      });
      obs.observe(document.body, { subtree: true, childList: true, characterData: true });
      setTimeout(() => obs.disconnect(), maxWait + 500);
    }, 400);
  }

  function buildWidget(attempt=0) {
    if (!parsePrice()) {
      if (attempt < 6) setTimeout(()=>{ if(!document.getElementById('drm-widget')) buildWidget(attempt+1); }, 800);
      return;
    }
    let fbo=true, costPrice=0, packaging=0, adPct=5, volume=1, commPct=null;
    const title=parseTitle(), productId=getProductId();

    const wrap=document.createElement('div');
    wrap.id='drm-widget';
    document.body.appendChild(wrap);

    // Toggle button (shown when widget is hidden)
    const toggleBtn=document.createElement('button');
    toggleBtn.id='drm-toggle';
    toggleBtn.title='Daromadchi';
    toggleBtn.textContent='D';
    toggleBtn.style.setProperty('display','none','important');
    document.body.appendChild(toggleBtn);
    toggleBtn.onclick=()=>{ wrap.style.display='block'; toggleBtn.style.setProperty('display','none','important'); };

    chrome.storage.local.get(['ueSettings','drmLang','drmTheme','drmCommOverride_uzum'],data=>{
      if(data.ueSettings){costPrice=data.ueSettings.costPrice||0;packaging=data.ueSettings.packaging||0;adPct=data.ueSettings.adPct||5;fbo=data.ueSettings.fbo!==undefined?data.ueSettings.fbo:true;volume=data.ueSettings.volume||1;}
      if(data.drmLang)langKey=data.drmLang;
      if(data.drmTheme)theme=data.drmTheme;
      commPct=data.drmCommOverride_uzum!=null?data.drmCommOverride_uzum:getCommission();
      render();
    });

    function gi(){
      return{
        costPrice:parseFloat(wrap.querySelector('#drm-inp-cost')?.value)||0,
        packaging:parseFloat(wrap.querySelector('#drm-inp-pack')?.value)||0,
        adPct:parseFloat(wrap.querySelector('#drm-inp-ad')?.value)||5,
        volume:parseFloat(wrap.querySelector('#drm-cost-vol')?.value)||1,
        commPct:parseFloat(wrap.querySelector('#drm-inp-comm')?.value)||commPct||getCommission(),
      };
    }

    function liveRecalc(){
      const price=parsePrice();if(!price)return;
      const eco=calcUzum(price,{...gi(),fbo});const c=pColor(eco.margin);
      const S=(id,v)=>{const e=wrap.querySelector('#drm-v-'+id);if(e)e.textContent=v;};
      const C=(id,col)=>{const e=wrap.querySelector('#drm-v-'+id);if(e)e.style.color=col;};
      S('comm',`−${fp(eco.commission)}`);S('comm-pct',String(eco.commPct));S('delivery',`−${fp(eco.delivery)}`);
      S('returns',`−${fp(eco.returns)}`);S('acq',`−${fp(eco.acquiring)}`);
      S('ad',`−${fp(eco.adSpend)}`);S('tax',`−${fp(eco.tax)}`);
      S('mkt',`−${fp(eco.mktTotal)}`);S('total',`−${fp(eco.jamiTotal)}`);
      S('profit',fp(eco.netProfit));S('margin',`${eco.margin}% ${L().marja}`);
      C('profit',c);C('margin',c);
      const bar=wrap.querySelector('#drm-profit-bar');
      if(bar){bar.style.width=Math.max(0,Math.min(100,eco.margin))+'%';bar.style.background=c;}
    }

    function inp(id,val,ph='0',step='1'){
      const t=T();
      return `<input id="${id}" type="number" step="${step}" value="${val||''}" placeholder="${ph}" style="width:88px;background:${t.card};border:1px solid ${t.border};border-radius:6px;padding:5px 8px;color:${t.text};font-size:12px;text-align:right;outline:none;display:block">`;
    }
    function row(label,id,val,extra=''){
      const t=T();
      return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:1px 0"><span style="color:${t.muted}">${label}${extra}</span><span id="drm-v-${id}" style="color:${t.red}">${val}</span></div>`;
    }

    function render(){
      const price=parsePrice();const t=T();const l=L();
      const _commPct=commPct!==null?commPct:getCommission();
      const eco=price?calcUzum(price,{costPrice,packaging,adPct,fbo,volume,commPct:_commPct}):null;
      const color=eco?pColor(eco.margin):t.muted;
      const barW=eco?Math.max(0,Math.min(100,eco.margin)):0;

      wrap.style.background=t.bg;
      wrap.style.border=`1px solid ${t.border}`;
      wrap.style.color=t.text;

      wrap.innerHTML=`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid ${t.border};position:sticky;top:0;background:${t.bg};z-index:1">
          <div style="display:flex;align-items:center;gap:7px">
            <span style="font-weight:700;font-size:14px;color:${t.text}">Daromadchi</span>
            <span style="font-size:10px;font-weight:600;padding:2px 7px;background:#7c3aed;color:#fff;border-radius:20px;display:inline-block">Uzum</span>
          </div>
          <div style="display:flex;align-items:center;gap:3px">
            ${['uz','ru','en'].map(k=>`<button id="drm-lang-${k}" style="padding:2px 5px;border-radius:4px;border:1px solid ${langKey===k?'#7c3aed':t.border};background:${langKey===k?'#7c3aed':'transparent'};color:${langKey===k?'#fff':t.muted};font-size:10px">${k.toUpperCase()}</button>`).join('')}
            <button id="drm-theme" style="padding:3px 6px;border-radius:5px;border:1px solid ${t.border};background:transparent;color:${t.muted};font-size:13px">${theme==='dark'?'☀️':'🌙'}</button>
            <button id="drm-refresh" style="padding:3px 6px;border-radius:5px;border:1px solid ${t.border};background:transparent;color:${t.muted};font-size:14px">↻</button>
            <button id="drm-close" style="padding:3px 6px;border-radius:5px;border:1px solid ${t.border};background:transparent;color:${t.muted};font-size:14px">✕</button>
          </div>
        </div>

        <div style="padding:10px 12px;display:flex;flex-direction:column;gap:8px">
          <div>
            <div style="font-weight:600;font-size:13px;color:${t.text};margin-bottom:4px">${title}</div>
            ${price?`<div style="font-size:22px;font-weight:800;color:#a78bfa;display:block">${fp(price)}</div>`:`<div style="color:${t.red};font-size:12px">${l.noPrice}</div>`}
          </div>

          <div style="display:flex;gap:6px">
            <button id="drm-fbo" style="flex:1;padding:7px;border-radius:8px;border:1px solid ${fbo?'#7c3aed':t.border};background:${fbo?'#7c3aed':'transparent'};color:${fbo?'#fff':t.muted};font-size:12px;font-weight:600">${l.fbo}</button>
            <button id="drm-fbs" style="flex:1;padding:7px;border-radius:8px;border:1px solid ${!fbo?'#7c3aed':t.border};background:${!fbo?'#7c3aed':'transparent'};color:${!fbo?'#fff':t.muted};font-size:12px;font-weight:600">${l.fbs}</button>
          </div>

          <div>
            <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:8px">${l.params}</div>
            <div style="display:flex;flex-direction:column;gap:7px">
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">${l.costLabel}</span>${inp('drm-inp-cost',costPrice)}</div>
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">${l.packLabel}</span>${inp('drm-inp-pack',packaging)}</div>
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">${l.commLabel}</span>${inp('drm-inp-comm',_commPct,'10','0.5')}</div>
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">${l.adLabel}</span>${inp('drm-inp-ad',adPct,'5','0.5')}</div>
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">${l.volLabel}</span>${inp('drm-cost-vol',volume,'1','0.1')}</div>
            </div>
          </div>

          ${!eco?'':`
          <div>
            <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:8px">${l.breakdown}</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:${t.muted}">${l.narx}</span><span style="color:${t.text};font-weight:600">${fp(price)}</span></div>
              ${row(`${l.comm} (<span id="drm-v-comm-pct">${_commPct}</span>%)`,'comm',`−${fp(eco.commission)}`)}
              ${row(l.delivery,'delivery',`−${fp(eco.delivery)}`,` <span style="color:${t.amber};font-size:10px">${l.taxminiy}</span>`)}
              ${row(l.returns,'returns',`−${fp(eco.returns)}`,` <span style="color:${t.amber};font-size:10px">${l.taxminiy}</span>`)}
              ${row(l.acquiring,'acq',`−${fp(eco.acquiring)}`)}
              ${row(l.reklama+` (${adPct}%)`,'ad',`−${fp(eco.adSpend)}`)}
              ${row(l.tax,'tax',`−${fp(eco.tax)}`)}
              <div style="font-size:10px;color:${t.muted};font-style:italic;padding:1px 0">${l.saqlash}</div>
              <div style="height:1px;background:${t.border};margin:2px 0"></div>
              <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600"><span style="color:${t.muted}">${l.totalMkt}</span><span id="drm-v-mkt" style="color:${t.red}">−${fp(eco.mktTotal)}</span></div>
              <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600"><span style="color:${t.muted}">${l.totalCost}</span><span id="drm-v-total" style="color:${t.red}">−${fp(eco.jamiTotal)}</span></div>
            </div>
          </div>

          <div style="background:${t.card};border:1px solid ${t.border};border-radius:12px;padding:9px;text-align:center">
            <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:5px">${l.profitLabel}</div>
            <div id="drm-v-profit" style="font-size:22px;font-weight:800;color:${color};margin-bottom:5px;display:block">${fp(eco.netProfit)}</div>
            <div style="height:4px;background:${t.border};border-radius:4px;margin-bottom:5px"><div id="drm-profit-bar" style="height:4px;border-radius:4px;background:${color};width:${barW}%;display:block"></div></div>
            <div id="drm-v-margin" style="color:${color};font-size:13px;font-weight:600">${eco.margin}% ${l.marja}</div>
          </div>
          `}

          <button id="drm-ue" style="display:block;width:100%;padding:9px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;text-align:center">${l.ueBtn}</button>
          <div style="text-align:center;font-size:10px;color:${t.muted}">${l.footer}</div>
        </div>
      `;

      wrap.querySelector('#drm-close').onclick=()=>{
        wrap.style.display='none';
        toggleBtn.style.setProperty('display','flex','important');
        chrome.storage.local.set({widgetClosed:Date.now()});
      };
      wrap.querySelector('#drm-refresh').onclick=()=>{wrap.remove();toggleBtn.remove();setTimeout(init,300);};
      wrap.querySelector('#drm-theme').onclick=()=>{theme=theme==='dark'?'light':'dark';chrome.storage.local.set({drmTheme:theme});render();};
      wrap.querySelector('#drm-fbo').onclick=()=>{fbo=true;render();};
      wrap.querySelector('#drm-fbs').onclick=()=>{fbo=false;render();};
      ['uz','ru','en'].forEach(k=>{wrap.querySelector(`#drm-lang-${k}`)?.addEventListener('click',()=>{langKey=k;chrome.storage.local.set({drmLang:k});render();});});
      ['#drm-inp-cost','#drm-inp-pack','#drm-inp-ad','#drm-cost-vol'].forEach(id=>{wrap.querySelector(id)?.addEventListener('input',liveRecalc);});
      wrap.querySelector('#drm-inp-comm')?.addEventListener('input',()=>{
        const v=parseFloat(wrap.querySelector('#drm-inp-comm')?.value);
        if(v>0){commPct=v;}
        liveRecalc();
      });
      wrap.querySelector('#drm-inp-comm')?.addEventListener('change',()=>{
        const v=parseFloat(wrap.querySelector('#drm-inp-comm')?.value);
        if(v>0){commPct=v;chrome.storage.local.set({drmCommOverride_uzum:v});}
        else{commPct=getCommission();chrome.storage.local.remove('drmCommOverride_uzum');}
      });

      wrap.querySelector('#drm-ue')?.addEventListener('click',async()=>{
        const vals=gi();const price2=parsePrice();
        const eco2=price2?calcUzum(price2,{...vals,fbo}):null;
        await chrome.storage.local.set({ueSettings:{...vals,fbo,volume:vals.volume}});
        const params=new URLSearchParams({
          source:'uzum',title,url:location.href,
          price:String(price2||''),commPct:String(eco2?.commPct||''),
          commission:String(eco2?.commission||''),delivery:String(eco2?.delivery||''),
          acquiring:String(eco2?.acquiring||''),adSpend:String(eco2?.adSpend||''),
          tax:String(eco2?.tax||''),packaging:String(eco2?.packaging||''),
          profit:String(eco2?.netProfit??''),margin:String(eco2?.margin??''),roi:String(eco2?.roi??''),
        });
        if(productId)params.set('productId',productId);
        window.open(`https://daromadchi.uz/dashboard/unit-economics?${params}`,'_blank');
      });
    }
  }

  async function init(){
    if(document.getElementById('drm-widget'))return;
    const{widgetClosed}=await chrome.storage.local.get('widgetClosed');
    const closed=Date.now()-(widgetClosed||0)<1800000;
    waitForPriceAndBuild();
    if(closed){
      // Widget was recently closed — start hidden with toggle button visible
      setTimeout(()=>{
        const w=document.getElementById('drm-widget');
        const t=document.getElementById('drm-toggle');
        if(w&&t){w.style.display='none';t.style.setProperty('display','flex','important');}
      },100);
    }
  }

  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}
  else{init();}

  let lastUrl=location.href;
  new MutationObserver(()=>{
    if(location.href!==lastUrl){lastUrl=location.href;
      document.getElementById('drm-widget')?.remove();
      document.getElementById('drm-toggle')?.remove();
      chrome.storage.local.remove('widgetClosed');
      waitForPriceAndBuild();
    }
  }).observe(document,{subtree:true,childList:true});
})();

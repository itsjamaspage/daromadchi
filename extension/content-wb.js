// Daromadchi — Wildberries content script (Yoolip style v3)
(function () {
  'use strict';

  const IS_SELLER  = location.hostname.includes('seller.wildberries');
  const IS_PRODUCT = !IS_SELLER && (
    /\/catalog\/\d+\/detail/.test(location.pathname) ||
    /\/catalog\/\d+$/.test(location.pathname)
  );

  if (!IS_SELLER && !IS_PRODUCT) return;
  if (document.getElementById('drm-wb-widget') || document.getElementById('drm-wb-ue')) return;

  // ── PRODUCT PAGE ────────────────────────────────────────────────────────────
  if (IS_PRODUCT) {

    (function injectCSS() {
      if (document.getElementById('drm-wb-style')) return;
      const s = document.createElement('style');
      s.id = 'drm-wb-style';
      s.textContent = `
        #drm-wb-ue {
          position: fixed !important;
          bottom: 24px !important;
          right: 24px !important;
          z-index: 2147483647 !important;
          display: block !important;
          width: 360px !important;
          max-height: 92vh !important;
          overflow-y: auto !important;
          border-radius: 16px !important;
          box-shadow: 0 20px 60px rgba(0,0,0,.5) !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          font-size: 13px !important;
          line-height: 1.4 !important;
        }
        #drm-wb-ue * { box-sizing: border-box !important; font-family: inherit !important; }
        #drm-wb-ue input, #drm-wb-ue button, #drm-wb-ue a { all: revert; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; cursor: pointer; }
        #drm-wb-ue input { cursor: text; }
      `;
      (document.head || document.documentElement).appendChild(s);
    })();

    const LANGS = {
      uz: {
        fby:'FBY', fbs:'FBS', params:'HISOB PARAMETRLARI',
        costLabel:"Tannarx (so'm)", packLabel:"Qadoqlash (so'm)", volLabel:'Hajm (litr)', adLabel:'Reklama %',
        breakdown:'XARAJATLAR TAQSIMOTI', narx:'Narx', comm:'Komissiya', delivery:'Yetkazib berish',
        returns:'Qaytarishlar (~3%)', acquiring:'Ekvayring (1.5%)', reklama:'Reklama', tax:'Soliq (6%)',
        totalMkt:'Jami Wildberries', totalCost:'Jami xarajat',
        profitLabel:'TAXMINIY SOF FOYDA', marja:'marja',
        ueBtn:"+ Unit-ekonomikaga qo'shish", marketBtn:'🛒 Bozor tahlili →',
        noPrice:'Narx aniqlanmadi. Sahifani yangilang.',
        footer:'Taxminiy hisob \xb7 daromadchi.uz', taxminiy:'taxminiy',
        currency: v => Math.round(v).toLocaleString('ru-RU') + ' сум',
      },
      ru: {
        fby:'FBY', fbs:'FBS', params:'ПАРАМЕТРЫ РАСЧЁТА',
        costLabel:'Себестоимость (сум)', packLabel:'Упаковка (сум)', volLabel:'Объём (л)', adLabel:'Реклама %',
        breakdown:'СТРУКТУРА ЗАТРАТ', narx:'Цена', comm:'Комиссия', delivery:'Доставка',
        returns:'Возвраты (~3%)', acquiring:'Эквайринг (1.5%)', reklama:'Реклама', tax:'Налог (6%)',
        totalMkt:'Итого WB', totalCost:'Всего расходов',
        profitLabel:'ОЦ. ЧИСТАЯ ПРИБЫЛЬ', marja:'маржа',
        ueBtn:'+ В юнит-экономику', marketBtn:'🛒 Анализ рынка →',
        noPrice:'Цена не определена.',
        footer:'Примерный расчёт \xb7 daromadchi.uz', taxminiy:'прибл.',
        currency: v => Math.round(v).toLocaleString('ru-RU') + ' сум',
      },
      en: {
        fby:'FBY', fbs:'FBS', params:'CALCULATION PARAMS',
        costLabel:'Cost price (som)', packLabel:'Packaging (som)', volLabel:'Volume (L)', adLabel:'Ad %',
        breakdown:'COST BREAKDOWN', narx:'Price', comm:'Commission', delivery:'Delivery',
        returns:'Returns (~3%)', acquiring:'Acquiring (1.5%)', reklama:'Advertising', tax:'Tax (6%)',
        totalMkt:'Total WB fees', totalCost:'Total costs',
        profitLabel:'EST. NET PROFIT', marja:'margin',
        ueBtn:'+ Add to unit economics', marketBtn:'🛒 Market analysis →',
        noPrice:'Price not found.',
        footer:'Estimated \xb7 daromadchi.uz', taxminiy:'approx.',
        currency: v => Math.round(v).toLocaleString('ru-RU') + ' som',
      },
    };

    const THEME = {
      dark:  { bg:'#0f1117', card:'#1a1f2e', border:'#2a3040', text:'#e2e8f0', muted:'#94a3b8', red:'#f87171', green:'#4ade80', amber:'#f59e0b' },
      light: { bg:'#f8fafc', card:'#ffffff',  border:'#e2e8f0', text:'#0f172a', muted:'#64748b', red:'#dc2626', green:'#16a34a', amber:'#d97706' },
    };

    const COMM_MAP = [
      [/smartfon|telefon|iphone|samsung/i, 3],
      [/noutbuk|laptop|macbook/i, 5],
      [/elektronika|kompyuter|aksesuar|plansh/i, 7],
      [/kiyim|libos|futbolka|ko.ylak|platye|zhilyet/i, 23],
      [/poyabzal|botinok|sandal|krossovk/i, 15],
      [/sport|trenaj/i, 13],
      [/gozellik|parfyum|kosmetika|beauty|uhod/i, 12],
      [/oziq|ovqat|mahsulot|produkty/i, 10],
      [/uy|mebel|maishiy|interior/i, 12],
    ];

    let langKey = 'uz', theme = 'dark';
    function L() { return LANGS[langKey]; }
    function T() { return THEME[theme]; }
    function fp(n) { if (n===null||n===undefined) return '—'; return L().currency(n); }

    function getCommission() {
      const bc = document.querySelector('[class*="readcrumb"],[class*="ategory"],[class*="Breadcrumb"]');
      if (bc) { const t = bc.innerText; for (const [re, pct] of COMM_MAP) if (re.test(t)) return pct; }
      return 15;
    }

    function parseWbPrice() {
      const specific = [
        '.price-block__final-price', '[class*="price-block__final"]',
        'ins.price__lower-price', '[class*="price__lower"]',
        '.product-page__price-block ins', '[data-link="text{:currentPrice}"]',
        '.price-block ins', '[class*="priceWithSale"]', '[class*="price-block"] ins',
      ];
      for (const sel of specific) {
        const el = document.querySelector(sel);
        if (el) { const raw = el.innerText.replace(/[^\d]/g,''); if (raw.length>=3&&raw.length<=12) return parseInt(raw); }
      }
      // Fallback: all <ins> tags sorted by top position (main price is highest on page)
      const insTags = Array.from(document.querySelectorAll('ins'));
      if (insTags.length > 0) {
        insTags.sort((a,b)=>(a.getBoundingClientRect().top+window.scrollY)-(b.getBoundingClientRect().top+window.scrollY));
        for (const el of insTags) { const raw=el.innerText.replace(/[^\d]/g,''); if (raw.length>=3&&raw.length<=12) return parseInt(raw); }
      }
      return null;
    }

    function parseWbTitle() { return (document.querySelector('h1')||{}).innerText?.trim().slice(0,70)||'Mahsulot'; }
    function getArticle() { const m=location.pathname.match(/\/catalog\/(\d+)/); return m?m[1]:null; }

    function calcWb(price, { costPrice=0, packaging=0, adPct=5, volume=1, fby=true }={}) {
      const commPct    = getCommission();
      const commission = Math.round(price * commPct / 100);
      const delivery   = fby ? Math.round(volume * 20000) : Math.round(volume * 10000);
      const returns    = Math.round(price * 0.03);
      const acquiring  = Math.round(price * 0.015);
      const adSpend    = Math.round(price * adPct / 100);
      const tax        = Math.round(price * 0.06);
      const mktTotal   = commission + delivery + returns + acquiring;
      const jamiTotal  = mktTotal + adSpend + tax + packaging + costPrice;
      const netProfit  = price - jamiTotal;
      const margin     = Math.round((netProfit / price) * 100);
      const roi        = costPrice > 0 ? Math.round((netProfit / costPrice) * 100) : null;
      return { commPct, commission, delivery, returns, acquiring, adSpend, tax, packaging, costPrice, mktTotal, jamiTotal, netProfit, margin, roi };
    }

    function pColor(m) { const t=T(); return m>=25?t.green:m>=10?t.amber:t.red; }

    function inp(id, val, ph='0', step='1') {
      const t=T();
      return `<input id="${id}" type="number" step="${step}" value="${val||''}" placeholder="${ph}" style="width:88px;background:${t.card};border:1px solid ${t.border};border-radius:6px;padding:5px 8px;color:${t.text};font-size:12px;text-align:right;outline:none;display:block">`;
    }
    function row(label, id, val, extra='') {
      const t=T();
      return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:1px 0"><span style="color:${t.muted}">${label}${extra}</span><span id="drm-wb-v-${id}" style="color:${t.red}">${val}</span></div>`;
    }

    function buildWbWidget() {
      const price   = parseWbPrice();
      if (!price) { setTimeout(()=>{ if(!document.getElementById('drm-wb-ue')) buildWbWidget(); },1500); return; }
      const title   = parseWbTitle();
      const article = getArticle();

      let fby=true, costPrice=0, packaging=0, adPct=5, volume=1;

      const wrap = document.createElement('div');
      wrap.id = 'drm-wb-ue';
      document.body.appendChild(wrap);

      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'drm-wb-toggle';
      toggleBtn.title = 'Daromadchi';
      toggleBtn.textContent = 'D';
      toggleBtn.style.cssText = 'position:fixed!important;bottom:24px!important;right:24px!important;z-index:2147483647!important;width:44px!important;height:44px!important;border-radius:50%!important;background:#7c3aed!important;border:none!important;cursor:pointer!important;box-shadow:0 4px 20px rgba(124,58,237,.5)!important;font-size:20px!important;color:#fff!important;font-family:-apple-system,sans-serif!important;';
      toggleBtn.style.setProperty('display','none','important');
      document.body.appendChild(toggleBtn);
      toggleBtn.onclick = () => { wrap.style.display='block'; toggleBtn.style.setProperty('display','none','important'); };

      chrome.storage.local.get(['ueSettings','drmLang','drmTheme'], data => {
        if (data.ueSettings) { costPrice=data.ueSettings.costPrice||0; packaging=data.ueSettings.packaging||0; adPct=data.ueSettings.adPct||5; volume=data.ueSettings.volume||1; fby=data.ueSettings.fby!==undefined?data.ueSettings.fby:true; }
        if (data.drmLang) langKey=data.drmLang;
        if (data.drmTheme) theme=data.drmTheme;
        render();
      });

      function gi() {
        return {
          costPrice: parseFloat(wrap.querySelector('#drm-wb-cost')?.value)||0,
          packaging: parseFloat(wrap.querySelector('#drm-wb-pack')?.value)||0,
          adPct:     parseFloat(wrap.querySelector('#drm-wb-ad')?.value)||5,
          volume:    parseFloat(wrap.querySelector('#drm-wb-vol')?.value)||1,
        };
      }

      function liveRecalc() {
        if (!price) return;
        const eco=calcWb(price,{...gi(),fby}); const c=pColor(eco.margin);
        const S=(id,v)=>{const e=wrap.querySelector('#drm-wb-v-'+id);if(e)e.textContent=v;};
        const C=(id,col)=>{const e=wrap.querySelector('#drm-wb-v-'+id);if(e)e.style.color=col;};
        S('comm',`−${fp(eco.commission)}`); S('delivery',`−${fp(eco.delivery)}`);
        S('returns',`−${fp(eco.returns)}`); S('acq',`−${fp(eco.acquiring)}`);
        S('ad',`−${fp(eco.adSpend)}`); S('tax',`−${fp(eco.tax)}`);
        S('mkt',`−${fp(eco.mktTotal)}`); S('total',`−${fp(eco.jamiTotal)}`);
        S('profit',fp(eco.netProfit)); S('margin',`${eco.margin}% ${L().marja}`);
        C('profit',c); C('margin',c);
        const bar=wrap.querySelector('#drm-wb-bar');
        if(bar){bar.style.width=Math.max(0,Math.min(100,eco.margin))+'%';bar.style.background=c;}
      }

      function render() {
        const t=T(); const l=L();
        const eco=price?calcWb(price,{costPrice,packaging,adPct,volume,fby}):null;
        const color=eco?pColor(eco.margin):t.muted;
        const barW=eco?Math.max(0,Math.min(100,eco.margin)):0;
        const commPct=getCommission();

        wrap.style.background=t.bg;
        wrap.style.border=`1px solid ${t.border}`;
        wrap.style.color=t.text;

        wrap.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid ${t.border};position:sticky;top:0;background:${t.bg};z-index:1">
            <div style="display:flex;align-items:center;gap:7px">
              <span style="font-weight:700;font-size:14px;color:${t.text}">Daromadchi</span>
              <span style="font-size:10px;font-weight:600;padding:2px 7px;background:#7c3aed;color:#fff;border-radius:20px;display:inline-block">WB</span>
            </div>
            <div style="display:flex;align-items:center;gap:3px">
              ${['uz','ru','en'].map(k=>`<button id="drm-wb-lang-${k}" style="padding:2px 5px;border-radius:4px;border:1px solid ${langKey===k?'#7c3aed':t.border};background:${langKey===k?'#7c3aed':'transparent'};color:${langKey===k?'#fff':t.muted};font-size:10px">${k.toUpperCase()}</button>`).join('')}
              <button id="drm-wb-theme" style="padding:3px 6px;border-radius:5px;border:1px solid ${t.border};background:transparent;color:${t.muted};font-size:13px">${theme==='dark'?'☀️':'🌙'}</button>
              <button id="drm-wb-refresh" style="padding:3px 6px;border-radius:5px;border:1px solid ${t.border};background:transparent;color:${t.muted};font-size:14px">↻</button>
              <button id="drm-wb-close" style="padding:3px 6px;border-radius:5px;border:1px solid ${t.border};background:transparent;color:${t.muted};font-size:14px">✕</button>
            </div>
          </div>

          <div style="padding:10px 12px;display:flex;flex-direction:column;gap:8px">
            <div>
              <div style="font-weight:600;font-size:13px;color:${t.text};margin-bottom:4px">${title}${article?`<span style="font-size:10px;color:${t.muted};margin-left:6px">#${article}</span>`:''}</div>
              ${price
                ?`<div style="font-size:22px;font-weight:800;color:#fb7185;display:block">${fp(price)}</div>`
                :`<div style="color:${t.red};font-size:12px">${l.noPrice}</div>`}
            </div>

            <div style="display:flex;gap:6px">
              <button id="drm-wb-fby" style="flex:1;padding:7px;border-radius:8px;border:1px solid ${fby?'#7c3aed':t.border};background:${fby?'#7c3aed':'transparent'};color:${fby?'#fff':t.muted};font-size:12px;font-weight:600">${l.fby}</button>
              <button id="drm-wb-fbs" style="flex:1;padding:7px;border-radius:8px;border:1px solid ${!fby?'#7c3aed':t.border};background:${!fby?'#7c3aed':'transparent'};color:${!fby?'#fff':t.muted};font-size:12px;font-weight:600">${l.fbs}</button>
            </div>

            <div>
              <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:8px">${l.params}</div>
              <div style="display:flex;flex-direction:column;gap:7px">
                <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">${l.costLabel}</span>${inp('drm-wb-cost',costPrice)}</div>
                <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">${l.packLabel}</span>${inp('drm-wb-pack',packaging)}</div>
                <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">${l.adLabel}</span>${inp('drm-wb-ad',adPct,'5','0.5')}</div>
                <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">${l.volLabel}</span>${inp('drm-wb-vol',volume,'1','0.1')}</div>
              </div>
            </div>

            ${!eco?'':`
            <div>
              <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:8px">${l.breakdown}</div>
              <div style="display:flex;flex-direction:column;gap:4px">
                <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:${t.muted}">${l.narx}</span><span style="color:${t.text};font-weight:600">${fp(price)}</span></div>
                ${row(l.comm+` (${commPct}%)`,'comm',`−${fp(eco.commission)}`)}
                ${row(l.delivery+` (${fby?'FBY':'FBS'})`,'delivery',`−${fp(eco.delivery)}`,` <span style="color:${t.amber};font-size:10px">${l.taxminiy}</span>`)}
                ${row(l.returns,'returns',`−${fp(eco.returns)}`,` <span style="color:${t.amber};font-size:10px">${l.taxminiy}</span>`)}
                ${row(l.acquiring,'acq',`−${fp(eco.acquiring)}`)}
                ${row(l.reklama+` (${adPct}%)`,'ad',`−${fp(eco.adSpend)}`)}
                ${row(l.tax,'tax',`−${fp(eco.tax)}`)}
                <div style="height:1px;background:${t.border};margin:2px 0"></div>
                <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600"><span style="color:${t.muted}">${l.totalMkt}</span><span id="drm-wb-v-mkt" style="color:${t.red}">−${fp(eco.mktTotal)}</span></div>
                <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600"><span style="color:${t.muted}">${l.totalCost}</span><span id="drm-wb-v-total" style="color:${t.red}">−${fp(eco.jamiTotal)}</span></div>
              </div>
            </div>

            <div style="background:${t.card};border:1px solid ${t.border};border-radius:12px;padding:9px;text-align:center">
              <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:5px">${l.profitLabel}</div>
              <div id="drm-wb-v-profit" style="font-size:22px;font-weight:800;color:${color};margin-bottom:5px;display:block">${fp(eco.netProfit)}</div>
              <div style="height:4px;background:${t.border};border-radius:4px;margin-bottom:5px"><div id="drm-wb-bar" style="height:4px;border-radius:4px;background:${color};width:${barW}%;display:block"></div></div>
              <div id="drm-wb-v-margin" style="color:${color};font-size:13px;font-weight:600">${eco.margin}% ${l.marja}</div>
            </div>
            `}

            <button id="drm-wb-ue-btn" style="display:block;width:100%;padding:9px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;text-align:center">${l.ueBtn}</button>
            <button id="drm-wb-market" style="display:block;width:100%;padding:10px;background:${t.card};color:${t.text};border:1px solid ${t.border};border-radius:10px;font-size:13px;text-align:center">${l.marketBtn}</button>
            <div style="text-align:center;font-size:10px;color:${t.muted}">${l.footer}</div>
          </div>
        `;

        wrap.querySelector('#drm-wb-close').onclick   = () => { wrap.style.display='none'; toggleBtn.style.setProperty('display','flex','important'); chrome.storage.local.set({wbWidgetClosed:Date.now()}); };
        wrap.querySelector('#drm-wb-refresh').onclick = () => { wrap.remove(); toggleBtn.remove(); setTimeout(buildWbWidget,300); };
        wrap.querySelector('#drm-wb-theme').onclick   = () => { theme=theme==='dark'?'light':'dark'; chrome.storage.local.set({drmTheme:theme}); render(); };
        wrap.querySelector('#drm-wb-fby').onclick     = () => { fby=true; render(); };
        wrap.querySelector('#drm-wb-fbs').onclick     = () => { fby=false; render(); };
        ['uz','ru','en'].forEach(k => { wrap.querySelector(`#drm-wb-lang-${k}`)?.addEventListener('click',()=>{ langKey=k; chrome.storage.local.set({drmLang:k}); render(); }); });
        ['#drm-wb-cost','#drm-wb-pack','#drm-wb-ad','#drm-wb-vol'].forEach(id => { wrap.querySelector(id)?.addEventListener('input',liveRecalc); });

        wrap.querySelector('#drm-wb-ue-btn')?.addEventListener('click', async () => {
          const vals=gi(); const eco2=price?calcWb(price,{...vals,fby}):null;
          await chrome.storage.local.set({ueSettings:{...vals,fby}});
          const params=new URLSearchParams({
            source:'wb', title, url:location.href,
            price:String(price||''), commPct:String(eco2?.commPct||''),
            commission:String(eco2?.commission||''), delivery:String(eco2?.delivery||''),
            acquiring:String(eco2?.acquiring||''), adSpend:String(eco2?.adSpend||''),
            tax:String(eco2?.tax||''), packaging:String(eco2?.packaging||''),
            profit:String(eco2?.netProfit??''), margin:String(eco2?.margin??''), roi:String(eco2?.roi??''),
          });
          if (article) params.set('productId',article);
          window.open(`https://daromadchi.uz/dashboard/unit-economics?${params}`,'_blank');
        });
        wrap.querySelector('#drm-wb-market')?.addEventListener('click',()=>{ window.open(`https://daromadchi.uz/dashboard/market?q=${encodeURIComponent(title)}&source=wb`,'_blank'); });
      }
    }

    async function tryInit() {
      if (document.getElementById('drm-wb-ue')) return;
      const {wbWidgetClosed}=await chrome.storage.local.get('wbWidgetClosed');
      if (Date.now()-(wbWidgetClosed||0)<1800000) return;
      buildWbWidget();
    }

    setTimeout(tryInit,1500);
    setTimeout(()=>{ if(!document.getElementById('drm-wb-ue')) tryInit(); },3500);

    let lastUrl=location.href;
    new MutationObserver(()=>{
      if(location.href!==lastUrl){ lastUrl=location.href;
        setTimeout(()=>{ document.getElementById('drm-wb-ue')?.remove(); document.getElementById('drm-wb-toggle')?.remove(); if(/\/catalog\/\d+/.test(location.pathname)) tryInit(); },1800); }
    }).observe(document,{subtree:true,childList:true});

    return;
  }

  // ── SELLER PORTAL ──────────────────────────────────────────────────────────
  function fp(n) {
    if (!n&&n!==0) return '—';
    if (n>=1000000) return (n/1000000).toFixed(1)+' mln ₽';
    if (n>=1000)    return (n/1000).toFixed(0)+' ming ₽';
    return n.toLocaleString('ru-RU')+' ₽';
  }

  function createWidget(stats) {
    const w=document.createElement('div');
    w.id='drm-wb-widget';
    w.style.cssText='position:fixed;bottom:24px;right:24px;z-index:999999;background:#0d0d19;border:1px solid rgba(168,85,247,.35);border-radius:14px;padding:14px 16px;min-width:220px;box-shadow:0 8px 32px rgba(0,0,0,.5);font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:12px;color:#e2e8f0;cursor:default;transition:opacity .2s';
    w.innerHTML=`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-weight:700;font-size:13px;background:linear-gradient(135deg,#c084fc,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Daromadchi</span>
        <span style="margin-left:auto;font-size:10px;color:#a855f7">WB</span>
        <button id="drm-wb-close" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:14px;line-height:1;padding:0 0 0 4px">×</button>
      </div>
      ${stats?`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div style="background:#1e293b;border-radius:8px;padding:8px"><div style="color:#64748b;font-size:10px;margin-bottom:2px">Bugungi daromad</div><div style="font-weight:700;color:#c084fc">${fp(stats.todayRevenue)}</div></div>
          <div style="background:#1e293b;border-radius:8px;padding:8px"><div style="color:#64748b;font-size:10px;margin-bottom:2px">Buyurtmalar</div><div style="font-weight:700;color:#38bdf8">${stats.todayOrders||0}</div></div>
          <div style="background:#1e293b;border-radius:8px;padding:8px"><div style="color:#64748b;font-size:10px;margin-bottom:2px">Kam zaxira</div><div style="font-weight:700;color:${stats.lowStock>0?'#f87171':'#4ade80'}">${stats.lowStock||0}</div></div>
          <div style="background:#1e293b;border-radius:8px;padding:8px"><div style="color:#64748b;font-size:10px;margin-bottom:2px">Bekor</div><div style="font-weight:700;color:#94a3b8">${stats.todayReturns||0}</div></div>
        </div>`:`<div style="color:#64748b;font-size:11px;text-align:center;padding:8px 0">Ma'lumot yuklanmoqda...</div>`}
      <a href="https://daromadchi.uz/dashboard" target="_blank" style="display:block;margin-top:10px;text-align:center;background:rgba(168,85,247,.15);border:1px solid rgba(168,85,247,.3);border-radius:8px;padding:6px;color:#c084fc;text-decoration:none;font-size:11px;font-weight:600">To'liq dashboard →</a>
    `;
    document.body.appendChild(w);
    document.getElementById('drm-wb-close').onclick=e=>{e.stopPropagation();w.style.opacity='0';setTimeout(()=>w.remove(),200);try{sessionStorage.setItem('drm-wb-closed','1');}catch{}};
  }

  async function init() {
    try{if(sessionStorage.getItem('drm-wb-closed'))return;}catch{}
    const data=await chrome.storage.local.get(['wbStats','wbConnected','wbSellerInfo']);
    if(!data.wbConnected&&!data.wbStats)return;
    createWidget(data.wbStats||null);
  }

  chrome.storage.local.get('tg_activated',({tg_activated})=>{
    if(!tg_activated)return;
    if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}
    else{setTimeout(init,1500);}
  });
  chrome.storage.onChanged.addListener(changes=>{if(changes.wbStats&&document.getElementById('drm-wb-widget')){document.getElementById('drm-wb-widget')?.remove();init();}});
})();

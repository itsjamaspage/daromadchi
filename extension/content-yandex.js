// Daromadchi — Yandex Market content script (Yoolip style v3)
(function () {
  'use strict';

  const hostname = window.location.hostname;
  const IS_UZ     = hostname === 'market.yandex.uz';
  const IS_BUYER  = IS_UZ || hostname === 'market.yandex.ru';
  const IS_PARTNER = hostname === 'partner.market.yandex.ru';

  if (!IS_BUYER && !IS_PARTNER) return;
  if (document.getElementById('drm-ym-ue')) return;

  (function injectCSS() {
    if (document.getElementById('drm-ym-style')) return;
    const s = document.createElement('style');
    s.id = 'drm-ym-style';
    s.textContent = `
      #drm-ym-ue {
        position: fixed !important;
        bottom: 24px !important;
        right: 24px !important;
        z-index: 2147483647 !important;
        width: 360px !important;
        max-height: 72vh !important;
        overflow-y: auto !important;
        border-radius: 16px !important;
        box-shadow: 0 20px 60px rgba(0,0,0,.5) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
      }
      #drm-ym-ue * { box-sizing: border-box !important; font-family: inherit !important; }
      #drm-ym-ue input, #drm-ym-ue button, #drm-ym-ue a { all: revert; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; cursor: pointer; }
      #drm-ym-ue input { cursor: text; }
    `;
    (document.head || document.documentElement).appendChild(s);
  })();

  const LANGS = {
    uz: {
      fby:'FBY', fbs:'FBS', params:'HISOB PARAMETRLARI',
      costLabel: v => `Tannarx (${v?"so'm":'so\'m'})`,
      packLabel: v => `Qadoqlash (${v?"so'm":'so\'m'})`,
      commLabel:'Komissiya %', volLabel:'Hajm (litr)', adLabel:'Reklama %',
      breakdown:'XARAJATLAR TAQSIMOTI', narx:'Narx', comm:'Komissiya', delivery:'Yetkazib berish',
      returns:'Qaytarishlar (~2%)', acquiring:'Ekvayring (0.5%)', reklama:'Reklama', tax:'Soliq (6%)',
      totalMkt:'Jami Yandex Market', totalCost:'Jami xarajat',
      profitLabel:'TAXMINIY SOF FOYDA', marja:'marja',
      ueBtn:"+ Unit-ekonomikaga qo'shish", marketBtn:'🛒 Bozor tahlili →',
      noPrice:'Narx aniqlanmadi. Sahifani yangilang.',
      footer:'Taxminiy hisob \xb7 daromadchi.uz', taxminiy:'taxminiy',
    },
    ru: {
      fby:'FBY', fbs:'FBS', params:'ПАРАМЕТРЫ РАСЧЁТА',
      costLabel: () => 'Себестоимость (₽)',
      packLabel: () => 'Упаковка (₽)',
      commLabel:'Комиссия %', volLabel:'Объём (л)', adLabel:'Реклама %',
      breakdown:'СТРУКТУРА ЗАТРАТ', narx:'Цена', comm:'Комиссия', delivery:'Доставка',
      returns:'Возвраты (~2%)', acquiring:'Эквайринг (0.5%)', reklama:'Реклама', tax:'Налог (6%)',
      totalMkt:'Итого Яндекс Маркет', totalCost:'Всего расходов',
      profitLabel:'ОЦ. ЧИСТАЯ ПРИБЫЛЬ', marja:'маржа',
      ueBtn:'+ В юнит-экономику', marketBtn:'🛒 Анализ рынка →',
      noPrice:'Цена не определена.',
      footer:'Примерный расчёт \xb7 daromadchi.uz', taxminiy:'прибл.',
    },
    en: {
      fby:'FBY', fbs:'FBS', params:'CALCULATION PARAMS',
      costLabel: () => 'Cost price',
      packLabel: () => 'Packaging',
      commLabel:'Commission %', volLabel:'Volume (L)', adLabel:'Ad %',
      breakdown:'COST BREAKDOWN', narx:'Price', comm:'Commission', delivery:'Delivery',
      returns:'Returns (~2%)', acquiring:'Acquiring (0.5%)', reklama:'Advertising', tax:'Tax (6%)',
      totalMkt:'Total YM fees', totalCost:'Total costs',
      profitLabel:'EST. NET PROFIT', marja:'margin',
      ueBtn:'+ Add to unit economics', marketBtn:'🛒 Market analysis →',
      noPrice:'Price not found.',
      footer:'Estimated \xb7 daromadchi.uz', taxminiy:'approx.',
    },
  };

  const THEME = {
    dark:  { bg:'#0f1117', card:'#1a1f2e', border:'#2a3040', text:'#e2e8f0', muted:'#94a3b8', red:'#f87171', green:'#4ade80', amber:'#f59e0b' },
    light: { bg:'#f8fafc', card:'#ffffff',  border:'#e2e8f0', text:'#0f172a', muted:'#64748b', red:'#dc2626', green:'#16a34a', amber:'#d97706' },
  };

  let langKey = 'uz', theme = 'dark';
  function L() { return LANGS[langKey]; }
  function T() { return THEME[theme]; }

  function fp(n) {
    if (n===null||n===undefined) return '—';
    if (IS_UZ) return Math.round(n).toLocaleString('uz-UZ') + " so'm";
    return Math.round(n).toLocaleString('ru-RU') + ' ₽';
  }

  function parseYmPrice() {
    const selectors = [
      '[data-auto="price"]', '[data-auto="snippet-price-current"]',
      '[data-zone-name="price"]', '[class*="YpcPrice"]', '[class*="ypcPrice"]',
      '[class*="priceView"]', '[class*="PriceView"]', '[class*="priceBlock"]',
      '[class*="PriceBlock"]', '[class*="price-value"]', '[class*="priceValue"]',
      'span[class*="price"]:not([class*="old"]):not([class*="Old"]):not([class*="cross"])',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) { const raw=el.innerText.replace(/[^\d]/g,''); if(raw.length>=2&&raw.length<=12) return parseInt(raw); }
      } catch(_) {}
    }
    const currency = IS_UZ ? /сум|so'm/i : /₽|руб/i;
    for (const el of document.querySelectorAll('span,div,p,strong,b')) {
      if (el.children.length>3) continue;
      const text=el.innerText||'';
      if (currency.test(text)) {
        const raw=text.replace(/[^\d]/g,'');
        if (raw.length>=2&&raw.length<=12) {
          const cls=(el.className||'').toLowerCase();
          if (cls.includes('old')||cls.includes('cross')||cls.includes('strike')||cls.includes('prev')) continue;
          return parseInt(raw);
        }
      }
    }
    return null;
  }

  function parseYmTitle() {
    for (const sel of ['[data-auto="offerTitle"]','h1','[class*="title"]','[class*="Title"]']) {
      const el=document.querySelector(sel);
      if (el&&el.innerText&&el.innerText.trim().length>2) return el.innerText.trim().slice(0,80);
    }
    return null;
  }

  // Yandex Market Go UZ — category commissions (partner.market.yandex.uz official tariff table)
  // Apple products: 1.5% (stated explicitly). Others: midpoint of official band per category.
  const YM_COMM_MAP = [
    [/apple|iphone|ipad|macbook|airpods/i, 1.5],
    [/smartfon|telefon|phone|samsung|xiaomi|redmi/i, 4],
    [/noutbuk|laptop|macbook|kompyuter|computer|notebook/i, 4],
    [/elektronika|smart.home|aqlli.uy|aksesuar|gadjet|gadget|plansh/i, 5],
    [/maishiy.tex|bytovaya|appliance|xolodilnik|refrig|vakuum|vacuum|konditsioner/i, 6],
    [/avto|mashina|avtomobil|automotive|shina|tire|zapchast/i, 8],
    [/gozellik|kosmetika|parfyum|beauty|uhod|volos|makiyaj|skincare/i, 10],
    [/uy.va.bog|dom.i.sad|kitchen|oshxona|mebel|tekstil|textile|posuda|cookware/i, 11],
    [/kiyim|libos|odejda|shoes|poyabzal|sumka|bag|fashion|aksessuarlar|yuvelirnye/i, 12],
  ];

  function getYmCommission() {
    const bc = document.querySelector('[class*="readcrumb"],[class*="ategory"],[class*="Breadcrumb"],[data-auto="breadcrumb"],[class*="navigation"],[class*="Navigation"]');
    if (bc) { const t = bc.innerText; for (const [re, pct] of YM_COMM_MAP) if (re.test(t)) return pct; }
    return 10;
  }

  function isYmProductPage() {
    const path = window.location.pathname;
    return /\/product(--|\/|\d)/i.test(path) || /\/sku\//i.test(path);
  }

  function calcYm(price, { costPrice=0, packaging=0, adPct=5, volume=1, fby=true, commPct=undefined }={}) {
    if(commPct===undefined) commPct=getYmCommission();
    const commission = Math.round(price * commPct / 100);
    const delivery   = fby ? Math.round(volume * 15000) : Math.round(volume * 10000);
    const returns    = Math.round(price * 0.02);
    const acquiring  = Math.round(price * 0.005);
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
    return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:1px 0"><span style="color:${t.muted}">${label}${extra}</span><span id="drm-ym-v-${id}" style="color:${t.red}">${val}</span></div>`;
  }

  function buildYmWidget(attempt=0) {
    if (!isYmProductPage()) return;
    const price = parseYmPrice();
    const title = parseYmTitle();
    if (!price) {
      if (attempt < 6) setTimeout(()=>{ if(!document.getElementById('drm-ym-ue')) buildYmWidget(attempt+1); }, 800);
      return;
    }

    let fby=true, costPrice=0, packaging=0, adPct=5, volume=1, commPct=null;

    const wrap = document.createElement('div');
    wrap.id = 'drm-ym-ue';
    document.body.appendChild(wrap);

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'drm-ym-toggle';
    toggleBtn.title = 'Daromadchi';
    toggleBtn.textContent = 'D';
    toggleBtn.style.cssText = 'position:fixed!important;bottom:24px!important;right:24px!important;z-index:2147483647!important;width:44px!important;height:44px!important;border-radius:50%!important;background:#7c3aed!important;border:none!important;cursor:pointer!important;box-shadow:0 4px 20px rgba(124,58,237,.5)!important;font-size:20px!important;color:#fff!important;font-family:-apple-system,sans-serif!important;align-items:center!important;justify-content:center!important;';
    toggleBtn.style.setProperty('display','none','important');
    document.body.appendChild(toggleBtn);
    toggleBtn.onclick = () => { wrap.style.display='block'; toggleBtn.style.setProperty('display','none','important'); };

    chrome.storage.local.get(['ueSettings','drmLang','drmTheme'], data => {
      if (data.ueSettings) { costPrice=data.ueSettings.costPrice||0; packaging=data.ueSettings.packaging||0; adPct=data.ueSettings.adPct||5; volume=data.ueSettings.volume||1; fby=data.ueSettings.fby!==undefined?data.ueSettings.fby:true; }
      if (data.drmLang) langKey=data.drmLang;
      if (data.drmTheme) theme=data.drmTheme;
      commPct=getYmCommission();
      render();
    });

    function gi() {
      return {
        costPrice: parseFloat(wrap.querySelector('#drm-ym-cost')?.value)||0,
        packaging: parseFloat(wrap.querySelector('#drm-ym-pack')?.value)||0,
        adPct:     parseFloat(wrap.querySelector('#drm-ym-ad')?.value)||5,
        volume:    parseFloat(wrap.querySelector('#drm-ym-vol')?.value)||1,
        commPct:   parseFloat(wrap.querySelector('#drm-ym-comm')?.value)||commPct||getYmCommission(),
      };
    }

    function liveRecalc() {
      const eco=calcYm(price,{...gi(),fby}); const c=pColor(eco.margin);
      const S=(id,v)=>{const e=wrap.querySelector('#drm-ym-v-'+id);if(e)e.textContent=v;};
      const C=(id,col)=>{const e=wrap.querySelector('#drm-ym-v-'+id);if(e)e.style.color=col;};
      S('comm',`−${fp(eco.commission)}`); S('comm-pct',String(eco.commPct)); S('delivery',`−${fp(eco.delivery)}`);
      S('returns',`−${fp(eco.returns)}`); S('acq',`−${fp(eco.acquiring)}`);
      S('ad',`−${fp(eco.adSpend)}`); S('tax',`−${fp(eco.tax)}`);
      S('mkt',`−${fp(eco.mktTotal)}`); S('total',`−${fp(eco.jamiTotal)}`);
      S('profit',fp(eco.netProfit)); S('margin',`${eco.margin}% ${L().marja}`);
      C('profit',c); C('margin',c);
      const bar=wrap.querySelector('#drm-ym-bar');
      if(bar){bar.style.width=Math.max(0,Math.min(100,eco.margin))+'%';bar.style.background=c;}
    }

    function render() {
      const t=T(); const l=L();
      const _commPct=commPct!==null?commPct:getYmCommission();
      const eco=calcYm(price,{costPrice,packaging,adPct,volume,fby,commPct:_commPct});
      const color=pColor(eco.margin);
      const barW=Math.max(0,Math.min(100,eco.margin));

      wrap.style.background=t.bg;
      wrap.style.border=`1px solid ${t.border}`;
      wrap.style.color=t.text;

      wrap.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid ${t.border};position:sticky;top:0;background:${t.bg};z-index:1">
          <div style="display:flex;align-items:center;gap:7px">
            <span style="font-weight:700;font-size:14px;color:${t.text}">Daromadchi</span>
            <span style="font-size:10px;font-weight:600;padding:2px 7px;background:#7c3aed;color:#fff;border-radius:20px;display:inline-block">YM</span>
          </div>
          <div style="display:flex;align-items:center;gap:3px">
            ${['uz','ru','en'].map(k=>`<button id="drm-ym-lang-${k}" style="padding:2px 5px;border-radius:4px;border:1px solid ${langKey===k?'#7c3aed':t.border};background:${langKey===k?'#7c3aed':'transparent'};color:${langKey===k?'#fff':t.muted};font-size:10px">${k.toUpperCase()}</button>`).join('')}
            <button id="drm-ym-theme" style="padding:3px 6px;border-radius:5px;border:1px solid ${t.border};background:transparent;color:${t.muted};font-size:13px">${theme==='dark'?'☀️':'🌙'}</button>
            <button id="drm-ym-refresh" style="padding:3px 6px;border-radius:5px;border:1px solid ${t.border};background:transparent;color:${t.muted};font-size:14px">↻</button>
            <button id="drm-ym-close" style="padding:3px 6px;border-radius:5px;border:1px solid ${t.border};background:transparent;color:${t.muted};font-size:14px">✕</button>
          </div>
        </div>

        <div style="padding:10px 12px;display:flex;flex-direction:column;gap:8px">
          <div>
            <div style="font-weight:600;font-size:13px;color:${t.text};margin-bottom:4px">${title||'Mahsulot'}</div>
            <div style="font-size:22px;font-weight:800;color:#a78bfa;display:block">${fp(price)}</div>
          </div>

          <div style="display:flex;gap:6px">
            <button id="drm-ym-fby" style="flex:1;padding:7px;border-radius:8px;border:1px solid ${fby?'#7c3aed':t.border};background:${fby?'#7c3aed':'transparent'};color:${fby?'#fff':t.muted};font-size:12px;font-weight:600">${l.fby}</button>
            <button id="drm-ym-fbs" style="flex:1;padding:7px;border-radius:8px;border:1px solid ${!fby?'#7c3aed':t.border};background:${!fby?'#7c3aed':'transparent'};color:${!fby?'#fff':t.muted};font-size:12px;font-weight:600">${l.fbs}</button>
          </div>

          <div>
            <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:8px">${l.params}</div>
            <div style="display:flex;flex-direction:column;gap:7px">
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">${l.costLabel(IS_UZ)}</span>${inp('drm-ym-cost',costPrice)}</div>
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">${l.packLabel(IS_UZ)}</span>${inp('drm-ym-pack',packaging)}</div>
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">${l.commLabel}</span>${inp('drm-ym-comm',_commPct,'10','0.5')}</div>
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">${l.adLabel}</span>${inp('drm-ym-ad',adPct,'5','0.5')}</div>
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:${t.muted}">${l.volLabel}</span>${inp('drm-ym-vol',volume,'1','0.1')}</div>
            </div>
          </div>

          <div>
            <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:8px">${l.breakdown}</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:${t.muted}">${l.narx}</span><span style="color:${t.text};font-weight:600">${fp(price)}</span></div>
              ${row(`${l.comm} (<span id="drm-ym-v-comm-pct">${_commPct}</span>%)`,'comm',`−${fp(eco.commission)}`)}
              ${row(l.delivery+` (${fby?'FBY':'FBS'})`,'delivery',`−${fp(eco.delivery)}`,` <span style="color:${t.amber};font-size:10px">${l.taxminiy}</span>`)}
              ${row(l.returns,'returns',`−${fp(eco.returns)}`,` <span style="color:${t.amber};font-size:10px">${l.taxminiy}</span>`)}
              ${row(l.acquiring,'acq',`−${fp(eco.acquiring)}`)}
              ${row(l.reklama+` (${adPct}%)`,'ad',`−${fp(eco.adSpend)}`)}
              ${row(l.tax,'tax',`−${fp(eco.tax)}`)}
              <div style="height:1px;background:${t.border};margin:2px 0"></div>
              <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600"><span style="color:${t.muted}">${l.totalMkt}</span><span id="drm-ym-v-mkt" style="color:${t.red}">−${fp(eco.mktTotal)}</span></div>
              <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600"><span style="color:${t.muted}">${l.totalCost}</span><span id="drm-ym-v-total" style="color:${t.red}">−${fp(eco.jamiTotal)}</span></div>
            </div>
          </div>

          <div style="background:${t.card};border:1px solid ${t.border};border-radius:12px;padding:9px;text-align:center">
            <div style="font-size:10px;font-weight:600;color:${t.muted};letter-spacing:.7px;margin-bottom:5px">${l.profitLabel}</div>
            <div id="drm-ym-v-profit" style="font-size:22px;font-weight:800;color:${color};margin-bottom:5px;display:block">${fp(eco.netProfit)}</div>
            <div style="height:4px;background:${t.border};border-radius:4px;margin-bottom:5px"><div id="drm-ym-bar" style="height:4px;border-radius:4px;background:${color};width:${barW}%;display:block"></div></div>
            <div id="drm-ym-v-margin" style="color:${color};font-size:13px;font-weight:600">${eco.margin}% ${l.marja}</div>
          </div>

          <button id="drm-ym-ue-btn" style="display:block;width:100%;padding:9px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;text-align:center">${l.ueBtn}</button>
          <button id="drm-ym-market" style="display:block;width:100%;padding:10px;background:${t.card};color:${t.text};border:1px solid ${t.border};border-radius:10px;font-size:13px;text-align:center">${l.marketBtn}</button>
          <div style="text-align:center;font-size:10px;color:${t.muted}">${l.footer}</div>
        </div>
      `;

      wrap.querySelector('#drm-ym-close').onclick   = () => { wrap.style.display='none'; toggleBtn.style.setProperty('display','flex','important'); chrome.storage.local.set({ymWidgetClosed:Date.now()}); };
      wrap.querySelector('#drm-ym-refresh').onclick = () => { wrap.remove(); toggleBtn.remove(); setTimeout(tryInit,300); };
      wrap.querySelector('#drm-ym-theme').onclick   = () => { theme=theme==='dark'?'light':'dark'; chrome.storage.local.set({drmTheme:theme}); render(); };
      wrap.querySelector('#drm-ym-fby').onclick     = () => { fby=true; render(); };
      wrap.querySelector('#drm-ym-fbs').onclick     = () => { fby=false; render(); };
      ['uz','ru','en'].forEach(k => { wrap.querySelector(`#drm-ym-lang-${k}`)?.addEventListener('click',()=>{ langKey=k; chrome.storage.local.set({drmLang:k}); render(); }); });
      ['#drm-ym-cost','#drm-ym-pack','#drm-ym-comm','#drm-ym-ad','#drm-ym-vol'].forEach(id => { wrap.querySelector(id)?.addEventListener('input',liveRecalc); });

      wrap.querySelector('#drm-ym-ue-btn')?.addEventListener('click', async () => {
        const vals=gi(); const eco2=calcYm(price,{...vals,fby});
        await chrome.storage.local.set({ueSettings:{...vals,fby}});
        const params=new URLSearchParams({
          source:'yandex_market', title:title||'', url:location.href,
          price:String(price||''), commPct:String(eco2.commPct||''),
          commission:String(eco2.commission||''), delivery:String(eco2.delivery||''),
          acquiring:String(eco2.acquiring||''), adSpend:String(eco2.adSpend||''),
          tax:String(eco2.tax||''), packaging:String(eco2.packaging||''),
          profit:String(eco2.netProfit??''), margin:String(eco2.margin??''), roi:String(eco2.roi??''),
        });
        window.open(`https://daromadchi.uz/dashboard/unit-economics?${params}`,'_blank');
      });
      wrap.querySelector('#drm-ym-market')?.addEventListener('click',()=>{ window.open(`https://daromadchi.uz/dashboard/market?q=${encodeURIComponent(title||'')}&source=yandex_market`,'_blank'); });
    }
  }

  async function tryInit() {
    if (document.getElementById('drm-ym-ue')) return;
    const {ymWidgetClosed}=await chrome.storage.local.get('ymWidgetClosed');
    if (Date.now()-(ymWidgetClosed||0)<1800000) return;
    buildYmWidget();
  }

  let lastUrl=location.href, initTimer=null;
  function scheduleInit(delay=2500) { clearTimeout(initTimer); initTimer=setTimeout(tryInit,delay); }

  new MutationObserver(()=>{
    if(location.href!==lastUrl){ lastUrl=location.href; document.getElementById('drm-ym-ue')?.remove(); document.getElementById('drm-ym-toggle')?.remove(); scheduleInit(); }
  }).observe(document,{subtree:true,childList:true});

  if (document.readyState==='loading') { document.addEventListener('DOMContentLoaded',()=>scheduleInit()); }
  else { scheduleInit(); }
})();

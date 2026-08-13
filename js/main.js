(function () {
  'use strict';

  var PRODUCTS = {
    bottle: { name: 'LANDSCAPE S', desc: 'Спортна бутилка 400 ml', group: 'Бутилки', currency: 'EUR', unit: '€', icon: 'pg-bottle', prices: { 50: 3.49, 100: 3.05, 250: 2.66, 500: 2.52, 1000: 2.32 } },
    meyer: { name: 'MEYER тефтер', desc: 'Тефтер', group: 'Тефтери', currency: 'EUR', unit: '€', icon: 'pg-notebook-meyer', prices: { 50: 2.29, 100: 1.95, 250: 1.67, 500: 1.51, 1000: 1.37 } },
    hemingway: { name: 'HEMINGWAY A5', desc: 'Тефтер A5, твърда корица', group: 'Тефтери', currency: 'EUR', unit: '€', icon: 'pg-notebook-hemingway', prices: { 50: 3.15, 100: 2.63, 250: 2.33, 500: 2.15, 1000: 2.01 } },
    notebookPen: { name: 'Тефтер + химикал', desc: 'Комплект тефтер с химикал', group: 'Тефтери', currency: null, unit: '', icon: 'pg-notebook-pen', prices: {} },
    cup: { name: 'Брандирана чаша', desc: 'Цената зависи от модела и количеството', group: 'Чаши', currency: 'BGN', unit: 'лв.', icon: 'pg-cup', prices: { 50: 15.10, 100: 13.20, 500: 10.10, 1000: 9.40 } },
    bag: { name: 'Брандирана торба', desc: 'Торба с печат', group: 'Торби', currency: null, unit: '', icon: 'pg-bag', prices: {} },
    backpack: { name: 'Брандирана раница', desc: 'Раница / бизнес чанта', group: 'Раници', currency: 'BGN', unit: 'лв.', icon: 'pg-backpack', prices: { 50: 42.90 } },
    giftSet: { name: 'Подаръчен комплект', desc: 'Корпоративен подаръчен комплект', group: 'Подаръчен комплект', currency: null, unit: '', icon: 'pg-gift', prices: {} }
  };

  var QUANTITIES = [50, 100, 250, 500, 1000];
  var VAT = 0.2;
  var LEAD_ENDPOINT = (window.__PG_CONFIG__ && window.__PG_CONFIG__.leadEndpoint) || '/api/leads';
  var REQUEST_TIMEOUT = 15000;

  var nf = new Intl.NumberFormat('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function fmt(n) {
    return nf.format(n);
  }

  function money(n, productKey) {
    return fmt(n) + ' ' + PRODUCTS[productKey].unit;
  }

  var state = { product: 'bottle', qty: 50 };

  try {
    var saved = window.localStorage.getItem('pg-landing-state');
    if (saved) {
      var s = JSON.parse(saved);
      if (PRODUCTS[s.product]) state.product = s.product;
      if (QUANTITIES.indexOf(s.qty) !== -1) state.qty = s.qty;
    }
  } catch (e) { /* ignore */ }

  function persist() {
    try { window.localStorage.setItem('pg-landing-state', JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function getUtms() {
    var key = 'pg-lead-utm';
    var data = null;
    try { data = JSON.parse(window.localStorage.getItem(key) || 'null'); } catch (e) { /* ignore */ }
    if (!data || !data.captured) {
      data = data || {};
      var p = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
        var v = p.get(k);
        if (v) data[k] = v;
      });
      data.captured = true;
      if (!data.first_visit) data.first_visit = new Date().toISOString();
      try { window.localStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* ignore */ }
    }
    return data;
  }

  function buildEstimate(productKey, qty) {
    var p = PRODUCTS[productKey];
    var q = parseInt(String(qty).replace('+', ''), 10) || 0;
    var price = p && p.prices[q] !== undefined ? p.prices[q] : null;
    if (price === null || q < 1) {
      return { unit: null, ex: null, inc: null };
    }
    var ex = price * q;
    var inc = ex * (1 + VAT);
    return { unit: price, ex: ex, inc: inc };
  }

  window.__track = function (name, data) {
    var payload = { event: name };
    if (data) { for (var k in data) { payload[k] = data[k]; } }
    (window.__trackEvents = window.__trackEvents || []).push(payload);
    if (typeof window.dataLayer !== 'undefined') { window.dataLayer.push(payload); }
  };

  var calcProductsEl = document.getElementById('calc-products');
  var calcQtyEl = document.getElementById('calc-qty');
  var calcLadderEl = document.getElementById('calc-ladder');
  var calcResultEl = document.getElementById('calc-result');

  function renderProducts() {
    calcProductsEl.innerHTML = Object.keys(PRODUCTS).map(function (key) {
      var p = PRODUCTS[key];
      var has = Object.keys(p.prices).length > 0;
      var min = has ? Math.min.apply(null, Object.values(p.prices)) : null;
      var sel = state.product === key ? ' is-selected' : '';
      var soft = has ? '' : ' is-unavailable';
      var priceLabel = has ? 'от ' + fmt(min) + ' ' + p.unit : 'Индивидуална оферта';
      return '<button type="button" class="chip' + sel + soft + '" data-product="' + key + '" aria-pressed="' + (state.product === key) + '">' +
        '<svg class="chip-icon" viewBox="0 0 400 300" aria-hidden="true"><use href="#' + p.icon + '"/></svg>' +
        '<span>' + p.name + '<br><small>' + priceLabel + '</small></span>' +
        '</button>';
    }).join('');
    calcProductsEl.querySelectorAll('[data-product]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.product = btn.dataset.product;
        state.qty = 50;
        persist();
        renderAll();
        __track('product_select', { product: state.product });
        __track('calculator_interaction', { type: 'product', product: state.product });
      });
    });
  }

  function renderQuantity() {
    var p = PRODUCTS[state.product];
    calcQtyEl.innerHTML = QUANTITIES.map(function (q) {
      var has = p.prices[q] !== undefined;
      var sel = state.qty === q ? ' is-selected' : '';
      var soft = has ? '' : ' is-soft';
      return '<button type="button" class="qty-btn' + sel + soft + '" data-qty="' + q + '" aria-pressed="' + (state.qty === q) + '">' + q + '</button>';
    }).join('');
    calcQtyEl.querySelectorAll('[data-qty]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.qty = parseInt(btn.dataset.qty, 10);
        persist();
        renderAll();
        __track('qty_select', { product: state.product, qty: state.qty });
        __track('calculator_interaction', { type: 'qty', product: state.product, qty: state.qty });
      });
    });
  }

  function renderLadder() {
    var p = PRODUCTS[state.product];
    var values = QUANTITIES.map(function (q) { return p.prices[q]; }).filter(function (v) { return v !== undefined; });
    var max = values.length ? Math.max.apply(null, values) : 1;
    var maxH = 128;
    var bars = QUANTITIES.map(function (q) {
      var price = p.prices[q];
      var has = price !== undefined;
      var h = has ? Math.round(price / max * maxH) : 10;
      var sel = state.qty === q ? ' is-selected' : '';
      var off = has ? '' : ' is-offer';
      var save = '';
      if (has && state.qty === q && q > 50 && p.prices[50] !== undefined) {
        save = ' <span class="ladder-save">−' + fmt(p.prices[50] - price) + ' ' + p.unit + '/бр.</span>';
      }
      var label = has ? 'Количество ' + q + ' броя, цена ' + fmt(price) + ' ' + p.unit : 'Количество ' + q + ' броя, индивидуална оферта';
      return '<button type="button" class="ladder-col' + sel + off + '" data-qty="' + q + '" aria-label="' + label + '">' +
        '<span class="ladder-price">' + (has ? fmt(price) + ' ' + p.unit : 'оферта') + '</span>' +
        '<span class="ladder-fill" style="height:' + h + 'px"></span>' +
        '<span class="ladder-qty">' + q + '</span>' + save +
        '</button>';
    }).join('');
    calcLadderEl.innerHTML = '<p class="ladder-title">Как цената на брой намалява с количеството</p>' +
      '<div class="ladder-bars">' + bars + '</div>';
    calcLadderEl.querySelectorAll('[data-qty]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.qty = parseInt(btn.dataset.qty, 10);
        persist();
        renderAll();
        __track('qty_select', { product: state.product, qty: state.qty });
        __track('calculator_interaction', { type: 'qty', product: state.product, qty: state.qty });
      });
    });
  }

  function renderResult() {
    var p = PRODUCTS[state.product];
    var price = p.prices[state.qty];

    if (price === undefined) {
      calcResultEl.innerHTML =
        '<div class="calc-offer">' +
        '<h4>Индивидуална оферта</h4>' +
        '<p>За ' + p.name + ' при ' + state.qty + ' броя няма публикувана цена. Изпратете заявка и ще получите персонална оферта.</p>' +
        '<button type="button" class="btn btn-gold" id="calcOfferBtn" data-track="cta_calc_offer">Получавам оферта</button>' +
        '</div>';
      document.getElementById('calcOfferBtn').addEventListener('click', function () {
        prefillAndGo(state.product, state.qty);
        __track('cta_calc_offer', { product: state.product, qty: state.qty });
        __track('calculator_cta_click', { product: state.product, qty: state.qty });
      });
      return;
    }

    var total = price * state.qty;
    var vat = total * VAT;
    var withVat = total + vat;
    var base = p.prices[50];
    var save = base !== undefined && base > price ? (base - price) * state.qty : 0;

    calcResultEl.innerHTML =
      '<div class="calc-result__head">' +
      '<div class="calc-result__product">' + p.name + '</div>' +
      '<div class="calc-result__qty">' + state.qty + ' бр.</div>' +
      '</div>' +
      '<div class="calc-row"><span>Цена за брой</span><strong>' + money(price, state.product) + '</strong></div>' +
      '<div class="calc-row"><span>Общо без ДДС</span><strong>' + money(total, state.product) + '</strong></div>' +
      '<div class="calc-row"><span>ДДС (20%)</span><strong>' + money(vat, state.product) + '</strong></div>' +
      '<div class="calc-row is-total"><span>Общо с ДДС</span><strong>' + money(withVat, state.product) + '</strong></div>' +
      (save > 0 ? '<div class="calc-save-row">По-ниска цена при по-голям тираж: спестявате <strong>' + money(save, state.product) + '</strong> спрямо 50 броя.</div>' : '') +
      '<div class="calc-cta"><button type="button" class="btn btn-gold" id="calcCtaBtn" data-track="cta_calc_offer">Искам тази оферта</button></div>';

    document.getElementById('calcCtaBtn').addEventListener('click', function () {
      prefillAndGo(state.product, state.qty);
      __track('cta_calc_offer', { product: state.product, qty: state.qty });
      __track('calculator_cta_click', { product: state.product, qty: state.qty });
    });
  }

  function renderAll() {
    renderProducts();
    renderQuantity();
    renderLadder();
    renderResult();
    syncPriceTables();
    updateSticky();
  }

  function syncPriceTables() {
    document.querySelectorAll('.price-table').forEach(function (table) {
      var card = table.closest('.product-card');
      var isCurrent = card && card.dataset.product === state.product;
      table.querySelectorAll('.price-table__row').forEach(function (row) {
        var on = isCurrent && parseInt(row.dataset.qty, 10) === state.qty;
        row.classList.toggle('is-selected', on);
      });
    });
  }

  document.querySelectorAll('.price-table__row').forEach(function (row) {
    row.addEventListener('click', function () {
      var card = row.closest('.product-card');
      if (!card) return;
      state.product = card.dataset.product;
      state.qty = parseInt(row.dataset.qty, 10);
      persist();
      renderAll();
      __track('qty_select', { product: state.product, qty: state.qty });
      __track('product_select', { product: state.product });
      __track('calculator_interaction', { type: 'product', product: state.product });
    });
  });

  document.querySelectorAll('[data-calc]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.product-card');
      var row = card ? card.querySelector('.price-table__row.is-selected') : null;
      var sel = card ? card.querySelector('.qty-select') : null;
      var qty = row ? parseInt(row.dataset.qty, 10) : (sel ? parseInt(sel.value, 10) : 50);
      state.product = btn.dataset.calc;
      state.qty = qty;
      persist();
      renderAll();
      __track('cta_product_prices', { product: state.product, qty: state.qty });
      document.getElementById('calculator').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.querySelectorAll('[data-offer]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.product-card');
      var sel = card ? card.querySelector('.qty-select') : null;
      var qty = sel ? parseInt(sel.value, 10) : 50;
      prefillAndGo(btn.dataset.offer, qty);
      __track('cta_product_offer', { product: btn.dataset.offer, qty: qty });
    });
  });

  document.querySelectorAll('.qty-select').forEach(function (sel) {
    sel.addEventListener('change', function () {
      __track('qty_select', { product: sel.dataset.qty, qty: parseInt(sel.value, 10) });
    });
  });

  document.querySelectorAll('.product-card').forEach(function (card) {
    card.addEventListener('click', function (e) {
      if (e.target.closest('button') || e.target.closest('select')) return;
      var calcBtn = card.querySelector('[data-calc]');
      if (calcBtn) { calcBtn.click(); return; }
      var offerBtn = card.querySelector('[data-offer]');
      if (offerBtn) { offerBtn.click(); }
    });
  });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-track]');
    if (el && el.dataset.track) {
      __track(el.dataset.track, { product: state.product, qty: state.qty });
      if (el.closest('.hero')) {
        __track('hero_cta_click', { cta: el.dataset.track });
      }
    }
  });

  function estimateBudget(productKey, qty) {
    var p = PRODUCTS[productKey];
    var price = p.prices[qty];
    if (price === undefined || p.currency !== 'EUR') return null;
    var total = price * qty;
    var ranges = [['до 500 €', 500], ['500–1000 €', 1000], ['1000–2500 €', 2500], ['2500–5000 €', 5000]];
    for (var i = 0; i < ranges.length; i++) {
      if (total <= ranges[i][1]) return ranges[i][0];
    }
    return '5000+ €';
  }

  function prefillAndGo(productKey, qty) {
    var p = PRODUCTS[productKey];
    var prodSel = document.getElementById('fProduct');
    if (prodSel) prodSel.value = productKey;
    var qtySel = document.getElementById('fQuantity');
    if (qtySel) qtySel.value = qty === 1000 ? '1000' : String(qty);
    var budgetChecked = document.querySelector('input[name="budget"]:checked');
    if (!budgetChecked) {
      var est = estimateBudget(productKey, qty);
      if (est) {
        var radio = document.querySelector('input[name="budget"][value="' + est + '"]');
        if (radio) radio.checked = true;
      }
    }
    ['fName', 'fCompany', 'fPhone', 'fEmail', 'fProduct', 'fQuantity', 'fDeadline'].forEach(function (id) {
      setError('err-' + id, '');
    });
    setError('err-fPurpose', '');
    document.getElementById('form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  var sticky = document.getElementById('stickyCta');
  var stickyInfo = document.getElementById('stickyInfo');
  var formSection = document.getElementById('form');

  function updateSticky() {
    var p = PRODUCTS[state.product];
    var price = p.prices[state.qty];
    var pricePart = price !== undefined ? ' · ' + fmt(price) + ' ' + p.unit + '/бр.' : ' · индивидуална оферта';
    stickyInfo.innerHTML = p.name + ' · ' + state.qty + ' бр.' + pricePart;
  }

  function onScroll() {
    if (window.innerWidth >= 1024) { sticky.hidden = true; return; }
    var rect = formSection.getBoundingClientRect();
    var nearForm = rect.top < window.innerHeight * 0.75 && rect.bottom > 0;
    var scrolled = window.scrollY > window.innerHeight * 0.6;
    sticky.hidden = !(scrolled && !nearForm);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  var ARIA_FIELDS = ['fName', 'fCompany', 'fPhone', 'fEmail', 'fProduct', 'fQuantity', 'fDeadline', 'fLogo'];

  function setError(id, msg) {
    var el = document.getElementById(id);
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.classList.add('is-visible');
    } else {
      el.textContent = '';
      el.classList.remove('is-visible');
    }
    var fieldId = id.replace('err-', '');
    if (ARIA_FIELDS.indexOf(fieldId) !== -1) {
      var field = document.getElementById(fieldId);
      if (field && field.setAttribute) field.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
  }

  var allowedExt = ['png', 'jpg', 'jpeg', 'pdf', 'svg'];

  function validate() {
    var firstFocus = null;
    var invalidFields = [];

    var name = document.getElementById('fName').value.trim();
    if (name.length < 2) { setError('err-fName', 'Моля, въведете име.'); firstFocus = firstFocus || 'fName'; invalidFields.push('name'); }
    else { setError('err-fName', ''); }

    var company = document.getElementById('fCompany').value.trim();
    if (company.length < 2) { setError('err-fCompany', 'Моля, въведете фирма.'); firstFocus = firstFocus || 'fCompany'; invalidFields.push('company'); }
    else { setError('err-fCompany', ''); }

    var phone = document.getElementById('fPhone').value.trim();
    if (!/^[+0-9 ()\-]{7,20}$/.test(phone)) { setError('err-fPhone', 'Моля, въведете телефон.'); firstFocus = firstFocus || 'fPhone'; invalidFields.push('phone'); }
    else { setError('err-fPhone', ''); }

    var email = document.getElementById('fEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setError('err-fEmail', 'Моля, въведете валиден email адрес.'); firstFocus = firstFocus || 'fEmail'; invalidFields.push('email'); }
    else { setError('err-fEmail', ''); }

    var product = document.getElementById('fProduct').value;
    if (!product) { setError('err-fProduct', 'Моля, изберете продукт.'); firstFocus = firstFocus || 'fProduct'; invalidFields.push('product'); }
    else { setError('err-fProduct', ''); }

    var quantity = document.getElementById('fQuantity').value;
    var qtyNum = parseInt(String(quantity).replace('+', ''), 10) || 0;
    if (!quantity) { setError('err-fQuantity', 'Моля, изберете количество.'); firstFocus = firstFocus || 'fQuantity'; invalidFields.push('quantity'); }
    else if (qtyNum < 50) { setError('err-fQuantity', 'Минималното количество е 50 броя.'); firstFocus = firstFocus || 'fQuantity'; invalidFields.push('quantity'); }
    else { setError('err-fQuantity', ''); }

    var purpose = document.querySelector('input[name="purpose"]:checked');
    if (!purpose) { setError('err-fPurpose', 'Изберете поне една опция.'); firstFocus = firstFocus || 'fPurpose'; invalidFields.push('purpose'); }
    else { setError('err-fPurpose', ''); }

    var deadline = document.getElementById('fDeadline').value;
    if (!deadline) { setError('err-fDeadline', 'Изберете краен срок.'); firstFocus = firstFocus || 'fDeadline'; invalidFields.push('deadline'); }
    else { setError('err-fDeadline', ''); }

    var file = document.getElementById('fLogo').files[0];
    if (file) {
      var ext = file.name.split('.').pop().toLowerCase();
      if (allowedExt.indexOf(ext) === -1 || file.size > 10 * 1024 * 1024) {
        setError('err-fLogo', 'Невалиден формат или размер. Приемаме PNG, JPG, PDF, SVG до 10 MB.');
        firstFocus = firstFocus || 'fLogo';
        invalidFields.push('logo');
      } else {
        setError('err-fLogo', '');
      }
    } else {
      setError('err-fLogo', '');
    }

    if (firstFocus) {
      __track('form_error', { fields: invalidFields });
      var target = document.getElementById(firstFocus);
      if (target && target.focus) target.focus({ preventScroll: true });
      if (firstFocus === 'fPurpose') {
        document.getElementById('fPurpose').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    return !firstFocus;
  }

  function showGlobalError(msg) {
    var el = document.getElementById('formGlobalError');
    if (!el) {
      el = document.createElement('p');
      el.id = 'formGlobalError';
      el.className = 'form-error is-visible';
      document.getElementById('leadForm').appendChild(el);
    }
    el.textContent = msg;
  }

  var form = document.getElementById('leadForm');

  ARIA_FIELDS.forEach(function (id) {
    var el = document.getElementById(id);
    if (el && el.setAttribute) el.setAttribute('aria-describedby', 'err-' + id);
  });

  form.addEventListener('focusin', function () {
    __track('form_start', {});
  }, { once: true });

  form.addEventListener('input', function (e) {
    if (e.target && e.target.id) setError('err-' + e.target.id, '');
  });
  form.addEventListener('change', function (e) {
    if (e.target && e.target.id) setError('err-' + e.target.id, '');
  });

  form.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      if (cb.name === 'purpose' && form.querySelector('input[name="purpose"]:checked')) setError('err-fPurpose', '');
    });
  });

  var logoInput = document.getElementById('fLogo');
  var logoHint = document.getElementById('fLogoHint');
  var logoRemove = document.getElementById('fLogoRemove');

  function resetLogoUi() {
    logoInput.value = '';
    logoHint.textContent = 'Качете логото, за да подготвим визуализация. Максимален размер 10 MB.';
    logoRemove.hidden = true;
    setError('err-fLogo', '');
  }

  logoRemove.addEventListener('click', resetLogoUi);

  logoInput.addEventListener('change', function () {
    var f = logoInput.files[0];
    if (!f) { resetLogoUi(); return; }
    __track('logo_upload', { filename: f.name, size: f.size });
    logoHint.textContent = 'Файл: ' + f.name + ' (' + Math.round(f.size / 1024) + ' KB)';
    logoRemove.hidden = false;
  });

  var honeypotInput = document.getElementById('fHoneypot');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var globalErr = document.getElementById('formGlobalError');
    if (globalErr) { globalErr.textContent = ''; globalErr.classList.remove('is-visible'); }

    if (honeypotInput && honeypotInput.value.trim()) {
      __track('form_spam_blocked', {});
      return;
    }

    if (!validate()) return;

    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Изпращане…';

    var product = document.getElementById('fProduct').value;
    var quantity = document.getElementById('fQuantity').value;
    var budget = (document.querySelector('input[name="budget"]:checked') || {}).value || '';
    var utms = getUtms();
    var estimate = buildEstimate(product, quantity);

    var payload = {
      product: product,
      quantity: quantity,
      budget: budget,
      deadline: document.getElementById('fDeadline').value,
      purpose: Array.prototype.map.call(form.querySelectorAll('input[name="purpose"]:checked'), function (i) { return i.value; }),
      priority: Array.prototype.map.call(form.querySelectorAll('input[name="priority"]:checked'), function (i) { return i.value; }),
      estimated_unit_price: estimate.unit,
      estimated_total_ex_vat: estimate.ex,
      estimated_total_inc_vat: estimate.inc
    };
    __track('form_submit_attempt', payload);

    var done = function () {
      form.hidden = true;
      var success = document.getElementById('formSuccess');
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      __track('form_submit_success', {});
    };

    var fail = function (reason) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Получавам персонална оферта';
      showGlobalError('Възникна проблем при изпращането на запитването. Моля, опитайте отново или се свържете с нас по телефона.');
      __track('form_submit_error', { reason: reason || 'error' });
    };

    var fd = new FormData(form);

    function appendIfValued(key, value) {
      if (value !== undefined && value !== null && value !== '') fd.append(key, String(value));
    }

    appendIfValued('estimated_unit_price', estimate.unit);
    appendIfValued('estimated_total_ex_vat', estimate.ex);
    appendIfValued('estimated_total_inc_vat', estimate.inc);
    appendIfValued('source', 'printground-landing');
    appendIfValued('campaign', utms.utm_campaign || '');
    appendIfValued('utm_source', utms.utm_source || '');
    appendIfValued('utm_medium', utms.utm_medium || '');
    appendIfValued('utm_campaign', utms.utm_campaign || '');
    appendIfValued('utm_content', utms.utm_content || '');
    appendIfValued('utm_term', utms.utm_term || '');
    appendIfValued('landing_page_url', window.location.href.split('?')[0]);
    appendIfValued('referrer', document.referrer);
    appendIfValued('timestamp', new Date().toISOString());

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT) : null;
    var opts = { method: 'POST', body: fd };
    if (controller) opts.signal = controller.signal;

    fetch(LEAD_ENDPOINT, opts)
      .then(function (res) {
        if (timer) window.clearTimeout(timer);
        if (!res.ok) throw new Error('bad status ' + res.status);
        return res.json().catch(function () { return {}; });
      })
      .then(function () { done(); })
      .catch(function (err) {
        if (timer) window.clearTimeout(timer);
        var reason = err && err.name === 'AbortError' ? 'timeout' : (err && err.message) || 'network';
        fail(reason);
      });
  });

  var successReset = document.getElementById('formSuccessReset');
  if (successReset) {
    successReset.addEventListener('click', function () {
      form.reset();
      resetLogoUi();
      ['fName', 'fCompany', 'fPhone', 'fEmail', 'fProduct', 'fQuantity', 'fDeadline', 'fLogo'].forEach(function (id) {
        setError('err-' + id, '');
      });
      setError('err-fPurpose', '');
      var globalErr = document.getElementById('formGlobalError');
      if (globalErr) { globalErr.textContent = ''; globalErr.classList.remove('is-visible'); }
      document.getElementById('formSuccess').hidden = true;
      form.hidden = false;
      document.getElementById('form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  renderAll();
  updateSticky();
  onScroll();
})();

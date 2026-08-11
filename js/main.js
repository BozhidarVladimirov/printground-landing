(function () {
  'use strict';

  var PRODUCTS = {
    bottle: { name: 'LANDSCAPE S', desc: 'Спортна бутилка 400 ml', group: 'Бутилки', currency: 'EUR', unit: '€', icon: 'pg-bottle', prices: { 50: 3.49, 100: 3.05, 250: 2.66, 500: 2.52, 1000: 2.32 } },
    meyer: { name: 'MEYER тефтер', desc: 'Тефтер', group: 'Тефтери', currency: 'EUR', unit: '€', icon: 'pg-notebook-meyer', prices: { 50: 2.29, 100: 1.95, 250: 1.67, 500: 1.51, 1000: 1.37 } },
    hemingway: { name: 'HEMINGWAY A5', desc: 'Тефтер A5, твърда корица', group: 'Тефтери', currency: 'EUR', unit: '€', icon: 'pg-notebook-hemingway', prices: { 50: 3.15, 100: 2.63, 250: 2.33, 500: 2.15, 1000: 2.01 } },
    notebookPen: { name: 'Тефтер + химикал', desc: 'Комплект тефтер с химикал', group: 'Тефтери', currency: null, unit: '', icon: 'pg-notebook-pen', prices: {} },
    cup: { name: 'Брандирана чаша', desc: 'Чаша с лого', group: 'Чаши', currency: 'BGN', unit: 'лв.', icon: 'pg-cup', prices: { 50: 15.10, 100: 13.20, 500: 10.10, 1000: 9.40 } },
    bag: { name: 'Брандирана торба', desc: 'Торба с печат', group: 'Торби', currency: null, unit: '', icon: 'pg-bag', prices: {} },
    backpack: { name: 'Брандирана раница', desc: 'Раница / бизнес чанта', group: 'Раници', currency: 'BGN', unit: 'лв.', icon: 'pg-backpack', prices: { 50: 42.90 } },
    giftSet: { name: 'Подаръчен комплект', desc: 'Корпоративен подаръчен комплект', group: 'Подаръчен комплект', currency: null, unit: '', icon: 'pg-gift', prices: {} }
  };

  var QUANTITIES = [50, 100, 250, 500, 1000];
  var VAT = 0.2;
  var FORM_ENDPOINT = '';

  var nf = new Intl.NumberFormat('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function fmt(n) {
    return nf.format(n);
  }

  function money(n, productKey) {
    return fmt(n) + ' ' + PRODUCTS[productKey].unit;
  }

  var state = { product: 'bottle', qty: 50 };

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
        renderAll();
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
        renderAll();
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
    calcLadderEl.innerHTML = '<p class="ladder-title">Цената на брой намалява с количеството</p>' +
      '<div class="ladder-bars">' + bars + '</div>';
    calcLadderEl.querySelectorAll('[data-qty]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.qty = parseInt(btn.dataset.qty, 10);
        renderAll();
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
        '<button type="button" class="btn btn-gold" id="calcOfferBtn">Получавам оферта</button>' +
        '</div>';
      document.getElementById('calcOfferBtn').addEventListener('click', function () {
        prefillAndGo(state.product, state.qty);
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
      '<div class="calc-row"><span>Обща цена без ДДС</span><strong>' + money(total, state.product) + '</strong></div>' +
      '<div class="calc-row"><span>ДДС (20%)</span><strong>' + money(vat, state.product) + '</strong></div>' +
      '<div class="calc-row is-total"><span>Цена с ДДС</span><strong>' + money(withVat, state.product) + '</strong></div>' +
      (save > 0 ? '<div class="calc-save-row">Спестявате <strong>' + money(save, state.product) + '</strong> спрямо минималния тираж от 50 броя.</div>' : '') +
      '<div class="calc-cta"><button type="button" class="btn btn-gold" id="calcCtaBtn">Получавам оферта</button></div>';

    document.getElementById('calcCtaBtn').addEventListener('click', function () {
      prefillAndGo(state.product, state.qty);
    });
  }

  function renderAll() {
    renderProducts();
    renderQuantity();
    renderLadder();
    renderResult();
    updateSticky();
  }

  document.querySelectorAll('[data-calc]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.product = btn.dataset.calc;
      state.qty = 50;
      renderAll();
      document.getElementById('calculator').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.querySelectorAll('[data-offer]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      prefillAndGo(btn.dataset.offer, 50);
    });
  });

  document.querySelectorAll('.product-card').forEach(function (card) {
    card.addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      var calcBtn = card.querySelector('[data-calc]');
      if (calcBtn) { calcBtn.click(); return; }
      var offerBtn = card.querySelector('[data-offer]');
      if (offerBtn) { offerBtn.click(); }
    });
  });

  function prefillAndGo(productKey, qty) {
    var p = PRODUCTS[productKey];
    document.querySelectorAll('input[name="interest"]').forEach(function (cb) {
      cb.checked = cb.value === p.group;
    });
    var qtySel = document.getElementById('fQuantity');
    qtySel.value = qty === 1000 ? '1000' : String(qty);
    ['fName', 'fCompany', 'fPhone', 'fEmail', 'fQuantity'].forEach(function (id) {
      setError('err-' + id, '');
    });
    setError('err-fInterests', '');
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
    var scrolled = window.scrollY > window.innerHeight * 0.7;
    sticky.hidden = !(scrolled && !nearForm);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  var ARIA_FIELDS = ['fName', 'fCompany', 'fPhone', 'fEmail', 'fQuantity', 'fLogo'];

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
      document.getElementById(fieldId).setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
  }

  var allowedExt = ['png', 'jpg', 'jpeg', 'svg', 'ai', 'pdf'];

  function validate() {
    var firstFocus = null;
    var name = document.getElementById('fName').value.trim();
    if (name.length < 2) { setError('err-fName', 'Моля, въведете име.'); firstFocus = firstFocus || 'fName'; }
    else { setError('err-fName', ''); }

    var company = document.getElementById('fCompany').value.trim();
    if (company.length < 2) { setError('err-fCompany', 'Моля, въведете фирма.'); firstFocus = firstFocus || 'fCompany'; }
    else { setError('err-fCompany', ''); }

    var phone = document.getElementById('fPhone').value.trim();
    if (!/^[+0-9 ()\-]{7,20}$/.test(phone)) { setError('err-fPhone', 'Моля, въведете валиден телефон.'); firstFocus = firstFocus || 'fPhone'; }
    else { setError('err-fPhone', ''); }

    var email = document.getElementById('fEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setError('err-fEmail', 'Моля, въведете валиден email.'); firstFocus = firstFocus || 'fEmail'; }
    else { setError('err-fEmail', ''); }

    var interest = document.querySelector('input[name="interest"]:checked');
    if (!interest) { setError('err-fInterests', 'Изберете поне една категория.'); firstFocus = firstFocus || 'fInterests'; }
    else { setError('err-fInterests', ''); }

    var quantity = document.getElementById('fQuantity').value;
    if (!quantity) { setError('err-fQuantity', 'Изберете количество.'); firstFocus = firstFocus || 'fQuantity'; }
    else { setError('err-fQuantity', ''); }

    var purpose = document.querySelector('input[name="purpose"]:checked');
    if (!purpose) { setError('err-fPurpose', 'Изберете поне една опция.'); firstFocus = firstFocus || 'fPurpose'; }
    else { setError('err-fPurpose', ''); }

    var file = document.getElementById('fLogo').files[0];
    if (file) {
      var ext = file.name.split('.').pop().toLowerCase();
      if (allowedExt.indexOf(ext) === -1 || file.size > 10 * 1024 * 1024) {
        setError('err-fLogo', 'Невалиден формат или размер. Приемаме PNG, JPG, SVG, AI, PDF до 10 MB.');
        firstFocus = firstFocus || 'fLogo';
      } else {
        setError('err-fLogo', '');
      }
    } else {
      setError('err-fLogo', '');
    }

    if (firstFocus) {
      var target = document.getElementById(firstFocus);
      if (target) target.focus({ preventScroll: true });
      if (firstFocus === 'fInterests') {
        document.getElementById('fInterests').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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

  form.addEventListener('input', function (e) {
    if (e.target && e.target.id) setError('err-' + e.target.id, '');
  });
  form.addEventListener('change', function (e) {
    if (e.target && e.target.id) setError('err-' + e.target.id, '');
  });

  form.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var groupErr = cb.name === 'interest' ? 'err-fInterests' : 'err-fPurpose';
      if (form.querySelector('input[name="' + cb.name + '"]:checked')) setError(groupErr, '');
    });
  });

  var logoInput = document.getElementById('fLogo');
  var logoHint = document.getElementById('fLogoHint');
  logoInput.addEventListener('change', function () {
    var f = logoInput.files[0];
    if (!f) {
      logoHint.textContent = 'Качете логото, за да подготвим визуализация. Максимален размер 10 MB.';
      setError('err-fLogo', '');
      return;
    }
    logoHint.textContent = f.name;
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var globalErr = document.getElementById('formGlobalError');
    if (globalErr) { globalErr.textContent = ''; globalErr.classList.remove('is-visible'); }
    if (!validate()) return;
    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Изпращане…';

    var done = function () {
      form.hidden = true;
      document.getElementById('formSuccess').hidden = false;
      document.getElementById('formSuccess').scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    var fail = function () {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Получавам персонална оферта';
      showGlobalError('Възникна грешка при изпращането. Моля, опитайте отново.');
    };

    if (FORM_ENDPOINT) {
      fetch(FORM_ENDPOINT, { method: 'POST', body: new FormData(form) })
        .then(function (res) {
          if (!res.ok) throw new Error('bad status');
          done();
        })
        .catch(fail);
    } else {
      window.setTimeout(done, 300);
    }
  });

  renderAll();
  updateSticky();
  onScroll();
})();

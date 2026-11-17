// ============================================================
// العقود — ملء نماذج العقود تلقائياً من بيانات البيعة
// النماذج ملفات Word فيها علامات {{...}} ومحفوظة في تخزين Supabase الخاص (مش في المستودع العام)
// لأن فيها أرقام قومية وبيانات شخصية للبائع. بتترفع مرة واحدة كملف zip من شاشة العقد.
// ============================================================
const CONTRACT_TEMPLATES = [
  { id: 'mahkama-installment-half',  group: 'mahkama', type: 'installment', label: 'المحكمة (الموظفين 6 س) — تقسيط — نصف تشطيب' },
  { id: 'mahkama-installment-brick', group: 'mahkama', type: 'installment', label: 'المحكمة (الموظفين 6 س) — تقسيط — على الطوب' },
  { id: 'mahkama-paid-half',         group: 'mahkama', type: 'paid',        label: 'المحكمة (الموظفين 6 س) — خالص الثمن — نصف تشطيب' },
  { id: 'mahkama-paid-brick',        group: 'mahkama', type: 'paid',        label: 'المحكمة (الموظفين 6 س) — خالص الثمن — على الطوب' },
  { id: 'hegaz-installment-half',    group: 'hegaz',   type: 'installment', label: 'الحجاز (ق/5) — تقسيط — نصف تشطيب' },
  { id: 'hegaz-paid-half',           group: 'hegaz',   type: 'paid',        label: 'الحجاز (ق/5) — خالص الثمن — نصف تشطيب' }
];
const JSZIP_URL = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const DOCX_PREVIEW_URL = 'https://cdn.jsdelivr.net/npm/docx-preview@0.4.1/dist/docx-preview.min.js';
const CONTRACT_BLANK = '............';
const CONTRACT_BLANK_LONG = '..............................';
const CONTRACT_BLANK_DATE = '...... / ...... / ..........';

let contractInst = [];       // أقساط العقد الظاهرة في الشاشة (قابلة للتعديل قبل الطباعة)
let contractSaleId = null;
let contractSaleIsInst = false;  // نوع سداد البيعة — يُستخدم لو لسه ما اتختارش نموذج
let contractBundle = null;   // ملف النماذج (JSZip) بعد تحميله من التخزين الخاص
const CONTRACT_BUNDLE_PATH = 'contract-templates/templates.zip';

// ── تفقيط: تحويل المبلغ إلى حروف ─────────────────────────
function tafqeet(num) {
  let n = Math.round(Number(num) || 0);
  if (n === 0) return 'صفر';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
    'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const scales = [null,
    { one: 'ألف', two: 'ألفان', few: 'آلاف', many: 'ألف' },
    { one: 'مليون', two: 'مليونان', few: 'ملايين', many: 'مليون' },
    { one: 'مليار', two: 'ملياران', few: 'مليارات', many: 'مليار' }];
  const below1000 = (x) => {
    const parts = [];
    const h = Math.floor(x / 100), r = x % 100;
    if (h) parts.push(hundreds[h]);
    if (r) {
      if (r < 20) parts.push(ones[r]);
      else { const o = r % 10, t = Math.floor(r / 10); parts.push(o ? `${ones[o]} و${tens[t]}` : tens[t]); }
    }
    return parts.join(' و');
  };
  const groups = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const out = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    if (i === 0) { out.push(below1000(g)); continue; }
    const s = scales[i];
    if (g === 1) out.push(s.one);
    else if (g === 2) out.push(s.two);
    else if (g % 100 === 1) out.push(`${below1000(g - 1)} و${s.one}`);        // مائة وألف
    else if (g % 100 === 2) out.push(`${below1000(g - 2)} و${s.two}`);        // مائة وألفان
    else if (g % 100 >= 3 && g % 100 <= 10) out.push(`${below1000(g)} ${s.few}`);
    else out.push(`${below1000(g)} ${s.many}`.replace(/^مائتان (?=\S+$)/, 'مائتا '));  // مائتا ألف
  }
  // الكلمة بعد المبلغ دايماً "جنيه" — المثنى يتكتب مضاف: ألفا جنيه، مائتا جنيه
  return out.join(' و').replace(/(ألف|مليون|مليار|مائت)ان$/, '$1ا');
}

// ── أدوات مساعدة ─────────────────────────────────────────
function contractMoney(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }
function contractDate(d) {
  if (!d) return '';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  return `${parseInt(day)} / ${parseInt(m)} / ${y}`;
}
function contractDayName(d) {
  if (!d) return '';
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  return ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][new Date(y, m - 1, day).getDay()];
}
function contractFloorWord(f) {
  const w = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
  return w[parseInt(f)] || '';
}
function contractXmlEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function contractHtmlEsc(s) { return contractXmlEsc(s ?? '').replace(/"/g, '&quot;'); }

function loadScriptOnce(url, isLoaded) {
  if (isLoaded()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url; s.onload = resolve; s.onerror = () => reject(new Error('load failed: ' + url));
    document.head.appendChild(s);
  });
}

// ── تجهيز بيانات العقد من الشاشة ─────────────────────────
function buildContractValues(d) {
  const female = d.buyerTitle === 'السيدة';
  const rooms = { 1: 'غرفة', 2: 'غرفتين', 3: 'ثلاث غرف', 4: 'أربع غرف', 5: 'خمس غرف' }[d.rooms] || '';
  const price = Number(d.price) || 0, paid = Number(d.paid) || 0;
  const money = (n) => n > 0 ? contractMoney(n) : '';
  const words = (n) => n > 0 ? tafqeet(n) : '';
  return {
    day: contractDayName(d.date), date: contractDate(d.date),
    buyer_title: female ? 'السيدة' : 'السيد',
    buyer_nat: d.buyerNationality || (female ? 'مصرية' : 'مصري'),
    buyer_res: female ? 'المقيمة' : 'المقيم',
    buyer_name: d.buyerName, buyer_address: d.buyerAddress, buyer_id: d.buyerId,
    unit_no: d.unitNo, floor: d.floor, facade: d.facade, area: d.area, rooms,
    price: money(price), price_words: words(price),
    paid: money(paid), paid_words: words(paid),
    rem: money(price - paid), rem_words: words(price - paid),
    delivery_date: contractDate(d.deliveryDate)
  };
}

// يملأ document.xml: العلامات {{...}} + تكرار سطر القسط بعدد الأقساط. الخانة الفاضية ترجع نقط زي النموذج
function fillContractXml(xml, d) {
  const v = buildContractValues(d);
  const blankFor = (k) => /date$/.test(k) ? CONTRACT_BLANK_DATE : /(_words|_name|_address|_id)$/.test(k) ? CONTRACT_BLANK_LONG : k === 'rooms' ? `${CONTRACT_BLANK} غرف` : CONTRACT_BLANK;
  const put = (text, vals) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (!(k in vals)) return m;
    const val = vals[k] === undefined || vals[k] === null ? '' : String(vals[k]).trim();
    return contractXmlEsc(val || blankFor(k));
  });
  const instRe = /<w:p[ >](?:(?!<\/w:p>)[\s\S])*?\{\{inst_amount\}\}(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/;
  xml = xml.replace(instRe, (para) => {
    const rows = (d.installments || []).filter(r => Number(r.amount) > 0 || r.dueDate);
    const list = rows.length ? rows : [{ amount: 0, dueDate: '' }];
    return list.map(r => put(para, {
      inst_amount: Number(r.amount) > 0 ? contractMoney(r.amount) : '',
      inst_words: Number(r.amount) > 0 ? tafqeet(r.amount) : '',
      inst_date: contractDate(r.dueDate)
    })).join('');
  });
  return put(xml, v);
}

// تحميل ملف النماذج من التخزين الخاص (مرة واحدة لكل فتحة للموقع)
async function loadContractBundle() {
  if (contractBundle) return contractBundle;
  await loadScriptOnce(JSZIP_URL, () => !!window.JSZip);
  const { data, error } = await DB.supabase.storage.from(DB.BUCKET).download(CONTRACT_BUNDLE_PATH);
  if (error || !data) return null;
  contractBundle = await window.JSZip.loadAsync(await data.arrayBuffer());
  return contractBundle;
}

function contractBundleMissing(zip) {
  return CONTRACT_TEMPLATES.filter(t => !zip.file(`${t.id}.docx`)).map(t => t.label);
}

async function uploadContractBundle(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  showLoading();
  try {
    await loadScriptOnce(JSZIP_URL, () => !!window.JSZip);
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const missing = contractBundleMissing(zip);
    if (missing.length === CONTRACT_TEMPLATES.length) { showToast('الملف ده مش ملف نماذج العقود', 'warning', 6000); hideLoading(); return; }
    const { error } = await DB.supabase.storage.from(DB.BUCKET).upload(CONTRACT_BUNDLE_PATH, file, { upsert: true, contentType: 'application/zip', cacheControl: '0' });
    if (error) { console.error('Bundle upload error:', error); showToast('تعذر رفع ملف النماذج: ' + (error.message || ''), 'error', 8000); hideLoading(); return; }
    contractBundle = zip;
    showToast(missing.length ? `تم الرفع — نماذج ناقصة: ${missing.join('، ')}` : 'تم رفع نماذج العقود');
    renderContractBundleStatus();
  } catch (e) {
    console.error(e);
    showToast('تعذر قراءة الملف — لازم يكون ملف zip', 'error');
  }
  hideLoading();
}

function renderContractBundleStatus(state) {
  const el = document.getElementById('contract-bundle-status');
  if (!el) return;
  const ready = !!contractBundle;
  updateContractButtons();
  const picker = `<input type="file" id="contract-bundle-input" accept=".zip,application/zip" style="display:none" onchange="uploadContractBundle(this)">`;
  if (state === 'loading') { el.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem">جاري تحميل نماذج العقود…</div>'; return; }
  el.innerHTML = ready
    ? `${picker}<div style="font-size:.8rem;color:var(--text-muted)">نماذج العقود جاهزة — <a href="#" onclick="document.getElementById('contract-bundle-input').click();return false">تحديث ملف النماذج</a></div>`
    : `${picker}<div class="gen-box" style="margin-bottom:1rem"><div style="font-weight:700;margin-bottom:.4rem">📂 نماذج العقود لسه ما اترفعتش</div><div style="font-size:.85rem;margin-bottom:.6rem">ارفع ملف <strong>contract-templates.zip</strong> مرة واحدة — بيتحفظ في التخزين الخاص للموقع.</div><button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('contract-bundle-input').click()">⬆️ رفع ملف النماذج</button></div>`;
}

async function buildContractDocx(templateId, d) {
  const bundle = await loadContractBundle();
  const entry = bundle?.file(`${templateId}.docx`);
  if (!entry) throw new Error('template not found');
  const zip = await window.JSZip.loadAsync(await entry.async('arraybuffer'));
  const xml = await zip.file('word/document.xml').async('string');
  zip.file('word/document.xml', fillContractXml(xml, d));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
}

// ── شاشة العقد ───────────────────────────────────────────
function ensureContractModal() {
  if (document.getElementById('contract-modal')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="contract-modal" class="modal">
      <div class="modal-box" style="max-width:760px">
        <div class="modal-hd"><div class="modal-title">📝 عقد البيع</div><button class="modal-close" onclick="closeModal('contract-modal')">×</button></div>
        <form id="contract-form" onsubmit="return false" oninput="updateContractSummary()">
          <div id="contract-bundle-status"></div>
          <div class="form-group" style="margin-bottom:1rem"><label class="form-label">نموذج العقد *</label>
            <select class="form-control" name="templateId" onchange="onContractTemplateChange()">
              <option value="">— اختار نموذج العقد —</option>
              ${CONTRACT_TEMPLATES.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}
            </select>
            <div id="contract-template-hint" style="display:none;margin-top:.4rem;color:var(--danger);font-weight:700;font-size:.85rem">⚠️ المشروع ده له أكثر من نموذج — اختار التشطيب المتفق عليه (على الطوب ولا نصف تشطيب)</div>
          </div>
          <div class="ledger-title" style="margin:0 0 .6rem">👤 المشتري</div>
          <div class="form-grid">
            <div class="form-group"><label class="form-label">اللقب</label><select class="form-control" name="buyerTitle"><option>السيد</option><option>السيدة</option></select></div>
            <div class="form-group"><label class="form-label">الاسم بالكامل</label><input type="text" class="form-control" name="buyerName"></div>
            <div class="form-group"><label class="form-label">الرقم القومي</label><input type="text" class="form-control" name="buyerId" inputmode="numeric" maxlength="14"></div>
            <div class="form-group"><label class="form-label">الجنسية</label><input type="text" class="form-control" name="buyerNationality" placeholder="مصري"></div>
            <div class="form-group" style="grid-column:1/-1"><label class="form-label">العنوان</label><input type="text" class="form-control" name="buyerAddress"></div>
          </div>
          <div class="ledger-title" style="margin:1rem 0 .6rem">🏠 الشقة</div>
          <div class="form-grid">
            <div class="form-group"><label class="form-label">رقم الشقة</label><input type="text" class="form-control" name="unitNo"></div>
            <div class="form-group"><label class="form-label">الدور (علوي)</label><input type="text" class="form-control" name="floor" list="contract-floors" placeholder="مثال: الثاني"><datalist id="contract-floors">${[1,2,3,4,5,6,7,8,9,10].map(f => `<option value="${contractFloorWord(f)}">`).join('')}</datalist></div>
            <div class="form-group"><label class="form-label">الواجهة</label><input type="text" class="form-control" name="facade" placeholder="مثال: البحرية"></div>
            <div class="form-group"><label class="form-label">المساحة (م²)</label><input type="text" class="form-control" name="area" inputmode="decimal"></div>
            <div class="form-group"><label class="form-label">عدد الغرف</label><select class="form-control" name="rooms"><option value="">—</option><option value="1">غرفة وصالة</option><option value="2">غرفتين وصالة</option><option value="3">ثلاث غرف وصالة</option><option value="4">أربع غرف وصالة</option><option value="5">خمس غرف وصالة</option></select></div>
          </div>
          <div class="ledger-title" style="margin:1rem 0 .6rem">📅 التواريخ والثمن</div>
          <div class="form-grid">
            <div class="form-group"><label class="form-label">تاريخ العقد</label><input type="date" class="form-control" name="date"></div>
            <div class="form-group"><label class="form-label">موعد التسليم</label><input type="date" class="form-control" name="deliveryDate"></div>
            <div class="form-group"><label class="form-label">إجمالي الثمن</label><input type="number" class="form-control" name="price" min="0" inputmode="decimal"></div>
            <div class="form-group" id="contract-paid-group"><label class="form-label">المدفوع (المقدم)</label><input type="number" class="form-control" name="paid" min="0" inputmode="decimal"></div>
          </div>
          <div id="contract-inst-box" class="gen-box" style="margin-top:1rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">
              <div class="ledger-title" style="margin:0">الأقساط في العقد</div>
              <button type="button" class="btn btn-ghost btn-sm" onclick="addContractInst()">➕ قسط</button>
            </div>
            <div id="contract-inst-rows"></div>
          </div>
          <div id="contract-summary" style="margin-top:1rem;font-size:.88rem"></div>
          <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1.2rem">
            <button type="button" class="btn btn-primary contract-go" style="flex:1" onclick="downloadContractWord()">📄 تحميل Word</button>
            <button type="button" class="btn btn-gold contract-go" style="flex:1" onclick="printContract()">🖨️ طباعة / PDF</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(wrap);
}

function contractExtrasKey(saleId) { return `contract-extras:${saleId}`; }
function loadContractExtras(saleId) {
  try { return JSON.parse(localStorage.getItem(contractExtrasKey(saleId)) || '{}') || {}; } catch (e) { return {}; }
}
function saveContractExtras() {
  const f = document.getElementById('contract-form');
  if (!f || !contractSaleId) return;
  const keep = {};
  ['templateId', 'buyerTitle', 'buyerId', 'buyerNationality', 'buyerAddress', 'floor', 'facade', 'area', 'rooms', 'deliveryDate'].forEach(k => { keep[k] = f[k].value; });
  try { localStorage.setItem(contractExtrasKey(contractSaleId), JSON.stringify(keep)); } catch (e) { /* التخزين المحلي غير متاح — نكمل عادي */ }
}

function openContractModal(saleId) {
  const sale = sales.find(s => s.id === saleId);
  if (!sale) return;
  ensureContractModal();
  contractSaleId = saleId;
  const f = document.getElementById('contract-form');
  f.reset();
  const project = projects.find(p => p.id === sale.projectId);
  const unit = units.find(u => u.saleId === sale.id);
  const ex = loadContractExtras(saleId);
  const isInst = sale.paymentType === 'installment';

  // اختيار النموذج المناسب تلقائياً من اسم المشروع ونوع السداد
  const pname = project?.projectName || '';
  const group = /حجاز/.test(pname) ? 'hegaz' : /محكم|موظف/.test(pname) ? 'mahkama' : null;
  // لو المشروع له أكتر من نموذج (على الطوب / نصف تشطيب) ما نختارش بالتخمين — لازم يتحدد
  const guesses = CONTRACT_TEMPLATES.filter(t => (!group || t.group === group) && t.type === (isInst ? 'installment' : 'paid'));
  contractSaleIsInst = isInst;
  f.templateId.value = ex.templateId || (guesses.length === 1 ? guesses[0].id : '');

  f.buyerTitle.value = ex.buyerTitle || 'السيد';
  f.buyerName.value = sale.customerName || '';
  f.buyerId.value = ex.buyerId || '';
  f.buyerNationality.value = ex.buyerNationality || '';
  f.buyerAddress.value = ex.buyerAddress || '';
  f.unitNo.value = unit?.unitNumber || sale.unitNumber || '';
  f.floor.value = ex.floor || (unit ? contractFloorWord(unit.floor) : '');
  f.facade.value = ex.facade || unit?.direction || '';
  f.area.value = ex.area || (unit?.area ? String(unit.area) : '');
  f.rooms.value = ex.rooms || '';
  f.date.value = sale.saleDate ? String(sale.saleDate).slice(0, 10) : todayStr();
  f.deliveryDate.value = ex.deliveryDate || '';
  f.price.value = sale.totalPrice || '';
  f.paid.value = isInst ? (sale.downPayment || '') : '';

  contractInst = isInst
    ? (sale.payments || []).filter(p => p.label !== 'مقدم').map(p => ({
        amount: parseFloat(p.totalAmount ?? p.amount) || 0,
        dueDate: p.dueDate ? String(p.dueDate).slice(0, 10) : ''
      }))
    : [];
  onContractTemplateChange();
  document.getElementById('contract-modal').classList.add('active');
  renderContractBundleStatus(contractBundle ? '' : 'loading');
  if (!contractBundle) loadContractBundle().catch(e => console.error(e)).then(() => renderContractBundleStatus());
}

function contractTemplate() {
  const id = document.getElementById('contract-form').templateId.value;
  return CONTRACT_TEMPLATES.find(t => t.id === id) || null;
}
function contractIsInst() {
  const t = contractTemplate();
  return t ? t.type === 'installment' : contractSaleIsInst;
}
function updateContractButtons() {
  const ok = !!contractBundle && !!contractTemplate();
  document.querySelectorAll('#contract-form .contract-go').forEach(b => { b.disabled = !ok; });
  const hint = document.getElementById('contract-template-hint');
  if (hint) hint.style.display = contractTemplate() ? 'none' : '';
}

function onContractTemplateChange() {
  const isInst = contractIsInst();
  updateContractButtons();
  document.getElementById('contract-inst-box').style.display = isInst ? '' : 'none';
  document.getElementById('contract-paid-group').style.display = isInst ? '' : 'none';
  renderContractInst();
}

function renderContractInst() {
  const box = document.getElementById('contract-inst-rows');
  if (!box) return;
  box.innerHTML = contractInst.length ? contractInst.map((r, i) => `
    <div style="display:flex;gap:.4rem;align-items:center;margin-bottom:.4rem">
      <span style="min-width:1.6rem;color:var(--text-muted);font-size:.82rem">${i + 1}</span>
      <input type="number" class="form-control" style="flex:1 1 0;min-width:0;padding-inline:.5rem" min="0" inputmode="decimal" placeholder="المبلغ" value="${r.amount || ''}" oninput="contractInst[${i}].amount=parseFloat(this.value)||0">
      <input type="date" class="form-control" style="flex:1.2 1 0;min-width:0;padding-inline:.4rem" value="${contractHtmlEsc(r.dueDate)}" oninput="contractInst[${i}].dueDate=this.value">
      <button type="button" class="btn btn-danger btn-xs" onclick="contractInst.splice(${i},1);renderContractInst()">×</button>
    </div>`).join('') : '<div style="color:var(--text-muted);font-size:.85rem">لا توجد أقساط — اضغط «➕ قسط» أو سيُترك سطر فارغ في العقد</div>';
  updateContractSummary();
}

function addContractInst() {
  const last = contractInst[contractInst.length - 1];
  contractInst.push({ amount: last?.amount || 0, dueDate: last?.dueDate ? addMonthsStr(last.dueDate, 1) : '' });
  renderContractInst();
}

function updateContractSummary() {
  const f = document.getElementById('contract-form');
  const el = document.getElementById('contract-summary');
  if (!f || !el) return;
  const price = parseFloat(f.price.value) || 0;
  let html = price > 0 ? `<div>الثمن بالحروف: <strong>${tafqeet(price)} جنيه</strong></div>` : '';
  if (contractIsInst()) {
    const paid = parseFloat(f.paid.value) || 0;
    const instTotal = contractInst.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const diff = price - paid - instTotal;
    html += `<div>المتبقي بعد المقدم: <strong>${contractMoney(price - paid)}</strong> — مجموع الأقساط: <strong>${contractMoney(instTotal)}</strong></div>`;
    if (contractInst.length && Math.abs(diff) > 0.5) html += `<div style="color:var(--danger);font-weight:700">⚠️ مجموع الأقساط لا يساوي المتبقي (فرق ${contractMoney(Math.abs(diff))} جنيه)</div>`;
  }
  el.innerHTML = html;
}

function readContractForm() {
  const f = document.getElementById('contract-form');
  const isInst = contractIsInst();
  return {
    date: f.date.value, deliveryDate: f.deliveryDate.value,
    buyerTitle: f.buyerTitle.value, buyerName: f.buyerName.value, buyerId: f.buyerId.value,
    buyerNationality: f.buyerNationality.value, buyerAddress: f.buyerAddress.value,
    unitNo: f.unitNo.value, floor: f.floor.value, facade: f.facade.value, area: f.area.value, rooms: f.rooms.value,
    price: parseFloat(f.price.value) || 0,
    paid: isInst ? (parseFloat(f.paid.value) || 0) : 0,
    installments: isInst ? contractInst : []
  };
}

function contractFileName(d) {
  const clean = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, ' ').trim();
  return ['عقد', clean(d.buyerName), d.unitNo ? `شقة ${clean(d.unitNo)}` : ''].filter(Boolean).join(' - ');
}

async function downloadContractWord() {
  if (!contractTemplate()) { showToast('اختار نموذج العقد الأول', 'warning'); return; }
  const d = readContractForm();
  saveContractExtras();
  showLoading();
  try {
    const blob = await buildContractDocx(contractTemplate().id, d);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = contractFileName(d) + '.docx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    showToast('تم تجهيز العقد');
  } catch (e) {
    console.error(e);
    showToast('تعذر تجهيز العقد — تأكد من الاتصال ومن وجود هذا النموذج في ملف النماذج', 'error', 6000);
  }
  hideLoading();
}

const CONTRACT_PRINT_CSS = `
  @page { size: A4; margin: 8.5mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .contract-frame { position: fixed; inset: 0; border: 4.5pt double #000; pointer-events: none; }
  /* النموذج الأصلي مقاس Letter — تصغير بسيط عشان السطور تقع زي Word على ورق A4 */
  .contract-body { padding: 0 6.5mm; zoom: .955; }
  /* صف فاضي فوق وتحت بيتكرر في كل صفحة عشان الكلام ما يلمسش البرواز */
  .contract-table { width: 100%; border-collapse: collapse; }
  .contract-table td { padding: 0; }
  .contract-table .pad td { height: 7mm; }
  .contract-body section.docx { width: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; background: transparent !important; }
  .contract-body p { orphans: 2; widows: 2; }
  .contract-hint { font-family: sans-serif; text-align: center; padding: 10px; background: #fdf3dc; color: #7a5c0a; }
  @media print { .contract-hint { display: none; } }
`;

async function printContract() {
  if (!contractTemplate()) { showToast('اختار نموذج العقد الأول', 'warning'); return; }
  const d = readContractForm();
  saveContractExtras();
  // لازم النافذة تتفتح فوراً مع الضغطة — لو اتأخرت المتصفح بيمنعها
  const win = window.open('', '_blank');
  if (!win) { showToast('المتصفح منع فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة للموقع', 'warning', 6000); return; }
  win.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>جاري تجهيز العقد…</title></head><body><p style="font-family:sans-serif;text-align:center;padding:2rem">جاري تجهيز العقد…</p></body></html>');
  win.document.close();
  showLoading();
  try {
    const blob = await buildContractDocx(contractTemplate().id, d);
    await loadScriptOnce(DOCX_PREVIEW_URL, () => !!window.docx);
    const body = document.createElement('div'), styles = document.createElement('div');
    await window.docx.renderAsync(blob, body, styles, { inWrapper: false, breakPages: false, ignoreWidth: true, ignoreHeight: true, ignoreLastRenderedPageBreak: true, renderHeaders: false, renderFooters: false });
    win.document.open();
    win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${contractHtmlEsc(contractFileName(d))}</title>${styles.innerHTML}<style>${CONTRACT_PRINT_CSS}</style></head><body><div class="contract-hint">لو نافذة الطباعة ما ظهرتش: اختار «طباعة» من قائمة المتصفح</div><div class="contract-frame"></div><div class="contract-body"><table class="contract-table"><thead><tr class="pad"><td></td></tr></thead><tfoot><tr class="pad"><td></td></tr></tfoot><tbody><tr><td>${body.innerHTML}</td></tr></tbody></table></div></body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  } catch (e) {
    console.error(e);
    win.close();
    showToast('تعذر تجهيز العقد للطباعة — جرّب «تحميل Word»', 'error');
  }
  hideLoading();
}

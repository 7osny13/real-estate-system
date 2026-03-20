// ============================================================
// DATABASE LAYER - Supabase
// ============================================================
const DB = {
  supabase: null,

  init() {
    this.supabase = window.supabaseClient;
    if (!this.supabase) {
      console.error('Supabase client not initialized!');
      showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
    }
  },

  // ── Projects ──────────────────────────────────────────────
  async getProjects() {
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return data.map(mapProject);
  },

  async getProject(id) {
    const { data, error } = await this.supabase
      .from('projects').select('*').eq('id', id).single();
    if (error) { console.error(error); return null; }
    return mapProject(data);
  },

  async addProject(project) {
    const row = {
      id: crypto.randomUUID(),
      project_name: project.projectName,
      location: project.location || '',
      status: project.status,
      apartments_count: project.apartmentsCount || 0,
      shops_count: project.shopsCount || 0
    };
    const { data, error } = await this.supabase.from('projects').insert([row]).select();
    if (error) { console.error(error); showToast('خطأ في إضافة المشروع', 'error'); return null; }
    return mapProject(data[0]);
  },

  async updateProject(id, updates) {
    const row = {
      project_name: updates.projectName,
      location: updates.location || '',
      status: updates.status,
      apartments_count: updates.apartmentsCount || 0,
      shops_count: updates.shopsCount || 0,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await this.supabase.from('projects').update(row).eq('id', id).select();
    if (error) { console.error(error); showToast('خطأ في تحديث المشروع', 'error'); return null; }
    return data[0];
  },

  async deleteProject(id) {
    const { error } = await this.supabase.from('projects').delete().eq('id', id);
    if (error) { console.error(error); showToast('خطأ في حذف المشروع', 'error'); return false; }
    return true;
  },

  // ── Expenses ──────────────────────────────────────────────
  async getProjectExpenses(projectId) {
    const { data, error } = await this.supabase
      .from('expenses').select('*').eq('project_id', projectId)
      .order('date', { ascending: false });
    if (error) { console.error(error); return []; }
    return data.map(mapExpense);
  },

  async addExpense(expense) {
    const row = {
      id: crypto.randomUUID(),
      project_id: expense.projectId,
      date: expense.date,
      category: expense.category,
      custom_category: expense.customCategory || '',
      amount: expense.amount,
      recipient: expense.recipient || '',
      notes: expense.notes || ''
    };
    const { data, error } = await this.supabase.from('expenses').insert([row]).select();
    if (error) { console.error(error); showToast('خطأ في إضافة المصروف', 'error'); return null; }
    return mapExpense(data[0]);
  },

  async updateExpense(id, updates) {
    const row = {
      date: updates.date,
      category: updates.category,
      custom_category: updates.customCategory || '',
      amount: updates.amount,
      recipient: updates.recipient || '',
      notes: updates.notes || '',
      updated_at: new Date().toISOString()
    };
    const { data, error } = await this.supabase.from('expenses').update(row).eq('id', id).select();
    if (error) { console.error(error); showToast('خطأ في تحديث المصروف', 'error'); return null; }
    return data[0];
  },

  async deleteExpense(id) {
    const { error } = await this.supabase.from('expenses').delete().eq('id', id);
    if (error) { console.error(error); showToast('خطأ في حذف المصروف', 'error'); return false; }
    return true;
  },

  // ── Sales ─────────────────────────────────────────────────
  async getSales() {
    const { data, error } = await this.supabase
      .from('sales').select('*').order('sale_date', { ascending: false });
    if (error) { console.error(error); return []; }
    return data.map(mapSale);
  },

  async getProjectSales(projectId) {
    const { data, error } = await this.supabase
      .from('sales').select('*').eq('project_id', projectId)
      .order('sale_date', { ascending: false });
    if (error) { console.error(error); return []; }
    return data.map(mapSale);
  },

  async addSale(sale) {
    const row = {
      id: crypto.randomUUID(),
      project_id: sale.projectId,
      unit_type: sale.unitType,
      unit_number: sale.unitNumber || '',
      sale_date: sale.saleDate,
      customer_name: sale.customerName,
      customer_phone: sale.customerPhone || '',
      total_price: sale.totalPrice,
      payment_type: sale.paymentType,
      down_payment: sale.downPayment || 0,
      installments_count: sale.installments ? sale.installments.length : 0,
      notes: sale.notes || '',
      // NEW: store flexible installments array
      payments: sale.paymentType === 'cash'
        ? [{ id: crypto.randomUUID(), label: 'كاش', totalAmount: sale.totalPrice, paidAmount: sale.totalPrice, dueDate: sale.saleDate, status: 'paid', partialPayments: [{ amount: sale.totalPrice, date: sale.saleDate, note: 'دفع كامل' }] }]
        : buildInstallmentsArray(sale)
    };
    const { data, error } = await this.supabase.from('sales').insert([row]).select();
    if (error) { console.error(error); showToast('خطأ في إضافة عملية البيع', 'error'); return null; }
    return mapSale(data[0]);
  },

  async updateSale(id, updates) {
    const row = {
      unit_type: updates.unitType,
      unit_number: updates.unitNumber || '',
      sale_date: updates.saleDate,
      customer_name: updates.customerName,
      customer_phone: updates.customerPhone || '',
      total_price: updates.totalPrice,
      notes: updates.notes || '',
      updated_at: new Date().toISOString()
    };
    const { data, error } = await this.supabase.from('sales').update(row).eq('id', id).select();
    if (error) { console.error(error); showToast('خطأ في تحديث عملية البيع', 'error'); return null; }
    return data[0];
  },

  async deleteSale(id) {
    const { error } = await this.supabase.from('sales').delete().eq('id', id);
    if (error) { console.error(error); showToast('خطأ في حذف عملية البيع', 'error'); return false; }
    return true;
  },

  // ── NEW: Add partial payment to an installment ────────────
  async addPartialPayment(saleId, installmentIndex, partialPayment) {
    // 1. Fetch current payments array
    const { data: saleData, error: fetchErr } = await this.supabase
      .from('sales').select('payments').eq('id', saleId).single();
    if (fetchErr) { console.error(fetchErr); return false; }

    const payments = JSON.parse(JSON.stringify(saleData.payments || []));
    const inst = payments[installmentIndex];
    if (!inst) return false;

    // 2. Add partial payment record
    inst.partialPayments = inst.partialPayments || [];
    inst.partialPayments.push({
      id: crypto.randomUUID(),
      amount: partialPayment.amount,
      date: partialPayment.date,
      note: partialPayment.note || ''
    });

    // 3. Recalculate totals
    inst.paidAmount = inst.partialPayments.reduce((s, p) => s + parseFloat(p.amount), 0);
    inst.remainingAmount = parseFloat(inst.totalAmount) - inst.paidAmount;

    // 4. Update status
    if (inst.remainingAmount <= 0) {
      inst.status = 'paid';
      inst.remainingAmount = 0;
    } else if (inst.paidAmount > 0) {
      inst.status = 'partial';
    }

    // 5. Save back
    const { error: updateErr } = await this.supabase
      .from('sales')
      .update({ payments, updated_at: new Date().toISOString() })
      .eq('id', saleId);
    if (updateErr) { console.error(updateErr); return false; }
    return true;
  },

  // ── NEW: Delete a partial payment ────────────────────────
  async deletePartialPayment(saleId, installmentIndex, partialPaymentId) {
    const { data: saleData, error: fetchErr } = await this.supabase
      .from('sales').select('payments').eq('id', saleId).single();
    if (fetchErr) return false;

    const payments = JSON.parse(JSON.stringify(saleData.payments || []));
    const inst = payments[installmentIndex];
    if (!inst) return false;

    inst.partialPayments = (inst.partialPayments || []).filter(p => p.id !== partialPaymentId);
    inst.paidAmount = inst.partialPayments.reduce((s, p) => s + parseFloat(p.amount), 0);
    inst.remainingAmount = parseFloat(inst.totalAmount) - inst.paidAmount;

    if (inst.paidAmount <= 0) { inst.status = 'pending'; inst.paidAmount = 0; }
    else if (inst.remainingAmount <= 0) { inst.status = 'paid'; inst.remainingAmount = 0; }
    else { inst.status = 'partial'; }

    const { error } = await this.supabase
      .from('sales').update({ payments, updated_at: new Date().toISOString() }).eq('id', saleId);
    return !error;
  },

  // ── NEW: Update installment due date ──────────────────────
  async updateInstallmentDate(saleId, installmentIndex, newDate) {
    const { data: saleData, error: fetchErr } = await this.supabase
      .from('sales').select('payments').eq('id', saleId).single();
    if (fetchErr) return false;

    const payments = JSON.parse(JSON.stringify(saleData.payments || []));
    if (payments[installmentIndex]) {
      payments[installmentIndex].dueDate = newDate;
    }

    const { error } = await this.supabase
      .from('sales').update({ payments, updated_at: new Date().toISOString() }).eq('id', saleId);
    return !error;
  },

  // ══════════════════════════════════════════════════════════
  // STORAGE — رفع وإدارة الملفات
  // ══════════════════════════════════════════════════════════
  BUCKET: 'real-estate-files',

  // رفع ملف — يرجع public URL أو null
  async uploadFile(file, folder) {
    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'pdf'];
    if (!allowed.includes(ext)) {
      showToast('نوع الملف غير مدعوم. الأنواع المسموحة: JPG, PNG, PDF', 'warning');
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('حجم الملف أكبر من 10MB', 'warning');
      return null;
    }

    const fileName = `${folder}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { data, error } = await this.supabase.storage
      .from(this.BUCKET)
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) { console.error('Upload error:', error); showToast('خطأ في رفع الملف', 'error'); return null; }

    const { data: urlData } = this.supabase.storage.from(this.BUCKET).getPublicUrl(data.path);
    return { path: data.path, url: urlData.publicUrl, name: file.name, type: ext };
  },

  // حذف ملف من Storage
  async deleteFile(filePath) {
    const { error } = await this.supabase.storage.from(this.BUCKET).remove([filePath]);
    if (error) { console.error('Delete error:', error); return false; }
    return true;
  },

  // ── رفع صورة/PDF للعقد (على مستوى عملية البيع) ──────────
  async addSaleFile(saleId, fileInfo) {
    const { data: saleData, error: fetchErr } = await this.supabase
      .from('sales').select('files').eq('id', saleId).single();
    if (fetchErr) { console.error('addSaleFile fetch error:', fetchErr); return false; }

    const files = Array.isArray(saleData?.files) ? [...saleData.files] : [];
    files.push({ ...fileInfo, uploadedAt: new Date().toISOString() });

    const { error } = await this.supabase
      .from('sales').update({ files, updated_at: new Date().toISOString() }).eq('id', saleId);
    if (error) { console.error('addSaleFile update error:', error); return false; }
    return true;
  },

  async deleteSaleFile(saleId, filePath) {
    const { data: saleData } = await this.supabase
      .from('sales').select('files').eq('id', saleId).single();
    const files = (saleData?.files || []).filter(f => f.path !== filePath);
    await this.supabase.from('sales').update({ files, updated_at: new Date().toISOString() }).eq('id', saleId);
    await this.deleteFile(filePath);
  },

  // ── رفع إيصال على قسط معين ───────────────────────────────
  async addInstallmentFile(saleId, installmentIndex, fileInfo) {
    const { data: saleData, error: fetchErr } = await this.supabase
      .from('sales').select('payments').eq('id', saleId).single();
    if (fetchErr) return false;

    const payments = JSON.parse(JSON.stringify(saleData.payments || []));
    const inst = payments[installmentIndex];
    if (!inst) return false;

    inst.files = inst.files || [];
    inst.files.push({ ...fileInfo, uploadedAt: new Date().toISOString() });

    const { error } = await this.supabase
      .from('sales').update({ payments, updated_at: new Date().toISOString() }).eq('id', saleId);
    if (error) { console.error(error); return false; }
    return true;
  },

  async deleteInstallmentFile(saleId, installmentIndex, filePath) {
    const { data: saleData } = await this.supabase
      .from('sales').select('payments').eq('id', saleId).single();
    const payments = JSON.parse(JSON.stringify(saleData.payments || []));
    const inst = payments[installmentIndex];
    if (inst) {
      inst.files = (inst.files || []).filter(f => f.path !== filePath);
      await this.supabase.from('sales').update({ payments, updated_at: new Date().toISOString() }).eq('id', saleId);
    }
    await this.deleteFile(filePath);
  }
};

// ============================================================
// DATA MAPPERS
// ============================================================
function mapProject(p) {
  return {
    id: p.id,
    projectName: p.project_name,
    location: p.location,
    status: p.status,
    apartmentsCount: p.apartments_count,
    shopsCount: p.shops_count,
    createdAt: p.created_at
  };
}

function mapExpense(e) {
  return {
    id: e.id,
    projectId: e.project_id,
    date: e.date,
    category: e.category,
    customCategory: e.custom_category,
    amount: parseFloat(e.amount),
    recipient: e.recipient,
    notes: e.notes,
    createdAt: e.created_at
  };
}

function mapSale(s) {
  return {
    id: s.id,
    projectId: s.project_id,
    unitType: s.unit_type,
    unitNumber: s.unit_number,
    saleDate: s.sale_date,
    customerName: s.customer_name,
    customerPhone: s.customer_phone,
    totalPrice: parseFloat(s.total_price),
    paymentType: s.payment_type,
    downPayment: parseFloat(s.down_payment) || 0,
    installmentsCount: s.installments_count || 0,
    notes: s.notes,
    payments: s.payments || [],
    files: Array.isArray(s.files) ? s.files : [],
    createdAt: s.created_at
  };
}

// ============================================================
// INSTALLMENTS BUILDER (NEW FLEXIBLE SYSTEM)
// ============================================================
function buildInstallmentsArray(sale) {
  const payments = [];

  // مقدم (down payment)
  if (sale.downPayment > 0) {
    payments.push({
      id: crypto.randomUUID(),
      label: 'مقدم',
      totalAmount: parseFloat(sale.downPayment),
      paidAmount: parseFloat(sale.downPayment),
      remainingAmount: 0,
      dueDate: sale.saleDate,
      status: 'paid',
      partialPayments: [{ id: crypto.randomUUID(), amount: parseFloat(sale.downPayment), date: sale.saleDate, note: 'مقدم' }]
    });
  }

  // Custom installments defined by user
  if (sale.installments && sale.installments.length > 0) {
    sale.installments.forEach((inst, i) => {
      payments.push({
        id: crypto.randomUUID(),
        label: inst.label || `القسط ${i + 1}`,
        totalAmount: parseFloat(inst.amount),
        paidAmount: 0,
        remainingAmount: parseFloat(inst.amount),
        dueDate: inst.dueDate,
        status: 'pending',
        partialPayments: []
      });
    });
  }

  return payments;
}

// ============================================================
// GLOBAL STATE
// ============================================================
let projects = [];
let sales = [];

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  showLoading();
  DB.init();

  // Default dates
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(el => { if (!el.value) el.value = today; });

  await loadData();

  // Migration: حول البيانات القديمة تلقائياً (مرة واحدة بس)
  await migrateOldPayments();

  hideLoading();

  updateDashboard();
  renderProjects();
  renderSales();
  populateProjectSelects();
  checkOverdueInstallments();
});

async function loadData() {
  try {
    [projects, sales] = await Promise.all([DB.getProjects(), DB.getSales()]);
  } catch (err) {
    console.error(err);
    showToast('خطأ في تحميل البيانات', 'error');
  }
}

// ============================================================
// MIGRATION: تحويل البيانات القديمة للصيغة الجديدة
// تشتغل مرة واحدة بس — تتحقق من كل sale هل payments قديمة أم لا
// ============================================================
function isOldPaymentFormat(payments) {
  if (!payments || payments.length === 0) return false;
  const first = payments[0];
  // الصيغة القديمة: فيها amount و paid مش totalAmount و status
  return (
    first.amount !== undefined &&
    first.paid !== undefined &&
    first.totalAmount === undefined
  );
}

function convertOldPayments(sale) {
  // حول كل payment قديم للصيغة الجديدة
  return (sale.payments || []).map((p, i) => {
    const total = parseFloat(p.amount) || 0;
    const wasPaid = p.paid === true;
    const paidDate = p.paidDate || p.dueDate || sale.saleDate;

    return {
      id: crypto.randomUUID(),
      label: p.type || `القسط ${i + 1}`,
      totalAmount: total,
      paidAmount: wasPaid ? total : 0,
      remainingAmount: wasPaid ? 0 : total,
      dueDate: p.dueDate ? p.dueDate.split('T')[0] : sale.saleDate,
      status: wasPaid ? 'paid' : 'pending',
      partialPayments: wasPaid
        ? [{ id: crypto.randomUUID(), amount: total, date: paidDate.split('T')[0], note: 'مدفوع (بيانات قديمة)' }]
        : []
    };
  });
}

async function migrateOldPayments() {
  // اجلب كل sales مباشرة من Supabase عشان نشوف raw payments
  const { data, error } = await DB.supabase.from('sales').select('id, payments, payment_type, sale_date, down_payment');
  if (error) { console.error('Migration fetch error:', error); return; }

  let migratedCount = 0;

  for (const row of data) {
    if (!isOldPaymentFormat(row.payments)) continue;

    // حول
    const newPayments = convertOldPayments({
      payments: row.payments,
      saleDate: row.sale_date,
      downPayment: row.down_payment,
      paymentType: row.payment_type
    });

    // حفظ في Supabase
    const { error: updateErr } = await DB.supabase
      .from('sales')
      .update({ payments: newPayments, updated_at: new Date().toISOString() })
      .eq('id', row.id);

    if (!updateErr) {
      migratedCount++;
    } else {
      console.error(`Migration failed for sale ${row.id}:`, updateErr);
    }
  }

  if (migratedCount > 0) {
    console.log(`✅ Migration: تم تحويل ${migratedCount} عملية بيع للصيغة الجديدة`);
    showToast(`تم تحديث ${migratedCount} عملية بيع قديمة تلقائياً`, 'info', 5000);
    // أعد تحميل البيانات بعد Migration
    await loadData();
  }
}

// ============================================================
// TOAST NOTIFICATIONS (replaces alert)
// ============================================================
function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position:fixed; top:1.5rem; left:50%; transform:translateX(-50%);
      z-index:9999; display:flex; flex-direction:column; gap:0.5rem;
      pointer-events:none; width:max-content; max-width:90vw;
    `;
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const colors = {
    success: '#1a4d2e',
    error: '#c0392b',
    warning: '#f39c12',
    info: '#2980b9'
  };

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${colors[type]}; color: white;
    padding: 0.875rem 1.5rem; border-radius: 12px;
    font-family: 'Cairo', sans-serif; font-size: 1rem; font-weight: 600;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    display:flex; align-items:center; gap:0.5rem;
    animation: toastIn 0.3s ease-out forwards;
    pointer-events:all;
  `;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;

  // Inject animation if not present
  if (!document.getElementById('toast-style')) {
    const style = document.createElement('style');
    style.id = 'toast-style';
    style.textContent = `
      @keyframes toastIn { from { opacity:0; transform:translateY(-16px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
      @keyframes toastOut { from { opacity:1; transform:scale(1); } to { opacity:0; transform:scale(0.9); } }
    `;
    document.head.appendChild(style);
  }

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================================
// LOADING
// ============================================================
function showLoading() {
  if (document.getElementById('loading-overlay')) return;
  const el = document.createElement('div');
  el.id = 'loading-overlay';
  el.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.75);
    display:flex; align-items:center; justify-content:center;
    z-index:9999; color:white; font-size:1.5rem;
    font-family:'Cairo',sans-serif;
  `;
  el.innerHTML = `<div style="text-align:center"><div style="font-size:3rem;margin-bottom:1rem;animation:spin 1s linear infinite">⏳</div><div>جاري التحميل...</div></div>`;
  if (!document.getElementById('spin-style')) {
    const s = document.createElement('style');
    s.id = 'spin-style';
    s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(s);
  }
  document.body.appendChild(el);
}

function hideLoading() {
  document.getElementById('loading-overlay')?.remove();
}

// ============================================================
// NAVIGATION
// ============================================================
function showView(viewName, triggerEl) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`${viewName}-view`).classList.add('active');
  (triggerEl || event?.target)?.classList.add('active');

  if (viewName === 'dashboard') { updateDashboard(); checkOverdueInstallments(); }
  if (viewName === 'projects') renderProjects();
  if (viewName === 'sales') renderSales();
  if (viewName === 'reports') generateReport();
}

// ============================================================
// DASHBOARD
// ============================================================
let chartProjects = null;
let chartInstallments = null;

async function updateDashboard() {
  document.getElementById('total-projects').textContent = projects.length;

  let totalPaid = 0, totalCosts = 0, totalExpected = 0;
  for (const p of projects) totalCosts += await calculateProjectCosts(p.id);
  totalPaid = sales.reduce((s, sale) => s + getTotalPaid(sale), 0);
  totalExpected = sales.reduce((s, sale) => s + sale.totalPrice, 0);
  const totalRemaining = totalExpected - totalPaid;
  const netProfit = totalPaid - totalCosts;

  const fmt = v => formatCurrency(v);
  document.getElementById('total-revenue').textContent  = fmt(totalPaid);
  document.getElementById('total-costs').textContent    = fmt(totalCosts);
  document.getElementById('net-profit').textContent     = fmt(netProfit);
  document.getElementById('total-expected').textContent = fmt(totalExpected);
  document.getElementById('total-remaining').textContent= fmt(totalRemaining);

  // Active projects grid
  const grid = document.getElementById('active-projects-grid');
  if (grid) {
    const active = projects.filter(p => p.status === 'under_construction');
    grid.innerHTML = active.length === 0
      ? `<div class="empty"><div class="empty-icon">🏗️</div><p>لا توجد مشاريع نشطة</p></div>`
      : active.map(p => renderProjectCard(p)).join('');
  }

  // Charts
  renderCharts(totalPaid, totalCosts);
}

// ============================================================
// OVERDUE INSTALLMENTS CHECK
// ============================================================
function checkOverdueInstallments() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let overdueCount = 0;

  for (const sale of sales) {
    for (const inst of (sale.payments || [])) {
      if (inst.status === 'pending' || inst.status === 'partial') {
        const due = new Date(inst.dueDate);
        due.setHours(0, 0, 0, 0);
        if (due < today) overdueCount++;
      }
    }
  }

  // Show badge on sales tab
  const badge = document.getElementById('overdue-badge');
  if (overdueCount > 0) {
    if (badge) { badge.textContent = overdueCount; badge.style.display = 'inline-flex'; }
  } else {
    if (badge) badge.style.display = 'none';
  }

  // Show alert card on dashboard
  const alertCard = document.getElementById('overdue-alert-card');
  if (alertCard) {
    if (overdueCount > 0) {
      alertCard.style.display = 'block';
      alertCard.querySelector('#overdue-count').textContent = overdueCount;
    } else {
      alertCard.style.display = 'none';
    }
  }
}

// ============================================================
// PROJECTS RENDERING
// ============================================================
function renderProjects() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;
  if (projects.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏗️</div><p class="empty-state-text">لا توجد مشاريع بعد</p></div>`;
    return;
  }
  grid.innerHTML = projects.map(p => renderProjectCard(p)).join('');
}

function renderProjectCard(p) {
  const projectSales = sales.filter(s => s.projectId === p.id);
  const revenue = calculateProjectRevenue(p.id);
  const statusLabel = p.status === 'under_construction' ? '🔨 تحت الإنشاء' : '✅ جاهز';
  const statusClass = p.status === 'under_construction' ? 'status-construction' : 'status-done';

  return `
    <div class="proj-card" onclick="showProjectDetails('${p.id}')">
      <div class="proj-bar"></div>
      <div class="proj-body">
        <div class="proj-name">${p.projectName}</div>
        ${p.location ? `<div class="proj-loc">📍 ${p.location}</div>` : ''}
        <span class="status-pill ${statusClass}">${statusLabel}</span>
        <div class="proj-stats-grid">
          <div class="proj-stat"><div class="proj-stat-val">${p.apartmentsCount}</div><div class="proj-stat-lbl">شقة</div></div>
          <div class="proj-stat"><div class="proj-stat-val">${p.shopsCount}</div><div class="proj-stat-lbl">محل</div></div>
          <div class="proj-stat"><div class="proj-stat-val">${projectSales.length}</div><div class="proj-stat-lbl">مبيعات</div></div>
        </div>
        <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:.75rem">إيرادات: <strong style="color:var(--gold)">${formatCurrency(revenue)} ج.م</strong></div>
        <div class="proj-actions" onclick="event.stopPropagation()">
          <button class="btn btn-gold btn-xs" onclick="openEditProjectModal('${p.id}')">✏️ تعديل</button>
          <button class="btn btn-pdf btn-xs" onclick="exportProjectPDF('${p.id}')">📄 PDF</button>
          <button class="btn btn-danger btn-xs" onclick="deleteProject('${p.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
}

// ============================================================
// SALES RENDERING
// ============================================================
function renderSales() {
  const container = document.getElementById('sales-list');
  if (!container) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (sales.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💰</div><p class="empty-state-text">لا توجد مبيعات بعد</p></div>`;
    return;
  }

  container.innerHTML = sales.map(sale => {
    const project = projects.find(p => p.id === sale.projectId);
    const totalPaid = getTotalPaid(sale);
    const remaining = sale.totalPrice - totalPaid;
    const hasOverdue = (sale.payments || []).some(inst => {
      if (inst.status === 'pending' || inst.status === 'partial') {
        const due = new Date(inst.dueDate); due.setHours(0,0,0,0);
        return due < today;
      }
      return false;
    });

    return `
      <div class="sale-card ${hasOverdue ? 'overdue' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem">
          <div>
            <div class="sale-customer">${sale.customerName}</div>
            <div class="sale-meta">${sale.customerPhone || ''}</div>
            <div style="margin-top:.5rem;display:flex;gap:.4rem;flex-wrap:wrap">
              <span class="badge badge-blue">${project?.projectName || 'غير معروف'}</span>
              <span class="badge badge-green">${sale.unitType === 'apartment' ? '🏠 شقة' : '🏪 محل'} ${sale.unitNumber || ''}</span>
              ${hasOverdue ? '<span class="badge badge-red">⚠️ قسط متأخر</span>' : ''}
            </div>
          </div>
          <div style="text-align:left">
            <div class="sale-price">${formatCurrency(sale.totalPrice)} <small style="font-size:.8rem">ج.م</small></div>
            <div style="font-size:.82rem;color:var(--text-muted)">تاريخ البيع: ${formatDate(sale.saleDate)}</div>
            <div style="font-size:.88rem;font-weight:600;color:${remaining > 0 ? 'var(--danger)' : 'var(--success)'}">
              ${remaining > 0 ? `متبقي: ${formatCurrency(remaining)} ج.م` : '✅ مسدد بالكامل'}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="showSaleInstallments('${sale.id}')">📋 الأقساط (${sale.payments?.length || 0})</button>
          <button class="btn btn-warning btn-sm" onclick="openSaleFilesModal('${sale.id}')">📎 ملفات (${(sale.files||[]).length})</button>
          <button class="btn btn-pdf btn-sm" onclick="exportClientPDF('${sale.id}')">📄 كشف حساب</button>
          <button class="btn btn-ghost btn-sm" onclick="openEditSaleModal('${sale.id}')">✏️ تعديل</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSale('${sale.id}')">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

// ============================================================
// INSTALLMENTS MODAL (NEW)
// ============================================================
function showSaleInstallments(saleId) {
  const sale = sales.find(s => s.id === saleId);
  if (!sale) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const totalPaid = getTotalPaid(sale);
  const remaining = sale.totalPrice - totalPaid;

  const modal = document.getElementById('installments-modal');
  const title = document.getElementById('installments-modal-title');
  const content = document.getElementById('installments-modal-content');

  title.textContent = `أقساط - ${sale.customerName}`;

  const summaryHtml = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-bottom:1.5rem">
      <div class="summary-card" style="padding:1rem"><div class="summary-label">إجمالي السعر</div><div class="summary-value" style="font-size:1.5rem">${formatCurrency(sale.totalPrice)}</div></div>
      <div class="summary-card gold" style="padding:1rem"><div class="summary-label">المدفوع</div><div class="summary-value" style="font-size:1.5rem">${formatCurrency(totalPaid)}</div></div>
      <div class="summary-card ${remaining > 0 ? 'danger' : ''}" style="padding:1rem"><div class="summary-label">المتبقي</div><div class="summary-value" style="font-size:1.5rem">${formatCurrency(remaining)}</div></div>
    </div>`;

  const installmentsHtml = (sale.payments || []).map((inst, idx) => {
    const due = new Date(inst.dueDate); due.setHours(0,0,0,0);
    const isOverdue = (inst.status === 'pending' || inst.status === 'partial') && due < today;
    const isDueSoon = !isOverdue && (inst.status === 'pending' || inst.status === 'partial') && (due - today) <= 7 * 24 * 60 * 60 * 1000;

    let statusBadge = '';
    if (inst.status === 'paid') statusBadge = '<span class="badge badge-success">✅ مدفوع</span>';
    else if (inst.status === 'partial') statusBadge = `<span class="badge badge-warning">⏳ جزئي (متبقي: ${formatCurrency(inst.remainingAmount)} ج.م)</span>`;
    else if (isOverdue) statusBadge = '<span class="badge badge-danger">🔴 متأخر</span>';
    else if (isDueSoon) statusBadge = '<span class="badge badge-warning">🟡 قريباً</span>';
    else statusBadge = '<span class="badge badge-info">⏳ قادم</span>';

    const partialList = (inst.partialPayments || []).map(pp => `
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-main);padding:0.5rem 0.75rem;border-radius:8px;margin-top:0.5rem;font-size:0.9rem">
        <div>
          <span style="font-weight:600;color:var(--success)">+${formatCurrency(pp.amount)} ج.م</span>
          <span style="color:var(--text-secondary);margin-right:0.5rem">${formatDate(pp.date)}</span>
          ${pp.note ? `<span style="color:var(--text-secondary)">(${pp.note})</span>` : ''}
        </div>
        ${inst.status !== 'paid' || (inst.partialPayments?.length > 1) ?
          `<button class="btn btn-danger btn-xs" onclick="removePartialPayment('${saleId}', ${idx}, '${pp.id}')">🗑️</button>` : ''}
      </div>`).join('');

    return `
      <div style="border:2px solid ${isOverdue ? 'var(--danger)' : isDueSoon ? 'var(--warning)' : 'var(--border)'};border-radius:12px;padding:1rem;margin-bottom:1rem;background:white">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem">
          <div>
            <div style="font-weight:700;font-size:1.1rem;color:var(--primary)">${inst.label}</div>
            <div style="color:var(--text-secondary);font-size:0.9rem;display:flex;align-items:center;gap:0.5rem">
              📅 ${formatDate(inst.dueDate)}
              <button class="btn btn-xs" style="background:var(--bg-main);padding:0.2rem 0.5rem;font-size:0.75rem" onclick="editInstallmentDate('${saleId}', ${idx}, '${inst.dueDate}')">✏️ تعديل</button>
            </div>
          </div>
          <div style="text-align:left">
            <div style="font-weight:700;color:var(--secondary);font-size:1.1rem">${formatCurrency(inst.totalAmount)} ج.م</div>
            ${statusBadge}
          </div>
        </div>

        ${partialList}

        ${inst.status !== 'paid' ? `
          <div style="margin-top:1rem;padding-top:0.75rem;border-top:1px dashed var(--border)">
            <div style="font-size:0.85rem;font-weight:600;color:var(--primary);margin-bottom:0.5rem">➕ تسجيل دفعة جديدة</div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
              <input type="number" id="partial-amount-${idx}" placeholder="المبلغ" max="${inst.remainingAmount}"
                style="padding:0.5rem;border:2px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;width:130px"
                value="${inst.remainingAmount}">
              <input type="date" id="partial-date-${idx}"
                style="padding:0.5rem;border:2px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif"
                value="${new Date().toISOString().split('T')[0]}">
              <input type="text" id="partial-note-${idx}" placeholder="ملاحظة (اختياري)"
                style="padding:0.5rem;border:2px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;flex:1;min-width:100px">
              <button class="btn btn-primary btn-sm" onclick="submitPartialPayment('${saleId}', ${idx})">💾 تسجيل</button>
            </div>
            ${inst.status === 'partial' ? `
              <button class="btn btn-secondary btn-sm" style="margin-top:0.5rem" onclick="payRemainingAmount('${saleId}', ${idx})">
                💰 دفع المتبقي كاملاً (${formatCurrency(inst.remainingAmount)} ج.م)
              </button>` : ''}
          </div>` : ''}

        <!-- إيصالات القسط -->
        <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px dashed var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
            <div style="font-size:0.85rem;font-weight:600;color:var(--text-secondary)">📎 إيصالات (${(inst.files||[]).length})</div>
            <label class="btn btn-xs" style="background:var(--bg-main);cursor:pointer;color:var(--primary)">
              📤 رفع إيصال
              <input type="file" accept="image/*,.pdf" style="display:none"
                onchange="uploadInstallmentFile(this, '${saleId}', ${idx})">
            </label>
          </div>
          ${(inst.files||[]).length > 0 ? (inst.files||[]).map(f => `
            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-main);padding:0.4rem 0.6rem;border-radius:8px;margin-bottom:0.3rem;font-size:0.85rem">
              <span>${f.type === 'pdf' ? '📄' : '🖼️'} ${f.name}</span>
              <div style="display:flex;gap:0.3rem">
                <a href="${f.url}" target="_blank" class="btn btn-xs btn-secondary">👁️</a>
                <button class="btn btn-xs btn-danger" onclick="deleteInstallmentFile('${saleId}', ${idx}, '${f.path}')">🗑️</button>
              </div>
            </div>`).join('') : ''}
        </div>
      </div>`;
  }).join('');

  content.innerHTML = summaryHtml + installmentsHtml;
  modal.classList.add('active');
}

async function submitPartialPayment(saleId, installmentIndex) {
  const amount = parseFloat(document.getElementById(`partial-amount-${installmentIndex}`)?.value);
  const date = document.getElementById(`partial-date-${installmentIndex}`)?.value;
  const note = document.getElementById(`partial-note-${installmentIndex}`)?.value || '';

  if (!amount || amount <= 0) { showToast('أدخل مبلغاً صحيحاً', 'warning'); return; }
  if (!date) { showToast('أدخل التاريخ', 'warning'); return; }

  showLoading();
  const ok = await DB.addPartialPayment(saleId, installmentIndex, { amount, date, note });
  if (ok) {
    await loadData();
    hideLoading();
    showToast('تم تسجيل الدفعة بنجاح', 'success');
    showSaleInstallments(saleId);
    updateDashboard();
    checkOverdueInstallments();
  } else {
    hideLoading();
    showToast('حدث خطأ أثناء التسجيل', 'error');
  }
}

async function payRemainingAmount(saleId, installmentIndex) {
  const sale = sales.find(s => s.id === saleId);
  if (!sale) return;
  const inst = sale.payments[installmentIndex];
  if (!inst) return;

  showLoading();
  const ok = await DB.addPartialPayment(saleId, installmentIndex, {
    amount: inst.remainingAmount,
    date: new Date().toISOString().split('T')[0],
    note: 'سداد المتبقي'
  });
  if (ok) {
    await loadData();
    hideLoading();
    showToast('تم سداد المتبقي بنجاح', 'success');
    showSaleInstallments(saleId);
    updateDashboard();
    checkOverdueInstallments();
  } else {
    hideLoading();
    showToast('حدث خطأ', 'error');
  }
}

async function removePartialPayment(saleId, installmentIndex, partialPaymentId) {
  if (!confirm('هل تريد حذف هذه الدفعة؟')) return;
  showLoading();
  const ok = await DB.deletePartialPayment(saleId, installmentIndex, partialPaymentId);
  if (ok) {
    await loadData();
    hideLoading();
    showToast('تم حذف الدفعة', 'success');
    showSaleInstallments(saleId);
    updateDashboard();
    checkOverdueInstallments();
  } else {
    hideLoading();
    showToast('حدث خطأ', 'error');
  }
}

// Edit installment due date
function editInstallmentDate(saleId, installmentIndex, currentDate) {
  const newDate = prompt('أدخل التاريخ الجديد (YYYY-MM-DD):', currentDate);
  if (!newDate) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) { showToast('صيغة التاريخ غير صحيحة', 'warning'); return; }
  showLoading();
  DB.updateInstallmentDate(saleId, installmentIndex, newDate).then(async ok => {
    if (ok) {
      await loadData();
      hideLoading();
      showToast('تم تحديث تاريخ القسط', 'success');
      showSaleInstallments(saleId);
      checkOverdueInstallments();
    } else {
      hideLoading();
      showToast('حدث خطأ', 'error');
    }
  });
}

// ============================================================
// ADD SALE MODAL - Dynamic installment rows
// ============================================================
let installmentRows = [];

function openAddSaleModal() {
  populateProjectSelects();
  document.getElementById('add-sale-form').reset();
  installmentRows = [];
  renderInstallmentRows();
  document.querySelector('#add-sale-modal input[name="saleDate"]').value = new Date().toISOString().split('T')[0];
  document.getElementById('installment-fields').style.display = 'none';
  document.getElementById('add-sale-modal').classList.add('active');
}

function toggleInstallmentFields() {
  const type = event.target.value;
  document.getElementById('installment-fields').style.display = type === 'installment' ? 'block' : 'none';
  if (type === 'installment' && installmentRows.length === 0) addInstallmentRow();
}

function addInstallmentRow() {
  installmentRows.push({ label: `القسط ${installmentRows.length + 1}`, amount: '', dueDate: '' });
  renderInstallmentRows();
}

function removeInstallmentRow(idx) {
  installmentRows.splice(idx, 1);
  // Relabel
  installmentRows.forEach((r, i) => { if (r.label === `القسط ${i + 2}`) r.label = `القسط ${i + 1}`; });
  renderInstallmentRows();
}

function renderInstallmentRows() {
  const container = document.getElementById('installment-rows-container');
  if (!container) return;

  if (installmentRows.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-secondary);padding:1rem">اضغط "إضافة قسط" لإضافة أقساط</div>`;
    return;
  }

  container.innerHTML = installmentRows.map((row, i) => `
    <div style="display:flex;gap:0.75rem;align-items:flex-end;flex-wrap:wrap;margin-bottom:0.75rem;background:var(--bg-main);padding:0.75rem;border-radius:10px">
      <div class="form-group" style="flex:1;min-width:100px">
        <label class="form-label" style="font-size:0.85rem">اسم القسط</label>
        <input type="text" class="form-control" value="${row.label}"
          oninput="installmentRows[${i}].label = this.value"
          style="padding:0.6rem">
      </div>
      <div class="form-group" style="flex:1;min-width:110px">
        <label class="form-label" style="font-size:0.85rem">المبلغ (ج.م) *</label>
        <input type="number" class="form-control" value="${row.amount}" placeholder="0" min="0"
          oninput="installmentRows[${i}].amount = this.value; updateInstallmentsSummary()"
          style="padding:0.6rem">
      </div>
      <div class="form-group" style="flex:1;min-width:130px">
        <label class="form-label" style="font-size:0.85rem">تاريخ الاستحقاق *</label>
        <input type="date" class="form-control" value="${row.dueDate}"
          oninput="installmentRows[${i}].dueDate = this.value"
          style="padding:0.6rem">
      </div>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeInstallmentRow(${i})" style="margin-bottom:0.25rem">🗑️</button>
    </div>`).join('');

  updateInstallmentsSummary();
}

function updateInstallmentsSummary() {
  const totalPrice = parseFloat(document.querySelector('[name="totalPrice"]')?.value) || 0;
  const downPayment = parseFloat(document.querySelector('[name="downPayment"]')?.value) || 0;
  const installmentsTotal = installmentRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const sumEl = document.getElementById('installments-sum-display');
  if (!sumEl) return;

  const total = downPayment + installmentsTotal;
  const diff = total - totalPrice;
  const color = Math.abs(diff) < 0.01 ? 'var(--success)' : 'var(--danger)';
  sumEl.innerHTML = `
    <span>مقدم: <b>${formatCurrency(downPayment)}</b></span> +
    <span>أقساط: <b>${formatCurrency(installmentsTotal)}</b></span> =
    <span style="color:${color}"><b>${formatCurrency(total)} ج.م</b></span>
    ${Math.abs(diff) >= 0.01 ? `<span style="color:var(--danger);margin-right:0.5rem">(فرق: ${formatCurrency(Math.abs(diff))} ج.م)</span>` : '<span style="color:var(--success)"> ✅</span>'}
  `;
}

// ============================================================
// ADD/EDIT PROJECT
// ============================================================
function openAddProjectModal() {
  document.getElementById('add-project-form').reset();
  document.getElementById('add-project-modal').classList.add('active');
}

async function openEditProjectModal(projectId) {
  const project = await DB.getProject(projectId);
  if (!project) return;
  document.getElementById('edit-project-id').value = projectId;
  document.getElementById('edit-project-name').value = project.projectName;
  document.getElementById('edit-project-location').value = project.location || '';
  document.getElementById('edit-project-status').value = project.status;
  document.getElementById('edit-project-apartments').value = project.apartmentsCount;
  document.getElementById('edit-project-shops').value = project.shopsCount;
  document.getElementById('edit-project-modal').classList.add('active');
}

async function addProject(event) {
  event.preventDefault();
  showLoading();
  const fd = new FormData(event.target);
  const added = await DB.addProject({
    projectName: fd.get('projectName'),
    location: fd.get('location') || '',
    status: fd.get('status'),
    apartmentsCount: parseInt(fd.get('apartmentsCount')) || 0,
    shopsCount: parseInt(fd.get('shopsCount')) || 0
  });
  if (added) {
    await loadData();
    closeModal('add-project-modal');
    event.target.reset();
    updateDashboard();
    renderProjects();
    populateProjectSelects();
    showToast('تم إضافة المشروع بنجاح');
  }
  hideLoading();
}

async function updateProject(event) {
  event.preventDefault();
  showLoading();
  const fd = new FormData(event.target);
  const updated = await DB.updateProject(fd.get('projectId'), {
    projectName: fd.get('projectName'),
    location: fd.get('location') || '',
    status: fd.get('status'),
    apartmentsCount: parseInt(fd.get('apartmentsCount')) || 0,
    shopsCount: parseInt(fd.get('shopsCount')) || 0
  });
  if (updated) {
    await loadData();
    closeModal('edit-project-modal');
    updateDashboard();
    renderProjects();
    populateProjectSelects();
    showToast('تم تحديث المشروع');
  }
  hideLoading();
}

async function deleteProject(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;
  if (!confirm(`هل أنت متأكد من حذف "${project.projectName}"؟\nسيتم حذف جميع المصروفات والمبيعات المرتبطة.`)) return;
  showLoading();
  const ok = await DB.deleteProject(projectId);
  if (ok) {
    await loadData();
    closeModal('project-details-modal');
    updateDashboard();
    renderProjects();
    renderSales();
    populateProjectSelects();
    showToast('تم حذف المشروع');
  }
  hideLoading();
}

// ============================================================
// ADD/EDIT SALE
// ============================================================
async function addSale(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const paymentType = fd.get('paymentType');

  // Validate installments
  if (paymentType === 'installment') {
    if (installmentRows.length === 0) { showToast('أضف قسطاً واحداً على الأقل', 'warning'); return; }
    for (const r of installmentRows) {
      if (!r.amount || !r.dueDate) { showToast('تأكد من إدخال المبلغ والتاريخ لكل قسط', 'warning'); return; }
    }
    const totalPrice = parseFloat(fd.get('totalPrice')) || 0;
    const downPayment = parseFloat(fd.get('downPayment')) || 0;
    const installmentsTotal = installmentRows.reduce((s, r) => s + parseFloat(r.amount), 0);
    const diff = Math.abs(downPayment + installmentsTotal - totalPrice);
    if (diff > 0.01) {
      if (!confirm(`⚠️ مجموع الأقساط والمقدم (${formatCurrency(downPayment + installmentsTotal)}) لا يساوي إجمالي السعر (${formatCurrency(totalPrice)}).\nهل تريد المتابعة؟`)) return;
    }
  }

  showLoading();
  const added = await DB.addSale({
    projectId: fd.get('projectId'),
    unitType: fd.get('unitType'),
    unitNumber: fd.get('unitNumber') || '',
    saleDate: fd.get('saleDate'),
    customerName: fd.get('customerName'),
    customerPhone: fd.get('customerPhone') || '',
    totalPrice: parseFloat(fd.get('totalPrice')),
    paymentType,
    downPayment: parseFloat(fd.get('downPayment')) || 0,
    notes: fd.get('notes') || '',
    installments: installmentRows.map(r => ({ label: r.label, amount: parseFloat(r.amount), dueDate: r.dueDate }))
  });
  if (added) {
    await loadData();
    closeModal('add-sale-modal');
    event.target.reset();
    installmentRows = [];
    updateDashboard();
    renderSales();
    checkOverdueInstallments();
    showToast('تم إضافة عملية البيع بنجاح');
  }
  hideLoading();
}

function openEditSaleModal(saleId) {
  const sale = sales.find(s => s.id === saleId);
  if (!sale) return;
  populateProjectSelects();
  document.getElementById('edit-sale-id').value = saleId;
  document.getElementById('edit-sale-project').value = sale.projectId;
  document.getElementById('edit-sale-unit-type').value = sale.unitType;
  document.getElementById('edit-sale-unit-number').value = sale.unitNumber || '';
  document.getElementById('edit-sale-date').value = sale.saleDate;
  document.getElementById('edit-sale-customer-name').value = sale.customerName;
  document.getElementById('edit-sale-customer-phone').value = sale.customerPhone || '';
  document.getElementById('edit-sale-total-price').value = sale.totalPrice;
  document.getElementById('edit-sale-notes').value = sale.notes || '';
  document.getElementById('edit-sale-modal').classList.add('active');
}

async function updateSale(event) {
  event.preventDefault();
  showLoading();
  const fd = new FormData(event.target);
  const updated = await DB.updateSale(fd.get('saleId'), {
    unitType: fd.get('unitType'),
    unitNumber: fd.get('unitNumber') || '',
    saleDate: fd.get('saleDate'),
    customerName: fd.get('customerName'),
    customerPhone: fd.get('customerPhone') || '',
    totalPrice: parseFloat(fd.get('totalPrice')),
    notes: fd.get('notes') || ''
  });
  if (updated) {
    await loadData();
    closeModal('edit-sale-modal');
    updateDashboard();
    renderSales();
    showToast('تم تحديث عملية البيع');
  }
  hideLoading();
}

async function deleteSale(saleId) {
  const sale = sales.find(s => s.id === saleId);
  if (!sale) return;
  if (!confirm(`هل أنت متأكد من حذف عملية البيع للعميل "${sale.customerName}"؟`)) return;
  showLoading();
  const ok = await DB.deleteSale(saleId);
  if (ok) {
    await loadData();
    updateDashboard();
    renderSales();
    checkOverdueInstallments();
    showToast('تم حذف عملية البيع');
  }
  hideLoading();
}

// ============================================================
// EXPENSES
// ============================================================
function openAddExpenseModal(projectId) {
  document.getElementById('add-expense-form').reset();
  document.getElementById('expense-project-id').value = projectId;
  document.querySelector('#add-expense-modal input[name="date"]').value = new Date().toISOString().split('T')[0];
  document.getElementById('custom-category-group').style.display = 'none';
  document.getElementById('add-expense-modal').classList.add('active');
}

async function openEditExpenseModal(projectId, expenseId) {
  const expenses = await DB.getProjectExpenses(projectId);
  const expense = expenses.find(e => e.id === expenseId);
  if (!expense) return;
  document.getElementById('edit-expense-project-id').value = projectId;
  document.getElementById('edit-expense-id').value = expenseId;
  document.getElementById('edit-expense-date').value = expense.date;
  document.getElementById('edit-expense-category').value = expense.category;
  document.getElementById('edit-expense-amount').value = expense.amount;
  document.getElementById('edit-expense-recipient').value = expense.recipient || '';
  document.getElementById('edit-expense-notes').value = expense.notes || '';
  document.getElementById('edit-custom-category-group').style.display = expense.category === 'custom' ? 'block' : 'none';
  if (expense.category === 'custom') document.getElementById('edit-expense-custom-category').value = expense.customCategory || '';
  document.getElementById('edit-expense-modal').classList.add('active');
}

async function addExpense(event) {
  event.preventDefault();
  showLoading();
  const fd = new FormData(event.target);
  const category = fd.get('category');
  const added = await DB.addExpense({
    projectId: fd.get('projectId'),
    date: fd.get('date'),
    category,
    customCategory: category === 'custom' ? fd.get('customCategory') : '',
    amount: parseFloat(fd.get('amount')),
    recipient: fd.get('recipient') || '',
    notes: fd.get('notes') || ''
  });
  if (added) {
    closeModal('add-expense-modal');
    event.target.reset();
    await showProjectDetails(added.projectId);
    updateDashboard();
    showToast('تم إضافة المصروف بنجاح');
  }
  hideLoading();
}

async function updateExpense(event) {
  event.preventDefault();
  showLoading();
  const fd = new FormData(event.target);
  const category = fd.get('category');
  const updated = await DB.updateExpense(fd.get('expenseId'), {
    date: fd.get('date'),
    category,
    customCategory: category === 'custom' ? fd.get('customCategory') : '',
    amount: parseFloat(fd.get('amount')),
    recipient: fd.get('recipient') || '',
    notes: fd.get('notes') || ''
  });
  if (updated) {
    closeModal('edit-expense-modal');
    await showProjectDetails(fd.get('projectId'));
    updateDashboard();
    showToast('تم تحديث المصروف');
  }
  hideLoading();
}

async function deleteExpense(projectId, expenseId) {
  if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
  showLoading();
  const ok = await DB.deleteExpense(expenseId);
  if (ok) {
    await showProjectDetails(projectId);
    updateDashboard();
    showToast('تم حذف المصروف');
  }
  hideLoading();
}

function toggleCustomCategory() {
  const category = event.target.value;
  document.getElementById('custom-category-group').style.display = category === 'custom' ? 'block' : 'none';
}

function toggleEditCustomCategory() {
  const category = event.target.value;
  document.getElementById('edit-custom-category-group').style.display = category === 'custom' ? 'block' : 'none';
}

// ============================================================
// PROJECT DETAILS
// ============================================================
async function showProjectDetails(projectId) {
  const project = projects.find(p => p.id === projectId) || await DB.getProject(projectId);
  if (!project) return;

  const expenses = await DB.getProjectExpenses(projectId);
  const projectSales = await DB.getProjectSales(projectId);
  const totalCosts = expenses.reduce((s, e) => s + e.amount, 0);
  const totalRevenue = projectSales.reduce((s, sale) => s + getTotalPaid(sale), 0);
  const expectedRevenue = projectSales.reduce((s, sale) => s + sale.totalPrice, 0);

  document.getElementById('project-details-title').textContent = `تفاصيل - ${project.projectName}`;

  // Categories summary
  const categories = {};
  expenses.forEach(e => {
    const key = e.category === 'custom' ? (e.customCategory || 'مخصص') : e.category;
    if (!categories[key]) categories[key] = { total: 0, count: 0 };
    categories[key].total += e.amount;
    categories[key].count++;
  });

  const categoryNames = { land: '🏗️ أرض', contractor: '👷 مقاول', engineer: '👨‍💼 مهندس', labor: '🔨 صنايعية وعمال' };

  document.getElementById('project-details-content').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:2rem">
      <div class="summary-card" style="padding:1rem"><div class="summary-label">إجمالي التكاليف</div><div class="summary-value" style="font-size:1.4rem">${formatCurrency(totalCosts)} <small>ج.م</small></div></div>
      <div class="summary-card gold" style="padding:1rem"><div class="summary-label">إيرادات محصلة</div><div class="summary-value" style="font-size:1.4rem">${formatCurrency(totalRevenue)} <small>ج.م</small></div></div>
      <div class="summary-card gold" style="padding:1rem"><div class="summary-label">إيرادات متوقعة</div><div class="summary-value" style="font-size:1.4rem">${formatCurrency(expectedRevenue)} <small>ج.م</small></div></div>
      <div class="summary-card ${totalRevenue - totalCosts >= 0 ? '' : 'danger'}" style="padding:1rem"><div class="summary-label">صافي الربح</div><div class="summary-value" style="font-size:1.4rem">${formatCurrency(totalRevenue - totalCosts)} <small>ج.م</small></div></div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:1rem">
      <h3 style="color:var(--primary);font-weight:700">💸 المصروفات (${expenses.length})</h3>
      <button class="btn btn-primary btn-sm" onclick="openAddExpenseModal('${projectId}')">➕ إضافة مصروف</button>
    </div>

    ${Object.keys(categories).length > 0 ? `
      <div class="expense-summary">
        ${Object.entries(categories).map(([cat, data]) => `
          <div class="expense-category">
            <span class="category-name">${categoryNames[cat] || '📋 ' + cat}</span>
            <span><span class="category-count">(${data.count} بند)</span><span class="category-amount">${formatCurrency(data.total)} ج.م</span></span>
          </div>`).join('')}
      </div>` : ''}

    ${expenses.length === 0 ? `<div class="empty-state"><div class="empty-state-icon">💸</div><p>لا توجد مصروفات بعد</p></div>` :
      expenses.map(e => `
        <div class="expense-item">
          <div class="expense-details">
            <div class="expense-date">${formatDate(e.date)}</div>
            <div class="expense-category-label">${getCategoryName(e.category, e.customCategory)}</div>
            ${e.recipient ? `<div class="expense-recipient">👤 ${e.recipient}</div>` : ''}
            ${e.notes ? `<div class="expense-recipient">📝 ${e.notes}</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem">
            <span class="expense-amount-display">${formatCurrency(e.amount)} ج.م</span>
            <div class="expense-actions">
              <button class="btn btn-warning btn-xs" onclick="openEditExpenseModal('${projectId}','${e.id}')">✏️</button>
              <button class="btn btn-danger btn-xs" onclick="deleteExpense('${projectId}','${e.id}')">🗑️</button>
            </div>
          </div>
        </div>`).join('')}

    <div style="margin-top:1.5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem">
      <h3 style="color:var(--primary);font-weight:700">💰 المبيعات (${projectSales.length})</h3>
    </div>
    ${projectSales.length === 0 ? `<div class="empty-state"><div class="empty-state-icon">💰</div><p>لا توجد مبيعات بعد</p></div>` :
      projectSales.map(sale => {
        const paid = getTotalPaid(sale);
        const remaining = sale.totalPrice - paid;
        return `
          <div style="background:var(--bg-main);border-radius:10px;padding:1rem;margin-bottom:0.75rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
            <div>
              <div style="font-weight:700;color:var(--primary)">${sale.customerName}</div>
              <div style="font-size:0.85rem;color:var(--text-secondary)">${sale.unitType === 'apartment' ? '🏠 شقة' : '🏪 محل'} ${sale.unitNumber || ''} — ${formatDate(sale.saleDate)}</div>
            </div>
            <div style="text-align:left">
              <div style="font-weight:700;color:var(--secondary)">${formatCurrency(sale.totalPrice)} ج.م</div>
              <div style="font-size:0.85rem;color:${remaining > 0 ? 'var(--danger)' : 'var(--success)'}">
                ${remaining > 0 ? `متبقي: ${formatCurrency(remaining)} ج.م` : '✅ مسدد'}
              </div>
            </div>
          </div>`}).join('')}
  `;

  document.getElementById('project-details-modal').classList.add('active');
}

// ============================================================
// REPORTS
// ============================================================
async function generateReport() {
  const container = document.getElementById('reports-content');
  if (!container) return;

  let totalRevenue = 0, totalPaid = 0, totalCosts = 0;
  for (const p of projects) {
    totalRevenue += projects.reduce((s, pr) => s + sales.filter(sa => sa.projectId === pr.id).reduce((ss, sale) => ss + sale.totalPrice, 0), 0);
    totalPaid += calculateProjectRevenue(p.id);
    totalCosts += await calculateProjectCosts(p.id);
    break; // calculate once for all projects combined
  }

  // Recalculate properly
  totalRevenue = sales.reduce((s, sale) => s + sale.totalPrice, 0);
  totalPaid = sales.reduce((s, sale) => s + getTotalPaid(sale), 0);
  const totalRemaining = totalRevenue - totalPaid;
  totalCosts = 0;
  for (const p of projects) totalCosts += await calculateProjectCosts(p.id);

  // Overdue installments
  const today = new Date(); today.setHours(0,0,0,0);
  const overdueInstallments = [];
  for (const sale of sales) {
    const project = projects.find(p => p.id === sale.projectId);
    (sale.payments || []).forEach((inst, idx) => {
      if (inst.status === 'pending' || inst.status === 'partial') {
        const due = new Date(inst.dueDate); due.setHours(0,0,0,0);
        if (due < today) overdueInstallments.push({ sale, project, inst, idx, daysLate: Math.floor((today - due) / 86400000) });
      }
    });
  }

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:2rem">
      <div class="summary-card" style="padding:1rem"><div class="summary-label">إجمالي المشاريع</div><div class="summary-value" style="font-size:1.6rem">${projects.length}</div></div>
      <div class="summary-card gold" style="padding:1rem"><div class="summary-label">إجمالي المبيعات</div><div class="summary-value" style="font-size:1.4rem">${formatCurrency(totalRevenue)} ج.م</div></div>
      <div class="summary-card gold" style="padding:1rem"><div class="summary-label">المحصل فعلياً</div><div class="summary-value" style="font-size:1.4rem">${formatCurrency(totalPaid)} ج.م</div></div>
      <div class="summary-card danger" style="padding:1rem"><div class="summary-label">المتبقي تحصيله</div><div class="summary-value" style="font-size:1.4rem">${formatCurrency(totalRemaining)} ج.م</div></div>
      <div class="summary-card" style="padding:1rem"><div class="summary-label">إجمالي التكاليف</div><div class="summary-value" style="font-size:1.4rem">${formatCurrency(totalCosts)} ج.م</div></div>
      <div class="summary-card ${totalPaid - totalCosts >= 0 ? 'gold' : 'danger'}" style="padding:1rem"><div class="summary-label">صافي الربح</div><div class="summary-value" style="font-size:1.4rem">${formatCurrency(totalPaid - totalCosts)} ج.م</div></div>
    </div>

    ${overdueInstallments.length > 0 ? `
      <div style="background:#fff5f5;border:2px solid var(--danger);border-radius:16px;padding:1.5rem;margin-bottom:2rem">
        <h3 style="color:var(--danger);margin-bottom:1rem">🔴 الأقساط المتأخرة (${overdueInstallments.length})</h3>
        ${overdueInstallments.map(({ sale, project, inst }) => `
          <div style="background:white;border-radius:10px;padding:0.75rem;margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
            <div>
              <div style="font-weight:700;color:var(--primary)">${sale.customerName}</div>
              <div style="font-size:0.85rem;color:var(--text-secondary)">${project?.projectName || ''} — ${inst.label}</div>
              <div style="font-size:0.85rem;color:var(--danger)">📅 استحق: ${formatDate(inst.dueDate)}</div>
            </div>
            <div>
              <div style="font-weight:700;color:var(--danger)">${formatCurrency(inst.remainingAmount || inst.totalAmount)} ج.م</div>
              <span class="badge badge-danger">${inst.status === 'partial' ? 'جزئي' : 'لم يدفع'}</span>
            </div>
          </div>`).join('')}
      </div>` : `<div style="background:#f0fff4;border:2px solid var(--success);border-radius:16px;padding:1.5rem;margin-bottom:2rem;text-align:center;color:var(--success);font-weight:700">✅ لا توجد أقساط متأخرة</div>`}

    <h3 style="color:var(--primary);font-weight:700;margin-bottom:1rem">📊 تفاصيل المشاريع</h3>
    ${await Promise.all(projects.map(async p => {
      const costs = await calculateProjectCosts(p.id);
      const rev = calculateProjectRevenue(p.id);
      const expectedRev = sales.filter(s => s.projectId === p.id).reduce((sum, sale) => sum + sale.totalPrice, 0);
      return `
        <div style="background:var(--bg-main);border-radius:12px;padding:1rem;margin-bottom:0.75rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem">
          <div>
            <div style="font-weight:700;color:var(--primary);font-size:1.1rem">${p.projectName}</div>
            <div style="font-size:0.85rem;color:var(--text-secondary)">${p.status === 'under_construction' ? '🔨 تحت الإنشاء' : '✅ جاهز'}</div>
          </div>
          <div style="display:flex;gap:1.5rem;flex-wrap:wrap">
            <div style="text-align:center"><div style="font-size:0.8rem;color:var(--text-secondary)">تكاليف</div><div style="font-weight:700;color:var(--danger)">${formatCurrency(costs)} ج.م</div></div>
            <div style="text-align:center"><div style="font-size:0.8rem;color:var(--text-secondary)">محصل</div><div style="font-weight:700;color:var(--success)">${formatCurrency(rev)} ج.م</div></div>
            <div style="text-align:center"><div style="font-size:0.8rem;color:var(--text-secondary)">متوقع</div><div style="font-weight:700;color:var(--secondary)">${formatCurrency(expectedRev)} ج.م</div></div>
            <div style="text-align:center"><div style="font-size:0.8rem;color:var(--text-secondary)">ربح</div><div style="font-weight:700;color:${rev - costs >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(rev - costs)} ج.م</div></div>
          </div>
        </div>`;
    })).then(rows => rows.join(''))}
  `;
}

// ============================================================
// HELPERS
// ============================================================
function populateProjectSelects() {
  ['sale-project-select', 'edit-sale-project'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">اختر المشروع</option>';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.projectName;
      sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
  });
}

function updateUnitTypes() {
  const projectId = document.getElementById('sale-project-select').value;
  const sel = document.querySelector('[name="unitType"]');
  if (!projectId || !sel) return;
  const project = projects.find(p => p.id === projectId);
  if (!project) return;
  sel.innerHTML = '<option value="">اختر نوع الوحدة</option>';
  if (project.apartmentsCount > 0) sel.innerHTML += '<option value="apartment">🏠 شقة</option>';
  if (project.shopsCount > 0) sel.innerHTML += '<option value="shop">🏪 محل</option>';
}

function getTotalPaid(sale) {
  return (sale.payments || []).reduce((s, inst) => s + (parseFloat(inst.paidAmount) || 0), 0);
}

function calculateProjectRevenue(projectId) {
  return sales.filter(s => s.projectId === projectId).reduce((s, sale) => s + getTotalPaid(sale), 0);
}

async function calculateProjectCosts(projectId) {
  const expenses = await DB.getProjectExpenses(projectId);
  return expenses.reduce((s, e) => s + e.amount, 0);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
}

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getCategoryName(category, customCategory) {
  const cats = { land: '🏗️ أرض', contractor: '👷 مقاول', engineer: '👨‍💼 مهندس', labor: '🔨 صنايعية وعمال' };
  return category === 'custom' ? '📋 ' + customCategory : (cats[category] || category);
}

// ============================================================
// CHARTS
// ============================================================
async function renderCharts(totalPaid, totalCosts) {
  // Chart 1: إيرادات vs تكاليف لكل مشروع
  const labels = [], revenueData = [], costsData = [];
  for (const p of projects.slice(0, 6)) {
    labels.push(p.projectName.length > 12 ? p.projectName.slice(0, 12) + '…' : p.projectName);
    revenueData.push(calculateProjectRevenue(p.id));
    costsData.push(await calculateProjectCosts(p.id));
  }

  const ctx1 = document.getElementById('chart-projects');
  if (ctx1) {
    if (chartProjects) chartProjects.destroy();
    chartProjects = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'إيرادات', data: revenueData, backgroundColor: 'rgba(201,152,42,0.8)', borderRadius: 6 },
          { label: 'تكاليف', data: costsData, backgroundColor: 'rgba(15,61,46,0.6)', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Cairo', size: 11 }, boxWidth: 14 } } },
        scales: { x: { ticks: { font: { family: 'Cairo', size: 10 } } }, y: { ticks: { font: { family: 'Cairo', size: 10 }, callback: v => (v/1000) + 'k' } } }
      }
    });
  }

  // Chart 2: حالة الأقساط
  let paid = 0, partial = 0, pending = 0, overdue = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  for (const sale of sales) {
    for (const inst of (sale.payments || [])) {
      if (inst.status === 'paid') paid++;
      else if (inst.status === 'partial') partial++;
      else {
        const due = new Date(inst.dueDate); due.setHours(0,0,0,0);
        if (due < today) overdue++; else pending++;
      }
    }
  }

  const ctx2 = document.getElementById('chart-installments');
  if (ctx2) {
    if (chartInstallments) chartInstallments.destroy();
    chartInstallments = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['مدفوع', 'جزئي', 'قادم', 'متأخر'],
        datasets: [{ data: [paid, partial, pending, overdue], backgroundColor: ['#1e7e4a','#e67e22','#2471a3','#c0392b'], borderWidth: 2 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Cairo', size: 11 }, boxWidth: 14 } } }
      }
    });
  }
}

// ============================================================
// PDF EXPORT — نظام الطباعة (HTML → Print → PDF)
// يدعم العربي بالكامل عبر المتصفح
// ============================================================

const PDF_STYLES = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Tajawal:wght@700;900&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Cairo',sans-serif; direction:rtl; color:#1c1c1a; background:#fff; padding:20px; font-size:13px; }
    .pdf-header { background:#0f3d2e; color:#fff; padding:18px 24px; border-radius:8px; margin-bottom:20px; }
    .pdf-header h1 { font-family:'Tajawal',sans-serif; font-size:20px; font-weight:900; margin-bottom:4px; }
    .pdf-header p  { font-size:12px; opacity:.85; }
    .pdf-meta { display:flex; justify-content:space-between; font-size:11px; color:#6b6860; margin-top:6px; }
    .section-title { font-family:'Tajawal',sans-serif; font-weight:700; font-size:14px; color:#0f3d2e; border-right:4px solid #c9982a; padding-right:10px; margin:18px 0 10px; }
    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; background:#f7f5f0; border-radius:8px; padding:12px 16px; margin-bottom:12px; }
    .info-row { display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #e0ddd6; }
    .info-row:last-child { border:none; }
    .info-label { font-weight:700; color:#6b6860; font-size:12px; }
    .info-value { font-weight:600; color:#1c1c1a; }
    .summary-boxes { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px; }
    .summary-box { border-radius:8px; padding:12px; text-align:center; }
    .summary-box.green  { background:#e8f5ee; }
    .summary-box.gold   { background:#fdf3dc; }
    .summary-box.red    { background:#fce8e6; }
    .summary-box .lbl   { font-size:11px; color:#6b6860; font-weight:600; margin-bottom:4px; }
    .summary-box .val   { font-family:'Tajawal',sans-serif; font-size:18px; font-weight:900; }
    .summary-box.green .val { color:#1e7e4a; }
    .summary-box.gold  .val { color:#9a6f10; }
    .summary-box.red   .val { color:#c0392b; }
    table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:16px; }
    th { background:#0f3d2e; color:#fff; padding:8px 10px; text-align:right; font-weight:700; font-size:11px; }
    td { padding:7px 10px; border-bottom:1px solid #e0ddd6; }
    tr:nth-child(even) td { background:#f7f5f0; }
    tr.overdue td { background:#fce8e6; color:#c0392b; }
    .badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700; }
    .badge-green { background:#e8f5ee; color:#1e7e4a; }
    .badge-red   { background:#fce8e6; color:#c0392b; }
    .badge-gold  { background:#fdf3dc; color:#9a6f10; }
    .badge-blue  { background:#e8f1fb; color:#1a5276; }
    .badge-orange{ background:#fef0e7; color:#c0642b; }
    .footer { margin-top:24px; padding-top:12px; border-top:2px solid #e0ddd6; display:flex; justify-content:space-between; font-size:11px; color:#6b6860; }
    @media print {
      body { padding:10px; }
      @page { margin:15mm; size:A4; }
    }
  </style>
`;

function openPrintWindow(htmlContent, filename) {
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${filename}</title>${PDF_STYLES}</head><body>${htmlContent}</body></html>`);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ── 1. كشف حساب عميل ─────────────────────────────────────
async function exportClientPDF(saleId) {
  const sale = sales.find(s => s.id === saleId);
  if (!sale) return;
  const project = projects.find(p => p.id === sale.projectId);
  const totalPaid = getTotalPaid(sale);
  const remaining = sale.totalPrice - totalPaid;
  const today = new Date(); today.setHours(0,0,0,0);
  const dateStr = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });

  const installmentsRows = (sale.payments || []).map((inst, i) => {
    const due = new Date(inst.dueDate); due.setHours(0,0,0,0);
    const isOverdue = inst.status !== 'paid' && due < today;
    const statusBadge =
      inst.status === 'paid'    ? '<span class="badge badge-green">مدفوع ✓</span>' :
      inst.status === 'partial' ? '<span class="badge badge-orange">جزئي</span>'   :
      isOverdue                 ? '<span class="badge badge-red">متأخر !</span>'   :
                                  '<span class="badge badge-blue">قادم</span>';
    return `<tr class="${isOverdue ? 'overdue' : ''}">
      <td>${i + 1}</td>
      <td>${inst.label || 'قسط ' + (i+1)}</td>
      <td>${formatCurrency(inst.totalAmount)} ج.م</td>
      <td>${formatDate(inst.dueDate)}</td>
      <td style="color:#1e7e4a;font-weight:700">${formatCurrency(inst.paidAmount || 0)} ج.م</td>
      <td style="color:#c0392b;font-weight:700">${formatCurrency(inst.remainingAmount || 0)} ج.م</td>
      <td>${statusBadge}</td>
    </tr>`;
  }).join('');

  const html = `
    <div class="pdf-header">
      <h1>كشف حساب عميل</h1>
      <p>${sale.customerName} — ${project?.projectName || ''}</p>
      <div class="pdf-meta"><span>تاريخ الإصدار: ${dateStr}</span></div>
    </div>

    <div class="section-title">بيانات العميل والوحدة</div>
    <div class="info-grid">
      <div class="info-row"><span class="info-label">اسم العميل</span><span class="info-value">${sale.customerName}</span></div>
      <div class="info-row"><span class="info-label">رقم الهاتف</span><span class="info-value">${sale.customerPhone || '—'}</span></div>
      <div class="info-row"><span class="info-label">المشروع</span><span class="info-value">${project?.projectName || '—'}</span></div>
      <div class="info-row"><span class="info-label">نوع الوحدة</span><span class="info-value">${sale.unitType === 'apartment' ? 'شقة' : 'محل'} ${sale.unitNumber || ''}</span></div>
      <div class="info-row"><span class="info-label">تاريخ البيع</span><span class="info-value">${formatDate(sale.saleDate)}</span></div>
      <div class="info-row"><span class="info-label">طريقة الدفع</span><span class="info-value">${sale.paymentType === 'cash' ? 'كاش' : 'أقساط'}</span></div>
    </div>

    <div class="summary-boxes">
      <div class="summary-box gold"><div class="lbl">إجمالي السعر</div><div class="val">${formatCurrency(sale.totalPrice)}</div><div class="lbl">ج.م</div></div>
      <div class="summary-box green"><div class="lbl">إجمالي المدفوع</div><div class="val">${formatCurrency(totalPaid)}</div><div class="lbl">ج.م</div></div>
      <div class="summary-box ${remaining > 0 ? 'red' : 'green'}"><div class="lbl">المتبقي</div><div class="val">${formatCurrency(remaining)}</div><div class="lbl">ج.م</div></div>
    </div>

    <div class="section-title">جدول الأقساط (${(sale.payments || []).length} قسط)</div>
    <table>
      <thead><tr><th>#</th><th>البند</th><th>المبلغ</th><th>تاريخ الاستحقاق</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr></thead>
      <tbody>${installmentsRows}</tbody>
    </table>

    <div class="footer">
      <span>نظام إدارة المشاريع العقارية</span>
      <span>${dateStr}</span>
    </div>`;

  openPrintWindow(html, `كشف-حساب-${sale.customerName}`);
  showToast('جاري فتح نافذة الطباعة...', 'info');
}

// ── 2. تقرير مشروع كامل ──────────────────────────────────
async function exportProjectPDF(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;
  const expenses = await DB.getProjectExpenses(projectId);
  const projectSales = sales.filter(s => s.projectId === projectId);
  const totalCosts = expenses.reduce((s, e) => s + e.amount, 0);
  const totalPaid = projectSales.reduce((s, sale) => s + getTotalPaid(sale), 0);
  const totalExpected = projectSales.reduce((s, sale) => s + sale.totalPrice, 0);
  const dateStr = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });

  const expRows = expenses.map((e, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${getCategoryName(e.category, e.customCategory)}</td>
      <td>${formatDate(e.date)}</td>
      <td>${e.recipient || '—'}</td>
      <td style="font-weight:700;color:#c9982a">${formatCurrency(e.amount)} ج.م</td>
      <td>${e.notes || '—'}</td>
    </tr>`).join('');

  const saleRows = projectSales.map((sale, i) => {
    const paid = getTotalPaid(sale);
    const rem = sale.totalPrice - paid;
    return `<tr>
      <td>${i+1}</td>
      <td style="font-weight:700">${sale.customerName}</td>
      <td>${sale.customerPhone || '—'}</td>
      <td>${sale.unitType === 'apartment' ? 'شقة' : 'محل'} ${sale.unitNumber || ''}</td>
      <td>${formatDate(sale.saleDate)}</td>
      <td style="font-weight:700;color:#c9982a">${formatCurrency(sale.totalPrice)} ج.م</td>
      <td style="color:#1e7e4a;font-weight:700">${formatCurrency(paid)} ج.م</td>
      <td style="color:${rem > 0 ? '#c0392b' : '#1e7e4a'};font-weight:700">${formatCurrency(rem)} ج.م</td>
    </tr>`;}).join('');

  const html = `
    <div class="pdf-header">
      <h1>تقرير مشروع — ${project.projectName}</h1>
      <p>${project.location || ''} &nbsp;|&nbsp; ${project.status === 'under_construction' ? 'تحت الإنشاء' : 'جاهز'}</p>
      <div class="pdf-meta"><span>تاريخ الإصدار: ${dateStr}</span></div>
    </div>

    <div class="summary-boxes">
      <div class="summary-box red"><div class="lbl">إجمالي التكاليف</div><div class="val">${formatCurrency(totalCosts)}</div><div class="lbl">ج.م</div></div>
      <div class="summary-box green"><div class="lbl">إيرادات محصلة</div><div class="val">${formatCurrency(totalPaid)}</div><div class="lbl">ج.م</div></div>
      <div class="summary-box gold"><div class="lbl">صافي الربح</div><div class="val">${formatCurrency(totalPaid - totalCosts)}</div><div class="lbl">ج.م</div></div>
    </div>

    <div class="section-title">💸 المصروفات (${expenses.length} بند — إجمالي: ${formatCurrency(totalCosts)} ج.م)</div>
    <table>
      <thead><tr><th>#</th><th>الفئة</th><th>التاريخ</th><th>المستلم</th><th>المبلغ</th><th>ملاحظات</th></tr></thead>
      <tbody>${expRows || '<tr><td colspan="6" style="text-align:center;color:#6b6860">لا توجد مصروفات</td></tr>'}</tbody>
    </table>

    <div class="section-title">💰 المبيعات (${projectSales.length} عميل — متوقع: ${formatCurrency(totalExpected)} ج.م)</div>
    <table>
      <thead><tr><th>#</th><th>العميل</th><th>الهاتف</th><th>الوحدة</th><th>تاريخ البيع</th><th>السعر</th><th>المدفوع</th><th>المتبقي</th></tr></thead>
      <tbody>${saleRows || '<tr><td colspan="8" style="text-align:center;color:#6b6860">لا توجد مبيعات</td></tr>'}</tbody>
    </table>

    <div class="footer">
      <span>نظام إدارة المشاريع العقارية</span>
      <span>${dateStr}</span>
    </div>`;

  openPrintWindow(html, `تقرير-${project.projectName}`);
  showToast('جاري فتح نافذة الطباعة...', 'info');
}

// ── 3. تقرير شهري عام ────────────────────────────────────
async function exportMonthlyPDF() {
  const dateStr = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });
  const monthStr = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long' });

  let totalCosts = 0;
  for (const p of projects) totalCosts += await calculateProjectCosts(p.id);
  const totalPaid = sales.reduce((s, sale) => s + getTotalPaid(sale), 0);
  const totalExpected = sales.reduce((s, sale) => s + sale.totalPrice, 0);

  // الأقساط المتأخرة
  const today = new Date(); today.setHours(0,0,0,0);
  const overdue = [];
  for (const sale of sales) {
    const proj = projects.find(p => p.id === sale.projectId);
    (sale.payments || []).forEach(inst => {
      if (inst.status !== 'paid') {
        const due = new Date(inst.dueDate); due.setHours(0,0,0,0);
        if (due < today) overdue.push({ sale, proj, inst });
      }
    });
  }

  const overdueRows = overdue.map((item, i) => `
    <tr class="overdue">
      <td>${i+1}</td>
      <td style="font-weight:700">${item.sale.customerName}</td>
      <td>${item.proj?.projectName || '—'}</td>
      <td>${item.inst.label || '—'}</td>
      <td>${formatDate(item.inst.dueDate)}</td>
      <td style="font-weight:700">${formatCurrency(item.inst.remainingAmount || item.inst.totalAmount)} ج.م</td>
      <td>${Math.floor((today - new Date(item.inst.dueDate)) / 86400000)} يوم</td>
    </tr>`).join('');

  const projRows = await Promise.all(projects.map(async (p, i) => {
    const costs = await calculateProjectCosts(p.id);
    const rev = calculateProjectRevenue(p.id);
    const exp = sales.filter(s => s.projectId === p.id).reduce((s, sale) => s + sale.totalPrice, 0);
    const profit = rev - costs;
    return `<tr>
      <td>${i+1}</td>
      <td style="font-weight:700">${p.projectName}</td>
      <td>${p.location || '—'}</td>
      <td><span class="badge ${p.status === 'under_construction' ? 'badge-orange' : 'badge-green'}">${p.status === 'under_construction' ? 'نشط' : 'جاهز'}</span></td>
      <td>${sales.filter(s => s.projectId === p.id).length}</td>
      <td style="color:#c0392b;font-weight:700">${formatCurrency(costs)} ج.م</td>
      <td style="color:#1e7e4a;font-weight:700">${formatCurrency(rev)} ج.م</td>
      <td style="color:#c9982a;font-weight:700">${formatCurrency(exp)} ج.م</td>
      <td style="font-weight:700;color:${profit >= 0 ? '#1e7e4a' : '#c0392b'}">${formatCurrency(profit)} ج.م</td>
    </tr>`;
  }));

  const html = `
    <div class="pdf-header">
      <h1>التقرير الشهري العام</h1>
      <p>${monthStr}</p>
      <div class="pdf-meta"><span>تاريخ الإصدار: ${dateStr}</span></div>
    </div>

    <div class="summary-boxes">
      <div class="summary-box gold"><div class="lbl">إيرادات محصلة</div><div class="val">${formatCurrency(totalPaid)}</div><div class="lbl">ج.م</div></div>
      <div class="summary-box red"><div class="lbl">إجمالي التكاليف</div><div class="val">${formatCurrency(totalCosts)}</div><div class="lbl">ج.م</div></div>
      <div class="summary-box green"><div class="lbl">صافي الربح</div><div class="val">${formatCurrency(totalPaid - totalCosts)}</div><div class="lbl">ج.م</div></div>
    </div>

    <div class="info-grid">
      <div class="info-row"><span class="info-label">إجمالي المشاريع</span><span class="info-value">${projects.length}</span></div>
      <div class="info-row"><span class="info-label">إجمالي عقود البيع</span><span class="info-value">${sales.length}</span></div>
      <div class="info-row"><span class="info-label">إجمالي المبيعات المتوقعة</span><span class="info-value">${formatCurrency(totalExpected)} ج.م</span></div>
      <div class="info-row"><span class="info-label">المتبقي تحصيله</span><span class="info-value" style="color:#c0392b">${formatCurrency(totalExpected - totalPaid)} ج.م</span></div>
      <div class="info-row"><span class="info-label">أقساط متأخرة</span><span class="info-value" style="color:#c0392b">${overdue.length} قسط</span></div>
    </div>

    ${overdue.length > 0 ? `
    <div class="section-title">🔴 الأقساط المتأخرة (${overdue.length})</div>
    <table>
      <thead><tr><th>#</th><th>العميل</th><th>المشروع</th><th>القسط</th><th>تاريخ الاستحقاق</th><th>المتبقي</th><th>أيام التأخير</th></tr></thead>
      <tbody>${overdueRows}</tbody>
    </table>` : `<div style="background:#e8f5ee;border-radius:8px;padding:12px;text-align:center;color:#1e7e4a;font-weight:700;margin-bottom:16px">✅ لا توجد أقساط متأخرة</div>`}

    <div class="section-title">📊 ملخص المشاريع</div>
    <table>
      <thead><tr><th>#</th><th>المشروع</th><th>الموقع</th><th>الحالة</th><th>المبيعات</th><th>التكاليف</th><th>محصل</th><th>متوقع</th><th>الربح</th></tr></thead>
      <tbody>${projRows.join('')}</tbody>
    </table>

    <div class="footer">
      <span>نظام إدارة المشاريع العقارية</span>
      <span>${dateStr}</span>
    </div>`;

  openPrintWindow(html, `التقرير-الشهري-${monthStr}`);
  showToast('جاري فتح نافذة الطباعة...', 'info');
}

// ============================================================
// MODAL CLOSE
// ============================================================
function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

// ============================================================
// FILE UPLOAD UI
// ============================================================

// ── رفع ملف عقد على عملية البيع ──────────────────────────
function openSaleFilesModal(saleId) {
  const sale = sales.find(s => s.id === saleId);
  if (!sale) return;

  const modal = document.getElementById('sale-files-modal');
  document.getElementById('sale-files-modal-title').textContent = `ملفات — ${sale.customerName}`;
  document.getElementById('sale-files-sale-id').value = saleId;
  renderSaleFilesList(sale);
  modal.classList.add('active');
}

function renderSaleFilesList(sale) {
  const container = document.getElementById('sale-files-list');
  const files = sale.files || [];

  if (files.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:2rem"><div class="empty-state-icon">📄</div><p>لا توجد ملفات مرفوعة بعد</p></div>`;
    return;
  }

  container.innerHTML = files.map(f => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem;background:var(--bg-main);border-radius:10px;margin-bottom:0.5rem">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <span style="font-size:1.5rem">${f.type === 'pdf' ? '📄' : '🖼️'}</span>
        <div>
          <div style="font-weight:600;color:var(--primary);font-size:0.9rem">${f.name}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary)">${formatDate(f.uploadedAt)}</div>
        </div>
      </div>
      <div style="display:flex;gap:0.5rem">
        <a href="${f.url}" target="_blank" class="btn btn-secondary btn-xs">👁️ عرض</a>
        <button class="btn btn-danger btn-xs" onclick="deleteSaleFile('${sale.id}', '${f.path}')">🗑️</button>
      </div>
    </div>`).join('');
}

async function uploadSaleFile(input) {
  const saleId = document.getElementById('sale-files-sale-id').value;
  const file = input.files[0];
  if (!file || !saleId) return;

  showLoading();
  const fileInfo = await DB.uploadFile(file, `contracts/${saleId}`);
  if (fileInfo) {
    const ok = await DB.addSaleFile(saleId, fileInfo);
    if (ok) {
      await loadData();
      // جيب النسخة المحدثة من الـ sales array
      const updatedSale = sales.find(s => s.id === saleId);
      renderSaleFilesList(updatedSale);
      renderSales(); // حدّث عداد الملفات في قائمة المبيعات
      showToast('تم رفع الملف بنجاح');
    } else {
      showToast('خطأ في حفظ بيانات الملف', 'error');
    }
  }
  input.value = '';
  hideLoading();
}

async function deleteSaleFile(saleId, filePath) {
  if (!confirm('هل تريد حذف هذا الملف؟')) return;
  showLoading();
  await DB.deleteSaleFile(saleId, filePath);
  await loadData();
  const sale = sales.find(s => s.id === saleId);
  renderSaleFilesList(sale);
  showToast('تم حذف الملف');
  hideLoading();
}

// ── رفع إيصال على قسط ────────────────────────────────────
async function uploadInstallmentFile(input, saleId, installmentIndex) {
  const file = input.files[0];
  if (!file) return;

  showLoading();
  const fileInfo = await DB.uploadFile(file, `receipts/${saleId}`);
  if (fileInfo) {
    const ok = await DB.addInstallmentFile(saleId, installmentIndex, fileInfo);
    if (ok) {
      await loadData();
      showToast('تم رفع الإيصال بنجاح');
      showSaleInstallments(saleId); // أعد رسم modal الأقساط
    }
  }
  input.value = '';
  hideLoading();
}

async function deleteInstallmentFile(saleId, installmentIndex, filePath) {
  if (!confirm('هل تريد حذف هذا الإيصال؟')) return;
  showLoading();
  await DB.deleteInstallmentFile(saleId, installmentIndex, filePath);
  await loadData();
  showToast('تم حذف الإيصال');
  showSaleInstallments(saleId);
  hideLoading();
}

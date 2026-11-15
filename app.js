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

  // ══════════════════════════════════════════════════════════
  // UNITS — جدول الوحدات (database/units_migration.sql)
  // ══════════════════════════════════════════════════════════
  async getUnits() {
    const { data, error } = await this.supabase.from('units').select('*');
    if (error) { console.error('getUnits error:', error); return []; }
    return data.map(mapUnit);
  },

  async addUnits(rows) {
    const { data, error } = await this.supabase.from('units').insert(rows.map(unitToRow)).select();
    if (error) { console.error('addUnits error:', error); showToast('تعذر حفظ الوحدات — تأكد من تشغيل units_migration.sql', 'error', 6000); return null; }
    return data.map(mapUnit);
  },

  async updateUnit(id, unit) {
    const { error } = await this.supabase.from('units')
      .update({ ...unitToRow(unit), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { console.error('updateUnit error:', error); showToast('تعذر حفظ الوحدة — تأكد من تشغيل units_migration.sql', 'error', 6000); return false; }
    return true;
  },

  // ربط وحدة ببيعة: تصبح مباعة ويُمسح الحجز
  async linkUnitToSale(unitId, saleId) {
    const { error } = await this.supabase.from('units').update({
      sale_id: saleId, status: 'available',
      reserved_by: '', reserved_phone: '', reserved_amount: 0, reserved_date: null,
      updated_at: new Date().toISOString()
    }).eq('id', unitId);
    if (error) { console.error('linkUnitToSale error:', error); return false; }
    return true;
  },

  async deleteProjectUnits(projectId) {
    const { error } = await this.supabase.from('units').delete().eq('project_id', projectId);
    if (error) { console.error(error); showToast('خطأ في حذف الوحدات', 'error'); return false; }
    return true;
  },

  async deleteUnit(id) {
    const { error } = await this.supabase.from('units').delete().eq('id', id);
    if (error) { console.error(error); showToast('خطأ في حذف الوحدة', 'error'); return false; }
    return true;
  },

  async getAllExpenses() {
    const { data, error } = await this.supabase
      .from('expenses').select('*').order('date', { ascending: false });
    if (error) { console.error(error); return []; }
    return data.map(mapExpense);
  },

  // ── فواتير المصروف (تحتاج عمود files — database/expenses_files_migration.sql) ──
  async addExpenseFile(expenseId, fileInfo) {
    const { data, error: fetchErr } = await this.supabase
      .from('expenses').select('files').eq('id', expenseId).single();
    if (fetchErr) { console.error('addExpenseFile fetch error:', fetchErr); return false; }
    const files = Array.isArray(data?.files) ? [...data.files] : [];
    files.push({ ...fileInfo, uploadedAt: new Date().toISOString() });
    const { error } = await this.supabase.from('expenses').update({ files }).eq('id', expenseId);
    if (error) { console.error('addExpenseFile update error:', error); return false; }
    return true;
  },

  async deleteExpenseFile(expenseId, filePath) {
    const { data, error: fetchErr } = await this.supabase
      .from('expenses').select('files').eq('id', expenseId).single();
    if (fetchErr) { console.error(fetchErr); return false; }
    const files = (data?.files || []).filter(f => f.path !== filePath);
    const { error } = await this.supabase.from('expenses').update({ files }).eq('id', expenseId);
    if (error) { console.error(error); return false; }
    await this.deleteFile(filePath);
    return true;
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
      payment_mode: sale.paymentMode || 'free',
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
      ...(updates.projectId ? { project_id: updates.projectId } : {}),
      unit_type: updates.unitType,
      unit_number: updates.unitNumber || '',
      sale_date: updates.saleDate,
      customer_name: updates.customerName,
      customer_phone: updates.customerPhone || '',
      total_price: updates.totalPrice,
      notes: updates.notes || '',
      notes_crm: updates.notesCrm || '',
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
  },

  // ══════════════════════════════════════════════════════════
  // FLEXIBLE PAYMENTS — جدول payments المستقل (نظام الدفع الحر)
  // ══════════════════════════════════════════════════════════
  async getPayments() {
    const { data, error } = await this.supabase
      .from('payments').select('*').order('date', { ascending: false });
    if (error) { console.error(error); return []; }
    return data.map(mapPayment);
  },

  async getSalePayments(saleId) {
    const { data, error } = await this.supabase
      .from('payments').select('*').eq('sale_id', saleId).order('date', { ascending: false });
    if (error) { console.error(error); return []; }
    return data.map(mapPayment);
  },

  async addPayment(payment) {
    const row = {
      id: crypto.randomUUID(),
      sale_id: payment.saleId,
      amount: payment.amount,
      date: payment.date,
      due_date: payment.dueDate || null,
      notes: payment.notes || ''
    };
    const { data, error } = await this.supabase.from('payments').insert([row]).select();
    if (error) { console.error(error); showToast('خطأ في إضافة الدفعة', 'error'); return null; }
    return mapPayment(data[0]);
  },

  async deletePayment(id) {
    const { error } = await this.supabase.from('payments').delete().eq('id', id);
    if (error) { console.error(error); showToast('خطأ في حذف الدفعة', 'error'); return false; }
    return true;
  },

  async updateSalePaymentMode(saleId, mode) {
    const { error } = await this.supabase
      .from('sales').update({ payment_mode: mode, updated_at: new Date().toISOString() }).eq('id', saleId);
    if (error) { console.error(error); showToast('خطأ في تحديث نظام الدفع', 'error'); return false; }
    return true;
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

function mapUnit(u) {
  return {
    id: u.id,
    projectId: u.project_id,
    unitNumber: u.unit_number || '',
    unitType: u.unit_type || 'apartment',
    floor: u.floor ?? 0,
    area: parseFloat(u.area) || 0,
    direction: u.direction || '',
    model: u.model || '',
    status: u.status || 'available',
    reservedBy: u.reserved_by || '',
    reservedPhone: u.reserved_phone || '',
    reservedAmount: parseFloat(u.reserved_amount) || 0,
    reservedDate: u.reserved_date || '',
    saleId: u.sale_id || null,
    notes: u.notes || ''
  };
}

function unitToRow(u) {
  const reserved = u.status === 'reserved';
  return {
    project_id: u.projectId,
    unit_number: String(u.unitNumber).trim(),
    unit_type: u.unitType || 'apartment',
    floor: parseInt(u.floor) || 0,
    area: parseFloat(u.area) || 0,
    direction: u.direction || '',
    model: u.model || '',
    status: u.status || 'available',
    reserved_by: reserved ? (u.reservedBy || '') : '',
    reserved_phone: reserved ? (u.reservedPhone || '') : '',
    reserved_amount: reserved ? (parseFloat(u.reservedAmount) || 0) : 0,
    reserved_date: reserved && u.reservedDate ? u.reservedDate : null,
    sale_id: u.saleId || null,
    notes: u.notes || ''
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
    files: Array.isArray(e.files) ? e.files : [],
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
    paymentMode: s.payment_mode || 'free',
    installmentsCount: s.installments_count || 0,
    notes: s.notes,
    notesCrm: s.notes_crm || '',
    payments: s.payments || [],
    files: Array.isArray(s.files) ? s.files : [],
    createdAt: s.created_at
  };
}

function mapPayment(row) {
  return {
    id: row.id,
    saleId: row.sale_id,
    amount: parseFloat(row.amount),
    date: row.date,
    dueDate: row.due_date,
    notes: row.notes || '',
    createdAt: row.created_at
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
// LOCAL DATE HELPERS — تاريخ اليوم بتوقيت الجهاز (مش UTC)
// ============================================================
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ============================================================
// LEDGER — حساب موحّد للدفعات
// كل دفعة (من جدول payments) تُخصم تلقائياً من الأقساط، الأقدم استحقاقاً أولاً.
// الدفعات القديمة المسجلة على قسط بعينه تبقى على قسطها.
// الحساب في الذاكرة فقط — لا يغيّر أي شيء في قاعدة البيانات.
// ============================================================
function applyLedger(sale) {
  const insts = sale.payments || [];
  insts.forEach(inst => {
    const pps = Array.isArray(inst.partialPayments) ? inst.partialPayments : [];
    inst.pinnedPaid = pps.length > 0
      ? pps.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
      : (parseFloat(inst.paidAmount) || 0);
    inst.paidAmount = inst.pinnedPaid;
  });

  const order = insts.map((inst, idx) => ({ inst, idx }))
    .sort((x, y) => (x.inst.dueDate || '') < (y.inst.dueDate || '') ? -1 : (x.inst.dueDate || '') > (y.inst.dueDate || '') ? 1 : x.idx - y.idx);

  const free = freePayments.filter(p => p.saleId === sale.id)
    .slice().sort((x, y) => (x.date || '') < (y.date || '') ? -1 : (x.date || '') > (y.date || '') ? 1 : 0);

  const allocs = {};
  let credit = 0;
  for (const p of free) {
    let left = p.amount;
    allocs[p.id] = [];
    for (const { inst } of order) {
      if (left <= 0.005) break;
      const room = (parseFloat(inst.totalAmount) || 0) - inst.paidAmount;
      if (room <= 0.005) continue;
      const take = Math.min(room, left);
      inst.paidAmount += take;
      left -= take;
      allocs[p.id].push({ label: inst.label || 'قسط', amount: take, closes: room - take <= 0.005 });
    }
    if (left > 0.005) { credit += left; allocs[p.id].push({ label: null, amount: left }); }
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  let overdueAmount = 0, overdueCount = 0;
  insts.forEach(inst => {
    const total = parseFloat(inst.totalAmount) || 0;
    inst.remainingAmount = Math.max(total - inst.paidAmount, 0);
    inst.status = inst.remainingAmount <= 0.005 ? 'paid' : inst.paidAmount > 0.005 ? 'partial' : 'pending';
    if (inst.status === 'paid') inst.remainingAmount = 0;
    if (inst.status !== 'paid' && inst.dueDate) {
      const due = new Date(inst.dueDate); due.setHours(0, 0, 0, 0);
      if (due < today) { overdueAmount += inst.remainingAmount; overdueCount++; }
    }
  });

  sale.ledger = { allocs, credit, overdueAmount, overdueCount };
}

// نص يوضح أين ذهبت الدفعة
function describeAllocation(parts) {
  if (!parts || parts.length === 0) return '';
  return parts.map(x => x.label === null
    ? `رصيد زائد (${formatCurrency(x.amount)})`
    : `${x.closes ? 'أقفلت' : 'جزء من'} ${x.label} (${formatCurrency(x.amount)})`).join(' + ');
}

function addMonthsStr(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(y, m - 1 + months, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

// ============================================================
// WHATSAPP — تذكير بالقسط (يفتح واتساب برسالة جاهزة، والإرسال يدوي)
// ============================================================
// رقم مصري → صيغة دولية بدون + (مثال: 01012345678 → 201012345678)
function waPhone(phone) {
  let d = String(phone || '').replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('01')) return '2' + d;
  if (d.length === 10 && d.startsWith('1')) return '20' + d;
  if (d.length >= 11 && d.startsWith('20')) return d;
  return d.length >= 10 ? d : null;
}

// الاسم الثنائي: أول اسمين، مع اعتبار "عبد الله" و"أبو بكر" وأمثالها اسماً واحداً
function shortName(fullName) {
  const joiners = ['عبد', 'أبو', 'ابو', 'أم', 'ام', 'بن', 'ابن', 'آل', 'ال'];
  const words = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  const names = [];
  for (let i = 0; i < words.length && names.length < 2; i++) {
    if (joiners.includes(words[i]) && words[i + 1]) { names.push(words[i] + ' ' + words[i + 1]); i++; }
    else names.push(words[i]);
  }
  return names.join(' ');
}

function waReminderText(sale, inst) {
  const project = projects.find(p => p.id === sale.projectId);
  const amount = inst.remainingAmount || inst.totalAmount || 0;
  const amountStr = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
  const unit = sale.unitNumber ? ` ${sale.unitType === 'shop' ? 'لمحل' : 'لوحدة'} ${sale.unitNumber}` : '';
  const proj = project?.projectName ? ` بمشروع ${project.projectName}` : '';
  const label = (inst.label || '').trim();
  const what = !label ? 'القسط' : label.includes('قسط') ? label : `قسط ${label}`;
  return `السلام عليكم أ/ ${shortName(sale.customerName)}، نذكّر حضرتك بموعد ${what}${unit}${proj}، المبلغ المستحق ${amountStr} ج.م بتاريخ ${formatDate(inst.dueDate)}. شكرًا لتعاونكم.`.replace(/\s+/g, ' ');
}

function waButton(sale, instIdx, cls = 'btn-xs') {
  const inst = (sale.payments || [])[instIdx];
  if (!inst) return '';
  const phone = waPhone(sale.customerPhone);
  if (!phone) return `<button type="button" class="btn btn-wa ${cls}" style="opacity:.5" onclick="showToast('لا يوجد رقم هاتف صحيح لهذا العميل', 'warning')">واتساب</button>`;
  return `<a class="btn btn-wa ${cls}" target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${encodeURIComponent(waReminderText(sale, inst))}">واتساب</a>`;
}

// ============================================================
// CONFIRM DANGER — تأكيد قبل الحذف (مع كتابة نص للتأكيد عند وجود بيانات)
// ============================================================
function getSalePaymentCount(sale) {
  let n = getFreePaymentsForSale(sale.id).length;
  (sale.payments || []).forEach(inst => { n += (inst.partialPayments || []).length; });
  return n;
}

function confirmDanger({ title, lines = [], requireText = '', confirmLabel = 'حذف' }) {
  return new Promise(resolve => {
    document.getElementById('confirm-danger')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'confirm-danger';
    wrap.className = 'modal active';
    wrap.style.zIndex = '3000';
    wrap.innerHTML = `
      <div class="modal-box confirm-box">
        <div class="confirm-title">⚠️ ${title}</div>
        ${lines.map(l => `<div class="confirm-line">${l}</div>`).join('')}
        ${requireText ? `
          <div class="confirm-line" style="margin-top:.9rem">للتأكيد اكتب: <b class="confirm-word"></b></div>
          <input type="text" class="form-control" id="confirm-danger-input" autocomplete="off" style="width:100%;margin-top:.4rem">` : ''}
        <div style="display:flex;gap:.6rem;margin-top:1.25rem">
          <button class="btn btn-danger" id="confirm-danger-ok" style="flex:1;justify-content:center" ${requireText ? 'disabled' : ''}>${confirmLabel}</button>
          <button class="btn btn-ghost" id="confirm-danger-cancel" style="flex:1;justify-content:center">إلغاء</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const okBtn = wrap.querySelector('#confirm-danger-ok');
    const input = wrap.querySelector('#confirm-danger-input');
    if (requireText) {
      wrap.querySelector('.confirm-word').textContent = requireText;
      const norm = s => String(s).trim().replace(/\s+/g, ' ');
      input.addEventListener('input', () => {
        const match = norm(input.value) === norm(requireText);
        okBtn.disabled = !match;
        okBtn.style.opacity = match ? '1' : '.45';
      });
      okBtn.style.opacity = '.45';
    }
    const done = v => { wrap.remove(); resolve(v); };
    okBtn.onclick = () => { if (!okBtn.disabled) done(true); };
    wrap.querySelector('#confirm-danger-cancel').onclick = () => done(false);
    wrap.addEventListener('click', e => { if (e.target === wrap) done(false); });
  });
}

// ============================================================
// GLOBAL STATE
// ============================================================
let projects = [];
let sales = [];
let freePayments = [];
let allExpenses = [];
let units = [];

// ============================================================
// INIT
// ============================================================
let appStarted = false;
async function startApp() {
  if (appStarted) return;
  appStarted = true;
  showLoading();

  // Default dates
  const today = todayStr();
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

  document.addEventListener('click', e => {
    const wrap = document.getElementById('global-search-wrap');
    if (wrap && !wrap.contains(e.target)) closeGlobalSearch();
  });
}

// ============================================================
// AUTH — تسجيل الدخول (Supabase Auth)
// لا يتم تحميل أي بيانات قبل وجود جلسة دخول صالحة
// ============================================================
function showAuthScreen(mode) {
  const subs = {
    login: 'سجّل الدخول للمتابعة',
    forgot: 'اكتب بريدك وسنرسل لك رابط تغيير كلمة السر',
    newpass: 'اكتب كلمة السر الجديدة'
  };
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('auth-sub').textContent = subs[mode] || '';
  ['login', 'forgot', 'newpass'].forEach(m => {
    document.getElementById(`auth-${m}-form`).style.display = m === mode ? 'flex' : 'none';
  });
  setAuthMsg('');
}

function hideAuthScreen() {
  document.getElementById('auth-screen').classList.add('hidden');
}

function setAuthMsg(text, type = 'error') {
  const el = document.getElementById('auth-msg');
  el.textContent = text;
  el.className = 'auth-msg' + (text ? ' ' + type : '');
}

function setAuthBusy(btnId, busy, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy ? 'لحظة...' : label;
}

async function authLogin(event) {
  event.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  setAuthMsg('');
  setAuthBusy('auth-login-btn', true);
  const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
  setAuthBusy('auth-login-btn', false, 'دخول');
  if (error) {
    console.error(error);
    setAuthMsg(error.message === 'Invalid login credentials'
      ? 'البريد أو كلمة السر غير صحيحة'
      : 'تعذر تسجيل الدخول — تأكد من الاتصال وحاول مرة أخرى');
    return;
  }
  document.getElementById('auth-password').value = '';
  hideAuthScreen();
  startApp();
}

async function authSendReset(event) {
  event.preventDefault();
  const email = document.getElementById('auth-forgot-email').value.trim();
  setAuthMsg('');
  setAuthBusy('auth-forgot-btn', true);
  const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + location.pathname
  });
  setAuthBusy('auth-forgot-btn', false, 'إرسال رابط تغيير كلمة السر');
  if (error) {
    console.error(error);
    setAuthMsg('تعذر إرسال الرابط — حاول مرة أخرى بعد قليل');
    return;
  }
  setAuthMsg('لو البريد مسجّل، هيوصلك رابط تغيير كلمة السر خلال دقائق', 'ok');
}

async function authSetNewPassword(event) {
  event.preventDefault();
  const p1 = document.getElementById('auth-newpass').value;
  const p2 = document.getElementById('auth-newpass2').value;
  if (p1 !== p2) { setAuthMsg('كلمتا السر غير متطابقتين'); return; }
  setAuthMsg('');
  setAuthBusy('auth-newpass-btn', true);
  const { error } = await window.supabaseClient.auth.updateUser({ password: p1 });
  setAuthBusy('auth-newpass-btn', false, 'حفظ كلمة السر');
  if (error) {
    console.error(error);
    setAuthMsg('تعذر حفظ كلمة السر — الرابط قد يكون منتهي، اطلب رابط جديد');
    return;
  }
  window.__authRecovery = false;
  history.replaceState(null, '', location.pathname);
  hideAuthScreen();
  showToast('تم تغيير كلمة السر');
  startApp();
}

async function authLogout() {
  if (!confirm('تسجيل الخروج؟')) return;
  await window.supabaseClient.auth.signOut();
  location.reload();
}

document.addEventListener('DOMContentLoaded', async () => {
  DB.init();
  const sb = window.supabaseClient;
  if (!sb) { showAuthScreen('login'); setAuthMsg('خطأ في الاتصال بقاعدة البيانات'); return; }

  sb.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') { window.__authRecovery = true; showAuthScreen('newpass'); }
  });

  const { data, error } = await sb.auth.getSession();
  if (window.__authRecovery) { showAuthScreen('newpass'); return; }
  if (error || !data?.session) { showAuthScreen('login'); return; }
  hideAuthScreen();
  startApp();
});

async function loadData() {
  try {
    [projects, sales, freePayments, allExpenses, units] = await Promise.all([DB.getProjects(), DB.getSales(), DB.getPayments(), DB.getAllExpenses(), DB.getUnits()]);
    sales.forEach(applyLedger);
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
  // لا داعي لطلب إضافي من قاعدة البيانات لو مفيش بيانات بالصيغة القديمة
  if (!sales.some(s => isOldPaymentFormat(s.payments))) return;
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
    success: '#0b5563',
    error: '#d6453d',
    warning: '#f39c12',
    info: '#2980b9'
  };

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${colors[type]}; color: white;
    padding: 0.875rem 1.5rem; border-radius: 12px;
    font-family: 'Readex Pro', sans-serif; font-size: 1rem; font-weight: 600;
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
    font-family:'Readex Pro',sans-serif;
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
  document.querySelectorAll('.nav-btn, .bnav-btn').forEach(t => t.classList.toggle('active', t.dataset.view === viewName));
  document.getElementById(`${viewName}-view`).classList.add('active');
  window.scrollTo(0, 0);

  if (viewName === 'dashboard') { updateDashboard(); checkOverdueInstallments(); }
  if (viewName === 'projects') renderProjects();
  if (viewName === 'sales') renderSales();
  if (viewName === 'reports') renderUnifiedReport();
  if (viewName === 'expenses') renderExpensesPage();
}

// ============================================================
// GLOBAL QUICK SEARCH (NEW)
// ============================================================
function handleGlobalSearch() {
  const input = document.getElementById('global-search-input');
  const resultsEl = document.getElementById('global-search-results');
  if (!input || !resultsEl) return;

  const q = input.value.trim().toLowerCase();
  if (!q) { closeGlobalSearch(); return; }

  const matches = sales.filter(sale => {
    const project = projects.find(p => p.id === sale.projectId);
    const haystack = `${sale.customerName} ${sale.unitNumber || ''} ${sale.customerPhone || ''} ${project?.projectName || ''}`.toLowerCase();
    return haystack.includes(q);
  }).slice(0, 15);

  resultsEl.innerHTML = matches.length === 0
    ? `<div class="gsr-empty">لا توجد نتائج</div>`
    : matches.map(sale => {
        const project = projects.find(p => p.id === sale.projectId);
        const remaining = sale.totalPrice - getCombinedTotalPaid(sale);
        return `
          <div class="gsr-item" onclick="selectGlobalSearchResult('${sale.id}')">
            <div>
              <div style="font-weight:700;color:var(--primary)">${sale.customerName}</div>
              <div style="font-size:.78rem;color:var(--text-muted)">🏠 ${sale.unitNumber || '—'} &nbsp;|&nbsp; 🏢 ${project?.projectName || '—'}</div>
            </div>
            <div style="font-weight:700;white-space:nowrap;color:${remaining > 0 ? 'var(--danger)' : 'var(--success)'}">${formatCurrency(remaining)} ج.م</div>
          </div>`;
      }).join('');

  resultsEl.classList.add('active');
}

function selectGlobalSearchResult(saleId) {
  closeGlobalSearch();
  const input = document.getElementById('global-search-input');
  if (input) input.value = '';
  showView('sales');
  showSaleInstallments(saleId);
}

function closeGlobalSearch() {
  const resultsEl = document.getElementById('global-search-results');
  if (resultsEl) { resultsEl.classList.remove('active'); resultsEl.innerHTML = ''; }
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
  totalPaid = sales.reduce((s, sale) => s + getCombinedTotalPaid(sale), 0);
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

  // مقارنة المشاريع
  renderProjectsComparison();

  // التنبيهات
  renderPaymentAlerts();

  // لوحة الأقساط القادمة
  renderUpcomingInstallments();
}

// ============================================================
// مقارنة المشاريع (NEW — موحّدة لكل المشاريع)
// ============================================================
let chartProjectsComparison = null;

async function renderProjectsComparison() {
  const grid = document.getElementById('projects-comparison-grid');
  if (!grid) return;

  const cards = [];
  const labels = [], revenueData = [], expensesData = [], profitData = [];

  for (const p of projects) {
    const projectSales = sales.filter(s => s.projectId === p.id);
    const totalUnits = (p.apartmentsCount || 0) + (p.shopsCount || 0);
    const sold = projectSales.length;
    const available = Math.max(totalUnits - sold, 0);
    const expectedRev = projectSales.reduce((s, sale) => s + sale.totalPrice, 0);
    const collected = projectSales.reduce((s, sale) => s + getCombinedTotalPaid(sale), 0);
    const costs = await calculateProjectCosts(p.id);
    const profit = collected - costs;

    labels.push(p.projectName.length > 14 ? p.projectName.slice(0, 14) + '…' : p.projectName);
    revenueData.push(expectedRev);
    expensesData.push(costs);
    profitData.push(profit);

    cards.push(`
      <div class="proj-card" onclick="showProjectDetails('${p.id}')">
        <div class="proj-bar"></div>
        <div class="proj-body">
          <div class="proj-name">${p.projectName}</div>
          <div class="proj-stats-grid">
            <div class="proj-stat"><div class="proj-stat-val">${totalUnits}</div><div class="proj-stat-lbl">إجمالي الوحدات</div></div>
            <div class="proj-stat"><div class="proj-stat-val">${sold}</div><div class="proj-stat-lbl">مباعة</div></div>
            <div class="proj-stat"><div class="proj-stat-val">${available}</div><div class="proj-stat-lbl">متاحة</div></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:.3rem;font-size:.82rem;margin-top:.65rem">
            <div>إجمالي الإيرادات: <strong style="color:var(--info)">${formatCurrency(expectedRev)} ج.م</strong></div>
            <div>إجمالي المحصّل: <strong style="color:var(--gold)">${formatCurrency(collected)} ج.م</strong></div>
            <div>إجمالي المصاريف: <strong style="color:var(--danger)">${formatCurrency(costs)} ج.م</strong></div>
            <div>صافي الربح: <strong style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(profit)} ج.م</strong></div>
          </div>
        </div>
      </div>`);
  }

  grid.innerHTML = cards.length === 0
    ? `<div class="empty"><div class="empty-icon">🏢</div><p>لا توجد مشاريع بعد</p></div>`
    : cards.join('');

  const ctx = document.getElementById('chart-projects-comparison');
  if (ctx) {
    if (chartProjectsComparison) chartProjectsComparison.destroy();
    chartProjectsComparison = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'الإيرادات', data: revenueData, backgroundColor: 'rgba(36,113,163,0.8)', borderRadius: 6 },
          { label: 'المصاريف', data: expensesData, backgroundColor: 'rgba(192,57,43,0.75)', borderRadius: 6 },
          { label: 'صافي الربح', data: profitData, backgroundColor: 'rgba(201,152,42,0.85)', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Readex Pro', size: 11 }, boxWidth: 14 } } },
        scales: {
          x: { ticks: { font: { family: 'Readex Pro', size: 10 } } },
          y: { ticks: { font: { family: 'Readex Pro', size: 10 }, callback: v => (v / 1000) + 'k' } }
        }
      }
    });
  }
}

// ============================================================
// UPCOMING INSTALLMENTS PANEL
// ============================================================
function renderUpcomingInstallments() {
  const container = document.getElementById('upcoming-installments-list');
  if (!container) return;

  const daysVal = parseInt(document.getElementById('upcoming-days-filter')?.value ?? '30');
  const today = new Date(); today.setHours(0,0,0,0);
  const cutoff = new Date(today);
  if (daysVal > 0) cutoff.setDate(cutoff.getDate() + daysVal);

  // جمع الأقساط
  const items = [];
  for (const sale of sales) {
    const project = projects.find(p => p.id === sale.projectId);
    (sale.payments || []).forEach((inst, idx) => {
      if (inst.status === 'paid') return;
      const due = new Date(inst.dueDate); due.setHours(0,0,0,0);
      const isOverdue = due < today;
      const isUpcoming = daysVal === 0 ? false : (due >= today && due <= cutoff);
      if (!isOverdue && !isUpcoming) return;

      const daysLeft = Math.round((due - today) / 86400000);
      items.push({ sale, project, inst, idx, due, isOverdue, daysLeft });
    });
  }

  // ترتيب: المتأخرة أولاً ثم الأقرب
  items.sort((a, b) => a.due - b.due);

  if (items.length === 0) {
    container.innerHTML = `<div class="empty" style="padding:2rem">
      <div class="empty-icon">✅</div>
      <p>${daysVal === 0 ? 'لا توجد أقساط متأخرة' : `لا توجد أقساط خلال ${daysVal} يوم`}</p>
    </div>`;
    return;
  }

  container.innerHTML = `
    <table class="ur-table">
      <thead><tr><th>العميل</th><th>المشروع</th><th>القسط</th><th>الاستحقاق</th><th>المبلغ</th><th>الحالة</th><th>إجراء</th></tr></thead>
      <tbody>
        ${items.map(item => {
          const daysLabel = item.isOverdue
            ? `<span class="badge badge-red">متأخر ${Math.abs(item.daysLeft)} يوم</span>`
            : item.daysLeft === 0
            ? `<span class="badge badge-orange">اليوم!</span>`
            : item.daysLeft <= 3
            ? `<span class="badge badge-orange">بعد ${item.daysLeft} أيام</span>`
            : `<span class="badge badge-blue">بعد ${item.daysLeft} يوم</span>`;
          const statusLabel = item.inst.status === 'partial'
            ? `<span class="badge badge-orange">جزئي</span>`
            : `<span class="badge badge-red">لم يُدفع</span>`;

          return `<tr${item.isOverdue ? ' style="background:#fff0ee"' : ''}>
            <td class="ur-head">${item.sale.customerName}${item.sale.notesCrm ? ` <span style="font-size:.75rem;color:#7a5c0a;font-weight:400">📌 ${item.sale.notesCrm}</span>` : ''}</td>
            <td data-l="المشروع">${item.project?.projectName || '—'}</td>
            <td data-l="القسط">${item.inst.label || '—'}</td>
            <td data-l="الاستحقاق"><span>${formatDate(item.inst.dueDate)} ${daysLabel}</span></td>
            <td data-l="المبلغ" class="ur-num" style="color:var(--gold)">${formatCurrency(item.inst.remainingAmount || item.inst.totalAmount)} ج.م</td>
            <td data-l="الحالة">${statusLabel}</td>
            <td data-l="إجراء"><span style="display:inline-flex;gap:.3rem">
              <button class="btn btn-primary btn-xs" onclick="showSaleInstallments('${item.sale.id}')">📋 فتح</button>
              ${waButton(item.sale, item.idx)}</span>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="font-size:.82rem;color:var(--text-muted);margin-top:.75rem;text-align:left">
      إجمالي: <strong>${items.length} قسط</strong> —
      متأخرة: <strong style="color:var(--danger)">${items.filter(i => i.isOverdue).length}</strong> —
      قادمة: <strong style="color:var(--info)">${items.filter(i => !i.isOverdue).length}</strong>
    </div>`;
}

// ============================================================
// DASHBOARD ALERTS (NEW) — عاجل / تنبيه / مكتمل
// ============================================================
function quickAddPayment(saleId) {
  showSaleInstallments(saleId, true);
}

function renderPaymentAlerts() {
  const container = document.getElementById('alerts-content');
  if (!container) return;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const currentMonthKey = todayStr().slice(0, 7);

  const urgent = [], warning = [], complete = [];

  for (const sale of sales) {
    const project = projects.find(p => p.id === sale.projectId);
    const remaining = sale.totalPrice - getCombinedTotalPaid(sale);
    const lastPaymentDate = getLastPaymentDate(sale);
    const refDateStr = lastPaymentDate || sale.saleDate;
    const refDate = new Date(refDateStr); refDate.setHours(0, 0, 0, 0);
    const daysSince = Math.floor((today - refDate) / 86400000);

    const item = { sale, project, remaining, lastPaymentDate };

    if (remaining <= 0.01) {
      complete.push(item);
    } else if (daysSince > 30) {
      urgent.push(item);
    } else {
      const paidThisMonth = lastPaymentDate && lastPaymentDate.slice(0, 7) === currentMonthKey;
      if (!paidThisMonth) warning.push(item);
    }
  }

  const byOldestPayment = (a, b) => (a.lastPaymentDate || a.sale.saleDate) < (b.lastPaymentDate || b.sale.saleDate) ? -1 : 1;
  urgent.sort(byOldestPayment);
  warning.sort(byOldestPayment);

  const row = item => `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.75rem;background:var(--bg-subtle);border-radius:var(--radius-sm);padding:.75rem 1rem;margin-bottom:.5rem">
      <div>
        <div style="font-weight:700;color:var(--primary)">${item.sale.customerName}</div>
        <div style="font-size:.8rem;color:var(--text-muted)">${item.project?.projectName || '—'} — ${item.sale.unitType === 'apartment' ? '🏠' : '🏪'} ${item.sale.unitNumber || ''}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:.78rem;color:var(--text-muted)">المتبقي</div>
        <div style="font-weight:700;color:var(--danger)">${formatCurrency(item.remaining)} ج.م</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:.78rem;color:var(--text-muted)">آخر دفعة</div>
        <div style="font-weight:600">${item.lastPaymentDate ? formatDate(item.lastPaymentDate) : 'لا يوجد'}</div>
      </div>
      <button class="btn btn-gold btn-xs" onclick="quickAddPayment('${item.sale.id}')">➕ إضافة دفعة</button>
    </div>`;

  const section = (title, items, badgeClass, openByDefault) => `
    <details ${openByDefault ? 'open' : ''} style="margin-bottom:1rem">
      <summary style="cursor:pointer;font-weight:700;color:var(--primary);margin-bottom:.5rem">
        ${title} <span class="badge badge-${badgeClass}">${items.length}</span>
      </summary>
      <div style="margin-top:.5rem">
        ${items.length === 0 ? `<div class="empty" style="padding:1rem"><p>لا يوجد</p></div>` : items.map(row).join('')}
      </div>
    </details>`;

  container.innerHTML =
    section('🔴 عاجل — لا توجد دفعة منذ أكثر من 30 يوم', urgent, 'red', urgent.length > 0) +
    section('🟡 تنبيه — لا توجد دفعة هذا الشهر', warning, 'gold', warning.length > 0) +
    section('🟢 مكتمل — مسدد بالكامل', complete, 'green', false);
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
  document.querySelectorAll('.overdue-badge').forEach(badge => {
    badge.textContent = overdueCount;
    badge.style.display = overdueCount > 0 ? 'inline-flex' : 'none';
  });

  // Show alert card on dashboard
  const alertCard = document.getElementById('overdue-alert-card');
  if (alertCard) {
    if (overdueCount > 0) {
      alertCard.style.display = 'flex';
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
          <button class="btn btn-primary btn-xs" onclick="openUnitsModal('${p.id}')">🏠 الوحدات${units.filter(u => u.projectId === p.id).length ? ` (${units.filter(u => u.projectId === p.id).length})` : ''}</button>
          <button class="btn btn-gold btn-xs" onclick="openEditProjectModal('${p.id}')">✏️ تعديل</button>
          <button class="btn btn-pdf btn-xs" onclick="exportProjectPDF('${p.id}')">📄 PDF</button>
          <button class="btn btn-danger btn-xs" onclick="deleteProject('${p.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
}

// ============================================================
// SALES RENDERING + SEARCH/FILTER
// ============================================================
function renderSales(filteredList = null) {
  const container = document.getElementById('sales-list');
  if (!container) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const list = filteredList !== null ? filteredList : sales;

  if (list.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">💰</div><p>${sales.length === 0 ? 'لا توجد مبيعات بعد' : 'لا توجد نتائج للبحث'}</p></div>`;
    return;
  }

  container.innerHTML = list.map(sale => {
    const project = projects.find(p => p.id === sale.projectId);
    const totalPaid = getCombinedTotalPaid(sale);
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
            ${sale.notesCrm ? `<div style="margin-top:.35rem;background:#fdf3dc;border-radius:6px;padding:.3rem .7rem;font-size:.8rem;color:#7a5c0a;display:inline-block">📌 ${sale.notesCrm}</div>` : ''}
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
            ${sale.ledger?.overdueAmount > 0.01 ? `<div style="font-size:.82rem;font-weight:700;color:var(--danger)">متأخر: ${formatCurrency(sale.ledger.overdueAmount)} ج.م</div>` : ''}
          </div>
        </div>
        <div class="sale-actions">
          <button class="btn btn-primary btn-sm" onclick="showSaleInstallments('${sale.id}')">📋 الحساب والأقساط</button>
          <button class="btn btn-gold btn-sm" onclick="quickAddPayment('${sale.id}')">➕ إضافة دفعة</button>
          <details class="more-menu">
            <summary class="btn btn-ghost btn-sm">⋯ المزيد</summary>
            <div class="more-menu-list">
              <button class="btn btn-ghost btn-sm" onclick="openSaleFilesModal('${sale.id}')">📎 ملفات (${(sale.files||[]).length})</button>
              <button class="btn btn-ghost btn-sm" onclick="exportClientPDF('${sale.id}')">📄 كشف حساب</button>
              <button class="btn btn-ghost btn-sm" onclick="printClientPage('${sale.id}')">🖨️ طباعة بيانات</button>
              <button class="btn btn-ghost btn-sm" onclick="openEditSaleModal('${sale.id}')">✏️ تعديل</button>
              <button class="btn btn-danger btn-sm" onclick="deleteSale('${sale.id}')">🗑️ حذف</button>
            </div>
          </details>
        </div>
      </div>`;
  }).join('');
}

// ── بحث وفلترة ────────────────────────────────────────────
function filterSales() {
  const searchVal = document.getElementById('search-input')?.value?.toLowerCase().trim() || '';
  const projectVal = document.getElementById('filter-project')?.value || '';
  const statusVal  = document.getElementById('filter-status')?.value || '';
  const today = new Date(); today.setHours(0,0,0,0);

  let filtered = sales.filter(sale => {
    // بحث نصي
    if (searchVal) {
      const haystack = `${sale.customerName} ${sale.customerPhone || ''} ${sale.unitNumber || ''} ${sale.notesCrm || ''}`.toLowerCase();
      if (!haystack.includes(searchVal)) return false;
    }
    // فلتر المشروع
    if (projectVal && sale.projectId !== projectVal) return false;
    // فلتر الحالة
    if (statusVal) {
      const totalPaid = getCombinedTotalPaid(sale);
      const remaining = sale.totalPrice - totalPaid;
      const hasOverdue = (sale.payments || []).some(inst => {
        if (inst.status !== 'paid') {
          const due = new Date(inst.dueDate); due.setHours(0,0,0,0);
          return due < today;
        }
        return false;
      });
      if (statusVal === 'paid'    && remaining > 0.01) return false;
      if (statusVal === 'partial' && (remaining <= 0.01 || hasOverdue || sale.paymentType === 'cash')) return false;
      if (statusVal === 'overdue' && !hasOverdue) return false;
      if (statusVal === 'cash'    && sale.paymentType !== 'cash') return false;
    }
    return true;
  });

  // عداد النتائج
  const countEl = document.getElementById('filter-count');
  if (countEl) countEl.textContent = (searchVal || projectVal || statusVal) ? `${filtered.length} من ${sales.length} نتيجة` : '';

  renderSales(filtered);
}

function clearFilters() {
  const s = document.getElementById('search-input');
  const p = document.getElementById('filter-project');
  const f = document.getElementById('filter-status');
  if (s) s.value = '';
  if (p) p.value = '';
  if (f) f.value = '';
  const countEl = document.getElementById('filter-count');
  if (countEl) countEl.textContent = '';
  renderSales();
}

function populateFilterProject() {
  const sel = document.getElementById('filter-project');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">كل المشاريع</option>';
  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.projectName;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

// ============================================================
// INSTALLMENTS MODAL (NEW)
// ============================================================
function showSaleInstallments(saleId, focusAdd = false) {
  const sale = sales.find(s => s.id === saleId);
  if (!sale) return;
  const project = projects.find(p => p.id === sale.projectId);
  const today = new Date(); today.setHours(0,0,0,0);
  const totalPaid = getCombinedTotalPaid(sale);
  const remaining = sale.totalPrice - totalPaid;
  const ledger = sale.ledger || { allocs: {}, credit: 0, overdueAmount: 0 };

  const modal = document.getElementById('installments-modal');
  const title = document.getElementById('installments-modal-title');
  const content = document.getElementById('installments-modal-content');

  title.textContent = `حساب — ${sale.customerName}`;

  const summaryHtml = `
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.9rem">
      <span class="badge badge-blue">${project?.projectName || '—'}</span>
      <span class="badge badge-green">${sale.unitType === 'apartment' ? '🏠 شقة' : '🏪 محل'} ${sale.unitNumber || ''}</span>
      ${sale.customerPhone ? `<span class="badge badge-gray">📞 ${sale.customerPhone}</span>` : ''}
    </div>
    <div class="ledger-summary">
      <div class="summary-card" style="padding:.8rem"><div class="summary-label">إجمالي السعر</div><div class="summary-value">${formatCurrency(sale.totalPrice)}</div></div>
      <div class="summary-card gold" style="padding:.8rem"><div class="summary-label">المدفوع</div><div class="summary-value">${formatCurrency(totalPaid)}</div></div>
      <div class="summary-card ${remaining > 0.01 ? 'danger' : ''}" style="padding:.8rem"><div class="summary-label">المتبقي</div><div class="summary-value">${formatCurrency(Math.max(remaining, 0))}</div></div>
      <div class="summary-card ${ledger.overdueAmount > 0.01 ? 'danger' : ''}" style="padding:.8rem"><div class="summary-label">المتأخر</div><div class="summary-value">${formatCurrency(ledger.overdueAmount)}</div></div>
    </div>
    ${ledger.credit > 0.01 ? `<div class="info-box">💡 للعميل رصيد زائد عن جدول الأقساط: <b>${formatCurrency(ledger.credit)} ج.م</b></div>` : ''}`;

  // ── إضافة دفعة (زر واحد) ──
  const nextInst = (sale.payments || [])
    .map((inst, idx) => ({ inst, idx }))
    .filter(x => x.inst.status !== 'paid')
    .sort((x, y) => (x.inst.dueDate || '') < (y.inst.dueDate || '') ? -1 : 1)[0]?.inst;
  const chips = [];
  if (nextInst) chips.push(`<button type="button" class="chip" onclick="document.getElementById('np-amount').value=${nextInst.remainingAmount}">${nextInst.label}: ${formatCurrency(nextInst.remainingAmount)}</button>`);
  if (ledger.overdueAmount > 0.01 && (!nextInst || Math.abs(ledger.overdueAmount - nextInst.remainingAmount) > 0.01))
    chips.push(`<button type="button" class="chip" onclick="document.getElementById('np-amount').value=${ledger.overdueAmount}">كل المتأخر: ${formatCurrency(ledger.overdueAmount)}</button>`);
  if (remaining > 0.01) chips.push(`<button type="button" class="chip" onclick="document.getElementById('np-amount').value=${remaining}">كل المتبقي: ${formatCurrency(remaining)}</button>`);

  const addHtml = remaining > 0.01 || (sale.payments || []).some(i => i.status !== 'paid') ? `
    <div class="add-pay-box">
      <div class="ledger-title" style="margin:0 0 .6rem">➕ إضافة دفعة</div>
      <div class="add-pay-grid">
        <input type="number" id="np-amount" class="form-control" placeholder="المبلغ (ج.م)" min="0" step="0.01" inputmode="decimal">
        <input type="date" id="np-date" class="form-control" value="${todayStr()}">
        <input type="text" id="np-notes" class="form-control" placeholder="ملاحظة (اختياري)">
        <button class="btn btn-primary" style="justify-content:center" onclick="submitNewPayment('${saleId}')">💾 حفظ الدفعة</button>
      </div>
      ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
      <div style="font-size:.78rem;color:var(--text-muted);margin-top:.5rem">الدفعة تُخصم تلقائياً من أقدم قسط غير مسدد، وتبقى مسجلة كدفعة مستقلة في السجل.</div>
    </div>` : `<div class="info-box" style="background:#e8f5ee;border-color:var(--success);color:#155a35">✅ العميل مسدد بالكامل</div>`;

  // ── جدول الأقساط ──
  const instHtml = (sale.payments || []).map((inst, idx) => {
    const due = new Date(inst.dueDate); due.setHours(0,0,0,0);
    const open = inst.status !== 'paid';
    const isOverdue = open && due < today;
    const isDueSoon = open && !isOverdue && (due - today) <= 7 * 86400000;

    let statusBadge;
    if (inst.status === 'paid') statusBadge = '<span class="badge badge-success">✅ مدفوع</span>';
    else if (isOverdue) statusBadge = `<span class="badge badge-danger">🔴 متأخر</span>`;
    else if (inst.status === 'partial') statusBadge = '<span class="badge badge-warning">⏳ جزئي</span>';
    else if (isDueSoon) statusBadge = '<span class="badge badge-warning">🟡 قريباً</span>';
    else statusBadge = '<span class="badge badge-info">⏳ قادم</span>';

    return `
      <div class="inst-row ${isOverdue ? 'overdue' : inst.status === 'paid' ? 'paid' : ''}">
        <div class="inst-row-main">
          <div>
            <div class="inst-label">${inst.label || `القسط ${idx + 1}`}</div>
            <div class="inst-date">📅 ${formatDate(inst.dueDate)}
              <label class="inst-date-edit" title="تعديل تاريخ الاستحقاق">✏️
                <input type="date" value="${inst.dueDate || ''}" onchange="editInstallmentDate('${saleId}', ${idx}, this.value)">
              </label>
            </div>
          </div>
          <div style="text-align:left">
            <div class="inst-amount">${formatCurrency(inst.totalAmount)}</div>
            ${statusBadge}
          </div>
        </div>
        ${inst.status === 'partial' ? `<div class="inst-progress">مدفوع ${formatCurrency(inst.paidAmount)} — <b style="color:var(--danger)">متبقي ${formatCurrency(inst.remainingAmount)}</b></div>` : ''}
        <div class="inst-files">
          ${isOverdue || isDueSoon ? waButton(sale, idx) : ''}
          <label class="inst-upload">📤 إيصال${(inst.files||[]).length ? ` (${inst.files.length})` : ''}
            <input type="file" accept="image/*,.pdf" style="display:none" onchange="uploadInstallmentFile(this, '${saleId}', ${idx})">
          </label>
          ${(inst.files||[]).map(f => `
            <span class="file-pill">
              <button type="button" onclick="openStoredFile('${f.path}')">${f.type === 'pdf' ? '📄' : '🖼️'} ${f.name}</button>
              <button type="button" class="x" onclick="deleteInstallmentFile('${saleId}', ${idx}, '${f.path}')">×</button>
            </span>`).join('')}
        </div>
      </div>`;
  }).join('');

  // ── سجل الدفعات (كل دفعة سطر مستقل) ──
  const log = [];
  (sale.payments || []).forEach((inst, idx) => (inst.partialPayments || []).forEach(pp => log.push({
    date: pp.date, amount: parseFloat(pp.amount) || 0, note: pp.note || '',
    where: `على ${inst.label || 'قسط'}`,
    del: pp.id ? `removePartialPayment('${saleId}', ${idx}, '${pp.id}')` : ''
  })));
  getFreePaymentsForSale(saleId).forEach(p => log.push({
    date: p.date, amount: p.amount, note: p.notes || '',
    where: describeAllocation(ledger.allocs[p.id]),
    del: `deleteFreePayment('${p.id}','${saleId}')`
  }));
  log.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));

  const logHtml = log.length === 0
    ? `<div class="empty" style="padding:1.5rem"><p>لا توجد دفعات مسجلة بعد</p></div>`
    : log.map(e => `
      <div class="pay-row">
        <div style="min-width:0">
          <div><span class="pay-amount">+${formatCurrency(e.amount)}</span> <span class="pay-date">${formatDate(e.date)}</span></div>
          ${e.where ? `<div class="pay-where">${e.where}</div>` : ''}
          ${e.note ? `<div class="pay-where">📝 ${e.note}</div>` : ''}
        </div>
        ${e.del ? `<button class="btn btn-danger btn-xs" onclick="${e.del}">🗑️</button>` : ''}
      </div>`).join('');

  content.innerHTML = summaryHtml + addHtml +
    `<div class="ledger-title">📋 جدول الأقساط (${(sale.payments || []).length})</div>` +
    (instHtml || `<div class="empty" style="padding:1.5rem"><p>لا يوجد جدول أقساط لهذه البيعة</p></div>`) +
    `<div class="ledger-title">🧾 سجل الدفعات (${log.length})</div>` + logHtml;

  modal.classList.add('active');
  if (focusAdd) setTimeout(() => document.getElementById('np-amount')?.focus(), 100);
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
    date: todayStr(),
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
function editInstallmentDate(saleId, installmentIndex, newDate) {
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
  ['gen-count', 'gen-start'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  populateSaleUnitPicker();
  document.querySelector('#add-sale-modal input[name="saleDate"]').value = todayStr();
  document.getElementById('installment-fields').style.display = 'none';
  document.getElementById('add-sale-modal').classList.add('active');
}

function toggleInstallmentFields() {
  const type = event.target.value;
  document.getElementById('installment-fields').style.display = type === 'installment' ? 'block' : 'none';
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
    container.innerHTML = `<div style="text-align:center;color:var(--text-secondary);padding:1rem">استخدم "توليد الجدول" أو "إضافة قسط" — أو اتركه فارغاً لو البيعة بمقدم ودفعات بدون جدول</div>`;
    updateInstallmentsSummary();
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

// ── توليد جدول الأقساط تلقائياً ───────────────────────────
function generateInstallments() {
  const form = document.getElementById('add-sale-form');
  const totalPrice = parseFloat(form.querySelector('[name="totalPrice"]').value) || 0;
  const downPayment = parseFloat(form.querySelector('[name="downPayment"]').value) || 0;
  const saleDate = form.querySelector('[name="saleDate"]').value || todayStr();
  const count = parseInt(document.getElementById('gen-count').value);
  const every = parseInt(document.getElementById('gen-every').value) || 1;
  let start = document.getElementById('gen-start').value;

  if (!totalPrice) { showToast('اكتب إجمالي السعر أولاً', 'warning'); return; }
  if (!count || count < 1 || count > 240) { showToast('اكتب عدد الأقساط', 'warning'); return; }
  const rest = Math.round((totalPrice - downPayment) * 100) / 100;
  if (rest <= 0) { showToast('المقدم يغطي السعر كله — لا يوجد مبلغ للتقسيط', 'warning'); return; }
  if (installmentRows.some(r => r.amount || r.dueDate) && !confirm('سيتم استبدال الأقساط المكتوبة حالياً. متابعة؟')) return;
  // لو تاريخ أول قسط فاضي: الأقساط تبدأ بعد تاريخ البيع بفترة واحدة، وعلى نفس يوم الشهر
  const anchor = start || saleDate, offset = start ? 0 : 1;
  if (!start) document.getElementById('gen-start').value = addMonthsStr(saleDate, every);

  const base = Math.floor(rest / count);
  installmentRows = [];
  for (let i = 0; i < count; i++) {
    const amount = i === count - 1 ? Math.round((rest - base * (count - 1)) * 100) / 100 : base;
    installmentRows.push({ label: `القسط ${i + 1}`, amount: String(amount), dueDate: addMonthsStr(anchor, (i + offset) * every) });
  }
  renderInstallmentRows();
  showToast(`تم توليد ${count} قسط — راجع الجدول قبل الحفظ`, 'info');
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
  const pSales = sales.filter(s => s.projectId === projectId);
  const pExpenses = await DB.getProjectExpenses(projectId);
  const collected = pSales.reduce((s, sale) => s + getCombinedTotalPaid(sale), 0);
  const expTotal = pExpenses.reduce((s, e) => s + e.amount, 0);
  const hasData = pSales.length > 0 || pExpenses.length > 0;
  const ok1 = await confirmDanger({
    title: `حذف مشروع "${project.projectName}"`,
    lines: hasData ? [
      `سيتم حذف <b>${pSales.length}</b> عملية بيع (محصّل منها ${formatCurrency(collected)} ج.م) مع كل دفعاتها وأقساطها.`,
      `سيتم حذف <b>${pExpenses.length}</b> مصروف بإجمالي ${formatCurrency(expTotal)} ج.م.`,
      'لا يمكن التراجع عن الحذف.'
    ] : ['المشروع لا يحتوي على مبيعات أو مصروفات.'],
    requireText: hasData ? project.projectName : '',
    confirmLabel: 'حذف المشروع'
  });
  if (!ok1) return;
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
    for (const r of installmentRows) {
      if (!r.amount || !r.dueDate) { showToast('تأكد من إدخال المبلغ والتاريخ لكل قسط', 'warning'); return; }
    }
    const totalPrice = parseFloat(fd.get('totalPrice')) || 0;
    const downPayment = parseFloat(fd.get('downPayment')) || 0;
    const installmentsTotal = installmentRows.reduce((s, r) => s + parseFloat(r.amount), 0);
    const diff = Math.abs(downPayment + installmentsTotal - totalPrice);
    if (installmentRows.length > 0 && diff > 0.01) {
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
    paymentMode: fd.get('paymentMode') || 'free',
    notes: fd.get('notes') || '',
    installments: installmentRows.map(r => ({ label: r.label, amount: parseFloat(r.amount), dueDate: r.dueDate }))
  });
  if (added) {
    const pickedUnit = fd.get('unitId');
    if (pickedUnit && pickedUnit !== '__manual' && added.id) {
      const linked = await DB.linkUnitToSale(pickedUnit, added.id);
      if (!linked) showToast('تم حفظ البيعة، لكن تعذر ربطها بالوحدة — اربطها من شاشة الوحدات', 'warning', 6000);
    }
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
  document.getElementById('edit-sale-notes-crm').value = sale.notesCrm || '';
  document.getElementById('edit-sale-modal').classList.add('active');
}

async function updateSale(event) {
  event.preventDefault();
  showLoading();
  const fd = new FormData(event.target);
  const updated = await DB.updateSale(fd.get('saleId'), {
    projectId: fd.get('projectId'),
    unitType: fd.get('unitType'),
    unitNumber: fd.get('unitNumber') || '',
    saleDate: fd.get('saleDate'),
    customerName: fd.get('customerName'),
    customerPhone: fd.get('customerPhone') || '',
    totalPrice: parseFloat(fd.get('totalPrice')),
    notes: fd.get('notes') || '',
    notesCrm: fd.get('notesCrm') || ''
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
  const payCount = getSalePaymentCount(sale);
  const paid = getCombinedTotalPaid(sale);
  const ok1 = await confirmDanger({
    title: `حذف بيعة "${sale.customerName}"`,
    lines: payCount > 0 ? [
      `على هذه البيعة <b>${payCount}</b> دفعة مسجلة بإجمالي <b>${formatCurrency(paid)} ج.م</b>.`,
      `سيتم حذف جدول الأقساط (${(sale.payments || []).length}) وكل الدفعات والملفات المرتبطة.`,
      'لا يمكن التراجع عن الحذف.'
    ] : ['لا توجد دفعات مسجلة على هذه البيعة.'],
    requireText: payCount > 0 ? 'حذف' : '',
    confirmLabel: 'حذف البيعة'
  });
  if (!ok1) return;
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
  const projSel = document.getElementById('expense-project-id');
  projSel.innerHTML = '<option value="">اختر المشروع</option>' + projects.map(p => `<option value="${p.id}">${p.projectName}</option>`).join('');
  projSel.value = projectId || (projects.length === 1 ? projects[0].id : '');
  document.querySelector('#add-expense-modal input[name="date"]').value = todayStr();
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
    await refreshAfterExpenseChange(added.projectId);
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
    await refreshAfterExpenseChange(fd.get('projectId'));
    showToast('تم تحديث المصروف');
  }
  hideLoading();
}

async function deleteExpense(projectId, expenseId) {
  if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
  showLoading();
  const ok = await DB.deleteExpense(expenseId);
  if (ok) {
    await refreshAfterExpenseChange(projectId);
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
  const totalRevenue = projectSales.reduce((s, sale) => s + getCombinedTotalPaid(sale), 0);
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
        const paid = getCombinedTotalPaid(sale);
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
// ============================================================
// التقرير الشهري (NEW) — فلتر شهر/سنة + تفصيل المصاريف + التحصيلات
// ============================================================
let chartExpenseBreakdown = null;

function populateReportFilters() {
  const monthSel = document.getElementById('report-month-filter');
  const yearSel = document.getElementById('report-year-filter');
  if (!monthSel || !yearSel) return;
  if (monthSel.options.length > 0) return; // already populated — لا تعيد ضبط اختيار المستخدم

  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  monthSel.innerHTML = months.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');

  const curYear = new Date().getFullYear();
  let yearOptions = '';
  for (let y = curYear - 3; y <= curYear + 1; y++) yearOptions += `<option value="${y}">${y}</option>`;
  yearSel.innerHTML = yearOptions;

  const today = new Date();
  monthSel.value = today.getMonth() + 1;
  yearSel.value = today.getFullYear();
}

async function getAllExpenses() {
  const all = [];
  for (const p of projects) {
    const exp = await DB.getProjectExpenses(p.id);
    exp.forEach(e => all.push({ ...e, projectName: p.projectName }));
  }
  return all;
}

async function renderMonthlyReport() {
  const monthSel = document.getElementById('report-month-filter');
  const yearSel = document.getElementById('report-year-filter');
  if (!monthSel || !yearSel || !monthSel.value || !yearSel.value) return;

  const month = parseInt(monthSel.value);
  const year = parseInt(yearSel.value);
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  // إجمالي المبيعات (عقود) هذا الشهر
  const monthSales = sales.filter(s => (s.saleDate || '').slice(0, 7) === monthKey);
  const totalSalesMonth = monthSales.reduce((s, sale) => s + sale.totalPrice, 0);

  // التحصيلات هذا الشهر — من الأقساط الثابتة (القديمة) + الدفعات الحرة (الجديدة)
  const collections = [];
  for (const sale of sales) {
    const project = projects.find(p => p.id === sale.projectId);
    (sale.payments || []).forEach(inst => (inst.partialPayments || []).forEach(pp => {
      if ((pp.date || '').slice(0, 7) === monthKey) {
        collections.push({ date: pp.date, customerName: sale.customerName, projectName: project?.projectName || '—', amount: parseFloat(pp.amount) || 0 });
      }
    }));
  }
  freePayments.forEach(p => {
    if ((p.date || '').slice(0, 7) === monthKey) {
      const sale = sales.find(s => s.id === p.saleId);
      const project = sale ? projects.find(pr => pr.id === sale.projectId) : null;
      collections.push({ date: p.date, customerName: sale?.customerName || '—', projectName: project?.projectName || '—', amount: p.amount });
    }
  });
  collections.sort((a, b) => (a.date < b.date ? -1 : 1));
  const totalCollected = collections.reduce((s, c) => s + c.amount, 0);

  // المصاريف هذا الشهر
  const allExpenses = await getAllExpenses();
  const monthExpenses = allExpenses.filter(e => (e.date || '').slice(0, 7) === monthKey);
  const totalExpensesMonth = monthExpenses.reduce((s, e) => s + e.amount, 0);

  const netProfitMonth = totalCollected - totalExpensesMonth;

  // ── ملخص الشهر ──
  const statsEl = document.getElementById('monthly-summary-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-card info"><div class="stat-label">إجمالي المبيعات هذا الشهر</div><div class="stat-value">${formatCurrency(totalSalesMonth)}</div><div class="stat-sub">ج.م</div></div>
      <div class="stat-card gold"><div class="stat-label">إجمالي المحصّل هذا الشهر</div><div class="stat-value">${formatCurrency(totalCollected)}</div><div class="stat-sub">ج.م</div></div>
      <div class="stat-card danger"><div class="stat-label">إجمالي المصاريف هذا الشهر</div><div class="stat-value">${formatCurrency(totalExpensesMonth)}</div><div class="stat-sub">ج.م</div></div>
      <div class="stat-card gold"><div class="stat-label">صافي الربح هذا الشهر</div><div class="stat-value">${formatCurrency(netProfitMonth)}</div><div class="stat-sub">ج.م</div></div>`;
  }

  // ── توزيع المصاريف حسب الفئة ──
  const categories = {};
  monthExpenses.forEach(e => {
    const key = getCategoryName(e.category, e.customCategory);
    categories[key] = (categories[key] || 0) + e.amount;
  });
  const catEntries = Object.entries(categories);

  const tableEl = document.getElementById('monthly-expense-table');
  if (tableEl) {
    tableEl.innerHTML = catEntries.length === 0
      ? `<div class="empty" style="padding:1.5rem"><p>لا توجد مصروفات هذا الشهر</p></div>`
      : `<table class="report-table" style="width:100%">
          <thead><tr><th>الفئة</th><th>المبلغ</th></tr></thead>
          <tbody>${catEntries.map(([cat, amt]) => `<tr><td>${cat}</td><td style="font-weight:700;color:var(--gold)">${formatCurrency(amt)} ج.م</td></tr>`).join('')}</tbody>
        </table>`;
  }

  const pieCtx = document.getElementById('chart-expense-breakdown');
  if (pieCtx) {
    if (chartExpenseBreakdown) { chartExpenseBreakdown.destroy(); chartExpenseBreakdown = null; }
    if (catEntries.length > 0) {
      chartExpenseBreakdown = new Chart(pieCtx, {
        type: 'pie',
        data: {
          labels: catEntries.map(([cat]) => cat),
          datasets: [{ data: catEntries.map(([, amt]) => amt), backgroundColor: ['#0e8f94', '#0b5563', '#12a3a8', '#ef6f4f', '#2471a3', '#d6453d', '#ef6f4f'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { family: 'Readex Pro', size: 10 }, boxWidth: 12 } } } }
      });
    }
  }

  // ── سجل التحصيلات ──
  const collectionsEl = document.getElementById('monthly-collections-table');
  if (collectionsEl) {
    collectionsEl.innerHTML = collections.length === 0
      ? `<div class="empty" style="padding:1.5rem"><p>لا توجد تحصيلات هذا الشهر</p></div>`
      : `<table class="report-table" style="width:100%">
          <thead><tr><th>التاريخ</th><th>اسم العميل</th><th>المشروع</th><th>المبلغ</th></tr></thead>
          <tbody>${collections.map(c => `<tr><td>${formatDate(c.date)}</td><td>${c.customerName}</td><td>${c.projectName}</td><td style="font-weight:700;color:var(--gold)">${formatCurrency(c.amount)} ج.م</td></tr>`).join('')}</tbody>
        </table>`;
  }
}

// ============================================================
// التقرير الشهري السريع (NEW — تبويب مستقل) — التحصيلات/المصاريف/الملخص
// ============================================================
function populateMqrFilters() {
  const monthSel = document.getElementById('mqr-month');
  const yearSel = document.getElementById('mqr-year');
  if (!monthSel || !yearSel) return;
  if (monthSel.options.length > 0) return; // لا تعيد ضبط اختيار المستخدم

  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  monthSel.innerHTML = months.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');

  const curYear = new Date().getFullYear();
  let yearOptions = '';
  for (let y = curYear - 3; y <= curYear + 1; y++) yearOptions += `<option value="${y}">${y}</option>`;
  yearSel.innerHTML = yearOptions;

  const today = new Date();
  monthSel.value = today.getMonth() + 1;
  yearSel.value = today.getFullYear();
}

async function renderMonthlyQuickReport() {
  populateMqrFilters();
  const monthSel = document.getElementById('mqr-month');
  const yearSel = document.getElementById('mqr-year');
  if (!monthSel || !yearSel || !monthSel.value || !yearSel.value) return;

  const month = parseInt(monthSel.value);
  const year = parseInt(yearSel.value);
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  // ── التحصيلات: الأقساط الثابتة المدفوعة هذا الشهر + الدفعات الحرة ──
  const collections = [];
  for (const sale of sales) {
    const project = projects.find(p => p.id === sale.projectId);
    (sale.payments || []).forEach(inst => (inst.partialPayments || []).forEach(pp => {
      if ((pp.date || '').slice(0, 7) === monthKey) {
        const type = inst.label === 'مقدم' ? 'مقدم' : inst.label === 'كاش' ? 'كاش' : 'قسط';
        collections.push({ date: pp.date, customerName: sale.customerName, projectName: project?.projectName || '—', type, amount: parseFloat(pp.amount) || 0 });
      }
    }));
  }
  freePayments.forEach(p => {
    if ((p.date || '').slice(0, 7) === monthKey) {
      const sale = sales.find(s => s.id === p.saleId);
      const project = sale ? projects.find(pr => pr.id === sale.projectId) : null;
      collections.push({ date: p.date, customerName: sale?.customerName || '—', projectName: project?.projectName || '—', type: 'دفعة حرة', amount: p.amount });
    }
  });
  collections.sort((a, b) => (a.date < b.date ? 1 : -1));
  const totalCollected = collections.reduce((s, c) => s + c.amount, 0);

  const collTotalEl = document.getElementById('mqr-collections-total');
  if (collTotalEl) collTotalEl.textContent = formatCurrency(totalCollected);

  const collListEl = document.getElementById('mqr-collections-list');
  if (collListEl) {
    collListEl.innerHTML = collections.length === 0
      ? `<div class="empty" style="padding:1.5rem"><p>لا توجد دفعات هذا الشهر</p></div>`
      : `<table class="report-table" style="width:100%">
          <thead><tr><th>التاريخ</th><th>اسم العميل</th><th>المشروع</th><th>النوع</th><th>المبلغ</th></tr></thead>
          <tbody>${collections.map(c => `<tr><td>${formatDate(c.date)}</td><td>${c.customerName}</td><td>${c.projectName}</td><td>${c.type}</td><td style="font-weight:700;color:var(--gold)">${formatCurrency(c.amount)} ج.م</td></tr>`).join('')}</tbody>
        </table>`;
  }

  // ── المصاريف هذا الشهر ──
  const allExpenses = await getAllExpenses();
  const monthExpenses = allExpenses.filter(e => (e.date || '').slice(0, 7) === monthKey);
  const totalExpensesMonth = monthExpenses.reduce((s, e) => s + e.amount, 0);

  const expTotalEl = document.getElementById('mqr-expenses-total');
  if (expTotalEl) expTotalEl.textContent = formatCurrency(totalExpensesMonth);

  const categories = {};
  monthExpenses.forEach(e => {
    const key = getCategoryName(e.category, e.customCategory);
    categories[key] = (categories[key] || 0) + e.amount;
  });
  const catEntries = Object.entries(categories);

  const catEl = document.getElementById('mqr-expenses-by-category');
  if (catEl) {
    catEl.innerHTML = catEntries.length === 0
      ? `<div class="empty" style="padding:1rem"><p>لا توجد مصروفات</p></div>`
      : `<table class="report-table" style="width:100%">
          <thead><tr><th>الفئة</th><th>المبلغ</th></tr></thead>
          <tbody>${catEntries.map(([cat, amt]) => `<tr><td>${cat}</td><td style="font-weight:700;color:var(--gold)">${formatCurrency(amt)} ج.م</td></tr>`).join('')}</tbody>
        </table>`;
  }

  const expListEl = document.getElementById('mqr-expenses-list');
  if (expListEl) {
    expListEl.innerHTML = monthExpenses.length === 0
      ? `<div class="empty" style="padding:1.5rem"><p>لا توجد مصروفات هذا الشهر</p></div>`
      : `<table class="report-table" style="width:100%">
          <thead><tr><th>التاريخ</th><th>الفئة</th><th>المبلغ</th><th>البيان</th></tr></thead>
          <tbody>${monthExpenses.map(e => `<tr><td>${formatDate(e.date)}</td><td>${getCategoryName(e.category, e.customCategory)}</td><td style="font-weight:700;color:var(--gold)">${formatCurrency(e.amount)} ج.م</td><td>${e.notes || e.recipient || '—'}</td></tr>`).join('')}</tbody>
        </table>`;
  }

  // ── الملخص ──
  const netMonth = totalCollected - totalExpensesMonth;
  const summaryEl = document.getElementById('mqr-summary-stats');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="stat-card gold"><div class="stat-label">إجمالي التحصيلات</div><div class="stat-value">${formatCurrency(totalCollected)}</div><div class="stat-sub">ج.م</div></div>
      <div class="stat-card danger"><div class="stat-label">إجمالي المصاريف</div><div class="stat-value">${formatCurrency(totalExpensesMonth)}</div><div class="stat-sub">ج.م</div></div>
      <div class="stat-card ${netMonth >= 0 ? 'gold' : 'danger'}"><div class="stat-label">صافي الشهر</div><div class="stat-value">${formatCurrency(netMonth)}</div><div class="stat-sub">ج.م</div></div>`;
  }
}

async function generateReport() {
  const container = document.getElementById('reports-content');
  if (!container) return;

  populateReportFilters();
  await renderMonthlyReport();

  let totalRevenue = 0, totalPaid = 0, totalCosts = 0;
  for (const p of projects) {
    totalRevenue += projects.reduce((s, pr) => s + sales.filter(sa => sa.projectId === pr.id).reduce((ss, sale) => ss + sale.totalPrice, 0), 0);
    totalPaid += calculateProjectRevenue(p.id);
    totalCosts += await calculateProjectCosts(p.id);
    break; // calculate once for all projects combined
  }

  // Recalculate properly
  totalRevenue = sales.reduce((s, sale) => s + sale.totalPrice, 0);
  totalPaid = sales.reduce((s, sale) => s + getCombinedTotalPaid(sale), 0);
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
  populateFilterProject();
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
  // المدفوع المسجل على الأقساط نفسها فقط (بدون الدفعات الموزّعة من جدول payments)
  return (sale.payments || []).reduce((s, inst) => s + (parseFloat(inst.pinnedPaid ?? inst.paidAmount) || 0), 0);
}

// ── النظام المرن: دفعات حرة من جدول payments المستقل ───────
function getFreePaymentsForSale(saleId) {
  return freePayments.filter(p => p.saleId === saleId);
}

function getFreePaymentsTotal(saleId) {
  return getFreePaymentsForSale(saleId).reduce((s, p) => s + p.amount, 0);
}

// إجمالي محصّل حقيقي لعملية بيع = الأقساط الثابتة (القديمة) + الدفعات الحرة (الجديدة)
function getCombinedTotalPaid(sale) {
  return getTotalPaid(sale) + getFreePaymentsTotal(sale.id);
}

function getLastPaymentDate(sale) {
  const dates = [];
  (sale.payments || []).forEach(inst => (inst.partialPayments || []).forEach(pp => { if (pp.date) dates.push(pp.date); }));
  getFreePaymentsForSale(sale.id).forEach(p => { if (p.date) dates.push(p.date); });
  if (dates.length === 0) return null;
  return dates.sort().slice(-1)[0];
}

function paymentModeLabel(mode) {
  return mode === 'installments' ? '📅 أقساط' : mode === 'both' ? '🔀 الاثنين' : '🆓 حرة';
}

function calculateProjectRevenue(projectId) {
  return sales.filter(s => s.projectId === projectId).reduce((s, sale) => s + getCombinedTotalPaid(sale), 0);
}

async function calculateProjectCosts(projectId) {
  // من النسخة المحمّلة في الذاكرة (تتحدث مع كل loadData) بدل طلب جديد لكل مشروع
  return allExpenses.filter(e => e.projectId === projectId).reduce((s, e) => s + e.amount, 0);
}

function formatCurrency(amount) {
  // الأرقام الصحيحة تُعرض بدون كسور (١٬٢٠٠٬٠٠٠ بدل ١٬٢٠٠٬٠٠٠٫٠٠) — الكسور تظهر فقط لو موجودة
  const n = Math.round((amount || 0) * 100) / 100;
  return new Intl.NumberFormat('ar-EG', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);
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
          { label: 'تكاليف', data: costsData, backgroundColor: 'rgba(11,85,99,0.6)', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Readex Pro', size: 11 }, boxWidth: 14 } } },
        scales: { x: { ticks: { font: { family: 'Readex Pro', size: 10 } } }, y: { ticks: { font: { family: 'Readex Pro', size: 10 }, callback: v => (v/1000) + 'k' } } }
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
        datasets: [{ data: [paid, partial, pending, overdue], backgroundColor: ['#1a8a5f','#ef6f4f','#2471a3','#d6453d'], borderWidth: 2 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Readex Pro', size: 11 }, boxWidth: 14 } } }
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
    @import url('https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Readex Pro',sans-serif; direction:rtl; color:#16282c; background:#fff; padding:20px; font-size:13px; }
    .pdf-header { background:#0b5563; color:#fff; padding:18px 24px; border-radius:8px; margin-bottom:20px; }
    .pdf-header h1 { font-family:'Readex Pro',sans-serif; font-size:20px; font-weight:900; margin-bottom:4px; }
    .pdf-header p  { font-size:12px; opacity:.85; }
    .pdf-meta { display:flex; justify-content:space-between; font-size:11px; color:#5f7478; margin-top:6px; }
    .section-title { font-family:'Readex Pro',sans-serif; font-weight:700; font-size:14px; color:#0b5563; border-right:4px solid #0e8f94; padding-right:10px; margin:18px 0 10px; }
    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; background:#eef5f5; border-radius:8px; padding:12px 16px; margin-bottom:12px; }
    .info-row { display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #d9e6e6; }
    .info-row:last-child { border:none; }
    .info-label { font-weight:700; color:#5f7478; font-size:12px; }
    .info-value { font-weight:600; color:#16282c; }
    .summary-boxes { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px; }
    .summary-box { border-radius:8px; padding:12px; text-align:center; }
    .summary-box.green  { background:#e8f5ee; }
    .summary-box.gold   { background:#fdf3dc; }
    .summary-box.red    { background:#fce8e6; }
    .summary-box .lbl   { font-size:11px; color:#5f7478; font-weight:600; margin-bottom:4px; }
    .summary-box .val   { font-family:'Readex Pro',sans-serif; font-size:18px; font-weight:900; }
    .summary-box.green .val { color:#1a8a5f; }
    .summary-box.gold  .val { color:#9a6f10; }
    .summary-box.red   .val { color:#d6453d; }
    table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:16px; }
    th { background:#0b5563; color:#fff; padding:8px 10px; text-align:right; font-weight:700; font-size:11px; }
    td { padding:7px 10px; border-bottom:1px solid #d9e6e6; }
    tr:nth-child(even) td { background:#eef5f5; }
    tr.overdue td { background:#fce8e6; color:#d6453d; }
    .badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700; }
    .badge-green { background:#e8f5ee; color:#1a8a5f; }
    .badge-red   { background:#fce8e6; color:#d6453d; }
    .badge-gold  { background:#fdf3dc; color:#9a6f10; }
    .badge-blue  { background:#e8f1fb; color:#1a5276; }
    .badge-orange{ background:#fef0e7; color:#c0642b; }
    .footer { margin-top:24px; padding-top:12px; border-top:2px solid #d9e6e6; display:flex; justify-content:space-between; font-size:11px; color:#5f7478; }
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
  const totalPaid = getCombinedTotalPaid(sale);
  const remaining = sale.totalPrice - totalPaid;
  const today = new Date(); today.setHours(0,0,0,0);
  const dateStr = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });

  const installmentRowEntries = (sale.payments || []).map((inst, i) => {
    const due = new Date(inst.dueDate); due.setHours(0,0,0,0);
    const isOverdue = inst.status !== 'paid' && due < today;
    const statusBadge =
      inst.status === 'paid'    ? '<span class="badge badge-green">مدفوع ✓</span>' :
      inst.status === 'partial' ? '<span class="badge badge-orange">جزئي</span>'   :
      isOverdue                 ? '<span class="badge badge-red">متأخر !</span>'   :
                                  '<span class="badge badge-blue">قادم</span>';
    const html = `<tr class="${isOverdue ? 'overdue' : ''}">
      <td>#</td>
      <td>${inst.label || 'قسط ' + (i+1)}</td>
      <td>${formatCurrency(inst.totalAmount)} ج.م</td>
      <td>${formatDate(inst.dueDate)}</td>
      <td style="color:#1a8a5f;font-weight:700">${formatCurrency(inst.paidAmount || 0)} ج.م</td>
      <td style="color:#d6453d;font-weight:700">${formatCurrency(inst.remainingAmount || 0)} ج.م</td>
      <td>${statusBadge}</td>
    </tr>`;
    return { sortDate: inst.dueDate || sale.saleDate, html };
  });

  // الدفعات الحرة (من جدول payments المستقل) — تُدمج في نفس الجدول
  const freeRowEntries = getFreePaymentsForSale(saleId).map(p => ({
    sortDate: p.date,
    html: `<tr>
      <td>#</td>
      <td>🆓 دفعة حرة</td>
      <td>${formatCurrency(p.amount)} ج.م</td>
      <td>${formatDate(p.date)}</td>
      <td style="color:#1a8a5f;font-weight:700">${formatCurrency(p.amount)} ج.م</td>
      <td style="color:#1a8a5f;font-weight:700">0.00 ج.م</td>
      <td>${p.notes || '—'}</td>
    </tr>`
  }));

  const installmentsRows = [...installmentRowEntries, ...freeRowEntries]
    .sort((a, b) => (a.sortDate < b.sortDate ? 1 : a.sortDate > b.sortDate ? -1 : 0))
    .map((e, i) => e.html.replace('<td>#</td>', `<td>${i + 1}</td>`))
    .join('');

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

    <div class="section-title">جدول الأقساط والدفعات (${installmentRowEntries.length + freeRowEntries.length} بند)</div>
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
  const totalPaid = projectSales.reduce((s, sale) => s + getCombinedTotalPaid(sale), 0);
  const totalExpected = projectSales.reduce((s, sale) => s + sale.totalPrice, 0);
  const dateStr = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });

  const expRows = expenses.map((e, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${getCategoryName(e.category, e.customCategory)}</td>
      <td>${formatDate(e.date)}</td>
      <td>${e.recipient || '—'}</td>
      <td style="font-weight:700;color:#0e8f94">${formatCurrency(e.amount)} ج.م</td>
      <td>${e.notes || '—'}</td>
    </tr>`).join('');

  const saleRows = projectSales.map((sale, i) => {
    const paid = getCombinedTotalPaid(sale);
    const rem = sale.totalPrice - paid;
    return `<tr>
      <td>${i+1}</td>
      <td style="font-weight:700">${sale.customerName}</td>
      <td>${sale.customerPhone || '—'}</td>
      <td>${sale.unitType === 'apartment' ? 'شقة' : 'محل'} ${sale.unitNumber || ''}</td>
      <td>${formatDate(sale.saleDate)}</td>
      <td style="font-weight:700;color:#0e8f94">${formatCurrency(sale.totalPrice)} ج.م</td>
      <td style="color:#1a8a5f;font-weight:700">${formatCurrency(paid)} ج.م</td>
      <td style="color:${rem > 0 ? '#d6453d' : '#1a8a5f'};font-weight:700">${formatCurrency(rem)} ج.م</td>
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
      <tbody>${expRows || '<tr><td colspan="6" style="text-align:center;color:#5f7478">لا توجد مصروفات</td></tr>'}</tbody>
    </table>

    <div class="section-title">💰 المبيعات (${projectSales.length} عميل — متوقع: ${formatCurrency(totalExpected)} ج.م)</div>
    <table>
      <thead><tr><th>#</th><th>العميل</th><th>الهاتف</th><th>الوحدة</th><th>تاريخ البيع</th><th>السعر</th><th>المدفوع</th><th>المتبقي</th></tr></thead>
      <tbody>${saleRows || '<tr><td colspan="8" style="text-align:center;color:#5f7478">لا توجد مبيعات</td></tr>'}</tbody>
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
  const totalPaid = sales.reduce((s, sale) => s + getCombinedTotalPaid(sale), 0);
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
      <td style="color:#d6453d;font-weight:700">${formatCurrency(costs)} ج.م</td>
      <td style="color:#1a8a5f;font-weight:700">${formatCurrency(rev)} ج.م</td>
      <td style="color:#0e8f94;font-weight:700">${formatCurrency(exp)} ج.م</td>
      <td style="font-weight:700;color:${profit >= 0 ? '#1a8a5f' : '#d6453d'}">${formatCurrency(profit)} ج.م</td>
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
      <div class="info-row"><span class="info-label">المتبقي تحصيله</span><span class="info-value" style="color:#d6453d">${formatCurrency(totalExpected - totalPaid)} ج.م</span></div>
      <div class="info-row"><span class="info-label">أقساط متأخرة</span><span class="info-value" style="color:#d6453d">${overdue.length} قسط</span></div>
    </div>

    ${overdue.length > 0 ? `
    <div class="section-title">🔴 الأقساط المتأخرة (${overdue.length})</div>
    <table>
      <thead><tr><th>#</th><th>العميل</th><th>المشروع</th><th>القسط</th><th>تاريخ الاستحقاق</th><th>المتبقي</th><th>أيام التأخير</th></tr></thead>
      <tbody>${overdueRows}</tbody>
    </table>` : `<div style="background:#e8f5ee;border-radius:8px;padding:12px;text-align:center;color:#1a8a5f;font-weight:700;margin-bottom:16px">✅ لا توجد أقساط متأخرة</div>`}

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
// صفحة العميل للطباعة — A4 بضغطة واحدة
// ============================================================
function printClientPage(saleId) {
  const sale = sales.find(s => s.id === saleId);
  if (!sale) return;
  const project = projects.find(p => p.id === sale.projectId);
  const totalPaid = getCombinedTotalPaid(sale);
  const remaining = sale.totalPrice - totalPaid;
  const today = new Date(); today.setHours(0,0,0,0);
  const dateStr = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });

  // أقرب قسط قادم
  const nextInst = (sale.payments || [])
    .filter(i => i.status !== 'paid')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];

  const instRowEntries = (sale.payments || []).map((inst, i) => {
    const due = new Date(inst.dueDate); due.setHours(0,0,0,0);
    const isOverdue = inst.status !== 'paid' && due < today;
    const statusAr = inst.status === 'paid' ? '✓ مدفوع'
      : inst.status === 'partial' ? '⏳ جزئي'
      : isOverdue ? '! متأخر' : '◷ قادم';
    const color = inst.status === 'paid' ? '#1a8a5f'
      : isOverdue ? '#d6453d' : inst.status === 'partial' ? '#ef6f4f' : '#2471a3';
    const html = `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #d9e6e6;text-align:center">#</td>
      <td style="padding:7px 10px;border-bottom:1px solid #d9e6e6">${inst.label || `القسط ${i+1}`}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #d9e6e6;font-weight:700">${formatCurrency(inst.totalAmount)} ج.م</td>
      <td style="padding:7px 10px;border-bottom:1px solid #d9e6e6">${formatDate(inst.dueDate)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #d9e6e6;font-weight:700;color:#1a8a5f">${formatCurrency(inst.paidAmount || 0)} ج.م</td>
      <td style="padding:7px 10px;border-bottom:1px solid #d9e6e6;font-weight:700;color:${color}">${statusAr}</td>
    </tr>`;
    return { sortDate: inst.dueDate || sale.saleDate, html };
  });

  // الدفعات الحرة (من جدول payments المستقل) — تُدمج في نفس الجدول
  const freeRowEntries = getFreePaymentsForSale(saleId).map(p => ({
    sortDate: p.date,
    html: `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #d9e6e6;text-align:center">#</td>
      <td style="padding:7px 10px;border-bottom:1px solid #d9e6e6">🆓 دفعة حرة</td>
      <td style="padding:7px 10px;border-bottom:1px solid #d9e6e6;font-weight:700">${formatCurrency(p.amount)} ج.م</td>
      <td style="padding:7px 10px;border-bottom:1px solid #d9e6e6">${formatDate(p.date)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #d9e6e6;font-weight:700;color:#1a8a5f">${formatCurrency(p.amount)} ج.م</td>
      <td style="padding:7px 10px;border-bottom:1px solid #d9e6e6;color:#5f7478">${p.notes || '—'}</td>
    </tr>`
  }));

  const instRows = [...instRowEntries, ...freeRowEntries]
    .sort((a, b) => (a.sortDate < b.sortDate ? 1 : a.sortDate > b.sortDate ? -1 : 0))
    .map((e, i) => e.html.replace('>#<', `>${i + 1}<`))
    .join('');

  const html = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Readex Pro',sans-serif; direction:rtl; color:#16282c; padding:24px; font-size:13px; background:#fff; }
      .header { background:#0b5563; color:#fff; padding:16px 20px; border-radius:10px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; }
      .header h1 { font-family:'Readex Pro',sans-serif; font-size:20px; font-weight:900; }
      .header .sub { font-size:11px; opacity:.8; margin-top:3px; }
      .logo-box { background:rgba(255,255,255,.15); border-radius:8px; padding:8px 14px; font-size:12px; font-weight:700; text-align:center; }
      .info-section { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
      .info-card { background:#eef5f5; border-radius:8px; padding:12px 16px; }
      .info-card h3 { font-family:'Readex Pro',sans-serif; font-size:13px; font-weight:700; color:#0b5563; border-bottom:2px solid #0e8f94; padding-bottom:6px; margin-bottom:10px; }
      .info-row { display:flex; justify-content:space-between; padding:4px 0; font-size:12px; }
      .info-row .lbl { color:#5f7478; font-weight:600; }
      .info-row .val { font-weight:700; color:#16282c; }
      .totals { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:16px; }
      .total-box { border-radius:8px; padding:12px; text-align:center; }
      .total-box .t-lbl { font-size:11px; color:#5f7478; font-weight:600; margin-bottom:4px; }
      .total-box .t-val { font-family:'Readex Pro',sans-serif; font-size:20px; font-weight:900; }
      .total-box.gold  { background:#fdf3dc; } .total-box.gold .t-val  { color:#9a6f10; }
      .total-box.green { background:#e8f5ee; } .total-box.green .t-val { color:#1a8a5f; }
      .total-box.red   { background:#fce8e6; } .total-box.red .t-val   { color:#d6453d; }
      table { width:100%; border-collapse:collapse; font-size:12px; }
      thead tr { background:#0b5563; color:#fff; }
      th { padding:8px 10px; text-align:right; font-size:11px; font-weight:700; }
      .next-inst { background:#fffbe6; border:2px solid #0e8f94; border-radius:8px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; }
      .next-inst .n-title { font-weight:700; color:#7a5c0a; font-size:12px; }
      .next-inst .n-val { font-family:'Readex Pro',sans-serif; font-size:18px; font-weight:900; color:#9a6f10; }
      .note-box { background:#f3f7f7; border-radius:8px; padding:10px 14px; margin-top:14px; font-size:12px; }
      .sig-row { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:28px; }
      .sig-box { border-top:2px solid #16282c; padding-top:8px; text-align:center; font-size:11px; color:#5f7478; }
      .footer { margin-top:16px; text-align:center; font-size:10px; color:#aaa; border-top:1px solid #d9e6e6; padding-top:8px; }
      @media print { body { padding:10px; } @page { margin:12mm; size:A4; } }
    </style>

    <div class="header">
      <div>
        <h1>بيانات العميل وجدول الأقساط</h1>
        <div class="sub">نظام إدارة المشاريع العقارية — ${dateStr}</div>
      </div>
      <div class="logo-box">🏗️<br>${project?.projectName || ''}</div>
    </div>

    <div class="info-section">
      <div class="info-card">
        <h3>👤 بيانات العميل</h3>
        <div class="info-row"><span class="lbl">الاسم</span><span class="val">${sale.customerName}</span></div>
        <div class="info-row"><span class="lbl">رقم الهاتف</span><span class="val">${sale.customerPhone || '—'}</span></div>
        ${sale.notes ? `<div class="info-row"><span class="lbl">ملاحظات</span><span class="val">${sale.notes}</span></div>` : ''}
      </div>
      <div class="info-card">
        <h3>🏢 بيانات الوحدة</h3>
        <div class="info-row"><span class="lbl">المشروع</span><span class="val">${project?.projectName || '—'}</span></div>
        <div class="info-row"><span class="lbl">نوع الوحدة</span><span class="val">${sale.unitType === 'apartment' ? 'شقة' : 'محل'} ${sale.unitNumber || ''}</span></div>
        <div class="info-row"><span class="lbl">تاريخ البيع</span><span class="val">${formatDate(sale.saleDate)}</span></div>
        <div class="info-row"><span class="lbl">طريقة الدفع</span><span class="val">${sale.paymentType === 'cash' ? 'كاش' : 'أقساط'}</span></div>
      </div>
    </div>

    <div class="totals">
      <div class="total-box gold"><div class="t-lbl">إجمالي السعر</div><div class="t-val">${formatCurrency(sale.totalPrice)}</div><div class="t-lbl">ج.م</div></div>
      <div class="total-box green"><div class="t-lbl">المدفوع</div><div class="t-val">${formatCurrency(totalPaid)}</div><div class="t-lbl">ج.م</div></div>
      <div class="total-box ${remaining > 0 ? 'red' : 'green'}"><div class="t-lbl">المتبقي</div><div class="t-val">${formatCurrency(remaining)}</div><div class="t-lbl">ج.م</div></div>
    </div>

    ${nextInst ? `
    <div class="next-inst">
      <div>
        <div class="n-title">📅 القسط القادم: ${nextInst.label}</div>
        <div style="font-size:12px;color:#7a5c0a;margin-top:2px">تاريخ الاستحقاق: ${formatDate(nextInst.dueDate)}</div>
      </div>
      <div class="n-val">${formatCurrency(nextInst.remainingAmount || nextInst.totalAmount)} ج.م</div>
    </div>` : ''}

    <div style="font-family:'Readex Pro',sans-serif;font-size:13px;font-weight:700;color:#0b5563;border-bottom:2px solid #0e8f94;padding-bottom:6px;margin-bottom:10px">
      📋 جدول الأقساط
    </div>
    <table>
      <thead><tr>
        <th style="width:40px">#</th>
        <th>البند</th>
        <th>المبلغ</th>
        <th>تاريخ الاستحقاق</th>
        <th>المدفوع</th>
        <th>الحالة</th>
      </tr></thead>
      <tbody>${instRows}</tbody>
    </table>

    <div class="sig-row">
      <div class="sig-box">توقيع العميل<br>${sale.customerName}</div>
      <div class="sig-box">توقيع المسؤول<br>شركة ${project?.projectName || ''}</div>
    </div>

    <div class="footer">تم الإصدار بواسطة نظام إدارة المشاريع العقارية — ${dateStr}</div>`;

  openPrintWindow(html, `بيانات-${sale.customerName}`);
  showToast('جاري فتح صفحة الطباعة...', 'info');
}

// ============================================================
// MODAL CLOSE
// ============================================================
function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

// ============================================================
// FLEXIBLE PAYMENT PAGE (NEW) — جدول payments المستقل
// ============================================================
let showAddPaymentForm = false;

function openPaymentPage(saleId) { showSaleInstallments(saleId); }

// بعد أي حفظ/حذف دفعة: أعد رسم شاشة حساب العميل
function renderPaymentPage(saleId) {
  showSaleInstallments(saleId);
  checkOverdueInstallments();
}

async function submitNewPayment(saleId) {
  const amount = parseFloat(document.getElementById('np-amount')?.value);
  const date = document.getElementById('np-date')?.value;
  const dueDate = document.getElementById('np-due-date')?.value || null;
  const notes = document.getElementById('np-notes')?.value || '';
  if (!amount || amount <= 0) { showToast('أدخل مبلغاً صحيحاً', 'warning'); return; }
  if (!date) { showToast('أدخل التاريخ', 'warning'); return; }

  showLoading();
  const added = await DB.addPayment({ saleId, amount, date, dueDate, notes });
  if (added) {
    await loadData();
    renderPaymentPage(saleId);
    updateDashboard();
    renderSales();
    showToast('تم تسجيل الدفعة بنجاح');
  }
  hideLoading();
}

async function deleteFreePayment(paymentId, saleId) {
  if (!confirm('هل تريد حذف هذه الدفعة؟')) return;
  showLoading();
  const ok = await DB.deletePayment(paymentId);
  if (ok) {
    await loadData();
    renderPaymentPage(saleId);
    updateDashboard();
    renderSales();
    showToast('تم حذف الدفعة');
  }
  hideLoading();
}

async function savePaymentMode(saleId) {
  const mode = document.getElementById('payment-mode-select')?.value;
  if (!mode) return;
  showLoading();
  const ok = await DB.updateSalePaymentMode(saleId, mode);
  if (ok) {
    await loadData();
    renderPaymentPage(saleId);
    renderSales();
    showToast('تم تحديث نظام الدفع');
  }
  hideLoading();
}

// ============================================================
// UNIFIED REPORT — تقرير واحد: مشروع + فترة
// ============================================================
const UR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
let urLast = null;

function populateUnifiedReportFilters() {
  const projSel = document.getElementById('ur-project');
  const monthSel = document.getElementById('ur-month');
  const yearSel = document.getElementById('ur-year');
  if (!projSel || !monthSel || !yearSel) return;

  const curProj = projSel.value;
  projSel.innerHTML = '<option value="">كل المشاريع</option>' +
    projects.map(p => `<option value="${p.id}">${p.projectName}</option>`).join('');
  if (curProj && projects.some(p => p.id === curProj)) projSel.value = curProj;

  if (monthSel.options.length === 0) {
    const now = new Date();
    monthSel.innerHTML = UR_MONTHS.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('');
    monthSel.value = String(now.getMonth() + 1).padStart(2, '0');
    const years = new Set([now.getFullYear()]);
    sales.forEach(s => { if (s.saleDate) years.add(parseInt(s.saleDate.slice(0, 4))); });
    yearSel.innerHTML = [...years].filter(Boolean).sort((x, y) => y - x).map(y => `<option value="${y}">${y}</option>`).join('');
    yearSel.value = String(now.getFullYear());
  }
}

// كل دفعة فعلية (على قسط أو من جدول payments) كسطر مستقل
function getSalePaymentEvents(sale) {
  const events = [];
  (sale.payments || []).forEach(inst => (inst.partialPayments || []).forEach(pp => {
    if (pp.date) events.push({ date: String(pp.date).slice(0, 10), amount: parseFloat(pp.amount) || 0, note: pp.note || inst.label || '', sale });
  }));
  getFreePaymentsForSale(sale.id).forEach(p => events.push({ date: String(p.date).slice(0, 10), amount: p.amount, note: p.notes || '', sale }));
  return events;
}

async function buildUnifiedReportData() {
  const projectId = document.getElementById('ur-project').value;
  const period = document.getElementById('ur-period').value;
  const month = document.getElementById('ur-month').value;
  const year = document.getElementById('ur-year').value;
  const prefix = period === 'month' ? `${year}-${month}` : period === 'year' ? `${year}` : '';
  const inPeriod = d => !prefix || (d && String(d).startsWith(prefix));
  const periodLabel = period === 'month' ? `${UR_MONTHS[parseInt(month) - 1]} ${year}` : period === 'year' ? `سنة ${year}` : 'من البداية';

  const selProjects = projectId ? projects.filter(p => p.id === projectId) : projects;
  const ids = new Set(selProjects.map(p => p.id));
  const selSales = sales.filter(s => ids.has(s.projectId));

  const { data: expRows, error } = await DB.supabase.from('expenses').select('*').order('date', { ascending: false });
  if (error) { console.error(error); showToast('خطأ في تحميل المصاريف', 'error'); }
  const expenses = (expRows || []).map(mapExpense).filter(e => ids.has(e.projectId));

  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const statFor = (projList) => {
    const pid = new Set(projList.map(p => p.id));
    const ss = selSales.filter(s => pid.has(s.projectId));
    // لو المشروع له جدول وحدات: العدد والمتاح والمحجوز منه. وإلا: عدد الشقق والمحلات المسجل على المشروع
    let unitsCount = 0, available = 0, reserved = 0;
    projList.forEach(p => {
      const pu = units.filter(u => u.projectId === p.id);
      const pSold = ss.filter(s => s.projectId === p.id).length;
      if (pu.length) {
        unitsCount += pu.length;
        available += pu.filter(u => getUnitStatus(u) === 'available').length;
        reserved += pu.filter(u => getUnitStatus(u) === 'reserved').length;
      } else {
        const n = (p.apartmentsCount || 0) + (p.shopsCount || 0);
        unitsCount += n;
        available += Math.max(n - pSold, 0);
      }
    });
    const contracts = sum(ss, s => s.totalPrice);
    const collected = sum(ss, s => getCombinedTotalPaid(s));
    const costs = sum(expenses.filter(e => pid.has(e.projectId)), e => e.amount);
    return {
      units: unitsCount, sold: ss.length, available, reserved,
      contracts, collected, remaining: contracts - collected,
      overdue: sum(ss, s => s.ledger?.overdueAmount || 0),
      costs, netCash: collected - costs, netExpected: contracts - costs
    };
  };

  const events = selSales.flatMap(getSalePaymentEvents);
  const periodEvents = events.filter(e => inPeriod(e.date)).sort((x, y) => (x.date < y.date ? 1 : -1));
  const periodExpenses = expenses.filter(e => inPeriod(e.date));
  const newSales = selSales.filter(s => inPeriod(s.saleDate));

  const byCat = {};
  periodExpenses.forEach(e => {
    const k = getCategoryName(e.category, e.customCategory);
    byCat[k] = byCat[k] || { total: 0, count: 0 };
    byCat[k].total += e.amount; byCat[k].count++;
  });

  const customers = selSales.map(s => {
    const paid = getCombinedTotalPaid(s);
    return { sale: s, project: projects.find(p => p.id === s.projectId), paid, remaining: s.totalPrice - paid, overdue: s.ledger?.overdueAmount || 0, last: getLastPaymentDate(s) };
  }).sort((x, y) => (y.overdue - x.overdue) || (y.remaining - x.remaining));

  return {
    periodLabel, isAllTime: !prefix,
    projectLabel: projectId ? selProjects[0]?.projectName || '' : 'كل المشاريع',
    single: !!projectId, total: statFor(selProjects),
    perProject: selProjects.map(p => ({ project: p, ...statFor([p]) })),
    customers, periodEvents, periodExpenses, newSales, byCat,
    periodCollected: sum(periodEvents, e => e.amount),
    periodCosts: sum(periodExpenses, e => e.amount),
    newSalesValue: sum(newSales, s => s.totalPrice),
    projectName: id => projects.find(p => p.id === id)?.projectName || '—'
  };
}

async function renderUnifiedReport() {
  const el = document.getElementById('ur-content');
  if (!el) return;
  populateUnifiedReportFilters();
  const period = document.getElementById('ur-period').value;
  document.getElementById('ur-month').style.display = period === 'month' ? '' : 'none';
  document.getElementById('ur-year').style.display = period === 'all' ? 'none' : '';

  const d = await buildUnifiedReportData();
  urLast = d;
  const c = v => formatCurrency(v);
  const t = d.total;
  const card = (label, value, cls = '', sub = 'ج.م') => `<div class="stat-card ${cls}"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-sub">${sub}</div></div>`;

  const periodNet = d.periodCollected - d.periodCosts;

  el.innerHTML = `
    <div class="card">
      <div class="card-hd"><div class="card-title">🏢 الوضع الحالي — ${d.projectLabel}</div></div>
      <div class="ur-grid">
        ${card('الوحدات', `${t.sold} / ${t.units}`, '', `مباعة — متاح ${t.available}${t.reserved ? ` — محجوز ${t.reserved}` : ''}`)}
        ${card('قيمة العقود', c(t.contracts), 'info')}
        ${card('المحصّل', c(t.collected), 'gold')}
        ${card('المتبقي تحصيله', c(t.remaining), t.remaining > 0.01 ? 'danger' : '')}
        ${card('المتأخر', c(t.overdue), t.overdue > 0.01 ? 'danger' : '', 'أقساط فات موعدها')}
        ${card('المصاريف', c(t.costs))}
        ${card('الصافي الفعلي', c(t.netCash), t.netCash >= 0 ? 'gold' : 'danger', 'المحصّل − المصاريف')}
        ${card('الصافي المتوقع', c(t.netExpected), t.netExpected >= 0 ? 'info' : 'danger', 'قيمة العقود − المصاريف')}
      </div>
    </div>

    ${d.isAllTime ? '' : `
    <div class="card">
      <div class="card-hd"><div class="card-title">📅 حركة الفترة — ${d.periodLabel}</div></div>
      <div class="ur-grid">
        ${card('تحصيلات الفترة', c(d.periodCollected), 'gold', `${d.periodEvents.length} دفعة`)}
        ${card('مصاريف الفترة', c(d.periodCosts), 'danger', `${d.periodExpenses.length} بند`)}
        ${card('صافي الفترة', c(periodNet), periodNet >= 0 ? 'gold' : 'danger', 'تحصيلات − مصاريف')}
        ${card('مبيعات جديدة', d.newSales.length, 'info', `بقيمة ${c(d.newSalesValue)} ج.م`)}
      </div>
    </div>`}

    ${d.single || d.perProject.length < 2 ? '' : `
    <div class="card">
      <div class="card-hd"><div class="card-title">📊 المشاريع</div></div>
      <table class="ur-table">
        <thead><tr><th>المشروع</th><th>مباع / إجمالي</th><th>قيمة العقود</th><th>المحصّل</th><th>المتبقي</th><th>المتأخر</th><th>المصاريف</th><th>الصافي الفعلي</th></tr></thead>
        <tbody>${d.perProject.map(r => `
          <tr class="click" onclick="document.getElementById('ur-project').value='${r.project.id}';renderUnifiedReport()">
            <td class="ur-head">${r.project.projectName}</td>
            <td data-l="مباع / إجمالي">${r.sold} / ${r.units}</td>
            <td data-l="قيمة العقود" class="ur-num">${c(r.contracts)}</td>
            <td data-l="المحصّل" class="ur-num" style="color:var(--gold)">${c(r.collected)}</td>
            <td data-l="المتبقي" class="ur-num">${c(r.remaining)}</td>
            <td data-l="المتأخر" class="ur-num" style="color:${r.overdue > 0.01 ? 'var(--danger)' : 'inherit'}">${c(r.overdue)}</td>
            <td data-l="المصاريف" class="ur-num">${c(r.costs)}</td>
            <td data-l="الصافي الفعلي" class="ur-num" style="color:${r.netCash >= 0 ? 'var(--success)' : 'var(--danger)'}">${c(r.netCash)}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`}

    <div class="card">
      <div class="card-hd"><div class="card-title">👥 العملاء (${d.customers.length})</div></div>
      ${d.customers.length === 0 ? `<div class="empty"><p>لا توجد مبيعات</p></div>` : `
      <table class="ur-table">
        <thead><tr><th>العميل</th>${d.single ? '' : '<th>المشروع</th>'}<th>الوحدة</th><th>السعر</th><th>المدفوع</th><th>المتبقي</th><th>المتأخر</th><th>آخر دفعة</th></tr></thead>
        <tbody>${d.customers.map(r => `
          <tr class="click" onclick="showSaleInstallments('${r.sale.id}')">
            <td class="ur-head">${r.sale.customerName}</td>
            ${d.single ? '' : `<td data-l="المشروع">${r.project?.projectName || '—'}</td>`}
            <td data-l="الوحدة">${r.sale.unitType === 'apartment' ? 'شقة' : 'محل'} ${r.sale.unitNumber || ''}</td>
            <td data-l="السعر" class="ur-num">${c(r.sale.totalPrice)}</td>
            <td data-l="المدفوع" class="ur-num" style="color:var(--gold)">${c(r.paid)}</td>
            <td data-l="المتبقي" class="ur-num">${r.remaining > 0.01 ? c(r.remaining) : '✅ مسدد'}</td>
            <td data-l="المتأخر" class="ur-num" style="color:${r.overdue > 0.01 ? 'var(--danger)' : 'inherit'}">${r.overdue > 0.01 ? c(r.overdue) : '—'}</td>
            <td data-l="آخر دفعة">${r.last ? formatDate(r.last) : '—'}</td>
          </tr>`).join('')}</tbody>
      </table>`}
    </div>

    <div class="card">
      <div class="card-hd"><div class="card-title">💰 التحصيلات — ${d.periodLabel} (${d.periodEvents.length})</div></div>
      ${d.periodEvents.length === 0 ? `<div class="empty"><p>لا توجد تحصيلات في هذه الفترة</p></div>` : `
      <table class="ur-table">
        <thead><tr><th>العميل</th><th>التاريخ</th>${d.single ? '' : '<th>المشروع</th>'}<th>المبلغ</th><th>ملاحظة</th></tr></thead>
        <tbody>${d.periodEvents.map(e => `
          <tr class="click" onclick="showSaleInstallments('${e.sale.id}')">
            <td class="ur-head">${e.sale.customerName}</td>
            <td data-l="التاريخ">${formatDate(e.date)}</td>
            ${d.single ? '' : `<td data-l="المشروع">${d.projectName(e.sale.projectId)}</td>`}
            <td data-l="المبلغ" class="ur-num" style="color:var(--success)">${c(e.amount)}</td>
            <td data-l="ملاحظة">${e.note || ''}</td>
          </tr>`).join('')}</tbody>
      </table>
      <div class="ur-total"><span>إجمالي التحصيلات</span><span class="ur-num" style="color:var(--success)">${c(d.periodCollected)} ج.م</span></div>`}
    </div>

    <div class="card">
      <div class="card-hd"><div class="card-title">💸 المصاريف — ${d.periodLabel} (${d.periodExpenses.length})</div></div>
      ${d.periodExpenses.length === 0 ? `<div class="empty"><p>لا توجد مصاريف في هذه الفترة</p></div>` : `
      <div class="expense-summary">
        ${Object.entries(d.byCat).sort((x, y) => y[1].total - x[1].total).map(([k, v]) => `
          <div class="expense-category"><span class="category-name">${k}</span><span><span class="category-count">(${v.count} بند)</span><span class="category-amount">${c(v.total)} ج.م</span></span></div>`).join('')}
      </div>
      <table class="ur-table">
        <thead><tr><th>البند</th><th>التاريخ</th>${d.single ? '' : '<th>المشروع</th>'}<th>المبلغ</th><th>المستلم</th><th>ملاحظات</th></tr></thead>
        <tbody>${d.periodExpenses.map(e => `
          <tr>
            <td class="ur-head">${getCategoryName(e.category, e.customCategory)}</td>
            <td data-l="التاريخ">${formatDate(e.date)}</td>
            ${d.single ? '' : `<td data-l="المشروع">${d.projectName(e.projectId)}</td>`}
            <td data-l="المبلغ" class="ur-num" style="color:var(--danger)">${c(e.amount)}</td>
            <td data-l="المستلم">${e.recipient || ''}</td>
            <td data-l="ملاحظات">${e.notes || ''}</td>
          </tr>`).join('')}</tbody>
      </table>
      <div class="ur-total"><span>إجمالي المصاريف</span><span class="ur-num" style="color:var(--danger)">${c(d.periodCosts)} ج.م</span></div>`}
    </div>`;
}

function printUnifiedReport() {
  const d = urLast;
  if (!d) { showToast('افتح التقرير أولاً', 'warning'); return; }
  const c = v => formatCurrency(v);
  const t = d.total;
  const box = (l, v, cls) => `<div class="summary-box ${cls}"><div class="lbl">${l}</div><div class="val">${v}</div></div>`;
  const dateStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const periodNet = d.periodCollected - d.periodCosts;

  const html = `
    <div class="pdf-header">
      <h1>تقرير ${d.projectLabel}</h1>
      <p>الفترة: ${d.periodLabel}</p>
      <div class="pdf-meta" style="color:#fff;opacity:.8"><span>تاريخ الإصدار: ${dateStr}</span></div>
    </div>

    <div class="section-title">الوضع الحالي</div>
    <div class="summary-boxes">
      ${box('الوحدات (مباع / إجمالي)', `${t.sold} / ${t.units}`, 'green')}
      ${box('قيمة العقود', c(t.contracts), 'gold')}
      ${box('المحصّل', c(t.collected), 'green')}
      ${box('المتبقي تحصيله', c(t.remaining), 'red')}
      ${box('المتأخر', c(t.overdue), 'red')}
      ${box('المصاريف', c(t.costs), 'red')}
      ${box('الصافي الفعلي (محصّل − مصاريف)', c(t.netCash), t.netCash >= 0 ? 'green' : 'red')}
      ${box('الصافي المتوقع (عقود − مصاريف)', c(t.netExpected), t.netExpected >= 0 ? 'gold' : 'red')}
    </div>

    ${d.isAllTime ? '' : `
    <div class="section-title">حركة الفترة — ${d.periodLabel}</div>
    <div class="summary-boxes">
      ${box('تحصيلات الفترة', c(d.periodCollected), 'green')}
      ${box('مصاريف الفترة', c(d.periodCosts), 'red')}
      ${box('صافي الفترة', c(periodNet), periodNet >= 0 ? 'green' : 'red')}
    </div>`}

    ${d.single || d.perProject.length < 2 ? '' : `
    <div class="section-title">المشاريع</div>
    <table><thead><tr><th>المشروع</th><th>مباع/إجمالي</th><th>قيمة العقود</th><th>المحصّل</th><th>المتبقي</th><th>المتأخر</th><th>المصاريف</th><th>الصافي الفعلي</th></tr></thead>
    <tbody>${d.perProject.map(r => `<tr><td style="font-weight:700">${r.project.projectName}</td><td>${r.sold} / ${r.units}</td><td>${c(r.contracts)}</td><td>${c(r.collected)}</td><td>${c(r.remaining)}</td><td>${c(r.overdue)}</td><td>${c(r.costs)}</td><td style="font-weight:700">${c(r.netCash)}</td></tr>`).join('')}</tbody></table>`}

    <div class="section-title">العملاء (${d.customers.length})</div>
    <table><thead><tr><th>#</th><th>العميل</th>${d.single ? '' : '<th>المشروع</th>'}<th>الوحدة</th><th>السعر</th><th>المدفوع</th><th>المتبقي</th><th>المتأخر</th><th>آخر دفعة</th></tr></thead>
    <tbody>${d.customers.map((r, i) => `<tr class="${r.overdue > 0.01 ? 'overdue' : ''}"><td>${i + 1}</td><td style="font-weight:700">${r.sale.customerName}</td>${d.single ? '' : `<td>${r.project?.projectName || '—'}</td>`}<td>${r.sale.unitType === 'apartment' ? 'شقة' : 'محل'} ${r.sale.unitNumber || ''}</td><td>${c(r.sale.totalPrice)}</td><td>${c(r.paid)}</td><td>${c(Math.max(r.remaining, 0))}</td><td>${r.overdue > 0.01 ? c(r.overdue) : '—'}</td><td>${r.last ? formatDate(r.last) : '—'}</td></tr>`).join('')}</tbody></table>

    <div class="section-title">التحصيلات — ${d.periodLabel} (${d.periodEvents.length})</div>
    ${d.periodEvents.length === 0 ? '<p>لا توجد تحصيلات في هذه الفترة</p>' : `
    <table><thead><tr><th>التاريخ</th><th>العميل</th>${d.single ? '' : '<th>المشروع</th>'}<th>المبلغ</th><th>ملاحظة</th></tr></thead>
    <tbody>${d.periodEvents.map(e => `<tr><td>${formatDate(e.date)}</td><td style="font-weight:700">${e.sale.customerName}</td>${d.single ? '' : `<td>${d.projectName(e.sale.projectId)}</td>`}<td>${c(e.amount)}</td><td>${e.note || ''}</td></tr>`).join('')}
    <tr><td colspan="${d.single ? 2 : 3}" style="font-weight:700">الإجمالي</td><td colspan="2" style="font-weight:700">${c(d.periodCollected)} ج.م</td></tr></tbody></table>`}

    <div class="section-title">المصاريف — ${d.periodLabel} (${d.periodExpenses.length})</div>
    ${d.periodExpenses.length === 0 ? '<p>لا توجد مصاريف في هذه الفترة</p>' : `
    <table><thead><tr><th>الفئة</th><th>عدد البنود</th><th>الإجمالي</th></tr></thead>
    <tbody>${Object.entries(d.byCat).sort((x, y) => y[1].total - x[1].total).map(([k, v]) => `<tr><td style="font-weight:700">${k}</td><td>${v.count}</td><td>${c(v.total)} ج.م</td></tr>`).join('')}</tbody></table>
    <table><thead><tr><th>التاريخ</th><th>البند</th>${d.single ? '' : '<th>المشروع</th>'}<th>المبلغ</th><th>المستلم</th><th>ملاحظات</th></tr></thead>
    <tbody>${d.periodExpenses.map(e => `<tr><td>${formatDate(e.date)}</td><td>${getCategoryName(e.category, e.customCategory)}</td>${d.single ? '' : `<td>${d.projectName(e.projectId)}</td>`}<td>${c(e.amount)}</td><td>${e.recipient || ''}</td><td>${e.notes || ''}</td></tr>`).join('')}
    <tr><td colspan="${d.single ? 2 : 3}" style="font-weight:700">الإجمالي</td><td colspan="3" style="font-weight:700">${c(d.periodCosts)} ج.م</td></tr></tbody></table>`}

    <div class="footer"><span>نظام إدارة المشاريع العقارية</span><span>${dateStr}</span></div>`;

  openPrintWindow(html, `تقرير ${d.projectLabel} - ${d.periodLabel}`);
}

// ============================================================
// EXCEL EXPORT — نفس بيانات التقرير المعروض (المشروع + الفترة)
// ============================================================
const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
function loadXlsxLib() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = XLSX_URL;
    s.onload = resolve;
    s.onerror = () => reject(new Error('xlsx load failed'));
    document.head.appendChild(s);
  });
}

async function exportUnifiedExcel() {
  const d = urLast;
  if (!d) { showToast('افتح التقرير أولاً', 'warning'); return; }
  showLoading();
  try {
    await loadXlsxLib();
  } catch (e) {
    hideLoading();
    showToast('تعذر تحميل مكتبة Excel — تأكد من الاتصال بالإنترنت', 'error');
    return;
  }
  const r2 = v => Math.round((v || 0) * 100) / 100;
  const t = d.total;

  const summary = [
    ['التقرير', d.projectLabel], ['الفترة', d.periodLabel], ['تاريخ الإصدار', todayStr()], [],
    ['الوضع الحالي', ''],
    ['إجمالي الوحدات', t.units], ['الوحدات المباعة', t.sold], ['الوحدات المحجوزة', t.reserved], ['الوحدات المتاحة', t.available],
    ['قيمة العقود', r2(t.contracts)], ['المحصّل', r2(t.collected)], ['المتبقي تحصيله', r2(t.remaining)],
    ['المتأخر', r2(t.overdue)], ['المصاريف', r2(t.costs)],
    ['الصافي الفعلي (محصّل − مصاريف)', r2(t.netCash)], ['الصافي المتوقع (عقود − مصاريف)', r2(t.netExpected)], [],
    [`حركة الفترة — ${d.periodLabel}`, ''],
    ['تحصيلات الفترة', r2(d.periodCollected)], ['مصاريف الفترة', r2(d.periodCosts)], ['صافي الفترة', r2(d.periodCollected - d.periodCosts)]
  ];

  const customers = [['العميل', 'الهاتف', 'المشروع', 'نوع الوحدة', 'رقم الوحدة', 'تاريخ البيع', 'السعر', 'المدفوع', 'المتبقي', 'المتأخر', 'آخر دفعة']]
    .concat(d.customers.map(r => [
      r.sale.customerName, r.sale.customerPhone || '', r.project?.projectName || '',
      r.sale.unitType === 'apartment' ? 'شقة' : 'محل', r.sale.unitNumber || '', r.sale.saleDate || '',
      r2(r.sale.totalPrice), r2(r.paid), r2(Math.max(r.remaining, 0)), r2(r.overdue), r.last || ''
    ]));

  const collections = [['التاريخ', 'العميل', 'المشروع', 'رقم الوحدة', 'المبلغ', 'ملاحظة']]
    .concat(d.periodEvents.map(e => [e.date, e.sale.customerName, d.projectName(e.sale.projectId), e.sale.unitNumber || '', r2(e.amount), e.note || '']))
    .concat([['', '', '', 'الإجمالي', r2(d.periodCollected), '']]);

  const plainCat = e => getCategoryName(e.category, e.customCategory).replace(/^[^؀-ۿa-zA-Z0-9]+/, '');
  const expensesSheet = [['التاريخ', 'الفئة', 'المشروع', 'المبلغ', 'المستلم', 'ملاحظات']]
    .concat(d.periodExpenses.map(e => [e.date, plainCat(e), d.projectName(e.projectId), r2(e.amount), e.recipient || '', e.notes || '']))
    .concat([['', '', 'الإجمالي', r2(d.periodCosts), '', '']]);

  const wb = XLSX.utils.book_new();
  const add = (name, rows, widths) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = widths.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add('الملخص', summary, [34, 22]);
  add('العملاء', customers, [26, 15, 20, 10, 11, 12, 14, 14, 14, 14, 12]);
  add('التحصيلات', collections, [12, 26, 20, 11, 14, 30]);
  add('المصاريف', expensesSheet, [12, 18, 20, 14, 20, 34]);
  wb.Workbook = { Views: [{ RTL: true }] };

  const safe = s => String(s).replace(/[\\/:*?"<>|]/g, '-');
  XLSX.writeFile(wb, `تقرير ${safe(d.projectLabel)} - ${safe(d.periodLabel)}.xlsx`);
  hideLoading();
  showToast('تم تنزيل ملف Excel');
}

// ============================================================
// EXPENSES PAGE — صفحة مصاريف مستقلة
// ============================================================
async function refreshAfterExpenseChange(projectId) {
  await loadData();
  if (document.getElementById('project-details-modal')?.classList.contains('active') && projectId) await showProjectDetails(projectId);
  if (document.getElementById('expenses-view')?.classList.contains('active')) renderExpensesPage();
  if (document.getElementById('expense-files-modal')?.classList.contains('active')) renderExpenseFiles(document.getElementById('expense-files-modal').dataset.expenseId);
  updateDashboard();
}

function populateExpenseFilters() {
  const projSel = document.getElementById('exp-filter-project');
  const catSel = document.getElementById('exp-filter-category');
  if (!projSel || !catSel) return;
  const curP = projSel.value, curC = catSel.value;
  projSel.innerHTML = '<option value="">كل المشاريع</option>' + projects.map(p => `<option value="${p.id}">${p.projectName}</option>`).join('');
  if (projects.some(p => p.id === curP)) projSel.value = curP;
  const cats = [...new Set(allExpenses.map(e => getCategoryName(e.category, e.customCategory)))].sort();
  catSel.innerHTML = '<option value="">كل الفئات</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  if (cats.includes(curC)) catSel.value = curC;
}

function clearExpenseFilters() {
  ['exp-search', 'exp-filter-project', 'exp-filter-category', 'exp-filter-month'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderExpensesPage();
}

function renderExpensesPage() {
  const list = document.getElementById('expenses-list');
  if (!list) return;
  populateExpenseFilters();
  const q = (document.getElementById('exp-search').value || '').trim().toLowerCase();
  const pid = document.getElementById('exp-filter-project').value;
  const cat = document.getElementById('exp-filter-category').value;
  const month = document.getElementById('exp-filter-month').value;

  const rows = allExpenses.filter(e => {
    if (pid && e.projectId !== pid) return false;
    if (cat && getCategoryName(e.category, e.customCategory) !== cat) return false;
    if (month && !String(e.date || '').startsWith(month)) return false;
    if (q && !`${e.recipient || ''} ${e.notes || ''} ${getCategoryName(e.category, e.customCategory)}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const total = rows.reduce((s, e) => s + e.amount, 0);

  document.getElementById('expenses-total').innerHTML =
    `<span>${rows.length} بند${rows.length !== allExpenses.length ? ` من ${allExpenses.length}` : ''}</span><span class="ur-num" style="color:var(--danger)">${formatCurrency(total)} ج.م</span>`;

  if (rows.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">💸</div><p>${allExpenses.length === 0 ? 'لا توجد مصروفات بعد' : 'لا توجد نتائج'}</p></div>`;
    return;
  }

  list.innerHTML = rows.map(e => {
    const proj = projects.find(p => p.id === e.projectId);
    const n = (e.files || []).length;
    return `
      <div class="expense-item" style="background:var(--bg-card);border:1px solid var(--border)">
        <div class="expense-details">
          <div class="expense-category-label">${getCategoryName(e.category, e.customCategory)}</div>
          <div class="expense-date">${formatDate(e.date)} <span class="badge badge-blue" style="margin-right:.3rem">${proj?.projectName || '—'}</span></div>
          ${e.recipient ? `<div class="expense-recipient">👤 ${e.recipient}</div>` : ''}
          ${e.notes ? `<div class="expense-recipient">📝 ${e.notes}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.4rem">
          <span class="expense-amount-display" style="color:var(--danger)">${formatCurrency(e.amount)} ج.م</span>
          <div class="expense-actions">
            <button class="btn btn-ghost btn-xs" onclick="openExpenseFiles('${e.id}')">📎 فاتورة${n ? ` (${n})` : ''}</button>
            <button class="btn btn-warning btn-xs" onclick="openEditExpenseModal('${e.projectId}','${e.id}')">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="deleteExpense('${e.projectId}','${e.id}')">🗑️</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── فواتير المصروف ────────────────────────────────────────
function openExpenseFiles(expenseId) {
  let modal = document.getElementById('expense-files-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'expense-files-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:640px">
        <div class="modal-hd"><div class="modal-title">📎 فواتير المصروف</div><button class="modal-close" onclick="closeModal('expense-files-modal')">×</button></div>
        <div id="expense-files-body"></div>
      </div>`;
    document.body.appendChild(modal);
  }
  modal.dataset.expenseId = expenseId;
  renderExpenseFiles(expenseId);
  modal.classList.add('active');
}

function renderExpenseFiles(expenseId) {
  const body = document.getElementById('expense-files-body');
  const e = allExpenses.find(x => x.id === expenseId);
  if (!body || !e) return;
  const files = e.files || [];
  body.innerHTML = `
    <div style="font-size:.88rem;color:var(--text-muted);margin-bottom:1rem">${getCategoryName(e.category, e.customCategory)} — ${formatCurrency(e.amount)} ج.م — ${formatDate(e.date)}</div>
    <label class="btn btn-primary" style="cursor:pointer;margin-bottom:.4rem">
      📤 رفع فاتورة (صورة أو PDF)
      <input type="file" accept="image/*,.pdf" style="display:none" onchange="uploadExpenseFile(this, '${expenseId}')">
    </label>
    <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:1rem">JPG, PNG, PDF — حجم أقصى 10MB</div>
    ${files.length === 0 ? `<div class="empty" style="padding:1.5rem"><p>لا توجد فواتير مرفوعة</p></div>` : files.map(f => `
      <div class="pay-row" style="border-right-color:var(--info)">
        <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.type === 'pdf' ? '📄' : '🖼️'} ${f.name}</div>
        <div style="display:flex;gap:.3rem;flex-shrink:0">
          <button class="btn btn-secondary btn-xs" onclick="openStoredFile('${f.path}')">👁️ عرض</button>
          <button class="btn btn-danger btn-xs" onclick="removeExpenseFile('${expenseId}', '${f.path}')">🗑️</button>
        </div>
      </div>`).join('')}`;
}

async function uploadExpenseFile(input, expenseId) {
  const file = input.files[0];
  if (!file) return;
  showLoading();
  const info = await DB.uploadFile(file, `expenses/${expenseId}`);
  if (info) {
    const ok = await DB.addExpenseFile(expenseId, info);
    if (ok) {
      await refreshAfterExpenseChange(null);
      showToast('تم رفع الفاتورة');
    } else {
      await DB.deleteFile(info.path);
      showToast('تعذر حفظ الفاتورة — لازم تشغيل سكريبت قاعدة البيانات (expenses_files_migration.sql) أولاً', 'error', 6000);
    }
  }
  input.value = '';
  hideLoading();
}

async function removeExpenseFile(expenseId, filePath) {
  if (!confirm('هل تريد حذف هذه الفاتورة؟')) return;
  showLoading();
  const ok = await DB.deleteExpenseFile(expenseId, filePath);
  if (ok) { await refreshAfterExpenseChange(null); showToast('تم حذف الفاتورة'); }
  else showToast('حدث خطأ', 'error');
  hideLoading();
}

// ============================================================
// UNITS — الوحدات: شبكة بالأدوار، إضافة/تعديل، توليد سريع، حجز
// ============================================================
const UNIT_STATUS = {
  available: { label: 'متاحة', cls: 'u-available' },
  reserved:  { label: 'محجوزة', cls: 'u-reserved' },
  sold:      { label: 'مباعة', cls: 'u-sold' }
};
let unitsFilter = '';

const normUnitNo = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '');

// مفتاح الوحدة داخل المشروع: الدور + الرقم (الرقم ممكن يتكرر في كل دور)
const unitKey = u => `${parseInt(u.floor) || 0}|${normUnitNo(u.unitNumber)}`;

// البيعة المرتبطة بالوحدة:
// 1) الربط المباشر (sale_id)
// 2) تطابق رقم الوحدة داخل المشروع — فقط لو الرقم غير مكرر في أدوار أخرى والبيعة غير مربوطة بوحدة ثانية
function getUnitSale(unit) {
  if (unit.saleId) { const s = sales.find(x => x.id === unit.saleId); if (s) return s; }
  const key = normUnitNo(unit.unitNumber);
  if (!key) return null;
  const sameNo = units.filter(u => u.projectId === unit.projectId && normUnitNo(u.unitNumber) === key);
  if (sameNo.length > 1) return null;
  return sales.find(s => s.projectId === unit.projectId && normUnitNo(s.unitNumber) === key &&
    !units.some(u => u.saleId === s.id && u.id !== unit.id)) || null;
}

// بيعات المشروع التي لم ترتبط بأي وحدة بعد
function getUnlinkedSales(projectId) {
  const list = units.filter(u => u.projectId === projectId);
  const taken = new Set(list.map(u => getUnitSale(u)?.id).filter(Boolean));
  return sales.filter(s => s.projectId === projectId && !taken.has(s.id));
}

// الحالة الفعلية: لو فيه بيعة على الوحدة فهي مباعة مهما كانت الحالة المسجلة
function getUnitStatus(unit) {
  return getUnitSale(unit) ? 'sold' : (UNIT_STATUS[unit.status] ? unit.status : 'available');
}

function floorLabel(f) { return parseInt(f) === 0 ? 'الدور الأرضي' : `الدور ${f}`; }

function sortUnits(list) {
  return list.slice().sort((x, y) => (x.floor - y.floor) ||
    String(x.unitNumber).localeCompare(String(y.unitNumber), 'en', { numeric: true }));
}

function ensureUnitsModals() {
  if (document.getElementById('units-modal')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="units-modal" class="modal">
      <div class="modal-box" style="max-width:1000px">
        <div class="modal-hd"><div class="modal-title" id="units-modal-title">الوحدات</div><button class="modal-close" onclick="closeModal('units-modal')">×</button></div>
        <div id="units-modal-content"></div>
      </div>
    </div>
    <div id="unit-form-modal" class="modal" style="z-index:2100">
      <div class="modal-box" style="max-width:560px">
        <div class="modal-hd"><div class="modal-title" id="unit-form-title">وحدة</div><button class="modal-close" onclick="closeModal('unit-form-modal')">×</button></div>
        <form id="unit-form" onsubmit="saveUnit(event)">
          <input type="hidden" name="unitId"><input type="hidden" name="projectId">
          <div class="form-grid">
            <div class="form-group"><label class="form-label">رقم الوحدة *</label><input type="text" class="form-control" name="unitNumber" required placeholder="مثال: 101A"></div>
            <div class="form-group"><label class="form-label">النوع</label><select class="form-control" name="unitType"><option value="apartment">🏠 شقة</option><option value="shop">🏪 محل</option></select></div>
            <div class="form-group"><label class="form-label">الدور</label><input type="number" class="form-control" name="floor" min="0" inputmode="numeric" placeholder="0 = أرضي"></div>
            <div class="form-group"><label class="form-label">النموذج</label><input type="text" class="form-control" name="model" placeholder="مثال: A"></div>
            <div class="form-group"><label class="form-label">المساحة (م²)</label><input type="number" class="form-control" name="area" min="0" step="0.01" inputmode="decimal"></div>
            <div class="form-group"><label class="form-label">الاتجاه / الواجهة</label><input type="text" class="form-control" name="direction" placeholder="اختياري"></div>
          </div>
          <div id="unit-sold-info"></div>
          <div class="form-group" id="unit-sale-group" style="margin-top:1rem"><label class="form-label">البيعة المرتبطة</label>
            <select class="form-control" name="saleId" onchange="onUnitSaleLinkChange()"></select>
          </div>
          <div class="form-group" id="unit-status-group" style="margin:1rem 0"><label class="form-label">الحالة</label>
            <select class="form-control" name="status" onchange="toggleUnitReserveFields()">
              <option value="available">🟢 متاحة</option><option value="reserved">🟡 محجوزة</option><option value="sold">🔴 مباعة</option>
            </select>
          </div>
          <div id="unit-reserve-fields" class="gen-box" style="display:none">
            <div class="ledger-title" style="margin:0 0 .6rem">🟡 بيانات الحجز</div>
            <div class="form-grid">
              <div class="form-group"><label class="form-label">اسم الحاجز</label><input type="text" class="form-control" name="reservedBy"></div>
              <div class="form-group"><label class="form-label">التليفون</label><input type="tel" class="form-control" name="reservedPhone" inputmode="tel"></div>
              <div class="form-group"><label class="form-label">مبلغ الحجز (لو دفع)</label><input type="number" class="form-control" name="reservedAmount" min="0" step="0.01" inputmode="decimal" placeholder="0"></div>
              <div class="form-group"><label class="form-label">تاريخ الحجز</label><input type="date" class="form-control" name="reservedDate"></div>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:1.25rem"><label class="form-label">ملاحظات</label><input type="text" class="form-control" name="notes"></div>
          <div style="display:flex;gap:.6rem;flex-wrap:wrap">
            <button type="submit" class="btn btn-primary" style="flex:1;justify-content:center">💾 حفظ</button>
            <button type="button" class="btn btn-danger" id="unit-delete-btn" onclick="deleteUnitFromForm()">🗑️ حذف</button>
          </div>
        </form>
      </div>
    </div>
    <div id="units-gen-modal" class="modal" style="z-index:2100">
      <div class="modal-box" style="max-width:560px">
        <div class="modal-hd"><div class="modal-title">⚡ توليد وحدات</div><button class="modal-close" onclick="closeModal('units-gen-modal')">×</button></div>
        <input type="hidden" id="ug-project">
        <div class="form-group" style="margin-bottom:1rem"><label class="form-label">طريقة الترقيم</label>
          <select class="form-control" id="ug-scheme" onchange="updateUnitsGenPreview()">
            <option value="floor">دور + رقم — 101، 102 … 201، 202</option>
            <option value="letters">دور + رقم + حرف النموذج — 101A، 201A … 101B</option>
            <option value="repeat">نفس الأرقام في كل دور — 1، 2، 3 ثم 1، 2، 3</option>
            <option value="seq">أرقام متسلسلة على كل الأدوار — 1، 2، 3 … 16</option>
          </select>
        </div>
        <div class="form-grid">
          <div class="form-group"><label class="form-label">عدد الأدوار</label><input type="number" class="form-control" id="ug-floors" min="1" max="60" value="4" inputmode="numeric" oninput="updateUnitsGenPreview()"></div>
          <div class="form-group"><label class="form-label">يبدأ من الدور</label><input type="number" class="form-control" id="ug-first" min="0" max="60" value="1" inputmode="numeric" oninput="updateUnitsGenPreview()"></div>
          <div class="form-group" id="ug-per-group"><label class="form-label">عدد الشقق في الدور</label><input type="number" class="form-control" id="ug-per" min="1" max="50" value="4" inputmode="numeric" oninput="updateUnitsGenPreview()"></div>
          <div class="form-group" id="ug-letters-group" style="display:none"><label class="form-label">حروف النماذج</label><input type="text" class="form-control" id="ug-letters" value="A, B" placeholder="A, B" oninput="updateUnitsGenPreview()"></div>
          <div class="form-group" id="ug-letter-counts-group" style="display:none;grid-column:1/-1"><label class="form-label">عدد الشقق في الدور لكل نموذج</label><div id="ug-letter-counts" style="display:flex;gap:.5rem;flex-wrap:wrap"></div></div>
          <div class="form-group"><label class="form-label">النوع</label><select class="form-control" id="ug-type"><option value="apartment">🏠 شقة</option><option value="shop">🏪 محل</option></select></div>
          <div class="form-group"><label class="form-label">المساحة (اختياري)</label><input type="number" class="form-control" id="ug-area" min="0" step="0.01" inputmode="decimal" placeholder="نفس المساحة للكل"></div>
        </div>
        <div class="info-box" id="ug-preview" style="margin-top:1rem"></div>
        <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="saveGeneratedUnits()">💾 إضافة الوحدات</button>
      </div>
    </div>`;
  while (wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
}

function openUnitsModal(projectId) {
  ensureUnitsModals();
  unitsFilter = '';
  document.getElementById('units-modal').dataset.projectId = projectId;
  renderUnitsModal();
  document.getElementById('units-modal').classList.add('active');
}

function setUnitsFilter(f) { unitsFilter = unitsFilter === f ? '' : f; renderUnitsModal(); }

function renderUnitsModal() {
  const modal = document.getElementById('units-modal');
  if (!modal) return;
  const projectId = modal.dataset.projectId;
  const project = projects.find(p => p.id === projectId);
  if (!project) return;
  document.getElementById('units-modal-title').textContent = `🏠 الوحدات — ${project.projectName}`;

  const list = sortUnits(units.filter(u => u.projectId === projectId));
  const counts = { available: 0, reserved: 0, sold: 0 };
  list.forEach(u => counts[getUnitStatus(u)]++);

  // بيعات في المشروع ليس لها وحدة مسجلة بنفس الرقم
  const orphanSales = list.length ? getUnlinkedSales(projectId) : [];

  const chip = (key, color) => `<button type="button" class="u-chip ${unitsFilter === key ? 'on' : ''}" onclick="setUnitsFilter('${key}')"><span class="u-dot" style="background:${color}"></span>${UNIT_STATUS[key].label} <b>${counts[key]}</b></button>`;

  const shown = unitsFilter ? list.filter(u => getUnitStatus(u) === unitsFilter) : list;
  const floors = [...new Set(shown.map(u => u.floor))].sort((x, y) => x - y);

  const grid = list.length === 0
    ? `<div class="empty"><div class="empty-icon">🏠</div><p>لا توجد وحدات مسجلة لهذا المشروع بعد.<br>استخدم "توليد وحدات" لإضافتها مرة واحدة.</p></div>`
    : shown.length === 0 ? `<div class="empty"><p>لا توجد وحدات بهذه الحالة</p></div>`
    : floors.map(f => `
      <div class="u-floor">
        <div class="u-floor-label">${floorLabel(f)}</div>
        <div class="u-grid">
          ${shown.filter(u => u.floor === f).map(u => {
            const st = getUnitStatus(u);
            const sale = getUnitSale(u);
            const who = st === 'sold' ? (sale ? shortName(sale.customerName) : '') : st === 'reserved' ? shortName(u.reservedBy) : '';
            return `<button type="button" class="u-tile ${UNIT_STATUS[st].cls}" onclick="openUnitForm('${u.id}')">
              <span class="u-no">${u.unitType === 'shop' ? '🏪 ' : ''}${u.unitNumber}</span>
              <span class="u-meta">${[u.model ? `نموذج ${u.model}` : '', u.area ? `${u.area} م²` : ''].filter(Boolean).join(' · ') || '&nbsp;'}</span>
              <span class="u-who">${who || UNIT_STATUS[st].label}</span>
            </button>`;
          }).join('')}
        </div>
      </div>`).join('');

  document.getElementById('units-modal-content').innerHTML = `
    <div class="u-toolbar">
      <div class="u-chips">
        ${chip('available', '#1a8a5f')}${chip('reserved', '#0e8f94')}${chip('sold', '#d6453d')}
        <span class="u-total">الإجمالي <b>${list.length}</b></span>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        ${list.length ? `<button class="btn btn-pdf btn-sm" onclick="printBrokerReport('${projectId}')">📤 تقرير السماسرة</button>
        <button class="btn btn-wa btn-sm" onclick="copyAvailableUnitsText('${projectId}')">📋 نسخ المتاح</button>
        <button class="btn btn-danger btn-sm" onclick="deleteAllProjectUnits('${projectId}')">🗑️ مسح الكل</button>` : ''}
        <button class="btn btn-gold btn-sm" onclick="openUnitsGenerator('${projectId}')">⚡ توليد وحدات</button>
        <button class="btn btn-primary btn-sm" onclick="openUnitForm(null, '${projectId}')">➕ وحدة</button>
      </div>
    </div>
    ${orphanSales.length ? `<div class="info-box">💡 ${orphanSales.length} بيعة في هذا المشروع غير مربوطة بوحدة: ${orphanSales.map(s => `<b>${s.unitNumber || 'بدون رقم'}</b> (${shortName(s.customerName)})`).join('، ')}.<br>افتح الوحدة المباعة واختر البيعة من "البيعة المرتبطة".</div>` : ''}
    ${grid}`;
}

function toggleUnitReserveFields() {
  const form = document.getElementById('unit-form');
  document.getElementById('unit-reserve-fields').style.display = form.status.value === 'reserved' ? 'block' : 'none';
  if (form.status.value === 'reserved' && !form.reservedDate.value) form.reservedDate.value = todayStr();
}

function openUnitForm(unitId, projectId) {
  ensureUnitsModals();
  const form = document.getElementById('unit-form');
  form.reset();
  const u = unitId ? units.find(x => x.id === unitId) : null;
  const sale = u ? getUnitSale(u) : null;
  document.getElementById('unit-form-title').textContent = u ? `وحدة ${u.unitNumber}` : 'وحدة جديدة';
  form.unitId.value = u?.id || '';
  form.projectId.value = u?.projectId || projectId;
  if (u) {
    form.unitNumber.value = u.unitNumber; form.unitType.value = u.unitType; form.floor.value = u.floor;
    form.model.value = u.model; form.area.value = u.area || ''; form.direction.value = u.direction;
    form.status.value = UNIT_STATUS[u.status] ? u.status : 'available';
    form.reservedBy.value = u.reservedBy; form.reservedPhone.value = u.reservedPhone;
    form.reservedAmount.value = u.reservedAmount || ''; form.reservedDate.value = u.reservedDate || '';
    form.notes.value = u.notes;
  }
  // قائمة البيعات المتاحة للربط: غير المربوطة + بيعة هذه الوحدة إن وجدت
  const pid = u?.projectId || projectId;
  const options = getUnlinkedSales(pid).concat(sale ? [sale] : []);
  form.saleId.innerHTML = '<option value="">— بدون —</option>' + options.map(s =>
    `<option value="${s.id}">${s.customerName}${s.unitNumber ? ` — وحدة ${s.unitNumber}` : ''}</option>`).join('');
  form.saleId.value = sale ? sale.id : '';
  document.getElementById('unit-sale-group').style.display = options.length ? '' : 'none';

  // وحدة عليها بيعة: الحالة "مباعة" تلقائياً ولا تُعدّل من هنا
  document.getElementById('unit-status-group').style.display = sale ? 'none' : '';
  document.getElementById('unit-sold-info').innerHTML = sale
    ? `<div class="info-box" style="margin-top:1rem;background:#fce8e6;border-color:var(--danger);color:#7a1f15">🔴 مباعة — ${sale.customerName}
        <button type="button" class="btn btn-ghost btn-xs" style="margin-right:.5rem" onclick="closeModal('unit-form-modal');showSaleInstallments('${sale.id}')">📋 حساب العميل</button></div>` : '';
  document.getElementById('unit-delete-btn').style.display = u ? '' : 'none';
  toggleUnitReserveFields();
  if (sale) document.getElementById('unit-reserve-fields').style.display = 'none';
  document.getElementById('unit-form-modal').classList.add('active');
}

function onUnitSaleLinkChange() {
  const form = document.getElementById('unit-form');
  const linked = !!form.saleId.value;
  document.getElementById('unit-status-group').style.display = linked ? 'none' : '';
  if (linked) document.getElementById('unit-reserve-fields').style.display = 'none';
  else toggleUnitReserveFields();
}

async function saveUnit(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const id = fd.get('unitId');
  const unit = Object.fromEntries(fd.entries());
  const existing = id ? units.find(u => u.id === id) : null;
  if (unit.saleId) unit.status = 'available';   // المباعة تُحسب من البيعة المرتبطة، لا من الحالة المسجلة
  const dup = units.find(u => u.projectId === unit.projectId && u.id !== id && unitKey(u) === unitKey(unit));
  if (dup) { showToast(`الوحدة ${unit.unitNumber} موجودة بالفعل في ${floorLabel(parseInt(unit.floor) || 0)}`, 'warning'); return; }
  if (unit.status === 'reserved' && !String(unit.reservedBy).trim()) { showToast('اكتب اسم الحاجز', 'warning'); return; }

  showLoading();
  const ok = id ? await DB.updateUnit(id, unit) : await DB.addUnits([unit]);
  if (ok) {
    await loadData();
    closeModal('unit-form-modal');
    renderUnitsModal();
    renderProjects();
    showToast(id ? 'تم حفظ الوحدة' : 'تمت إضافة الوحدة');
  }
  hideLoading();
}

async function deleteUnitFromForm() {
  const id = document.getElementById('unit-form').unitId.value;
  const u = units.find(x => x.id === id);
  if (!u) return;
  const sale = getUnitSale(u);
  const ok1 = await confirmDanger({
    title: `حذف وحدة ${u.unitNumber}`,
    lines: sale
      ? [`الوحدة عليها بيعة للعميل <b>${sale.customerName}</b>.`, 'حذف الوحدة من الجدول لا يحذف البيعة ولا دفعاتها.']
      : ['سيتم حذف الوحدة من جدول الوحدات فقط.'],
    confirmLabel: 'حذف الوحدة'
  });
  if (!ok1) return;
  showLoading();
  if (await DB.deleteUnit(id)) {
    await loadData();
    closeModal('unit-form-modal');
    renderUnitsModal();
    renderProjects();
    showToast('تم حذف الوحدة');
  }
  hideLoading();
}

async function deleteAllProjectUnits(projectId) {
  const project = projects.find(p => p.id === projectId);
  const list = units.filter(u => u.projectId === projectId);
  if (!project || list.length === 0) return;
  const reserved = list.filter(u => getUnitStatus(u) === 'reserved').length;
  const linked = list.filter(u => u.saleId).length;
  const ok1 = await confirmDanger({
    title: `مسح كل وحدات "${project.projectName}"`,
    lines: [
      `سيتم حذف <b>${list.length}</b> وحدة من جدول الوحدات.`,
      reserved ? `منها <b>${reserved}</b> وحدة محجوزة — بيانات الحجز ستُحذف.` : '',
      linked ? `منها <b>${linked}</b> وحدة مربوطة ببيعة يدوياً — الربط سيُحذف.` : '',
      'المبيعات والدفعات والمصاريف لا تتأثر.'
    ].filter(Boolean),
    requireText: 'حذف',
    confirmLabel: 'مسح الوحدات'
  });
  if (!ok1) return;
  showLoading();
  if (await DB.deleteProjectUnits(projectId)) {
    await loadData();
    renderUnitsModal();
    renderProjects();
    showToast(`تم مسح ${list.length} وحدة`);
  }
  hideLoading();
}

// ── اختيار الوحدة عند تسجيل بيعة ─────────────────────────
function unitDisplayLabel(u) {
  return [u.unitNumber, floorLabel(u.floor), u.model ? `نموذج ${u.model}` : '', u.area ? `${u.area} م²` : ''].filter(Boolean).join(' — ');
}

// رقم الوحدة كما يُحفظ على البيعة: يضاف الدور لو الرقم مكرر في أكثر من دور
function unitNumberForSale(u) {
  const repeated = units.filter(x => x.projectId === u.projectId && normUnitNo(x.unitNumber) === normUnitNo(u.unitNumber)).length > 1;
  return repeated ? `${u.unitNumber} - ${floorLabel(u.floor)}` : u.unitNumber;
}

function populateSaleUnitPicker() {
  const form = document.getElementById('add-sale-form');
  const group = document.getElementById('sale-unit-picker-group');
  const sel = document.getElementById('sale-unit-picker');
  if (!form || !group || !sel) return;
  const projectId = form.projectId.value;
  const open = sortUnits(units.filter(u => u.projectId === projectId)).filter(u => getUnitStatus(u) !== 'sold');
  const hasUnits = units.some(u => u.projectId === projectId);
  group.style.display = hasUnits ? '' : 'none';
  sel.innerHTML = '<option value="">اختر الوحدة</option>' +
    open.map(u => `<option value="${u.id}">${unitDisplayLabel(u)}${getUnitStatus(u) === 'reserved' ? ` — 🟡 محجوزة: ${shortName(u.reservedBy)}` : ''}</option>`).join('') +
    '<option value="__manual">✏️ وحدة غير موجودة في الجدول (كتابة يدوية)</option>';
  sel.required = hasUnits;
  form.unitNumber.value = '';
  document.getElementById('sale-unit-number-group').style.display = hasUnits ? 'none' : '';
}

function onSaleUnitPicked() {
  const form = document.getElementById('add-sale-form');
  const v = document.getElementById('sale-unit-picker').value;
  const manual = v === '__manual';
  document.getElementById('sale-unit-number-group').style.display = manual ? '' : 'none';
  if (manual || !v) { form.unitNumber.value = ''; return; }
  const u = units.find(x => x.id === v);
  if (!u) return;
  form.unitNumber.value = unitNumberForSale(u);
  if (![...form.unitType.options].some(o => o.value === u.unitType)) form.unitType.innerHTML += `<option value="${u.unitType}">${u.unitType === 'shop' ? '🏪 محل' : '🏠 شقة'}</option>`;
  form.unitType.value = u.unitType;
  // وحدة محجوزة: املأ بيانات العميل من الحجز لو الخانات فاضية
  if (u.status === 'reserved') {
    if (!form.customerName.value && u.reservedBy) form.customerName.value = u.reservedBy;
    if (!form.customerPhone.value && u.reservedPhone) form.customerPhone.value = u.reservedPhone;
    if (u.reservedAmount > 0) showToast(`الوحدة محجوزة بمبلغ ${formatCurrency(u.reservedAmount)} ج.م — احسبه ضمن المقدم لو لزم`, 'info', 6000);
  }
}

// ── التوليد السريع ───────────────────────────────────────
function openUnitsGenerator(projectId) {
  ensureUnitsModals();
  document.getElementById('ug-project').value = projectId;
  updateUnitsGenPreview();
  document.getElementById('units-gen-modal').classList.add('active');
}

function getGenLetters() {
  return [...new Set(document.getElementById('ug-letters').value.split(/[\s,،]+/).map(s => s.trim().toUpperCase()).filter(Boolean))];
}

// خانة عدد لكل حرف نموذج (A=8، B=7 ...) مع الحفاظ على ما كتبه المستخدم
function renderGenLetterCounts() {
  const box = document.getElementById('ug-letter-counts');
  const old = {};
  box.querySelectorAll('input').forEach(i => { old[i.dataset.letter] = i.value; });
  const def = document.getElementById('ug-per').value || 4;
  box.innerHTML = getGenLetters().map(L => `
    <label style="display:flex;align-items:center;gap:.35rem;font-weight:700;color:var(--primary)">${L}
      <input type="number" class="form-control" data-letter="${L}" min="1" max="50" value="${old[L] || def}" inputmode="numeric" style="width:76px;padding:.5rem" oninput="updateUnitsGenPreview(true)">
    </label>`).join('');
}

function buildGeneratedUnits() {
  const projectId = document.getElementById('ug-project').value;
  const scheme = document.getElementById('ug-scheme').value;
  const floors = Math.min(parseInt(document.getElementById('ug-floors').value) || 0, 60);
  const first = parseInt(document.getElementById('ug-first').value) || 0;
  const per = Math.min(parseInt(document.getElementById('ug-per').value) || 0, 50);
  const unitType = document.getElementById('ug-type').value;
  const area = parseFloat(document.getElementById('ug-area').value) || 0;
  const out = [];
  if (floors < 1) return out;
  const mk = (unitNumber, floor, model = '') => out.push({ projectId, unitNumber: String(unitNumber), unitType, floor, area, model, status: 'available' });
  const pad = n => String(n).padStart(2, '0');

  if (scheme === 'letters') {
    const counts = {};
    document.querySelectorAll('#ug-letter-counts input').forEach(i => { counts[i.dataset.letter] = Math.min(parseInt(i.value) || 0, 50); });
    for (const L of getGenLetters()) for (let i = 1; i <= (counts[L] || 0); i++) for (let f = 0; f < floors; f++) mk(`${first + f}${pad(i)}${L}`, first + f, L);
    return out;
  }
  if (per < 1) return out;
  if (scheme === 'seq') {
    let n = 1;
    for (let f = 0; f < floors; f++) for (let i = 0; i < per; i++) mk(n++, first + f);
  } else if (scheme === 'repeat') {
    for (let f = 0; f < floors; f++) for (let i = 1; i <= per; i++) mk(i, first + f);
  } else {
    for (let f = 0; f < floors; f++) for (let i = 1; i <= per; i++) mk(`${first + f}${pad(i)}`, first + f);
  }
  return out;
}

function updateUnitsGenPreview(keepCounts = false) {
  const scheme = document.getElementById('ug-scheme').value;
  const isLetters = scheme === 'letters';
  document.getElementById('ug-letters-group').style.display = isLetters ? '' : 'none';
  document.getElementById('ug-letter-counts-group').style.display = isLetters ? '' : 'none';
  document.getElementById('ug-per-group').style.display = isLetters ? 'none' : '';
  if (isLetters && !keepCounts) renderGenLetterCounts();
  const gen = buildGeneratedUnits();
  const projectId = document.getElementById('ug-project').value;
  const have = new Set(units.filter(u => u.projectId === projectId).map(unitKey));
  const fresh = gen.filter(u => !have.has(unitKey(u)));
  const show = u => scheme === 'repeat' ? `${u.unitNumber} (د${u.floor})` : u.unitNumber;
  const sample = gen.slice(0, 10).map(show).join('، ');
  document.getElementById('ug-preview').innerHTML = gen.length === 0 ? 'اكتب عدد الأدوار وعدد الشقق'
    : `سيتم إضافة <b>${fresh.length}</b> وحدة${gen.length !== fresh.length ? ` (${gen.length - fresh.length} موجودة بالفعل وسيتم تخطيها)` : ''}.<br>الأرقام: ${sample}${gen.length > 10 ? ` … ${show(gen[gen.length - 1])}` : ''}`;
}

async function saveGeneratedUnits() {
  const projectId = document.getElementById('ug-project').value;
  const have = new Set(units.filter(u => u.projectId === projectId).map(unitKey));
  const fresh = buildGeneratedUnits().filter(u => !have.has(unitKey(u)));
  if (fresh.length === 0) { showToast('لا توجد وحدات جديدة للإضافة', 'warning'); return; }
  showLoading();
  const added = await DB.addUnits(fresh);
  if (added) {
    await loadData();
    closeModal('units-gen-modal');
    renderUnitsModal();
    renderProjects();
    showToast(`تمت إضافة ${added.length} وحدة`);
  }
  hideLoading();
}

// ============================================================
// BROKER REPORT — تقرير الوحدات للسماسرة
// وحدات المشروع وحالتها فقط: بدون أسعار، بدون أسماء عملاء أو حاجزين، بدون مبيعات
// ============================================================
function brokerUnitRows(projectId) {
  return sortUnits(units.filter(u => u.projectId === projectId)).map(u => ({
    number: u.unitNumber, floor: u.floor, model: u.model, area: u.area, direction: u.direction,
    type: u.unitType, status: getUnitStatus(u)
  }));
}

function printBrokerReport(projectId) {
  const project = projects.find(p => p.id === projectId);
  const rows = brokerUnitRows(projectId);
  if (!project || rows.length === 0) { showToast('لا توجد وحدات لهذا المشروع', 'warning'); return; }
  const counts = { available: 0, reserved: 0, sold: 0 };
  rows.forEach(r => counts[r.status]++);
  const colors = { available: ['#eef8f2', '#1a8a5f'], reserved: ['#fdf6e3', '#b07d12'], sold: ['#fce8e6', '#d6453d'] };
  const dateStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const floors = [...new Set(rows.map(r => r.floor))].sort((x, y) => x - y);

  const html = `
    <style>
      .br-legend{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 18px}
      .br-leg{display:flex;align-items:center;gap:6px;border:1.5px solid;border-radius:8px;padding:6px 12px;font-weight:700;font-size:13px}
      .br-floor{margin-bottom:14px;page-break-inside:avoid}
      .br-floor-label{font-weight:800;color:#0b5563;border-bottom:2px solid #0b5563;padding-bottom:4px;margin-bottom:8px;font-size:14px}
      .br-grid{display:flex;flex-wrap:wrap;gap:6px}
      .br-tile{width:104px;border:1.5px solid;border-right-width:5px;border-radius:8px;padding:6px 8px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .br-no{font-weight:900;font-size:15px;color:#16282c}
      .br-meta{font-size:10.5px;color:#555;min-height:14px}
      .br-st{font-size:11px;font-weight:800}
    </style>
    <div class="pdf-header">
      <h1>${project.projectName}</h1>
      <p>بيان الوحدات${project.location ? ` — ${project.location}` : ''}</p>
      <div class="pdf-meta" style="color:#fff;opacity:.85"><span>بتاريخ: ${dateStr}</span></div>
    </div>
    <div class="br-legend">
      ${['available', 'reserved', 'sold'].map(k => `<div class="br-leg" style="background:${colors[k][0]};border-color:${colors[k][1]};color:${colors[k][1]}">${UNIT_STATUS[k].label}: ${counts[k]}</div>`).join('')}
      <div class="br-leg" style="border-color:#999;color:#444">الإجمالي: ${rows.length}</div>
    </div>
    ${floors.map(f => `
      <div class="br-floor">
        <div class="br-floor-label">${floorLabel(f)}</div>
        <div class="br-grid">
          ${rows.filter(r => r.floor === f).map(r => `
            <div class="br-tile" style="background:${colors[r.status][0]};border-color:${colors[r.status][1]}">
              <div class="br-no">${r.type === 'shop' ? 'محل ' : ''}${r.number}</div>
              <div class="br-meta">${[r.model ? `نموذج ${r.model}` : '', r.area ? `${r.area} م²` : ''].filter(Boolean).join(' · ')}</div>
              <div class="br-st" style="color:${colors[r.status][1]}">${UNIT_STATUS[r.status].label}</div>
            </div>`).join('')}
        </div>
      </div>`).join('')}
    <div class="section-title">الوحدات المتاحة (${counts.available})</div>
    ${counts.available === 0 ? '<p>لا توجد وحدات متاحة حالياً</p>' : `
    <table><thead><tr><th>الوحدة</th><th>النوع</th><th>الدور</th><th>النموذج</th><th>المساحة</th><th>الاتجاه</th></tr></thead>
    <tbody>${rows.filter(r => r.status === 'available').map(r => `<tr><td style="font-weight:700">${r.number}</td><td>${r.type === 'shop' ? 'محل' : 'شقة'}</td><td>${floorLabel(r.floor)}</td><td>${r.model || '—'}</td><td>${r.area ? `${r.area} م²` : '—'}</td><td>${r.direction || '—'}</td></tr>`).join('')}</tbody></table>`}
    <div class="footer"><span>${project.projectName}</span><span>${dateStr}</span></div>`;

  openPrintWindow(html, `بيان وحدات ${project.projectName}`);
}

// نص جاهز للصق في واتساب: الوحدات المتاحة فقط، مجمّعة بالدور
async function copyAvailableUnitsText(projectId) {
  const project = projects.find(p => p.id === projectId);
  const rows = brokerUnitRows(projectId).filter(r => r.status === 'available');
  if (!project) return;
  const dateStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const floors = [...new Set(rows.map(r => r.floor))].sort((x, y) => x - y);
  const text = rows.length === 0
    ? `${project.projectName} — لا توجد وحدات متاحة حالياً (${dateStr})`
    : [`*${project.projectName}* — الوحدات المتاحة (${rows.length})`, `بتاريخ ${dateStr}`, '']
        .concat(floors.map(f => `*${floorLabel(f)}:* ` + rows.filter(r => r.floor === f)
          .map(r => `${r.type === 'shop' ? 'محل ' : ''}${r.number}${r.area ? ` (${r.area} م²)` : ''}`).join('، ')))
        .join('\n');
  try {
    await navigator.clipboard.writeText(text);
    showToast('تم نسخ قائمة الوحدات المتاحة — الصقها في واتساب');
  } catch (e) {
    prompt('انسخ النص:', text);
  }
}

// ============================================================
// FILE UPLOAD UI
// ============================================================

// فتح ملف مخزّن برابط مؤقت (صالح 5 دقائق) — يعمل للمسجّلين فقط
// النافذة تُفتح أولاً قبل الانتظار حتى لا يحجبها متصفح الموبايل
async function openStoredFile(path) {
  const win = window.open('', '_blank');
  if (win) win.document.write('<p style="font-family:sans-serif;text-align:center;margin-top:3rem">جاري فتح الملف...</p>');
  const { data, error } = await DB.supabase.storage.from(DB.BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    console.error('Signed URL error:', error);
    if (win) win.close();
    showToast('تعذر فتح الملف', 'error');
    return;
  }
  if (win) win.location.href = data.signedUrl;
  else location.href = data.signedUrl;
}

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
        <button type="button" class="btn btn-secondary btn-xs" onclick="openStoredFile('${f.path}')">👁️ عرض</button>
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

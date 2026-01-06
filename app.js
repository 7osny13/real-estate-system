// Database using Supabase
const DB = {
    supabase: null,
    
    init() {
        this.supabase = window.supabaseClient;
        if (!this.supabase) {
            console.error('Supabase client not initialized!');
            alert('⚠️ خطأ في الاتصال بقاعدة البيانات. تأكد من إعدادات Supabase في ملف config.js');
        }
    },
    
    // Projects
    async getProjects() {
        const { data, error } = await this.supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching projects:', error);
            return [];
        }
        
        return data.map(p => ({
            id: p.id,
            projectName: p.project_name,
            location: p.location,
            status: p.status,
            apartmentsCount: p.apartments_count,
            shopsCount: p.shops_count,
            createdAt: p.created_at
        }));
    },
    
    async addProject(project) {
        const projectData = {
            id: Date.now().toString(),
            project_name: project.projectName,
            location: project.location || '',
            status: project.status,
            apartments_count: project.apartmentsCount || 0,
            shops_count: project.shopsCount || 0
        };
        
        const { data, error } = await this.supabase
            .from('projects')
            .insert([projectData])
            .select();
        
        if (error) {
            console.error('Error adding project:', error);
            alert('حدث خطأ في إضافة المشروع');
            return null;
        }
        
        return {
            id: data[0].id,
            projectName: data[0].project_name,
            location: data[0].location,
            status: data[0].status,
            apartmentsCount: data[0].apartments_count,
            shopsCount: data[0].shops_count,
            createdAt: data[0].created_at
        };
    },
    
    async updateProject(projectId, updates) {
        const updateData = {
            project_name: updates.projectName,
            location: updates.location || '',
            status: updates.status,
            apartments_count: updates.apartmentsCount || 0,
            shops_count: updates.shopsCount || 0,
            updated_at: new Date().toISOString()
        };
        
        const { data, error } = await this.supabase
            .from('projects')
            .update(updateData)
            .eq('id', projectId)
            .select();
        
        if (error) {
            console.error('Error updating project:', error);
            alert('حدث خطأ في تحديث المشروع');
            return null;
        }
        
        return data[0];
    },
    
    async deleteProject(projectId) {
        const { error } = await this.supabase
            .from('projects')
            .delete()
            .eq('id', projectId);
        
        if (error) {
            console.error('Error deleting project:', error);
            alert('حدث خطأ في حذف المشروع');
            return false;
        }
        
        return true;
    },
    
    async getProject(id) {
        const { data, error } = await this.supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) {
            console.error('Error fetching project:', error);
            return null;
        }
        
        return {
            id: data.id,
            projectName: data.project_name,
            location: data.location,
            status: data.status,
            apartmentsCount: data.apartments_count,
            shopsCount: data.shops_count,
            createdAt: data.created_at
        };
    },
    
    // Expenses
    async getProjectExpenses(projectId) {
        const { data, error } = await this.supabase
            .from('expenses')
            .select('*')
            .eq('project_id', projectId)
            .order('date', { ascending: false });
        
        if (error) {
            console.error('Error fetching expenses:', error);
            return [];
        }
        
        return data.map(e => ({
            id: e.id,
            projectId: e.project_id,
            date: e.date,
            category: e.category,
            customCategory: e.custom_category,
            amount: parseFloat(e.amount),
            recipient: e.recipient,
            notes: e.notes,
            createdAt: e.created_at
        }));
    },
    
    async addExpense(expense) {
        const expenseData = {
            id: Date.now().toString(),
            project_id: expense.projectId,
            date: expense.date,
            category: expense.category,
            custom_category: expense.customCategory || '',
            amount: expense.amount,
            recipient: expense.recipient || '',
            notes: expense.notes || ''
        };
        
        const { data, error } = await this.supabase
            .from('expenses')
            .insert([expenseData])
            .select();
        
        if (error) {
            console.error('Error adding expense:', error);
            alert('حدث خطأ في إضافة المصروف');
            return null;
        }
        
        return {
            id: data[0].id,
            projectId: data[0].project_id,
            date: data[0].date,
            category: data[0].category,
            customCategory: data[0].custom_category,
            amount: parseFloat(data[0].amount),
            recipient: data[0].recipient,
            notes: data[0].notes,
            createdAt: data[0].created_at
        };
    },
    
    async updateExpense(expenseId, updates) {
        const updateData = {
            date: updates.date,
            category: updates.category,
            custom_category: updates.customCategory || '',
            amount: updates.amount,
            recipient: updates.recipient || '',
            notes: updates.notes || '',
            updated_at: new Date().toISOString()
        };
        
        const { data, error } = await this.supabase
            .from('expenses')
            .update(updateData)
            .eq('id', expenseId)
            .select();
        
        if (error) {
            console.error('Error updating expense:', error);
            alert('حدث خطأ في تحديث المصروف');
            return null;
        }
        
        return data[0];
    },
    
    async deleteExpense(expenseId) {
        const { error } = await this.supabase
            .from('expenses')
            .delete()
            .eq('id', expenseId);
        
        if (error) {
            console.error('Error deleting expense:', error);
            alert('حدث خطأ في حذف المصروف');
            return false;
        }
        
        return true;
    },
    
    // Sales
    async getSales() {
        const { data, error } = await this.supabase
            .from('sales')
            .select('*')
            .order('sale_date', { ascending: false });
        
        if (error) {
            console.error('Error fetching sales:', error);
            return [];
        }
        
        return data.map(s => ({
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
            createdAt: s.created_at
        }));
    },
    
    async getProjectSales(projectId) {
        const { data, error } = await this.supabase
            .from('sales')
            .select('*')
            .eq('project_id', projectId)
            .order('sale_date', { ascending: false });
        
        if (error) {
            console.error('Error fetching project sales:', error);
            return [];
        }
        
        return data.map(s => ({
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
            createdAt: s.created_at
        }));
    },
    
    async addSale(sale) {
        const payments = this.calculatePayments(sale);
        
        const saleData = {
            id: Date.now().toString(),
            project_id: sale.projectId,
            unit_type: sale.unitType,
            unit_number: sale.unitNumber || '',
            sale_date: sale.saleDate,
            customer_name: sale.customerName,
            customer_phone: sale.customerPhone || '',
            total_price: sale.totalPrice,
            payment_type: sale.paymentType,
            down_payment: sale.downPayment || 0,
            installments_count: sale.installmentsCount || 0,
            notes: sale.notes || '',
            payments: payments
        };
        
        const { data, error } = await this.supabase
            .from('sales')
            .insert([saleData])
            .select();
        
        if (error) {
            console.error('Error adding sale:', error);
            alert('حدث خطأ في إضافة عملية البيع');
            return null;
        }
        
        return {
            id: data[0].id,
            projectId: data[0].project_id,
            unitType: data[0].unit_type,
            unitNumber: data[0].unit_number,
            saleDate: data[0].sale_date,
            customerName: data[0].customer_name,
            customerPhone: data[0].customer_phone,
            totalPrice: parseFloat(data[0].total_price),
            paymentType: data[0].payment_type,
            downPayment: parseFloat(data[0].down_payment) || 0,
            installmentsCount: data[0].installments_count || 0,
            notes: data[0].notes,
            payments: data[0].payments,
            createdAt: data[0].created_at
        };
    },
    
    async updateSale(saleId, updates) {
        const updateData = {
            unit_type: updates.unitType,
            unit_number: updates.unitNumber || '',
            sale_date: updates.saleDate,
            customer_name: updates.customerName,
            customer_phone: updates.customerPhone || '',
            total_price: updates.totalPrice,
            notes: updates.notes || '',
            updated_at: new Date().toISOString()
        };
        
        const { data, error } = await this.supabase
            .from('sales')
            .update(updateData)
            .eq('id', saleId)
            .select();
        
        if (error) {
            console.error('Error updating sale:', error);
            alert('حدث خطأ في تحديث عملية البيع');
            return null;
        }
        
        return data[0];
    },
    
    async deleteSale(saleId) {
        const { error } = await this.supabase
            .from('sales')
            .delete()
            .eq('id', saleId);
        
        if (error) {
            console.error('Error deleting sale:', error);
            alert('حدث خطأ في حذف عملية البيع');
            return false;
        }
        
        return true;
    },
    
    async updatePayment(saleId, paymentIndex, paid) {
        // Get current sale
        const { data: saleData, error: fetchError } = await this.supabase
            .from('sales')
            .select('payments')
            .eq('id', saleId)
            .single();
        
        if (fetchError) {
            console.error('Error fetching sale for payment update:', fetchError);
            return false;
        }
        
        const payments = saleData.payments || [];
        if (payments[paymentIndex]) {
            payments[paymentIndex].paid = paid;
            if (paid) {
                payments[paymentIndex].paidDate = new Date().toISOString();
            } else {
                delete payments[paymentIndex].paidDate;
            }
        }
        
        // Update payments
        const { error: updateError } = await this.supabase
            .from('sales')
            .update({ 
                payments: payments,
                updated_at: new Date().toISOString()
            })
            .eq('id', saleId);
        
        if (updateError) {
            console.error('Error updating payment:', updateError);
            return false;
        }
        
        return true;
    },
    
    calculatePayments(sale) {
        const saleDate = new Date(sale.saleDate);
        
        if (sale.paymentType === 'cash') {
            return [{
                amount: sale.totalPrice,
                dueDate: sale.saleDate,
                paid: true,
                paidDate: sale.saleDate,
                type: 'كاش'
            }];
        }
        
        const payments = [];
        const downPayment = parseFloat(sale.downPayment) || 0;
        const remaining = sale.totalPrice - downPayment;
        const installmentAmount = remaining / sale.installmentsCount;
        
        // Down payment
        if (downPayment > 0) {
            payments.push({
                amount: downPayment,
                dueDate: sale.saleDate,
                paid: true,
                paidDate: sale.saleDate,
                type: 'مقدم'
            });
        }
        
        // Quarterly installments (every 3 months)
        for (let i = 0; i < sale.installmentsCount; i++) {
            const dueDate = new Date(saleDate);
            dueDate.setMonth(dueDate.getMonth() + (i + 1) * 3);
            
            payments.push({
                amount: installmentAmount,
                dueDate: dueDate.toISOString(),
                paid: false,
                type: `القسط ${i + 1}`
            });
        }
        
        return payments;
    }
};

// Global state
let projects = [];
let sales = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Show loading
    showLoading();
    
    // Initialize DB
    DB.init();
    
    // Set today's date as default for date inputs
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (!input.value) input.value = today;
    });
    
    // Load data
    await loadData();
    
    // Hide loading
    hideLoading();
    
    updateDashboard();
    renderProjects();
    renderSales();
    populateProjectSelects();
});

function showLoading() {
    const loader = document.createElement('div');
    loader.id = 'loading-overlay';
    loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        font-size: 1.5rem;
        font-family: 'Cairo', sans-serif;
    `;
    loader.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🔄</div>
            <div>جاري التحميل...</div>
        </div>
    `;
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.remove();
}

async function loadData() {
    try {
        projects = await DB.getProjects();
        sales = await DB.getSales();
    } catch (error) {
        console.error('Error loading data:', error);
        alert('حدث خطأ في تحميل البيانات. تأكد من اتصالك بالإنترنت.');
    }
}

// Navigation
function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    
    document.getElementById(`${viewName}-view`).classList.add('active');
    event.target.classList.add('active');
    
    if (viewName === 'dashboard') updateDashboard();
    if (viewName === 'projects') renderProjects();
    if (viewName === 'sales') renderSales();
    if (viewName === 'reports') generateReport();
}

// Modal functions
function openAddProjectModal() {
    document.getElementById('add-project-form').reset();
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('#add-project-modal input[type="date"]').forEach(input => {
        input.value = today;
    });
    document.getElementById('add-project-modal').classList.add('active');
}

function openAddSaleModal() {
    populateProjectSelects();
    document.getElementById('add-sale-form').reset();
    const today = new Date().toISOString().split('T')[0];
    document.querySelector('#add-sale-modal input[name="saleDate"]').value = today;
    document.getElementById('add-sale-modal').classList.add('active');
}

function openAddExpenseModal(projectId) {
    document.getElementById('add-expense-form').reset();
    document.getElementById('expense-project-id').value = projectId;
    const today = new Date().toISOString().split('T')[0];
    document.querySelector('#add-expense-modal input[name="date"]').value = today;
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
    
    if (expense.category === 'custom') {
        document.getElementById('edit-custom-category-group').style.display = 'block';
        document.getElementById('edit-expense-custom-category').value = expense.customCategory || '';
    } else {
        document.getElementById('edit-custom-category-group').style.display = 'none';
    }
    
    document.getElementById('edit-expense-modal').classList.add('active');
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
    document.getElementById('edit-sale-payment-type').value = sale.paymentType;
    document.getElementById('edit-sale-notes').value = sale.notes || '';
    
    document.getElementById('edit-sale-modal').classList.add('active');
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

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function toggleInstallmentFields() {
    const paymentType = event.target.value;
    const installmentFields = document.getElementById('installment-fields');
    installmentFields.style.display = paymentType === 'installment' ? 'block' : 'none';
}

function toggleCustomCategory() {
    const category = event.target.value;
    const customGroup = document.getElementById('custom-category-group');
    customGroup.style.display = category === 'custom' ? 'block' : 'none';
}

function toggleEditCustomCategory() {
    const category = event.target.value;
    const customGroup = document.getElementById('edit-custom-category-group');
    customGroup.style.display = category === 'custom' ? 'block' : 'none';
}

function updateUnitTypes() {
    const projectId = document.getElementById('sale-project-select').value;
    const unitTypeSelect = document.querySelector('[name="unitType"]');
    
    if (!projectId) return;
    
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    // Reset options
    unitTypeSelect.innerHTML = '<option value="">اختر نوع الوحدة</option>';
    
    // Add apartment option
    if (project.apartmentsCount > 0) {
        unitTypeSelect.innerHTML += '<option value="apartment">شقة</option>';
    }
    
    // Add shop option
    if (project.shopsCount > 0) {
        unitTypeSelect.innerHTML += '<option value="shop">محل</option>';
    }
}

// Add Project
async function addProject(event) {
    event.preventDefault();
    showLoading();
    
    const formData = new FormData(event.target);
    
    const project = {
        projectName: formData.get('projectName'),
        location: formData.get('location') || '',
        status: formData.get('status'),
        apartmentsCount: parseInt(formData.get('apartmentsCount')) || 0,
        shopsCount: parseInt(formData.get('shopsCount')) || 0
    };
    
    const added = await DB.addProject(project);
    
    if (added) {
        await loadData();
        closeModal('add-project-modal');
        event.target.reset();
        updateDashboard();
        renderProjects();
        populateProjectSelects();
        alert('✅ تم إضافة المشروع بنجاح!');
    }
    
    hideLoading();
}

// Update Project
async function updateProject(event) {
    event.preventDefault();
    showLoading();
    
    const formData = new FormData(event.target);
    const projectId = formData.get('projectId');
    
    const updates = {
        projectName: formData.get('projectName'),
        location: formData.get('location') || '',
        status: formData.get('status'),
        apartmentsCount: parseInt(formData.get('apartmentsCount')) || 0,
        shopsCount: parseInt(formData.get('shopsCount')) || 0
    };
    
    const updated = await DB.updateProject(projectId, updates);
    
    if (updated) {
        await loadData();
        closeModal('edit-project-modal');
        updateDashboard();
        renderProjects();
        populateProjectSelects();
        alert('✅ تم تحديث المشروع بنجاح!');
    }
    
    hideLoading();
}

// Delete Project
async function deleteProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    if (confirm(`هل أنت متأكد من حذف المشروع "${project.projectName}"؟\n\nسيتم حذف جميع المصروفات والمبيعات المرتبطة بهذا المشروع.`)) {
        showLoading();
        const deleted = await DB.deleteProject(projectId);
        
        if (deleted) {
            await loadData();
            closeModal('project-details-modal');
            updateDashboard();
            renderProjects();
            renderSales();
            populateProjectSelects();
            alert('✅ تم حذف المشروع بنجاح!');
        }
        
        hideLoading();
    }
}

// Add Expense
async function addExpense(event) {
    event.preventDefault();
    showLoading();
    
    const formData = new FormData(event.target);
    
    const category = formData.get('category');
    const expense = {
        projectId: formData.get('projectId'),
        date: formData.get('date'),
        category: category,
        customCategory: category === 'custom' ? formData.get('customCategory') : '',
        amount: parseFloat(formData.get('amount')),
        recipient: formData.get('recipient') || '',
        notes: formData.get('notes') || ''
    };
    
    const added = await DB.addExpense(expense);
    
    if (added) {
        closeModal('add-expense-modal');
        event.target.reset();
        await showProjectDetails(expense.projectId);
        updateDashboard();
        alert('✅ تم إضافة المصروف بنجاح!');
    }
    
    hideLoading();
}

// Update Expense
async function updateExpense(event) {
    event.preventDefault();
    showLoading();
    
    const formData = new FormData(event.target);
    const expenseId = formData.get('expenseId');
    const projectId = formData.get('projectId');
    
    const category = formData.get('category');
    const updates = {
        date: formData.get('date'),
        category: category,
        customCategory: category === 'custom' ? formData.get('customCategory') : '',
        amount: parseFloat(formData.get('amount')),
        recipient: formData.get('recipient') || '',
        notes: formData.get('notes') || ''
    };
    
    const updated = await DB.updateExpense(expenseId, updates);
    
    if (updated) {
        closeModal('edit-expense-modal');
        await showProjectDetails(projectId);
        updateDashboard();
        alert('✅ تم تحديث المصروف بنجاح!');
    }
    
    hideLoading();
}

// Delete Expense
async function deleteExpense(projectId, expenseId) {
    if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
        showLoading();
        const deleted = await DB.deleteExpense(expenseId);
        
        if (deleted) {
            await showProjectDetails(projectId);
            updateDashboard();
            alert('✅ تم حذف المصروف بنجاح!');
        }
        
        hideLoading();
    }
}

// Add Sale
async function addSale(event) {
    event.preventDefault();
    showLoading();
    
    const formData = new FormData(event.target);
    
    const sale = {
        projectId: formData.get('projectId'),
        unitType: formData.get('unitType'),
        unitNumber: formData.get('unitNumber') || '',
        saleDate: formData.get('saleDate'),
        customerName: formData.get('customerName'),
        customerPhone: formData.get('customerPhone') || '',
        totalPrice: parseFloat(formData.get('totalPrice')),
        paymentType: formData.get('paymentType'),
        downPayment: parseFloat(formData.get('downPayment')) || 0,
        installmentsCount: parseInt(formData.get('installmentsCount')) || 0,
        notes: formData.get('notes') || ''
    };
    
    const added = await DB.addSale(sale);
    
    if (added) {
        await loadData();
        closeModal('add-sale-modal');
        event.target.reset();
        updateDashboard();
        renderSales();
        alert('✅ تم إضافة عملية البيع بنجاح!');
    }
    
    hideLoading();
}

// Update Sale
async function updateSale(event) {
    event.preventDefault();
    showLoading();
    
    const formData = new FormData(event.target);
    const saleId = formData.get('saleId');
    
    const updates = {
        unitType: formData.get('unitType'),
        unitNumber: formData.get('unitNumber') || '',
        saleDate: formData.get('saleDate'),
        customerName: formData.get('customerName'),
        customerPhone: formData.get('customerPhone') || '',
        totalPrice: parseFloat(formData.get('totalPrice')),
        notes: formData.get('notes') || ''
    };
    
    const updated = await DB.updateSale(saleId, updates);
    
    if (updated) {
        await loadData();
        closeModal('edit-sale-modal');
        updateDashboard();
        renderSales();
        alert('✅ تم تحديث عملية البيع بنجاح!');
    }
    
    hideLoading();
}

// Delete Sale
async function deleteSale(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    
    if (confirm(`هل أنت متأكد من حذف عملية البيع للعميل "${sale.customerName}"؟`)) {
        showLoading();
        const deleted = await DB.deleteSale(saleId);
        
        if (deleted) {
            await loadData();
            updateDashboard();
            renderSales();
            alert('✅ تم حذف عملية البيع بنجاح!');
        }
        
        hideLoading();
    }
}

// Populate project selects
function populateProjectSelects() {
    const selects = ['sale-project-select', 'edit-sale-project'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = '<option value="">اختر المشروع</option>';
        
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.projectName;
            select.appendChild(option);
        });
        
        if (currentValue) select.value = currentValue;
    });
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('ar-EG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Get category name
function getCategoryName(category, customCategory) {
    const categories = {
        'land': '🏗️ أرض',
        'contractor': '👷 مقاول',
        'engineer': '👨‍💼 مهندس',
        'labor': '🔨 صنايعية وعمال'
    };
    
    if (category === 'custom') {
        return '📋 ' + customCategory;
    }
    
    return categories[category] || category;
}

// Calculate project costs
async function calculateProjectCosts(projectId) {
    const expenses = await DB.getProjectExpenses(projectId);
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
}

// Calculate project revenue
function calculateProjectRevenue(projectId) {
    const projectSales = sales.filter(s => s.projectId === projectId);
    return projectSales.reduce((sum, sale) => {
        const paidAmount = sale.payments
            .filter(p => p.paid)
            .reduce((s, p) => s + p.amount, 0);
        return sum + paidAmount;
    }, 0);
}

// Get expense summary by category
async function getExpenseSummary(projectId) {
    const expenses = await DB.getProjectExpenses(projectId);
    const summary = {};
    
    expenses.forEach(expense => {
        const categoryKey = expense.category === 'custom' ? expense.customCategory : expense.category;
        const categoryName = getCategoryName(expense.category, expense.customCategory);
        
        if (!summary[categoryKey]) {
            summary[categoryKey] = {
                name: categoryName,
                total: 0,
                count: 0
            };
        }
        
        summary[categoryKey].total += expense.amount;
        summary[categoryKey].count++;
    });
    
    return summary;
}

// Update Dashboard
async function updateDashboard() {
    const totalProjects = projects.length;
    
    let totalCosts = 0;
    for (const project of projects) {
        totalCosts += await calculateProjectCosts(project.id);
    }
    
    const totalRevenue = sales.reduce((sum, sale) => {
        const paidAmount = sale.payments
            .filter(p => p.paid)
            .reduce((s, p) => s + p.amount, 0);
        return sum + paidAmount;
    }, 0);
    
    const netProfit = totalRevenue - totalCosts;
    
    document.getElementById('total-projects').textContent = totalProjects;
    document.getElementById('total-revenue').innerHTML = `${formatCurrency(totalRevenue)} <span style="font-size: 1rem;">ج.م</span>`;
    document.getElementById('total-costs').innerHTML = `${formatCurrency(totalCosts)} <span style="font-size: 1rem;">ج.م</span>`;
    document.getElementById('net-profit').innerHTML = `${formatCurrency(netProfit)} <span style="font-size: 1rem;">ج.م</span>`;
    
    // Render active projects
    const activeProjectsGrid = document.getElementById('active-projects-grid');
    if (projects.length === 0) {
        activeProjectsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏗️</div>
                <div class="empty-state-text">لا توجد مشاريع حالياً</div>
                <button class="btn btn-primary" onclick="showView('projects'); openAddProjectModal();">
                    ➕ إضافة أول مشروع
                </button>
            </div>
        `;
    } else {
        const projectCards = [];
        for (const project of projects) {
            const costs = await calculateProjectCosts(project.id);
            const revenue = calculateProjectRevenue(project.id);
            const profit = revenue - costs;
            const projectSales = sales.filter(s => s.projectId === project.id);
            
            const statusBadge = project.status === 'completed' 
                ? '<span class="status-badge status-completed">✅ جاهز</span>'
                : '<span class="status-badge status-under-construction">🏗️ تحت الإنشاء</span>';
            
            projectCards.push(`
                <div class="project-card" onclick="showProjectDetails('${project.id}')">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <div class="project-name">${project.projectName}</div>
                        ${statusBadge}
                    </div>
                    ${project.location ? `<div style="color: var(--text-secondary); margin-bottom: 0.5rem;">📍 ${project.location}</div>` : ''}
                    <div class="project-stats">
                        <div class="stat">
                            <div class="stat-value">${projectSales.length}</div>
                            <div class="stat-label">عملية بيع</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value" style="color: ${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(profit)}</div>
                            <div class="stat-label">الربح (ج.م)</div>
                        </div>
                    </div>
                </div>
            `);
        }
        activeProjectsGrid.innerHTML = projectCards.join('');
    }
}

// Render Projects
async function renderProjects() {
    const projectsGrid = document.getElementById('projects-grid');
    
    if (projects.length === 0) {
        projectsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏗️</div>
                <div class="empty-state-text">لا توجد مشاريع حالياً</div>
                <div class="empty-state-text" style="font-size: 1rem;">ابدأ بإضافة مشروعك الأول</div>
            </div>
        `;
        return;
    }
    
    const projectCards = [];
    for (const project of projects) {
        const expenses = await DB.getProjectExpenses(project.id);
        const costs = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const revenue = calculateProjectRevenue(project.id);
        const profit = revenue - costs;
        const projectSales = sales.filter(s => s.projectId === project.id);
        const soldUnits = projectSales.length;
        const totalUnits = project.apartmentsCount + project.shopsCount;
        
        const statusBadge = project.status === 'completed' 
            ? '<span class="status-badge status-completed">✅ جاهز</span>'
            : '<span class="status-badge status-under-construction">🏗️ تحت الإنشاء</span>';
        
        projectCards.push(`
            <div class="project-card" onclick="showProjectDetails('${project.id}')">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <div class="project-name">${project.projectName}</div>
                    ${statusBadge}
                </div>
                ${project.location ? `<div style="color: var(--text-secondary); margin-bottom: 0.5rem;">📍 ${project.location}</div>` : ''}
                
                <div style="margin: 1rem 0; padding: 1rem; background: var(--bg-main); border-radius: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="color: var(--text-secondary);">المصروفات (${expenses.length}):</span>
                        <span class="currency">${formatCurrency(costs)} ج.م</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="color: var(--text-secondary);">الإيرادات:</span>
                        <span class="currency">${formatCurrency(revenue)} ج.م</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding-top: 0.5rem; border-top: 2px solid var(--border); font-weight: 700;">
                        <span>الربح:</span>
                        <span style="color: ${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(profit)} ج.م</span>
                    </div>
                </div>
                
                <div class="project-stats">
                    <div class="stat">
                        <div class="stat-value">${soldUnits}/${totalUnits}</div>
                        <div class="stat-label">الوحدات المباعة</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${projectSales.length}</div>
                        <div class="stat-label">عمليات البيع</div>
                    </div>
                </div>
            </div>
        `);
    }
    
    projectsGrid.innerHTML = projectCards.join('');
}

// Show Project Details
async function showProjectDetails(projectId) {
    showLoading();
    
    const project = await DB.getProject(projectId);
    if (!project) {
        hideLoading();
        return;
    }
    
    const expenses = await DB.getProjectExpenses(projectId);
    const costs = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const revenue = calculateProjectRevenue(projectId);
    const profit = revenue - costs;
    const projectSales = sales.filter(s => s.projectId === projectId);
    const expenseSummary = await getExpenseSummary(projectId);
    
    const statusBadge = project.status === 'completed' 
        ? '<span class="status-badge status-completed">✅ جاهز</span>'
        : '<span class="status-badge status-under-construction">🏗️ تحت الإنشاء</span>';
    
    // Sort expenses by date (newest first)
    const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const content = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
            ${statusBadge}
            <div class="action-buttons">
                <button class="btn btn-sm btn-secondary" onclick="openEditProjectModal('${projectId}'); event.stopPropagation();">
                    ✏️ تعديل المشروع
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteProject('${projectId}'); event.stopPropagation();">
                    🗑️ حذف المشروع
                </button>
            </div>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <div class="summary-label">إجمالي التكاليف</div>
                <div class="summary-value">${formatCurrency(costs)} <span style="font-size: 1rem;">ج.م</span></div>
            </div>
            <div class="summary-card gold">
                <div class="summary-label">إجمالي الإيرادات</div>
                <div class="summary-value">${formatCurrency(revenue)} <span style="font-size: 1rem;">ج.م</span></div>
            </div>
            <div class="summary-card ${profit >= 0 ? '' : 'danger'}">
                <div class="summary-label">صافي الربح</div>
                <div class="summary-value">${formatCurrency(profit)} <span style="font-size: 1rem;">ج.م</span></div>
            </div>
        </div>
        
        <div class="section-divider">
            <h4 class="section-title">💰 المصروفات (${expenses.length})</h4>
        </div>

        <div style="margin-bottom: 2rem;">
            <button class="btn btn-primary" onclick="openAddExpenseModal('${projectId}'); event.stopPropagation();">
                ➕ إضافة مصروف جديد
            </button>
        </div>

        ${Object.keys(expenseSummary).length > 0 ? `
            <div class="expense-summary">
                <h5 style="margin-bottom: 1rem; color: var(--primary);">📊 ملخص المصروفات حسب الفئة</h5>
                ${Object.values(expenseSummary).map(cat => `
                    <div class="expense-category">
                        <div>
                            <div class="category-name">${cat.name}</div>
                            <div class="category-count">${cat.count} عملية</div>
                        </div>
                        <div class="category-amount">${formatCurrency(cat.total)} ج.م</div>
                    </div>
                `).join('')}
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 2px solid var(--primary); display: flex; justify-content: space-between; font-weight: 700; font-size: 1.1rem;">
                    <span>الإجمالي:</span>
                    <span class="currency">${formatCurrency(costs)} ج.م</span>
                </div>
            </div>
        ` : ''}

        ${sortedExpenses.length > 0 ? `
            <div style="margin-top: 2rem;">
                <h5 style="margin-bottom: 1rem; color: var(--primary);">📜 سجل المصروفات التفصيلي</h5>
                ${sortedExpenses.map(expense => `
                    <div class="expense-item">
                        <div class="expense-details">
                            <div class="expense-date">📅 ${formatDate(expense.date)}</div>
                            <div class="expense-category-label">${getCategoryName(expense.category, expense.customCategory)}</div>
                            ${expense.recipient ? `<div class="expense-recipient">👤 ${expense.recipient}</div>` : ''}
                            ${expense.notes ? `<div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.25rem;">📝 ${expense.notes}</div>` : ''}
                        </div>
                        <div style="display: flex; align-items: center;">
                            <div class="expense-amount-display">${formatCurrency(expense.amount)} ج.م</div>
                            <div class="expense-actions">
                                <button class="btn btn-xs btn-warning" onclick="openEditExpenseModal('${projectId}', '${expense.id}'); event.stopPropagation();">
                                    ✏️ تعديل
                                </button>
                                <button class="btn btn-xs btn-danger" onclick="deleteExpense('${projectId}', '${expense.id}'); event.stopPropagation();">
                                    🗑️ حذف
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : `
            <div style="text-align: center; padding: 3rem; background: var(--bg-main); border-radius: 12px; color: var(--text-secondary);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">💰</div>
                <div style="font-size: 1.1rem;">لا توجد مصروفات مسجلة لهذا المشروع</div>
                <div style="font-size: 0.9rem; margin-top: 0.5rem;">ابدأ بإضافة أول مصروف</div>
            </div>
        `}
        
        <div class="section-divider" style="margin-top: 3rem;">
            <h4 class="section-title">🏢 الوحدات</h4>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div style="background: var(--bg-main); padding: 1rem; border-radius: 10px; text-align: center;">
                <div style="font-size: 2rem; font-weight: 700; color: var(--primary);">${project.apartmentsCount}</div>
                <div style="color: var(--text-secondary);">شقة</div>
            </div>
            <div style="background: var(--bg-main); padding: 1rem; border-radius: 10px; text-align: center;">
                <div style="font-size: 2rem; font-weight: 700; color: var(--primary);">${project.shopsCount}</div>
                <div style="color: var(--text-secondary);">محل</div>
            </div>
        </div>
        
        ${projectSales.length > 0 ? `
            <div class="section-divider" style="margin-top: 2rem;">
                <h4 class="section-title">💼 المبيعات (${projectSales.length})</h4>
            </div>
            <div class="table-container">
                <table>
                    <tr>
                        <th>العميل</th>
                        <th>الوحدة</th>
                        <th>تاريخ البيع</th>
                        <th>السعر (ج.م)</th>
                        <th>نوع الدفع</th>
                        <th>الحالة</th>
                    </tr>
                    ${projectSales.map(sale => {
                        const paidPayments = sale.payments.filter(p => p.paid).length;
                        const totalPayments = sale.payments.length;
                        const status = paidPayments === totalPayments ? 'مكتمل' : `${paidPayments}/${totalPayments}`;
                        const statusClass = paidPayments === totalPayments ? 'success' : 'warning';
                        
                        return `
                            <tr>
                                <td>${sale.customerName}</td>
                                <td>${sale.unitType === 'apartment' ? 'شقة' : 'محل'} ${sale.unitNumber}</td>
                                <td>${formatDate(sale.saleDate)}</td>
                                <td class="currency">${formatCurrency(sale.totalPrice)}</td>
                                <td>${sale.paymentType === 'cash' ? 'كاش' : 'أقساط'}</td>
                                <td><span class="badge badge-${statusClass}">${status}</span></td>
                            </tr>
                        `;
                    }).join('')}
                </table>
            </div>
        ` : ''}
    `;
    
    document.getElementById('project-details-title').textContent = project.projectName;
    document.getElementById('project-details-content').innerHTML = content;
    document.getElementById('project-details-modal').classList.add('active');
    
    hideLoading();
}

// Render Sales
function renderSales() {
    const salesList = document.getElementById('sales-list');
    
    if (sales.length === 0) {
        salesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💰</div>
                <div class="empty-state-text">لا توجد عمليات بيع حالياً</div>
                <div class="empty-state-text" style="font-size: 1rem;">ابدأ بإضافة أول عملية بيع</div>
            </div>
        `;
        return;
    }
    
    const salesByProject = {};
    sales.forEach(sale => {
        if (!salesByProject[sale.projectId]) {
            salesByProject[sale.projectId] = [];
        }
        salesByProject[sale.projectId].push(sale);
    });
    
    salesList.innerHTML = Object.keys(salesByProject).map(projectId => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return '';
        
        const projectSalesData = salesByProject[projectId];
        
        return `
            <div style="margin-bottom: 2rem;">
                <h3 style="color: var(--primary); margin-bottom: 1rem; font-family: 'Amiri', serif;">
                    🏢 ${project.projectName}
                </h3>
                <div class="table-container">
                    <table>
                        <tr>
                            <th>العميل</th>
                            <th>الوحدة</th>
                            <th>تاريخ البيع</th>
                            <th>السعر (ج.م)</th>
                            <th>نوع الدفع</th>
                            <th>المدفوع</th>
                            <th>المتبقي</th>
                            <th>الحالة</th>
                            <th>الإجراءات</th>
                        </tr>
                        ${projectSalesData.map(sale => {
                            const paidAmount = sale.payments.filter(p => p.paid).reduce((s, p) => s + p.amount, 0);
                            const remaining = sale.totalPrice - paidAmount;
                            const paidPayments = sale.payments.filter(p => p.paid).length;
                            const totalPayments = sale.payments.length;
                            const statusClass = paidPayments === totalPayments ? 'success' : (remaining > 0 ? 'warning' : 'success');
                            const hasOverdue = sale.payments.some(p => !p.paid && new Date(p.dueDate) < new Date());
                            
                            return `
                                <tr>
                                    <td>
                                        <strong>${sale.customerName}</strong>
                                        ${sale.customerPhone ? `<br><small style="color: var(--text-secondary);">📞 ${sale.customerPhone}</small>` : ''}
                                    </td>
                                    <td>${sale.unitType === 'apartment' ? 'شقة' : 'محل'} ${sale.unitNumber}</td>
                                    <td>${formatDate(sale.saleDate)}</td>
                                    <td class="currency">${formatCurrency(sale.totalPrice)}</td>
                                    <td>${sale.paymentType === 'cash' ? 'كاش' : 'أقساط'}</td>
                                    <td class="currency" style="color: var(--success);">${formatCurrency(paidAmount)}</td>
                                    <td class="currency" style="color: ${remaining > 0 ? 'var(--danger)' : 'var(--success)'};">${formatCurrency(remaining)}</td>
                                    <td>
                                        <span class="badge badge-${statusClass}">${paidPayments}/${totalPayments}</span>
                                        ${hasOverdue ? '<br><span class="badge badge-danger" style="margin-top: 0.25rem;">متأخر</span>' : ''}
                                    </td>
                                    <td>
                                        <div class="action-buttons">
                                            <button class="btn btn-xs btn-secondary" onclick="showPaymentDetails('${sale.id}')">
                                                💳 الدفعات
                                            </button>
                                            <button class="btn btn-xs btn-warning" onclick="openEditSaleModal('${sale.id}')">
                                                ✏️ تعديل
                                            </button>
                                            <button class="btn btn-xs btn-danger" onclick="deleteSale('${sale.id}')">
                                                🗑️ حذف
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </table>
                </div>
            </div>
        `;
    }).join('');
}

// Show Payment Details
function showPaymentDetails(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    
    const project = projects.find(p => p.id === sale.projectId);
    
    const content = `
        <div style="margin-bottom: 1.5rem;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">المشروع</div>
                    <div style="font-weight: 600;">${project.projectName}</div>
                </div>
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">العميل</div>
                    <div style="font-weight: 600;">${sale.customerName}</div>
                </div>
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">الوحدة</div>
                    <div style="font-weight: 600;">${sale.unitType === 'apartment' ? 'شقة' : 'محل'} ${sale.unitNumber}</div>
                </div>
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">تاريخ البيع</div>
                    <div style="font-weight: 600;">${formatDate(sale.saleDate)}</div>
                </div>
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">السعر الإجمالي</div>
                    <div style="font-weight: 600; color: var(--secondary);">${formatCurrency(sale.totalPrice)} ج.م</div>
                </div>
            </div>
        </div>
        
        <h4 style="color: var(--primary); margin-bottom: 1rem;">💳 جدول الدفعات</h4>
        <div class="table-container">
            <table>
                <tr>
                    <th>النوع</th>
                    <th>المبلغ (ج.م)</th>
                    <th>تاريخ الاستحقاق</th>
                    <th>الحالة</th>
                    <th>الإجراء</th>
                </tr>
                ${sale.payments.map((payment, index) => {
                    const dueDate = new Date(payment.dueDate);
                    const isOverdue = !payment.paid && dueDate < new Date();
                    const formattedDate = formatDate(payment.dueDate);
                    
                    return `
                        <tr style="${isOverdue ? 'background: rgba(192, 57, 43, 0.05);' : ''}">
                            <td>${payment.type || 'دفعة'}</td>
                            <td class="currency">${formatCurrency(payment.amount)}</td>
                            <td>${formattedDate}</td>
                            <td>
                                ${payment.paid 
                                    ? `<span class="badge badge-success">✓ مدفوع</span>` 
                                    : (isOverdue 
                                        ? `<span class="badge badge-danger">⚠ متأخر</span>` 
                                        : `<span class="badge badge-warning">⏳ معلق</span>`)}
                            </td>
                            <td>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                    <input type="checkbox" 
                                           ${payment.paid ? 'checked' : ''} 
                                           onchange="togglePayment('${sale.id}', ${index}, this.checked)"
                                           style="width: 20px; height: 20px; cursor: pointer;">
                                    <span>${payment.paid ? 'تم الدفع' : 'تأكيد الدفع'}</span>
                                </label>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </table>
        </div>
        
        ${sale.notes ? `
            <div style="margin-top: 1.5rem; padding: 1rem; background: var(--bg-main); border-radius: 10px;">
                <strong style="color: var(--primary);">📝 ملاحظات:</strong>
                <p style="margin-top: 0.5rem;">${sale.notes}</p>
            </div>
        ` : ''}
    `;
    
    document.getElementById('project-details-title').textContent = 'تفاصيل الدفعات';
    document.getElementById('project-details-content').innerHTML = content;
    document.getElementById('project-details-modal').classList.add('active');
}

// Toggle Payment
async function togglePayment(saleId, paymentIndex, paid) {
    showLoading();
    const updated = await DB.updatePayment(saleId, paymentIndex, paid);
    
    if (updated) {
        await loadData();
        updateDashboard();
        renderSales();
        showPaymentDetails(saleId); // Refresh the modal
    }
    
    hideLoading();
}

// Generate Report
async function generateReport() {
    showLoading();
    
    const reportsContent = document.getElementById('reports-content');
    
    if (projects.length === 0) {
        reportsContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📈</div>
                <div class="empty-state-text">لا توجد بيانات لإنشاء التقارير</div>
            </div>
        `;
        hideLoading();
        return;
    }
    
    // Overall statistics
    let totalCosts = 0;
    for (const project of projects) {
        totalCosts += await calculateProjectCosts(project.id);
    }
    
    const totalRevenue = sales.reduce((sum, sale) => {
        const paidAmount = sale.payments.filter(p => p.paid).reduce((s, p) => s + p.amount, 0);
        return sum + paidAmount;
    }, 0);
    const netProfit = totalRevenue - totalCosts;
    
    // Pending payments
    const pendingPayments = [];
    sales.forEach(sale => {
        const project = projects.find(p => p.id === sale.projectId);
        sale.payments.forEach((payment, index) => {
            if (!payment.paid) {
                pendingPayments.push({
                    projectName: project ? project.projectName : 'غير معروف',
                    customerName: sale.customerName,
                    amount: payment.amount,
                    dueDate: new Date(payment.dueDate),
                    isOverdue: new Date(payment.dueDate) < new Date(),
                    type: payment.type
                });
            }
        });
    });
    
    pendingPayments.sort((a, b) => a.dueDate - b.dueDate);
    
    // Projects performance
    const projectsPerformance = [];
    for (const project of projects) {
        const expenses = await DB.getProjectExpenses(project.id);
        const costs = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const revenue = calculateProjectRevenue(project.id);
        const profit = revenue - costs;
        const projectSales = sales.filter(s => s.projectId === project.id);
        
        projectsPerformance.push({
            name: project.projectName,
            status: project.status,
            costs,
            revenue,
            profit,
            profitMargin: costs > 0 ? (profit / costs) * 100 : 0,
            salesCount: projectSales.length,
            expensesCount: expenses.length
        });
    }
    
    projectsPerformance.sort((a, b) => b.profit - a.profit);
    
    reportsContent.innerHTML = `
        <div class="summary-grid">
            <div class="summary-card">
                <div class="summary-label">إجمالي المشاريع</div>
                <div class="summary-value">${projects.length}</div>
            </div>
            <div class="summary-card gold">
                <div class="summary-label">إجمالي الإيرادات</div>
                <div class="summary-value">${formatCurrency(totalRevenue)} <span style="font-size: 1rem;">ج.م</span></div>
            </div>
            <div class="summary-card">
                <div class="summary-label">إجمالي التكاليف</div>
                <div class="summary-value">${formatCurrency(totalCosts)} <span style="font-size: 1rem;">ج.م</span></div>
            </div>
            <div class="summary-card ${netProfit >= 0 ? 'gold' : 'danger'}">
                <div class="summary-label">صافي الربح</div>
                <div class="summary-value">${formatCurrency(netProfit)} <span style="font-size: 1rem;">ج.م</span></div>
            </div>
        </div>
        
        <div style="margin-top: 2rem;">
            <h3 style="color: var(--primary); margin-bottom: 1rem; font-family: 'Amiri', serif;">📊 أداء المشاريع</h3>
            <div class="table-container">
                <table>
                    <tr>
                        <th>المشروع</th>
                        <th>الحالة</th>
                        <th>المصروفات</th>
                        <th>التكاليف (ج.م)</th>
                        <th>الإيرادات (ج.م)</th>
                        <th>الربح (ج.م)</th>
                        <th>هامش الربح</th>
                        <th>المبيعات</th>
                    </tr>
                    ${projectsPerformance.map(p => `
                        <tr>
                            <td><strong>${p.name}</strong></td>
                            <td>
                                ${p.status === 'completed' 
                                    ? '<span class="badge badge-success">جاهز</span>' 
                                    : '<span class="badge badge-info">تحت الإنشاء</span>'}
                            </td>
                            <td>${p.expensesCount} عملية</td>
                            <td class="currency">${formatCurrency(p.costs)}</td>
                            <td class="currency">${formatCurrency(p.revenue)}</td>
                            <td class="currency" style="color: ${p.profit >= 0 ? 'var(--success)' : 'var(--danger)'};">
                                ${formatCurrency(p.profit)}
                            </td>
                            <td style="color: ${p.profitMargin >= 0 ? 'var(--success)' : 'var(--danger)'};">
                                ${p.profitMargin.toFixed(1)}%
                            </td>
                            <td>${p.salesCount}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
        </div>
        
        ${pendingPayments.length > 0 ? `
            <div style="margin-top: 2rem;">
                <h3 style="color: var(--primary); margin-bottom: 1rem; font-family: 'Amiri', serif;">
                    ⏳ الدفعات المعلقة والمتأخرة (${pendingPayments.length})
                </h3>
                <div class="table-container">
                    <table>
                        <tr>
                            <th>المشروع</th>
                            <th>العميل</th>
                            <th>النوع</th>
                            <th>المبلغ (ج.م)</th>
                            <th>تاريخ الاستحقاق</th>
                            <th>الحالة</th>
                        </tr>
                        ${pendingPayments.map(p => `
                            <tr style="${p.isOverdue ? 'background: rgba(192, 57, 43, 0.05);' : ''}">
                                <td>${p.projectName}</td>
                                <td>${p.customerName}</td>
                                <td>${p.type || 'دفعة'}</td>
                                <td class="currency">${formatCurrency(p.amount)}</td>
                                <td>${formatDate(p.dueDate.toISOString())}</td>
                                <td>
                                    ${p.isOverdue 
                                        ? '<span class="badge badge-danger">⚠ متأخر</span>' 
                                        : '<span class="badge badge-warning">⏳ معلق</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            </div>
        ` : `
            <div style="margin-top: 2rem; padding: 2rem; background: rgba(45, 122, 79, 0.1); border-radius: 16px; text-align: center;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">✅</div>
                <div style="color: var(--success); font-weight: 600;">لا توجد دفعات معلقة أو متأخرة</div>
            </div>
        `}
    `;
    
    hideLoading();
}

// Close modal on outside click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});
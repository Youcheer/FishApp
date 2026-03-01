// app.js

// Navigation Logic
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.content-section');
const pageTitle = document.getElementById('page-title');

// Global Selects
const globalShopFilter = document.getElementById('global-shop-filter');
const selectsToPopulate = [
    document.getElementById('pos-shop'),
    document.getElementById('exp-shop'),
    document.getElementById('inv-shop'),
    document.getElementById('rep-shop')
];

// Shops Modal Globals
const shopModal = document.getElementById('shop-modal');
const shopsList = document.getElementById('shops-list');
const newShopNameInput = document.getElementById('new-shop-name');

// Fish Types Modal Globals
const fishModal = document.getElementById('fish-modal');
const fishTypesList = document.getElementById('fish-types-list');
const newFishInput = document.getElementById('new-fish-name');

// Dashboard Charts
let dashSalesChart = null;
let reportChartInstance = null;
let reportPieChartInstance = null;

// Generic Modal Globals
const genericModal = document.getElementById('generic-modal');
const genericModalTitle = document.getElementById('generic-modal-title');
const genericModalBody = document.getElementById('generic-modal-body');
const genericModalForm = document.getElementById('generic-modal-form');

window.closeGenericModal = () => {
    genericModal.classList.add('hidden');
    genericModalForm.onsubmit = null;
};

window.openGenericModal = (title, fields, onSubmit) => {
    genericModalTitle.innerText = title;
    genericModalBody.innerHTML = '';

    fields.forEach((field, index) => {
        const div = document.createElement('div');
        div.innerHTML = `
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">${field.label}</label>
            <input type="${field.type || 'text'}" id="generic-input-${index}" value="${field.value || ''}" class="w-full bg-white border-gray-300 border rounded-lg py-2 px-3 focus:ring-2 focus:ring-ocean-500 outline-none transition text-sm" ${field.required ? 'required' : ''} step="any" min="0">
        `;
        genericModalBody.appendChild(div);
    });

    genericModalForm.onsubmit = async (e) => {
        e.preventDefault();
        const results = [];
        fields.forEach((_, index) => {
            results.push(document.getElementById(`generic-input-${index}`).value);
        });
        await onSubmit(results);
        window.closeGenericModal();
    };

    genericModal.classList.remove('hidden');
};

// App State
let globalShopData = [];
let currentUser = null;

// Login Logic
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('login-username').value.trim();
        const p = document.getElementById('login-password').value.trim();
        const err = document.getElementById('login-error');

        try {
            const users = await db.users.where({ username: u, password: p }).toArray();
            if (users.length > 0) {
                err.classList.add('hidden');
                currentUser = users[0];
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                initApp();
            } else {
                err.classList.remove('hidden');
            }
        } catch (error) {
            console.error(error);
            err.innerText = "Error logging in. Try again.";
            err.classList.remove('hidden');
        }
    });
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.reload();
}

async function initLoginDropdown() {
    const loginSelect = document.getElementById('login-username');
    if (!loginSelect) return;

    loginSelect.innerHTML = '<option value="">Select User Profile...</option>';

    try {
        const users = await db.users.toArray();
        for (const u of users) {
            const opt = document.createElement('option');
            opt.value = u.username;
            if (u.role === 'admin') {
                opt.textContent = 'Admin';
            } else {
                const shop = await db.shops.get(u.shopId);
                opt.textContent = shop ? shop.name : u.username;
            }
            loginSelect.appendChild(opt);
        }
    } catch (e) { console.error("Error loading users", e); }
}

window.changeMyPassword = async () => {
    window.openGenericModal('Change My Password', [
        { label: 'Enter new password', type: 'text', required: true }
    ], async ([newPass]) => {
        try {
            await db.users.update(currentUser.id, { password: newPass.trim() });
            currentUser.password = newPass.trim();
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            alert("Password updated successfully!");
        } catch (e) {
            console.error(e);
            alert("Failed to update password.");
        }
    });
};

window.changeShopPassword = async (shopId) => {
    try {
        const userArr = await db.users.where({ shopId: shopId }).toArray();
        if (userArr.length === 0) {
            alert("No user profile found for this shop.");
            return;
        }
        const user = userArr[0];

        window.openGenericModal(`Change Password (${user.username})`, [
            { label: 'New Password', type: 'text', required: true }
        ], async ([newPass]) => {
            try {
                await db.users.update(user.id, { password: newPass.trim() });
                alert("Shop user password updated successfully.");
            } catch (e) { console.error(e); }
        });
    } catch (e) { console.error(e); }
};

async function initApp() {
    document.getElementById('login-wrapper').classList.add('hidden');
    document.getElementById('app-wrapper').classList.remove('hidden');
    document.getElementById('current-user-display').innerText = currentUser.username;

    if (currentUser.role === 'shop_user') {
        // Hide Admin Links
        document.querySelector('[data-target="dashboard"]').classList.add('hidden');
        document.querySelector('[data-target="expenses"]').classList.add('hidden');
        document.querySelector('[data-target="reports"]').classList.add('hidden');

        // Hide Admin Buttons
        const manageShopsBtn = document.querySelector('button[title="Manage Shops"]');
        if (manageShopsBtn) manageShopsBtn.classList.add('hidden');

        const manageFishBtn = document.querySelector('button[onclick="openFishModal()"]');
        if (manageFishBtn) manageFishBtn.classList.add('hidden');

        // Hide Shop selectors
        document.getElementById('pos-shop').parentElement.classList.add('hidden');
        document.getElementById('inv-shop').parentElement.classList.add('hidden');
        document.getElementById('global-shop-filter').disabled = true;
    }

    await loadShopsIntoSelects();
    await loadMasterFish();

    if (currentUser.role === 'shop_user') {
        const posShopSelect = document.getElementById('pos-shop');
        if (posShopSelect && posShopSelect.value) {
            posShopSelect.dispatchEvent(new Event('change'));
        }
        navLinks[1].click(); // POS Tab
    } else {
        navLinks[0].click(); // Dashboard Tab
    }
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();

        // Mobile sidebar specific styling removal
        navLinks.forEach(l => {
            l.classList.remove('active-nav', 'md:bg-ocean-800', 'text-white');
            l.classList.add('text-gray-300');
        });

        link.classList.remove('text-gray-300');
        link.classList.add('active-nav');

        // Title update
        pageTitle.innerHTML = link.innerHTML;

        // Hide all, show target
        const targetId = link.getAttribute('data-target');
        sections.forEach(sec => sec.classList.add('hidden-section'));
        document.getElementById(targetId).classList.remove('hidden-section');

        handleTabChange(targetId);
    });
});

function loadAppName() {
    const customName = localStorage.getItem('customAppName') || 'Fish Mart';

    const appTitleObj = document.getElementById('app-title');
    if (appTitleObj) appTitleObj.innerText = customName + ' Management & POS';

    const loginAppNameObj = document.getElementById('login-app-name');
    if (loginAppNameObj) loginAppNameObj.innerText = customName + ' Login';

    const sidebarAppNameObj = document.getElementById('sidebar-app-name');
    if (sidebarAppNameObj) sidebarAppNameObj.innerText = customName;
}

window.openSysConfigModal = () => {
    document.getElementById('sys-config-modal').classList.remove('hidden');

    // Load PDF status
    const pdfEnabled = localStorage.getItem('enablePdfReceipts') === 'true';
    const pdfStatusEl = document.getElementById('pdf-receipt-status');
    if (pdfStatusEl) {
        if (pdfEnabled) {
            pdfStatusEl.innerText = 'ON';
            pdfStatusEl.className = 'text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold';
        } else {
            pdfStatusEl.innerText = 'OFF';
            pdfStatusEl.className = 'text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded font-bold';
        }
    }

    if (currentUser && currentUser.role === 'shop_user') {
        const appNameBtn = document.getElementById('btn-config-appname');
        const backupBtn = document.getElementById('btn-config-backup');
        if (appNameBtn) appNameBtn.classList.add('hidden');
        if (backupBtn) backupBtn.classList.add('hidden');
    }
};
window.closeSysConfigModal = () => {
    document.getElementById('sys-config-modal').classList.add('hidden');
};

window.togglePdfReceipts = () => {
    const current = localStorage.getItem('enablePdfReceipts') === 'true';
    localStorage.setItem('enablePdfReceipts', (!current).toString());
    window.openSysConfigModal(); // refresh UI
};

window.changeAppName = () => {
    const currentName = localStorage.getItem('customAppName') || 'Fish Mart';
    window.openGenericModal('Change App Name', [
        { label: 'Application Name', value: currentName, type: 'text', required: true }
    ], async ([newName]) => {
        if (!newName || !newName.trim()) return;
        localStorage.setItem('customAppName', newName.trim());
        loadAppName();
        alert('App name updated successfully.');
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    loadAppName();
    // Wait slightly to ensure Dexie is loaded and DB is init if it's async in db.js
    setTimeout(async () => {
        await initLoginDropdown();
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            currentUser = JSON.parse(storedUser);
            initApp();
        }
    }, 300);
});

globalShopFilter.addEventListener('change', () => {
    updateDashboard(); // only affects dashboard right now
});

document.addEventListener('DOMContentLoaded', () => {
    const timeFilter = document.getElementById('dash-time-filter');
    if (timeFilter) {
        timeFilter.addEventListener('change', updateDashboard);
    }
    const purchasesFilter = document.getElementById('purchases-filter');
    if (purchasesFilter) {
        purchasesFilter.addEventListener('change', loadPurchases);
    }
});

function handleTabChange(tab) {
    if (tab === 'dashboard') updateDashboard();
    if (tab === 'pos') loadPOSData();
    if (tab === 'expenses') loadRecentExpenses();
    if (tab === 'inventory') {
        const dateInput = document.getElementById('inv-date');
        if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
        if (typeof loadPurchases === 'function') loadPurchases();
    }
    if (tab === 'current-inventory') {
        loadInventory();
        if (typeof window.loadStockDetails === 'function') window.loadStockDetails();
    }
    if (tab === 'customers') {
        if (typeof loadCustomers === 'function') loadCustomers();
    }
    if (tab === 'sales-records') window.loadSalesHistory();
    if (tab === 'stock-details') window.loadStockDetails();
}

async function loadShopsIntoSelects() {
    try {
        let shops = await db.shops.toArray();
        globalShopData = shops;

        // Clear globally and set base opts
        globalShopFilter.innerHTML = currentUser && currentUser.role === 'admin' ? '<option value="all">All Shops</option>' : '';
        document.getElementById('rep-shop').innerHTML = '<option value="all">All Shops</option>';
        [document.getElementById('pos-shop'), document.getElementById('exp-shop'), document.getElementById('inv-shop')].forEach(s => s.innerHTML = '');

        shops.forEach(shop => {
            if (currentUser && currentUser.role === 'shop_user' && shop.id !== currentUser.shopId) return;

            const optG = document.createElement('option');
            optG.value = shop.id;
            optG.textContent = `${shop.name} (${shop.location})`;
            globalShopFilter.appendChild(optG);

            selectsToPopulate.forEach(select => {
                const opt = document.createElement('option');
                opt.value = shop.id;
                opt.textContent = `${shop.name} (${shop.location})`;
                select.appendChild(opt);
            });
        });

        // Add 'Select Shop' placeholder only for admin if they have multiple shops
        if (currentUser && currentUser.role === 'admin') {
            [document.getElementById('pos-shop'), document.getElementById('exp-shop'), document.getElementById('inv-shop')].forEach(s => {
                const defaultOpt = document.createElement('option');
                defaultOpt.value = "";
                defaultOpt.textContent = "Select Shop";
                s.insertBefore(defaultOpt, s.firstChild);
                s.value = "";
            });
        }

        if (shopsList) {
            shopsList.innerHTML = '';
            if (shops.length === 0) {
                shopsList.innerHTML = '<li class="text-center text-gray-400 py-4 text-sm">No shops found</li>';
            } else {
                shops.forEach(shop => {
                    const li = document.createElement('li');
                    li.className = "flex justify-between items-center bg-white p-3 rounded border border-gray-100 shadow-sm";
                    li.innerHTML = `
                        <div>
                            <span class="font-bold text-gray-800 text-sm block">${shop.name}</span>
                            <span class="text-xs text-gray-500"><i class="fa-solid fa-location-dot mr-1"></i>${shop.location}</span>
                        </div>
                        <div class="space-x-3 flex-shrink-0">
                            <button onclick="changeShopPassword(${shop.id})" class="text-yellow-500 hover:text-yellow-700 transition" title="Change Password"><i class="fa-solid fa-key"></i></button>
                            <button onclick="editShopType(${shop.id}, '${shop.name.replace(/'/g, "\\'")}', '${shop.location.replace(/'/g, "\\'")}')" class="text-blue-500 hover:text-blue-700 transition" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="deleteShopType(${shop.id})" class="text-red-500 hover:text-red-700 transition" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    `;
                    shopsList.appendChild(li);
                });
            }
        }
    } catch (e) { console.error("Could not load shops:", e); }
}

window.openShopModal = () => {
    shopModal.classList.remove('hidden');
    loadShopsIntoSelects();
};
window.closeShopModal = () => {
    shopModal.classList.add('hidden');
    newShopNameInput.value = '';
    newShopLocInput.value = '';
};
window.addNewShop = async () => {
    const name = newShopNameInput.value.trim();
    const loc = newShopLocInput.value.trim();
    if (!name || !loc) {
        alert("Please enter both shop name and location.");
        return;
    }
    try {
        const newShopId = await db.shops.add({ name: name, location: loc });
        // Create user for the new shop
        const safeUsername = 'shop' + newShopId;
        await db.users.add({ username: safeUsername, password: '123', role: 'shop_user', shopId: newShopId });
        newShopNameInput.value = '';
        newShopLocInput.value = '';
        await loadShopsIntoSelects();
        await initLoginDropdown(); // Update dropdown just in case
    } catch (e) { console.error(e); alert("Failed to add shop"); }
};
window.editShopType = async (id, oldName, oldLoc) => {
    window.openGenericModal('Edit Shop', [
        { label: 'Shop Name', value: oldName, type: 'text', required: true },
        { label: 'Shop Location', value: oldLoc, type: 'text', required: true }
    ], async ([newName, newLoc]) => {
        if (newName.trim() === '' || newLoc.trim() === '') {
            alert("Name and Location cannot be empty.");
            return;
        }

        try {
            await db.shops.update(id, { name: newName.trim(), location: newLoc.trim() });
            await loadShopsIntoSelects();
            handleTabChange(document.querySelector('.nav-link.active-nav').getAttribute('data-target'));
        } catch (e) {
            console.error(e);
            alert("Failed to update shop");
        }
    });
};
window.deleteShopType = async (id) => {
    if (!confirm("Are you sure you want to delete this shop? It will not delete the related inventory or sales, but they may become orphaned.")) return;
    try {
        await db.shops.delete(id);
        const users = await db.users.where({ shopId: id }).toArray();
        for (const u of users) {
            await db.users.delete(u.id);
        }
        await loadShopsIntoSelects();
        await initLoginDropdown(); // Sync logic
        handleTabChange(document.querySelector('.nav-link.active-nav').getAttribute('data-target'));
    } catch (e) { console.error(e); }
};

// =======================
// MASTER FISH LOGIC
// =======================
async function loadMasterFish() {
    try {
        const fishes = await db.master_fish.orderBy('name').toArray();
        if (invNameSelect) {
            invNameSelect.innerHTML = '<option value="">Select Product Variety</option>';
            fishes.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.name;
                opt.textContent = f.name;
                invNameSelect.appendChild(opt);
            });
        }
        if (fishTypesList) {
            fishTypesList.innerHTML = '';
            if (fishes.length === 0) {
                fishTypesList.innerHTML = '<li class="text-center text-gray-400 py-4 text-sm">No fish types found</li>';
                return;
            }
            fishes.forEach(f => {
                const li = document.createElement('li');
                li.className = "flex justify-between items-center bg-white p-3 rounded border border-gray-100 shadow-sm fish-item-row";
                li.setAttribute('data-name', f.name.toLowerCase());
                li.innerHTML = `
                    <span class="font-semibold text-gray-700 text-sm">${f.name}</span>
                    <div class="space-x-3">
                        <button onclick="editFishType(${f.id}, '${f.name.replace(/'/g, "\\'")}')" class="text-blue-500 hover:text-blue-700 transition" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="deleteFishType(${f.id})" class="text-red-500 hover:text-red-700 transition" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                fishTypesList.appendChild(li);
            });
        }
    } catch (e) { console.error(e); }
}

window.filterMasterFish = (query) => {
    const q = query.toLowerCase().trim();
    const rows = document.querySelectorAll('.fish-item-row');
    rows.forEach(row => {
        const name = row.getAttribute('data-name') || '';
        if (name.includes(q)) {
            row.style.display = 'flex';
        } else {
            row.style.display = 'none';
        }
    });
};

window.openFishModal = () => {
    fishModal.classList.remove('hidden');
    loadMasterFish();
};
window.closeFishModal = () => {
    fishModal.classList.add('hidden');
    newFishInput.value = '';
};
window.addNewFishType = async () => {
    const name = newFishInput.value.trim();
    if (!name) return;
    try {
        await db.master_fish.add({ name });
        newFishInput.value = '';
        await loadMasterFish();
    } catch (e) { console.error(e); alert("Failed to add fish type"); }
};
window.editFishType = async (id, oldName) => {
    window.openGenericModal('Edit Product Name', [
        { label: 'Product Name', value: oldName, type: 'text', required: true }
    ], async ([newName]) => {
        if (!newName || newName.trim() === '' || newName === oldName) return;
        try {
            await db.master_fish.update(id, { name: newName.trim() });
            const matchedInv = await db.fish_items.where({ name: oldName }).toArray();
            for (const item of matchedInv) {
                await db.fish_items.update(item.id, { name: newName.trim() });
            }
            await loadMasterFish();
            loadInventory();
            if (typeof loadPurchases === 'function') loadPurchases();
        } catch (e) { console.error(e); alert("Failed to update fish name"); }
    });
};
window.deleteFishType = async (id) => {
    if (!confirm("Are you sure you want to delete this fish variety from the list?")) return;
    try {
        await db.master_fish.delete(id);
        await loadMasterFish();
    } catch (e) { console.error(e); }
};

// =======================
// DASHBOARD LOGIC
// =======================
let salesExpensesChartInstance = null;

async function updateDashboard() {
    try {
        const shopId = globalShopFilter.value;
        const todayStr = new Date().toISOString().split('T')[0];

        const timeFilter = document.getElementById('dash-time-filter') ? document.getElementById('dash-time-filter').value : 'total';

        // Fetch Data
        let salesData = await db.sales.toArray();
        let expData = await db.expenses.toArray();
        let stockData = await db.fish_items.toArray();
        let paymentData = await db.customer_payments.toArray();

        // Apply global filter
        if (shopId !== 'all') {
            const cid = parseInt(shopId);
            salesData = salesData.filter(s => s.shopId === cid);
            expData = expData.filter(e => e.shopId === cid);
            stockData = stockData.filter(st => st.shopId === cid);
        }

        let filteredSales = salesData;
        let filteredExp = expData;
        let filteredPayments = paymentData;

        if (timeFilter !== 'total') {
            const today = new Date();
            let startDateStr = '';

            if (timeFilter === 'today') {
                startDateStr = todayStr;
            } else if (timeFilter === 'weekly') {
                const d = new Date(today);
                d.setDate(d.getDate() - d.getDay());
                startDateStr = d.toISOString().split('T')[0];
            } else if (timeFilter === 'monthly') {
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                startDateStr = `${today.getFullYear()}-${mm}-01`;
            } else if (timeFilter === 'yearly') {
                startDateStr = `${today.getFullYear()}-01-01`;
            }

            filteredSales = salesData.filter(s => s.date >= startDateStr && s.date <= todayStr);
            filteredExp = expData.filter(e => e.date >= startDateStr && e.date <= todayStr);
            filteredPayments = paymentData.filter(p => p.date >= startDateStr && p.date <= todayStr);
        }

        // Calculate figures for the selected period
        const periodSales = filteredSales.reduce((a, b) => a + b.totalAmount, 0);
        const periodCashSales = filteredSales.filter(s => s.paymentType !== 'credit').reduce((a, b) => a + b.totalAmount, 0);
        const periodCreditSales = filteredSales.filter(s => s.paymentType === 'credit').reduce((a, b) => a + b.totalAmount, 0);

        const periodExp = filteredExp.reduce((a, b) => a + b.amount, 0);
        const profit = periodSales - periodExp;
        const thresholdStr = localStorage.getItem('lowStockThreshold') || '5';
        const lowStockThreshold = parseFloat(thresholdStr);
        // Exclude 0 stock from alerts, but show anything equal or below the threshold
        const alerts = stockData.filter(st => st.stockRemaining > 0 && st.stockRemaining <= lowStockThreshold).length;

        // UI Updates
        // Update Dashboard Sales to show total + breakdown
        document.getElementById('dash-sales').innerHTML = `LKR ${periodSales.toLocaleString(undefined, { minimumFractionDigits: 2 })} <br><span class="text-xs font-normal text-gray-500 tracking-normal">(Cash: LKR ${periodCashSales.toLocaleString()} | Credit: LKR ${periodCreditSales.toLocaleString()})</span>`;
        document.getElementById('dash-expenses').innerText = `LKR ${periodExp.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

        const ptDisplay = document.getElementById('dash-profit');
        ptDisplay.innerText = `LKR ${profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        ptDisplay.className = `text-2xl font-bold mt-1 transition-colors ${profit < 0 ? 'text-red-600' : 'text-gray-800'}`;

        const filterSelect = document.getElementById('dash-time-filter');
        const filterLabel = filterSelect ? filterSelect.options[filterSelect.selectedIndex].text.replace(/ \(.*\)/, '') : 'Total';
        document.getElementById('dash-sales-label').innerText = `${filterLabel} Sales`;
        document.getElementById('dash-expenses-label').innerText = `${filterLabel} Expenses`;

        document.getElementById('dash-alerts').innerText = alerts;
        document.getElementById('dash-alerts').className = `text-2xl font-bold mt-1 ${alerts > 0 ? 'text-red-600 animate-pulse' : 'text-gray-800'}`;

        await renderChart(salesData, expData);
    } catch (e) { console.error("Error updating dashboard:", e); }
}

async function renderChart(salesData, expData) {
    const ctx = document.getElementById('salesExpensesChart').getContext('2d');

    const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
    });

    const sChartData = dates.map(dt => salesData.filter(s => s.date === dt).reduce((a, b) => a + b.totalAmount, 0));
    const eChartData = dates.map(dt => expData.filter(e => e.date === dt).reduce((a, b) => a + b.amount, 0));

    if (salesExpensesChartInstance) salesExpensesChartInstance.destroy();

    salesExpensesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Sales Revenue (LKR)',
                    data: sChartData,
                    borderColor: '#008080',
                    backgroundColor: 'rgba(0, 128, 128, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Expenses (LKR)',
                    data: eChartData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } } },
            scales: { y: { beginAtZero: true, border: { dash: [4, 4] }, grid: { color: '#f3f4f6' } }, x: { grid: { display: false } } },
            interaction: { intersect: false, mode: 'index' },
        }
    });
}

// =======================
// POS LOGIC
// =======================
const posShop = document.getElementById('pos-shop');
const posFish = document.getElementById('pos-fish');
const posRadios = document.querySelectorAll('input[name="saleType"]');
const posPriceLabel = document.getElementById('pos-price');
const posStockInfo = document.getElementById('pos-stock-info');
const posWeight = document.getElementById('pos-weight');
const posAddBtn = document.getElementById('pos-add-item');
const posCartItems = document.getElementById('pos-cart-items');
const posTotal = document.getElementById('pos-total');
const posCompleteBtn = document.getElementById('pos-complete');
const posDateDisplay = document.getElementById('pos-date-display');

let currentFishItems = [];
let selectedFishItem = null;
let cart = [];

function loadPOSData() {
    posDateDisplay.innerText = new Date().toDateString();
    updateCartUI();
}

posShop.addEventListener('change', async (e) => {
    const shopId = e.target.value;
    posFish.innerHTML = '<option value="">Select Product</option>';
    posPriceLabel.value = '';
    posStockInfo.innerText = '';
    selectedFishItem = null;

    if (!shopId) {
        posFish.disabled = true;
        return;
    }

    posFish.disabled = false;
    currentFishItems = await db.fish_items.where('shopId').equals(parseInt(shopId)).toArray();

    currentFishItems.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = `${item.name}`;
        if (item.stockRemaining <= 0) opt.disabled = true;
        posFish.appendChild(opt);
    });
});

posFish.addEventListener('change', (e) => {
    selectedFishItem = currentFishItems.find(f => f.id === parseInt(e.target.value));
    updatePOSPrice();
});

posRadios.forEach(r => r.addEventListener('change', updatePOSPrice));

function updatePOSPrice() {
    if (!selectedFishItem) {
        posPriceLabel.value = '';
        posStockInfo.innerText = '';
        return;
    }
    const saleType = document.querySelector('input[name="saleType"]:checked').value;
    const price = saleType === 'retail' ? selectedFishItem.retailPrice : selectedFishItem.wholesalePrice;

    posPriceLabel.value = price.toFixed(2);
    posStockInfo.innerText = `📦 ${selectedFishItem.stockRemaining} Kg available`;
    const thresholdStr = localStorage.getItem('lowStockThreshold') || '10';
    const lowStockThreshold = parseFloat(thresholdStr);

    // Apply styling: Red if empty, yellow if low, green otherwise. Or stick to red/green per context.
    posStockInfo.className = `absolute -bottom-6 left-0 text-xs font-semibold mt-1 ${selectedFishItem.stockRemaining <= 0 ? 'text-red-500' : (selectedFishItem.stockRemaining <= lowStockThreshold ? 'text-yellow-600' : 'text-ocean-600')}`;
}

posAddBtn.addEventListener('click', () => {
    if (!selectedFishItem || !posWeight.value || posWeight.value <= 0) {
        alert('Please select a valid fish item and enter the weight.');
        return;
    }
    const weight = parseFloat(posWeight.value);

    // Validation: Calculate total weight of this item already in the cart to prevent over-selling
    const weightInCart = cart.filter(c => c.fishId === selectedFishItem.id).reduce((sum, c) => sum + c.weight, 0);

    if (weight + weightInCart > selectedFishItem.stockRemaining) {
        alert(`Not enough stock available! You only have ${selectedFishItem.stockRemaining} Kg left, and already have ${weightInCart} Kg in the current bill.`);
        return;
    }

    const saleType = document.querySelector('input[name="saleType"]:checked').value;
    const price = parseFloat(posPriceLabel.value);

    if (isNaN(price) || price <= 0) {
        alert('Please enter a valid unit price.');
        return;
    }

    cart.push({
        fishId: selectedFishItem.id,
        fishName: selectedFishItem.name,
        shopId: parseInt(posShop.value),
        saleType: saleType,
        weight: weight,
        unitPrice: price,
        totalAmount: weight * price
    });

    posWeight.value = '';
    posFish.value = '';
    selectedFishItem = null;
    posPriceLabel.value = '';
    posStockInfo.innerText = '';
    updateCartUI();
});

function updateCartUI() {
    posCartItems.innerHTML = '';
    let grandTotal = 0;

    if (cart.length === 0) {
        posCartItems.innerHTML = `<li class="text-center text-gray-400 py-10 text-sm flex flex-col items-center"><i class="fa-solid fa-basket-shopping text-4xl mb-3 text-gray-300"></i>Cart is empty</li>`;
        posCompleteBtn.disabled = true;
    } else {
        cart.forEach((item, index) => {
            grandTotal += item.totalAmount;
            const li = document.createElement('li');
            li.className = 'py-4 flex justify-between items-center bg-white shadow-sm border border-gray-100 rounded-lg mb-2 px-4 hover:shadow transition';
            li.innerHTML = `
                <div class="flex-1">
                    <h4 class="text-sm font-bold text-gray-800">${item.fishName} <span class="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded ml-2 uppercase tracking-wide font-bold">${item.saleType}</span></h4>
                    <p class="text-xs text-gray-500 mt-1"><i class="fa-solid fa-weight-hanging text-gray-400 mr-1"></i> ${item.weight} Kg &times; LKR ${item.unitPrice}</p>
                </div>
                <div class="flex items-center ml-4 border-l pl-4 border-gray-100">
                    <span class="font-bold text-ocean-900 mr-3 text-sm md:text-base whitespace-nowrap">LKR ${item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <button onclick="removeFromCart(${index})" class="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            posCartItems.appendChild(li);
        });
        posCompleteBtn.disabled = false;
    }
    posTotal.innerText = `LKR ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

window.removeFromCart = function (index) {
    cart.splice(index, 1);
    updateCartUI();
}

posCompleteBtn.addEventListener('click', async () => {
    if (cart.length === 0) return;

    const paymentType = document.querySelector('input[name="paymentType"]:checked').value;
    const customerIdEl = document.getElementById('pos-customer');
    let customerId = null;

    if (paymentType === 'credit') {
        customerId = parseInt(customerIdEl.value);
        if (isNaN(customerId)) {
            alert('Please select a customer for credit sale.');
            return;
        }
    }

    try {
        const today = new Date().toISOString().split('T')[0];

        await db.transaction('rw', db.sales, db.fish_items, async () => {
            for (const item of cart) {
                await db.sales.add({
                    date: today,
                    shopId: item.shopId,
                    fishId: item.fishId,
                    saleType: item.saleType,
                    weight: item.weight,
                    totalAmount: item.totalAmount,
                    paymentType: paymentType,
                    customerId: customerId
                });
                const fish = await db.fish_items.get(item.fishId);
                await db.fish_items.update(item.fishId, { stockRemaining: fish.stockRemaining - item.weight });
            }
        });

        const shopName = posShop.options[posShop.selectedIndex].text;
        const grandTotal = cart.reduce((sum, item) => sum + item.totalAmount, 0);
        const receiptCart = [...cart];
        const pType = paymentType;
        const cId = customerId;

        alert('Sale completed successfully!');

        const pdfEnabled = localStorage.getItem('enablePdfReceipts') === 'true';
        if (pdfEnabled) {
            generatePrintReceipt(receiptCart, pType, cId, grandTotal, shopName);
        }

        cart = [];
        updateCartUI();
        posShop.dispatchEvent(new Event('change')); // refresh lists

        // Reset Payment Selection
        document.querySelector('input[name="paymentType"][value="cash"]').checked = true;
        window.toggleCustomerSelect();
        customerIdEl.value = '';

    } catch (e) {
        console.error(e);
        alert('Transaction Failed!');
    }
});


// =======================
// EXPENSES LOGIC
// =======================
const expForm = document.getElementById('expense-form');
const expTableBody = document.getElementById('expenses-table-body');

expForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await db.expenses.add({
        date: document.getElementById('exp-date').value,
        shopId: parseInt(document.getElementById('exp-shop').value),
        category: document.getElementById('exp-cat').value,
        amount: parseFloat(document.getElementById('exp-amount').value),
        description: document.getElementById('exp-desc').value
    });
    expForm.reset();
    alert('Expense recorded.');
    loadRecentExpenses();
});

async function loadRecentExpenses() {
    try {
        const exps = await db.expenses.reverse().limit(30).toArray();
        expTableBody.innerHTML = '';
        if (exps.length === 0) {
            expTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-10 text-gray-400">No expenses recorded yet</td></tr>';
            return;
        }
        for (const exp of exps) {
            const shop = globalShopData.find(s => s.id === exp.shopId);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-gray-700">${exp.date}</td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap"><span class="font-semibold text-ocean-900">${shop ? shop.name : ''}</span></td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap"><span class="px-2.5 py-1 bg-gray-100 border border-gray-200 text-gray-600 rounded-md text-xs font-semibold">${exp.category}</span></td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-right font-bold text-red-500">-LKR ${exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            `;
            expTableBody.appendChild(tr);
        }
    } catch (e) { console.error(e); }
}

// File to Base64 utility
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// =======================
// INVENTORY LOGIC
// =======================
const invForm = document.getElementById('inventory-form');
const invTableBody = document.getElementById('inventory-table-body');
const purTableBody = document.getElementById('purchases-table-body');

invForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const shopId = parseInt(document.getElementById('inv-shop').value);
    const name = document.getElementById('inv-name').value.trim();
    const wsPrice = parseFloat(document.getElementById('inv-ws-price').value);
    const rtPrice = parseFloat(document.getElementById('inv-rt-price').value);
    const addStock = parseFloat(document.getElementById('inv-stock').value);
    const totalCost = parseFloat(document.getElementById('inv-total-cost').value);
    const billFileInput = document.getElementById('inv-bill');

    let billImage = null;
    if (billFileInput.files.length > 0) {
        billImage = await fileToBase64(billFileInput.files[0]);
    }

    const purchaseDate = document.getElementById('inv-date').value || new Date().toISOString().split('T')[0];

    try {
        await db.transaction('rw', db.fish_items, db.purchases, db.expenses, async () => {
            // Ensure combination uniqueness manually
            const existingArr = await db.fish_items.where({ shopId, name }).toArray();
            const existing = existingArr[0];

            if (existing) {
                await db.fish_items.update(existing.id, {
                    wholesalePrice: wsPrice,
                    retailPrice: rtPrice,
                    stockRemaining: existing.stockRemaining + addStock
                });
            } else {
                await db.fish_items.add({
                    name, shopId, wholesalePrice: wsPrice, retailPrice: rtPrice, stockRemaining: addStock
                });
            }

            // Log Purchase
            await db.purchases.add({
                date: purchaseDate,
                shopId: shopId,
                fishName: name,
                weight: addStock,
                totalCost: totalCost,
                billImage: billImage
            });

            // Log as expense
            await db.expenses.add({
                date: purchaseDate,
                shopId: shopId,
                category: 'Other/Miscellaneous',
                amount: totalCost,
                description: `Fish Purchase: ${addStock}Kg of ${name}`
            });
        });

        alert('✅ Purchase logged & Stock updated successfully.');
        invForm.reset();
        loadInventory();
        loadPurchases();
    } catch (err) {
        console.error("Error logging purchase:", err);
        alert('❌ Error logging purchase. Check console for details.');
    }
});

async function loadInventory() {
    try {
        let items = await db.fish_items.toArray();
        if (currentUser && currentUser.role === 'shop_user') {
            items = items.filter(item => item.shopId === currentUser.shopId);
        }
        invTableBody.innerHTML = '';
        if (items.length === 0) {
            invTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-gray-400">Inventory is empty</td></tr>';
            return;
        }
        for (const item of items) {
            const shop = globalShopData.find(s => s.id === item.shopId);
            const tr = document.createElement('tr');
            const thresholdStr = localStorage.getItem('lowStockThreshold') || '10';
            const lowStockThreshold = parseFloat(thresholdStr);
            const lowStock = item.stockRemaining > 0 && item.stockRemaining <= lowStockThreshold;
            const noStock = item.stockRemaining <= 0;

            let adminActions = '';
            if (currentUser && currentUser.role === 'admin') {
                adminActions = `
                    <button onclick="editInventory(${item.id})" class="text-blue-500 hover:text-blue-700 mx-1 transition" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="deleteInventory(${item.id})" class="text-red-500 hover:text-red-700 mx-1 transition" title="Delete"><i class="fa-solid fa-trash"></i></button>
                `;
            } else {
                adminActions = `<span class="text-xs text-gray-400 italic">N/A</span>`;
            }

            tr.innerHTML = `
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap"><span class="font-bold text-ocean-900">${shop ? shop.name : ''}</span></td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap font-semibold text-gray-700">${item.name}</td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-center">
                    <div class="text-xs text-gray-500 font-mono"><span class="text-gray-400">WS:</span> LKR ${item.wholesalePrice}</div>
                    <div class="text-xs text-gray-500 font-mono mt-1"><span class="text-gray-400">RT:</span> LKR ${item.retailPrice}</div>
                </td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-right font-black ${noStock ? 'text-red-600' : (lowStock ? 'text-yellow-500' : 'text-green-600')}">
                    ${noStock ? '<i class="fa-solid fa-xmark mr-1 text-xs"></i>' : (lowStock ? '<i class="fa-solid fa-triangle-exclamation mr-1 text-xs"></i>' : '')} ${item.stockRemaining.toFixed(2)} Kg
                </td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-center">
                    ${adminActions}
                </td>
            `;
            invTableBody.appendChild(tr);
        }
    } catch (e) { console.error(e); }
}

window.editInventory = async (id) => {
    try {
        const item = await db.fish_items.get(id);
        if (!item) return;

        window.openGenericModal(`Edit Inventory (${item.name})`, [
            { label: 'Wholesale Price (LKR)', value: item.wholesalePrice, type: 'number', required: true },
            { label: 'Retail Price (LKR)', value: item.retailPrice, type: 'number', required: true },
            { label: 'Stock Remaining (Kg)', value: item.stockRemaining, type: 'number', required: true }
        ], async ([newWsStr, newRtStr, newStockStr]) => {
            const newWs = parseFloat(newWsStr);
            const newRt = parseFloat(newRtStr);
            const newStock = parseFloat(newStockStr);

            if (isNaN(newWs) || isNaN(newRt) || isNaN(newStock)) {
                alert("Please enter valid numbers.");
                return;
            }

            try {
                await db.fish_items.update(id, {
                    wholesalePrice: newWs,
                    retailPrice: newRt,
                    stockRemaining: newStock
                });
                alert('Inventory updated successfully.');
                loadInventory();
                if (typeof window.loadStockDetails === 'function') window.loadStockDetails();
            } catch (e) {
                console.error("Error editing inventory:", e);
                alert("Failed to edit inventory.");
            }
        });
    } catch (e) {
        console.error("Error accessing inventory:", e);
        alert("Failed to access inventory.");
    }
};

window.openWastageModal = async () => {
    try {
        let shops = await db.shops.toArray();
        if (currentUser && currentUser.role === 'shop_user') {
            shops = shops.filter(s => s.id === currentUser.shopId);
        }

        if (shops.length === 0) {
            alert("No shops found to log wastage.");
            return;
        }

        genericModalTitle.innerText = "Log Fish Wastage";
        genericModalBody.innerHTML = '';

        // Shop Select
        const shopDiv = document.createElement('div');
        shopDiv.innerHTML = `<label class="block text-sm font-semibold text-gray-700 mb-1.5">Shop / Location <span class="text-red-500">*</span></label>
        <select id="waste-shop" required class="w-full bg-white border-gray-300 border rounded-lg py-2 px-3 focus:ring-2 focus:ring-ocean-500 outline-none transition text-sm">
            <option value="">Select Shop</option>
            ${shops.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>`;
        genericModalBody.appendChild(shopDiv);

        // Fish Select (depends on shop)
        const fishDiv = document.createElement('div');
        fishDiv.innerHTML = `<label class="block text-sm font-semibold text-gray-700 mb-1.5 mt-2">Fish Item <span class="text-red-500">*</span></label>
        <select id="waste-fish" required class="w-full bg-white border-gray-300 border rounded-lg py-2 px-3 focus:ring-2 focus:ring-ocean-500 outline-none transition text-sm" disabled>
            <option value="">Select Shop First</option>
        </select>`;
        genericModalBody.appendChild(fishDiv);

        const weightDiv = document.createElement('div');
        weightDiv.innerHTML = `<label class="block text-sm font-semibold text-gray-700 mb-1.5 mt-2">Wasted Weight (Kg) <span class="text-red-500">*</span></label>
        <input type="number" id="waste-weight" step="any" min="0" required class="w-full bg-white border-gray-300 border rounded-lg py-2 px-3 focus:ring-2 focus:ring-ocean-500 outline-none transition text-sm">`;
        genericModalBody.appendChild(weightDiv);

        const valDiv = document.createElement('div');
        valDiv.innerHTML = `<label class="block text-sm font-semibold text-gray-700 mb-1.5 mt-2">Estimated Loss (LKR) <span class="text-red-500">*</span></label>
        <input type="number" id="waste-val" step="any" min="0" required class="w-full bg-white border-gray-300 border rounded-lg py-2 px-3 focus:ring-2 focus:ring-ocean-500 outline-none transition text-sm">`;
        genericModalBody.appendChild(valDiv);

        const shopSelect = document.getElementById('waste-shop');
        const fishSelect = document.getElementById('waste-fish');
        const weightInp = document.getElementById('waste-weight');
        const valInp = document.getElementById('waste-val');

        let currentShopItems = [];

        shopSelect.addEventListener('change', async () => {
            const sid = parseInt(shopSelect.value);
            fishSelect.innerHTML = '<option value="">Select Product</option>';
            if (!sid) {
                fishSelect.disabled = true;
                return;
            }
            fishSelect.disabled = false;
            currentShopItems = await db.fish_items.where('shopId').equals(sid).toArray();
            currentShopItems.forEach(fi => {
                if (fi.stockRemaining > 0) {
                    fishSelect.innerHTML += `<option value="${fi.id}">${fi.name} (Max: ${fi.stockRemaining.toFixed(2)}Kg)</option>`;
                }
            });
        });

        // Auto calculate estimated loss
        weightInp.addEventListener('input', () => {
            const fid = parseInt(fishSelect.value);
            const w = parseFloat(weightInp.value);
            if (fid && !isNaN(w)) {
                const fi = currentShopItems.find(i => i.id === fid);
                if (fi) {
                    valInp.value = (fi.wholesalePrice * w).toFixed(2);
                }
            }
        });

        // Auto trigger if shop user
        if (currentUser && currentUser.role === 'shop_user') {
            shopSelect.value = currentUser.shopId;
            shopSelect.dispatchEvent(new Event('change'));
            shopSelect.parentElement.classList.add('hidden');
        }

        genericModalForm.onsubmit = async (e) => {
            e.preventDefault();
            const sid = parseInt(shopSelect.value);
            const fid = parseInt(fishSelect.value);
            const weight = parseFloat(weightInp.value);
            const loss = parseFloat(valInp.value);

            if (!sid || !fid || isNaN(weight) || isNaN(loss) || weight <= 0 || loss < 0) {
                alert("Please fill all fields correctly.");
                return;
            }

            const fi = currentShopItems.find(i => i.id === fid);
            if (!fi || weight > fi.stockRemaining) {
                alert("Not enough stock available to mark as wasted.");
                return;
            }

            try {
                const today = new Date().toISOString().split('T')[0];
                await db.transaction('rw', db.fish_items, db.wastage, db.expenses, async () => {
                    await db.fish_items.update(fid, { stockRemaining: fi.stockRemaining - weight });

                    await db.wastage.add({
                        date: today,
                        shopId: sid,
                        fishName: fi.name,
                        weight: weight,
                        estimatedLoss: loss
                    });

                    await db.expenses.add({
                        date: today,
                        shopId: sid,
                        category: 'Other/Miscellaneous',
                        amount: loss,
                        description: `Fish Wastage: ${weight}Kg of ${fi.name}`
                    });
                });

                alert("Wastage logged successfully.");
                window.closeGenericModal();
                loadInventory();
                loadRecentExpenses();
                if (typeof window.loadStockDetails === 'function') window.loadStockDetails();
            } catch (err) {
                console.error(err);
                alert("Failed to log wastage.");
            }
        };

        genericModal.classList.remove('hidden');

    } catch (e) {
        console.error(e);
        alert("Error opening wastage form.");
    }
};

window.openTransferModal = async () => {
    try {
        let shops = await db.shops.toArray();
        if (shops.length < 2) {
            alert("At least two shops are required to transfer stock.");
            return;
        }

        genericModalTitle.innerText = "Transfer Stock Between Shops";
        genericModalBody.innerHTML = '';

        // From Shop Select
        const fromShopDiv = document.createElement('div');
        let fromShops = shops;
        if (currentUser && currentUser.role === 'shop_user') {
            fromShops = shops.filter(s => s.id === currentUser.shopId);
        }

        fromShopDiv.innerHTML = `<label class="block text-sm font-semibold text-gray-700 mb-1.5">From Shop <span class="text-red-500">*</span></label>
        <select id="transfer-from-shop" required class="w-full bg-white border-gray-300 border rounded-lg py-2 px-3 focus:ring-2 focus:ring-ocean-500 outline-none transition text-sm">
            <option value="">Select Origin Shop</option>
            ${fromShops.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>`;
        genericModalBody.appendChild(fromShopDiv);

        // To Shop Select
        const toShopDiv = document.createElement('div');
        toShopDiv.innerHTML = `<label class="block text-sm font-semibold text-gray-700 mb-1.5 mt-2">To Shop <span class="text-red-500">*</span></label>
        <select id="transfer-to-shop" required class="w-full bg-white border-gray-300 border rounded-lg py-2 px-3 focus:ring-2 focus:ring-ocean-500 outline-none transition text-sm">
            <option value="">Select Destination Shop</option>
            ${shops.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>`;
        genericModalBody.appendChild(toShopDiv);

        // Fish Select (depends on from shop)
        const fishDiv = document.createElement('div');
        fishDiv.innerHTML = `<label class="block text-sm font-semibold text-gray-700 mb-1.5 mt-2">Fish Item <span class="text-red-500">*</span></label>
        <select id="transfer-fish" required class="w-full bg-white border-gray-300 border rounded-lg py-2 px-3 focus:ring-2 focus:ring-ocean-500 outline-none transition text-sm" disabled>
            <option value="">Select Origin Shop First</option>
        </select>`;
        genericModalBody.appendChild(fishDiv);

        const weightDiv = document.createElement('div');
        weightDiv.innerHTML = `<label class="block text-sm font-semibold text-gray-700 mb-1.5 mt-2">Transfer Weight (Kg) <span class="text-red-500">*</span></label>
        <input type="number" id="transfer-weight" step="any" min="0" required class="w-full bg-white border-gray-300 border rounded-lg py-2 px-3 focus:ring-2 focus:ring-ocean-500 outline-none transition text-sm">`;
        genericModalBody.appendChild(weightDiv);

        const fromShopSelect = document.getElementById('transfer-from-shop');
        const toShopSelect = document.getElementById('transfer-to-shop');
        const fishSelect = document.getElementById('transfer-fish');
        const weightInp = document.getElementById('transfer-weight');

        let currentFromShopItems = [];

        fromShopSelect.addEventListener('change', async () => {
            const sid = parseInt(fromShopSelect.value);
            fishSelect.innerHTML = '<option value="">Select Product</option>';
            if (!sid) {
                fishSelect.disabled = true;
                return;
            }
            fishSelect.disabled = false;
            currentFromShopItems = await db.fish_items.where('shopId').equals(sid).toArray();
            currentFromShopItems.forEach(fi => {
                if (fi.stockRemaining > 0) {
                    fishSelect.innerHTML += `<option value="${fi.id}">${fi.name} (Available: ${fi.stockRemaining.toFixed(2)}Kg)</option>`;
                }
            });

            // disable current shop in destination select
            Array.from(toShopSelect.options).forEach(opt => {
                opt.disabled = (parseInt(opt.value) === sid);
            });
        });

        // Auto trigger if shop user
        if (currentUser && currentUser.role === 'shop_user') {
            fromShopSelect.value = currentUser.shopId;
            fromShopSelect.dispatchEvent(new Event('change'));
            fromShopSelect.parentElement.classList.add('hidden');
        }

        genericModalForm.onsubmit = async (e) => {
            e.preventDefault();
            const fromSid = parseInt(fromShopSelect.value);
            const toSid = parseInt(toShopSelect.value);
            const fid = parseInt(fishSelect.value);
            const weight = parseFloat(weightInp.value);

            if (!fromSid || !toSid || !fid || isNaN(weight) || weight <= 0) {
                alert("Please fill all fields correctly.");
                return;
            }

            if (fromSid === toSid) {
                alert("Cannot transfer to the same shop.");
                return;
            }

            const fi = currentFromShopItems.find(i => i.id === fid);
            if (!fi || weight > fi.stockRemaining) {
                alert("Not enough stock available to transfer.");
                return;
            }

            try {
                await db.transaction('rw', db.fish_items, db.transfers, async () => {
                    // Update fromShop stock
                    await db.fish_items.update(fid, { stockRemaining: fi.stockRemaining - weight });

                    // Check if toShop already has this fish type
                    const toShopItems = await db.fish_items.where('shopId').equals(toSid).toArray();
                    const existingToShopItem = toShopItems.find(i => i.name === fi.name);

                    if (existingToShopItem) {
                        // Add weight to existing
                        await db.fish_items.update(existingToShopItem.id, {
                            stockRemaining: existingToShopItem.stockRemaining + weight
                        });
                    } else {
                        // Create new item in toShop with same prices
                        await db.fish_items.add({
                            shopId: toSid,
                            name: fi.name,
                            wholesalePrice: fi.wholesalePrice,
                            retailPrice: fi.retailPrice,
                            stockRemaining: weight
                        });
                    }

                    // Log transfer
                    const tempDate = new Date().toISOString().split('T')[0];
                    await db.transfers.add({
                        date: tempDate,
                        fromShopId: fromSid,
                        toShopId: toSid,
                        fishName: fi.name,
                        weight: weight
                    });
                });

                alert("Stock transferred successfully.");
                window.closeGenericModal();
                loadInventory();
                if (typeof window.loadStockDetails === 'function') window.loadStockDetails();
            } catch (err) {
                console.error(err);
                alert("Failed to transfer stock.");
            }
        };

        genericModal.classList.remove('hidden');

    } catch (e) {
        console.error(e);
        alert("Error opening transfer form.");
    }
};

window.deleteInventory = async (id) => {
    try {
        const item = await db.fish_items.get(id);
        if (!item) return;

        if (!confirm(`Are you sure you want to delete ${item.name} from this shop's inventory?`)) return;

        await db.fish_items.delete(id);

        alert('Inventory record deleted successfully.');
        loadInventory();
        if (typeof window.loadStockDetails === 'function') window.loadStockDetails();
    } catch (e) {
        console.error("Error deleting inventory:", e);
        alert("Failed to delete inventory.");
    }
};

async function loadPurchases() {
    try {
        if (!purTableBody) return;
        const filterVal = document.getElementById('purchases-filter') ? document.getElementById('purchases-filter').value : 'all';
        let allLogs = [];

        if (filterVal === 'all' || filterVal === 'purchases') {
            let purchases = await db.purchases.toArray();
            purchases.forEach(p => allLogs.push({ ...p, _type: 'purchase' }));
        }

        if (filterVal === 'all' || filterVal === 'wastage') {
            let wastage = await db.wastage.toArray();
            wastage.forEach(w => allLogs.push({ ...w, _type: 'wastage' }));
        }

        if (filterVal === 'all' || filterVal === 'transfers') {
            let transfers = await db.transfers.toArray();
            transfers.forEach(t => allLogs.push({ ...t, _type: 'transfer' }));
        }

        if (currentUser && currentUser.role === 'shop_user') {
            allLogs = allLogs.filter(l =>
                (l.shopId && l.shopId === currentUser.shopId) ||
                (l._type === 'transfer' && (l.fromShopId === currentUser.shopId || l.toShopId === currentUser.shopId))
            );
        }

        allLogs.sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            return b.id - a.id;
        });

        allLogs = allLogs.slice(0, 50);

        purTableBody.innerHTML = '';
        if (allLogs.length === 0) {
            purTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-gray-400">No activity recorded yet</td></tr>';
            return;
        }

        for (const log of allLogs) {
            const tr = document.createElement('tr');

            let shopDisplay = '';
            let productDisplay = log.fishName;
            let activityDisplay = '';
            let infoDisplay = '';

            if (log._type === 'purchase') {
                const shop = globalShopData.find(s => s.id === log.shopId);
                shopDisplay = `<span class="font-bold text-ocean-900">${shop ? shop.name : ''}</span>`;
                activityDisplay = `
                    <div class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold inline-block mb-1">PURCHASE</div>
                    <div class="text-xs text-gray-500 font-mono"><span class="font-bold text-gray-800">${log.weight.toFixed(2)} Kg</span></div>`;

                let adminActions = (currentUser && currentUser.role === 'admin') ? `
                    <button onclick="editPurchase(${log.id})" class="text-blue-500 hover:text-blue-700 mx-2 transition" title="Edit Purchase"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="deletePurchase(${log.id})" class="text-red-500 hover:text-red-700" title="Delete Purchase"><i class="fa-solid fa-trash"></i></button>
                ` : '';

                let billHtml = `<span class="text-gray-300 text-xs italic">No Bill</span>`;
                if (log.billImage) {
                    billHtml = `<a href="${log.billImage}" target="_blank" class="text-ocean-500 hover:text-ocean-700 font-semibold px-2 py-1 bg-ocean-50 rounded border border-ocean-100 text-xs shadow-sm whitespace-nowrap"><i class="fa-solid fa-file-invoice mr-1"></i> View</a>`;
                }

                infoDisplay = `<div class="text-xs text-red-500 font-mono font-bold">- LKR ${log.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                               <div class="mt-1">${billHtml} ${adminActions}</div>`;
            } else if (log._type === 'wastage') {
                const shop = globalShopData.find(s => s.id === log.shopId);
                shopDisplay = `<span class="font-bold text-orange-900">${shop ? shop.name : ''}</span>`;
                activityDisplay = `
                    <div class="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold inline-block mb-1">WASTAGE</div>
                    <div class="text-xs text-gray-500 font-mono"><span class="font-bold text-gray-800">${log.weight.toFixed(2)} Kg</span></div>`;
                infoDisplay = `<div class="text-xs text-orange-500 font-mono font-bold">Loss: LKR ${log.estimatedLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>`;
            } else if (log._type === 'transfer') {
                const fShop = globalShopData.find(s => s.id === log.fromShopId);
                const tShop = globalShopData.find(s => s.id === log.toShopId);
                shopDisplay = `<span class="font-bold text-blue-900">${fShop ? fShop.name : '?'}</span> <i class="fa-solid fa-arrow-right text-gray-400 text-xs mx-1"></i> <span class="font-bold text-blue-900">${tShop ? tShop.name : '?'}</span>`;
                activityDisplay = `
                    <div class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold inline-block mb-1">TRANSFER</div>
                    <div class="text-xs text-gray-500 font-mono"><span class="font-bold text-gray-800">${log.weight.toFixed(2)} Kg</span></div>`;
                infoDisplay = `<div class="text-xs text-gray-500 italic">Inter-shop transfer</div>`;
            }

            tr.innerHTML = `
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-gray-700">${log.date}</td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap">${shopDisplay}</td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap font-semibold text-gray-700">${productDisplay}</td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap">${activityDisplay}</td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap">${infoDisplay}</td>
            `;
            purTableBody.appendChild(tr);
        }
    } catch (e) { console.error(e); }
}

window.deletePurchase = async (id) => {
    if (!confirm("Are you sure you want to delete this purchase? (Note: It will not revert the inventory stock)")) return;
    try {
        await db.purchases.delete(id);
        loadPurchases();
    } catch (e) { console.error(e); }
};

window.editPurchase = async (id) => {
    try {
        const pur = await db.purchases.get(id);
        if (!pur) return;

        window.openGenericModal(`Edit Purchase (${pur.fishName})`, [
            { label: 'Purchased Weight (Kg)', value: pur.weight, type: 'number', required: true },
            { label: 'Total Cost (LKR)', value: pur.totalCost, type: 'number', required: true }
        ], async ([newWeightStr, newCostStr]) => {
            const newWeight = parseFloat(newWeightStr);
            const newCost = parseFloat(newCostStr);
            if (isNaN(newWeight) || isNaN(newCost) || newWeight < 0 || newCost < 0) {
                alert("Please enter valid numbers.");
                return;
            }
            try {
                await db.purchases.update(id, { weight: newWeight, totalCost: newCost });
                loadPurchases();
            } catch (e) { console.error(e); alert("Failed to edit purchase."); }
        });
    } catch (e) { console.error(e); }
};

// =======================
// REPORTS LOGIC
// =======================
const btnGenReport = document.getElementById('btn-generate-report');

btnGenReport.addEventListener('click', async () => {
    const shopId = document.getElementById('rep-shop').value;
    const startObj = document.getElementById('rep-start').value;
    const endObj = document.getElementById('rep-end').value;

    if (!startObj || !endObj) {
        alert("Please select both Start and End dates.");
        return;
    }

    try {
        let sales = await db.sales.where('date').between(startObj, endObj, true, true).toArray();
        let exps = await db.expenses.where('date').between(startObj, endObj, true, true).toArray();
        let payments = await db.customer_payments.where('date').between(startObj, endObj, true, true).toArray();

        let purchasesForRep = await db.purchases.where('date').between(startObj, endObj, true, true).toArray();
        let wastageForRep = await db.wastage.where('date').between(startObj, endObj, true, true).toArray();

        let shopCustomerIds = null;
        if (shopId !== 'all') {
            const sid = parseInt(shopId);
            sales = sales.filter(s => s.shopId === sid);
            exps = exps.filter(e => e.shopId === sid);
            purchasesForRep = purchasesForRep.filter(p => p.shopId === sid);
            wastageForRep = wastageForRep.filter(w => w.shopId === sid);

            // Keep credit/payment metrics scoped to customers who bought on credit from this shop.
            const shopCreditSales = await db.sales.where('shopId').equals(sid).toArray();
            shopCustomerIds = new Set(
                shopCreditSales
                    .filter(s => s.paymentType === 'credit' && Number.isInteger(s.customerId))
                    .map(s => s.customerId)
            );
            payments = payments.filter(p => shopCustomerIds.has(p.customerId));
        }

        const totalRev = sales.reduce((sum, s) => sum + s.totalAmount, 0);
        const cashRev = sales.filter(s => s.paymentType !== 'credit').reduce((sum, s) => sum + s.totalAmount, 0);
        const creditRev = sales.filter(s => s.paymentType === 'credit').reduce((sum, s) => sum + s.totalAmount, 0);
        const collectedCredit = payments.reduce((sum, p) => sum + p.amount, 0);

        // Filter out auto-logged purchases/wastage to avoid double counting
        const pureExps = exps.filter(x => !x.description.startsWith('Fish Purchase:') && !x.description.startsWith('Fish Wastage:'));
        const totalPureExp = pureExps.reduce((sum, e) => sum + e.amount, 0);
        const totalPurchasesCost = purchasesForRep.reduce((sum, p) => sum + p.totalCost, 0);

        // Net Cash Profit = Sales - Pure Expenses - Fish Purchases
        // (Wastage is an inventory loss, the cash was already spent at purchase, so don't subtract it again!)
        const totalExp = totalPureExp + totalPurchasesCost;
        const net = totalRev - totalExp;

        document.getElementById('rep-revenue').innerHTML = `LKR ${totalRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}<br><span class="text-xs font-normal text-gray-500 mt-2 block tracking-normal">(Cash: LKR ${cashRev.toLocaleString()} | Credit: LKR ${creditRev.toLocaleString()})<br>Credit Recovered: LKR ${collectedCredit.toLocaleString()}</span>`;
        document.getElementById('rep-exp').innerText = `LKR ${totalExp.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        document.getElementById('rep-pl').innerText = `LKR ${Math.abs(net).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

        document.getElementById('rep-period').innerText = `From: ${startObj} To: ${endObj}`;

        const plCard = document.getElementById('rep-pl-card');
        const plBorder = document.getElementById('rep-pl-border');
        const plIconBg = document.getElementById('rep-pl-icon-bg');
        const plIcon = document.getElementById('rep-pl-icon');
        const plText = document.getElementById('rep-pl');

        if (net < 0) {
            plBorder.className = 'absolute top-0 left-0 w-full h-1 bg-red-500';
            plIconBg.className = 'inline-flex p-3 bg-red-100 text-red-600 rounded-full mb-3';
            plIcon.className = 'fa-solid fa-arrow-down-long fa-lg';
            plText.className = 'text-4xl font-black text-red-600 tracking-tighter mt-1';
        } else {
            plBorder.className = 'absolute top-0 left-0 w-full h-1 bg-blue-500';
            plIconBg.className = 'inline-flex p-3 bg-blue-100 text-blue-600 rounded-full mb-3';
            plIcon.className = 'fa-solid fa-scale-balanced fa-lg';
            plText.className = 'text-4xl font-black text-gray-900 tracking-tighter mt-1';
        }

        // Calculate Stock Value for Selected Shop(s)
        let inventoryItems = await db.fish_items.toArray();
        if (shopId !== 'all') {
            const sid = parseInt(shopId);
            inventoryItems = inventoryItems.filter(i => i.shopId === sid);
        }
        const totalStockValue = inventoryItems.reduce((sum, item) => sum + (item.stockRemaining * item.wholesalePrice), 0);
        document.getElementById('rep-stock-val').innerText = `LKR ${totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

        // Calculate Pending Credit
        let allSales = await db.sales.toArray();
        let allPayments = await db.customer_payments.toArray();
        if (shopId !== 'all') {
            const sid = parseInt(shopId);
            allSales = allSales.filter(s => s.shopId === sid);
            if (shopCustomerIds) {
                allPayments = allPayments.filter(p => shopCustomerIds.has(p.customerId));
            }
        }
        const totalCreditIssued = allSales.filter(s => s.paymentType === 'credit').reduce((sum, s) => sum + s.totalAmount, 0);
        const totalCreditPaid = allPayments.reduce((sum, p) => sum + p.amount, 0); // Note: In a real system, payments should be linked to shops or specific bills.
        const pendingCredit = totalCreditIssued - totalCreditPaid;
        document.getElementById('rep-credit-val').innerText = `LKR ${Math.max(0, pendingCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;


        // Draw Chart
        const ctx = document.getElementById('reportChart');
        if (ctx) {
            if (reportChartInstance) {
                reportChartInstance.destroy();
            }
            reportChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Revenue (Cash)', 'Revenue (Credit)', 'Expenses', 'Net Profit/Loss', 'Stock Value', 'Pending Credit'],
                    datasets: [{
                        label: 'Financial Breakdown (LKR)',
                        data: [cashRev, creditRev, totalExp, net, totalStockValue, pendingCredit],
                        backgroundColor: [
                            'rgba(34, 197, 94, 0.7)',  // Green
                            'rgba(168, 85, 247, 0.7)', // Purple
                            'rgba(239, 68, 68, 0.7)',  // Red
                            net >= 0 ? 'rgba(59, 130, 246, 0.7)' : 'rgba(239, 68, 68, 0.7)', // Blue or Red
                            'rgba(245, 158, 11, 0.7)',  // Orange/Amber
                            'rgba(236, 72, 153, 0.7)'   // Pink
                        ],
                        borderRadius: 6,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }

        const pieCtx = document.getElementById('reportPieChart');
        if (pieCtx) {
            if (reportPieChartInstance) {
                reportPieChartInstance.destroy();
            }
            reportPieChartInstance = new Chart(pieCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Cash Revenue', 'Credit Revenue', 'Expenses'],
                    datasets: [{
                        data: [cashRev, creditRev, totalExp],
                        backgroundColor: [
                            'rgba(34, 197, 94, 0.7)',  // Green
                            'rgba(168, 85, 247, 0.7)', // Purple
                            'rgba(239, 68, 68, 0.7)'   // Red
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }

        // --- Daily Sales Breakdown ---
        const dailySalesTbody = document.getElementById('daily-sales-tbody');
        const dailySalesContainer = document.getElementById('daily-sales-breakdown-container');
        if (dailySalesTbody && dailySalesContainer) {
            dailySalesTbody.innerHTML = '';

            const dailyMap = {};
            for (const sale of sales) {
                if (!dailyMap[sale.date]) {
                    dailyMap[sale.date] = {
                        bills: 0,
                        cashSales: 0,
                        creditSales: 0,
                        totalSales: 0
                    };
                }

                dailyMap[sale.date].bills += 1;
                dailyMap[sale.date].totalSales += sale.totalAmount;
                if (sale.paymentType === 'credit') {
                    dailyMap[sale.date].creditSales += sale.totalAmount;
                } else {
                    dailyMap[sale.date].cashSales += sale.totalAmount;
                }
            }

            const sortedDailyRows = Object.entries(dailyMap).sort((a, b) => b[0].localeCompare(a[0]));
            if (sortedDailyRows.length === 0) {
                dailySalesContainer.classList.add('hidden');
            } else {
                dailySalesContainer.classList.remove('hidden');

                for (const [date, data] of sortedDailyRows) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-4 py-3 font-semibold text-gray-800">${date}</td>
                        <td class="px-4 py-3 text-right text-gray-600">${data.bills.toLocaleString()}</td>
                        <td class="px-4 py-3 text-right text-green-600">${data.cashSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td class="px-4 py-3 text-right text-purple-600">${data.creditSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td class="px-4 py-3 text-right font-bold text-blue-700">${data.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    `;
                    dailySalesTbody.appendChild(tr);
                }
            }
        }

        // --- Shop-wise Breakdown Matrix ---
        const tbody = document.getElementById('shop-breakdown-tbody');
        if (tbody) {
            tbody.innerHTML = '';

            let allShopsTemp = await db.shops.toArray();
            if (shopId !== 'all') {
                const sid = parseInt(shopId);
                allShopsTemp = allShopsTemp.filter(s => s.id === sid);
            }

            let tSales = 0, tCreditSales = 0, tPurchases = 0, tExps = 0, tWastage = 0, tStockVal = 0, tProfit = 0;

            for (const s of allShopsTemp) {
                const sSales = sales.filter(x => x.shopId === s.id).reduce((sum, x) => sum + x.totalAmount, 0);
                const sCreditSales = sales.filter(x => x.shopId === s.id && x.paymentType === 'credit').reduce((sum, x) => sum + x.totalAmount, 0);
                const sPurchases = purchasesForRep.filter(x => x.shopId === s.id).reduce((sum, x) => sum + x.totalCost, 0);
                const sWastage = wastageForRep.filter(x => x.shopId === s.id).reduce((sum, x) => sum + x.estimatedLoss, 0);

                // Pure expenses (excluding purchases and wastage which are auto-logged to expenses)
                const sExps = exps.filter(x => x.shopId === s.id &&
                    !x.description.startsWith('Fish Purchase:') &&
                    !x.description.startsWith('Fish Wastage:')
                ).reduce((sum, x) => sum + x.amount, 0);

                // Estimated Stock Value
                const sStockVal = inventoryItems.filter(i => i.shopId === s.id).reduce((sum, i) => sum + (i.stockRemaining * i.wholesalePrice), 0);

                // Do NOT subtract Wastage. The cash was already lost when the fish was purchased!
                const sProfit = sSales - sPurchases - sExps;

                tSales += sSales;
                tCreditSales += sCreditSales;
                tPurchases += sPurchases;
                tExps += sExps;
                tWastage += sWastage;
                tStockVal += sStockVal;
                tProfit += sProfit;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-4 py-3 font-bold text-gray-800">${s.name}</td>
                    <td class="px-4 py-3 text-right text-green-600">${sSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td class="px-4 py-3 text-right text-purple-600">${sCreditSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td class="px-4 py-3 text-right text-orange-500">${sPurchases.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td class="px-4 py-3 text-right text-red-500">${sExps.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td class="px-4 py-3 text-right text-red-600">${sWastage.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td class="px-4 py-3 text-right text-indigo-600">${sStockVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td class="px-4 py-3 text-right border-l font-bold border-gray-200 ${sProfit >= 0 ? 'text-blue-600' : 'text-red-600'}">${sProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                `;
                tbody.appendChild(tr);
            }

            const tfoot = document.getElementById('shop-breakdown-tfoot');
            if (tfoot) {
                tfoot.innerHTML = `
                    <tr>
                        <td class="px-4 py-3 uppercase">Total</td>
                        <td class="px-4 py-3 text-right text-green-700">${tSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td class="px-4 py-3 text-right text-purple-700">${tCreditSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td class="px-4 py-3 text-right text-orange-600">${tPurchases.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td class="px-4 py-3 text-right text-red-600">${tExps.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td class="px-4 py-3 text-right text-red-700">${tWastage.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td class="px-4 py-3 text-right text-indigo-700">${tStockVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td class="px-4 py-3 text-right border-l font-black border-gray-300 ${tProfit >= 0 ? 'text-blue-700' : 'text-red-700'}">${tProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                `;
            }
        }

        // --- Top Wasted Items Analysis ---
        const wasteTbody = document.getElementById('wastage-breakdown-tbody');
        const wasteContainer = document.getElementById('wastage-breakdown-container');
        if (wasteTbody && wasteContainer) {
            wasteTbody.innerHTML = '';

            let wastageForRep = await db.wastage.where('date').between(startObj, endObj, true, true).toArray();
            if (shopId !== 'all') {
                const sid = parseInt(shopId);
                wastageForRep = wastageForRep.filter(w => w.shopId === sid);
            }

            if (wastageForRep.length === 0) {
                wasteContainer.classList.add('hidden');
            } else {
                wasteContainer.classList.remove('hidden');

                const wasteMap = {};
                for (const w of wastageForRep) {
                    if (!wasteMap[w.fishName]) {
                        wasteMap[w.fishName] = { weight: 0, loss: 0 };
                    }
                    wasteMap[w.fishName].weight += w.weight;
                    wasteMap[w.fishName].loss += w.estimatedLoss;
                }

                const sortedWastage = Object.entries(wasteMap).sort((a, b) => b[1].loss - a[1].loss);

                for (const [fName, data] of sortedWastage) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-4 py-3 font-bold text-gray-800">${fName}</td>
                        <td class="px-4 py-3 text-right text-gray-600">${data.weight.toFixed(2)} Kg</td>
                        <td class="px-4 py-3 text-right font-bold text-red-600">LKR ${data.loss.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    `;
                    wasteTbody.appendChild(tr);
                }
            }
        }

        document.getElementById('report-results').classList.remove('hidden');
    } catch (e) { console.error("Report gen error", e); }
});

// =======================
// SALES RECORDS LOGIC
// =======================
window.loadSalesHistory = async () => {
    const tbody = document.getElementById('sales-history-table-body');
    if (!tbody) return;
    try {
        const dateFilter = document.getElementById('sales-history-date').value;
        let sales = [];
        if (dateFilter) {
            sales = await db.sales.where('date').equals(dateFilter).reverse().toArray();
        } else {
            sales = await db.sales.reverse().toArray();
        }

        if (currentUser && currentUser.role === 'shop_user') {
            sales = sales.filter(s => s.shopId === currentUser.shopId);
        }
        if (!dateFilter) {
            sales = sales.slice(0, 100);
        }

        tbody.innerHTML = '';
        if (sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-gray-400">No sales recorded</td></tr>';
            return;
        }

        for (const s of sales) {
            const shop = globalShopData.find(sh => sh.id === s.shopId);
            const fish = await db.fish_items.get(s.fishId);
            const tr = document.createElement('tr');

            let adminActions = '';
            if (currentUser && currentUser.role === 'admin') {
                adminActions = `<button onclick="deleteSale(${s.id})" class="text-red-500 hover:text-red-700 ml-4" title="Delete Sale"><i class="fa-solid fa-trash"></i></button>`;
            }

            let customerNameHtml = '';
            if (s.paymentType === 'credit' && s.customerId) {
                const customer = await db.customers.get(s.customerId);
                if (customer) {
                    customerNameHtml = `<div class="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded mt-1 font-bold inline-block border border-purple-200">
                        <i class="fa-solid fa-user-tag mr-1"></i>${customer.name}
                    </div><br>`;
                }
            }

            tr.innerHTML = `
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-gray-700">${s.date}</td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap"><span class="font-bold text-ocean-900">${shop ? shop.name : 'Unknown'}</span></td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap font-semibold text-gray-700">${fish ? fish.name : 'Deleted Product'}</td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-bold rounded-full ${s.saleType === 'retail' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'} uppercase">
                        ${s.saleType}
                    </span>
                    <span class="px-2 py-1 text-xs font-bold rounded-full ${s.paymentType === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'} uppercase ml-1">
                        ${s.paymentType || 'cash'}
                    </span><br>
                    ${customerNameHtml}
                </td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-gray-800 font-mono">${s.weight.toFixed(2)} Kg</td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-right text-gray-900 font-bold">LKR ${s.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${adminActions}</td>
            `;
            tbody.appendChild(tr);
        }
    } catch (e) { console.error(e); }
};

window.deleteSale = async (id) => {
    if (!confirm("Are you sure you want to delete this sale? (Note: It will not revert the inventory stock)")) return;
    try {
        await db.sales.delete(id);
        window.loadSalesHistory();
    } catch (e) { console.error(e); }
};

// =======================
// CURRENT STOCK LOGIC
// =======================
window.loadStockDetails = async () => {
    const tbody = document.getElementById('overall-stock-table-body');
    if (!tbody) return;
    try {
        let allItems = await db.fish_items.toArray();
        if (currentUser && currentUser.role === 'shop_user') {
            allItems = allItems.filter(item => item.shopId === currentUser.shopId);
        }
        const grouped = {};

        // Group by fish name
        allItems.forEach(item => {
            if (!grouped[item.name]) {
                grouped[item.name] = { total: 0, shops: [] };
            }
            grouped[item.name].total += item.stockRemaining;
            const shop = globalShopData.find(s => s.id === item.shopId);
            if (shop && item.stockRemaining > 0) {
                grouped[item.name].shops.push(`${shop.name}: ${item.stockRemaining.toFixed(2)}Kg`);
            }
        });

        tbody.innerHTML = '';
        if (Object.keys(grouped).length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center py-10 text-gray-400">No stock available</td></tr>';
            return;
        }

        const sortedNames = Object.keys(grouped).sort();

        for (const name of sortedNames) {
            const data = grouped[name];
            // Only show if there's stock
            if (data.total <= 0) continue;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap font-bold text-ocean-900">${name}</td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-center text-xs text-gray-500">
                    ${data.shops.join(' | ') || '-'}
                </td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-right font-black ${data.total <= 0 ? 'text-red-500' : (data.total <= (parseFloat(localStorage.getItem('lowStockThreshold')) || 10) ? 'text-yellow-500' : 'text-green-600')}">
                    ${data.total.toFixed(2)} Kg
                </td>
            `;
            tbody.appendChild(tr);
        }

        if (tbody.children.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center py-10 text-gray-400">All fish stock is currently empty</td></tr>';
        }
    } catch (e) { console.error(e); }
};

window.setLowStockThreshold = () => {
    const current = localStorage.getItem('lowStockThreshold') || '10';
    window.openGenericModal('Low Stock Alert Settings', [
        { label: 'Alert Threshold (Kg)', value: current, type: 'number', required: true }
    ], async ([newThreshold]) => {
        const parsed = parseFloat(newThreshold);
        if (isNaN(parsed) || parsed < 0) {
            alert("Please enter a valid zero or positive number.");
            return;
        }
        localStorage.setItem('lowStockThreshold', parsed.toString());
        alert("Threshold updated successfully.");

        // Refresh open tabs to apply visually if needed
        updateDashboard();
        if (typeof loadInventory === 'function') loadInventory();
        if (typeof window.loadStockDetails === 'function') window.loadStockDetails();
    });
};

// =======================
// CUSTOMERS & CREDIT LOGIC
// =======================

window.toggleCustomerSelect = () => {
    const paymentType = document.querySelector('input[name="paymentType"]:checked').value;
    const container = document.getElementById('pos-customer-container');
    if (paymentType === 'credit') {
        container.classList.remove('hidden');
        populatePosCustomerDropdown();
    } else {
        container.classList.add('hidden');
    }
};

async function populatePosCustomerDropdown() {
    const select = document.getElementById('pos-customer');
    try {
        const customers = await db.customers.toArray();
        select.innerHTML = '<option value="">Select Customer...</option>' +
            customers.map(c => `<option value="${c.id}">${c.name} ${c.phone ? ' - ' + c.phone : ''}</option>`).join('');
    } catch (e) { console.error(e); }
}

const customerForm = document.getElementById('customer-form');
if (customerForm) {
    customerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('cust-name').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();
        try {
            await db.customers.add({ name, phone });
            customerForm.reset();
            alert('Customer added successfully!');
            loadCustomers();
            populatePosCustomerDropdown();
        } catch (err) { console.error(err); alert('Failed to add customer.'); }
    });
}

window.openCustomerModal = () => {
    window.openGenericModal('New Customer', [
        { label: 'Customer Name', type: 'text', required: true },
        { label: 'Phone Number (Optional)', type: 'text', required: false }
    ], async ([name, phone]) => {
        try {
            const added = await db.customers.add({ name: name.trim(), phone: phone.trim() });
            populatePosCustomerDropdown();
            alert('Customer added.');
            if (!document.getElementById('pos-customer-container').classList.contains('hidden')) {
                document.getElementById('pos-customer').value = added;
            }
        } catch (e) { console.error(e); }
    });
};

window.loadCustomers = async () => {
    const tbody = document.getElementById('customers-table-body');
    const totalEl = document.getElementById('total-outstanding-credit');
    if (!tbody) return;
    try {
        const customers = await db.customers.toArray();
        const allSales = await db.sales.where('paymentType').equals('credit').toArray();
        const allPayments = await db.customer_payments.toArray();

        tbody.innerHTML = '';
        let totalNetworkCredit = 0;

        if (customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-10 text-gray-400">No customers registered</td></tr>';
            totalEl.innerText = 'LKR 0.00';
            return;
        }

        for (const c of customers) {
            const cSales = allSales.filter(s => s.customerId === c.id);
            const cPayments = allPayments.filter(p => p.customerId === c.id);

            const totalBought = cSales.reduce((sum, s) => sum + s.totalAmount, 0);
            const totalPaid = cPayments.reduce((sum, p) => sum + p.amount, 0);
            const outstanding = totalBought - totalPaid;

            totalNetworkCredit += outstanding;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap font-bold text-gray-800">${c.name}</td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-gray-600">${c.phone || '-'}</td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-right font-black ${outstanding > 0 ? 'text-red-500' : 'text-green-600'}">
                    LKR ${outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td class="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-center">
                    <button onclick="settleCustomerCredit(${c.id}, ${outstanding}, '${c.name.replace(/'/g, "\\'")}')" 
                        class="text-ocean-500 hover:text-ocean-700 bg-ocean-50 hover:bg-ocean-100 px-3 py-1.5 rounded shadow-sm text-xs font-bold transition"
                        ${outstanding <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                        <i class="fa-solid fa-hand-holding-dollar mr-1"></i> Pay
                    </button>
                    ${currentUser && currentUser.role === 'admin' ?
                    `<button onclick="editCustomer(${c.id}, '${c.name.replace(/'/g, "\\'")}', '${c.phone || ''}')" class="text-blue-500 hover:text-blue-700 ml-2 transition" title="Edit Customer"><i class="fa-solid fa-pen"></i></button>
                     <button onclick="deleteCustomer(${c.id})" class="text-red-400 hover:text-red-600 ml-2 transition" title="Delete Customer"><i class="fa-solid fa-trash"></i></button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        }

        totalEl.innerText = `LKR ${totalNetworkCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    } catch (e) { console.error(e); }
};

window.settleCustomerCredit = (id, maxAmount, name) => {
    window.openGenericModal(`Settle Credit: ${name} (Max LKR ${maxAmount.toLocaleString()})`, [
        { label: 'Payment Amount (LKR)', type: 'number', value: maxAmount, required: true }
    ], async ([amountStr]) => {
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            alert('Invalid amount.');
            return;
        }
        if (amount > maxAmount) {
            alert('Cannot pay more than outstanding balance.');
            return;
        }

        try {
            await db.customer_payments.add({
                date: new Date().toISOString().split('T')[0],
                customerId: id,
                amount: amount
            });
            alert('Payment recorded successfully.');
            loadCustomers();
        } catch (e) {
            console.error(e);
            alert('Failed to record payment.');
        }
    });
};

window.deleteCustomer = async (id) => {
    if (!confirm('Are you sure you want to delete this customer? This will NOT delete their sales records, but will remove their account.')) return;
    try {
        await db.customers.delete(id);
        loadCustomers();
    } catch (e) { console.error(e); }
};

window.editCustomer = (id, currentName, currentPhone) => {
    window.openGenericModal('Edit Customer', [
        { label: 'Customer Name', type: 'text', value: currentName, required: true },
        { label: 'Phone Number (Optional)', type: 'text', value: currentPhone, required: false }
    ], async ([newName, newPhone]) => {
        try {
            await db.customers.update(id, { name: newName.trim(), phone: newPhone.trim() });
            loadCustomers();
            populatePosCustomerDropdown();
            alert('Customer updated successfully.');
        } catch (e) {
            console.error(e);
            alert('Failed to update customer.');
        }
    });
};

// =======================
// BACKUP & RESTORE LOGIC
// =======================
window.openBackupModal = () => {
    document.getElementById('backup-modal').classList.remove('hidden');
};

window.closeBackupModal = () => {
    document.getElementById('backup-modal').classList.add('hidden');
    document.getElementById('restore-file').value = '';
};

window.backupData = async () => {
    try {
        const tables = db.tables;
        const backupObj = {};
        for (let table of tables) {
            backupObj[table.name] = await table.toArray();
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "fishmart_backup_" + new Date().toISOString().split('T')[0] + ".json");
        document.body.appendChild(downloadAnchorNode); // required for edge cases
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        alert("Backup downloaded successfully.");
    } catch (e) {
        console.error("Backup failed", e);
        alert("Failed to create backup.");
    }
};

window.restoreData = async () => {
    const fileInput = document.getElementById('restore-file');
    if (!fileInput.files.length) {
        alert("Please select a JSON backup file to restore.");
        return;
    }

    if (!confirm("WARNING: This will replace ALL existing data with the data from the backup file. Are you absolutely sure?")) {
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const backupObj = JSON.parse(event.target.result);
            if (typeof backupObj !== 'object' || backupObj === null) {
                throw new Error("Invalid backup format");
            }

            await db.transaction('rw', db.tables, async () => {
                for (let tableName in backupObj) {
                    if (db.tables.some(t => t.name === tableName)) {
                        await db.table(tableName).clear();
                        if (backupObj[tableName] && backupObj[tableName].length > 0) {
                            await db.table(tableName).bulkAdd(backupObj[tableName]);
                        }
                    }
                }
            });

            alert("Data restored successfully. Application will now reload.");
            window.location.reload();
        } catch (e) {
            console.error("Restore failed", e);
            alert("Failed to restore data. Make sure the file is a valid FishMart backup JSON.");
        }
    };
    reader.onerror = () => {
        alert("Failed to read the selected file.");
    };
    reader.readAsText(file);
};
// =======================
// RECEIPT EXACT JS PDF
// =======================
function generatePrintReceipt(receiptCart, paymentType, customerId, grandTotal, shopName) {
    if (!confirm('Would you like to print a thermal receipt?')) return;

    try {
        const { jsPDF } = window.jspdf;

        // Dynamic length
        const baseLength = 100;
        const extraLength = receiptCart.length * 10;

        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [80, baseLength + extraLength]
        });

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('FISH MART', 40, 10, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(shopName, 40, 16, { align: 'center' });
        doc.text('Date: ' + new Date().toLocaleString(), 40, 22, { align: 'center' });

        doc.text('------------------------------------------------', 40, 28, { align: 'center' });

        let y = 35;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Item', 5, y);
        doc.text('Qty', 40, y);
        doc.text('Total', 75, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');

        y += 6;
        doc.text('------------------------------------------------', 40, y, { align: 'center' });
        y += 6;

        receiptCart.forEach(item => {
            const title = item.fishName + (item.saleType === 'wholesale' ? ' (W)' : ' (R)');
            // Cut long names
            const displayTitle = title.length > 15 ? title.substring(0, 15) + '..' : title;
            doc.text(displayTitle, 5, y);
            doc.text(item.weight + 'Kg', 40, y);
            doc.text(item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }), 75, y, { align: 'right' });
            y += 8;
        });

        doc.text('------------------------------------------------', 40, y, { align: 'center' });
        y += 6;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('GRAND TOTAL:', 5, y);
        doc.text(grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }), 75, y, { align: 'right' });

        y += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Payment: ' + paymentType.toUpperCase(), 5, y);

        y += 12;
        doc.text('Thank you for your business!', 40, y, { align: 'center' });

        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
    } catch (err) {
        console.error("PDF Print error: ", err);
        alert("Could not generate PDF receipt.");
    }
}

// =======================
// DAILY SHIFT CLOSING
// =======================
window.openDailyCloseModal = async function () {
    const today = new Date().toISOString().split('T')[0];

    const shopIdFilterStr = globalShopFilter.value;

    // Gather all cash sales today
    let sales = await db.sales.where('date').equals(today).toArray();
    let exps = await db.expenses.where('date').equals(today).toArray();

    if (shopIdFilterStr !== 'all') {
        const sid = parseInt(shopIdFilterStr);
        sales = sales.filter(s => s.shopId === sid);
        exps = exps.filter(e => e.shopId === sid);
    }

    const cashSales = sales.filter(s => s.paymentType === 'cash').reduce((sum, s) => sum + s.totalAmount, 0);
    const cashExpenses = exps.reduce((sum, e) => sum + e.amount, 0);

    window.openGenericModal('End of Day Closing Report', [
        { label: 'Expected Cash Revenue Added (Cash Sales)', value: cashSales.toFixed(2), type: 'number', required: true },
        { label: 'Less: Expenses Processed Today', value: cashExpenses.toFixed(2), type: 'number', required: true },
        { label: 'Actual Final Physical Cash Counted In Drawer', value: '', type: 'number', required: true }
    ], async ([calcSalesStr, calcExpStr, actualStr]) => {
        const calcSales = parseFloat(calcSalesStr);
        const calcExp = parseFloat(calcExpStr);
        const actual = parseFloat(actualStr);

        const calcExpected = calcSales - calcExp;
        const diff = actual - calcExpected;

        if (diff === 0) {
            alert(`✅ Cash is exactly balanced!\n\nExpected: LKR ${calcExpected.toFixed(2)}\nActual: LKR ${actual.toFixed(2)}`);
        } else if (diff > 0) {
            alert(`⚠️ Drawer is OVER by LKR ${diff.toFixed(2)}!\n\nExpected: LKR ${calcExpected.toFixed(2)}\nActual: LKR ${actual.toFixed(2)}`);
        } else {
            alert(`❌ Drawer is SHORT by LKR ${Math.abs(diff).toFixed(2)}!\n\nExpected: LKR ${calcExpected.toFixed(2)}\nActual: LKR ${actual.toFixed(2)}`);
        }
    });
};

// Dados armazenados localmente
let refuels = JSON.parse(localStorage.getItem('refuels')) || [];
let settings = JSON.parse(localStorage.getItem('settings')) || {};
let chartsInitialized = false;
let consumptionChart, expensesChart, priceVariationChart, consumptionVariationChart;

// Elementos DOM
const elements = {
    hamburger: document.querySelector('.hamburger'),
    navMenu: document.querySelector('nav ul'),
    navLinks: document.querySelectorAll('.nav-link'),
    themeToggle: document.getElementById('theme-toggle'),
    refuelForm: document.getElementById('refuel-form'),
    editForm: document.getElementById('edit-refuel-form'),
    modal: document.getElementById('edit-modal'),
    closeModal: document.querySelectorAll('.close, .close-modal'),
    tableBody: document.getElementById('refuels-table-body'),
    noRefuels: document.getElementById('no-refuels'),
    alerts: document.getElementById('alerts'),
    applyFilters: document.getElementById('apply-filters'),
    clearFilters: document.getElementById('clear-filters'),
    applyStatsFilters: document.getElementById('apply-stats-filters'),
    clearStatsFilters: document.getElementById('clear-stats-filters'),
    userSettingsForm: document.getElementById('user-settings-form'),
    backupBtn: document.getElementById('backup-btn'),
    restoreBtn: document.getElementById('restore-btn'),
    restoreFile: document.getElementById('restore-file'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    exportPdfBtn: document.getElementById('export-pdf-btn'),
    clearDataBtn: document.getElementById('clear-data-btn')
};

// UI Helpers
const ui = {
    showAlert(message, type) {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} fade-in`;
        alert.textContent = message;
        elements.alerts.appendChild(alert);
        setTimeout(() => alert.remove(), 3000);
    },
    updateCard(id, value) {
        document.getElementById(id).textContent = value;
    }
};

// Data Helpers
const data = {
    saveRefuels() {
        localStorage.setItem('refuels', JSON.stringify(refuels));
    },
    calculateConsumption(refuels) {
        const sorted = [...refuels].sort((a, b) => new Date(a.date) - new Date(b.date));
        const totalKm = sorted[sorted.length - 1]?.km - sorted[0]?.km || 0;
        const totalLiters = sorted.reduce((sum, r) => sum + r.liters, 0);
        return totalKm / totalLiters || 0;
    },
    groupByMonth(refuels) {
        return refuels.reduce((acc, r) => {
            const month = new Date(r.date).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
            acc[month] = acc[month] || { totalKm: 0, totalLiters: 0, totalSpent: 0 };
            acc[month].totalKm += r.km;
            acc[month].totalLiters += r.liters;
            acc[month].totalSpent += r.total;
            return acc;
        }, {});
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeCharts();
    updateHistory();
    loadSettings();
    checkMaintenance();
    updateDashboard();

    if (!elements.refuelForm) {
        console.error('Elemento refuel-form não encontrado no DOM');
    }
});

// Menu hamburger
elements.hamburger.addEventListener('click', () => {
    elements.navMenu.classList.toggle('active');
});

// Navegação por abas
elements.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = link.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.getElementById(`${tabId}-tab`).classList.add('active');
        document.getElementById('current-breadcrumb').textContent = link.textContent;
        elements.navMenu.classList.remove('active');
        if (tabId === 'dashboard' || tabId === 'stats') updateCharts();
    });
});

// Alternar tema
function initializeTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        elements.themeToggle.checked = true;
    }
}

elements.themeToggle.addEventListener('change', () => {
    document.documentElement.toggleAttribute('data-theme');
    localStorage.setItem('theme', elements.themeToggle.checked ? 'dark' : 'light');
});

// Formulário de registro
elements.refuelForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const date = document.getElementById('date').value;
    const kmInput = document.getElementById('km').value;
    const priceInput = document.getElementById('price').value;
    const totalInput = document.getElementById('total').value;
    const fuelType = document.getElementById('fuel-type').value;
    const notes = document.getElementById('notes').value;

    const km = parseFloat(kmInput);
    const price = parseFloat(priceInput.replace(',', '.'));
    const total = parseFloat(totalInput.replace(',', '.'));
    const liters = total / price; // Cálculo automático dos litros

    if (!date) {
        ui.showAlert('Por favor, preencha a data.', 'danger');
        return;
    }
    if (isNaN(km) || km < 0) {
        ui.showAlert('Quilometragem inválida! Use um número positivo.', 'danger');
        return;
    }
    if (isNaN(price) || price <= 0) {
        ui.showAlert('Valor por litro inválido! Use um número positivo (ex: 5,399).', 'danger');
        return;
    }
    if (isNaN(total) || total <= 0) {
        ui.showAlert('Valor total inválido! Use um número positivo (ex: 215,96).', 'danger');
        return;
    }

    const refuel = {
        id: Date.now(),
        date,
        km,
        price,
        liters,
        total,
        fuelType,
        notes
    };

    refuels.push(refuel);
    data.saveRefuels();
    updateDashboard();
    updateHistory();
    ui.showAlert('Abastecimento registrado com sucesso!', 'success');
    elements.refuelForm.reset();
});

// Modal de edição
let editingId = null;
elements.editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const km = parseFloat(document.getElementById('edit-km').value);
    const price = parseFloat(document.getElementById('edit-price').value.replace(',', '.'));
    const total = parseFloat(document.getElementById('edit-total').value.replace(',', '.'));
    const liters = total / price; // Cálculo automático dos litros

    if (km < 0 || price <= 0 || total <= 0) {
        ui.showAlert('Valores inválidos! Certifique-se de que todos os campos numéricos sejam positivos.', 'danger');
        return;
    }

    const updatedRefuel = {
        id: editingId,
        date: document.getElementById('edit-date').value,
        km: km,
        price: price,
        liters: liters,
        total: total,
        fuelType: document.getElementById('edit-fuel-type').value,
        notes: document.getElementById('edit-notes').value
    };
    refuels = refuels.map(r => r.id === editingId ? updatedRefuel : r);
    data.saveRefuels();
    updateDashboard();
    updateHistory();
    elements.modal.style.display = 'none';
    ui.showAlert('Abastecimento atualizado com sucesso!', 'success');
});

elements.closeModal.forEach(btn => {
    btn.addEventListener('click', () => {
        elements.modal.style.display = 'none';
    });
});

// Histórico e filtros
elements.applyFilters.addEventListener('click', updateHistory);
elements.clearFilters.addEventListener('click', () => {
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    document.getElementById('filter-fuel').value = '';
    updateHistory();
});

function updateHistory() {
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    const fuelType = document.getElementById('filter-fuel').value;
    const sortBy = document.getElementById('filter-sort').value;

    let filteredRefuels = [...refuels];
    if (dateFrom) filteredRefuels = filteredRefuels.filter(r => r.date >= dateFrom);
    if (dateTo) filteredRefuels = filteredRefuels.filter(r => r.date <= dateTo);
    if (fuelType) filteredRefuels = filteredRefuels.filter(r => r.fuelType === fuelType);

    filteredRefuels.sort((a, b) => {
        switch (sortBy) {
            case 'date-desc': return new Date(b.date) - new Date(a.date);
            case 'date-asc': return new Date(a.date) - new Date(b.date);
            case 'km-desc': return b.km - a.km;
            case 'km-asc': return a.km - b.km;
            case 'price-desc': return b.price - a.price;
            case 'price-asc': return a.price - b.price;
            default: return 0;
        }
    });

    elements.tableBody.innerHTML = '';
    if (filteredRefuels.length === 0) {
        elements.noRefuels.style.display = 'block';
        return;
    }
    elements.noRefuels.style.display = 'none';

    filteredRefuels.forEach((r, i) => {
        const prevKm = i > 0 ? filteredRefuels[i - 1].km : 0;
        const consumption = prevKm ? (r.km - prevKm) / r.liters : 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(r.date).toLocaleDateString('pt-BR')}</td>
            <td>${r.km.toFixed(1)}</td>
            <td>${r.fuelType}</td>
            <td>${r.liters.toFixed(2)}</td>
            <td>R$ ${r.price.toFixed(3).replace('.', ',')}</td>
            <td>R$ ${r.total.toFixed(2).replace('.', ',')}</td>
            <td>${consumption ? consumption.toFixed(2) + ' km/l' : '--'}</td>
            <td class="action-buttons">
                <button onclick="editRefuel(${r.id})"><i class="fas fa-edit"></i></button>
                <button class="delete" onclick="deleteRefuel(${r.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        elements.tableBody.appendChild(tr);
    });
}

function editRefuel(id) {
    const refuel = refuels.find(r => r.id === id);
    editingId = id;
    document.getElementById('edit-date').value = refuel.date;
    document.getElementById('edit-km').value = refuel.km;
    document.getElementById('edit-price').value = refuel.price.toFixed(3).replace('.', ',');
    document.getElementById('edit-total').value = refuel.total.toFixed(2).replace('.', ',');
    document.getElementById('edit-fuel-type').value = refuel.fuelType;
    document.getElementById('edit-notes').value = refuel.notes;
    elements.modal.style.display = 'block';
}

function deleteRefuel(id) {
    if (confirm('Tem certeza que deseja excluir este abastecimento?')) {
        refuels = refuels.filter(r => r.id !== id);
        data.saveRefuels();
        updateDashboard();
        updateHistory();
        ui.showAlert('Abastecimento excluído com sucesso!', 'success');
    }
}

// Dashboard e gráficos
function initializeCharts() {
    try {
        consumptionChart = new Chart(document.getElementById('consumptionChart'), {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Consumo (km/l)', data: [], borderColor: '#3498db', fill: false }] }
        });
        expensesChart = new Chart(document.getElementById('expensesChart'), {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Gastos (R$)', data: [], backgroundColor: '#2ecc71' }] }
        });
        priceVariationChart = new Chart(document.getElementById('priceVariationChart'), {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Preço por Litro (R$)', data: [], borderColor: '#e74c3c', fill: false }] }
        });
        consumptionVariationChart = new Chart(document.getElementById('consumptionVariationChart'), {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Consumo (km/l)', data: [], borderColor: '#f39c12', fill: false }] }
        });
        chartsInitialized = true;
    } catch (error) {
        console.error('Erro ao inicializar os gráficos:', error);
    }
}

function updateCharts(filteredRefuels = refuels) {
    if (!chartsInitialized) {
        console.warn('Gráficos não inicializados. Inicializando agora...');
        initializeCharts();
    }

    const sortedRefuels = [...filteredRefuels].sort((a, b) => new Date(a.date) - new Date(b.date));
    const monthlyData = data.groupByMonth(sortedRefuels);

    consumptionChart.data.labels = Object.keys(monthlyData);
    consumptionChart.data.datasets[0].data = Object.values(monthlyData).map(m => m.totalKm / m.totalLiters || 0);
    consumptionChart.update();

    expensesChart.data.labels = Object.keys(monthlyData);
    expensesChart.data.datasets[0].data = Object.values(monthlyData).map(m => m.totalSpent);
    expensesChart.update();

    priceVariationChart.data.labels = sortedRefuels.map(r => new Date(r.date).toLocaleDateString('pt-BR'));
    priceVariationChart.data.datasets[0].data = sortedRefuels.map(r => r.price);
    priceVariationChart.update();

    consumptionVariationChart.data.labels = sortedRefuels.slice(1).map(r => new Date(r.date).toLocaleDateString('pt-BR'));
    consumptionVariationChart.data.datasets[0].data = sortedRefuels.slice(1).map((r, i) => 
        (r.km - sortedRefuels[i].km) / r.liters || 0);
    consumptionVariationChart.update();
}

function updateDashboard() {
    if (refuels.length === 0) return;

    const sortedRefuels = [...refuels].sort((a, b) => new Date(a.date) - new Date(b.date));
    const totalKm = sortedRefuels[sortedRefuels.length - 1].km - sortedRefuels[0].km;
    const totalLiters = sortedRefuels.reduce((sum, r) => sum + r.liters, 0);
    const totalSpent = sortedRefuels.reduce((sum, r) => sum + r.total, 0);
    const avgConsumption = data.calculateConsumption(refuels);
    const lastRefuel = sortedRefuels[sortedRefuels.length - 1];

    ui.updateCard('avg-consumption', `${avgConsumption.toFixed(2)} km/l`);
    ui.updateCard('total-spent', `R$ ${totalSpent.toFixed(2).replace('.', ',')}`);
    ui.updateCard('total-km', `${totalKm.toFixed(1)} km`);
    ui.updateCard('last-refuel', lastRefuel.fuelType);
    ui.updateCard('last-refuel-date', new Date(lastRefuel.date).toLocaleDateString('pt-BR'));

    updateCharts();
}

// Estatísticas
elements.applyStatsFilters.addEventListener('click', () => {
    const dateFrom = document.getElementById('stats-date-from').value;
    const dateTo = document.getElementById('stats-date-to').value;
    const fuelType = document.getElementById('stats-filter-fuel').value;

    let filteredRefuels = [...refuels];
    if (dateFrom) filteredRefuels = filteredRefuels.filter(r => r.date >= dateFrom);
    if (dateTo) filteredRefuels = filteredRefuels.filter(r => r.date <= dateTo);
    if (fuelType) filteredRefuels = filteredRefuels.filter(r => r.fuelType === fuelType);

    const sortedRefuels = [...filteredRefuels].sort((a, b) => new Date(a.date) - new Date(b.date));
    const totalKm = sortedRefuels.length > 1 ? sortedRefuels[sortedRefuels.length - 1].km - sortedRefuels[0].km : 0;
    const totalLiters = sortedRefuels.reduce((sum, r) => sum + r.liters, 0);
    const totalSpent = sortedRefuels.reduce((sum, r) => sum + r.total, 0);
    const avgConsumption = data.calculateConsumption(filteredRefuels);
    const costPerKm = totalKm ? totalSpent / totalKm : 0;

    ui.updateCard('stats-avg-consumption', `${avgConsumption.toFixed(2)} km/l`);
    ui.updateCard('stats-total-spent', `R$ ${totalSpent.toFixed(2).replace('.', ',')}`);
    ui.updateCard('stats-total-km', `${totalKm.toFixed(1)} km`);
    ui.updateCard('stats-cost-per-km', `R$ ${costPerKm.toFixed(2).replace('.', ',')}`);

    updateCharts(filteredRefuels);
});

elements.clearStatsFilters.addEventListener('click', () => {
    document.getElementById('stats-date-from').value = '';
    document.getElementById('stats-date-to').value = '';
    document.getElementById('stats-filter-fuel').value = '';
    updateDashboard();
});

// Configurações
elements.userSettingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    settings = {
        name: document.getElementById('user-name').value,
        vehicleName: document.getElementById('vehicle-name').value,
        vehicleModel: document.getElementById('vehicle-model').value,
        fuelPreference: document.getElementById('fuel-preference').value
    };
    localStorage.setItem('settings', JSON.stringify(settings));
    ui.showAlert('Configurações salvas com sucesso!', 'success');
});

function loadSettings() {
    if (settings.name) document.getElementById('user-name').value = settings.name;
    if (settings.vehicleName) document.getElementById('vehicle-name').value = settings.vehicleName;
    if (settings.vehicleModel) document.getElementById('vehicle-model').value = settings.vehicleModel;
    if (settings.fuelPreference) document.getElementById('fuel-preference').value = settings.fuelPreference;
}

// Backup e restauração
elements.backupBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify({ refuels, settings });
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fuel_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

elements.restoreBtn.addEventListener('click', () => {
    elements.restoreFile.click();
});

elements.restoreFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        const data = JSON.parse(event.target.result);
        refuels = data.refuels || [];
        settings = data.settings || {};
        data.saveRefuels();
        localStorage.setItem('settings', JSON.stringify(settings));
        updateDashboard();
        updateHistory();
        loadSettings();
        ui.showAlert('Dados restaurados com sucesso!', 'success');
    };
    reader.readAsText(file);
});

// Exportação
elements.exportCsvBtn.addEventListener('click', () => {
    const headers = 'Data,Km,Combustível,Litros,Valor/L,Total,Consumo\n';
    const rows = refuels.map(r => {
        const consumption = refuels.findIndex(x => x.id === r.id) > 0 ?
            (r.km - refuels[refuels.findIndex(x => x.id === r.id) - 1].km) / r.liters : 0;
        return `${new Date(r.date).toLocaleDateString('pt-BR')},${r.km},${r.fuelType},${r.liters},${r.price.toFixed(3).replace('.', ',')},${r.total.toFixed(2).replace('.', ',')},${consumption ? consumption.toFixed(2) : ''}`;
    }).join('\n');
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fuel_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});

elements.exportPdfBtn.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Histórico de Abastecimentos', 10, 10);
    doc.autoTable({
        head: [['Data', 'Km', 'Combustível', 'Litros', 'Valor/L', 'Total', 'Consumo']],
        body: refuels.map(r => {
            const consumption = refuels.findIndex(x => x.id === r.id) > 0 ?
                (r.km - refuels[refuels.findIndex(x => x.id === r.id) - 1].km) / r.liters : 0;
            return [
                new Date(r.date).toLocaleDateString('pt-BR'),
                r.km.toFixed(1),
                r.fuelType,
                r.liters.toFixed(2),
                `R$ ${r.price.toFixed(3).replace('.', ',')}`,
                `R$ ${r.total.toFixed(2).replace('.', ',')}`,
                consumption ? `${consumption.toFixed(2)} km/l` : '--'
            ];
        })
    });
    doc.save(`fuel_history_${new Date().toISOString().split('T')[0]}.pdf`);
});

elements.clearDataBtn.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.')) {
        refuels = [];
        settings = {};
        localStorage.clear();
        updateDashboard();
        updateHistory();
        loadSettings();
        ui.showAlert('Todos os dados foram limpos!', 'warning');
    }
});

// Notificações de manutenção
function checkMaintenance() {
    const lastKm = refuels.length ? refuels[refuels.length - 1].km : 0;
    if (lastKm > 0 && lastKm % 10000 < 100) {
        ui.showAlert('Atenção: Próxima manutenção recomendada em breve!', 'warning');
    }
}

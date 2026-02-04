import './style.css';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface Expense {
    Date: string;
    Category: string;
    Description: string;
    Amount: string;
}

interface Data {
    lastUpdated: string;
    expenses: Expense[];
}

let allExpenses: Expense[] = [];

async function init() {
    try {
        const response = await fetch('/data.json');
        if (!response.ok) throw new Error('Failed to fetch data');
        const data: Data = await response.json();

        allExpenses = data.expenses;
        updateLastUpdated(data.lastUpdated);
        renderDashboard(allExpenses);
        setupSearch();
    } catch (error) {
        console.error('Initialization error:', error);
        document.getElementById('app')!.innerHTML = `
      <div class="error-state">
        <h2>Failed to load data</h2>
        <p>Please ensure data.json is present in the public folder.</p>
      </div>
    `;
    }
}

function updateLastUpdated(time: string) {
    const el = document.getElementById('update-time');
    if (el) {
        const date = new Date(time);
        el.textContent = date.toLocaleString();
    }
}

function renderDashboard(expenses: Expense[]) {
    const processed = processData(expenses);

    renderStats(processed);
    renderCharts(processed);
    renderTable(expenses);
}

function processData(expenses: Expense[]) {
    const sorted = [...expenses].sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());

    const totalSpent = expenses.reduce((sum, item) => sum + parseFloat(item.Amount), 0);

    // Category breakdown
    const categoryMap: Record<string, number> = {};
    expenses.forEach(item => {
        categoryMap[item.Category] = (categoryMap[item.Category] || 0) + parseFloat(item.Amount);
    });

    // Monthly breakdown (last 6 months)
    const monthlyMap: Record<string, number> = {};
    expenses.forEach(item => {
        const date = new Date(item.Date);
        const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });
        monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + parseFloat(item.Amount);
    });

    // Sorted monthly keys for chart
    const months = Object.keys(monthlyMap).sort((a, b) => {
        const da = new Date(a);
        const db = new Date(b);
        return da.getTime() - db.getTime();
    });

    return {
        totalSpent,
        lastExpense: sorted[0],
        categoryData: categoryMap,
        monthlyData: monthlyMap,
        sortedMonths: months,
        count: expenses.length
    };
}

function renderStats(data: ReturnType<typeof processData>) {
    const statsGrid = document.getElementById('stats-grid');
    if (!statsGrid) return;

    const stats = [
        { label: 'Total Spent', value: `$${data.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
        { label: 'Total Entries', value: data.count.toString() },
        { label: 'Last Expense', value: data.lastExpense ? `$${parseFloat(data.lastExpense.Amount).toFixed(2)}` : '-' },
        { label: 'Last Service', value: data.lastExpense?.Date || '-' }
    ];

    statsGrid.innerHTML = stats.map(stat => `
    <div class="stat-card glass">
      <span class="stat-label">${stat.label}</span>
      <span class="stat-value">${stat.value}</span>
    </div>
  `).join('');
}

let monthlyChart: Chart | null = null;
let categoryChart: Chart | null = null;

function renderCharts(data: ReturnType<typeof processData>) {
    const ctxMonthly = document.getElementById('monthly-chart') as HTMLCanvasElement;
    const ctxCategory = document.getElementById('category-chart') as HTMLCanvasElement;

    if (monthlyChart) monthlyChart.destroy();
    if (categoryChart) categoryChart.destroy();

    monthlyChart = new Chart(ctxMonthly, {
        type: 'line',
        data: {
            labels: data.sortedMonths,
            datasets: [{
                label: 'Monthly Spending',
                data: data.sortedMonths.map(m => data.monthlyData[m]),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#6366f1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });

    const categories = Object.keys(data.categoryData);
    categoryChart = new Chart(ctxCategory, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: categories.map(c => data.categoryData[c]),
                backgroundColor: ['#6366f1', '#a855f7', '#22d3ee', '#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#f8fafc', padding: 20, font: { family: 'Outfit' } }
                }
            },
            cutout: '70%'
        }
    });
}

function renderTable(expenses: Expense[]) {
    const tbody = document.getElementById('expense-body');
    if (!tbody) return;

    const sorted = [...expenses].sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());

    tbody.innerHTML = sorted.map(exp => `
    <tr>
      <td>${exp.Date}</td>
      <td><span class="badge ${exp.Category.toLowerCase()}">${exp.Category}</span></td>
      <td>${exp.Description}</td>
      <td class="amount-cell">$${parseFloat(exp.Amount).toFixed(2)}</td>
    </tr>
  `).join('');
}

function setupSearch() {
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        const filtered = allExpenses.filter(exp =>
            exp.Description.toLowerCase().includes(query) ||
            exp.Category.toLowerCase().includes(query)
        );
        renderTable(filtered);
    });
}

init();

import './style.css';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface Expense {
    Date: string;
    Category: string;
    Description: string;
    Amount: string;
}

let allExpenses: Expense[] = [];


async function init() {
    try {
        const response = await fetch('./data.json');
        if (!response.ok) throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        const rawData: any = await response.json();

        // Normalize data to expected format
        allExpenses = normalizeData(rawData.expenses || []);

        updateLastUpdated(rawData.lastUpdated);
        renderDashboard(allExpenses);
        setupSearch();
    } catch (error) {

        console.error('Initialization error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        document.getElementById('app')!.innerHTML = `
      <div class="error-state">
        <div class="glass" style="padding: 2rem; text-align: center; max-width: 500px; margin: 4rem auto;">
          <h2 style="color: var(--danger); margin-bottom: 1rem;">Failed to load data</h2>
          <p style="color: var(--text-muted); margin-bottom: 1rem;">${errorMessage}</p>
          <p style="font-size: 0.875rem;">Please check if <code>data.json</code> exists and your GitHub Action ran successfully.</p>
        </div>
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
    const sorted = [...expenses].sort((a, b) => {
        const dateA = a.Date ? new Date(a.Date).getTime() : 0;
        const dateB = b.Date ? new Date(b.Date).getTime() : 0;
        return dateB - dateA;
    });

    const totalSpent = expenses.reduce((sum, item) => sum + (item.Amount ? parseFloat(item.Amount) : 0), 0);

    // Category breakdown
    const categoryMap: Record<string, number> = {};
    expenses.forEach(item => {
        const cat = item.Category || 'Other';
        const amt = item.Amount ? parseFloat(item.Amount) : 0;
        categoryMap[cat] = (categoryMap[cat] || 0) + amt;
    });

    // Monthly breakdown (last 6 months)
    const monthlyMap: Record<string, number> = {};
    expenses.forEach(item => {
        if (!item.Date) return;
        const date = new Date(item.Date);
        if (isNaN(date.getTime())) return;
        const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });
        const amt = item.Amount ? parseFloat(item.Amount) : 0;
        monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + amt;
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

    const sorted = [...expenses].sort((a, b) => {
        const dateA = a.Date ? new Date(a.Date).getTime() : 0;
        const dateB = b.Date ? new Date(b.Date).getTime() : 0;
        return dateB - dateA;
    });

    tbody.innerHTML = sorted.map(exp => {
        const category = exp.Category || 'Other';
        const description = exp.Description || '';
        const date = exp.Date || '-';
        const amount = exp.Amount ? parseFloat(exp.Amount) : 0;

        return `
    <tr>
      <td>${date}</td>
      <td><span class="badge ${(category).toLowerCase()}">${category}</span></td>
      <td>${description}</td>
      <td class="amount-cell">$${amount.toFixed(2)}</td>
    </tr>
  `;
    }).join('');
}

function setupSearch() {
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        const filtered = allExpenses.filter(exp => {
            const desc = (exp.Description || '').toLowerCase();
            const cat = (exp.Category || '').toLowerCase();
            return desc.includes(query) || cat.includes(query);
        });
        renderTable(filtered);
    });
}

function normalizeData(rawExpenses: any[]): Expense[] {
    const currentYear = new Date().getFullYear();

    return rawExpenses
        .filter(raw => Object.keys(raw).length > 0) // Skip truly empty objects
        .map(raw => {
            // Flexible header mapping
            const dateStr = raw.Date || raw.date || raw.Timestamp || raw.timestamp || '';
            const category = raw.Category || raw.category || raw.Type || raw.type || 'Other';
            const description = raw.Description || raw.description || raw.Note || raw.note || category;

            // Clean amount: remove commas and handle non-numeric strings
            let amountStr = raw.Amount || raw.Price || raw.price || '0';
            if (typeof amountStr === 'string') {
                amountStr = amountStr.replace(/,/g, '');
            }

            // Intelligent date parsing
            let normalizedDate = dateStr;
            if (dateStr && !dateStr.includes(currentYear.toString()) && !dateStr.includes((currentYear - 1).toString())) {
                // If date is "27 Nov" or "4 March", append year (guessing current or previous)
                // For now, let's keep it simple or try to parse
                const parsedDate = new Date(dateStr);
                if (!isNaN(parsedDate.getTime())) {
                    // Check if the year is 2001 (default for many parsers), if so, fix to current
                    if (parsedDate.getFullYear() < 2010) {
                        parsedDate.setFullYear(currentYear);
                    }
                    normalizedDate = parsedDate.toISOString().split('T')[0];
                }
            }

            return {
                Date: normalizedDate,
                Category: String(category),
                Description: String(description),
                Amount: amountStr || '0'
            };
        });
}

init();

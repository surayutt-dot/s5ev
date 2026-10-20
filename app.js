/**
 * MG S5 EV Charging Tracker & Consumption Calculator (Light / White Theme)
 */

const STORAGE_KEY = 'mg_s5_charging_records';
const BENCHMARK_GAS_CAR_PER_KM = 3.50; // Reference ICE car cost in THB/km

let records = [];
let chartInstance = null;
let currentChartView = 'monthly';

// DOM Elements
const chargeForm = document.getElementById('chargeForm');
const formTitle = document.getElementById('formTitle');
const btnSubmitText = document.getElementById('btnSubmitText');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const editEntryId = document.getElementById('editEntryId');

const inputAmount = document.getElementById('inputAmount');
const inputStation = document.getElementById('inputStation');
const inputDateTime = document.getElementById('inputDateTime');
const inputOdometer = document.getElementById('inputOdometer');

const statTotalCost = document.getElementById('statTotalCost');
const statAvgSessionCost = document.getElementById('statAvgSessionCost');
const statMonthCost = document.getElementById('statMonthCost');
const statMonthSessions = document.getElementById('statMonthSessions');
const statCurrentMonthLabel = document.getElementById('statCurrentMonthLabel');
const statAvgPerKm = document.getElementById('statAvgPerKm');
const statTotalKm = document.getElementById('statTotalKm');
const statSavingsRate = document.getElementById('statSavingsRate');
const statSavingsSubtext = document.getElementById('statSavingsSubtext');
const statTotalSessions = document.getElementById('statTotalSessions');

const historyListContainer = document.getElementById('historyListContainer');
const historyBadgeCount = document.getElementById('historyBadgeCount');
const emptyState = document.getElementById('emptyState');
const inputSearch = document.getElementById('inputSearch');
const selectMonthFilter = document.getElementById('selectMonthFilter');

const settingsModal = document.getElementById('settingsModal');
const btnOpenSettings = document.getElementById('btnOpenSettings');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnExportCSV = document.getElementById('btnExportCSV');
const modalBtnExportCSV = document.getElementById('modalBtnExportCSV');
const modalBtnExportJSON = document.getElementById('modalBtnExportJSON');
const modalBtnImportJSON = document.getElementById('modalBtnImportJSON');
const fileImportJSON = document.getElementById('fileImportJSON');
const btnAddSampleData = document.getElementById('btnAddSampleData');
const btnClearAll = document.getElementById('btnClearAll');
const btnSetNow = document.getElementById('btnSetNow');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadRecords();
  initDefaultDateTime();
  setupEventListeners();
  setupPwaInstallation();
  render();
  lucide.createIcons();
});

// PWA Service Worker & Install Prompt
let deferredPrompt = null;
function setupPwaInstallation() {
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => console.log('PWA Service Worker registered:', reg.scope))
      .catch((err) => console.log('Service Worker registration error:', err));
  }

  const pwaBanner = document.getElementById('pwaInstallBanner');
  const btnInstall = document.getElementById('btnPwaInstall');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaBanner) {
      pwaBanner.classList.remove('hidden');
      lucide.createIcons();
    }
  });

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          if (pwaBanner) pwaBanner.classList.add('hidden');
        }
        deferredPrompt = null;
      }
    });
  }

  window.addEventListener('appinstalled', () => {
    if (pwaBanner) pwaBanner.classList.add('hidden');
    showToast('ติดตั้งแอพ MG S5 สำเร็จเรียบร้อย!', 'success');
  });
}

// Set current time into datetime-local input
function initDefaultDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  inputDateTime.value = `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Storage helpers
function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    records = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse records', e);
    records = [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// Event Listeners
function setupEventListeners() {
  chargeForm.addEventListener('submit', handleFormSubmit);
  btnCancelEdit.addEventListener('click', resetForm);
  btnSetNow.addEventListener('click', initDefaultDateTime);

  // Quick Amount Buttons
  document.querySelectorAll('.btn-quick-amount').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseFloat(btn.dataset.val) || 0;
      const current = parseFloat(inputAmount.value) || 0;
      inputAmount.value = current + val;
      inputAmount.focus();
    });
  });

  // Quick Station Buttons
  document.querySelectorAll('.btn-quick-station').forEach(btn => {
    btn.addEventListener('click', () => {
      inputStation.value = btn.dataset.station;
      inputAmount.focus();
    });
  });

  // Search & Filter
  inputSearch.addEventListener('input', renderHistoryList);
  selectMonthFilter.addEventListener('change', renderHistoryList);

  // Chart Switch
  document.querySelectorAll('.tab-chart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-chart-btn').forEach(b => {
        b.classList.remove('bg-white', 'text-cyan-700', 'shadow-xs', 'font-semibold');
        b.classList.add('text-slate-600');
      });
      btn.classList.add('bg-white', 'text-cyan-700', 'shadow-xs', 'font-semibold');
      btn.classList.remove('text-slate-600');
      currentChartView = btn.dataset.view;
      renderChart();
    });
  });

  // Modal
  btnOpenSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  btnCloseModal.addEventListener('click', () => settingsModal.classList.add('hidden'));
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.add('hidden');
  });

  // Exports
  btnExportCSV.addEventListener('click', exportCSV);
  modalBtnExportCSV.addEventListener('click', exportCSV);
  modalBtnExportJSON.addEventListener('click', exportJSON);

  // Import
  modalBtnImportJSON.addEventListener('click', () => fileImportJSON.click());
  fileImportJSON.addEventListener('change', handleImportJSON);

  // Sample data & Clear
  btnAddSampleData.addEventListener('click', loadSampleData);
  btnClearAll.addEventListener('click', handleClearAll);
}

// Handle Add / Edit
function handleFormSubmit(e) {
  e.preventDefault();

  const amount = parseFloat(inputAmount.value);
  const station = inputStation.value.trim();
  const dateTime = inputDateTime.value;
  const odometer = inputOdometer.value !== '' ? parseFloat(inputOdometer.value) : null;

  if (isNaN(amount) || amount <= 0) {
    showToast('กรุณาระบุจำนวนเงินที่ถูกต้อง', 'error');
    inputAmount.focus();
    return;
  }
  if (!station) {
    showToast('กรุณาระบุชื่อสถานีชาร์จ', 'error');
    inputStation.focus();
    return;
  }

  const editId = editEntryId.value;

  if (editId) {
    const idx = records.findIndex(r => r.id === editId);
    if (idx !== -1) {
      records[idx] = {
        ...records[idx],
        amount,
        station,
        dateTime,
        odometer,
        updatedAt: new Date().toISOString()
      };
      showToast('แก้ไขข้อมูลเรียบร้อยแล้ว', 'success');
    }
  } else {
    const newRecord = {
      id: 'mg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      amount,
      station,
      dateTime,
      odometer,
      createdAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    showToast('บันทึกค่าชาร์จเรียบร้อยแล้ว ⚡', 'success');
  }

  records.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

  saveRecords();
  resetForm();
  render();
}

function resetForm() {
  editEntryId.value = '';
  formTitle.textContent = 'บันทึกการชาร์จใหม่';
  btnSubmitText.textContent = 'บันทึกค่าชาร์จ';
  btnCancelEdit.classList.add('hidden');
  inputAmount.value = '';
  inputStation.value = '';
  inputOdometer.value = '';
  initDefaultDateTime();
}

function startEditRecord(id) {
  const item = records.find(r => r.id === id);
  if (!item) return;

  editEntryId.value = item.id;
  inputAmount.value = item.amount;
  inputStation.value = item.station;
  inputDateTime.value = item.dateTime;
  inputOdometer.value = item.odometer ?? '';

  formTitle.textContent = 'แก้ไขรายการชาร์จ';
  btnSubmitText.textContent = 'บันทึกการแก้ไข';
  btnCancelEdit.classList.remove('hidden');

  window.scrollTo({ top: 150, behavior: 'smooth' });
  inputAmount.focus();
}

function deleteRecord(id) {
  const target = records.find(r => r.id === id);
  if (!target) return;

  const dateStr = formatDateTimeThai(target.dateTime);
  if (confirm(`คุณต้องการลบรายการชาร์จ\n"${target.station}" (${target.amount.toLocaleString()} บาท) วันที่ ${dateStr} หรือไม่?`)) {
    records = records.filter(r => r.id !== id);
    saveRecords();
    if (editEntryId.value === id) resetForm();
    render();
    showToast('ลบรายการเรียบร้อยแล้ว', 'success');
  }
}

/**
 * Compute consumption rate for every record that has an odometer
 */
function computeConsumptionMetrics() {
  const chrono = [...records].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

  const metricsMap = new Map();
  let prevRecordWithOdo = null;

  for (const rec of chrono) {
    if (rec.odometer !== null && !isNaN(rec.odometer)) {
      if (prevRecordWithOdo !== null) {
        const deltaKm = rec.odometer - prevRecordWithOdo.odometer;
        if (deltaKm > 0) {
          const costPerKm = rec.amount / deltaKm;
          metricsMap.set(rec.id, {
            deltaKm,
            costPerKm,
            prevOdometer: prevRecordWithOdo.odometer
          });
        }
      }
      prevRecordWithOdo = rec;
    }
  }

  const odoRecords = chrono.filter(r => r.odometer !== null && !isNaN(r.odometer));
  let overall = {
    totalKm: 0,
    totalSpanCost: 0,
    avgPerKm: null,
    savingsPerKm: null
  };

  if (odoRecords.length >= 2) {
    const minOdo = odoRecords[0].odometer;
    const maxOdo = odoRecords[odoRecords.length - 1].odometer;
    const totalKm = maxOdo - minOdo;

    if (totalKm > 0) {
      let sumCost = 0;
      for (let i = 1; i < odoRecords.length; i++) {
        sumCost += Number(odoRecords[i].amount) || 0;
      }
      overall.totalKm = totalKm;
      overall.totalSpanCost = sumCost;
      overall.avgPerKm = sumCost / totalKm;
      overall.savingsPerKm = Math.max(0, BENCHMARK_GAS_CAR_PER_KM - overall.avgPerKm);
    }
  }

  return { metricsMap, overall };
}

// Render Master
function render() {
  const { metricsMap, overall } = computeConsumptionMetrics();
  renderStats(overall);
  renderMonthFilterOptions();
  renderHistoryList(metricsMap);
  renderChart();
  lucide.createIcons();
}

// Render Stats
function renderStats(overall) {
  const totalCost = records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  statTotalCost.textContent = totalCost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const avgSession = records.length > 0 ? (totalCost / records.length) : 0;
  statAvgSessionCost.textContent = avgSession.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const monthNamesThai = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  statCurrentMonthLabel.textContent = `${monthNamesThai[curMonth]} ${curYear + 543}`;

  const monthRecords = records.filter(r => {
    const d = new Date(r.dateTime);
    return d.getFullYear() === curYear && d.getMonth() === curMonth;
  });

  const monthCost = monthRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  statMonthCost.textContent = monthCost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  statMonthSessions.textContent = monthRecords.length.toLocaleString();

  statTotalSessions.textContent = records.length.toLocaleString();

  if (overall.avgPerKm !== null) {
    statAvgPerKm.textContent = overall.avgPerKm.toFixed(2);
    statTotalKm.textContent = overall.totalKm.toLocaleString();

    statSavingsRate.textContent = `~${overall.savingsPerKm.toFixed(2)} ฿/กม.`;
    const totalSavedEst = (overall.savingsPerKm * overall.totalKm);
    statSavingsSubtext.innerHTML = `ประหยัดรวมประมาณ <span class="text-emerald-700 font-bold">${totalSavedEst.toLocaleString(undefined, { maximumFractionDigits: 0 })} บาท</span>`;
  } else {
    statAvgPerKm.textContent = '-';
    statTotalKm.textContent = '-';
    statSavingsRate.textContent = '-';
    statSavingsSubtext.innerHTML = `ใส่เลขไมล์อย่างน้อย 2 ครั้งเพื่อคำนวณ`;
  }
}

// Month filter dropdown
function renderMonthFilterOptions() {
  const currentSelected = selectMonthFilter.value;
  const monthMap = new Map();

  records.forEach(r => {
    const d = new Date(r.dateTime);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const thaiYear = d.getFullYear() + 543;
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const label = `${monthNames[d.getMonth()]} ${thaiYear}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, label);
    }
  });

  let html = '<option value="all">ทุกเดือน</option>';
  Array.from(monthMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .forEach(([key, label]) => {
      html += `<option value="${key}">${label}</option>`;
    });

  selectMonthFilter.innerHTML = html;
  if (Array.from(selectMonthFilter.options).some(o => o.value === currentSelected)) {
    selectMonthFilter.value = currentSelected;
  }
}

// Render History List (White Theme Card)
function renderHistoryList(metricsMap = null) {
  if (!metricsMap) {
    metricsMap = computeConsumptionMetrics().metricsMap;
  }

  const searchQuery = inputSearch.value.trim().toLowerCase();
  const monthFilter = selectMonthFilter.value;

  const filtered = records.filter(item => {
    const matchSearch = !searchQuery ||
      item.station.toLowerCase().includes(searchQuery) ||
      String(item.amount).includes(searchQuery);

    let matchMonth = true;
    if (monthFilter !== 'all') {
      const d = new Date(item.dateTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      matchMonth = key === monthFilter;
    }

    return matchSearch && matchMonth;
  });

  historyBadgeCount.textContent = `${filtered.length} รายการ`;

  if (filtered.length === 0) {
    historyListContainer.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  historyListContainer.innerHTML = filtered.map(item => {
    const formattedDate = formatDateTimeThai(item.dateTime);
    const metric = metricsMap.get(item.id);

    return `
      <div class="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 hover:border-cyan-400 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center shrink-0 mt-0.5">
            <i data-lucide="zap" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-slate-900 text-base">${escapeHtml(item.station)}</span>
              ${item.odometer !== null && item.odometer !== undefined ? `
                <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono font-medium flex items-center gap-1">
                  <i data-lucide="gauge" class="w-3 h-3 text-amber-600"></i> ${Number(item.odometer).toLocaleString()} km
                </span>
              ` : ''}
            </div>

            <p class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i> ${formattedDate}
            </p>

            ${metric ? `
              <div class="mt-2 flex items-center gap-2 flex-wrap">
                <span class="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-1.5">
                  <i data-lucide="trending-down" class="w-3.5 h-3.5 text-emerald-600"></i>
                  ${metric.costPerKm.toFixed(2)} บาท/กม.
                  <span class="text-emerald-600 font-normal">(วิ่งไป ${metric.deltaKm.toLocaleString()} กม.)</span>
                </span>
              </div>
            ` : (item.odometer ? `
              <div class="mt-1.5 text-[11px] text-slate-500">
                📍 จุดบันทึกเลขไมล์เริ่มต้น (จะคำนวณอัตราสิ้นเปลืองในรอบถัดไป)
              </div>
            ` : '')}
          </div>
        </div>

        <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div class="text-left sm:text-right">
            <div class="text-xl font-bold text-cyan-700">
              ${Number(item.amount).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              <span class="text-xs text-slate-500 font-normal">฿</span>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="startEditRecord('${item.id}')" title="แก้ไข"
              class="p-2 text-slate-400 hover:text-cyan-700 hover:bg-slate-100 rounded-lg transition-colors">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteRecord('${item.id}')" title="ลบ"
              class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

// Render Charts (Light Theme)
function renderChart() {
  const canvas = document.getElementById('expenseChart');
  if (!canvas) return;

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (records.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  if (currentChartView === 'monthly') {
    const monthlyMap = new Map();
    const sorted = [...records].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

    sorted.forEach(r => {
      const d = new Date(r.dateTime);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const thaiYear = (d.getFullYear() + 543) % 100;
      const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const label = `${monthNames[d.getMonth()]} '${thaiYear}`;

      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { label, total: 0 });
      }
      monthlyMap.get(key).total += Number(r.amount) || 0;
    });

    const entries = Array.from(monthlyMap.values()).slice(-6);
    const labels = entries.map(e => e.label);
    const data = entries.map(e => e.total);

    chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'ค่าชาร์จ (บาท)',
          data,
          backgroundColor: 'rgba(8, 145, 178, 0.85)',
          hoverBackgroundColor: 'rgba(13, 148, 136, 0.95)',
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 45
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#38bdf8',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (context) => `ค่าใช้จ่าย: ${context.parsed.y.toLocaleString()} บาท`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { family: 'Prompt' } }
          },
          y: {
            grid: { color: 'rgba(226, 232, 240, 0.8)' },
            ticks: {
              color: '#64748b',
              font: { family: 'Prompt' },
              callback: (v) => `${v.toLocaleString()} ฿`
            }
          }
        }
      }
    });

  } else {
    // Top Stations
    const stationMap = new Map();
    records.forEach(r => {
      const st = r.station || 'อื่นๆ';
      stationMap.set(st, (stationMap.get(st) || 0) + (Number(r.amount) || 0));
    });

    const sortedStations = Array.from(stationMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const labels = sortedStations.map(s => s[0]);
    const data = sortedStations.map(s => s[1]);
    const colors = [
      '#0891b2', // Cyan 600
      '#059669', // Emerald 600
      '#d97706', // Amber 600
      '#7c3aed', // Violet 600
      '#db2777'  // Pink 600
    ];

    chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#334155', padding: 15, boxWidth: 12, font: { family: 'Prompt' } }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (context) => ` ${context.label}: ${context.parsed.toLocaleString()} บาท`
            }
          }
        },
        cutout: '65%'
      }
    });
  }
}

// Export CSV
function exportCSV() {
  if (records.length === 0) {
    showToast('ไม่มีข้อมูลสำหรับส่งออก', 'error');
    return;
  }

  const { metricsMap } = computeConsumptionMetrics();
  const headers = ['วันที่และเวลา', 'สถานีชาร์จ', 'จำนวนเงิน (บาท)', 'เลขไมล์ (km)', 'ระยะทางช่วงนี้ (km)', 'อัตราสิ้นเปลือง (บาท/กม.)'];

  const rows = records.map(r => {
    const metric = metricsMap.get(r.id);
    return [
      formatDateTimeThai(r.dateTime),
      `"${(r.station || '').replace(/"/g, '""')}"`,
      r.amount,
      r.odometer ?? '',
      metric ? metric.deltaKm : '',
      metric ? metric.costPerKm.toFixed(2) : ''
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `MG_S5_EV_Charging_${new Date().toISOString().slice(0, 10)}.csv`);
  showToast('ส่งออกไฟล์ CSV สำเร็จ', 'success');
}

// Export JSON Backup
function exportJSON() {
  if (records.length === 0) {
    showToast('ไม่มีข้อมูลสำหรับสำรอง', 'error');
    return;
  }
  const data = JSON.stringify({
    carModel: 'MG S5 EV',
    exportedAt: new Date().toISOString(),
    records
  }, null, 2);

  const blob = new Blob([data], { type: 'application/json' });
  downloadBlob(blob, `MG_S5_EV_Backup_${new Date().toISOString().slice(0, 10)}.json`);
  showToast('สำรองข้อมูล JSON สำเร็จ', 'success');
}

// Import JSON
function handleImportJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      const importedRecords = Array.isArray(parsed) ? parsed : (parsed.records || []);
      if (!Array.isArray(importedRecords)) throw new Error('Invalid format');

      if (confirm(`พบข้อมูล ${importedRecords.length} รายการ คุณต้องการนำเข้าข้อมูลนี้หรือไม่?`)) {
        const existingIds = new Set(records.map(r => r.id));
        let addedCount = 0;
        importedRecords.forEach(item => {
          if (!existingIds.has(item.id)) {
            records.push(item);
            addedCount++;
          }
        });

        records.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
        saveRecords();
        render();
        settingsModal.classList.add('hidden');
        showToast(`นำเข้าสำเร็จ เพิ่มข้อมูลใหม่ ${addedCount} รายการ`, 'success');
      }
    } catch (err) {
      alert('ไฟล์ JSON ไม่ถูกต้องหรือไม่ตรงรูปแบบ');
    }
    fileImportJSON.value = '';
  };
  reader.readAsText(file);
}

// Realistic Sample Data for MG S5 EV
function loadSampleData() {
  if (records.length > 0) {
    if (!confirm('ต้องการโหลดข้อมูลตัวอย่างเพิ่มเข้าสู่ระบบหรือไม่?')) return;
  }

  const now = new Date();
  const sample = [
    {
      id: 'sample_1',
      station: 'PEA Volta',
      amount: 310.0,
      dateTime: new Date(now.getTime() - 1 * 86400000).toISOString().slice(0, 16),
      odometer: 11450
    },
    {
      id: 'sample_2',
      station: 'PTT EV Station PluZ',
      amount: 380.0,
      dateTime: new Date(now.getTime() - 4 * 86400000).toISOString().slice(0, 16),
      odometer: 11050
    },
    {
      id: 'sample_3',
      station: 'EA Anywhere',
      amount: 290.0,
      dateTime: new Date(now.getTime() - 8 * 86400000).toISOString().slice(0, 16),
      odometer: 10680
    },
    {
      id: 'sample_4',
      station: 'EleXA (EGAT)',
      amount: 350.0,
      dateTime: new Date(now.getTime() - 13 * 86400000).toISOString().slice(0, 16),
      odometer: 10320
    },
    {
      id: 'sample_5',
      station: 'PEA Volta',
      amount: 280.0,
      dateTime: new Date(now.getTime() - 18 * 86400000).toISOString().slice(0, 16),
      odometer: 10000
    }
  ];

  records = [...sample, ...records];
  records.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
  saveRecords();
  render();
  settingsModal.classList.add('hidden');
  showToast('โหลดข้อมูลตัวอย่างและคำนวณอัตราสิ้นเปลืองเรียบร้อย!', 'success');
}

function handleClearAll() {
  if (records.length === 0) return;
  if (confirm('⚠️ ต้องการลบประวัติการชาร์จทั้งหมดใช่หรือไม่?')) {
    records = [];
    saveRecords();
    resetForm();
    render();
    settingsModal.classList.add('hidden');
    showToast('ล้างข้อมูลทั้งหมดแล้ว', 'info');
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDateTimeThai(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const day = d.getDate();
  const month = thaiMonths[d.getMonth()];
  const thaiYear = d.getFullYear() + 543;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${thaiYear} ${hours}:${minutes} น.`;
}

let toastTimer = null;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.getElementById('toastIcon');

  toastMsg.textContent = message;

  if (type === 'error') {
    toastIcon.setAttribute('data-lucide', 'alert-circle');
    toastIcon.className = 'w-5 h-5 text-rose-400';
    toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 border border-rose-500/50 text-white shadow-xl transition-all duration-300';
  } else {
    toastIcon.setAttribute('data-lucide', 'check-circle');
    toastIcon.className = 'w-5 h-5 text-emerald-400';
    toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 border border-emerald-500/50 text-white shadow-xl transition-all duration-300';
  }
  lucide.createIcons();

  toast.classList.remove('translate-y-24', 'opacity-0');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('translate-y-24', 'opacity-0');
  }, 2800);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

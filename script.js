if (localStorage.getItem("ams_session") !== "true") {
    window.location.href = "login.html";
}
let students = [];
let currentFilter = "all";
let sortAZ        = false;
let donutChart  = null;
let weeklyChart = null;
window.onload = function () {

    const today = new Date().toISOString().split("T")[0];
    document.getElementById("date").value        = today;
    document.getElementById("historyDate").value = today;

    loadData();

    renderStudents();
    renderHistory();
};

function saveData() {
    localStorage.setItem("ams_students", JSON.stringify(students));
}

function loadData() {
    const raw = localStorage.getItem("ams_students");
    students = raw ? JSON.parse(raw) : [];
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function addStudent() {
    const nameInput = document.getElementById("studentName");
    const name = nameInput.value.trim();

    if (!name) { showToast("⚠️ Please enter a student name"); return; }

    const duplicate = students.some(s => s.name.toLowerCase() === name.toLowerCase());
    if (duplicate) { showToast("⚠️ Student already exists"); return; }

    students.push({
        id:         generateId(),
        name:       name,
        attendance: {}
    });

    saveData();
    nameInput.value = "";
    renderStudents();
    showToast(`✅ ${name} added`);
}

function editStudent(id) {
    const student = students.find(s => s.id === id);
    if (!student) return;

    const newName = prompt("Edit student name:", student.name);
    if (newName && newName.trim()) {
        student.name = newName.trim();
        saveData();
        renderStudents();
        showToast("✏️ Name updated");
    }
}

function deleteStudent(id) {
    if (!confirm("Delete this student and all their records?")) return;
    students = students.filter(s => s.id !== id);
    saveData();
    renderStudents();
    showToast("🗑 Student deleted");
}

function clearAll() {
    if (!confirm("Delete ALL students and attendance data? This cannot be undone.")) return;
    students = [];
    saveData();
    renderStudents();
    showToast("🗑 All data cleared");
}

function markAttendance(id, status) {
    const date    = document.getElementById("date").value;
    if (!date) { showToast("⚠️ Please select a date"); return; }

    const student = students.find(s => s.id === id);
    if (!student) return;

    student.attendance[date] = status;   // e.g. "Present" or "Absent"
    saveData();
    renderStudents();
    renderHistory();
}

function markPresent(id) { markAttendance(id, "Present"); }
function markAbsent(id)  { markAttendance(id, "Absent");  }

function markAllPresent() {
    const date = document.getElementById("date").value;
    if (!date) { showToast("⚠️ Select a date first"); return; }
    students.forEach(s => s.attendance[date] = "Present");
    saveData();
    renderStudents();
    renderHistory();
    showToast("✅ All marked Present");
}

function markAllAbsent() {
    const date = document.getElementById("date").value;
    if (!date) { showToast("⚠️ Select a date first"); return; }
    students.forEach(s => s.attendance[date] = "Absent");
    saveData();
    renderStudents();
    renderHistory();
    showToast("❌ All marked Absent");
}

function resetAttendance() {
    const date = document.getElementById("date").value;
    if (!date) { showToast("⚠️ Select a date first"); return; }
    if (!confirm(`Reset attendance for ${date}?`)) return;

    students.forEach(s => delete s.attendance[date]);
    saveData();
    renderStudents();
    renderHistory();
    showToast("🔄 Attendance reset for " + date);
}

function renderStudents() {
    const today       = document.getElementById("date").value;
    const searchTerm  = document.getElementById("search").value.toLowerCase();
    const tbody       = document.getElementById("studentList");

    let filtered = students.filter(s => {

        if (!s.name.toLowerCase().includes(searchTerm)) return false;
        if (currentFilter === "present") return s.attendance[today] === "Present";
        if (currentFilter === "absent")  return s.attendance[today] === "Absent";
        return true;
    });

    if (sortAZ) {
        filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }

    tbody.innerHTML = "";   // clear table body

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:var(--text-muted);padding:24px">
            No students found.</td></tr>`;
    } else {
        filtered.forEach((student, idx) => {
            const status  = student.attendance[today] || "Not Marked";
            const stats   = getStats(student);
            const pct     = calcPercentage(student);
            const pctNum  = parseFloat(pct);
            const isLow   = pctNum > 0 && pctNum < 75;

            let badgeClass = "badge-unmarked";
            if (status === "Present") badgeClass = "badge-present";
            if (status === "Absent")  badgeClass = "badge-absent";

            const row = document.createElement("tr");
            if (isLow) row.classList.add("low-attendance");

            row.innerHTML = `
                <td>${idx + 1}</td>
                <td style="font-weight:500">${escapeHtml(student.name)}
                    ${isLow ? '<span title="Low attendance" style="color:#fbbf24;margin-left:4px">⚠️</span>' : ''}
                </td>
                <td><span class="badge ${badgeClass}">${status}</span></td>
                <td style="font-weight:600;color:${pctNum<75&&pctNum>0?'#fbbf24':pctNum>=75?'#34d399':'var(--text)'}">${pct}</td>
                <td>${stats.present}</td>
                <td>${stats.absent}</td>
                <td>
                    <button onclick="markPresent('${student.id}')" style="background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 3px 10px rgba(16,185,129,.3)">✅</button>
                    <button onclick="markAbsent('${student.id}')"  style="background:linear-gradient(135deg,#f59e0b,#d97706);box-shadow:0 3px 10px rgba(245,158,11,.3)">❌</button>
                    <button onclick="editStudent('${student.id}')" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)">✏️</button>
                    <button onclick="deleteStudent('${student.id}')" style="background:linear-gradient(135deg,#f43f5e,#e11d48)">🗑</button>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    updateStats(today);
    renderCharts();
}

function updateStats(today) {
    const total   = students.length;
    const present = students.filter(s => s.attendance[today] === "Present").length;
    const absent  = students.filter(s => s.attendance[today] === "Absent").length;
    const low     = students.filter(s => {
        const p = parseFloat(calcPercentage(s));
        return p > 0 && p < 75;
    }).length;

    document.getElementById("statTotal").textContent   = total;
    document.getElementById("statPresent").textContent = present;
    document.getElementById("statAbsent").textContent  = absent;
    document.getElementById("statLow").textContent     = low;
}

function renderHistory() {
    const date    = document.getElementById("historyDate").value;
    const tbody   = document.getElementById("historyList");
    tbody.innerHTML = "";

    if (!date || students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="color:var(--text-muted);padding:18px">
            Select a date to view history.</td></tr>`;
        return;
    }

    students.forEach(student => {
        const status = student.attendance[date] || "Not Recorded";
        let badgeClass = "badge-unmarked";
        if (status === "Present") badgeClass = "badge-present";
        if (status === "Absent")  badgeClass = "badge-absent";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td style="font-weight:500">${escapeHtml(student.name)}</td>
            <td><span class="badge ${badgeClass}">${status}</span></td>
        `;
        tbody.appendChild(row);
    });
}
function renderCharts() {
    renderDonutChart();
    renderWeeklyChart();
}

function renderDonutChart() {
    let totalPresent = 0, totalAbsent = 0;

    students.forEach(student => {
        Object.values(student.attendance).forEach(status => {
            if (status === "Present") totalPresent++;
            else if (status === "Absent") totalAbsent++;
        });
    });

    const canvas = document.getElementById("attendanceChart");
    const ctx    = canvas.getContext("2d");

    if (donutChart) donutChart.destroy();

    donutChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Present", "Absent"],
            datasets: [{
                data: [totalPresent, totalAbsent],
                backgroundColor: ["#10b981", "#f43f5e"],
                borderColor: ["#059669", "#e11d48"],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: "rgba(255,255,255,0.75)", font: { family: "Poppins" } } }
            }
        }
    });
}

function renderWeeklyChart() {
    // Build array of last 7 dates
    const dates  = getLast7Dates();
    const labels = dates.map(d => formatDateShort(d));

    // Count present per day across all students
    const presentCounts = dates.map(date =>
        students.filter(s => s.attendance[date] === "Present").length
    );
    const absentCounts = dates.map(date =>
        students.filter(s => s.attendance[date] === "Absent").length
    );

    const canvas = document.getElementById("weeklyChart");
    const ctx    = canvas.getContext("2d");

    if (weeklyChart) weeklyChart.destroy();

    weeklyChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Present",
                    data: presentCounts,
                    backgroundColor: "rgba(16,185,129,0.70)",
                    borderRadius: 6
                },
                {
                    label: "Absent",
                    data: absentCounts,
                    backgroundColor: "rgba(244,63,94,0.70)",
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: { ticks: { color: "rgba(255,255,255,0.60)" }, grid: { color: "rgba(255,255,255,0.05)" } },
                y: {
                    ticks: { color: "rgba(255,255,255,0.60)", stepSize: 1 },
                    grid:  { color: "rgba(255,255,255,0.05)" },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: { labels: { color: "rgba(255,255,255,0.75)", font: { family: "Poppins" } } }
            }
        }
    });
}

function downloadCSV() {
    if (students.length === 0) { showToast("⚠️ No data to export"); return; }

    let csv = "Name,Date,Status\n";

    students.forEach(student => {
        // If no attendance records, still include student with empty row
        if (Object.keys(student.attendance).length === 0) {
            csv += `${student.name},,\n`;
        } else {
            Object.entries(student.attendance).forEach(([date, status]) => {
                csv += `${student.name},${date},${status}\n`;
            });
        }
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href     = URL.createObjectURL(blob);
    link.download = `attendance_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    showToast("⬇ CSV downloaded");
}

function printAttendance() {
    window.print();
}

function setFilter(filter) {
    currentFilter = filter;

    // Update active class on filter buttons
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.filter === filter);
    });

    renderStudents();
}

function toggleSort() {
    sortAZ = !sortAZ;
    const btn = document.getElementById("sortBtn");
    btn.textContent = sortAZ ? "Sort: A–Z ✓" : "Sort A–Z";
    renderStudents();
}

let toastTimer = null;
function showToast(msg) {
    const toast = document.getElementById("toast") || createToast();
    toast.textContent = msg;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function createToast() {
    const t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
    return t;
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}

function calcPercentage(student) {
    const total   = Object.keys(student.attendance).length;
    const present = Object.values(student.attendance).filter(v => v === "Present").length;
    return total === 0 ? "0%" : ((present / total) * 100).toFixed(1) + "%";
}

function getStats(student) {
    let present = 0, absent = 0;
    Object.values(student.attendance).forEach(s => {
        if (s === "Present") present++;
        else if (s === "Absent") absent++;
    });
    return { present, absent };
}

function getLast7Dates() {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
}

function formatDateShort(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function logout() {
    if (!confirm("Logout?")) return;
    localStorage.removeItem("ams_session");
    window.location.href = "login.html";
}

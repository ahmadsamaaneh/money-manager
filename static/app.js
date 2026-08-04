const money = (n) =>
  Number(n || 0).toLocaleString("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const toastEl = document.getElementById("toast");
const notifPanel = document.getElementById("notifPanel");
const overlay = document.getElementById("overlay");
const notifBadge = document.getElementById("notifBadge");
const notifList = document.getElementById("notifList");
const balanceForm = document.getElementById("balanceForm");
const loanMode = document.getElementById("loanMode");
const periodField = document.getElementById("periodField");
const loanPeriod = document.getElementById("loanPeriod");

function showToast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  toastEl.classList.toggle("error", isError);
  requestAnimationFrame(() => toastEl.classList.add("show"));
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toastEl.classList.remove("show");
    setTimeout(() => {
      toastEl.hidden = true;
    }, 250);
  }, 2800);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "حدث خطأ");
  return json.data;
}

function typeClass(type) {
  if (type === "إيداع") return "deposit";
  if (type === "تسديد") return "repay";
  if (type === "تعديل") return "adjust";
  if (type === "طوارئ") return "emergency";
  if (type === "سلفة") return "loan";
  if (type === "التزام") return "obligation";
  return "expense";
}

function renderSummary(data) {
  document.getElementById("totalBalance").textContent = money(data.total_balance);
  document.getElementById("spentToday").textContent = money(data.spent_today);
  document.getElementById("remainingToday").textContent = money(data.remaining_today);
  document.getElementById("spendBudget").textContent = money(data.spend_budget);
  document.getElementById("totalLent").textContent = money(data.total_lent || 0);
  document.getElementById("dailyLimitInput").value = data.daily_limit;
  document.getElementById("spendBudgetInput").value = data.spend_budget;
  document.getElementById("totalBalanceInput").value = data.total_balance;

  const body = document.getElementById("txBody");
  if (!data.transactions.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty">لا توجد حركات بعد</td></tr>`;
    return;
  }

  body.innerHTML = data.transactions
    .map(
      (tx) => `
        <tr>
          <td>${tx.date}</td>
          <td><span class="type-tag ${typeClass(tx.type)}">${tx.type}</span></td>
          <td>${tx.name}</td>
          <td>${money(tx.amount)}</td>
          <td>${money(tx.balance_after)}</td>
        </tr>
      `
    )
    .join("");
}

function daysLabel(days) {
  if (days === 0) return "اليوم";
  if (days === 1) return "غداً";
  if (days < 0) return `متأخر ${Math.abs(days)}`;
  return `باقي ${days} يوم`;
}

function formatDueDate(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function renderObligations(items) {
  const list = document.getElementById("obligationsList");
  if (!items.length) {
    list.innerHTML = `<li class="empty" style="display:block;border:0;background:transparent;padding:0.4rem 0">لا توجد التزامات</li>`;
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
      <li class="${item.urgent ? "urgent" : ""}">
        <div>
          <strong>${item.name}</strong>
          <small>${money(item.amount)} · كل شهر يوم ${item.due_day} · القادم ${formatDueDate(item.due_date)}${
            item.notes ? ` · ${item.notes}` : ""
          }</small>
        </div>
        <span class="days ${item.urgent ? "urgent" : ""}">${daysLabel(item.days_left)}</span>
        <div class="loan-actions">
          <button type="button" class="ghost-btn pay-btn" data-pay="${item.id}">تم الدفع</button>
          <button type="button" class="ghost-btn danger" data-del="${item.id}">حذف</button>
        </div>
      </li>
    `
    )
    .join("");
}

function modeLabel(item) {
  if (item.mode === "على فترات") {
    return item.period ? `على فترات (${item.period})` : "على فترات";
  }
  return "مرة واحدة";
}

function renderLoans(items) {
  const list = document.getElementById("loansList");
  if (!items.length) {
    list.innerHTML = `<li class="empty" style="display:block;border:0;background:transparent;padding:0.4rem 0">لا توجد سلف حالياً</li>`;
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
      <li>
        <div>
          <strong>${item.name}</strong>
          <small>
            أصلي ${money(item.amount)} · باقي ${money(item.remaining)} · ${modeLabel(item)}
            ${item.notes ? ` · ${item.notes}` : ""}
          </small>
        </div>
        <div class="loan-actions">
          <input type="number" min="0.01" step="0.01" max="${item.remaining}" placeholder="مبلغ التسديد" data-repay-input="${item.id}" />
          <button type="button" class="ghost-btn" data-repay="${item.id}">تسديد</button>
          <button type="button" class="ghost-btn danger" data-loan-del="${item.id}">إغلاق</button>
        </div>
      </li>
    `
    )
    .join("");
}

function renderNotifications(items) {
  if (!items.length) {
    notifBadge.hidden = true;
    notifList.innerHTML = `<li class="empty" style="border:0;background:transparent">لا توجد إشعارات قريبة</li>`;
    return;
  }

  notifBadge.hidden = false;
  notifBadge.textContent = String(items.length);
  notifList.innerHTML = items
    .map(
      (n) => `
      <li class="${n.urgent ? "urgent" : ""}">
        <strong>${n.title}</strong>
        <p>${n.message}</p>
      </li>
    `
    )
    .join("");
}

function openNotif() {
  notifPanel.hidden = false;
  overlay.hidden = false;
  requestAnimationFrame(() => notifPanel.classList.add("open"));
}

function closeNotif() {
  notifPanel.classList.remove("open");
  setTimeout(() => {
    notifPanel.hidden = true;
    overlay.hidden = true;
  }, 250);
}

function syncPeriodField() {
  const periodic = loanMode.value === "على فترات";
  periodField.hidden = !periodic;
  loanPeriod.required = periodic;
  if (!periodic) loanPeriod.value = "";
}

async function refresh() {
  const [summary, obligations, notifications, loans] = await Promise.all([
    api("/api/summary"),
    api("/api/obligations"),
    api("/api/notifications?days=7"),
    api("/api/loans"),
  ]);
  renderSummary(summary);
  renderObligations(obligations);
  renderNotifications(notifications);
  renderLoans(loans);
}

function bindForm(id, url, buildBody, successMsg) {
  document.getElementById(id).addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const data = await api(url, {
        method: "POST",
        body: JSON.stringify(buildBody(fd)),
      });
      if (id === "obligationForm") {
        renderObligations(data);
        const notifications = await api("/api/notifications?days=7");
        renderNotifications(notifications);
      } else if (id === "loanForm") {
        renderSummary(data.summary);
        renderLoans(data.loans);
      } else {
        renderSummary(data);
      }
      if (id === "balanceForm") {
        balanceForm.hidden = true;
      } else {
        form.reset();
        if (id === "loanForm") syncPeriodField();
      }
      if (
        id === "limitForm" ||
        id === "budgetForm" ||
        id === "balanceForm" ||
        id === "emergencyForm" ||
        id === "loanForm"
      ) {
        await refresh();
      }
      showToast(successMsg);
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

document.getElementById("openBalanceEdit").addEventListener("click", () => {
  balanceForm.hidden = false;
  document.getElementById("totalBalanceInput").focus();
});
document.getElementById("closeBalanceEdit").addEventListener("click", () => {
  balanceForm.hidden = true;
});

loanMode.addEventListener("change", syncPeriodField);
syncPeriodField();

bindForm(
  "balanceForm",
  "/api/balance",
  (fd) => ({ amount: Number(fd.get("amount")), note: fd.get("note") || "تصحيح رصيد" }),
  "تم تصحيح رأس المال"
);

bindForm(
  "depositForm",
  "/api/deposit",
  (fd) => ({ amount: Number(fd.get("amount")), name: fd.get("name") || "إيداع" }),
  "تم الإيداع بنجاح"
);

bindForm(
  "expenseForm",
  "/api/expense",
  (fd) => ({ amount: Number(fd.get("amount")), name: fd.get("name") }),
  "تم تسجيل المصروف"
);

bindForm(
  "emergencyForm",
  "/api/emergency",
  (fd) => ({ amount: Number(fd.get("amount")), name: fd.get("name") }),
  "تم سحب الطوارئ بدون تأثير على السقف اليومي"
);

bindForm(
  "limitForm",
  "/api/daily-limit",
  (fd) => ({ amount: Number(fd.get("amount")) }),
  "تم تحديث السقف اليومي"
);

bindForm(
  "budgetForm",
  "/api/spend-budget",
  (fd) => ({ amount: Number(fd.get("amount")) }),
  "تم تخصيص مبلغ الصرف"
);

bindForm(
  "obligationForm",
  "/api/obligations",
  (fd) => ({
    name: fd.get("name"),
    amount: Number(fd.get("amount")),
    due_day: Number(fd.get("due_day")),
    notes: fd.get("notes") || "",
  }),
  "تمت إضافة الالتزام"
);

bindForm(
  "loanForm",
  "/api/loans",
  (fd) => ({
    name: fd.get("name"),
    amount: Number(fd.get("amount")),
    mode: fd.get("mode"),
    period: fd.get("period") || "",
    notes: fd.get("notes") || "",
  }),
  "تم تسجيل السلفة"
);

document.getElementById("obligationsList").addEventListener("click", async (e) => {
  const payBtn = e.target.closest("[data-pay]");
  const delBtn = e.target.closest("[data-del]");

  if (payBtn) {
    try {
      const data = await api(`/api/obligations/${payBtn.dataset.pay}/pay`, { method: "POST" });
      renderSummary(data.summary);
      renderObligations(data.obligations);
      renderNotifications(data.notifications);
      showToast("تم الدفع وخصم المبلغ من رأس المال");
    } catch (err) {
      showToast(err.message, true);
    }
    return;
  }

  if (!delBtn) return;
  try {
    const data = await api(`/api/obligations/${delBtn.dataset.del}`, { method: "DELETE" });
    renderObligations(data);
    const notifications = await api("/api/notifications?days=7");
    renderNotifications(notifications);
    showToast("تم حذف الالتزام");
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById("loansList").addEventListener("click", async (e) => {
  const repayBtn = e.target.closest("[data-repay]");
  const delBtn = e.target.closest("[data-loan-del]");

  if (repayBtn) {
    const id = repayBtn.dataset.repay;
    const input = document.querySelector(`[data-repay-input="${id}"]`);
    const amount = Number(input?.value || 0);
    try {
      const data = await api(`/api/loans/${id}/repay`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      renderSummary(data.summary);
      renderLoans(data.loans);
      showToast("تم تسجيل التسديد");
    } catch (err) {
      showToast(err.message, true);
    }
    return;
  }

  if (delBtn) {
    try {
      const data = await api(`/api/loans/${delBtn.dataset.loanDel}`, { method: "DELETE" });
      renderLoans(data);
      const summary = await api("/api/summary");
      renderSummary(summary);
      showToast("تم إغلاق السلفة");
    } catch (err) {
      showToast(err.message, true);
    }
  }
});

document.getElementById("bellBtn").addEventListener("click", openNotif);
document.getElementById("closeNotif").addEventListener("click", closeNotif);
overlay.addEventListener("click", closeNotif);

refresh().catch((err) => showToast(err.message, true));

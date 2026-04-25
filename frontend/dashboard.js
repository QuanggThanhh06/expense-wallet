const API_WALLET_URL = "http://localhost:5000/api/wallet";
const API_TRANSACTION_URL = "http://localhost:5000/api/transactions";

const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
  alert("Bạn chưa đăng nhập!");
  window.location.href = "index.html";
}

let transactions = [];
let overviewChart = null;

const walletBalance = document.getElementById("walletBalance");
const walletMiniBalance = document.getElementById("walletMiniBalance");
const walletPageBalance = document.getElementById("walletPageBalance");
const totalExpense = document.getElementById("totalExpense");
const totalIncome = document.getElementById("totalIncome");
const transactionList = document.getElementById("transactionList");
const topSpendingList = document.getElementById("topSpendingList");
const accountEmail = document.getElementById("accountEmail");

const startQrBtn = document.getElementById("startQrBtn");
const stopQrBtn = document.getElementById("stopQrBtn");
const qrReader = document.getElementById("qrReader");

const receiptImage = document.getElementById("receiptImage");
const scanOcrBtn = document.getElementById("scanOcrBtn");
const receiptPreview = document.getElementById("receiptPreview");
const scanStatus = document.getElementById("scanStatus");
const ocrResultText = document.getElementById("ocrResultText");

let html5QrCode = null;

accountEmail.textContent = user.email;

function formatMoney(amount) {
  return Number(amount).toLocaleString("vi-VN") + " đ";
}

// Điều hướng footer
document.querySelectorAll("[data-page]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const pageId = btn.dataset.page;
    showPage(pageId);

    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active");
    });

    if (btn.classList.contains("nav-item")) {
      btn.classList.add("active");
    }
  });
});

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active-page");
  });

  document.getElementById(pageId).classList.add("active-page");
}

// Lấy ví
async function loadWallet() {
  const res = await fetch(`${API_WALLET_URL}/${user.id}`);
  const wallet = await res.json();

  walletBalance.textContent = formatMoney(wallet.balance);
  walletMiniBalance.textContent = formatMoney(wallet.balance);
  walletPageBalance.textContent = formatMoney(wallet.balance);
}

// Lấy giao dịch
async function loadTransactions() {
  const res = await fetch(`${API_TRANSACTION_URL}/${user.id}`);
  transactions = await res.json();

  renderTransactions(transactions);
  renderOverview(transactions);
}

// Render lịch sử giao dịch
function renderTransactions(list) {
  transactionList.innerHTML = "";

  if (!list.length) {
    transactionList.innerHTML = `<p class="empty-text">Chưa có giao dịch nào</p>`;
    return;
  }

  list.forEach((tx) => {
    const isIncome = tx.type === "topup";

    const item = document.createElement("div");
    item.className = "transaction-item";

    item.innerHTML = `
      <div class="transaction-icon">${isIncome ? "💰" : "🧾"}</div>
      <div class="transaction-info">
        <h3>${isIncome ? "Nạp tiền vào ví" : tx.serviceType}</h3>
        <p>${tx.billCode ? "Mã: " + tx.billCode + " • " : ""}${new Date(tx.createdAt).toLocaleDateString("vi-VN")}</p>
      </div>
      <div class="transaction-amount ${isIncome ? "income" : "expense"}">
        ${isIncome ? "+" : "-"}${formatMoney(tx.amount)}
      </div>
    `;

    transactionList.appendChild(item);
  });
}

// Render tổng quan
function renderOverview(list) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthTx = list.filter((tx) => {
    const date = new Date(tx.createdAt);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const income = monthTx
    .filter((tx) => tx.type === "topup")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const expense = monthTx
    .filter((tx) => tx.type === "payment")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  totalIncome.textContent = formatMoney(income);
  totalExpense.textContent = formatMoney(expense);

  renderChart(monthTx);
  renderTopSpending(monthTx, expense);
}

// Biểu đồ
function renderChart(list) {
  const payments = list.filter((tx) => tx.type === "payment");

  const categoryTotals = {};

  payments.forEach((tx) => {
    categoryTotals[tx.serviceType] = (categoryTotals[tx.serviceType] || 0) + Number(tx.amount);
  });

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);

  const ctx = document.getElementById("overviewChart");

  if (overviewChart) {
    overviewChart.destroy();
  }

  if (!labels.length) {
    return;
  }

  overviewChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: ["#22c55e", "#ef4444", "#0ea5e9", "#f59e0b", "#8b5cf6", "#14b8a6"]
        }
      ]
    },
    options: {
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

// Chi tiêu nhiều nhất
function renderTopSpending(list, total) {
  const payments = list.filter((tx) => tx.type === "payment");

  const categoryTotals = {};

  payments.forEach((tx) => {
    categoryTotals[tx.serviceType] = (categoryTotals[tx.serviceType] || 0) + Number(tx.amount);
  });

  const sorted = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  topSpendingList.innerHTML = "";

  if (!sorted.length) {
    topSpendingList.innerHTML = `<p class="empty-text">Chưa có dữ liệu chi tiêu</p>`;
    return;
  }

  sorted.forEach(([name, amount]) => {
    const percent = total > 0 ? Math.round((amount / total) * 100) : 0;

    const item = document.createElement("div");
    item.className = "top-spending-item";

    item.innerHTML = `
      <div class="top-spending-icon">${getServiceIcon(name)}</div>
      <div class="top-spending-name">${name}</div>
      <div class="top-spending-percent">${percent}%</div>
    `;

    topSpendingList.appendChild(item);
  });
}

function getServiceIcon(type) {
  const icons = {
    "Tiền điện": "⚡",
    "Tiền nước": "💧",
    "Internet": "🌐",
    "Học phí": "🎓",
    "Khoản vay": "💳",
    "Vé máy bay": "✈️",
    "Vé tàu": "🚆",
    "Ăn uống": "🍽️",
    "Mua sắm": "🛒",
    "Khác": "🧾"
  };

  return icons[type] || "🧾";
}

// Nạp tiền
document.getElementById("topupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const amount = document.getElementById("topupAmount").value;

  const res = await fetch(`${API_WALLET_URL}/topup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId: user.id,
      amount
    })
  });

  const data = await res.json();

  if (res.ok) {
    alert(data.message);
    e.target.reset();
    await refreshAll();
  } else {
    alert(data.message);
  }
});

// Thanh toán
document.getElementById("payForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const serviceType = document.getElementById("serviceType").value;
  const billCode = document.getElementById("billCode").value;
  const amount = document.getElementById("payAmount").value;
  const note = document.getElementById("payNote").value;

  const res = await fetch(`${API_WALLET_URL}/pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId: user.id,
      serviceType,
      billCode,
      amount,
      note
    })
  });

  const data = await res.json();

  if (res.ok) {
    alert(data.message);
    e.target.reset();
    await refreshAll();
    showPage("overviewPage");
  } else {
    alert(data.message);
  }
});

// Mở form thanh toán nhanh
function openPayForm(type) {
  document.getElementById("serviceType").value = type;
  document.getElementById("payFormTitle").textContent = `Thanh toán ${type}`;
}

// Lọc giao dịch
document.getElementById("filterBtn").addEventListener("click", () => {
  const fromDate = document.getElementById("fromDate").value;
  const toDate = document.getElementById("toDate").value;

  let filtered = transactions;

  if (fromDate) {
    filtered = filtered.filter((tx) => {
      return new Date(tx.createdAt) >= new Date(fromDate);
    });
  }

  if (toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    filtered = filtered.filter((tx) => {
      return new Date(tx.createdAt) <= end;
    });
  }

  renderTransactions(filtered);
});

document.getElementById("clearFilterBtn").addEventListener("click", () => {
  document.getElementById("fromDate").value = "";
  document.getElementById("toDate").value = "";
  renderTransactions(transactions);
});

// Đăng xuất
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "index.html";
});

async function refreshAll() {
  await loadWallet();
  await loadTransactions();
}

refreshAll();

function handleQrData(qrText) {
  try {
    const data = JSON.parse(qrText);

    if (data.serviceType) {
      document.getElementById("serviceType").value = data.serviceType;
      document.getElementById("payFormTitle").textContent = `Thanh toán ${data.serviceType}`;
    }

    if (data.billCode) {
      document.getElementById("billCode").value = data.billCode;
    }

    if (data.amount) {
      document.getElementById("payAmount").value = data.amount;
    }

    if (data.note) {
      document.getElementById("payNote").value = data.note;
    }

    alert("Quét QR thành công!");
  } catch (error) {
    document.getElementById("billCode").value = qrText;
    alert("QR không phải JSON. Đã điền nội dung QR vào mã hóa đơn.");
  }
}


startQrBtn.addEventListener("click", async () => {
  try {
    qrReader.classList.remove("hidden");

    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("qrReader");
    }

    await html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: {
          width: 250,
          height: 250
        }
      },
      async (decodedText) => {
        handleQrData(decodedText);

        await html5QrCode.stop();
        qrReader.classList.add("hidden");
      }
    );
  } catch (error) {
    console.error(error);
    alert("Không thể mở camera để quét QR. Hãy kiểm tra quyền camera hoặc dùng Live Server.");
  }
});

stopQrBtn.addEventListener("click", async () => {
  try {
    if (html5QrCode) {
      await html5QrCode.stop();
    }

    qrReader.classList.add("hidden");
  } catch (error) {
    qrReader.classList.add("hidden");
  }
});

receiptImage.addEventListener("change", () => {
  const file = receiptImage.files[0];

  if (!file) {
    receiptPreview.classList.add("hidden");
    receiptPreview.src = "";
    return;
  }

  receiptPreview.src = URL.createObjectURL(file);
  receiptPreview.classList.remove("hidden");
});

function extractAmountFromText(text) {
  if (!text) return null;

  const lowerText = text.toLowerCase();

  const keywords = [
    "total",
    "tổng",
    "tong",
    "thành tiền",
    "thanh tien",
    "tổng cộng",
    "tong cong",
    "phải trả",
    "phai tra",
    "amount"
  ];

  const lines = lowerText.split("\n");

  for (let line of lines) {
    for (let keyword of keywords) {
      if (line.includes(keyword)) {
        const numbers = line.match(/[\d.,]+/g);

        if (numbers && numbers.length > 0) {
          const lastNumber = numbers[numbers.length - 1]
            .replace(/\./g, "")
            .replace(/,/g, "");

          if (!isNaN(lastNumber) && Number(lastNumber) > 0) {
            return Number(lastNumber);
          }
        }
      }
    }
  }

  const allNumbers = lowerText.match(/[\d.,]+/g);

  if (!allNumbers) return null;

  let maxNumber = 0;

  allNumbers.forEach((num) => {
    const cleanNum = num.replace(/\./g, "").replace(/,/g, "");
    const value = Number(cleanNum);

    if (!isNaN(value) && value > maxNumber) {
      maxNumber = value;
    }
  });

  return maxNumber > 0 ? maxNumber : null;
}

scanOcrBtn.addEventListener("click", async () => {
  const file = receiptImage.files[0];

  if (!file) {
    alert("Vui lòng chọn ảnh hóa đơn trước.");
    return;
  }

  try {
    scanStatus.textContent = "Đang quét hóa đơn...";
    ocrResultText.classList.remove("hidden");
    ocrResultText.value = "";

    const result = await Tesseract.recognize(file, "eng+vie", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          scanStatus.textContent = `Đang nhận diện: ${Math.round(m.progress * 100)}%`;
        }
      }
    });

    const text = result.data.text;
    ocrResultText.value = text;

    const amount = extractAmountFromText(text);

    if (amount) {
      document.getElementById("payAmount").value = amount;
      scanStatus.textContent = `OCR thành công. Đã gợi ý số tiền: ${formatMoney(amount)}`;
    } else {
      scanStatus.textContent = "OCR xong nhưng chưa tìm thấy số tiền phù hợp.";
    }
  } catch (error) {
    console.error(error);
    scanStatus.textContent = "Có lỗi khi quét OCR.";
  }
});
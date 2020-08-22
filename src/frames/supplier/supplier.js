(function () {
  let dbManager = window.dbManager;
  if (!dbManager) {
    try {
      dbManager = require("./database.js");
    } catch (e) {
      try {
        dbManager = require("../database.js");
      } catch (e) {}
    }
  }

  $("#supplier-table-container").load(
    "components/modal/return-supplier/return-supplier.html",
    () => {
      $.getScript("components/modal/return-supplier/return-supplier.js");
    },
  );

  let allLedgerData = [];
  window.currentLedgerPage = window.currentLedgerPage || 1;
  const itemsPerPage = 9;
  const fmt = (n) =>
    parseFloat(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  window.loadLedger = function () {
    if (dbManager && typeof dbManager.getStockLedger === "function") {
      allLedgerData = dbManager.getStockLedger();
    }
    populateSuppliers();
    buildLedgerTable();
  };

  function populateSuppliers() {
    const suppSet = new Set();
    allLedgerData.forEach((item) => {
      item.entries.forEach((e) => {
        if (e.supplier && e.supplier.trim() !== "") suppSet.add(e.supplier);
      });
    });

    const suppSelect = $("#filter-supplier").empty();
    suppSelect.append('<option value="ALL">All Suppliers</option>');
    suppSet.forEach((s) =>
      suppSelect.append(`<option value="${s}">${s}</option>`),
    );
  }

  function buildLedgerTable() {
    const tableBody = $("#ledger-tbody").empty();
    const pageFoot = $("#page-foot").empty();

    const searchTerm = $("#search-ledger").val().toLowerCase().trim();
    const filterSupplier = $("#filter-supplier").val();

    let filteredData = allLedgerData.filter((item) => {
      let matchesSearch =
        item.name.toLowerCase().includes(searchTerm) ||
        item.sku.toLowerCase().includes(searchTerm) ||
        item.brand.toLowerCase().includes(searchTerm);
      let matchesSupplier =
        filterSupplier === "ALL" ||
        item.entries.some((e) => e.supplier === filterSupplier);

      return matchesSearch && matchesSupplier;
    });

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (window.currentLedgerPage > totalPages)
      window.currentLedgerPage = totalPages || 1;
    if (window.currentLedgerPage < 1) window.currentLedgerPage = 1;

    if (filteredData.length === 0) {
      tableBody.append(
        `<tr><td colspan="6" style="text-align:center; color:#a0aab2; padding: 3rem; font-weight: 800;">No stock history found.</td></tr>`,
      );
      $("#ledger-count").text(`Showing 0 items`);
      return;
    }

    const paginatedData = filteredData.slice(
      (window.currentLedgerPage - 1) * itemsPerPage,
      window.currentLedgerPage * itemsPerPage,
    );

    paginatedData.forEach((item) => {
      let historyHtml = "";

      item.entries.forEach((entry) => {
        const dObj = new Date(entry.date.replace(" ", "T"));
        const dateStr = dObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const timeStr = dObj.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });

        if (filterSupplier !== "ALL" && entry.supplier !== filterSupplier)
          return;

        historyHtml += `
          <tr>
            <td>${dateStr} <span style="font-size: 0.65rem; color: #a0aab2; margin-left: 0.5rem;">${timeStr}</span></td>
            <td><span class="supp-badge">${entry.supplier}</span></td>
            <td style="text-align: center; color: ${entry.qty > 0 ? "#0984e3" : "#d63031"}; font-weight: 800;">${entry.qty > 0 ? "+" : ""}${entry.qty}</td>
            <td style="text-align: right;">₹${fmt(entry.cost)}</td>
            <td style="text-align: right; color: #2d3436;">₹${fmt(entry.total)}</td>
            <td style="text-align: center;">
              ${
                entry.qty > 0
                  ? `<button class="action-btn trigger-row-return" style="margin:0; padding: 0.25rem 0.75rem;" data-date="${entry.pure_date}">Return</button>`
                  : `<span style="font-size: 0.7rem; color: #a0aab2; font-weight: bold;">RTV Log</span>`
              }
            </td>
          </tr>
        `;
      });

      tableBody.append(`
        <tr class="ledger-row" data-id="${item.id}">
          <td style="text-align: center;">
            <button class="expand-btn ledger-expand" data-id="${item.id}">&#x25BC;</button>
          </td>
          <td>
            <span class="secondary-text" style="display: block; color: #0984e3; text-transform: uppercase;">${item.brand}</span>
            <span class="primary-text">${item.name}</span>
          </td>
          <td>${item.variant}</td>
          <td><span class="sku-badge">${item.sku}</span></td>
          <td style="text-align: center; font-size: 1.1rem; font-weight: 800;">${item.current_stock}</td>
          <td style="text-align: right; color: #00b894; font-size: 1.1rem; font-weight: 800;">₹${fmt(item.mac)}</td>
        </tr>
        <tr class="order-details-row" id="history-${item.id}" style="display: none;">
          <td colspan="6">
            <div class="order-details-box">
              <table class="details-table">
                <thead>
                  <tr>
                    <th>Delivery Date</th>
                    <th>Supplier</th>
                    <th style="text-align: center;">Qty Received</th>
                    <th style="text-align: right;">Supplier Price / pc</th>
                    <th style="text-align: right;">Total Invoice</th>
                    <th style="text-align: center;">Action</th>
                  </tr>
                </thead>
                <tbody>${historyHtml}</tbody>
              </table>
            </div>
          </td>
        </tr>
      `);
    });

    if (totalPages > 1) {
      let pHTML = `<button class="page-btn" data-page="${window.currentLedgerPage - 1}" ${window.currentLedgerPage === 1 ? "disabled" : ""}>Prev</button>`;
      for (let i = 1; i <= totalPages; i++) {
        if (
          i === 1 ||
          i === totalPages ||
          (i >= window.currentLedgerPage - 1 &&
            i <= window.currentLedgerPage + 1)
        ) {
          pHTML += `<button class="page-btn ${i === window.currentLedgerPage ? "active-page" : ""}" data-page="${i}">${i}</button>`;
        }
      }
      pHTML += `<button class="page-btn" data-page="${window.currentLedgerPage + 1}" ${window.currentLedgerPage === totalPages ? "disabled" : ""}>Next</button>`;
      pageFoot.html(pHTML);
    }
    $("#ledger-count").text(
      `Showing ${filteredData.length} items with history`,
    );
  }

  setTimeout(window.loadLedger, 50);

  $(document).off(".ledger");

  $(document).on("click.ledger", ".ledger-expand", function () {
    const itemId = $(this).data("id");
    const historyRow = $("#history-" + itemId);
    $(this).toggleClass("is-open");
    historyRow.fadeToggle(150);
  });

  $(document).on("click.ledger", ".page-btn", function () {
    window.currentLedgerPage = parseInt($(this).data("page"));
    buildLedgerTable();
  });
  $(document).on("input.ledger", "#search-ledger", function () {
    window.currentLedgerPage = 1;
    buildLedgerTable();
  });
  $(document).on("change.ledger", "#filter-supplier", function () {
    window.currentLedgerPage = 1;
    buildLedgerTable();
  });

  $(document).on("click.ledger", "#open-batch-return", function () {
    if (typeof window.openSupplierTableModal === "function")
      window.openSupplierTableModal();
  });

  $(document).on("click.ledger", ".trigger-row-return", function () {
    const targetDate = $(this).data("date");
    if (typeof window.openSupplierTableModal === "function")
      window.openSupplierTableModal(targetDate);
  });

  $(document).on("click.ledger", "#export-ledger-csv", function () {
    let csvData =
      "Delivery Date,Item Name,Variant,SKU,Supplier,Qty Received,Supplier Price / pc,Total Invoice\n";
    allLedgerData.forEach((item) => {
      item.entries.forEach((entry) => {
        let rowText = `"${entry.date}","${item.name}","${item.variant}","${item.sku}","${entry.supplier}",${entry.qty},${entry.cost},${entry.total}`;
        csvData += rowText + "\n";
      });
    });
    let fileBlob = new Blob([csvData], { type: "text/csv" });
    let blobUrl = URL.createObjectURL(fileBlob);
    let linkTag = document.createElement("a");
    linkTag.href = blobUrl;
    linkTag.download = "stock_ledger_export.csv";
    linkTag.click();
  });
})();

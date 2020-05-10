(function () {
  let dbManager = null;
  try {
    dbManager = require("../database.js");
  } catch (err) {}

  let allSales = [];
  window.currentOrderPage = window.currentOrderPage || 1;
  const itemsPerPage = 9;
  const fmt = (n) =>
    parseFloat(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  $("#receipt-modal-container").load(
    "components/modal/receipt-modal/receipt-modal.html",
    () => {
      $.getScript("components/modal/receipt-modal/receipt-modal.js");
    },
  );

  $("#refund-modal-container").load(
    "components/modal/refund-modal/refund-modal.html",
    () => {
      $.getScript("components/modal/refund-modal/refund-modal.js");
    },
  );

  window.loadSalesData = function () {
    if (dbManager && dbManager.getRecentSales) {
      allSales = dbManager.getRecentSales();
    }
    buildOrdersTable();
  };

  function buildOrdersTable() {
    const tableBody = $("#orders-tbody").empty();
    const pageFoot = $("#page-foot").empty();

    const searchTerm = $("#search-orders").val().toLowerCase().trim();
    const filterPayment = $("#filter-payment").val();
    const filterStatus = $("#filter-status").val();

    let filteredSales = allSales.filter((sale) => {
      let cartData = {};
      try {
        cartData = JSON.parse(sale.cart_json || "{}");
      } catch (e) {}
      let phoneStr = cartData.phone ? cartData.phone.toLowerCase() : "";

      let matchesSearch =
        sale.order_number.toLowerCase().includes(searchTerm) ||
        phoneStr.includes(searchTerm);
      let matchesPayment =
        filterPayment === "ALL" || sale.payment_method === filterPayment;
      let matchesStatus =
        filterStatus === "ALL" || sale.status === filterStatus;

      return matchesSearch && matchesPayment && matchesStatus;
    });

    const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
    if (window.currentOrderPage > totalPages)
      window.currentOrderPage = totalPages || 1;
    if (window.currentOrderPage < 1) window.currentOrderPage = 1;

    if (filteredSales.length === 0) {
      tableBody.append(
        `<tr><td colspan="9" style="text-align:center; color:#a0aab2; padding: 2rem; font-weight: 800;">No orders found.</td></tr>`,
      );
      $("#orders-count").text(`Showing 0 orders`);
      return;
    }

    const paginatedData = filteredSales.slice(
      (window.currentOrderPage - 1) * itemsPerPage,
      window.currentOrderPage * itemsPerPage,
    );

    paginatedData.forEach((sale) => {
      const dateObj = new Date(sale.datetime.replace(" ", "T"));
      const dateStr = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = dateObj.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });

      let cartData = {};
      let itemsHtml = "";
      try {
        cartData = JSON.parse(sale.cart_json || "{}");
      } catch (e) {}
      const phoneText = cartData.phone || "-";

      if (cartData.items && cartData.items.length > 0) {
        cartData.items.forEach((item) => {
          let variantStr = item.variant ? item.variant : "Standard";
          let skuStr = item.sku
            ? `<span class="sku-badge">${item.sku}</span>`
            : `<span style="color:#a0aab2; font-size:0.75rem;">N/A</span>`;

          let returnedQty =
            sale.refunded_map && sale.refunded_map[item.id]
              ? sale.refunded_map[item.id]
              : 0;

          let returnHtml =
            returnedQty > 0
              ? `<span style="color: #2d3436; font-weight: 800;">${returnedQty}</span>`
              : `<span style="color: #a0aab2;">-</span>`;

          itemsHtml += `
            <tr>
              <td>${item.name}</td>
              <td>${skuStr}</td>
              <td>${variantStr}</td>
              <td style="text-align: center; font-weight: 800;">${item.qty}</td>
              <td style="text-align: center;">${returnHtml}</td>
              <td style="text-align: right;">₹${fmt(item.unitPrice)}</td>
              <td style="text-align: right; color: #2d3436;">₹${fmt(item.qty * item.unitPrice)}</td>
            </tr>
          `;
        });
      }

      let statusColor =
        sale.status === "PAID"
          ? "#00b894"
          : sale.status === "REFUNDED"
            ? "#636e72"
            : "#f39c12";

      tableBody.append(`
        <tr class="sale-row" data-id="${sale.id}">
          <td style="text-align: center;">
            <button class="expand-btn" data-id="${sale.id}" title="View Items">&#x25BC;</button>
          </td>
          <td><input type="checkbox" class="row-check"></td>
          <td><span class="primary-text">${sale.order_number}</span></td>
          <td><span class="secondary-text">${dateStr}</span> <span style="font-weight: 800; color: #2d3436; margin-left: 0.5rem;">${timeStr}</span></td>
          <td><span style="font-weight: 800; color: #636e72;">${phoneText}</span></td>
          <td style="text-align: center;"><span class="payment-badge">${sale.payment_method}</span></td>
          <td style="text-align: right; font-weight: 800; color: #2d3436; font-size: 1.25rem;">₹${fmt(sale.grand_total)}</td>
          <td style="text-align: center; font-weight: 800; color: ${statusColor}; font-size: 0.75rem;">${sale.status}</td>
          <td>
            <div class="table-actions">
              <button class="view-btn" data-id="${sale.id}">Receipt</button>
              <button class="view-btn row-refund-btn" data-id="${sale.id}">Refund</button>
            </div>
          </td>
        </tr>
        <tr class="order-details-row" id="details-${sale.id}" style="display: none;">
          <td colspan="9">
            <div class="order-details-box">
              <table class="details-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>SKU</th>
                    <th>Variant</th>
                    <th style="text-align: center;">Sold Qty</th>
                    <th style="text-align: center;">Returned</th>
                    <th style="text-align: right;">Unit Price</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
              </table>
            </div>
          </td>
        </tr>
      `);
    });

    if (totalPages > 1) {
      let pHTML = `<button class="page-btn" data-page="${window.currentOrderPage - 1}" ${window.currentOrderPage === 1 ? "disabled" : ""}>Prev</button>`;
      for (let i = 1; i <= totalPages; i++) {
        if (
          i === 1 ||
          i === totalPages ||
          (i >= window.currentOrderPage - 1 && i <= window.currentOrderPage + 1)
        ) {
          pHTML += `<button class="page-btn ${i === window.currentOrderPage ? "active-page" : ""}" data-page="${i}">${i}</button>`;
        }
      }
      pHTML += `<button class="page-btn" data-page="${window.currentOrderPage + 1}" ${window.currentOrderPage === totalPages ? "disabled" : ""}>Next</button>`;
      pageFoot.html(pHTML);
    }
    $("#orders-count").text(`Showing ${filteredSales.length} total orders`);
  }

  setTimeout(window.loadSalesData, 50);

  $(document).off(".orders");

  $(document).on("click.orders", ".expand-btn", function () {
    const saleId = $(this).data("id");
    const detailsRow = $("#details-" + saleId);
    $(this).toggleClass("is-open");
    detailsRow.fadeToggle(150);
  });

  $(document).on("click.orders", ".page-btn", function () {
    window.currentOrderPage = parseInt($(this).data("page"));
    buildOrdersTable();
  });
  $(document).on("input.orders", "#search-orders", function () {
    window.currentOrderPage = 1;
    buildOrdersTable();
  });
  $(document).on("change.orders", "#filter-payment", function () {
    window.currentOrderPage = 1;
    buildOrdersTable();
  });
  $(document).on("change.orders", "#filter-status", function () {
    window.currentOrderPage = 1;
    buildOrdersTable();
  });
  $(document).on("change.orders", "#select-all", function () {
    $(".row-check").prop("checked", $(this).prop("checked"));
  });

  $(document).on("click.orders", ".view-btn:not(.row-refund-btn)", function () {
    if (typeof window.openReceiptModal === "function")
      window.openReceiptModal($(this).data("id"));
  });

  $(document).on("click.orders", ".row-refund-btn", function () {
    if (typeof window.openRefundModal === "function")
      window.openRefundModal($(this).data("id"));
  });

  $(document).on("click.orders", "#delete-order-btn", async function () {
    const targetIds = [];
    $(".row-check:checked").each(function () {
      targetIds.push($(this).closest("tr.sale-row").data("id"));
    });

    if (targetIds.length === 0) {
      if (window.appAlert)
        await window.appAlert(
          "Action Required",
          "Select at least one order to delete.",
        );
      return;
    }

    let isConfirmed = true;
    if (window.appAlert) {
      isConfirmed = await window.appAlert(
        "Delete Orders",
        `Permanently delete ${targetIds.length} order(s)? This will remove their record from the database.`,
        true,
      );
    }

    if (isConfirmed) {
      targetIds.forEach((id) => {
        if (window.dbManager) window.dbManager.deleteSale(id);
      });
      window.loadSalesData();
    }
  });

  $(document).on("click.orders", "#export-csv", function () {
    let csvData = "Order Number,Date,Phone,Payment,Total,Status\n";
    allSales.forEach((sale) => {
      let cartInfo = {};
      try {
        cartInfo = JSON.parse(sale.cart_json || "{}");
      } catch (e) {}
      let phoneNum = cartInfo.phone || "N/A";
      let rowText = `"${sale.order_number}","${sale.datetime}","${phoneNum}","${sale.payment_method}",${sale.grand_total},"${sale.status}"`;
      csvData += rowText + "\n";
    });
    let fileBlob = new Blob([csvData], { type: "text/csv" });
    let blobUrl = URL.createObjectURL(fileBlob);
    let linkTag = document.createElement("a");
    linkTag.href = blobUrl;
    linkTag.download = "sales_export.csv";
    linkTag.click();
  });

  $(document).on("click.orders", "#open-settings", function () {
    if (typeof window.openSettingsModal === "function")
      window.openSettingsModal();
  });
})();

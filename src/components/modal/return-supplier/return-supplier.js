(function () {
  $(document).off(".suppTable");

  window.openSupplierTableModal = function (preSelectDateStr = null) {
    if (!window.dbManager) return;

    const dateSelect = $("#return-date-select").empty();
    dateSelect.append('<option value="">-- Choose a Date --</option>');

    const dates = window.dbManager.getDeliveryDates();
    dates.forEach((d) => {
      dateSelect.append(`<option value="${d}">${d}</option>`);
    });

    $("#st-table-wrapper").hide();
    $("#st-empty-msg").show();
    $("#return-items-tbody").empty();

    if (preSelectDateStr) {
      dateSelect.val(preSelectDateStr).trigger("change");
    }

    $("#supplier-table-modal").css("display", "flex");
  };

  $(document).on("change.suppTable", "#return-date-select", function () {
    const val = $(this).val();
    if (!val) {
      $("#st-table-wrapper").hide();
      $("#st-empty-msg").show();
      return;
    }

    if (window.dbManager) {
      const entries = window.dbManager.getEntriesByDate(val);
      const tbody = $("#return-items-tbody").empty();

      entries.forEach((e) => {
        let currentStock = window.dbManager.getLiveStock(e.vid);
        let maxReturn = Math.min(e.qtyReceived, currentStock);

        let badgeHtml =
          maxReturn > 0
            ? `<span style="color:#3b82f6; font-size:0.65rem; font-weight:800;">(Stock: ${maxReturn})</span>`
            : `<span style="color:#64748b; font-size:0.65rem; font-weight:800;">OUT OF STOCK</span>`;

        let inputHtml =
          maxReturn > 0
            ? `<input type="number" class="rt-qty-input" data-vid="${e.vid}" data-supp="${e.supplier}" data-cost="${e.cost}" data-max="${maxReturn}" placeholder="0" min="0" max="${maxReturn}">`
            : `<input type="number" class="rt-qty-input" disabled placeholder="-" style="background:#f1f5f9;">`;

        tbody.append(`
                 <tr>
                   <td>
                      <div style="font-weight:800; color:#0f172a;">${e.name}</div>
                      <div style="font-size:0.7rem; color:#64748b; font-family:monospace;">${e.variant} | SKU: ${e.sku}</div>
                   </td>
                   <td><span style="background: #f1f5f9; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.65rem; font-weight:700;">${e.supplier}</span></td>
                   <td style="font-weight:700;">₹${e.cost}</td>
                   <td style="text-align: center; font-weight:800;">${e.qtyReceived} <br>${badgeHtml}</td>
                   <td style="text-align: right;">${inputHtml}</td>
                 </tr>
              `);
      });

      $("#st-empty-msg").hide();
      $("#st-table-wrapper").show();
    }
  });

  $(document).on("input.suppTable", ".rt-qty-input", function () {
    let val = parseInt($(this).val());
    let max = parseInt($(this).data("max"));
    if (val > max) {
      $(this).val(max);
    }
  });

  $(document).on("click.suppTable", ".close-supplier-table", function () {
    $("#supplier-table-modal").hide();
  });

  $(document).on("click.suppTable", "#confirm-batch-return", async function () {
    let returnsToProcess = [];

    $(".rt-qty-input:not(:disabled)").each(function () {
      let val = parseInt($(this).val());
      if (!isNaN(val) && val > 0) {
        let max = parseInt($(this).data("max"));
        if (val > max) val = max;

        returnsToProcess.push({
          vid: $(this).data("vid"),
          supplier: $(this).data("supp"),
          cost: parseFloat($(this).data("cost")),
          returnQty: val,
        });
      }
    });

    if (returnsToProcess.length === 0) {
      if (window.appAlert)
        await window.appAlert(
          "No Items",
          "Please enter a return quantity for at least one item.",
        );
      return;
    }

    let isConfirmed = true;
    if (window.appAlert) {
      isConfirmed = await window.appAlert(
        "Process Returns",
        `Register returns for ${returnsToProcess.length} items? This will adjust stock levels immediately.`,
        true,
      );
    }

    if (isConfirmed && window.dbManager) {
      window.dbManager.processBatchReturn(returnsToProcess);
      $("#supplier-table-modal").hide();

      if (typeof window.loadLedger === "function") window.loadLedger();
      if (window.reloadTable) window.reloadTable();
    }
  });
})();


(function () {
  $(document).off(".refund");

  let activeId = null;
  let recData = null;
  const fmt = (n) =>
    parseFloat(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  window.openRefundModal = async function (saleId) {
    if (!window.dbManager) return;
    recData = window.dbManager.getSaleReceipt(saleId);
    if (!recData) return;

    if (recData.status === "REFUNDED") {
      if (window.appAlert)
        await window.appAlert(
          "Notice",
          "This order has already been fully refunded.",
        );
      $("#refund-modal").hide();
      return;
    }

    activeId = saleId;
    $("#ref-order-num").text(recData.order_number);
    const itemsNode = $("#refund-items").empty();

    recData.cart_json.items.forEach((item, index) => {
      let refundedQty = recData.refunded_map[item.id] || 0;
      let availQty = item.qty - refundedQty;

      let actionHtml = "";
      if (availQty > 0) {
        actionHtml = `
          <div class="step-box">
            <button class="step-btn ref-minus">-</button>
            <input type="text" class="step-val ref-qty" data-idx="${index}" data-price="${item.unitPrice}" data-max="${availQty}" data-id="${item.id}" value="0" readonly>
            <button class="step-btn ref-plus">+</button>
          </div>
        `;
      } else {
        actionHtml = `<span style="font-size: 0.75rem; color: #a0aab2; font-weight: 800; text-transform: uppercase;">Returned</span>`;
      }

      itemsNode.append(`
        <tr>
          <td class="col-name">
            <span class="item-title">${item.name}</span>
            <span class="item-max">Available for return: ${availQty} / ${item.qty}</span>
          </td>
          <td class="col-price" style="text-align: right; color: #2d3436; font-weight: 600;">
            ₹${fmt(item.unitPrice)}
          </td>
          <td class="col-action" style="text-align: right;">
            ${actionHtml}
          </td>
        </tr>
      `);
    });

    calcTotal();
    $("#refund-modal").show();
  };

  function calcTotal() {
    let totalAmt = 0;
    $(".ref-qty").each(function () {
      let inQty = parseInt($(this).val()) || 0;
      let inPrice = parseFloat($(this).data("price")) || 0;
      totalAmt += inQty * inPrice;
    });
    $("#refund-total").text(`₹${fmt(totalAmt)}`);
    return totalAmt;
  }

  $(document).on("click.refund", ".ref-plus", function () {
    const inputNode = $(this).siblings(".ref-qty");
    let inVal = parseInt(inputNode.val()) || 0;
    let maxVal = parseInt(inputNode.data("max")) || 0;
    if (inVal < maxVal) {
      inputNode.val(inVal + 1);
      calcTotal();
    }
  });

  $(document).on("click.refund", ".ref-minus", function () {
    const inputNode = $(this).siblings(".ref-qty");
    let inVal = parseInt(inputNode.val()) || 0;
    if (inVal > 0) {
      inputNode.val(inVal - 1);
      calcTotal();
    }
  });

  $(document).on("click.refund", "#close-refund", function () {
    $("#refund-modal").hide();
  });

  function processTx(restockBool) {
    let totalAmt = calcTotal();
    if (totalAmt <= 0) return;

    let targetItems = [];
    let itemsPastNow = 0;
    let totalItems = 0;

    recData.cart_json.items.forEach((item) => {
      totalItems += item.qty;
      let pastQty = recData.refunded_map[item.id] || 0;

      let inputNode = $(".ref-qty").filter(`[data-id="${item.id}"]`);
      let nowQty = 0;
      if (inputNode.length > 0) {
        nowQty = parseInt(inputNode.val()) || 0;
      }

      if (nowQty > 0) {
        targetItems.push({
          id: item.id,
          refundQty: nowQty,
          price: item.unitPrice,
        });
      }

      itemsPastNow += pastQty + nowQty;
    });

    let nextStatus = itemsPastNow >= totalItems ? "REFUNDED" : "PARTIAL REFUND";

    const isSuccess = window.dbManager.processRefund(
      activeId,
      targetItems,
      totalAmt,
      nextStatus,
      restockBool,
    );

    if (isSuccess) {
      $("#refund-modal").hide();
      if (window.loadSalesData) window.loadSalesData();
      if (window.reloadTable) window.reloadTable();
    }
  }

  $(document).on("click.refund", "#refund-discard-btn", function () {
    processTx(false);
  });

  $(document).on("click.refund", "#refund-restock-btn", function () {
    processTx(true);
  });
})();

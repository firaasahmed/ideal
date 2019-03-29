(function () {
  const fmtNum = (n) =>
    parseFloat(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const defaultRcpt = {
    store: "IDEAL FOOTWEAR",
    loc1: "45, Nagawara Main Rd, 3rd Cross Rd",
    loc2: "Near K.G Halli Police Station",
    loc3: "Kushal Nagar, Bengaluru, KA 560045",
    contact: "Phone: +91 96633 14427",
    policy:
      "Returns accepted within 7 days from purchase date with original receipt and intact packaging.\n\nThank you for shopping with us!",
  };

  function getRcptSettings() {
    let savedConf = localStorage.getItem("posRcptSettings");
    return savedConf ? JSON.parse(savedConf) : defaultRcpt;
  }

  window.openReceiptModal = function (saleId) {
    if (!window.dbManager) return;
    const receiptObj = window.dbManager.getSaleReceipt(saleId);
    if (!receiptObj) return;

    let confSet = getRcptSettings();
    $("#store-name").text(confSet.store || "");
    if (confSet.loc1) {
      $("#address-one").text(confSet.loc1).show();
    } else {
      $("#address-one").hide();
    }
    if (confSet.loc2) {
      $("#address-two").text(confSet.loc2).show();
    } else {
      $("#address-two").hide();
    }
    if (confSet.loc3) {
      $("#address-three").text(confSet.loc3).show();
    } else {
      $("#address-three").hide();
    }
    if (confSet.contact) {
      $("#store-phone").text(confSet.contact).show();
    } else {
      $("#store-phone").hide();
    }

    if (confSet.policy) {
      let formattedPol = confSet.policy.replace(/\n/g, "<br>");
      $("#receipt-policy").html(formattedPol).show();
    } else {
      $("#receipt-policy").hide();
    }

    $("#order-id").text("Order: " + receiptObj.order_number);
    $("#order-date").text(receiptObj.datetime);
    $("#payment-type").text(receiptObj.payment_method);

    const tableItems = $("#receipt-items").empty();
    const cartData = receiptObj.cart_json;
    let rawSubtotal = 0;

    const nameMap = {};

    cartData.items.forEach((item) => {
      nameMap[item.id] = item.name;
      const origPrice = item.originalPrice || item.unitPrice;
      const lineTotal = item.qty * item.unitPrice;
      const origLineTotal = item.qty * origPrice;
      rawSubtotal += origLineTotal;

      let priceHtml = `<span style="font-weight: 800;">₹${fmtNum(lineTotal)}</span>`;
      let discText = "";

      if (item.unitPrice < origPrice) {
        const savedAmount = origLineTotal - lineTotal;
        let activeTag = "Discount";
        if (item.isCashierOverride) {
          let discPct = ((origPrice - item.unitPrice) / origPrice) * 100;
          let pctStr =
            discPct % 1 === 0 ? discPct.toFixed(0) : discPct.toFixed(1);
          activeTag = `Cashier ${pctStr}%`;
        } else if (item.promoName && !item.promoRemoved) {
          activeTag = item.promoName;
        }

        priceHtml = `
          <div class="price-stack">
            <span class="old-price">₹${fmtNum(origLineTotal)}</span>
            <span class="new-price">₹${fmtNum(lineTotal)}</span>
          </div>
        `;
        discText = `<span class="item-discount">${activeTag}: -₹${fmtNum(savedAmount)}</span>`;
      }

      let attrMap = {};
      if (typeof item.attributes === "string") {
        try {
          attrMap = JSON.parse(item.attributes);
        } catch (e) {}
      } else if (item.attributes) {
        attrMap = item.attributes;
      }

      let variantHtml = "";
      if (Object.keys(attrMap).length > 0) {
        let attrStr = Object.entries(attrMap)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        variantHtml = `<span class="item-meta" style="color: #636e72; font-size: 0.75rem; display: block; margin-top: 0.25rem;">${attrStr}</span>`;
      }

      let skuHtml = item.sku
        ? `<span class="item-meta" style="display: block; font-family: monospace; font-size: 0.75rem;">${item.sku}</span>`
        : "";
      let detailsHtml = skuHtml + variantHtml;

      let returnTag = "";
      if (receiptObj.refunded_map && receiptObj.refunded_map[item.id]) {
        returnTag = `<span class="item-meta" style="margin-top: 0.5rem;">[RETURNED: ${receiptObj.refunded_map[item.id]}]</span>`;
      }

      tableItems.append(`
        <tr>
          <td class="col-item">
            <span class="item-name">${item.name}</span>
            ${detailsHtml}
            ${discText}
            ${returnTag}
          </td>
          <td class="col-qty" style="font-weight: 800;">${item.qty}</td>
          <td class="col-price">${priceHtml}</td>
        </tr>
      `);
    });

    $("#subtotal-amt").text("₹" + fmtNum(rawSubtotal));
    $("#discount-amt").text("- ₹" + fmtNum(cartData.discount || 0));
    $("#grand-amt").text("₹" + fmtNum(receiptObj.grand_total));

    if (receiptObj.refunds_list && receiptObj.refunds_list.length > 0) {
      const historyList = $("#refund-history-list").empty();

      Object.keys(receiptObj.refunded_map).forEach((itemId) => {
        const refQty = receiptObj.refunded_map[itemId];
        if (refQty > 0) {
          const itemName = nameMap[itemId] || "Unknown Item";
          historyList.append(`
            <div class="refund-item-row">
              <div>
                <span class="ref-item-name">${itemName}</span>
                <span class="ref-item-qty">${refQty} Returned</span>
              </div>
            </div>
          `);
        }
      });

      let totalRefunded = receiptObj.refunds_list.reduce(
        (sum, r) => sum + r.total,
        0,
      );
      $("#refund-history-total").text(`- ₹${fmtNum(totalRefunded)}`);
      $("#refund-history-card").show();
    } else {
      $("#refund-history-card").hide();
    }

    $("#receipt-modal").show();
  };

  $(document).on("click.receipt", "#close-modal", function () {
    $("#receipt-modal").hide();
  });
  $(document).on("click.receipt", "#print-btn", function () {
    window.print();
  });

  window.openSettingsModal = function () {
    let confSet = getRcptSettings();
    $("#edit-store").val(confSet.store || "");
    $("#edit-add1").val(confSet.loc1 || "");
    $("#edit-add2").val(confSet.loc2 || "");
    $("#edit-add3").val(confSet.loc3 || "");
    $("#edit-phone").val(confSet.contact || "");
    $("#edit-policy").val(confSet.policy || "");
    $("#settings-modal").show();
  };

  $(document).on("click.receipt", "#close-settings", function () {
    $("#settings-modal").hide();
  });
  $(document).on("click.receipt", "#save-settings", function () {
    let newConf = {
      store: $("#edit-store").val().trim(),
      loc1: $("#edit-add1").val().trim(),
      loc2: $("#edit-add2").val().trim(),
      loc3: $("#edit-add3").val().trim(),
      contact: $("#edit-phone").val().trim(),
      policy: $("#edit-policy").val().trim(),
    };
    localStorage.setItem("posRcptSettings", JSON.stringify(newConf));
    $("#settings-modal").hide();
  });
})();

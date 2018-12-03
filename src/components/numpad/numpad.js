
(function () {
  $(document).off(".numpad");

  let dbManager = null;
  try {
    dbManager = require("../database.js");
  } catch (err) {}

  let editIndex = -1;
  let editItemId = null;
  let activeMode = "price";
  let originalUnitPrice = 0;

  let shouldOverwrite = true;
  let isPromoActive = false;

  const fmt = (n) =>
    n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  function getVal(selector, fallback = 0) {
    const rawVal = $(selector).val();
    if (rawVal === undefined) return fallback; 
    const valStr = rawVal.toString().trim();
    if (valStr === "" || valStr === ".") return 0;
    const v = parseFloat(valStr);
    return isNaN(v) ? fallback : v;
  }

  window.syncNumpadWithCart = function () {
    if (!$("#edit-overlay").is(":visible")) return;
    if (!editItemId) {
      closeOverlay();
      return;
    }

    editIndex = window.cart.items.findIndex((i) => i.id === editItemId);

    if (editIndex === -1) {
      closeOverlay();
      return;
    }

    calculateTotals(activeMode);
  };

  function calculateTotals(changedField) {
    const item = window.cart.items[editIndex];
    if (!item) return;

    let qty = item.qty;
    let disc = getVal("#disc-input", 0);
    let price = getVal("#price-input", originalUnitPrice);

    if (changedField === "disc") {
      price = originalUnitPrice - originalUnitPrice * (disc / 100);
      price = Math.max(0, price);
      if (activeMode !== "price") $("#price-input").val(price.toFixed(2));
    } else if (changedField === "price") {
      const dbP = item.dbPrice !== undefined ? item.dbPrice : originalUnitPrice;
      if (isPromoActive && price === dbP) {
        disc = 0;
      } else {
        disc = ((originalUnitPrice - price) / originalUnitPrice) * 100;
      }
      if (activeMode !== "disc") $("#disc-input").val(disc.toFixed(2));
    }

    const origLineTotal = originalUnitPrice * qty;
    const totalFinal = price * qty;

    $("#edit-qty-val").text(`Quantity: ${qty}`);
    

    if (price < originalUnitPrice || isPromoActive) {
      $("#edit-old").css("display", "flex");
      $("#edit-old-val").text(`₹ ${fmt(origLineTotal)}`);
    } else {
      $("#edit-old").hide();
    }

    $("#edit-sum-val").text(`₹ ${fmt(totalFinal)}`);

    let bTexts = [];

    if (isPromoActive) {
      bTexts.push(`
         <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem;">
           <span style="background: #e1e5ea; padding: 0.25rem 0.5rem; border: 0.25rem solid #d1d8df; border-radius: 0.25rem; font-weight: 800; text-transform: uppercase; font-size: 0.75rem; color: #2d3436; letter-spacing: 0.05em; display: flex; align-items: center;">
             ${item.promoName || "Promo"}
             <button class="edit-kill">&times;</button>
           </span>
           <span style="color: #059669; font-weight: 800; font-size: 0.75rem;">-₹ ${fmt((originalUnitPrice - price) * qty)}</span>
         </div>
       `);
    } else if (price < originalUnitPrice) {
      let pctStr = disc % 1 === 0 ? disc.toFixed(0) : disc.toFixed(1);
      bTexts.push(`
         <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem;">
           <span style="background: #e1e5ea; padding: 0.25rem 0.5rem; border: 0.25rem solid #d1d8df; border-radius: 0.25rem; font-weight: 800; text-transform: uppercase; font-size: 0.75rem; color: #2d3436; letter-spacing: 0.05em; display: flex; align-items: center;">
             Cashier ${pctStr}%
             <button class="edit-kill">&times;</button>
           </span>
           <span style="color: #059669; font-weight: 800; font-size: 0.75rem;">-₹ ${fmt((originalUnitPrice - price) * qty)}</span>
         </div>
       `);
    }

    $("#edit-break").html(bTexts.join(""));
  }

  $(document).on("click.numpad", ".edit-kill", function (e) {
    e.stopPropagation();
    isPromoActive = false;
    $("#price-input").val(originalUnitPrice.toFixed(2));
    $("#disc-input").val("0");
    shouldOverwrite = true;
    calculateTotals("price");
  });

  $(document).on("click.numpad", ".cart-row, .flash-row", function () {
    editIndex = $(this).data("cart-index");
    const item = window.cart.items[editIndex];
    if (!item) return;

    editItemId = item.id;
    originalUnitPrice = item.originalPrice || item.unitPrice;

    const dbP = item.dbPrice !== undefined ? item.dbPrice : originalUnitPrice;
    isPromoActive =
      !item.isCashierOverride && !item.promoRemoved && dbP < originalUnitPrice;

    
    let attrMap = item.attributes || {};
    if (typeof attrMap === "string") {
      try {
        attrMap = JSON.parse(attrMap);
      } catch (e) {
        attrMap = {};
      }
    }

    let specsHtml = "";
    if (Object.keys(attrMap).length > 0) {
      specsHtml = `<div class="edit-specs">`;
      for (let propKey in attrMap) {
        specsHtml += `<span class="edit-spec-box"><span class="edit-spec-lbl">${propKey}:</span> <span class="edit-spec-val">${attrMap[propKey]}</span></span>`;
      }
      specsHtml += `</div>`;
    } else if (item.variant && item.variant !== "Standard") {
      specsHtml = `<div class="edit-specs"><span class="edit-spec-box"><span class="edit-spec-val">${item.variant}</span></span></div>`;
    }

    let customCardHtml = `
      <div style="padding: 1.25rem;">
         <div class="edit-brand">${item.brand || "Item"}</div>
         <div class="edit-title">${item.name}</div>
         ${specsHtml}
      </div>
    `;

    $("#edit-details").html(customCardHtml);

    $("#price-input").val(item.unitPrice.toFixed(2));

    let existingDisc = 0;
    if (item.isCashierOverride) {
      existingDisc =
        ((originalUnitPrice - item.unitPrice) / originalUnitPrice) * 100;
    }
    $("#disc-input").val(existingDisc > 0 ? existingDisc.toFixed(2) : "0");

    setActiveMode("price");
    calculateTotals("price");

    $("#edit-overlay").show();
  });

  function closeOverlay() {
    $("#edit-overlay").hide();
    editIndex = -1;
    editItemId = null;
  }
  $(document).on("click.numpad", "#close-modal", closeOverlay);

  function setActiveMode(mode) {
    activeMode = mode;
    shouldOverwrite = true;

    $("#price-input, #disc-input")
      .removeClass("input-on")
      .addClass("input-off");

    if (mode === "price") {
      $("#price-input").removeClass("input-off").addClass("input-on");
    } else if (mode === "disc") {
      $("#disc-input").removeClass("input-off").addClass("input-on");
    }
  }

  $(document).on("click.numpad", "#price-input", function () {
    setActiveMode("price");
  });
  $(document).on("click.numpad", "#disc-input", function () {
    setActiveMode("disc");
  });

  $(document).on("click.numpad", "#pad-custom", function () {
    isPromoActive = false;
    setActiveMode("disc");
    $("#disc-input").val("");
    shouldOverwrite = false;
    calculateTotals("disc");
  });

  $(document).on("click.numpad", ".promo-btn", function () {
    const d = $(this).data("discount");
    isPromoActive = false;
    setActiveMode("disc");
    $("#disc-input").val(d);
    shouldOverwrite = true;
    calculateTotals("disc");
  });

  $(document).on("click.numpad", ".pad-grid button", function () {
    const val = $(this).data("val");
    if (val === undefined) return;

    const $activeInput =
      activeMode === "price" ? $("#price-input") : $("#disc-input");
    const rawVal = $activeInput.val();
    let currentStr = rawVal !== undefined ? rawVal.toString() : "";

    const item = window.cart.items[editIndex];
    const dbP = item.dbPrice !== undefined ? item.dbPrice : originalUnitPrice;

    if (val === "RESET") {
      if (dbP < originalUnitPrice) {
        isPromoActive = true;
        if (activeMode === "disc") {
          currentStr = "0";
        } else {
          currentStr = dbP.toFixed(2);
        }
      } else {
        isPromoActive = false;
        currentStr = activeMode === "disc" ? "0" : originalUnitPrice.toFixed(2);
      }
      shouldOverwrite = true;
    } else if (val === "BACK") {
      isPromoActive = false;
      if (shouldOverwrite) {
        currentStr = "";
        shouldOverwrite = false;
      } else {
        currentStr = currentStr.slice(0, -1);
      }
    } else {
      isPromoActive = false;
      if (shouldOverwrite) {
        currentStr = val === "." ? "0." : val.toString();
        shouldOverwrite = false;
      } else {
        if (val === "." && currentStr.includes(".")) return;
        currentStr += val;
      }
    }

    $activeInput.val(currentStr);
    calculateTotals(activeMode);
  });

  $(document).on("click.numpad", "#edit-apply", function () {
    if (editIndex === -1) return;
    const targetItem = window.cart.items[editIndex];
    const newPrice = parseFloat($("#price-input").val()) || 0;

    targetItem.unitPrice = newPrice;

    if (!isPromoActive && newPrice < targetItem.originalPrice) {
      targetItem.isCashierOverride = true;
      targetItem.promoRemoved = true;
    } else if (!isPromoActive && newPrice >= targetItem.originalPrice) {
      targetItem.isCashierOverride = false;
      targetItem.promoRemoved = true;
    } else {
      targetItem.isCashierOverride = false;
      targetItem.promoRemoved = false;
    }

    closeOverlay();
    if (typeof window.drawCart === "function") window.drawCart(editIndex);
  });

  $(document).on("click.numpad", ".edit-remove", function () {
    if (editIndex > -1) {
      window.cart.items.splice(editIndex, 1);
      closeOverlay();
      if (typeof window.drawCart === "function") window.drawCart();
    }
  });
})();

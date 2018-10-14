(function () {
  $(document).off(".cart");
  let dbManager = null;
  try {
    dbManager = require("../database.js");
  } catch (err) {}

  window.currentActiveTabId = null;
  window.cart = { items: [], discount: 0, phone: "", total: 0 };
  const fmtNum = (n) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  window.syncCartToDb = function () {
    if (!dbManager || !dbManager.isDbReady()) return;
    window.currentActiveTabId = dbManager.saveTabToDb(
      window.currentActiveTabId,
      window.cart.items,
      window.cart.discount,
      window.cart.phone,
    );
  };

  window.calcTotals = function () {
    let cartSubtotal = 0;
    let totalDiscount = 0;

    window.cart.items.forEach((item) => {
      const origPrice = item.originalPrice || item.unitPrice;
      cartSubtotal += item.qty * origPrice;
      totalDiscount += item.qty * (origPrice - item.unitPrice);
    });

    window.cart.discount = totalDiscount;
    window.cart.total = cartSubtotal - window.cart.discount;

    $("#sub-total span:last-child").text(`₹ ${fmtNum(cartSubtotal)}`);
    $("#disc-val span:last-child").text(`- ₹ ${fmtNum(window.cart.discount)}`);
    $("#grand-total").text(`₹ ${fmtNum(window.cart.total)}`);

    window.syncCartToDb();
    window.drawTabs();
  };

  window.drawTabs = function () {
    const tabList = $("#tab-list").empty();
    if (!dbManager || !dbManager.isDbReady()) return;

    const dbOrders = dbManager.getParkedOrders();
    dbOrders.forEach((order, index) => {
      const orderData = JSON.parse(order.cart_json);
      const isActive = window.currentActiveTabId === order.id;

      let labelText = `Order ${index + 1}`;
      if (orderData.items && orderData.items.length > 0) {
        const firstItem = orderData.items[0];
        const brandText =
          firstItem.brand &&
          firstItem.brand !== "Item" &&
          firstItem.brand !== "N/A"
            ? firstItem.brand
            : firstItem.name.split(" ")[0];
        labelText = `${brandText}${orderData.items.length > 1 ? " +" + (orderData.items.length - 1) : ""}`;
      }

      tabList.append(
        `<button class="${isActive ? "tab-active" : "tab-idle"}" data-db-id="${order.id}" data-json='${order.cart_json}'><span class="tab-title" title="${labelText}">${labelText}</span></button>`,
      );
    });
  };

  window.drawCart = function (highlightIdx = -1) {
    const cartList = $("#cart-list").empty();

    if (window.cart.items.length === 0) {
      cartList.append(
        '<li style="padding: 1.5rem; text-align: center; color: #a0aab2; font-style: italic;">Cart is empty</li>',
      );
      $("#phone-input").val(window.cart.phone || "");
      window.calcTotals();
      window.drawTabs();
      if (typeof window.syncGridStock === "function") window.syncGridStock();
      return;
    }

    $("#phone-input").val(window.cart.phone || "");

    window.cart.items.forEach((item, index) => {
      const lineTotal = item.qty * item.unitPrice;
      const originalPrice = item.originalPrice || item.unitPrice;
      const origLineTotal = item.qty * originalPrice;

      let discountHtml = "";
      let oldPriceHtml = "";

      if (item.unitPrice < originalPrice) {
        const savedAmount = origLineTotal - lineTotal;
        let activeTag = "Discount";

        if (item.isCashierOverride) {
          let discPct =
            ((originalPrice - item.unitPrice) / originalPrice) * 100;
          let pctStr =
            discPct % 1 === 0 ? discPct.toFixed(0) : discPct.toFixed(1);
          activeTag = `Cashier ${pctStr}%`;
        } else if (item.promoName && !item.promoRemoved) {
          activeTag = item.promoName;
        }

        discountHtml = `
          <div class="disc-box">
            <span class="disc-tag">
              ${activeTag}
              <button class="del-disc" data-index="${index}">&times;</button>
            </span>
            <span class="saved-lbl">Saved ₹ ${fmtNum(savedAmount)}</span>
          </div>
        `;
        oldPriceHtml = `<div class="old-price">₹ ${fmtNum(origLineTotal)}</div>`;
      }

      let attrMap = {};
      if (typeof item.attributes === "string") {
        try {
          attrMap = JSON.parse(item.attributes);
        } catch (e) {}
      } else if (item.attributes) {
        attrMap = item.attributes;
      }

      let specsHtml = "";
      if (Object.keys(attrMap).length > 0) {
        specsHtml = `<div class="cart-specs">`;
        for (let propKey in attrMap) {
          specsHtml += `<span class="cart-spec-box"><span class="cart-spec-lbl">${propKey}:</span> ${attrMap[propKey]}</span>`;
        }
        specsHtml += `</div>`;
      }

      const rowClass = index === highlightIdx ? "flash-row" : "cart-row";

      cartList.append(`
        <li class="${rowClass}" data-cart-index="${index}">
          <div style="display: flex; flex-direction: column; width: 100%;">
            
            <div class="item-left">
              <div class="item-name">${item.name} <span class="edit-icon">&#9998;</span></div>
              ${specsHtml}
              ${discountHtml}
            </div>

            <div class="item-foot">
              <div class="price-box">
                 ${oldPriceHtml}
                 <span class="${item.unitPrice < originalPrice ? "sale-price" : "reg-price"}">₹ ${fmtNum(lineTotal)}</span>
              </div>
              <div class="step-box">
                <button class="step-minus" data-index="${index}">-</button>
                <span class="step-val">${item.qty}</span>
                <button class="step-plus" data-index="${index}">+</button>
              </div>
            </div>

          </div>
        </li>
      `);
    });

    window.calcTotals();
    if (typeof window.syncGridStock === "function") window.syncGridStock();
    if (typeof window.syncNumpadWithCart === "function")
      window.syncNumpadWithCart();

    if (highlightIdx !== -1) {
      const targetEl = document.querySelector(
        `.cart-row[data-cart-index="${highlightIdx}"], .flash-row[data-cart-index="${highlightIdx}"]`,
      );
      if (targetEl)
        targetEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  $(document).on("click.cart", ".del-disc", function (e) {
    e.stopPropagation();
    const itemIndex = $(this).data("index");
    const targetItem = window.cart.items[itemIndex];
    if (!targetItem) return;

    targetItem.unitPrice = targetItem.originalPrice || targetItem.dbPrice;
    targetItem.isCashierOverride = false;
    targetItem.promoRemoved = true;
    window.drawCart(-1);
  });

  $(document).on("click.cart", ".step-minus, .step-plus", async function (e) {
    e.stopPropagation();
    const itemIndex = $(this).data("index");
    const targetItem = window.cart.items[itemIndex];
    if (!targetItem) return;

    if ($(this).hasClass("step-plus")) {
      let liveDbStock = 999;
      let parkedElsewhere = 0;
      if (dbManager) {
        liveDbStock = dbManager.getLiveStock(targetItem.id);
        dbManager.getParkedOrders().forEach((order) => {
          if (
            window.currentActiveTabId &&
            order.id === window.currentActiveTabId
          )
            return;
          const matchItem = (JSON.parse(order.cart_json).items || []).find(
            (i) => parseInt(i.id, 10) === parseInt(targetItem.id, 10),
          );
          if (matchItem) parkedElsewhere += parseInt(matchItem.qty, 10);
        });
      }

      if (targetItem.qty >= liveDbStock - parkedElsewhere) {
        if (window.appAlert)
          await window.appAlert(
            "Stock Limit",
            "No more available stock for this item.",
          );
        return;
      }
      targetItem.qty++;
    } else {
      targetItem.qty--;
      if (targetItem.qty <= 0) {
        window.cart.items.splice(itemIndex, 1);

        if ($("#edit-item-modal").length) $("#edit-item-modal").hide();
      }
    }
    window.drawCart(-1);
  });

  $(document).on("click.cart", "#add-tab", function () {
    window.currentActiveTabId = null;
    window.cart = { items: [], discount: 0, phone: "", total: 0 };
    window.drawCart(-1);
  });

  $(document).on("click.cart", ".tab-idle", function () {
    window.currentActiveTabId = $(this).data("db-id");
    const parsedCart = JSON.parse($(this).attr("data-json"));
    window.cart = {
      items: [],
      discount: 0,
      phone: "",
      total: 0,
      ...parsedCart,
    };
    window.drawCart(-1);
  });

  $(document).on("click.cart", "#clear-cart", async function () {
    let confirmDelete = true;

    if (window.appAlert) {
      confirmDelete = await window.appAlert(
        "Delete Order",
        "Are you sure you want to clear this cart?",
        true,
      );
    }

    if (!confirmDelete) return;

    if (dbManager && window.currentActiveTabId) {
      dbManager.deleteParkedOrder(window.currentActiveTabId);
      const fallbackTab = dbManager.getParkedOrders()[0];
      window.currentActiveTabId = fallbackTab ? fallbackTab.id : null;
      const parsedCart = fallbackTab ? JSON.parse(fallbackTab.cart_json) : {};
      window.cart = {
        items: [],
        discount: 0,
        phone: "",
        total: 0,
        ...parsedCart,
      };
      window.drawCart(-1);
    }
  });

  $(document).on("input.cart", "#phone-input", function () {
    window.cart.phone = $(this).val();
    window.syncCartToDb();
  });

  window.checkoutSuccessClear = function () {
    if (dbManager && window.currentActiveTabId) {
      dbManager.deleteParkedOrder(window.currentActiveTabId);
      const fallbackTab = dbManager.getParkedOrders()[0];
      window.currentActiveTabId = fallbackTab ? fallbackTab.id : null;
      const parsedCart = fallbackTab ? JSON.parse(fallbackTab.cart_json) : {};
      window.cart = {
        items: [],
        discount: 0,
        phone: "",
        total: 0,
        ...parsedCart,
      };
      window.drawCart(-1);
    }
  };

  function initCart() {
    const checkDb = setInterval(() => {
      if (dbManager && dbManager.isDbReady()) {
        clearInterval(checkDb);
        const fallbackTab = dbManager.getParkedOrders()[0];
        window.currentActiveTabId = fallbackTab ? fallbackTab.id : null;
        const parsedCart = fallbackTab ? JSON.parse(fallbackTab.cart_json) : {};
        window.cart = {
          items: [],
          discount: 0,
          phone: "",
          total: 0,
          ...parsedCart,
        };
        window.drawCart();
      }
    }, 50);
  }
  initCart();
})();

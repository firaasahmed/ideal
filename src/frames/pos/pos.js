(function () {
  $(document).off(".pos");

  let dbManager = null;
  try {
    dbManager = require("../database.js");
  } catch (err) {}

  let activeBrandFilter = "All Brands";
  let activeCategoryFilter = "All Categories";
  let activeSearchTerm = "";

  $("#cart-box").load("components/cart/cart.html", () =>
    $.getScript("components/cart/cart.js"),
  );
  $("#pay-box").load("components/checkout/checkout.html", () =>
    $.getScript("components/checkout/checkout.js"),
  );
  $("#edit-box").load("components/modal/edit-modal/edit-modal.html", () => {
    $("#numpad-box").load("components/numpad/numpad.html", () =>
      $.getScript("components/numpad/numpad.js"),
    );
  });

  window.scrubGhostItems = function () {
    if (!window.cart || !window.cart.items || !dbManager) return;

    const validInventory = dbManager.getInventory();
    const validIds = new Set(validInventory.map((i) => parseInt(i.id, 10)));
    const originalLength = window.cart.items.length;

    window.cart.items = window.cart.items.filter((item) =>
      validIds.has(parseInt(item.id, 10)),
    );

    if (window.cart.items.length !== originalLength) {
      if (typeof window.drawCart === "function") window.drawCart();
      if (
        window.currentActiveTabId &&
        typeof dbManager.saveTabToDb === "function"
      ) {
        dbManager.saveTabToDb(
          window.currentActiveTabId,
          window.cart.items,
          window.cart.discount || 0,
        );
      }
    }
  };

  function populateFilters() {
    if (!dbManager) return;
    const detailedList = dbManager.getDetailedInventory();

    const brandsSet = new Set();
    const categoriesSet = new Set();

    detailedList.forEach((p) => {
      if (p.brand && p.brand !== "N/A") brandsSet.add(p.brand);
      if (p.category && p.category !== "N/A") categoriesSet.add(p.category);
    });

    const brandList = $("#brand-list").empty();
    brandList.append(
      `<button class="${activeBrandFilter === "All Brands" ? "brand-active" : "brand-idle"}">All Brands</button>`,
    );
    brandsSet.forEach((b) => {
      brandList.append(
        `<button class="${activeBrandFilter === b ? "brand-active" : "brand-idle"}">${b}</button>`,
      );
    });

    const catList = $("#cat-list").empty();
    if (catList.length) {
      catList.append(
        `<button class="${activeCategoryFilter === "All Categories" ? "cat-active" : "cat-idle"}">All Categories</button>`,
      );
      categoriesSet.forEach((c) => {
        catList.append(
          `<button class="${activeCategoryFilter === c ? "cat-active" : "cat-idle"}">${c}</button>`,
        );
      });
    }
  }

  $.getScript("components/item-card/item-card.js", async function () {
    const itemGrid = $("#item-grid").empty();
    if (!dbManager)
      return itemGrid.append("<p>🚨 Error: Cannot find database.js.</p>");

    try {
      await dbManager.initDatabase();
      window.scrubGhostItems();
      populateFilters();
      drawGrid(dbManager.getInventory());
    } catch (err) {
      console.error(err);
    }
  });

  function drawGrid(itemsArray) {
    const itemGrid = $("#item-grid").empty();
    let filteredList = itemsArray;

    const detailedInfo = dbManager ? dbManager.getDetailedInventory() : [];
    const brandMap = {};
    const catMap = {};

    detailedInfo.forEach((p) => {
      p.variants.forEach((v) => {
        brandMap[v.id] = p.brand;
        catMap[v.id] = p.category;
      });
    });

    if (activeBrandFilter !== "All Brands" && dbManager) {
      filteredList = filteredList.filter(
        (i) => brandMap[i.id] === activeBrandFilter,
      );
    }

    if (activeCategoryFilter !== "All Categories" && dbManager) {
      filteredList = filteredList.filter(
        (i) => catMap[i.id] === activeCategoryFilter,
      );
    }

    if (activeSearchTerm) {
      const searchStr = activeSearchTerm.toLowerCase();
      filteredList = filteredList.filter((i) => {
        const bName = brandMap[i.id] ? brandMap[i.id].toLowerCase() : "";
        const cName = catMap[i.id] ? catMap[i.id].toLowerCase() : "";
        return (
          i.name.toLowerCase().includes(searchStr) ||
          i.sku.toLowerCase().includes(searchStr) ||
          bName.includes(searchStr) ||
          cName.includes(searchStr)
        );
      });
    }

    filteredList.forEach((item) => {
      item.brand = brandMap[item.id] || "Generic";
      itemGrid.append(window.buildItemCard(item));
    });

    if (typeof window.syncGridStock === "function") window.syncGridStock();
  }

  window.refreshInventory = function () {
    if (dbManager) {
      window.scrubGhostItems();
      populateFilters();
      drawGrid(dbManager.getInventory());
    }
  };

  $(document).on("click.pos", "#brand-list button", function () {
    activeBrandFilter = $(this).text();
    window.refreshInventory();
  });

  $(document).on("click.pos", "#cat-list button", function () {
    activeCategoryFilter = $(this).text();
    window.refreshInventory();
  });

  $(document).on("input.pos", "#pos-search", function () {
    activeSearchTerm = $(this).val();
    window.refreshInventory();
  });

  window.syncGridStock = function () {
    if (!dbManager) return;
    const parkedList = dbManager.getParkedOrders();

    $("#item-grid .item-card, #item-grid .card-dead").each(function () {
      const cardId = parseInt($(this).attr("data-id"), 10);
      const liveDbStock = dbManager.getLiveStock(cardId);

      let heldQty = 0;
      parkedList.forEach((order) => {
        if (window.currentActiveTabId && order.id === window.currentActiveTabId)
          return;

        const parsedJson = JSON.parse(order.cart_json);
        const itemArray = Array.isArray(parsedJson)
          ? parsedJson
          : parsedJson.items || [];

        const matchedItem = itemArray.find(
          (i) => parseInt(i.id, 10) === cardId,
        );
        if (matchedItem) heldQty += parseInt(matchedItem.qty, 10);
      });

      let cartQty = 0;
      if (window.cart && window.cart.items) {
        const matchedItem = window.cart.items.find(
          (i) => parseInt(i.id, 10) === cardId,
        );
        if (matchedItem) cartQty = parseInt(matchedItem.qty, 10);
      }

      const remainingStock = liveDbStock - heldQty - cartQty;
      $(this).attr("data-available", remainingStock);

      const cartBadge = $(this).find(".cart-badge");
      if (cartQty > 0) {
        cartBadge.find(".cart-count").text(cartQty);
        cartBadge.show();
      } else {
        cartBadge.hide();
      }

      const heldBadge = $(this).find(".held-badge");
      if (heldQty > 0) {
        heldBadge.find(".held-count").text(heldQty);
        heldBadge.show();
      } else {
        heldBadge.hide();
      }

      $(this).find(".stock-val").text(remainingStock);

      if (remainingStock <= 0) {
        $(this).attr("class", "card-dead");
        $(this).find(".stock-val").css("color", "#d63031");
      } else {
        $(this).attr("class", "item-card");
        $(this).find(".stock-val").css("color", "#2d3436");
      }
    });
  };

  $(document).on("click.pos", ".item-card", async function () {
    if ($(this).closest("#edit-card").length) return;

    const itemId = parseInt($(this).attr("data-id"), 10);
    const itemName = $(this).attr("data-name");
    const itemPrice = parseFloat($(this).attr("data-price"));

    const attrString = $(this).attr("data-attrs");
    let parsedAttrs = {};
    try {
      if (attrString) parsedAttrs = JSON.parse(decodeURIComponent(attrString));
    } catch (e) {}

    const remainingQty = parseInt(
      $(this).attr("data-available") || $(this).find(".stock-val").text(),
      10,
    );

    if (remainingQty <= 0) {
      if (window.appAlert)
        await window.appAlert(
          "Stock Limit",
          "Cannot add more! No available stock left.",
        );
      return;
    }

    let dbDiscName = "";
    let origPrice = itemPrice;
    let dbBrand = "Item";
    let dbSku = "";
    let dbCost = 0;

    if (dbManager && typeof dbManager.getDetailedInventory === "function") {
      const detailedList = dbManager.getDetailedInventory();
      for (let prod of detailedList) {
        const variantObj = prod.variants.find((v) => v.id === itemId);
        if (variantObj) {
          dbDiscName = variantObj.discount_name || "";
          origPrice = variantObj.sp;
          dbBrand = prod.brand || "Item";
          dbSku = variantObj.sku || "";
          dbCost = variantObj.dbCost || 0;
          break;
        }
      }
    }

    const existItem = window.cart.items.find(
      (i) => parseInt(i.id, 10) === itemId,
    );
    let targetIndex = -1;

    if (existItem) {
      existItem.qty++;
      targetIndex = window.cart.items.indexOf(existItem);
    } else {
      window.cart.items.push({
        id: itemId,
        name: itemName,
        sku: dbSku,
        attributes: parsedAttrs,
        brand: dbBrand,
        qty: 1,
        originalPrice: origPrice,
        dbPrice: itemPrice,
        unitPrice: itemPrice,
        promoName: dbDiscName,
        unitCost: dbCost,
      });
      targetIndex = window.cart.items.length - 1;
    }

    if (typeof window.drawCart === "function") window.drawCart(targetIndex);
    if (typeof window.syncGridStock === "function") window.syncGridStock();
  });
})();

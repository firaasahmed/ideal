(function () {
  try {
    window.dbManager = require("../database.js");
  } catch (err) {
    console.error("Database failed to load:", err);
  }

  window.inventoryData = [];
  window.isFlattenedView = false;
  window.isEditMode = false;

  let filesLoadedCount = 0;
  function checkDependenciesLoaded() {
    filesLoadedCount++;
    if (filesLoadedCount === 7) {
      if (window.reloadTable) window.reloadTable();
    }
  }

  $("#sidebar-container").load(
    "components/inventory-sidebar/inventory-sidebar.html",
    function () {
      $.getScript(
        "components/inventory-sidebar/inventory-sidebar.js",
        checkDependenciesLoaded,
      );
    },
  );
  $("#top-buttons-container").load(
    "components/inventory-ribbon/inventory-ribbon.html",
    function () {
      $.getScript(
        "components/inventory-ribbon/inventory-ribbon.js",
        checkDependenciesLoaded,
      );
    },
  );
  $("#table-container").load(
    "components/inventory-table/inventory-table.html",
    function () {
      $.getScript(
        "components/inventory-table/inventory-table.js",
        checkDependenciesLoaded,
      );
    },
  );

  let popupsContainer = $("#all-popups-container");

  $.get(
    "components/modal/add-product/add-product.html",
    function (htmlContent) {
      popupsContainer.append(htmlContent);
      $.getScript(
        "components/modal/add-product/add-product.js",
        checkDependenciesLoaded,
      );
    },
  );
  $.get("components/modal/add-stock/add-stock.html", function (htmlContent) {
    popupsContainer.append(htmlContent);
    $.getScript(
      "components/modal/add-stock/add-stock.js",
      checkDependenciesLoaded,
    );
  });
  $.get(
    "components/modal/manage-discounts/manage-discounts.html",
    function (htmlContent) {
      popupsContainer.append(htmlContent);
      $.getScript(
        "components/modal/manage-discounts/manage-discounts.js",
        checkDependenciesLoaded,
      );
    },
  );
  $.get("components/modal/apply-sale/apply-sale.html", function (htmlContent) {
    popupsContainer.append(htmlContent);
    $.getScript(
      "components/modal/apply-sale/apply-sale.js",
      checkDependenciesLoaded,
    );
  });

  window.reloadTable = function () {
    if (
      window.dbManager &&
      typeof window.dbManager.getDetailedInventory === "function"
    ) {
      window.inventoryData = window.dbManager.getDetailedInventory();
      if (window.updateSidebarDropdowns) window.updateSidebarDropdowns();
    }
    if (window.buildInventoryTable) window.buildInventoryTable();
  };
})();

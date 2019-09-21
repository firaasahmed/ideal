/* inventory-sidebar.js */
(function () {
  window.updateSidebarDropdowns = function () {
    const categoriesSet = new Set([
      "All Categories",
      "Footwear",
      "Apparel",
      "Accessories",
      "Other",
    ]);
    const brandsSet = new Set(["All Brands"]);

    if (window.inventoryData) {
      window.inventoryData.forEach(function (product) {
        if (product.category && product.category.trim() !== "")
          categoriesSet.add(product.category);
        if (product.brand && product.brand.trim() !== "")
          brandsSet.add(product.brand);
      });
    }

    const currentCategory = $("#filter-category").val();
    const currentBrand = $("#filter-brand").val();

    const categorySelect = $("#filter-category").empty();
    categoriesSet.forEach(function (category) {
      categorySelect.append(
        '<option value="' + category + '">' + category + "</option>"
      );
    });
    categorySelect.val(
      categoriesSet.has(currentCategory) ? currentCategory : "All Categories"
    );

    const brandSelect = $("#filter-brand").empty();
    brandsSet.forEach(function (brand) {
      brandSelect.append(
        '<option value="' + brand + '">' + brand + "</option>"
      );
    });
    brandSelect.val(brandsSet.has(currentBrand) ? currentBrand : "All Brands");
  };

  $(document).off(
    "input.side change.side",
    ".inv-search-bar, .inv-filter-dropdown"
  );
  $(document).on(
    "input.side change.side",
    ".inv-search-bar, .inv-filter-dropdown",
    function () {
      if (window.buildInventoryTable) {
        window.buildInventoryTable();
      }
    }
  );


  window.updateBackupStatus = function () {
    const lastTime = localStorage.getItem("pos_last_backup") || "Never";
    $("#last-backup-time").text(lastTime);
  };

  $(document).off("click.backup", "#sidebar-run-backup-btn");
  $(document).on("click.backup", "#sidebar-run-backup-btn", async function () {
    const btn = $(this);
    btn.text("Running...").prop("disabled", true);

    if (
      window.dbManager &&
      typeof window.dbManager.forceBackup === "function"
    ) {
      const result = await window.dbManager.forceBackup();

      if (result && result.success) {
        btn.text("Success!").css({
          background: "#00b894",
          color: "#ffffff",
          "border-color": "#00b894",
        });
        window.updateBackupStatus();

        if (window.appAlert) {
          window.appAlert(
            "Backup Successful",
            "Database and CSVs saved to your local backup folder."
          );
        }

        setTimeout(function () {
          btn
            .text("Run Backup Now")
            .css({
              background: "#f4f7f6",
              color: "#2d3436",
              "border-color": "#e1e5ea",
            })
            .prop("disabled", false);
        }, 3000);
      } else {
        btn.text("Failed").css({ background: "#e81123", color: "#ffffff" });
        if (window.appAlert)
          window.appAlert(
            "Backup Failed",
            "Unable to write to the backup folder. Check folder permissions."
          );

        setTimeout(function () {
          btn
            .text("Run Backup Now")
            .css({
              background: "#f4f7f6",
              color: "#2d3436",
              "border-color": "#e1e5ea",
            })
            .prop("disabled", false);
        }, 3000);
      }
    }
  });


  $(document).off("click.import", "#sidebar-import-csv-btn");
  $(document).on("click.import", "#sidebar-import-csv-btn", function () {
    $("#csv-file-input").click();
  });

  $(document).off("change.import", "#csv-file-input");
  $(document).on("change.import", "#csv-file-input", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (event) {
      const text = event.target.result;
      const rows = text.split("\n").map((row) => row.split(","));
      rows.shift();

      if (
        window.dbManager &&
        typeof window.dbManager.bulkImport === "function"
      ) {
        const result = await window.dbManager.bulkImport(rows);
        if (result.success) {
          if (window.appAlert)
            window.appAlert(
              "Import Success",
              `Successfully added ${result.count} items to inventory.`
            );
          if (window.reloadTable) window.reloadTable();
        } else {
          if (window.appAlert)
            window.appAlert(
              "Import Failed",
              "The CSV format is incorrect. Please use: Name, SKU, Category, Brand, Price, Stock"
            );
        }
      }
      $("#csv-file-input").val("");
    };
    reader.readAsText(file);
  });

  setTimeout(window.updateBackupStatus, 200);
})();
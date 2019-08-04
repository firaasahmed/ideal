(function () {
  if (typeof window.isFlattenedView === "undefined") {
    window.isFlattenedView = false;
  }

  window.currentPage = window.currentPage || 1;
  const itemsPerPage = 7;

  window.buildInventoryTable = function () {
    const tableBody = $("#inventory-tbody").empty();
    const pageFoot = $("#page-foot").empty();

    const searchTerm = $(".inv-search-bar").val()
      ? $(".inv-search-bar").val().toLowerCase().trim()
      : "";
    const activeCategory = $("#filter-category").val() || "All Categories";
    const activeBrand = $("#filter-brand").val() || "All Brands";
    const activeGender = $("#filter-gender").val() || "All Genders";
    const activeQuickFilter = $(".quick-filter-btn.active-filter")
      .text()
      .trim();

    let filteredData = window.inventoryData.filter((product) => {
      let matchesSearch = true;
      if (searchTerm) {
        matchesSearch =
          product.name.toLowerCase().includes(searchTerm) ||
          product.sku.toLowerCase().includes(searchTerm) ||
          product.variants.some((variant) => {
            let attrText = variant.attributes
              ? Object.values(variant.attributes).join(" ").toLowerCase()
              : "";
            return (
              variant.sku.toLowerCase().includes(searchTerm) ||
              attrText.includes(searchTerm)
            );
          });
      }

      let matchesCategory =
        activeCategory === "All Categories" ||
        product.category === activeCategory;
      let matchesBrand =
        activeBrand === "All Brands" || product.brand === activeBrand;

      let matchesGender = true;
      if (activeGender !== "All Genders") {
        if (activeGender === "N/A") {
          matchesGender = product.variants.some(
            (v) => !v.attributes || !v.attributes["Gender"],
          );
        } else {
          matchesGender = product.variants.some(
            (v) =>
              v.attributes &&
              v.attributes["Gender"] &&
              v.attributes["Gender"].toLowerCase() ===
                activeGender.toLowerCase(),
          );
        }
      }

      let totalStock = product.variants.reduce(
        (sum, variant) => sum + variant.qty,
        0,
      );
      let matchesQuickFilter = true;

      if (activeQuickFilter === "On Sale")
        matchesQuickFilter = product.has_discounts;
      if (activeQuickFilter === "Out of Stock")
        matchesQuickFilter = totalStock === 0;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesBrand &&
        matchesGender &&
        matchesQuickFilter
      );
    });

    let viewData = [];
    if (window.isFlattenedView) {
      filteredData.forEach((product) => {
        let brandStr =
          product.brand &&
          product.brand !== "Generic" &&
          product.brand !== "N/A"
            ? `${product.brand} `
            : "";
        let fullName = `${brandStr}${product.name}`;
        product.variants.forEach((variant) => {
          viewData.push({
            product: product,
            variant: variant,
            fullName: fullName,
          });
        });
      });
    } else {
      viewData = filteredData;
    }

    const totalPages = Math.ceil(viewData.length / itemsPerPage);
    if (window.currentPage > totalPages) window.currentPage = totalPages || 1;
    if (window.currentPage < 1) window.currentPage = 1;

    const paginatedData = viewData.slice(
      (window.currentPage - 1) * itemsPerPage,
      window.currentPage * itemsPerPage,
    );

    if (window.isFlattenedView) {
      $("#variant-header-text").text("Attributes");
      $("#th-mrp").text("Last Supplier Price").show();
      $("#th-sp").text("Selling Price").show();

      paginatedData.forEach((item) => {
        let product = item.product;
        let variant = item.variant;
        let fullName = item.fullName;

        let attrStr = "";
        if (variant.attributes) {
          attrStr = Object.entries(variant.attributes)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
        }
        if (!attrStr) attrStr = "Standard";

        let attrHtml = `<span style="font-weight:700; font-size: 0.75rem;">${attrStr}</span>`;

        let mrpHtml = `₹${variant.dbCost || 0}`;

        let spHtml = window.isEditMode
          ? `₹<span class="editable-cell" contenteditable="true" data-vid="${variant.id}" data-field="sp">${variant.sp}</span>`
          : variant.discount_id
            ? `<div class="stacked-text"><div class="mrp-row"><span class="mrp-text">₹${variant.sp}</span><span class="disc-tag">${variant.discount_name}</span></div><span class="sp-text sale-text">₹${variant.active_sp}</span></div>`
            : `<span class="sp-text">₹${variant.sp}</span>`;

        let qtyHtml = variant.qty;

        let tableRow = `
          <tr class="main-product-row" data-product-id="${product.id}" data-variant-id="${variant.id}">
            <td><input type="checkbox" class="row-checkbox"></td>
            <td>
              <div class="product-name-cell">${fullName}</div>
              <div style="font-size: 0.75rem; color: #636e72; margin-top: 0.25rem; font-family: monospace;">SKU: ${variant.sku} &bull; HSN: ${product.hsn || "N/A"}</div>
            </td>
            <td><div class="stacked-text"><span class="primary-text">${product.brand || "N/A"}</span></div></td>
            <td>${attrHtml}</td>
            <td style="text-align: right; color: #636e72; font-weight: 600;">${mrpHtml}</td>
            <td style="text-align: right;">${spHtml}</td>
            <td style="text-align: right; font-weight: 800; color: #2d3436; font-size: 1rem;">${qtyHtml}</td>
            <td style="text-align: right;">
              <button class="add-stock-btn" data-pid="${product.id}" ${window.isEditMode ? "disabled" : ""}>Add Stock</button>
            </td>
          </tr>
        `;
        tableBody.append(tableRow);
      });
    } else {
      $("#variant-header-text").text("Variants");
      $("#th-mrp").text("Base MRP").show();
      $("#th-sp").text("Base Price").show();

      paginatedData.forEach((product, index) => {
        let brandStr =
          product.brand &&
          product.brand !== "Generic" &&
          product.brand !== "N/A"
            ? `${product.brand} `
            : "";
        let fullName = `${brandStr}${product.name}`;

        let totalStock = 0;
        let drawerId = `drawer-${index}`;

        let drawerHtml = '<div class="variant-drawer">';
        product.variants.forEach((variant) => {
          totalStock += variant.qty;
          let stockClass = variant.qty === 0 ? "out-of-stock" : "in-stock";
          let stockText =
            variant.qty === 0 ? "Out of Stock" : `${variant.qty} left`;

          let priceText = variant.discount_id
            ? `<span class="sale-text" style="margin-right: 0.25rem;">₹${variant.active_sp}</span> <span style="text-decoration: line-through; color: #a0aab2; font-size: 0.75rem;">₹${variant.sp}</span>`
            : `₹${variant.sp}`;

          let tagsHtml = `<div class="tag-list">`;
          if (variant.attributes) {
            for (let propName in variant.attributes) {
              tagsHtml += `<div class="tag-row"><span class="tag-label">${propName}:</span><span class="v-tag">${variant.attributes[propName]}</span></div>`;
            }
          }
          tagsHtml += `<div class="tag-row"><span class="tag-label">Price:</span><span class="v-tag">${priceText}</span><span class="v-stock ${stockClass}">${stockText}</span></div>`;
          tagsHtml += `</div>`;

          drawerHtml += `<div class="variant-drawer-item">${tagsHtml}</div>`;
        });
        drawerHtml += "</div>";

        let mrpHtml = window.isEditMode
          ? `₹<span class="editable-cell" contenteditable="true" data-pid="${product.id}" data-field="mrp">${product.mrp}</span>`
          : `₹${product.mrp}`;
        let spHtml = window.isEditMode
          ? `₹<span class="editable-cell" contenteditable="true" data-pid="${product.id}" data-field="sp">${product.sp}</span>`
          : `₹${product.sp}`;

        let mainRow = `
          <tr class="main-product-row" data-product-id="${product.id}">
            <td><input type="checkbox" class="row-checkbox"></td>
            <td>
              <div class="product-name-cell">${fullName}</div>
              <div style="font-size: 0.75rem; color: #636e72; margin-top: 0.25rem; font-family: monospace;">Base SKU: ${product.sku} &bull; HSN: ${product.hsn || "N/A"}</div>
            </td>
            <td><div class="stacked-text"><span class="primary-text">${product.brand || "N/A"}</span></div></td>
            <td><button class="variant-toggle-btn" data-target="${drawerId}">${product.variants.length} Variants <span style="font-size: 0.5rem; margin-left: 0.25rem;">&#9660;</span></button></td>
            
            <td style="text-align: right; color: #636e72; font-weight: 600;">${mrpHtml}</td>
            <td style="text-align: right; font-weight: 800; color: #0984e3;">${spHtml}</td>

            <td style="text-align: right; font-weight: 800; color: #2d3436; font-size: 1rem;">${totalStock}</td>
            <td style="text-align: right;">
                <button class="add-stock-btn" data-pid="${product.id}" ${window.isEditMode ? "disabled" : ""}>Add Stock</button>
            </td>
          </tr>
        `;

        tableBody.append(mainRow);
        tableBody.append(
          `<tr id="${drawerId}" class="variant-row" style="display: none;"><td colspan="8">${drawerHtml}</td></tr>`,
        );
      });
    }

    if (totalPages > 1) {
      let pHTML = `<button class="page-btn" data-page="${window.currentPage - 1}" ${window.currentPage === 1 ? "disabled" : ""}>Prev</button>`;
      for (let i = 1; i <= totalPages; i++) {
        if (
          i === 1 ||
          i === totalPages ||
          (i >= window.currentPage - 1 && i <= window.currentPage + 1)
        ) {
          pHTML += `<button class="page-btn ${i === window.currentPage ? "active-page" : ""}" data-page="${i}">${i}</button>`;
        }
      }
      pHTML += `<button class="page-btn" data-page="${window.currentPage + 1}" ${window.currentPage === totalPages ? "disabled" : ""}>Next</button>`;
      pageFoot.html(pHTML);
    }

    $("#total-results-text").text(`Showing ${viewData.length} items`);

    $("#toggle-view-btn").text(
      window.isFlattenedView ? "Group Variants" : "Separate Variants",
    );
  };

  $(document).off(".invTable");

  $(document).on("click.invTable", ".page-btn", function () {
    window.currentPage = parseInt($(this).data("page"));
    window.buildInventoryTable();
  });

  $(document).on("input.invTable", ".inv-search-bar", function () {
    window.currentPage = 1;
    window.buildInventoryTable();
  });

  $(document).on("click.invTable", ".quick-filter-btn", function () {
    $(".quick-filter-btn").removeClass("active-filter");
    $(this).addClass("active-filter");
    window.currentPage = 1;
    window.buildInventoryTable();
  });

  $(document).on("keydown.invTable", ".editable-cell", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      $(this).blur();
    }
  });

  $(document).on("blur.invTable", ".editable-cell", function () {
    let numericValue = $(this)
      .text()
      .replace(/[^0-9.]/g, "");
    if (numericValue === "") numericValue = "0";
    $(this).text(numericValue);
  });

  window.getSelectedProductIds = function () {
    const selectedIds = new Set();
    $(".row-checkbox:checked").each(function () {
      const prodId = $(this).closest("tr").data("product-id");
      if (prodId) selectedIds.add(prodId);
    });
    return Array.from(selectedIds);
  };

  window.getSelectedVariantIds = function () {
    const selectedIds = new Set();
    $(".row-checkbox:checked").each(function () {
      const varId = $(this).closest("tr").data("variant-id");
      if (varId) selectedIds.add(varId);
    });
    return Array.from(selectedIds);
  };

  $(document).on("click.invTable", "#export-csv-btn", function () {
    let csvData =
      "Product Name,Brand,Category,Variant SKU,Attributes,MRP,Selling Price,Stock\n";
    window.inventoryData.forEach((prod) => {
      prod.variants.forEach((varObj) => {
        let attrStr = varObj.attributes
          ? Object.entries(varObj.attributes)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" | ")
          : "";
        let rowText = `"${prod.name}","${prod.brand || ""}","${prod.category || ""}","${varObj.sku}","${attrStr}",${varObj.mrp},${varObj.sp},${varObj.qty}`;
        csvData += rowText + "\n";
      });
    });
    let fileBlob = new Blob([csvData], { type: "text/csv" });
    let blobUrl = URL.createObjectURL(fileBlob);
    let linkTag = document.createElement("a");
    linkTag.href = blobUrl;
    linkTag.download = "inventory_export.csv";
    linkTag.click();
  });

  $(document).on("click.invTable", "#inline-edit-btn", function () {
    if (!window.isEditMode) {
      window.isEditMode = true;
      $(this).text("Save Changes").addClass("save-edit-mode");
      $("body").addClass("is-editing");
      $("#toggle-view-btn").prop("disabled", true);
      window.buildInventoryTable();
    } else {
      let pendingVariantEdits = {};
      let pendingProductEdits = {};

      $(".editable-cell").each(function () {
        let varId = $(this).data("vid");
        let prodId = $(this).data("pid");
        let fieldName = $(this).data("field");
        let rawText = $(this).text().trim();
        let val = parseFloat(rawText.replace(/[^0-9.]/g, "")) || 0;

        if (varId) {
          if (!pendingVariantEdits[varId]) pendingVariantEdits[varId] = {};
          pendingVariantEdits[varId][fieldName] = val;
        } else if (prodId) {
          if (!pendingProductEdits[prodId]) pendingProductEdits[prodId] = {};
          pendingProductEdits[prodId][fieldName] = val;
        }
      });

      let bulkData = [];

      for (let varIdStr in pendingVariantEdits) {
        let varId = parseInt(varIdStr);
        let updates = pendingVariantEdits[varIdStr];
        bulkData.push({
          id: varId,
          sp: updates.sp !== undefined ? updates.sp : undefined,
        });
      }

      for (let prodIdStr in pendingProductEdits) {
        let prodId = parseInt(prodIdStr);
        let updates = pendingProductEdits[prodIdStr];
        let product = window.inventoryData.find((p) => p.id === prodId);

        if (product && product.variants) {
          product.variants.forEach((v) => {
            bulkData.push({
              id: v.id,
              mrp: updates.mrp !== undefined ? updates.mrp : v.mrp,
              sp: updates.sp !== undefined ? updates.sp : v.sp,
            });
          });
        }
      }

      if (
        bulkData.length > 0 &&
        window.dbManager &&
        window.dbManager.updateVariants
      ) {
        window.dbManager.updateVariants(bulkData);
      }

      window.isEditMode = false;
      $(this).text("Edit Table").removeClass("save-edit-mode");
      $("body").removeClass("is-editing");
      $("#toggle-view-btn").prop("disabled", false);

      if (window.reloadTable) window.reloadTable();
    }
  });

  $(document).on("click.invTable", "#toggle-view-btn", function () {
    if (window.isEditMode) return;
    window.isFlattenedView = !window.isFlattenedView;
    window.currentPage = 1;

    window.buildInventoryTable();
  });

  $(document).on("click.invTable", ".variant-toggle-btn", function () {
    const drawerId = $(this).data("target");
    $("#" + drawerId).toggle();
    $(this).toggleClass("is-open");
  });

  $(document).on("change.invTable", "#select-all-checkbox", function () {
    $(".row-checkbox").prop("checked", $(this).prop("checked"));
  });
})();

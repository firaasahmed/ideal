(function () {
  $(document).off(".addStock");

  function toTitleCase(strText) {
    if (!strText) return "";
    return strText
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  window.renderAddStockModal = function (prodId, varId = null) {
    $("#product-brand-label").hide();
    $("#product-name-label").text("Loading...");
    $("#header-base-sku").text("-");
    $("#add-stock-list").empty();

    const prodData = window.inventoryData.find(
      (p) => String(p.id) === String(prodId),
    );

    if (!prodData) {
      if (window.appAlert)
        window.appAlert(
          "System Error",
          "Product data could not be loaded into memory.",
        );
      return false;
    }

    prodData.variants = prodData.variants || [];

    let displayBrand =
      prodData.brand && prodData.brand !== "Generic" && prodData.brand !== "N/A"
        ? prodData.brand
        : "";
    if (displayBrand) {
      $("#product-brand-label").text(displayBrand).show();
    }

    $("#product-name-label").text(prodData.name);
    $("#header-base-sku").text(prodData.sku || "-");

    let globalDefaultCost =
      prodData.variants.length > 0 ? prodData.variants[0].dbCost || 0 : 0;
    let globalDefaultQty = "";
    let globalDefaultSupp =
      prodData.variants.length > 0
        ? prodData.variants[0].last_supplier || ""
        : "";
    let globalDefaultSp =
      prodData.variants.length > 0
        ? prodData.variants[0].sp || ""
        : prodData.base_sp || "";
    let globalDefaultMrp =
      prodData.variants.length > 0
        ? prodData.variants[0].mrp || 0
        : prodData.base_mrp || 0;

    if (
      prodData.variants.length > 0 &&
      window.dbManager &&
      typeof window.dbManager.getVariantDeliveries === "function"
    ) {
      try {
        const delivs = window.dbManager.getVariantDeliveries(
          prodData.variants[0].id,
        );
        if (delivs && delivs.length > 0) {
          globalDefaultCost = delivs[0].cost;
          globalDefaultQty = delivs[0].qty;
        }
      } catch (e) {}
    }

    $("#save-new-variant")
      .data("pid", prodId)
      .data("mrp", globalDefaultMrp)
      .data("sp", globalDefaultSp);

    $("#create-var-attr-list .attr-row:not(:first)").remove();
    $("#create-var-attr-list input").val("");

    $("#batch-selected-labels").empty();
    $("#batch-sell-price").val(globalDefaultSp);

    $(".create-body").hide();
    $(".create-header .toggle-icon").html("&#x25BC;");

    const todayStr = new Date().toISOString().split("T")[0];
    $("#batch-supp-date").val(todayStr);

    const dataList = $("#add-supplier-datalist").empty();
    if (
      window.dbManager &&
      typeof window.dbManager.getSuppliers === "function"
    ) {
      window.dbManager
        .getSuppliers()
        .forEach((s) => dataList.append(`<option value="${s}">`));
    }

    $("#batch-supp-name").val(globalDefaultSupp);
    $("#batch-supp-price").val(globalDefaultCost);
    $("#batch-qty").val(globalDefaultQty);

    const listContainer = $("#add-stock-list");

    if (varId) {
      $("#add-stock-modal").addClass("single-mode");
    } else {
      $("#add-stock-modal").removeClass("single-mode");
      $("#action-batch-add").text("Select Variants").prop("disabled", true);
    }

    prodData.variants.forEach((varItem) => {
      if (varId && String(varItem.id) !== String(varId)) return;

      let tagsHtml = `<span class="tag">Standard</span>`;
      let attrRowsHtml = "";

      if (varItem.attributes && Object.keys(varItem.attributes).length > 0) {
        tagsHtml = Object.entries(varItem.attributes)
          .map(
            ([k, v]) =>
              `<span class="tag"><span class="tag-label">${k}:</span>${v}</span>`,
          )
          .join("");

        attrRowsHtml = Object.entries(varItem.attributes)
          .map(
            ([k, v]) => `
                <div class="attr-row" style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                  <input type="text" class="input edit-attr-key" value="${k}" placeholder="Key" style="flex: 1; margin-right: 0.75rem; text-transform: uppercase;">
                  <input type="text" class="input edit-attr-val" value="${v}" placeholder="Value" style="flex: 1; text-transform: uppercase;">
                  <button type="button" class="btn-text remove-edit-attr" style="color: #334155; font-size: 1.25rem; text-decoration: none; margin-left: 0.5rem;">&times;</button>
                </div>
           `,
          )
          .join("");
      } else {
        attrRowsHtml = `
                <div class="attr-row" style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                  <input type="text" class="input edit-attr-key" placeholder="Key (e.g. Size)" style="flex: 1; margin-right: 0.75rem; text-transform: uppercase;">
                  <input type="text" class="input edit-attr-val" placeholder="Value (e.g. XL)" style="flex: 1; text-transform: uppercase;">
                  <button type="button" class="btn-text remove-edit-attr" style="color: #334155; font-size: 1.25rem; text-decoration: none; margin-left: 0.5rem; visibility: hidden;">&times;</button>
                </div>
           `;
      }

      let varLastCost = varItem.dbCost || 0;
      let varLastQty = "";
      if (
        window.dbManager &&
        typeof window.dbManager.getVariantDeliveries === "function"
      ) {
        try {
          const delivs = window.dbManager.getVariantDeliveries(varItem.id);
          if (delivs && delivs.length > 0) {
            varLastCost = delivs[0].cost;
            varLastQty = delivs[0].qty;
          }
        } catch (e) {}
      }

      const isCardActive = "";
      const isDrawerOpen = "display: none;";
      const editArrow = "&#x25BC;";
      const stockArrow = "&#x25BC;";
      const paddingLeftTags = !varId ? "1.85rem" : "0";

      listContainer.append(`
          <div class="var-card ${isCardActive}" data-vid="${varItem.id}">
            
            <div class="var-header" style="display: flex; flex-direction: column; align-items: stretch; padding: 1rem; background: #fff; cursor: default;">
              
              <div class="var-info" style="margin-right: 0; width: 100%;">
                 <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                    ${!varId ? `<input type="checkbox" class="checkbox batch-check" data-vid="${varItem.id}" data-old-qty="${varItem.qty}">` : ""}
                    <span class="sku-badge">${varItem.sku}</span>
                    <span class="stock-badge">Stock: ${varItem.qty}</span>
                 </div>
                 <div class="tags-container" style="padding-left: ${paddingLeftTags}; display: flex; align-items: center; flex-wrap: wrap;">
                    ${tagsHtml}
                 </div>
              </div>
              
              <div class="var-actions" style="display: flex; justify-content: flex-end; width: 100%; margin-top: 1rem; border-top: 1px dashed #e2e8f0; padding-top: 1rem; align-items: center;">
                 <button type="button" class="btn btn-secondary toggle-edit-attrs-btn" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; display: flex; align-items: center; margin-right: 1rem;">
                   Edit Attributes <span class="icon" style="margin-left: 0.35rem;">${editArrow}</span>
                 </button>
                 <button type="button" class="btn btn-primary toggle-stock-btn" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; display: flex; align-items: center;">
                   Add Stock <span class="icon" style="margin-left: 0.35rem;">${stockArrow}</span>
                 </button>
              </div>

            </div>
            
            <div class="var-drawer" style="${isDrawerOpen}">
              
              <div class="section-box edit-attrs-section" style="display: none; margin-bottom: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                   <label class="section-title" style="margin-bottom: 0;">Edit Attributes</label>
                   <button class="btn-text delete-var" data-vid="${varItem.id}" style="color: #334155;">Delete Variant</button>
                </div>
                <div class="edit-attr-list" data-vid="${varItem.id}">
                  ${attrRowsHtml}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                  <button type="button" class="btn-text add-edit-attr" data-vid="${varItem.id}">+ Add Attribute</button>
                  <button type="button" class="btn btn-secondary save-attrs" data-vid="${varItem.id}" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">Update Attributes</button>
                </div>
              </div>

              <div class="section-box receive-stock-section" style="margin-bottom: 0; display: none;">
                <label class="section-title">Receive Stock</label>
                <div class="row">
                  <div class="col">
                    <div class="field">
                      <label>Supplier Name</label>
                      <input type="text" class="input inp-supp" list="add-supplier-datalist" value="${varItem.last_supplier || globalDefaultSupp}">
                    </div>
                  </div>
                  <div class="col">
                    <div class="field">
                      <label>Date</label>
                      <div style="display: flex;">
                        <input type="date" class="input inp-date" style="flex: 1; margin-right: 0.5rem;" value="${todayStr}">
                        <button type="button" class="btn btn-secondary btn-today-var" style="padding: 0.25rem 0.75rem;">Today</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="row align-bottom" style="margin-bottom: 0;">
                  <div class="col">
                    <div class="field">
                      <label>Supplier Price/pc (₹)</label>
                      <input type="number" class="input inp-cost" value="${varLastCost}">
                    </div>
                  </div>
                  <div class="col">
                    <div class="field">
                      <label>Sell Price</label>
                      <input type="number" class="input inp-sp" value="${varItem.sp}">
                    </div>
                  </div>
                  <div class="col">
                    <div class="field">
                      <label>Add Qty</label>
                      <input type="number" class="input inp-qty" placeholder="0" min="1" value="${varLastQty}">
                    </div>
                  </div>
                  <div class="col">
                    <div class="field">
                      <label>&nbsp;</label>
                      <button class="btn btn-primary action-add" data-vid="${varItem.id}" data-old-qty="${varItem.qty}" style="width: 100%;">Receive</button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        `);
    });
    return true;
  };

  $(document).on(
    "click.addStock",
    ".add-stock-btn, .edit-stock-btn",
    function () {
      const prodId = $(this).data("pid");
      const varId = $(this).closest("tr").data("variant-id") || null;
      const success = window.renderAddStockModal(prodId, varId);
      if (success !== false) $("#add-stock-modal").show();
    },
  );

  $(document).on("click.addStock", ".close-stock", function () {
    $("#add-stock-modal").hide();
  });

  $(document).on("click.addStock", "#add-stock-add-attr", function () {
    const list = $("#create-var-attr-list");
    const newRow = list.find(".attr-row").first().clone();
    newRow.find("input").val("");
    list.append(newRow);
  });

  $(document).on("click.addStock", ".remove-attr", async function () {
    const list = $(this).closest("#create-var-attr-list");
    if (list.find(".attr-row").length <= 1) {
      if (window.appAlert)
        await window.appAlert(
          "Action Denied",
          "A variant must have at least one attribute. You cannot remove the last row.",
        );
      return;
    }
    $(this).closest(".attr-row").remove();
  });

  $(document).on("click.addStock", ".add-edit-attr", function () {
    const list = $(this).closest(".section-box").find(".edit-attr-list");
    const newRow = `
        <div class="attr-row" style="display: flex; align-items: center; margin-bottom: 0.5rem;">
          <input type="text" class="input edit-attr-key" placeholder="Key" style="flex: 1; margin-right: 0.75rem; text-transform: uppercase;">
          <input type="text" class="input edit-attr-val" placeholder="Value" style="flex: 1; text-transform: uppercase;">
          <button type="button" class="btn-text remove-edit-attr" style="color: #334155; font-size: 1.25rem; text-decoration: none; margin-left: 0.5rem;">&times;</button>
        </div>
    `;
    list.append(newRow);
  });

  $(document).on("click.addStock", ".remove-edit-attr", async function () {
    const list = $(this).closest(".edit-attr-list");
    if (list.find(".attr-row").length <= 1) {
      if (window.appAlert)
        await window.appAlert(
          "Action Denied",
          "A variant must have at least one attribute. You cannot remove the last row.",
        );
      return;
    }
    $(this).closest(".attr-row").remove();
  });

  $(document).on("click.addStock", ".save-attrs", async function () {
    const vid = $(this).data("vid");
    const drawer = $(this).closest(".var-drawer");
    const baseSku = $("#header-base-sku").text().trim();

    let attrData = {};
    let isValid = true;
    let textSuffixes = [];
    let numSuffixes = [];
    let hasAtLeastOneAttr = false;

    drawer.find(".edit-attr-list .attr-row").each(function () {
      let k = $(this).find(".edit-attr-key").val().trim().toUpperCase();
      let v = $(this).find(".edit-attr-val").val().trim().toUpperCase();

      if (k || v) {
        hasAtLeastOneAttr = true;
        if (!k || !v) {
          isValid = false;
        } else {
          attrData[k] = v;

          let vClean = v.replace(/[^A-Z0-9]/g, "");
          if (/[0-9]/.test(vClean)) {
            numSuffixes.push(vClean);
          } else {
            textSuffixes.push(vClean.substring(0, 3));
          }
        }
      }
    });

    if (!hasAtLeastOneAttr) {
      if (window.appAlert)
        await window.appAlert(
          "Attribute Required",
          "A variant must have at least one valid attribute (e.g., Size: XL).",
        );
      return;
    }

    if (!isValid) {
      if (window.appAlert)
        await window.appAlert(
          "Attribute Error",
          "Please ensure both Key and Value boxes are filled out to save changes.",
        );
      return;
    }

    let allSuffixes = textSuffixes.concat(numSuffixes);
    const fullSku = `${baseSku}-${allSuffixes.join("-")}`;

    if (window.dbManager) {
      try {
        window.dbManager.updateVariants([
          { id: vid, attributes: attrData, sku: fullSku },
        ]);

        if (typeof window.dbManager.getDetailedInventory === "function") {
          window.inventoryData = window.dbManager.getDetailedInventory();
        }
        if (window.reloadTable) window.reloadTable();

        const prodId = $("#save-new-variant").data("pid");
        window.renderAddStockModal(prodId);
      } catch (err) {
        console.error(err);
        if (err.message && err.message.toLowerCase().includes("unique")) {
          if (window.appAlert)
            await window.appAlert(
              "Conflict Blocked",
              "This exact attribute combination generates a SKU that already exists!",
            );
        } else {
          if (window.appAlert)
            await window.appAlert("Update Error", err.message);
        }
      }
    }
  });

  $(document).on("change.addStock", ".batch-check", function () {
    const checkedBoxes = $(".batch-check:checked");
    const labelsContainer = $("#batch-selected-labels").empty();

    if (checkedBoxes.length > 0) {
      $("#action-batch-add")
        .text(`Receive for ${checkedBoxes.length} Selected`)
        .prop("disabled", false);
      checkedBoxes.each(function () {
        let skuText =
          $(this).closest(".var-info").find(".sku-badge").text() || "";
        if (skuText.trim()) {
          labelsContainer.append(
            `<div style="display:inline-flex; background:#fff; border:1px solid #cbd5e1; border-radius:6px; padding:0.35rem 0.5rem; margin-right:0.5rem; margin-bottom:0.5rem; align-items: center; font-family: monospace; font-size: 0.75rem; font-weight: 700; color: #0f172a;">${skuText}</div>`,
          );
        }
      });
    } else {
      $("#action-batch-add").text(`Select Variants`).prop("disabled", true);
    }
  });

  $(document).on("click.addStock", "#action-batch-add", async function () {
    const checkedBoxes = $(".batch-check:checked");
    if (checkedBoxes.length === 0) return;

    let suppName = toTitleCase($("#batch-supp-name").val() || "Unknown");
    const suppCost = parseFloat($("#batch-supp-price").val()) || 0;
    const typedSp = parseFloat($("#batch-sell-price").val());
    const typedQty = parseInt($("#batch-qty").val());
    const dbDate = $("#batch-supp-date").val();

    if (isNaN(typedQty) || typedQty <= 0) {
      if (window.appAlert)
        await window.appAlert(
          "Entry Error",
          "Please enter a quantity greater than 0.",
        );
      return;
    }
    if (!dbDate) {
      if (window.appAlert)
        await window.appAlert(
          "Date Required",
          "Please select a valid delivery date.",
        );
      return;
    }

    let isConfirmed = true;
    if (window.appAlert)
      isConfirmed = await window.appAlert(
        "Confirm Bulk Processing",
        `You are about to receive +${typedQty} units for ${checkedBoxes.length} selected variant(s). Proceed?`,
        true,
      );

    if (isConfirmed && window.dbManager) {
      try {
        let updates = [];
        checkedBoxes.each(function () {
          let payload = {
            id: $(this).data("vid"),
            qty: parseInt($(this).data("old-qty")) + typedQty,
            supplier_name: suppName,
            supplier_cost: suppCost,
            entry_date: dbDate,
          };
          if (!isNaN(typedSp)) payload.sp = typedSp;
          updates.push(payload);
        });
        window.dbManager.updateVariants(updates);

        if (typeof window.dbManager.getDetailedInventory === "function") {
          window.inventoryData = window.dbManager.getDetailedInventory();
        }
        if (window.reloadTable) window.reloadTable();
        window.renderAddStockModal($("#save-new-variant").data("pid"));
      } catch (err) {
        console.error(err);
        if (window.appAlert)
          await window.appAlert("Database Error", err.message);
      }
    }
  });

  $(document).on("click.addStock", ".toggle-edit-attrs-btn", function (e) {
    e.stopPropagation();

    const card = $(this).closest(".var-card");
    const drawer = card.find(".var-drawer");
    const editSection = drawer.find(".edit-attrs-section");
    const stockSection = drawer.find(".receive-stock-section");
    const thisIcon = $(this).find(".icon");

    if (drawer.is(":visible") && editSection.is(":visible")) {
      drawer.slideUp(150);
      card.removeClass("active-card");
      thisIcon.html("&#x25BC;");
    } else {
      $(".var-drawer").slideUp(150);
      $(".var-card").removeClass("active-card");
      $(".toggle-edit-attrs-btn .icon, .toggle-stock-btn .icon").html(
        "&#x25BC;",
      );
      $(".create-body").slideUp(150);
      $(".create-header .toggle-icon").html("&#x25BC;");

      card.addClass("active-card");
      stockSection.hide();
      editSection.show();

      if (!drawer.is(":visible")) drawer.slideDown(150);
      thisIcon.html("&#x25B2;");
    }
  });

  $(document).on("click.addStock", ".toggle-stock-btn", function (e) {
    e.stopPropagation();

    const card = $(this).closest(".var-card");
    const drawer = card.find(".var-drawer");
    const editSection = drawer.find(".edit-attrs-section");
    const stockSection = drawer.find(".receive-stock-section");
    const thisIcon = $(this).find(".icon");

    if (drawer.is(":visible") && stockSection.is(":visible")) {
      drawer.slideUp(150);
      card.removeClass("active-card");
      thisIcon.html("&#x25BC;");
    } else {
      $(".var-drawer").slideUp(150);
      $(".var-card").removeClass("active-card");
      $(".toggle-edit-attrs-btn .icon, .toggle-stock-btn .icon").html(
        "&#x25BC;",
      );
      $(".create-body").slideUp(150);
      $(".create-header .toggle-icon").html("&#x25BC;");

      card.addClass("active-card");
      editSection.hide();
      stockSection.show();

      if (!drawer.is(":visible")) drawer.slideDown(150);
      thisIcon.html("&#x25B2;");
    }
  });

  $(document).on("click.addStock", ".create-header", function () {
    const body = $(this).siblings(".create-body");
    const icon = $(this).find(".toggle-icon");
    if (body.is(":visible")) {
      body.slideUp(150);
      icon.html("&#x25BC;");
    } else {
      $(".var-drawer").slideUp(150);
      $(".var-card").removeClass("active-card");
      $(".toggle-edit-attrs-btn .icon, .toggle-stock-btn .icon").html(
        "&#x25BC;",
      );

      body.slideDown(150);
      icon.html("&#x25B2;");
    }
  });

  $(document).on("click.addStock", ".btn-today-batch", function () {
    $("#batch-supp-date")
      .val(new Date().toISOString().split("T")[0])
      .trigger("change");
  });
  $(document).on("click.addStock", ".btn-today-var", function () {
    $(this).siblings(".inp-date").val(new Date().toISOString().split("T")[0]);
  });

  $(document).on("click.addStock", ".delete-var", async function (e) {
    e.stopPropagation();
    const vid = $(this).data("vid");
    const prodId = $("#save-new-variant").data("pid");

    const isConfirmed = await window.appAlert(
      "WARNING: Delete Variant?",
      "Are you absolutely sure? Deleting this variant will cascade and permanently erase all related stock entries and history for this item. This cannot be undone.",
      true,
    );

    if (isConfirmed && window.dbManager) {
      try {
        window.dbManager.deleteItems([vid], "variant");

        if (typeof window.dbManager.getDetailedInventory === "function") {
          window.inventoryData = window.dbManager.getDetailedInventory();
        }
        if (window.reloadTable) window.reloadTable();

        window.renderAddStockModal(prodId);
      } catch (err) {
        console.error("Delete Error:", err);
        if (window.appAlert)
          await window.appAlert(
            "Delete Error",
            "Could not delete the variant: " + err.message,
          );
      }
    }
  });

  $(document).on("click.addStock", ".action-add", async function () {
    const vid = $(this).data("vid");
    const row = $(this).closest(".var-drawer");
    const typedQty = parseInt(row.find(".inp-qty").val());

    if (isNaN(typedQty) || typedQty === 0) {
      if (window.appAlert)
        await window.appAlert(
          "Entry Error",
          "Please input a valid adjustment quantity.",
        );
      return;
    }

    let suppName = toTitleCase(row.find(".inp-supp").val() || "Unknown");
    const suppCost = parseFloat(row.find(".inp-cost").val()) || 0;
    const typedSp = parseFloat(row.find(".inp-sp").val());
    const dbDate = row.find(".inp-date").val();
    const oldQty = parseInt($(this).data("old-qty")) || 0;

    let isConfirmed = true;
    if (typedQty > 0) {
      if (window.appAlert)
        isConfirmed = await window.appAlert(
          "Receive Stock",
          `Process incoming delivery of +${typedQty} unit(s)?`,
          true,
        );
    } else {
      if (window.appAlert)
        isConfirmed = await window.appAlert(
          "Stock Deduction",
          `Are you sure you want to deduct ${Math.abs(typedQty)} unit(s) from inventory?`,
          true,
        );
    }

    if (isConfirmed && window.dbManager) {
      try {
        let payload = { id: vid, qty: oldQty + typedQty };
        if (!isNaN(typedSp)) payload.sp = typedSp;

        if (typedQty > 0) {
          payload.supplier_name = suppName;
          payload.supplier_cost = suppCost;
          payload.entry_date = dbDate;
        }

        window.dbManager.updateVariants([payload]);

        if (typeof window.dbManager.getDetailedInventory === "function") {
          window.inventoryData = window.dbManager.getDetailedInventory();
        }
        if (window.reloadTable) window.reloadTable();

        const isSingleMode = $("#add-stock-modal").hasClass("single-mode");
        window.renderAddStockModal(
          $("#save-new-variant").data("pid"),
          isSingleMode ? vid : null,
        );
      } catch (err) {
        console.error(err);
        if (window.appAlert)
          await window.appAlert("Database Error", err.message);
      }
    }
  });

  $(document).on("click.addStock", "#save-new-variant", async function () {
    let prodId = $(this).data("pid");
    let baseSku = $("#header-base-sku").text().trim();

    let attrData = {};
    let isValid = true;
    let textSuffixes = [];
    let numSuffixes = [];
    let hasAtLeastOneAttr = false;

    $("#create-var-attr-list .attr-row").each(function () {
      let k = $(this).find(".attr-key").val().trim().toUpperCase();
      let v = $(this).find(".attr-val").val().trim().toUpperCase();

      if (k || v) {
        hasAtLeastOneAttr = true;
        if (!k || !v) {
          isValid = false;
        } else {
          attrData[k] = v;

          let vClean = v.replace(/[^A-Z0-9]/g, "");
          if (/[0-9]/.test(vClean)) {
            numSuffixes.push(vClean);
          } else {
            textSuffixes.push(vClean.substring(0, 3));
          }
        }
      }
    });

    if (!hasAtLeastOneAttr) {
      if (window.appAlert)
        await window.appAlert(
          "Attribute Required",
          "Every variant must have at least one valid attribute (e.g., Size: XL).",
        );
      return;
    }

    if (!isValid) {
      if (window.appAlert)
        await window.appAlert(
          "Attribute Error",
          "Please ensure both Key and Value boxes are filled out for your attribute.",
        );
      return;
    }

    let allSuffixes = textSuffixes.concat(numSuffixes);
    const fullSku = `${baseSku}-${allSuffixes.join("-")}`;

    let mrpAmt = parseFloat($(this).data("mrp")) || 0;
    let sSellPrice = parseFloat($(this).data("sp")) || 0;

    let sQty = 0;
    const dbDate = new Date().toISOString().split("T")[0];
    let suppName = "Unknown";
    let suppCost = 0;

    if (window.dbManager) {
      try {
        window.dbManager.addVariant(
          prodId,
          attrData,
          fullSku,
          sQty,
          mrpAmt,
          sSellPrice,
          suppCost,
          suppName,
          dbDate,
        );

        if (typeof window.dbManager.getDetailedInventory === "function") {
          window.inventoryData = window.dbManager.getDetailedInventory();
        }

        if (window.reloadTable) window.reloadTable();
        window.renderAddStockModal(prodId);
      } catch (err) {
        console.error("Variant Save Error:", err);
        if (err.message && err.message.toLowerCase().includes("unique")) {
          if (window.appAlert)
            await window.appAlert(
              "Conflict Blocked",
              "This variant setup (or its auto-generated SKU: " +
                fullSku +
                ") already exists under this product!",
            );
        } else {
          if (window.appAlert)
            await window.appAlert(
              "System Error",
              "Could not complete action: " + err.message,
            );
        }
      }
    }
  });
})();

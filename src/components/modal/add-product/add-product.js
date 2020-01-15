
(function () {
  $(document).off(".addProduct");

  function toTitleCase(strText) {
    if (!strText) return "";
    return strText
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function genSmartCode(strText) {
    if (!strText) return "";
    const cleanText = strText.trim().toUpperCase();
    const words = cleanText.split(/[\s\-]+/);
    let code = "";

    const hasNumbers = /[0-9]/.test(cleanText);
    const numbers = cleanText.replace(/[^0-9]/g, "");

    if (words.length === 1) {
      code = words[0].replace(/[^A-Z0-9]/g, "").substring(0, 4);
    } else {
      let initials = words
        .map((w) => w.replace(/[^A-Z0-9]/g, "").charAt(0))
        .join("");
      if (hasNumbers) {
        code = initials.substring(0, 2) + numbers;
      } else {
        code = initials.substring(0, 4);
      }
    }

    if (code.length < 3) {
      code = cleanText.replace(/[^A-Z0-9]/g, "").substring(0, 3);
    }

    return code.substring(0, 6);
  }

  let skuManuallyEdited = false;
  $(document).on("input.addProduct", "#base-sku-input", function () {
    skuManuallyEdited = true;
  });

  function updateBaseSku() {
    if (skuManuallyEdited) return;
    const cat = genSmartCode($("#category-input").val()) || "CAT";
    const brand = genSmartCode($("#brand-input").val()) || "GEN";
    const name = genSmartCode($("#name-input").val()) || "PRD";

    const newSku = [cat, brand, name].filter(Boolean).join("-");
    $("#base-sku-input").val(newSku);
  }

  $(document).on(
    "input.addProduct",
    "#brand-input, #category-input, #name-input",
    updateBaseSku,
  );

  function popBrandDrop() {
    const brandSet = new Set();
    if (window.inventoryData) {
      window.inventoryData.forEach((prod) => {
        if (prod.brand && prod.brand.trim() !== "") brandSet.add(prod.brand);
      });
    }
    const dataList = $("#brand-datalist").empty();
    brandSet.forEach((b) => dataList.append(`<option value="${b}">`));
    if (!brandSet.has("Generic")) dataList.append('<option value="Generic">');
  }

  $(document).on("click.addProduct", "#open-add-modal-btn", function () {
    skuManuallyEdited = false;
    $("#add-product-box .ap-input").not("select").val("");
    $("#gst-input").val("18");
    $("#category-input").val("Footwear");
    popBrandDrop();
    $("#base-sku-input").val("");

    $("#product-modal").show();
  });

  $(document).on("click.addProduct", "#close-btn, #cancel-btn", function () {
    $("#product-modal").hide();
  });

  $(document).on("click.addProduct", "#save-product", async function () {
    const brandNameInput = $("#brand-input").val();
    const prodNameInput = $("#name-input").val();
    const baseSpStr = $("#sp-input").val();

    
    if (!brandNameInput || !brandNameInput.trim()) {
      if (window.appAlert)
        await window.appAlert(
          "Validation Error",
          "Please provide a Brand name.",
        );
      return;
    }

    const cleanBrand = toTitleCase(brandNameInput.trim());
    const cleanName = toTitleCase((prodNameInput || "").trim());

    
    if (!cleanName) {
      if (window.appAlert)
        await window.appAlert(
          "Validation Error",
          "Please provide a Product Name.",
        );
      return;
    }

    
    if (!baseSpStr || baseSpStr.trim() === "") {
      if (window.appAlert)
        await window.appAlert(
          "Validation Error",
          "Please provide a Base Selling Price.",
        );
      return;
    }

    if (window.inventoryData) {
      const isDuplicate = window.inventoryData.some(
        (p) =>
          p.name.toLowerCase() === cleanName.toLowerCase() &&
          p.brand.toLowerCase() === cleanBrand.toLowerCase(),
      );

      if (isDuplicate) {
        if (window.appAlert)
          await window.appAlert(
            "Duplicate Entry",
            `The product "${cleanBrand} ${cleanName}" already exists in your catalog.`,
          );
        return;
      }
    }

    let rawSku = $("#base-sku-input").val() || "";
    let baseSku = rawSku.trim().toUpperCase();

    if (!baseSku) {
      const cat = genSmartCode($("#category-input").val()) || "CAT";
      const brand = genSmartCode(cleanBrand) || "GEN";
      const name = genSmartCode(cleanName) || "PRD";
      baseSku = [cat, brand, name].join("-");
    }

    const baseMrp = parseFloat($("#mrp-input").val()) || 0;
    const baseSp = parseFloat(baseSpStr) || 0;
    const hsnVal = $("#hsn-input").val() || "0000";

    const prodData = {
      name: cleanName,
      base_sku: baseSku,
      category: $("#category-input").val(),
      brand: cleanBrand,
      hsn: hsnVal,
      gst: ($("#gst-input").val() || "18") + "%",
    };

    if (window.dbManager) {
      try {
        let newProdId = window.dbManager.addProduct(prodData, []);
        $("#product-modal").hide();

        if (typeof window.dbManager.getDetailedInventory === "function") {
          window.inventoryData = window.dbManager.getDetailedInventory();
        }

        let realProd = window.inventoryData.find((p) => p.sku === baseSku);
        if (realProd) newProdId = realProd.id;

        if (!realProd) {
          prodData.id = newProdId;
          prodData.variants = [];
          prodData.sku = baseSku;
          prodData.base_sp = baseSp;
          prodData.base_mrp = baseMrp;
          window.inventoryData.push(prodData);
        } else {
          realProd.base_sp = baseSp;
          realProd.base_mrp = baseMrp;
        }

        if (window.reloadTable) window.reloadTable();

        if (window.renderAddStockModal && newProdId) {
          const renderSuccess = window.renderAddStockModal(newProdId);
          if (renderSuccess !== false) {
            $("#add-stock-modal").show();
          }
        }
      } catch (err) {
        console.error("Database Save Error:", err);
        if (err.message && err.message.toLowerCase().includes("unique")) {
          if (window.appAlert)
            await window.appAlert(
              "SKU Taken",
              `The Base SKU '${baseSku}' is currently in use. Please edit the Base SKU to ensure it is unique.`,
            );
        } else {
          if (window.appAlert)
            await window.appAlert(
              "Database Error",
              "Error saving product: " + err.message,
            );
        }
      }
    }
  });
})();

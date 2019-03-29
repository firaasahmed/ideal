(function () {
  $(document).off(".applySale");

  $(document).on("click.applySale", "#put-on-sale-btn", async function () {
    const selectedIds = window.isFlattenedView
      ? window.getSelectedVariantIds()
      : window.getSelectedProductIds();
    if (selectedIds.length === 0) {
      if (window.appAlert)
        await window.appAlert(
          "Action Required",
          "Please check the box next to at least one item to put it on sale.",
        );
      return;
    }

    if (!window.dbManager) {
      if (window.appAlert)
        await window.appAlert("Error", "Database not connected.");
      return;
    }

    const activeList = window.dbManager.getDiscounts();
    if (activeList.length === 0) {
      if (window.appAlert)
        await window.appAlert(
          "No Campaigns",
          "You have no discounts! Click 'Manage Campaigns' first.",
        );
      return;
    }

    const selectNode = $("#apply-disc-select").empty();
    activeList.forEach((discItem) => {
      const discLabel =
        discItem.type === "PERCENT"
          ? `${discItem.value}% Off`
          : `₹${discItem.value} Off`;
      selectNode.append(
        `<option value="${discItem.id}">${discItem.name} (${discLabel})</option>`,
      );
    });

    $("#apply-count").text(selectedIds.length);
    $("#apply-sale-modal").show();
  });

  $(document).on("click.applySale", ".close-apply", function () {
    $("#apply-sale-modal").hide();
  });

  $(document).on("click.applySale", "#confirm-apply-sale", function () {
    const discId = parseInt($("#apply-disc-select").val());
    if (window.dbManager) {
      const targetIds = window.isFlattenedView
        ? window.getSelectedVariantIds()
        : window.getSelectedProductIds();
      const targetType = window.isFlattenedView ? "variant" : "product";
      window.dbManager.setDiscount(discId, targetIds, targetType);
    }
    $("#apply-sale-modal").hide();
    if (window.reloadTable) window.reloadTable();
  });
})();

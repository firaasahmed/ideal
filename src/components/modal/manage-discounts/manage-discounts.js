(function () {
  $(document).off(".manageDisc");

  $(document).on(
    "click.manageDisc",
    "#manage-discounts-btn",
    async function () {
      if (!window.dbManager) {
        if (window.appAlert)
          await window.appAlert("Error", "Database not connected.");
        return;
      }

      const activeDiscounts = window.dbManager.getDiscounts();
      const listNode = $("#discount-list").empty();

      activeDiscounts.forEach((disc) => {
        const discLabel =
          disc.type === "PERCENT" ? `${disc.value}% Off` : `₹${disc.value} Off`;

        listNode.append(`
        <li class="campaign-item">
          <span class="campaign-item-name">${disc.name}</span>
          <div class="campaign-item-actions">
            <span class="campaign-badge">${discLabel}</span>
            <button class="campaign-delete-btn" data-id="${disc.id}" title="Delete Campaign">&times;</button> 
          </div>
        </li>
      `);
      });
      $("#discounts-modal").show();
    },
  );

  $(document).on("click.manageDisc", ".campaign-delete-btn", async function () {
    let confirmDel = true;
    if (window.appAlert) {
      confirmDel = await window.appAlert(
        "Delete Campaign",
        "Are you sure? Products associated with this campaign will return to their normal price.",
        true,
      );
    }
    if (!confirmDel) return;

    if (window.dbManager) {
      window.dbManager.deleteDiscount($(this).data("id"));

      $("#manage-discounts-btn").click();

      if (window.reloadTable) window.reloadTable();
    }
  });

  $(document).on("click.manageDisc", ".close-disc", function () {
    $("#discounts-modal").hide();
  });

  $(document).on("click.manageDisc", "#save-discount", async function () {
    const compName = $("#new-disc-name").val();
    const compType = $("#new-disc-type").val();
    const compVal = parseFloat($("#new-disc-val").val());

    if (!compName || isNaN(compVal)) {
      if (window.appAlert)
        await window.appAlert(
          "Action Required",
          "Please fill in a valid name and discount value.",
        );
      return;
    }

    if (window.dbManager) {
      window.dbManager.addDiscount(compName, compType, compVal);
      $("#new-disc-name").val("");
      $("#new-disc-val").val("");
      $("#manage-discounts-btn").click();
    }
  });
})();

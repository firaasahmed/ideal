(function () {
  window.buildItemCard = function (itemData) {
    const fmtPrice = parseFloat(itemData.price).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    });
    const isSalePrice =
      parseFloat(itemData.price) < parseFloat(itemData.originalPrice);

    let priceHtml = "";
    let saleBadge = "";

    if (isSalePrice) {
      const fmtOrig = parseFloat(itemData.originalPrice).toLocaleString(
        "en-IN",
        { minimumFractionDigits: 2 },
      );
      saleBadge = `<span class="sale-badge">SALE</span>`;
      priceHtml = `
        <div class="price-stack">
          <span class="old-price">₹ ${fmtOrig}</span>
          <span class="new-price active-sale">₹ ${fmtPrice}</span>
        </div>
      `;
    } else {
      priceHtml = `<span class="new-price">₹ ${fmtPrice}</span>`;
    }

    let specsHtml = "";
    if (itemData.attributes && Object.keys(itemData.attributes).length > 0) {
      specsHtml = `<div class="card-specs">`;
      for (let propKey in itemData.attributes) {
        specsHtml += `<span class="spec-box"><span class="spec-lbl">${propKey}:</span> ${itemData.attributes[propKey]}</span>`;
      }
      specsHtml += `</div>`;
    }

    const brandStr =
      itemData.brand && itemData.brand !== "Generic" && itemData.brand !== "N/A"
        ? `${itemData.brand} `
        : "";
    const fullName = `${brandStr}${itemData.name}`;
    const attrJson = encodeURIComponent(
      JSON.stringify(itemData.attributes || {}),
    );

    return `
      <div class="item-card" data-id="${itemData.id}" data-name="${fullName}" data-price="${itemData.price}" data-stock="${itemData.stock}" data-attrs="${attrJson}">
        
        <div class="card-info">
          <h4 class="item-name">${fullName}</h4>
          ${specsHtml}
          <span class="card-sku">${itemData.sku}</span>
        </div>
        
        <div class="card-foot">
            <div class="card-tags">
                <span class="held-badge" style="display: none;">Held: <span class="held-count">0</span></span>
                
                <div class="right-tags">
                  <span class="cart-badge" style="display: none;">Cart: <span class="cart-count">0</span></span>
                  <span class="stock-badge">Stock: <span class="stock-count">${itemData.stock}</span></span>
                </div>
            </div>

            <div class="price-row">
                ${saleBadge}
                ${priceHtml}
            </div>
        </div>
        
      </div>
    `;
  };
})();

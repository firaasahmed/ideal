
(function() {

  function getSelectedItems() {
    if (window.isFlattenedView && window.getSelectedVariantIds) {
      return { ids: window.getSelectedVariantIds(), type: 'variant' };
    }
    if (window.getSelectedProductIds) {
        return { ids: window.getSelectedProductIds(), type: 'product' };
    }
    return { ids: [], type: 'unknown' };
  }

  $(document).off('click', '#remove-sale-btn');
  $(document).on('click', '#remove-sale-btn', async function(e) {
    e.preventDefault();
    const selectedObj = getSelectedItems();
    
    if (selectedObj.ids.length === 0) {
      if (window.appAlert) await window.appAlert('Selection Required', 'Select at least one item to remove from sale.');
      return;
    }
    
    let isConfirmed = true;
    if (window.appAlert) {
       isConfirmed = await window.appAlert('Remove Sale', 'Remove active sales/discounts from selected items?', true);
    }
    
    if (isConfirmed) {
      if (window.dbManager && typeof window.dbManager.setDiscount === 'function') {
         window.dbManager.setDiscount(null, selectedObj.ids, selectedObj.type);
         if (window.reloadTable) window.reloadTable();
      }
    }
  });

  
  $(document).off('click', '#config-api-btn');
  $(document).on('click', '#config-api-btn', function() {
      const currentRzpKey = localStorage.getItem('pos_rzp_key') || '';
      const currentRzpSecret = localStorage.getItem('pos_rzp_secret') || '';
      const currentQr = localStorage.getItem('pos_store_qr') || '';
      
      const qrDisplay = currentQr ? '<img src="' + currentQr + '" style="max-height: 80px; border-radius: 4px; border: 1px solid #cbd5e1;">' : '<span style="font-size:0.75rem; color:#a0aab2;">No QR Uploaded</span>';

      const modalHtml = 
          '<div id="api-config-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.7); z-index: 9999; display: flex; align-items: center; justify-content: center;">' +
              '<div style="background: #ffffff; padding: 2rem; border-radius: 8px; width: 28rem; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">' +
                  '<h3 style="margin: 0 0 0.5rem 0; font-size: 1.15rem; color: #0f172a;">Payment Configuration</h3>' +
                  '<p style="margin: 0 0 1.5rem 0; font-size: 0.8rem; color: #64748b;">Configure Razorpay or upload your static store QR.</p>' +
                  
                  '<label style="font-size: 0.75rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.25rem; text-transform: uppercase;">Razorpay Key ID</label>' +
                  '<input type="text" id="rzp-key-input" value="' + currentRzpKey + '" placeholder="rzp_live_..." style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: monospace; outline: none;">' +
                  
                  '<label style="font-size: 0.75rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.25rem; text-transform: uppercase;">Razorpay Key Secret</label>' +
                  '<input type="password" id="rzp-secret-input" value="' + currentRzpSecret + '" placeholder="••••••••••••" style="width: 100%; padding: 0.75rem; margin-bottom: 1.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: monospace; outline: none;">' +
                  
                  '<label style="font-size: 0.75rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.5rem; text-transform: uppercase;">Static Store UPI QR (Optional)</label>' +
                  '<div style="display: flex; align-items: center; margin-bottom: 1.5rem;">' +
                      '<div id="qr-preview-box" style="margin-right: 1rem;">' + qrDisplay + '</div>' +
                      '<input type="file" id="qr-upload-input" accept="image/*" style="font-size: 0.75rem;">' +
                      '<input type="hidden" id="qr-base64-hidden" value="' + currentQr + '">' +
                  '</div>' +
                  
                  '<div style="display: flex; justify-content: flex-end;">' +
                      '<button id="cancel-api-btn" style="padding: 0.6rem 1rem; border: none; background: #f1f5f9; color: #475569; border-radius: 6px; cursor: pointer; margin-right: 0.5rem; font-weight: 700; font-size: 0.85rem;">Cancel</button>' +
                      '<button id="save-api-btn" style="padding: 0.6rem 1.25rem; border: none; background: #3b82f6; color: #ffffff; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 0.85rem;">Save Settings</button>' +
                  '</div>' +
              '</div>' +
          '</div>';
      $('body').append(modalHtml);
  });

  $(document).on('change', '#qr-upload-input', function(e) {
      const file = e.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = function(ev) {
              const b64 = ev.target.result;
              $('#qr-preview-box').html('<img src="' + b64 + '" style="max-height: 80px; border-radius: 4px; border: 1px solid #cbd5e1;">');
              $('#qr-base64-hidden').val(b64);
          };
          reader.readAsDataURL(file);
      }
  });

  $(document).on('click', '#cancel-api-btn', function() { $('#api-config-overlay').remove(); });
  
  $(document).on('click', '#save-api-btn', function() {
      localStorage.setItem('pos_rzp_key', $('#rzp-key-input').val().trim());
      localStorage.setItem('pos_rzp_secret', $('#rzp-secret-input').val().trim());
      localStorage.setItem('pos_store_qr', $('#qr-base64-hidden').val().trim());
      $('#api-config-overlay').remove();
      
      if (window.appAlert) window.appAlert('Saved', 'Payment configuration updated successfully!');
  });

})();
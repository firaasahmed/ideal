/* checkout.js */
(function () {
  $(document).off('.checkout');
  
  let dbManager = window.dbManager;
  if (!dbManager) {
      try {
          dbManager = require('../database.js');
      } catch (err) {}
  }
  
  const fmt = function(n) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2 }); };

  let totalDue = 0;
  let tenderedStr = '';
  let terminalTimeout; 

  function ensureReceiptModal() {
    if ($('#receipt-modal-container').length === 0) {
      $('body').append('<div id="receipt-modal-container"></div>');
      $('#receipt-modal-container').load(
        'components/modal/receipt-modal/receipt-modal.html',
        function () {
          $.getScript('components/modal/receipt-modal/receipt-modal.js');
        }
      );
    }
  }

  $(document).on('click.checkout', '#cash-btn', async function () {
    if (window.cart.items.length === 0) {
      if (window.appAlert) await window.appAlert('Action Required', 'Cart is empty.');
      return;
    }
    
    totalDue = window.cart.total;
    tenderedStr = '';

    const gridEl = $('#quick-cash').empty();
    gridEl.append('<button data-val="exact">Exact Amount</button>');
    
    let amounts = [];
    let lastAmt = totalDue;
    
    [50, 100, 500, 1000].forEach(function(t) {
      const r = Math.ceil(totalDue / t) * t;
      if (r > totalDue) amounts.push(r);
    });
    
    while (amounts.length < 3) {
      lastAmt += 500;
      amounts.push(lastAmt);
    }
    
    amounts.slice(0, 3).forEach(function(a) {
        gridEl.append('<button data-val="' + a + '">₹ ' + fmt(a) + '</button>');
    });

    $('#cash-due').text('₹ ' + fmt(totalDue));
    $('#tender-input').val('');
    $('#change-val').attr('class', 'change-off').text('₹ 0.00');
    $('#finish-cash').prop('disabled', true);
    $('#cash-bg').fadeIn(150);
  });

  $(document).on('click.checkout', '#quick-cash button', function () {
    tenderedStr = $(this).data('val') === 'exact' ? totalDue.toString() : $(this).data('val').toString();
    $('#tender-input').val('₹ ' + fmt(parseFloat(tenderedStr)));
    calcChange();
  });

  $(document).on('click.checkout', '#chk-grid button', function () {
    const btnVal = $(this).data('val');
    if (btnVal === 'CLEAR') tenderedStr = '';
    else if (btnVal === 'BACK') tenderedStr = tenderedStr.slice(0, -1);
    else if (btnVal !== undefined) tenderedStr += btnVal;
    
    $('#tender-input').val(tenderedStr ? '₹ ' + tenderedStr : '');
    calcChange();
  });

  function calcChange() {
    const tVal = parseFloat(tenderedStr) || 0;
    if (tVal >= totalDue) {
      $('#change-val').attr('class', 'change-on').text('₹ ' + fmt(tVal - totalDue));
      $('#finish-cash').prop('disabled', false);
    } else {
      $('#change-val').attr('class', 'change-off').text('₹ 0.00');
      $('#finish-cash').prop('disabled', true);
    }
  }

  $(document).on('click.checkout', '#finish-cash', function () {
    const tVal = parseFloat(tenderedStr) || 0;
    if (dbManager) {
      const saleId = dbManager.processSale(window.cart, 'CASH', tVal);
      $('#cash-bg').fadeOut(150);
      dbManager.deleteParkedOrder(window.currentActiveTabId);
      window.cart.items = [];
      if (typeof window.drawCart === 'function') window.drawCart(-1, true);

      ensureReceiptModal();
      setTimeout(function () {
        if (typeof window.openReceiptModal === 'function') {
            window.openReceiptModal(saleId);
        }
      }, 300);
    }
  });

  $(document).on('click.checkout', '#close-cash', function() {
      $('#cash-bg').fadeOut(150);
  });
  
  $(document).on('click.checkout', '#close-card, #manual-decline', function() {
    clearTimeout(terminalTimeout);
    $('#card-bg').fadeOut(150);
  });

  // --- RAZORPAY POS & STATIC QR LOGIC ---
  $(document).on('click.checkout', '#card-btn', async function () {
    if (window.cart.items.length === 0) {
      if (window.appAlert) await window.appAlert('Action Required', 'Cart is empty.');
      return;
    }
    
    totalDue = window.cart.total;
    $('#card-due').text('₹ ' + fmt(totalDue));
    
    $('.card-btns').hide();
    
    // Check for Client's Uploaded Static Store QR Code
    const storeQrBase64 = localStorage.getItem('pos_store_qr');
    
    if (storeQrBase64 && storeQrBase64.trim() !== '') {
        const imgHtml = '<img src="' + storeQrBase64 + '" style="width: 100%; height: 100%; border-radius: 0.75rem;" alt="Store UPI QR">';
        $('#qr-container').html(imgHtml);
        $('#qr-label').text('Scan to pay exact amount: ₹' + fmt(totalDue));
    } else {
        $('#qr-container').html('&#x25A3;');
        $('#qr-label').text('Please scan the physical Store QR at the counter');
    }

    // Check for Razorpay Configuration
    const rzpKey = localStorage.getItem('pos_rzp_key');
    const rzpSecret = localStorage.getItem('pos_rzp_secret');
    let waitHtml = '';

    if (rzpKey && rzpSecret) {
        /*
         * If using Razorpay POS/Terminal devices, you would create an order here:
         * * fetch('https://api.razorpay.com/v1/terminals/charge', {
         * method: 'POST',
         * headers: { 'Authorization': 'Basic ' + btoa(rzpKey + ':' + rzpSecret) },
         * body: JSON.stringify({ amount: totalDue * 100, currency: "INR", device_id: "..." })
         * });
         */
         waitHtml = 'Pushing ₹' + totalDue + ' to Razorpay Terminal...';
    } else {
         waitHtml = ' Awaiting manual confirmation...';
    }

    $('#term-status').attr('class', 'term-wait').html(waitHtml);
      
    $('#card-bg').fadeIn(150);


    clearTimeout(terminalTimeout);
    terminalTimeout = setTimeout(function () {
        $('#term-status').html('Verify payment on terminal or Soundbox.');
        $('.card-btns').fadeIn(200);
    }, 2000); 
  });
  
  $(document).on('click.checkout', '#manual-confirm', function () {
    $('#term-status').attr('class', 'term-pass').html('Payment Confirmed ✓');
    $('.card-btns').hide();
    
    setTimeout(function () {
      if (dbManager) {
        const saleId = dbManager.processSale(
          window.cart,
          'CARD/UPI',
          totalDue
        );
        $('#card-bg').fadeOut(150);
        dbManager.deleteParkedOrder(window.currentActiveTabId);
        window.cart.items = [];
        
        if (typeof window.drawCart === 'function') window.drawCart(-1, true);

        ensureReceiptModal();
        setTimeout(function () {
          if (typeof window.openReceiptModal === 'function') {
            window.openReceiptModal(saleId);
          }
        }, 300);
      }
    }, 400); 
  });
})();
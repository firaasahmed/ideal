(function() {
    try { window.db = require('../database.js'); } catch (err) {}

    window.rupees = function(amount) {
        const amt = parseFloat(amount) || 0;
        return amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    window.buildTag = function(type, label, options = {}) {
        let html = `<div class="${type}-tag">`;
        html += `<span>${label}</span>`;
        if (options.savings) html += `<span class="tag-saved">-₹ ${window.rupees(options.savings)}</span>`;
        if (options.removable) html += `<button class="tag-del">&times;</button>`;
        html += `</div>`;
        return html;
    };

    window.openModal = function(id) { $(`#${id}`).fadeIn(150); };
    window.closeModal = function(id) { $(`#${id}`).fadeOut(150); };
})();
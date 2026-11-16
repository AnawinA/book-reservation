'use strict';

(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const buttons = document.querySelectorAll('.redeem-btn');

    buttons.forEach(function (button) {
      button.addEventListener('click', async function () {
        const rewardId = button.dataset.rewardId;
        const cost = button.dataset.cost;
        const title = button.dataset.title;

        if (!window.confirm('Redeem "' + title + '" for ' + cost + ' points?')) return;

        button.disabled = true;
        try {
          const result = await window.App.apiFetch(
            'POST',
            '/api/customer/rewards/' + encodeURIComponent(rewardId) + '/redeem',
            {}
          );

          const box = document.getElementById('voucherBox');
          const code = document.getElementById('voucherCode');
          if (box && code) {
            code.textContent = result.redemptionCode;
            box.hidden = false;
            box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          window.App.showMessage('Redeemed. You have ' + result.remainingPoints + ' points left.');
          setTimeout(function () {
            window.location.reload();
          }, 3000);
        } catch (error) {
          button.disabled = false;
          window.App.showMessage(window.App.formatError(error), 'error');
        }
      });
    });
  });
})();

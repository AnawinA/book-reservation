'use strict';

(function () {
  function shopId() {
    const input = document.getElementById('shopId');
    return input ? input.value : '';
  }

  function reloadSoon() {
    setTimeout(function () {
      window.location.reload();
    }, 1200);
  }

  document.addEventListener('DOMContentLoaded', function () {
    const base = '/api/shops/' + shopId();

    const donationForm = document.getElementById('donationForm');
    if (donationForm) {
      donationForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        try {
          const result = await window.App.apiFetch('POST', base + '/donations', window.App.formToJSON(donationForm));
          window.App.showMessage(
            'Donation recorded (' + result.item.barcode + '), ' + result.pointsAwarded + ' points awarded.'
          );
          donationForm.reset();
          reloadSoon();
        } catch (error) {
          window.App.showMessage(window.App.formatError(error), 'error');
        }
      });
    }

    const borrowForm = document.getElementById('borrowForm');
    if (borrowForm) {
      borrowForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        try {
          const result = await window.App.apiFetch('POST', base + '/borrows', window.App.formToJSON(borrowForm));
          window.App.showMessage('Book ' + result.item.barcode + ' lent until ' + result.item.dueDate + '.');
          borrowForm.reset();
          reloadSoon();
        } catch (error) {
          window.App.showMessage(window.App.formatError(error), 'error');
        }
      });
    }

    const returnForm = document.getElementById('returnForm');
    if (returnForm) {
      returnForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        try {
          const result = await window.App.apiFetch('POST', base + '/returns', window.App.formToJSON(returnForm));
          window.App.showMessage(
            'Book returned' + (result.wasOverdue ? ' (it was overdue).' : '.')
          );
          returnForm.reset();
          reloadSoon();
        } catch (error) {
          window.App.showMessage(window.App.formatError(error), 'error');
        }
      });
    }

    const statusForm = document.getElementById('statusForm');
    if (statusForm) {
      statusForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        const data = window.App.formToJSON(statusForm);
        try {
          const item = await window.App.apiFetch(
            'PATCH',
            '/api/book-items/' + encodeURIComponent(String(data.barcode).toUpperCase()) + '/status',
            { status: data.status }
          );
          window.App.showMessage('Status of ' + item.barcode + ' is now ' + item.status + '.');
          statusForm.reset();
          reloadSoon();
        } catch (error) {
          window.App.showMessage(window.App.formatError(error), 'error');
        }
      });
    }

    const claimForm = document.getElementById('claimForm');
    if (claimForm) {
      claimForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        try {
          const result = await window.App.apiFetch('PATCH', base + '/rewards/claim', window.App.formToJSON(claimForm));
          window.App.showMessage(
            'Valid voucher for ' + result.customer.username + ' (' + result.reward.title + ').'
          );
        } catch (error) {
          window.App.showMessage(window.App.formatError(error), 'error');
        }
      });
    }

    const lookupForm = document.getElementById('lookupForm');
    if (lookupForm) {
      lookupForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        const data = window.App.formToJSON(lookupForm);
        try {
          const item = await window.App.apiFetch(
            'GET',
            '/api/book-items/' + encodeURIComponent(String(data.barcode).toUpperCase())
          );
          const box = document.getElementById('lookupResult');
          if (box) {
            box.textContent = JSON.stringify(item, null, 2);
            box.hidden = false;
          }
        } catch (error) {
          window.App.showMessage(window.App.formatError(error), 'error');
        }
      });
    }
  });
})();

'use strict';

(function () {
  const ENDPOINTS = {
    shop: '/api/admin/shops',
    book: '/api/admin/books',
    campaign: '/api/admin/campaigns',
    reward: '/api/admin/rewards'
  };

  function toIso(value) {
    if (!value) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  function fillForm(form, data) {
    Object.keys(data).forEach(function (key) {
      const field = form.elements[key];
      if (!field) return;
      let value = data[key];
      if (field.type === 'datetime-local' && value) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
          value = local.toISOString().slice(0, 16);
        }
      }
      field.value = value === null || value === undefined ? '' : value;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const forms = {
      shop: document.getElementById('shopForm'),
      book: document.getElementById('bookForm'),
      campaign: document.getElementById('campaignForm'),
      reward: document.getElementById('rewardForm')
    };

    Object.keys(forms).forEach(function (entity) {
      const form = forms[entity];
      if (!form) return;

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        const mode = form.dataset.mode === 'edit' ? 'edit' : 'create';
        const id = form.dataset.id;
        const payload = window.App.formToJSON(form);

        if (payload.startAt) payload.startAt = toIso(payload.startAt);
        if (payload.endAt) payload.endAt = toIso(payload.endAt);

        try {
          if (mode === 'edit') {
            await window.App.apiFetch('PUT', ENDPOINTS[entity] + '/' + encodeURIComponent(id), payload);
            window.App.showMessage('Updated successfully.');
          } else {
            await window.App.apiFetch('POST', ENDPOINTS[entity], payload);
            window.App.showMessage('Created successfully.');
          }
          setTimeout(function () {
            window.location.reload();
          }, 900);
        } catch (error) {
          window.App.showMessage(window.App.formatError(error), 'error');
        }
      });
    });

    document.querySelectorAll('.edit-btn').forEach(function (button) {
      button.addEventListener('click', function () {
        const entity = button.dataset.entity;
        const form = forms[entity];
        if (!form) return;

        let data = {};
        try {
          data = JSON.parse(button.dataset.json);
        } catch (_) {
          data = {};
        }

        fillForm(form, data);
        form.dataset.mode = 'edit';
        form.dataset.id = button.dataset.id;
        const submit = form.querySelector('button[type="submit"]');
        if (submit) submit.textContent = 'Save changes';
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    document.querySelectorAll('.delete-shop-btn').forEach(function (button) {
      button.addEventListener('click', async function () {
        if (!window.confirm('Soft delete this shop? It has to have no active borrows.')) return;
        try {
          await window.App.apiFetch('DELETE', '/api/admin/shops/' + encodeURIComponent(button.dataset.id));
          window.App.showMessage('Shop deleted.');
          setTimeout(function () {
            window.location.reload();
          }, 900);
        } catch (error) {
          window.App.showMessage(window.App.formatError(error), 'error');
        }
      });
    });
  });
})();

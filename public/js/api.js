'use strict';

(function () {
  async function apiFetch(method, url, body) {
    const options = {
      method: method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    };

    if (body !== undefined && body !== null) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (response.status === 204) return null;

    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    if (!response.ok || !payload || payload.success === false) {
      const error = new Error(
        (payload && payload.error && payload.error.message) || 'คำขอไม่สำเร็จ (' + response.status + ')'
      );
      error.status = response.status;
      error.code = payload && payload.error ? payload.error.code : undefined;
      error.details = (payload && payload.error && payload.error.details) || [];
      throw error;
    }

    const data = payload.data;
    if (data && typeof data === 'object' && payload.meta) {
      Object.defineProperty(data, 'meta', { value: payload.meta, enumerable: false });
    }
    return data;
  }

  let flashTimer = null;

  function showMessage(text, type) {
    const box = document.getElementById('flash');
    if (!box) return;
    box.innerHTML = '';
    const item = document.createElement('div');
    item.className = 'flash ' + (type === 'error' ? 'flash-error' : 'flash-success');
    item.textContent = text;
    box.appendChild(item);
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function () {
      box.innerHTML = '';
    }, 5000);
  }

  function formToJSON(form) {
    const data = {};
    const entries = new FormData(form);
    entries.forEach(function (value, key) {
      if (value === '') return;
      const field = form.elements[key];
      const numeric =
        (field && field.dataset && field.dataset.numeric === 'true') ||
        (field && field.type === 'number');
      data[key] = numeric ? Number(value) : value;
    });
    return data;
  }

  function formatError(error) {
    if (error && error.details && error.details.length) {
      return error.details.map(function (detail) {
        return detail.field + ': ' + detail.message;
      }).join('; ');
    }
    return (error && error.message) || 'คำขอไม่สำเร็จ';
  }

  document.addEventListener('DOMContentLoaded', function () {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async function () {
        try {
          await apiFetch('POST', '/api/auth/logout');
        } catch (_) {
          /* logging out is idempotent */
        }
        window.location.href = '/';
      });
    }
  });

  window.App = { apiFetch: apiFetch, showMessage: showMessage, formToJSON: formToJSON, formatError: formatError };
})();

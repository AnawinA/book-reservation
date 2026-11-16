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

  function initTabs() {
    const tabs = document.querySelectorAll('.subnav a[role="tab"], .subnav a[href^="#"]');
    const panels = document.querySelectorAll('.tab-panel');

    if (!tabs.length || !panels.length) return;

    function activateTab(targetId, updateHash) {
      let found = false;

      tabs.forEach(function (tab) {
        const href = tab.getAttribute('href') || '';
        const id = href.replace(/^#/, '');
        const match = id === targetId;
        if (match) found = true;
        tab.classList.toggle('is-active', match);
        tab.setAttribute('aria-selected', match ? 'true' : 'false');
      });

      if (!found) {
        targetId = 'inventory';
        tabs.forEach(function (tab) {
          const href = tab.getAttribute('href') || '';
          const match = href.replace(/^#/, '') === 'inventory';
          tab.classList.toggle('is-active', match);
          tab.setAttribute('aria-selected', match ? 'true' : 'false');
        });
      }

      panels.forEach(function (panel) {
        if (panel.id === targetId) {
          panel.removeAttribute('hidden');
          panel.classList.add('is-active');
        } else {
          panel.setAttribute('hidden', '');
          panel.classList.remove('is-active');
        }
      });

      if (updateHash && window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '#' + targetId);
      }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function (event) {
        event.preventDefault();
        const href = tab.getAttribute('href') || '';
        const id = href.replace(/^#/, '');
        activateTab(id, true);
      });
    });

    const initialHash = (window.location.hash || '').replace(/^#/, '');
    if (initialHash && document.getElementById(initialHash)) {
      activateTab(initialHash, false);
    } else {
      activateTab('inventory', false);
    }

    window.addEventListener('hashchange', function () {
      const hash = (window.location.hash || '').replace(/^#/, '');
      if (hash && document.getElementById(hash)) {
        activateTab(hash, false);
      }
    });
  }

  function initModals() {
    const openButtons = document.querySelectorAll('.open-modal-btn');
    const closeButtons = document.querySelectorAll('.modal-close-btn, .modal-cancel-btn');
    const modals = document.querySelectorAll('.modal-backdrop');

    function openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (!modal) return;
      modal.removeAttribute('hidden');
      document.body.classList.add('modal-open');
      const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea, button[type="submit"]');
      if (firstInput) firstInput.focus();
    }

    function closeModal(modal) {
      if (!modal) return;
      modal.setAttribute('hidden', '');
      const anyOpen = Array.from(modals).some(function (m) {
        return !m.hasAttribute('hidden');
      });
      if (!anyOpen) {
        document.body.classList.remove('modal-open');
      }
    }

    function closeAllModals() {
      modals.forEach(closeModal);
    }

    openButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const modalId = btn.dataset.modal;
        if (modalId) openModal(modalId);
      });
    });

    closeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const modal = btn.closest('.modal-backdrop');
        if (modal) closeModal(modal);
      });
    });

    modals.forEach(function (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          closeModal(modal);
        }
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeAllModals();
      }
    });
  }

  function dismissModalOf(element) {
    const modal = element && element.closest('.modal-backdrop');
    if (modal) {
      modal.setAttribute('hidden', '');
      document.body.classList.remove('modal-open');
    }
  }

  function initInventorySearch() {
    const searchInput = document.getElementById('inventorySearch');
    const statusSelect = document.getElementById('inventoryStatusFilter');
    const clearBtn = document.getElementById('inventoryClearBtn');
    const table = document.getElementById('inventoryTable');
    const countChip = document.getElementById('inventoryCountChip');
    const emptyRow = document.getElementById('inventoryEmptySearch');

    if (!searchInput || !table) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr:not(#inventoryEmptySearch)'));
    const totalCount = rows.length;

    function filterInventory() {
      const query = (searchInput.value || '').trim().toLowerCase();
      const statusFilter = (statusSelect ? statusSelect.value : '').toUpperCase();

      let visibleCount = 0;

      rows.forEach(function (row) {
        const text = row.textContent.toLowerCase();
        const rowStatus = (row.dataset.status || '').toUpperCase();

        const matchesQuery = !query || text.includes(query);
        const matchesStatus = !statusFilter || rowStatus === statusFilter;

        if (matchesQuery && matchesStatus) {
          row.style.display = '';
          visibleCount++;
        } else {
          row.style.display = 'none';
        }
      });

      if (countChip) {
        if (query || statusFilter) {
          countChip.textContent = 'พบ ' + visibleCount + ' จาก ' + totalCount + ' เล่ม';
        } else {
          countChip.textContent = totalCount + ' เล่ม';
        }
      }

      if (emptyRow) {
        emptyRow.hidden = visibleCount > 0;
      }

      if (clearBtn) {
        clearBtn.style.visibility = (query || statusFilter) ? 'visible' : 'hidden';
      }
    }

    searchInput.addEventListener('input', filterInventory);
    if (statusSelect) {
      statusSelect.addEventListener('change', filterInventory);
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        searchInput.value = '';
        if (statusSelect) statusSelect.value = '';
        filterInventory();
        searchInput.focus();
      });
      clearBtn.style.visibility = 'hidden';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTabs();
    initModals();
    initInventorySearch();

    const base = '/api/shops/' + shopId();

    const donationForm = document.getElementById('donationForm');
    if (donationForm) {
      donationForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        try {
          const result = await window.App.apiFetch('POST', base + '/donations', window.App.formToJSON(donationForm));
          dismissModalOf(donationForm);
          window.App.showMessage(
            'บันทึกการบริจาคเรียบร้อย (' + result.item.barcode + '), ได้รับ ' + result.pointsAwarded + ' แต้ม'
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
          dismissModalOf(borrowForm);
          window.App.showMessage('ยืมหนังสือ ' + result.item.barcode + ' สำเร็จ กำหนดส่งคืน ' + result.item.dueDate);
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
          dismissModalOf(returnForm);
          window.App.showMessage(
            'คืนหนังสือสำเร็จ' + (result.wasOverdue ? ' (รายการนี้เกินกำหนดส่ง)' : '')
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
          dismissModalOf(statusForm);
          window.App.showMessage('สถานะของ ' + item.barcode + ' เปลี่ยนเป็น ' + item.status + ' แล้ว');
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
          dismissModalOf(claimForm);
          window.App.showMessage(
            'รหัสแลกของรางวัลถูกต้องสำหรับ ' + result.customer.username + ' (' + result.reward.title + ')'
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

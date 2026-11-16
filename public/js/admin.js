'use strict';

(function () {
  const ENDPOINTS = {
    shop: '/api/admin/shops',
    book: '/api/admin/books',
    campaign: '/api/admin/campaigns',
    reward: '/api/admin/rewards'
  };

  const MODAL_CONFIG = {
    shop: {
      createTitle: 'สร้างร้านค้าใหม่',
      editTitle: 'แก้ไขข้อมูลร้านค้า',
      createBtn: 'สร้างร้านค้า'
    },
    book: {
      createTitle: 'เพิ่มหนังสือใหม่เข้าระบบ',
      editTitle: 'แก้ไขข้อมูลหนังสือ',
      createBtn: 'เพิ่มหนังสือ'
    },
    campaign: {
      createTitle: 'สร้างแคมเปญใหม่',
      editTitle: 'แก้ไขข้อมูลแคมเปญ',
      createBtn: 'สร้างแคมเปญ'
    },
    reward: {
      createTitle: 'เพิ่มของรางวัลใหม่',
      editTitle: 'แก้ไขข้อมูลของรางวัล',
      createBtn: 'เพิ่มของรางวัล'
    }
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
        targetId = 'books';
        tabs.forEach(function (tab) {
          const href = tab.getAttribute('href') || '';
          const match = href.replace(/^#/, '') === 'books';
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
      activateTab('books', false);
    }

    window.addEventListener('hashchange', function () {
      const hash = (window.location.hash || '').replace(/^#/, '');
      if (hash && document.getElementById(hash)) {
        activateTab(hash, false);
      }
    });
  }

  function initModals(forms) {
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
        if (!modalId) return;
        const entity = modalId.replace(/^modal-/, '');
        const form = forms[entity];
        const config = MODAL_CONFIG[entity];

        if (form) {
          form.reset();
          delete form.dataset.id;
          form.dataset.mode = 'create';
          if (config) {
            const modal = document.getElementById(modalId);
            if (modal) {
              const titleEl = modal.querySelector('h2');
              if (titleEl) titleEl.textContent = config.createTitle;
            }
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = config.createBtn;
          }
        }
        openModal(modalId);
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

    return {
      openModal: openModal,
      closeModal: closeModal,
      closeAllModals: closeAllModals
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const forms = {
      shop: document.getElementById('shopForm'),
      book: document.getElementById('bookForm'),
      campaign: document.getElementById('campaignForm'),
      reward: document.getElementById('rewardForm')
    };

    initTabs();
    const modalHelper = initModals(forms);

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
            window.App.showMessage('บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว');
          } else {
            await window.App.apiFetch('POST', ENDPOINTS[entity], payload);
            window.App.showMessage('สร้างข้อมูลเรียบร้อยแล้ว');
          }
          const modal = form.closest('.modal-backdrop');
          if (modal) modalHelper.closeModal(modal);
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

        const config = MODAL_CONFIG[entity];
        const modalId = 'modal-' + entity;
        const modal = document.getElementById(modalId);
        if (modal && config) {
          const titleEl = modal.querySelector('h2');
          if (titleEl) titleEl.textContent = config.editTitle;
        }

        const submit = form.querySelector('button[type="submit"]');
        if (submit) submit.textContent = 'บันทึกการเปลี่ยนแปลง';

        modalHelper.openModal(modalId);
      });
    });

    document.querySelectorAll('.delete-shop-btn').forEach(function (button) {
      button.addEventListener('click', async function () {
        if (!window.confirm('ยืนยันการลบร้านค้านี้หรือไม่? ร้านค้าต้องไม่มีหนังสือที่กำลังถูกยืมอยู่')) return;
        try {
          await window.App.apiFetch('DELETE', '/api/admin/shops/' + encodeURIComponent(button.dataset.id));
          window.App.showMessage('ลบร้านค้าเรียบร้อยแล้ว');
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

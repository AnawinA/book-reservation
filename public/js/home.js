'use strict';

(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const authModal = document.getElementById('authModal');
    const tabLoginBtn = document.getElementById('tabLoginBtn');
    const tabRegisterBtn = document.getElementById('tabRegisterBtn');
    const authLoginPanel = document.getElementById('authLoginPanel');
    const authRegisterPanel = document.getElementById('authRegisterPanel');
    const authModalClose = document.getElementById('authModalClose');

    function switchAuthTab(mode) {
      const isLogin = mode === 'login';

      if (tabLoginBtn && tabRegisterBtn) {
        tabLoginBtn.classList.toggle('is-active', isLogin);
        tabLoginBtn.setAttribute('aria-selected', isLogin ? 'true' : 'false');
        tabRegisterBtn.classList.toggle('is-active', !isLogin);
        tabRegisterBtn.setAttribute('aria-selected', !isLogin ? 'true' : 'false');
      }

      if (authLoginPanel && authRegisterPanel) {
        if (isLogin) {
          authLoginPanel.removeAttribute('hidden');
          authLoginPanel.classList.add('is-active');
          authRegisterPanel.setAttribute('hidden', '');
          authRegisterPanel.classList.remove('is-active');
          const input = authLoginPanel.querySelector('input:not([type="hidden"])');
          if (input) input.focus();
        } else {
          authRegisterPanel.removeAttribute('hidden');
          authRegisterPanel.classList.add('is-active');
          authLoginPanel.setAttribute('hidden', '');
          authLoginPanel.classList.remove('is-active');
          const input = authRegisterPanel.querySelector('input:not([type="hidden"])');
          if (input) input.focus();
        }
      }
    }

    function openAuthModal(mode) {
      if (!authModal) return;
      switchAuthTab(mode || 'login');
      authModal.removeAttribute('hidden');
      document.body.classList.add('modal-open');
    }

    function closeAuthModal() {
      if (!authModal) return;
      authModal.setAttribute('hidden', '');
      document.body.classList.remove('modal-open');
    }

    if (tabLoginBtn) {
      tabLoginBtn.addEventListener('click', function () {
        switchAuthTab('login');
      });
    }

    if (tabRegisterBtn) {
      tabRegisterBtn.addEventListener('click', function () {
        switchAuthTab('register');
      });
    }

    document.querySelectorAll('.switch-to-register').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchAuthTab('register');
      });
    });

    document.querySelectorAll('.switch-to-login').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchAuthTab('login');
      });
    });

    document.querySelectorAll('.open-auth-btn, a[href$="#loginForm"], a[href$="#authModal"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const mode = btn.dataset.authMode || 'login';
        openAuthModal(mode);
      });
    });

    if (authModalClose) {
      authModalClose.addEventListener('click', closeAuthModal);
    }

    if (authModal) {
      authModal.addEventListener('click', function (e) {
        if (e.target === authModal) {
          closeAuthModal();
        }
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && authModal && !authModal.hasAttribute('hidden')) {
        closeAuthModal();
      }
    });

    // Auto-open if URL hash is #loginForm, #authModal, or query auth=required
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    if (hash === '#loginForm' || hash === '#authModal' || urlParams.get('auth') === 'required') {
      openAuthModal('login');
    }

    const loginForm = document.getElementById('loginFormEl');
    if (loginForm) {
      loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        try {
          const data = await window.App.apiFetch('POST', '/api/auth/login', window.App.formToJSON(loginForm));
          closeAuthModal();
          window.App.showMessage('ยินดีต้อนรับกลับ, ' + data.user.username);
          window.location.href = data.redirectTo;
        } catch (error) {
          window.App.showMessage(window.App.formatError(error), 'error');
        }
      });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        try {
          const user = await window.App.apiFetch('POST', '/api/auth/register', window.App.formToJSON(registerForm));
          registerForm.reset();
          window.App.showMessage('สร้างบัญชี ' + user.username + ' สำเร็จแล้ว กรุณาเข้าสู่ระบบ');
          switchAuthTab('login');
          if (loginForm) {
            loginForm.elements.username.value = user.username;
            loginForm.elements.password.focus();
          }
        } catch (error) {
          window.App.showMessage(window.App.formatError(error), 'error');
        }
      });
    }
  });
})();

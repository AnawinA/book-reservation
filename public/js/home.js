'use strict';

(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginFormEl');
    if (loginForm) {
      loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        try {
          const data = await window.App.apiFetch('POST', '/api/auth/login', window.App.formToJSON(loginForm));
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
          const login = document.getElementById('loginFormEl');
          if (login) {
            login.elements.username.value = user.username;
            login.elements.password.focus();
          }
        } catch (error) {
          window.App.showMessage(window.App.formatError(error), 'error');
        }
      });
    }
  });
})();

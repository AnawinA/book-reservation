'use strict';

/*
 * Theme bootstrap. Loaded synchronously in <head> so the correct palette is
 * applied before the first paint (no flash of the wrong theme). The choice is
 * persisted, and falls back to the operating system preference.
 */
(function () {
  var STORAGE_KEY = 'bbs-theme';
  var root = document.documentElement;

  function readStored() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function systemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function apply(theme) {
    var next = theme === 'dark' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);

    var button = document.getElementById('themeToggle');
    if (button) {
      var goingTo = next === 'dark' ? 'สว่าง' : 'มืด';
      button.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
      button.setAttribute('aria-label', 'สลับเป็นโหมด' + goingTo);
      button.setAttribute('title', 'สลับเป็นโหมด' + goingTo);
    }
  }

  apply(readStored() || systemTheme());

  document.addEventListener('DOMContentLoaded', function () {
    apply(root.getAttribute('data-theme') || systemTheme());

    var button = document.getElementById('themeToggle');
    if (button) {
      button.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch (_) {
          /* private mode: the toggle still works for this page view */
        }
        apply(next);
      });
    }

    if (window.matchMedia) {
      var query = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function (event) {
        if (!readStored()) apply(event.matches ? 'dark' : 'light');
      };
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', onChange);
      } else if (typeof query.addListener === 'function') {
        query.addListener(onChange);
      }
    }
  });
})();

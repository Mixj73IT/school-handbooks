// Success flashes carry their meaning in the moment; let them step aside
// after a while so the screen returns to content. Errors stay until dismissed
// by navigation.
(function () {
  document.querySelectorAll('[data-autohide]').forEach((el) => {
    el.setAttribute('role', 'status');
    const t = setTimeout(() => {
      el.style.transition = 'opacity 0.4s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 450);
    }, 5200);
    // Pause the countdown while the user is reading with pointer or keyboard.
    el.addEventListener('mouseenter', () => clearTimeout(t));
  });
})();

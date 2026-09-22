// Year switcher: submits the form as soon as a year is picked, so the
// selection feels instant (no extra "Go" button to hunt for).
(function () {
  const select = document.getElementById('year-select');
  const form = document.getElementById('year-form');
  if (!select || !form) return;
  select.addEventListener('change', function () {
    form.submit();
  });
})();

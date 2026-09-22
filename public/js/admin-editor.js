// Tiny markdown toolbar for the handbook editor.
// Wraps the selected text or inserts a snippet at the cursor — no framework.
(function () {
  const textarea = document.getElementById('page-body');
  const toolbar = document.getElementById('editor-toolbar');
  if (!textarea || !toolbar) return;

  function wrapSelection(before, after = before, placeholder = 'text') {
    const { selectionStart: start, selectionEnd: end, value } = textarea;
    const selected = value.slice(start, end) || placeholder;
    textarea.value = value.slice(0, start) + before + selected + after + value.slice(end);
    textarea.focus();
    textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
  }

  function insertLine(snippet) {
    const { selectionStart: pos, value } = textarea;
    const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
    textarea.value = value.slice(0, lineStart) + snippet + value.slice(lineStart);
    textarea.focus();
    textarea.setSelectionRange(lineStart + snippet.length, lineStart + snippet.length);
  }

  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-md]');
    if (!btn) return;
    e.preventDefault();
    switch (btn.dataset.md) {
      case 'h2': insertLine('## '); break;
      case 'h3': insertLine('### '); break;
      case 'bold': wrapSelection('**'); break;
      case 'italic': wrapSelection('*'); break;
      case 'list': insertLine('- '); break;
      case 'numlist': insertLine('1. '); break;
      case 'quote': insertLine('> '); break;
      case 'table': insertLine('| Column | Column |\n| --- | --- |\n| value | value |\n'); break;
      case 'link': wrapSelection('[', '](https://)', 'link text'); break;
      default: break;
    }
  });
})();

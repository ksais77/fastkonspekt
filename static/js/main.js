(() => {
  const fileInput = document.getElementById('document-file');
  const dropZone = document.getElementById('drop-zone');
  const fileSelected = document.getElementById('file-selected');
  const fileName = document.getElementById('file-name');
  const fileSize = document.getElementById('file-size');
  const fileError = document.getElementById('file-error');
  const sourceText = document.getElementById('source-text');
  const editor = document.getElementById('summary-editor');
  const preview = document.getElementById('summary-preview');
  const emptyState = document.getElementById('empty-state');
  const editorArea = document.getElementById('editor-area');
  const resultActions = document.getElementById('result-actions');
  const formMessage = document.getElementById('form-message');
  const resultStatus = document.getElementById('result-status');
  let selectedFile = null;
  let currentView = 'edit';
  let savedSummaries = [];

  const formatBytes = (bytes) => bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} КБ`
    : `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;

  function showFile(file) {
    fileError.textContent = '';
    const allowed = ['pdf', 'docx', 'txt'];
    const extension = file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(extension)) {
      fileError.textContent = 'Неподдерживаемый формат. Выбери PDF, DOCX или TXT.';
      fileInput.value = '';
      selectedFile = null;
      fileSelected.hidden = true;
      return;
    }
    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    fileSelected.hidden = false;
  }

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) showFile(fileInput.files[0]);
  });
  document.getElementById('remove-file').addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    fileSelected.hidden = true;
    fileError.textContent = '';
  });

  ['dragenter', 'dragover'].forEach(type => dropZone.addEventListener(type, e => {
    e.preventDefault(); dropZone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(type => dropZone.addEventListener(type, e => {
    e.preventDefault(); dropZone.classList.remove('dragover');
  }));
  dropZone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file) showFile(file);
  });

  document.querySelectorAll('[data-source-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-source-tab]').forEach(item => {
        item.classList.toggle('active', item === tab);
        item.setAttribute('aria-selected', item === tab ? 'true' : 'false');
      });
      document.querySelectorAll('[data-source-panel]').forEach(panel => {
        panel.hidden = panel.dataset.sourcePanel !== tab.dataset.sourceTab;
      });
      formMessage.textContent = '';
    });
  });

  sourceText.addEventListener('input', () => {
    document.getElementById('source-counter').textContent =
      `${sourceText.value.length.toLocaleString('ru-RU')} символов`;
  });

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  // Lightweight Markdown preview for the MVP interface. For production, use a
  // vetted Markdown parser on the server and sanitize generated HTML.
  function renderMarkdown(markdown) {
    let html = escapeHtml(markdown);
    html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^\s*[-*] (.*)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');
    return `<p>${html}</p>`;
  }

  function updatePreview() {
    preview.innerHTML = renderMarkdown(editor.value);
  }

  function setView(view) {
    currentView = view;
    document.querySelectorAll('[data-view]').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === view);
    });
    editor.hidden = view !== 'edit';
    preview.hidden = view !== 'preview';
    if (view === 'preview') updatePreview();
  }
  document.querySelectorAll('[data-view]').forEach(tab =>
    tab.addEventListener('click', () => setView(tab.dataset.view))
  );

  function insertMarkdown(before, after = before, placeholder = 'текст') {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.slice(start, end) || placeholder;
    editor.setRangeText(`${before}${selected}${after}`, start, end, 'select');
    editor.focus();
    updatePreview();
  }
  document.querySelectorAll('[data-format]').forEach(button => {
    button.addEventListener('click', () => {
      const format = button.dataset.format;
      if (format === 'bold') insertMarkdown('**');
      if (format === 'italic') insertMarkdown('*');
      if (format === 'heading') insertMarkdown('## ', '', 'Заголовок');
      if (format === 'ul') insertMarkdown('- ', '', 'Новый пункт');
      if (format === 'ol') insertMarkdown('1. ', '', 'Новый пункт');
    });
  });

  editor.addEventListener('input', () => {
    document.getElementById('save-indicator').textContent = 'Есть несохранённые изменения';
    if (currentView === 'preview') updatePreview();
  });

  document.getElementById('generate-button').addEventListener('click', () => {
    const activeTab = document.querySelector('[data-source-tab].active').dataset.sourceTab;
    const pasted = sourceText.value.trim();
    formMessage.textContent = '';
    if (activeTab === 'file' && !selectedFile) {
      formMessage.textContent = 'Сначала выбери файл для загрузки.';
      return;
    }
    if (activeTab === 'text' && !pasted) {
      formMessage.textContent = 'Вставь текст, из которого нужно сделать конспект.';
      return;
    }
    if (activeTab === 'file' && selectedFile.size === 0) {
      formMessage.textContent = 'Файл пустой. Выбери другой документ.';
      return;
    }
    if (activeTab === 'file' && selectedFile.size > 15 * 1024 * 1024) {
      formMessage.textContent = 'Файл слишком большой. Выбери документ меньшего размера.';
      return;
    }

    // Temporary UI stub: the real endpoint will extract the document text,
    // call the model and store the result on the FastAPI backend.
    const sourceName = activeTab === 'file' ? selectedFile.name : 'Вставленный текст';
    const length = document.querySelector('input[name="length"]:checked').value;
    const structure = document.querySelector('input[name="structure"]:checked').value.trim();
    const sourceExcerpt = activeTab === 'text' ? pasted.slice(0, 260) : 'Материал документа будет обработан сервером после подключения backend.';
    editor.value = `# ${sourceName.replace(/\.[^.]+$/, '')}\n\n## Основные положения\n\n- Подготовлен материал для создания конспекта.\n- Выбранный объём: ${length === 'short' ? 'краткий' : length === 'medium' ? 'средний' : 'подробный'}.\n- Выбранная структура: ${structure === 'blocks' ? 'по блокам' : 'список тезисов'}.\n\n## Исходный материал\n\n${sourceExcerpt}\n\n> Демонстрационная заглушка интерфейса. Реальная генерация появится после подключения API и языковой модели.`;
    emptyState.hidden = true;
    editorArea.hidden = false;
    resultActions.hidden = false;
    resultStatus.innerHTML = '<i></i> Демонстрационный результат';
    setView('edit');
    document.getElementById('save-indicator').textContent = 'Изменения ещё не сохранены';
  });

  function saveCurrentSummary() {
    const title = editor.value.split('\n').find(line => line.startsWith('# '))?.replace(/^# /, '') || 'Новый конспект';
    const item = { id: Date.now(), title, content: editor.value, date: new Date().toLocaleDateString('ru-RU') };
    savedSummaries.unshift(item);
    renderLibrary();
    document.getElementById('save-indicator').textContent = 'Сохранено в демонстрационной библиотеке';
  }

  document.getElementById('save-summary').addEventListener('click', saveCurrentSummary);
  document.getElementById('save-copy').addEventListener('click', saveCurrentSummary);

  function renderLibrary() {
    const list = document.getElementById('library-list');
    const empty = document.getElementById('library-empty');
    list.innerHTML = '';
    empty.hidden = savedSummaries.length > 0;
    document.getElementById('library-count').textContent =
      `${savedSummaries.length} ${savedSummaries.length === 1 ? 'документ' : 'документов'}`;
    savedSummaries.forEach(item => {
      const row = document.createElement('div');
      row.className = 'library-item';
      const title = document.createElement('span');
      title.className = 'library-item-title';
      title.textContent = item.title;
      const date = document.createElement('small');
      date.textContent = item.date;
      const open = document.createElement('button');
      open.type = 'button'; open.textContent = 'Открыть';
      open.addEventListener('click', () => {
        editor.value = item.content;
        emptyState.hidden = true; editorArea.hidden = false; resultActions.hidden = false;
        resultStatus.innerHTML = '<i></i> Сохранённый конспект';
        setView('edit');
        document.getElementById('save-indicator').textContent = 'Открыта сохранённая версия';
        document.getElementById('create').scrollIntoView({ behavior: 'smooth' });
      });
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'delete-item'; remove.textContent = 'Удалить';
      remove.addEventListener('click', () => {
        savedSummaries = savedSummaries.filter(saved => saved.id !== item.id);
        renderLibrary();
      });
      row.append(title, date, open, remove);
      list.append(row);
    });
  }

  document.getElementById('download-pdf').addEventListener('click', () => {
    alert('Экспорт PDF подключим к backend через WeasyPrint. Сейчас это демонстрационная кнопка.');
  });
})();


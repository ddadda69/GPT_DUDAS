const API_URL = 'https://api.github.com/repos/ddadda69/GPT_DUDAS/contents/data/current.json?ref=main';

const app = document.getElementById('app');
const statusEl = document.getElementById('status');
const reloadBtn = document.getElementById('reload');

let currentPlan = null;
let currentSha = '';

if (window.marked) {
  window.marked.setOptions({
    gfm: true,
    breaks: false
  });
}

function decodeBase64Utf8(base64) {
  const clean = String(base64 || '').replace(/\s/g, '');
  const bytes = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function sanitizeHtml(html) {
  if (window.DOMPurify) return window.DOMPurify.sanitize(html);
  return html;
}

function renderMarkdown(target, markdown) {
  const source = String(markdown || '');
  if (window.marked) {
    target.innerHTML = sanitizeHtml(window.marked.parse(source));
  } else {
    target.textContent = source;
  }
}

function renderMarkdownInline(target, markdown) {
  const source = String(markdown || '');
  if (window.marked && window.marked.parseInline) {
    target.innerHTML = sanitizeHtml(window.marked.parseInline(source));
  } else {
    target.textContent = source;
  }
}

function optionBadge(text, className) {
  return el('span', `badge ${className}`, text);
}

function setOptionText(textEl, text, recommended, modified, showRecommended) {
  textEl.textContent = '';

  const body = el('div', 'markdown-body');
  renderMarkdown(body, text);
  textEl.appendChild(body);

  if ((recommended && showRecommended) || modified) {
    const badges = el('div', 'option-badges');
    if (recommended && showRecommended) {
      badges.appendChild(optionBadge('Recomendada', 'recommended'));
    }
    if (modified) {
      badges.appendChild(optionBadge('Editada', 'modified'));
    }
    textEl.appendChild(badges);
  }
}

function radioId(sectionIndex, optionId) {
  return `q-${sectionIndex}-${String(optionId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function createEditableOption(section, sectionIndex, option, inputType, checked, optionCount) {
  const row = el('div', 'option-row');
  row.dataset.optionId = String(option.id);

  const input = document.createElement('input');
  input.type = inputType;
  input.className = 'choice';
  input.name = inputType === 'radio'
    ? `q-${sectionIndex}`
    : `q-${sectionIndex}-${option.id}`;
  input.value = String(option.id);
  input.id = radioId(sectionIndex, option.id);
  input.checked = Boolean(checked);
  input.setAttribute('aria-label', optionCount > 1 ? `Opción ${option.id}` : 'Implementar');

  const content = el('div', 'option-content');

  if (optionCount > 1) {
    const kicker = el('label', 'option-kicker', `Opción ${option.id}`);
    kicker.htmlFor = input.id;
    content.appendChild(kicker);
  }

  const textEl = el('div', 'option-text');
  textEl.dataset.original = option.text || '';
  setOptionText(
    textEl,
    option.text || '',
    Boolean(option.recommended),
    false,
    optionCount > 1
  );
  content.appendChild(textEl);

  const editBtn = el('button', 'edit-btn', 'Editar');
  editBtn.type = 'button';

  const editor = el('div', 'option-editor');
  const editArea = document.createElement('textarea');
  editArea.rows = 10;
  editArea.spellcheck = true;
  editArea.placeholder = 'Edita el contenido en Markdown…';

  const editorHelp = el(
    'div',
    'editor-help',
    'Admite Markdown: listas, **negrita**, `código` y bloques ```.'
  );

  const editorActions = el('div', 'editor-actions');
  const saveBtn = el('button', 'save-edit', 'Guardar');
  saveBtn.type = 'button';
  const cancelBtn = el('button', 'cancel-edit', 'Cancelar');
  cancelBtn.type = 'button';
  editorActions.append(saveBtn, cancelBtn);
  editor.append(editArea, editorHelp, editorActions);

  const selectOption = () => {
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  textEl.addEventListener('click', event => {
    if (event.target.closest('a, button')) return;
    selectOption();
  });

  editBtn.addEventListener('click', () => {
    selectOption();
    editArea.value = textEl.dataset.custom || textEl.dataset.original || '';
    editor.classList.add('open');
    editBtn.setAttribute('aria-expanded', 'true');
    editArea.focus();
  });

  saveBtn.addEventListener('click', () => {
    const value = editArea.value.trim();
    if (!value) return;
    textEl.dataset.custom = value;
    setOptionText(
      textEl,
      value,
      Boolean(option.recommended),
      true,
      optionCount > 1
    );
    editor.classList.remove('open');
    editBtn.setAttribute('aria-expanded', 'false');
  });

  cancelBtn.addEventListener('click', () => {
    editor.classList.remove('open');
    editBtn.setAttribute('aria-expanded', 'false');
  });

  row.append(input, content, editBtn, editor);
  return row;
}

function createSkipOption(sectionIndex) {
  const row = el('div', 'option-row skip-row');
  row.dataset.optionId = '__skip';

  const input = document.createElement('input');
  input.type = 'radio';
  input.className = 'choice skip-choice';
  input.name = `q-${sectionIndex}`;
  input.value = '__skip';
  input.id = `q-${sectionIndex}-skip`;
  input.setAttribute('aria-label', 'No implementar');

  const label = el('label', 'skip-label', 'No implementar');
  label.htmlFor = input.id;

  const help = el('div', 'skip-help', 'No hacer ningún cambio en este punto.');
  const content = el('div', 'skip-content');
  content.append(label, help);

  row.append(input, content);
  return row;
}

function createOtherOption(sectionIndex, inputType, defaultChecked) {
  const row = el('div', 'option-row other-row');
  row.dataset.optionId = '__other';

  const input = document.createElement('input');
  input.type = inputType;
  input.className = 'choice other-choice';
  input.name = inputType === 'radio' ? `q-${sectionIndex}` : `q-${sectionIndex}-other`;
  input.value = '__other';
  input.id = `q-${sectionIndex}-other`;
  input.checked = Boolean(defaultChecked);

  const content = el('div', 'other-content');
  const label = el('label', 'option-kicker', 'Otra');
  label.htmlFor = input.id;

  const holder = el('div', 'other-holder');
  const otherInput = document.createElement('textarea');
  otherInput.className = 'other-input';
  otherInput.placeholder = 'Escribe la alternativa completa en Markdown…';
  otherInput.rows = 4;
  holder.appendChild(otherInput);
  content.append(label, holder);

  const update = () => holder.classList.toggle('visible', input.checked);
  input.addEventListener('change', update);
  update();

  row.append(input, content);
  return row;
}

function createNote(section) {
  if (section.allowNote === false) return null;

  const wrap = el('div', 'note-wrap');
  const label = el('label', 'note-label', section.noteLabel || 'Nota');
  const area = document.createElement('textarea');
  area.className = 'note-input';
  area.rows = 3;
  area.placeholder = section.notePlaceholder || 'Añade un matiz opcional para este punto…';
  label.appendChild(area);
  wrap.appendChild(label);
  return wrap;
}

function renderChoiceSection(card, section, sectionIndex, multiple) {
  const inputType = multiple ? 'checkbox' : 'radio';
  const defaults = multiple
    ? new Set((section.defaultOptions || []).map(String))
    : new Set(
        section.defaultOption !== undefined && section.defaultOption !== null
          ? [String(section.defaultOption)]
          : []
      );

  const options = section.options || [];
  options.forEach(option => {
    const checked = defaults.has(String(option.id)) || Boolean(option.selected);
    card.appendChild(
      createEditableOption(
        section,
        sectionIndex,
        option,
        inputType,
        checked,
        options.length
      )
    );
  });

  if (!multiple) {
    card.appendChild(createSkipOption(sectionIndex));
  }

  if (section.allowOther) {
    card.appendChild(
      createOtherOption(sectionIndex, inputType, Boolean(section.defaultOther))
    );
  }
}

function renderTextSection(card, section) {
  const area = document.createElement('textarea');
  area.className = 'free-text';
  area.rows = section.rows || 4;
  area.placeholder = section.placeholder || 'Escribe tu respuesta…';
  area.value = section.defaultValue || '';
  card.appendChild(area);
}

function renderBooleanSection(card, section, sectionIndex) {
  const values = [
    { value: 'true', label: section.trueLabel || 'Sí' },
    { value: 'false', label: section.falseLabel || 'No' }
  ];

  const holder = el('div', 'boolean-holder');
  values.forEach(item => {
    const row = el('label', 'boolean-row');
    const input = document.createElement('input');
    input.type = 'radio';
    input.className = 'boolean-choice';
    input.name = `q-${sectionIndex}`;
    input.value = item.value;
    input.checked = section.default === (item.value === 'true');
    row.append(input, document.createTextNode(item.label));
    holder.appendChild(row);
  });
  card.appendChild(holder);
}

function renderSection(section, sectionIndex) {
  const card = el('section', 'card');
  card.dataset.sectionIndex = String(sectionIndex);
  card.dataset.type = section.type || 'single';

  const title = el('h2', 'section-title');
  renderMarkdownInline(
    title,
    section.title || `${sectionIndex + 1}. ${section.id || 'Decisión'}`
  );
  card.appendChild(title);

  if (section.description) {
    const description = el('div', 'description markdown-body');
    renderMarkdown(description, section.description);
    card.appendChild(description);
  }

  switch (card.dataset.type) {
    case 'multiple':
      renderChoiceSection(card, section, sectionIndex, true);
      break;
    case 'text':
      renderTextSection(card, section);
      break;
    case 'boolean':
      renderBooleanSection(card, section, sectionIndex);
      break;
    case 'single':
    default:
      renderChoiceSection(card, section, sectionIndex, false);
      break;
  }

  const note = createNote(section);
  if (note) card.appendChild(note);

  return card;
}

function selectedOptionMarkdown(row) {
  const textEl = row?.querySelector('.option-text');
  if (!textEl) return '';
  return textEl.dataset.custom || textEl.dataset.original || '';
}

function buildOutput() {
  if (!currentPlan) return '';

  const lines = [];
  const id = currentPlan.id || 'plan';
  const version = currentPlan.version !== undefined ? ` · v${currentPlan.version}` : '';
  lines.push(`Plan: ${id}${version}`, '');

  [...document.querySelectorAll('.card')].forEach((card, index) => {
    const section = currentPlan.sections[index] || {};
    const title = section.title || `${index + 1}. ${section.id || 'Decisión'}`;
    lines.push(title);

    const type = card.dataset.type;

    if (type === 'text') {
      lines.push(`Respuesta: ${card.querySelector('.free-text')?.value.trim() || ''}`);
    } else if (type === 'boolean') {
      const selected = card.querySelector('.boolean-choice:checked');
      lines.push(
        `Respuesta: ${
          selected
            ? selected.value === 'true'
              ? section.trueLabel || 'Sí'
              : section.falseLabel || 'No'
            : 'Sin seleccionar'
        }`
      );
    } else if (type === 'multiple') {
      const selected = [...card.querySelectorAll('.choice:checked')];
      const ids = selected.map(input =>
        input.value === '__other' ? 'Otra' : input.value
      );
      lines.push(`Respuesta: ${ids.length ? ids.join(', ') : 'Ninguna'}`);

      selected.forEach(input => {
        const row = input.closest('.option-row');
        if (input.value === '__other') {
          const value = row.querySelector('.other-input')?.value.trim();
          if (value) lines.push(`Otra: ${value}`);
        } else {
          const custom = row.querySelector('.option-text')?.dataset.custom;
          if (custom) lines.push('', `Opción ${input.value} editada:`, custom);
        }
      });
    } else {
      const selected = card.querySelector('.choice:checked');

      if (!selected) {
        lines.push('Decisión: Sin seleccionar');
      } else if (selected.value === '__skip') {
        lines.push('Decisión: No implementar');
      } else if (selected.value === '__other') {
        const value = selected
          .closest('.option-row')
          .querySelector('.other-input')
          ?.value.trim();
        lines.push(`Decisión: Otra${value ? ` - ${value}` : ''}`);
      } else {
        const row = selected.closest('.option-row');
        const optionCount = (section.options || []).length;
        const custom = row.querySelector('.option-text')?.dataset.custom;
        const label = optionCount === 1
          ? 'Implementar'
          : `Opción ${selected.value}`;

        lines.push(`Decisión: ${label}${custom ? ' (editada)' : ''}`);

        if (custom) {
          lines.push('', 'Contenido editado:', selectedOptionMarkdown(row));
        }
      }
    }

    const note = card.querySelector('.note-input')?.value.trim();
    if (note) lines.push(`Nota: ${note}`);
    lines.push('');
  });

  return lines.join('\n').trim();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

function renderPlan(plan, sha) {
  currentPlan = plan;
  currentSha = sha || '';
  app.textContent = '';

  const header = el('section', 'plan-header');
  const title = el('h1', 'plan-title');
  renderMarkdownInline(title, plan.title || 'Plan de decisiones');
  header.appendChild(title);

  if (plan.description) {
    const description = el('div', 'plan-description markdown-body');
    renderMarkdown(description, plan.description);
    header.appendChild(description);
  }

  const metaParts = [];
  if (plan.id) metaParts.push(plan.id);
  if (plan.version !== undefined) metaParts.push(`v${plan.version}`);
  if (currentSha) metaParts.push(`SHA ${currentSha.slice(0, 8)}`);
  if (metaParts.length) {
    header.appendChild(el('div', 'plan-meta', metaParts.join(' · ')));
  }
  app.appendChild(header);

  (plan.sections || []).forEach((section, index) => {
    app.appendChild(renderSection(section, index));
  });

  const actions = el('div', 'actions');
  const generateBtn = el('button', 'primary-btn', 'Generar respuesta');
  generateBtn.type = 'button';
  actions.appendChild(generateBtn);
  app.appendChild(actions);

  const result = el('section', 'result-card');
  const resultTitle = el('strong', 'result-title', 'Respuesta generada');
  const pre = el('pre', 'result-text');
  const copyBtn = el('button', 'copy-btn', 'Copiar para ChatGPT');
  copyBtn.type = 'button';
  result.append(resultTitle, pre, copyBtn);
  app.appendChild(result);

  const refreshResult = () => {
    pre.textContent = buildOutput();
    result.classList.add('visible');
    return pre.textContent;
  };

  generateBtn.addEventListener('click', refreshResult);

  copyBtn.addEventListener('click', async () => {
    const text = refreshResult();
    await copyText(text);
    const old = copyBtn.textContent;
    copyBtn.textContent = 'Copiado ✓';
    setTimeout(() => {
      copyBtn.textContent = old;
    }, 1000);
  });
}

function renderError(error) {
  app.textContent = '';
  const card = el('section', 'error-card');
  card.append(
    el('strong', '', 'No se pudo cargar data/current.json'),
    el('pre', '', String(error))
  );
  app.appendChild(card);
}

async function loadCurrent() {
  statusEl.textContent = 'Consultando main…';
  reloadBtn.disabled = true;

  try {
    const response = await fetch(`${API_URL}&t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' }
    });

    if (!response.ok) {
      throw new Error(`GitHub API respondió HTTP ${response.status}`);
    }

    const file = await response.json();
    if (!file.content) {
      throw new Error('GitHub no devolvió el contenido del JSON.');
    }

    const jsonText = decodeBase64Utf8(file.content);
    const plan = JSON.parse(jsonText);
    if (!Array.isArray(plan.sections)) {
      throw new Error('El JSON debe contener un array "sections".');
    }

    renderPlan(plan, file.sha);
    statusEl.textContent =
      `SHA ${String(file.sha || '').slice(0, 8)} · ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    statusEl.textContent = 'Error';
    renderError(error);
  } finally {
    reloadBtn.disabled = false;
  }
}

reloadBtn.addEventListener('click', loadCurrent);
loadCurrent();

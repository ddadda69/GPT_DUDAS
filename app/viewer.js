const API_URL = 'https://api.github.com/repos/ddadda69/GPT_DUDAS/contents/data/current.json?ref=main';
const app = document.getElementById('app');
const statusEl = document.getElementById('status');
const reloadBtn = document.getElementById('reload');

let currentPlan = null;
let currentSha = '';

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

function optionBadge(text, className) {
  return el('span', `badge ${className}`, text);
}

function setOptionText(textEl, text, recommended, modified) {
  textEl.textContent = text;
  if (recommended) textEl.appendChild(optionBadge('Recomendada', 'recommended'));
  if (modified) textEl.appendChild(optionBadge('Modificada', 'modified'));
}

function createEditableOption(section, sectionIndex, option, inputType, checked) {
  const row = el('div', 'option-row');
  row.dataset.optionId = String(option.id);

  const input = document.createElement('input');
  input.type = inputType;
  input.className = 'choice';
  input.name = inputType === 'radio' ? `q-${sectionIndex}` : `q-${sectionIndex}-${option.id}`;
  input.value = String(option.id);
  input.id = `q-${sectionIndex}-${String(option.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  input.checked = Boolean(checked);

  const num = el('label', 'option-number', `${option.id}.`);
  num.htmlFor = input.id;

  const textEl = el('label', 'option-text');
  textEl.htmlFor = input.id;
  textEl.dataset.original = option.text || '';
  setOptionText(textEl, option.text || '', Boolean(option.recommended), false);

  const editBtn = el('button', 'edit-btn', 'Editar');
  editBtn.type = 'button';

  const editor = el('div', 'option-editor');
  const editArea = document.createElement('textarea');
  editArea.rows = 3;
  const editorActions = el('div', 'editor-actions');
  const saveBtn = el('button', 'save-edit', 'Guardar');
  saveBtn.type = 'button';
  const cancelBtn = el('button', 'cancel-edit', 'Cancelar');
  cancelBtn.type = 'button';
  editorActions.append(saveBtn, cancelBtn);
  editor.append(editArea, editorActions);

  editBtn.addEventListener('click', () => {
    input.checked = true;
    editArea.value = textEl.dataset.custom || textEl.dataset.original || '';
    editor.classList.add('open');
    editArea.focus();
  });

  saveBtn.addEventListener('click', () => {
    const value = editArea.value.trim();
    if (!value) return;
    textEl.dataset.custom = value;
    setOptionText(textEl, value, Boolean(option.recommended), true);
    editor.classList.remove('open');
  });

  cancelBtn.addEventListener('click', () => editor.classList.remove('open'));

  row.append(input, num, textEl, editBtn, editor);
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

  const num = el('label', 'option-number', 'Otra');
  num.htmlFor = input.id;
  const holder = el('div', 'other-holder');
  const otherInput = document.createElement('textarea');
  otherInput.className = 'other-input';
  otherInput.placeholder = 'Escribe la alternativa completa…';
  otherInput.rows = 2;
  holder.appendChild(otherInput);

  const update = () => holder.classList.toggle('visible', input.checked);
  input.addEventListener('change', update);
  update();

  row.append(input, num, holder);
  return row;
}

function createNote(section) {
  if (section.allowNote === false) return null;
  const wrap = el('div', 'note-wrap');
  const label = el('label', 'note-label', section.noteLabel || 'Nota');
  const area = document.createElement('textarea');
  area.className = 'note-input';
  area.rows = 2;
  area.placeholder = section.notePlaceholder || 'Matiz opcional…';
  label.appendChild(area);
  wrap.appendChild(label);
  return wrap;
}

function renderChoiceSection(card, section, sectionIndex, multiple) {
  const inputType = multiple ? 'checkbox' : 'radio';
  const defaults = multiple
    ? new Set((section.defaultOptions || []).map(String))
    : new Set(section.defaultOption !== undefined && section.defaultOption !== null ? [String(section.defaultOption)] : []);

  (section.options || []).forEach(option => {
    const checked = defaults.has(String(option.id)) || Boolean(option.selected);
    card.appendChild(createEditableOption(section, sectionIndex, option, inputType, checked));
  });

  if (section.allowOther) {
    card.appendChild(createOtherOption(sectionIndex, inputType, Boolean(section.defaultOther)));
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
  values.forEach(item => {
    const row = el('label', 'boolean-row');
    const input = document.createElement('input');
    input.type = 'radio';
    input.className = 'boolean-choice';
    input.name = `q-${sectionIndex}`;
    input.value = item.value;
    input.checked = section.default === (item.value === 'true');
    row.append(input, document.createTextNode(item.label));
    card.appendChild(row);
  });
}

function renderSection(section, sectionIndex) {
  const card = el('section', 'card');
  card.dataset.sectionIndex = String(sectionIndex);
  card.dataset.type = section.type || 'single';

  const title = el('h2', '', section.title || `${sectionIndex + 1}. ${section.id || 'Decisión'}`);
  card.appendChild(title);
  if (section.description) card.appendChild(el('p', 'description', section.description));

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
      lines.push(`Respuesta: ${selected ? (selected.value === 'true' ? (section.trueLabel || 'Sí') : (section.falseLabel || 'No')) : 'Sin seleccionar'}`);
    } else if (type === 'multiple') {
      const selected = [...card.querySelectorAll('.choice:checked')];
      const ids = selected.map(input => input.value === '__other' ? 'Otra' : input.value);
      lines.push(`Respuesta: ${ids.length ? ids.join(', ') : 'Ninguna'}`);
      selected.forEach(input => {
        const row = input.closest('.option-row');
        if (input.value === '__other') {
          const value = row.querySelector('.other-input')?.value.trim();
          if (value) lines.push(`Otra: ${value}`);
        } else {
          const custom = row.querySelector('.option-text')?.dataset.custom;
          if (custom) lines.push(`Modificada ${input.value}: ${custom}`);
        }
      });
    } else {
      const selected = card.querySelector('.choice:checked');
      if (!selected) {
        lines.push('Respuesta: Sin seleccionar');
      } else {
        const row = selected.closest('.option-row');
        if (selected.value === '__other') {
          const value = row.querySelector('.other-input')?.value.trim();
          lines.push(`Respuesta: Otra${value ? ` - ${value}` : ''}`);
        } else {
          const custom = row.querySelector('.option-text')?.dataset.custom;
          lines.push(custom
            ? `Respuesta: ${selected.value} (modificada) - ${custom}`
            : `Respuesta: ${selected.value}`);
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
  header.appendChild(el('h1', '', plan.title || 'Plan de decisiones'));
  if (plan.description) header.appendChild(el('p', 'plan-description', plan.description));
  const metaParts = [];
  if (plan.id) metaParts.push(plan.id);
  if (plan.version !== undefined) metaParts.push(`v${plan.version}`);
  if (currentSha) metaParts.push(`SHA ${currentSha.slice(0, 8)}`);
  if (metaParts.length) header.appendChild(el('div', 'plan-meta', metaParts.join(' · ')));
  app.appendChild(header);

  (plan.sections || []).forEach((section, index) => app.appendChild(renderSection(section, index)));

  const actions = el('div', 'actions');
  const generateBtn = el('button', 'primary-btn', 'Generar respuesta');
  generateBtn.type = 'button';
  actions.appendChild(generateBtn);
  app.appendChild(actions);

  const result = el('section', 'result-card');
  const pre = el('pre', 'result-text');
  const copyBtn = el('button', 'copy-btn', 'Copiar para ChatGPT');
  copyBtn.type = 'button';
  result.append(el('strong', '', 'Respuesta generada'), pre, copyBtn);
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
    setTimeout(() => copyBtn.textContent = old, 1000);
  });
}

function renderError(error) {
  app.textContent = '';
  const card = el('section', 'error-card');
  card.append(el('strong', '', 'No se pudo cargar data/current.json'), el('pre', '', String(error)));
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
    if (!response.ok) throw new Error(`GitHub API respondió HTTP ${response.status}`);
    const file = await response.json();
    if (!file.content) throw new Error('GitHub no devolvió el contenido del JSON.');
    const jsonText = decodeBase64Utf8(file.content);
    const plan = JSON.parse(jsonText);
    if (!Array.isArray(plan.sections)) throw new Error('El JSON debe contener un array "sections".');
    renderPlan(plan, file.sha);
    statusEl.textContent = `SHA ${String(file.sha || '').slice(0, 8)} · ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    statusEl.textContent = 'Error';
    renderError(error);
  } finally {
    reloadBtn.disabled = false;
  }
}

reloadBtn.addEventListener('click', loadCurrent);
loadCurrent();

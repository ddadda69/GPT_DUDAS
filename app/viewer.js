const REPOSITORY = 'ddadda69/GPT_DUDAS';
const BRANCH = 'main';
const CURRENT_PATH = 'data/current.json';
const CANONICAL_SCHEMA_URL = 'https://ddadda69.github.io/GPT_DUDAS/data/schema.json';
const PLAN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PLAN_KEYS = new Set(['$schema', 'id', 'version', 'title', 'description', 'sections']);
const SECTION_KEYS = new Set([
  'id', 'title', 'description', 'options', 'defaultOption',
  'allowOther', 'allowNote', 'noteLabel', 'notePlaceholder'
]);
const OPTION_KEYS = new Set(['id', 'text', 'recommended']);

const app = document.getElementById('app');
const statusEl = document.getElementById('status');
const reloadBtn = document.getElementById('reload');
const openJsonLink = document.getElementById('openJson');

let currentPlan = null;
let activeSource = null;

if (window.marked) {
  window.marked.setOptions({ gfm: true, breaks: false });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertOnlyKeys(object, allowedKeys, path) {
  const extra = Object.keys(object).filter(key => !allowedKeys.has(key));
  assert(extra.length === 0, `${path} contiene campos no permitidos: ${extra.join(', ')}`);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value >= 1;
}

function validatePlan(plan, expectedPlanId = null) {
  assert(isPlainObject(plan), 'El JSON raíz debe ser un objeto.');
  assertOnlyKeys(plan, PLAN_KEYS, '$');
  assert(plan.$schema === CANONICAL_SCHEMA_URL, `El $schema debe ser ${CANONICAL_SCHEMA_URL}.`);
  assert(typeof plan.id === 'string' && PLAN_ID_PATTERN.test(plan.id), 'El id del plan no es válido.');
  assert(isPositiveInteger(plan.version), 'version debe ser un entero mayor o igual que 1.');
  assert(typeof plan.title === 'string' && plan.title.trim(), 'title debe ser texto no vacío.');
  if (plan.description !== undefined) {
    assert(typeof plan.description === 'string', 'description debe ser texto.');
  }
  assert(Array.isArray(plan.sections) && plan.sections.length > 0, 'sections debe ser una lista no vacía.');
  if (expectedPlanId !== null) {
    assert(plan.id === expectedPlanId, `El id del JSON ("${plan.id}") no coincide con el plan solicitado ("${expectedPlanId}").`);
  }

  const sectionIds = new Set();
  plan.sections.forEach((section, sectionIndex) => {
    const path = `sections[${sectionIndex}]`;
    assert(isPlainObject(section), `${path} debe ser un objeto.`);
    assertOnlyKeys(section, SECTION_KEYS, path);
    assert(typeof section.id === 'string' && PLAN_ID_PATTERN.test(section.id), `${path}.id no es válido.`);
    assert(!sectionIds.has(section.id), `${path}.id está duplicado.`);
    sectionIds.add(section.id);
    assert(typeof section.title === 'string' && section.title.trim(), `${path}.title debe ser texto no vacío.`);
    if (section.description !== undefined) assert(typeof section.description === 'string', `${path}.description debe ser texto.`);
    assert(Array.isArray(section.options) && section.options.length >= 1 && section.options.length <= 2, `${path}.options debe contener una o dos opciones.`);
    assert(isPositiveInteger(section.defaultOption) && section.defaultOption <= section.options.length, `${path}.defaultOption debe coincidir con una opción existente.`);
    if (section.allowOther !== undefined) assert(typeof section.allowOther === 'boolean', `${path}.allowOther debe ser booleano.`);
    if (section.allowNote !== undefined) assert(typeof section.allowNote === 'boolean', `${path}.allowNote debe ser booleano.`);
    if (section.noteLabel !== undefined) assert(typeof section.noteLabel === 'string', `${path}.noteLabel debe ser texto.`);
    if (section.notePlaceholder !== undefined) assert(typeof section.notePlaceholder === 'string', `${path}.notePlaceholder debe ser texto.`);

    const recommendedIds = [];
    section.options.forEach((option, optionIndex) => {
      const optionPath = `${path}.options[${optionIndex}]`;
      assert(isPlainObject(option), `${optionPath} debe ser un objeto.`);
      assertOnlyKeys(option, OPTION_KEYS, optionPath);
      assert(option.id === optionIndex + 1, `${optionPath}.id debe ser exactamente ${optionIndex + 1}.`);
      assert(typeof option.text === 'string' && option.text.trim(), `${optionPath}.text debe ser texto no vacío.`);
      if (option.recommended !== undefined) assert(typeof option.recommended === 'boolean', `${optionPath}.recommended debe ser booleano.`);
      if (option.recommended === true) recommendedIds.push(option.id);
    });
    assert(
      recommendedIds.length === 1 && recommendedIds[0] === section.defaultOption,
      `${path} debe tener exactamente una opción recommended=true y debe coincidir con defaultOption.`
    );
  });

  return plan;
}

function resolvePlanSource() {
  const requestedPlanId = new URLSearchParams(window.location.search).get('plan');
  if (requestedPlanId === null || requestedPlanId === '') {
    return { planId: null, path: CURRENT_PATH, isCurrent: true };
  }
  if (!PLAN_ID_PATTERN.test(requestedPlanId)) {
    throw new Error('El parámetro "plan" no es válido. Usa únicamente letras, números, punto, guion o guion bajo (máximo 128 caracteres).');
  }
  return {
    planId: requestedPlanId,
    path: `data/plans/${requestedPlanId}.json`,
    isCurrent: false,
  };
}

function encodeRepoPath(path) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function apiUrl(path) {
  return `https://api.github.com/repos/${REPOSITORY}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(BRANCH)}`;
}

function githubBlobUrl(path) {
  return `https://github.com/${REPOSITORY}/blob/${encodeURIComponent(BRANCH)}/${encodeRepoPath(path)}`;
}

function updateSourceUi(source) {
  activeSource = source;
  if (!openJsonLink) return;
  openJsonLink.href = githubBlobUrl(source.path);
  openJsonLink.textContent = source.isCurrent ? 'Ver JSON actual' : 'Ver JSON del plan';
}

function decodeBase64Utf8(base64) {
  const clean = String(base64 || '').replace(/\s/g, '');
  const bytes = Uint8Array.from(atob(clean), char => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderMarkdown(target, markdown, inline = false) {
  const source = String(markdown || '');
  if (!window.marked || !window.DOMPurify) {
    target.textContent = source;
    return;
  }
  const rendered = inline && window.marked.parseInline
    ? window.marked.parseInline(source)
    : window.marked.parse(source);
  target.innerHTML = window.DOMPurify.sanitize(rendered);
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
    if (recommended && showRecommended) badges.appendChild(optionBadge('Recomendada', 'recommended'));
    if (modified) badges.appendChild(optionBadge('Editada', 'modified'));
    textEl.appendChild(badges);
  }
}

function radioId(sectionIndex, optionId) {
  return `q-${sectionIndex}-${optionId}`;
}

function createEditableOption(sectionIndex, option, checked, optionCount) {
  const row = el('div', 'option-row');
  row.dataset.optionId = String(option.id);

  const input = document.createElement('input');
  input.type = 'radio';
  input.className = 'choice';
  input.name = `q-${sectionIndex}`;
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
  textEl.dataset.original = option.text;
  setOptionText(textEl, option.text, option.recommended === true, false, optionCount > 1);
  content.appendChild(textEl);

  const editBtn = el('button', 'edit-btn', 'Editar');
  editBtn.type = 'button';
  editBtn.setAttribute('aria-expanded', 'false');

  let editing = false;
  let editArea = null;
  let actions = null;

  const selectOption = () => {
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const currentValue = () => textEl.dataset.custom ?? textEl.dataset.original;

  const finishEdit = save => {
    if (!editing) return;

    if (save) {
      const candidate = editArea.value;
      if (!candidate.trim()) {
        editArea.setCustomValidity('La opción no puede quedar vacía.');
        editArea.reportValidity();
        return;
      }
      editArea.setCustomValidity('');
      if (candidate === textEl.dataset.original) delete textEl.dataset.custom;
      else textEl.dataset.custom = candidate;
    }

    const rendered = currentValue();
    const modified = Object.hasOwn(textEl.dataset, 'custom');
    setOptionText(textEl, rendered, option.recommended === true, modified, optionCount > 1);

    actions?.remove();
    actions = null;
    editArea = null;
    editing = false;
    editBtn.disabled = false;
    editBtn.setAttribute('aria-expanded', 'false');
  };

  editBtn.addEventListener('click', () => {
    if (editing) return;
    selectOption();
    editing = true;
    editBtn.disabled = true;
    editBtn.setAttribute('aria-expanded', 'true');

    const value = currentValue();
    textEl.textContent = '';

    editArea = document.createElement('textarea');
    editArea.className = 'note-input inline-markdown-editor';
    editArea.value = value;
    editArea.rows = Math.max(8, Math.min(24, value.split('\n').length + 2));
    editArea.spellcheck = true;
    editArea.placeholder = 'Edita el Markdown…';
    textEl.appendChild(editArea);

    actions = el('div', 'editor-actions');
    const saveBtn = el('button', 'save-edit', 'Guardar');
    saveBtn.type = 'button';
    const cancelBtn = el('button', 'cancel-edit', 'Cancelar');
    cancelBtn.type = 'button';
    actions.append(saveBtn, cancelBtn);
    content.appendChild(actions);

    saveBtn.addEventListener('click', () => finishEdit(true));
    cancelBtn.addEventListener('click', () => finishEdit(false));
    editArea.addEventListener('keydown', event => {
      if (event.key === 'Escape') finishEdit(false);
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) finishEdit(true);
    });

    editArea.focus();
    editArea.setSelectionRange(editArea.value.length, editArea.value.length);
  });

  textEl.addEventListener('click', event => {
    if (editing || event.target.closest('a, button, textarea')) return;
    selectOption();
  });

  row.append(input, content, editBtn);
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

function createOtherOption(sectionIndex) {
  const row = el('div', 'option-row other-row');
  row.dataset.optionId = '__other';

  const input = document.createElement('input');
  input.type = 'radio';
  input.className = 'choice other-choice';
  input.name = `q-${sectionIndex}`;
  input.value = '__other';
  input.id = `q-${sectionIndex}-other`;
  input.setAttribute('aria-label', 'Otra alternativa');

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

function renderSection(section, sectionIndex) {
  const card = el('section', 'card');
  card.dataset.sectionIndex = String(sectionIndex);

  const title = el('h2', 'section-title');
  renderMarkdown(title, section.title, true);
  card.appendChild(title);

  if (section.description) {
    const description = el('div', 'description markdown-body');
    renderMarkdown(description, section.description);
    card.appendChild(description);
  }

  section.options.forEach(option => {
    card.appendChild(createEditableOption(
      sectionIndex,
      option,
      section.defaultOption === option.id,
      section.options.length
    ));
  });
  card.appendChild(createSkipOption(sectionIndex));
  if (section.allowOther === true) card.appendChild(createOtherOption(sectionIndex));

  const note = createNote(section);
  if (note) card.appendChild(note);
  return card;
}

function selectedOptionMarkdown(row) {
  const textEl = row?.querySelector('.option-text');
  return textEl ? (textEl.dataset.custom ?? textEl.dataset.original ?? '') : '';
}

function buildOutput() {
  if (!currentPlan) return '';
  const lines = [`Plan: ${currentPlan.id} · v${currentPlan.version}`, ''];

  [...document.querySelectorAll('.card')].forEach((card, index) => {
    const section = currentPlan.sections[index];
    lines.push(section.title);

    const selected = card.querySelector('.choice:checked');
    if (!selected) {
      lines.push('Decisión: Sin seleccionar');
    } else if (selected.value === '__skip') {
      lines.push('Decisión: No implementar');
    } else if (selected.value === '__other') {
      const value = selected.closest('.option-row').querySelector('.other-input')?.value.trim();
      lines.push(`Decisión: Otra${value ? ` - ${value}` : ''}`);
    } else {
      const row = selected.closest('.option-row');
      const custom = row.querySelector('.option-text')?.dataset.custom;
      const label = section.options.length === 1 ? 'Implementar' : `Opción ${selected.value}`;
      lines.push(`Decisión: ${label}${custom ? ' (editada)' : ''}`);
      if (custom) lines.push('', 'Contenido editado:', selectedOptionMarkdown(row));
    }

    const note = card.querySelector('.note-input:not(.inline-markdown-editor)')?.value.trim();
    if (note) lines.push(`Nota: ${note}`);
    lines.push('');
  });

  return lines.join('\n').trim();
}

async function copyText(text) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('El navegador no ofrece acceso al portapapeles.');
  }
  await navigator.clipboard.writeText(text);
}

function renderPlan(plan, sha) {
  currentPlan = plan;
  app.textContent = '';

  const header = el('section', 'plan-header');
  const title = el('h1', 'plan-title');
  renderMarkdown(title, plan.title, true);
  header.appendChild(title);

  if (plan.description) {
    const description = el('div', 'plan-description markdown-body');
    renderMarkdown(description, plan.description);
    header.appendChild(description);
  }

  const metaParts = [plan.id, `v${plan.version}`];
  if (sha) metaParts.push(`SHA ${sha.slice(0, 8)}`);
  header.appendChild(el('div', 'plan-meta', metaParts.join(' · ')));
  app.appendChild(header);

  plan.sections.forEach((section, index) => app.appendChild(renderSection(section, index)));

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
    const original = copyBtn.textContent;
    try {
      await copyText(text);
      copyBtn.textContent = 'Copiado ✓';
    } catch (error) {
      console.error(error);
      copyBtn.textContent = 'No se pudo copiar';
    } finally {
      setTimeout(() => { copyBtn.textContent = original; }, 1400);
    }
  });
}

function renderError(error, path) {
  app.textContent = '';
  const card = el('section', 'error-card');
  const target = path ? `No se pudo cargar ${path}` : 'No se pudo cargar el plan solicitado';
  card.append(el('strong', '', target), el('pre', '', String(error)));
  app.appendChild(card);
}

function describeHttpError(response, source) {
  if (response.status === 404 && source.planId) {
    return `No existe el plan "${source.planId}" en main.`;
  }
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
    const resetSeconds = Number(response.headers.get('x-ratelimit-reset'));
    if (Number.isFinite(resetSeconds)) {
      return `GitHub API ha alcanzado su límite temporal. Se restablece aproximadamente a las ${new Date(resetSeconds * 1000).toLocaleTimeString()}.`;
    }
    return 'GitHub API ha alcanzado su límite temporal de consultas.';
  }
  return `GitHub API respondió HTTP ${response.status}.`;
}

async function loadPlan() {
  statusEl.textContent = 'Consultando main…';
  reloadBtn.disabled = true;
  activeSource = null;

  try {
    const source = resolvePlanSource();
    updateSourceUi(source);
    statusEl.textContent = source.planId ? `Consultando ${source.planId}…` : 'Consultando current.json…';

    const response = await fetch(`${apiUrl(source.path)}&t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) throw new Error(describeHttpError(response, source));

    const file = await response.json();
    if (!file.content) throw new Error('GitHub no devolvió el contenido del JSON.');
    const plan = validatePlan(JSON.parse(decodeBase64Utf8(file.content)), source.planId);

    renderPlan(plan, file.sha || '');
    document.title = `${plan.title} · Plan Viewer`;
    const sourceLabel = source.planId || 'current';
    statusEl.textContent = `${sourceLabel} · SHA ${String(file.sha || '').slice(0, 8)} · ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    statusEl.textContent = 'Error';
    if (!activeSource && openJsonLink) {
      openJsonLink.removeAttribute('href');
      openJsonLink.textContent = 'Ver JSON';
    }
    renderError(error, activeSource?.path);
  } finally {
    reloadBtn.disabled = false;
  }
}

reloadBtn.addEventListener('click', loadPlan);
loadPlan();

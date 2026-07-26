/**
 * Client side validation for the sign up and log in forms.
 * Validates on blur and on submit, never on every keystroke. An existing
 * error clears as soon as the field becomes valid. Input is never wiped.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getInput(field: HTMLElement): HTMLInputElement | null {
  return field.querySelector('input');
}

function validate(field: HTMLElement): string | null {
  const input = getInput(field);
  if (!input) return null;

  if (input.type === 'checkbox') {
    if (input.required && !input.checked) return field.dataset.msgRequired ?? null;
    return null;
  }

  const value = input.value.trim();
  if (input.required && !value) return field.dataset.msgRequired ?? null;
  if (value && input.type === 'email' && !EMAIL_PATTERN.test(value)) {
    return field.dataset.msgFormat ?? null;
  }
  if (value && input.minLength > 0 && value.length < input.minLength) {
    return field.dataset.msgMinlength ?? null;
  }
  return null;
}

function showError(field: HTMLElement, message: string): void {
  const input = getInput(field);
  const error = field.querySelector<HTMLElement>('.field__error');
  const text = field.querySelector<HTMLElement>('.field__error-text');
  field.dataset.state = 'error';
  input?.setAttribute('aria-invalid', 'true');
  if (text) text.textContent = message;
  if (error) error.hidden = false;
}

function clearError(field: HTMLElement): void {
  const input = getInput(field);
  const error = field.querySelector<HTMLElement>('.field__error');
  input?.removeAttribute('aria-invalid');
  if (error) error.hidden = true;

  const hasValue =
    input?.type === 'checkbox' ? input.checked : Boolean(input?.value.trim());
  field.dataset.state = hasValue ? 'valid' : '';
}

export function initForm(form: HTMLFormElement): void {
  const fields = Array.from(form.querySelectorAll<HTMLElement>('.field'));
  const summary = form.querySelector<HTMLElement>('.form-summary');
  const summaryHeading = summary?.querySelector<HTMLElement>('.form-summary__heading');
  const summaryList = summary?.querySelector<HTMLUListElement>('.form-summary__list');
  const submit = form.querySelector<HTMLButtonElement>('.form-submit');
  const submitLabel = submit?.querySelector<HTMLElement>('.form-submit__label');

  const validationHeading = summaryHeading?.textContent ?? '';

  fields.forEach((field) => {
    const input = getInput(field);
    if (!input) return;

    input.addEventListener('blur', () => {
      const message = validate(field);
      if (message) showError(field, message);
      else clearError(field);
    });

    // Only fields already in error re-check while typing, so the error can
    // clear the moment it is fixed. Clean fields are left alone until blur.
    const clearingEvent = input.type === 'checkbox' ? 'change' : 'input';
    input.addEventListener(clearingEvent, () => {
      if (field.dataset.state === 'error' && !validate(field)) clearError(field);
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!summary || !summaryList || !summaryHeading || !submit) return;

    const failures: { field: HTMLElement; message: string }[] = [];
    fields.forEach((field) => {
      const message = validate(field);
      if (message) {
        showError(field, message);
        failures.push({ field, message });
      } else {
        clearError(field);
      }
    });

    if (failures.length > 0) {
      summaryHeading.textContent = validationHeading;
      summaryList.replaceChildren(
        ...failures.map(({ field, message }) => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          const input = getInput(field);
          a.href = `#${input?.id ?? ''}`;
          a.textContent = message;
          a.addEventListener('click', (e) => {
            e.preventDefault();
            input?.focus();
          });
          li.append(a);
          return li;
        })
      );
      summary.hidden = false;
      summary.focus();
      return;
    }

    summary.hidden = true;

    // Loading: label swaps, width stays stable, focus is kept.
    const originalLabel = submitLabel?.textContent ?? '';
    submit.style.minInlineSize = `${submit.offsetWidth}px`;
    submit.dataset.loading = 'true';
    submit.setAttribute('aria-busy', 'true');
    if (submitLabel && submit.dataset.submitting) {
      submitLabel.textContent = submit.dataset.submitting;
    }

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
      });
      if (response.ok) {
        window.location.assign(form.dataset.successUrl || '/');
        return;
      }
      throw new Error(String(response.status));
    } catch {
      summaryHeading.textContent = form.dataset.serverError ?? '';
      summaryList.replaceChildren();
      summary.hidden = false;
      summary.focus();
    } finally {
      delete submit.dataset.loading;
      submit.removeAttribute('aria-busy');
      if (submitLabel) submitLabel.textContent = originalLabel;
    }
  });
}

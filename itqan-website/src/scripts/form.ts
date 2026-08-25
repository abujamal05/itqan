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
    // Falls back to the required message rather than to null. Returning null
    // here means "valid", so a field that declares minlength but forgets the
    // message would silently accept a value it is meant to reject.
    return field.dataset.msgMinlength ?? field.dataset.msgRequired ?? null;
  }
  // Composition, checked only where a password is being SET. Login is left
  // alone deliberately: telling someone their own correct password is invalid
  // helps nobody and leaks the policy to whoever is typing.
  if (value && field.dataset.check === 'password' && !isStrongPassword(value)) {
    return field.dataset.msgWeak ?? null;
  }
  // A verification code, and this check earns its place rather than being
  // tidiness: the server allows FIVE attempts before the code dies, so sending
  // an obviously impossible value would spend a scarce resource to learn
  // something the browser already knew. Spaces are stripped first, because a
  // code pasted out of an email often arrives with them.
  if (value && field.dataset.check === 'digits' && !/^\d+$/.test(value.replace(/\s/g, ''))) {
    return field.dataset.msgFormat ?? null;
  }
  return null;
}

/** Upper, lower, digit and one symbol. Length is handled by minlength above. */
export function isStrongPassword(value: string): boolean {
  return /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
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

export interface Submitted {
  ok: boolean;
  status: number;
  body?: unknown;
}

/**
 * Turn the server's error CODE into a sentence that says what to do next.
 *
 * The failure this exists for: every non-2xx used to render one string, so
 * signing up with an address that already had an account said "we could not
 * create the account just now — try again in a moment". Trying again in a
 * moment could never work, and the person was told to do the one thing
 * guaranteed to fail.
 *
 * `messages` maps an API error id to text the PAGE owns, which is what keeps
 * this bilingual: the server sends `email_taken`, never a sentence, because an
 * English string on the wire cannot be shown to an Arabic user.
 *
 * `links` are the way out. A message that only diagnoses is half an answer —
 * "that email already has an account" is useful because "log in instead" is
 * next to it.
 *
 * An UNMAPPED code falls through to the generic message deliberately. This is
 * additive: a page adopts it one code at a time, and nothing loses the message
 * it has today.
 */
export function explainServerErrors(
  form: HTMLFormElement,
  messages: Record<string, string | undefined>,
  links: { href: string; text: string }[] = [],
): void {
  const summary = form.querySelector<HTMLElement>('.form-summary');
  const heading = form.querySelector<HTMLElement>('.form-summary__heading');
  const list = form.querySelector<HTMLElement>('.form-summary__list');
  if (!summary || !heading || !list) return;

  form.addEventListener('itqan:submitted', ((e: CustomEvent<Submitted>) => {
    if (e.detail.ok) return;
    const code = (e.detail.body as { error?: unknown } | undefined)?.error;
    const message = typeof code === 'string' ? messages[code] : undefined;
    if (!message) return;

    /* We have said something specific, so stop the generic sentence appearing
       underneath it and contradicting it. */
    e.preventDefault();

    heading.textContent = message;
    list.replaceChildren(
      ...links.map(({ href, text }) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = href;
        a.textContent = text;
        li.append(a);
        return li;
      }),
    );
    summary.hidden = false;
    /* Focus moves here because the summary is `role="alert"` and the person's
       attention is in the form they just submitted; `initForm` does the same
       for client-side validation failures. */
    summary.focus();
  }) as EventListener);
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
      /* Tell the page what happened before deciding anything. Some forms answer
         in place rather than navigating (password recovery shows "check your
         email" beside the address just typed), and a form with no
         data-success-url is exactly that case. */
      /* The parsed body travels with it, because a status code is not always
         the whole answer: email verification returns how many attempts are left
         with its 422, and a page that could only see "422" would have to say
         "wrong code" without saying the thing the person actually needs to know.
         Parsed defensively — a non-JSON error page must not turn a handled
         rejection into an unhandled throw. */
      let body: unknown;
      try {
        body = await response.clone().json();
      } catch {
        body = undefined;
      }
      /* CANCELABLE, and that is what stops this page contradicting itself.
         The generic summary below used to appear whatever the page did with the
         event, so the verify screen said "3 attempts left" AND "Something went
         wrong" at the same time — two messages, one of them useless, and the
         person left to decide which to believe.

         A listener that has said something specific calls `preventDefault()`
         and the generic sentence is skipped. A page with no listener is
         unaffected, so this stays additive: nothing loses its message. */
      const handled = !form.dispatchEvent(new CustomEvent('itqan:submitted', {
        detail: { ok: response.ok, status: response.status, body },
        cancelable: true,
      }));
      if (response.ok) {
        /* CARRY "I CAME HERE TO BUY" ACROSS THE HANDOFF.
           Someone who pressed the premium button on /pricing should land on the
           upgrade screen once they are through verification and onboarding, not
           on the dashboard having to find it again. The site cannot tell the app
           directly — they are separate origins in production and the app cannot
           read this page's storage — so the intent rides in a cookie, which is
           the one thing that crosses when both sit under the same registrable
           domain. Half an hour is enough for signup plus verification and short
           enough that it cannot resurface weeks later.

           Set on SUCCESS rather than on page load: the intent is only real once
           an account exists. See BACKEND.md §8 for the cross-domain case. */
        if (new URLSearchParams(location.search).get('intent') === 'premium') {
          document.cookie = 'itqan_intent=premium; path=/; max-age=1800; SameSite=Lax';
        }
        if (form.dataset.successUrl) window.location.assign(form.dataset.successUrl);
        return;
      }
      if (handled) return;
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

/**
 * Password reveal.
 *
 * Lives here rather than in its own module because this script is already on
 * every page that has a password field, and the site's whole shipped-JS budget
 * is about a kilobyte — a second bundle for one toggle would cost more in
 * requests than it does in bytes.
 *
 * Three details that make it a real control rather than a decorative icon:
 *  - the button is never inside the tab order twice and never submits: it is
 *    type="button", so Enter in the password field still submits the FORM;
 *  - `aria-pressed` carries the state, so a screen reader announces "show
 *    password, pressed" instead of relying on which of two eyes is drawn;
 *  - the caret position is preserved across the type swap. Changing an input's
 *    type moves the caret to the end in every browser, which is maddening when
 *    you reveal a password mid-typing to check one character.
 */
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-reveal]')) {
  const input = document.getElementById(button.getAttribute('aria-controls') ?? '');
  if (!(input instanceof HTMLInputElement)) continue;

  button.addEventListener('click', () => {
    const reveal = input.type === 'password';
    const { selectionStart, selectionEnd } = input;

    input.type = reveal ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(reveal));
    const label = reveal ? button.dataset.labelHide : button.dataset.labelShow;
    if (label) button.setAttribute('aria-label', label);

    // Restore the caret. Only meaningful while the field has focus, and
    // setSelectionRange throws on input types that do not support it — both
    // guarded rather than assumed.
    if (document.activeElement === input && selectionStart !== null) {
      try { input.setSelectionRange(selectionStart, selectionEnd ?? selectionStart); }
      catch { /* type does not support selection; harmless */ }
    }
  });
}

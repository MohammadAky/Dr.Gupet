/** Focus only after React has connected the invalid field and its explanation. */
export function focusFirstInvalid(form: HTMLFormElement) {
  requestAnimationFrame(() => {
    if (!form.isConnected) return;
    form.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)')?.focus();
  });
}

export function validationErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

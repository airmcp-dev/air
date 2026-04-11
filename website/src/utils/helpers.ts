export function cn(...inputs: (string | false | null | undefined)[]): string {
  return inputs.filter((x): x is string => typeof x === 'string' && x.length > 0).join(' ');
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function scrollToSection(id: string): void {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

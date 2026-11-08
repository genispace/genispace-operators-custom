/** Locale dictionaries are bundled ESM data, never injected executable globals. */
export function translate(messages, props, key) {
  const requested = String(props?.config?.locale || 'en').toLowerCase().replaceAll('_', '-');
  const locale = messages[requested] ? requested : requested.split('-')[0];
  return messages[locale]?.[key] || messages.en?.[key] || key;
}

export function localeIndex(messages, props) {
  const requested = String(props?.config?.locale || 'en').toLowerCase().replaceAll('_', '-');
  return messages[requested] ? requested : messages[requested.split('-')[0]] ? requested.split('-')[0] : 'en';
}

import { runRotator } from '../lib/core';
import { adapterForHost } from '../lib/registry';
import { SITE_MATCHES } from '../lib/sites';

export default defineContentScript({
  matches: SITE_MATCHES,
  main() {
    const adapter = adapterForHost(location.hostname);
    if (adapter) runRotator(adapter);
  },
});

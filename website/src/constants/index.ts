import type { NavItem, PackageInfo, FooterSection } from '@/types';

export const NAV_ITEMS: NavItem[] = [
  { key: 'nav.docs', path: 'https://docs.airmcp.dev', external: true },
  { key: 'nav.enterprise', path: '/enterprise' },
  { key: 'nav.foundation', path: '/foundation' },
  { key: 'nav.issues', path: '/issues' },
  { key: 'nav.support', path: '/support' },
];

export const PACKAGES: PackageInfo[] = [
  { name: '@airmcp-dev/core', license: 'Apache-2.0', descriptionKey: 'packages.core' },
  { name: '@airmcp-dev/cli', license: 'Apache-2.0', descriptionKey: 'packages.cli' },
  { name: '@airmcp-dev/gateway', license: 'Apache-2.0', descriptionKey: 'packages.gateway' },
  { name: '@airmcp-dev/logger', license: 'Apache-2.0', descriptionKey: 'packages.logger' },
  { name: '@airmcp-dev/meter', license: 'Apache-2.0', descriptionKey: 'packages.meter' },
  { name: '@airmcp-dev/shield', license: 'Apache-2.0', descriptionKey: 'packages.shield' },
  { name: '@airmcp-dev/hive', license: 'Commercial', descriptionKey: 'packages.hive' },
];

export const FOOTER_SECTIONS: FooterSection[] = [
  {
    titleKey: 'footer.product',
    links: [
      { labelKey: 'footer.docs', href: 'https://docs.airmcp.dev', external: true },
      { labelKey: 'footer.enterprise', href: '/enterprise' },
      { labelKey: 'footer.changelog', href: '/support' },
    ],
  },
  {
    titleKey: 'footer.community',
    links: [
      { labelKey: 'footer.npm', href: 'https://www.npmjs.com/org/airmcp-dev', external: true },
      { labelKey: 'footer.contact', href: 'mailto:labs@codepedia.kr', external: true },
    ],
  },
  {
    titleKey: 'footer.foundation',
    links: [
      { labelKey: 'footer.about', href: '/foundation' },
      { labelKey: 'footer.governance', href: '/foundation' },
      { labelKey: 'footer.support', href: '/support' },
    ],
  },
];

export const GITHUB_URL = 'https://github.com/airmcp-dev/air';
export const NPM_URL = 'https://www.npmjs.com/org/airmcp-dev';
export const LABS_URL = 'https://labs.codepedia.kr';
export const DOMAIN = 'airmcp.dev';

export type Language = 'ko' | 'en';

export interface NavItem {
  key: string;
  path: string;
  external?: boolean;
}

export interface PackageInfo {
  name: string;
  license: 'Apache-2.0' | 'Commercial';
  descriptionKey: string;
}

export interface FeatureItem {
  iconKey: string;
  titleKey: string;
  descriptionKey: string;
}

export interface FooterLink {
  labelKey: string;
  href: string;
  external?: boolean;
}

export interface FooterSection {
  titleKey: string;
  links: FooterLink[];
}

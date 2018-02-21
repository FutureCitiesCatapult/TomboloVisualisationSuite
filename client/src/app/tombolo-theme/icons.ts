
import {MatIconRegistry} from '@angular/material';
import {DomSanitizer} from '@angular/platform-browser';

export  const ICONS = [
  'air-quality',
  'backarrow',
  'bike',
  'cross',
  'disclosure',
  'dropdown',
  'edit',
  'export',
  'eye',
  'gps',
  'green-space',
  'info',
  'leisure-centres',
  'line',
  'login',
  'map',
  'map-pin',
  'minus',
  'plus',
  'polygon',
  'radio-off',
  'radio-on',
  'save',
  'schools',
  'share',
  'signup',
  'social-isolation',
  'transport',
  'trash',
  'user'
];

export function RegisterIcons(iconRegistry: MatIconRegistry, sanitizer: DomSanitizer) {
  return () => {
    ICONS.forEach(icon =>
      iconRegistry.addSvgIcon(icon, sanitizer.bypassSecurityTrustResourceUrl(`assets/icons/${icon}.svg`)));
  }
}
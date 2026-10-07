// Heaven Lands' menu colours: warm rose and cream with gold trim, the dawn's
// palette, where Myths uses night violet.

import { hex } from '../../art/pixel';
import type { PanelStyle } from '../../ui/widgets';

const OUTER = hex('#3a2236');

/** The main button: rose, a gold rim. */
export const HEAVEN_BUTTON: [PanelStyle, PanelStyle] = [
  { top: hex('#d4849a'), bottom: hex('#9a5274'), alpha: 1, border: hex('#c68a3e'), borderLit: hex('#ffe6a0'), outer: OUTER },
  { top: hex('#8a466a'), bottom: hex('#b06a86'), alpha: 1, border: hex('#8e5a2a'), borderLit: hex('#d8a858'), outer: OUTER },
];

/** The quieter buttons: dusk lilac, a soft rim. */
export const HEAVEN_BUTTON_SOFT: [PanelStyle, PanelStyle] = [
  { top: hex('#9a8ac8'), bottom: hex('#64578e'), alpha: 0.96, border: hex('#b49ad8'), borderLit: hex('#f2e6ff'), outer: OUTER },
  { top: hex('#55497c'), bottom: hex('#7a6caa'), alpha: 0.96, border: hex('#7a68a8'), borderLit: hex('#b8a8e0'), outer: OUTER },
];

/** Panels: cream parchment with a gold edge. */
export const HEAVEN_PANEL: PanelStyle = { top: hex('#fff4e2'), bottom: hex('#f4dcc4'), alpha: 0.96, border: hex('#c89a5a'), borderLit: hex('#fff8ea'), outer: OUTER };

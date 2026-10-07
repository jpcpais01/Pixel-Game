// Heaven Lands' only script: its own storage first, then the game once the
// page has loaded (see src/entry.ts for why after the load event).

import { afterLoad } from '../loaded';
import { ownStorage } from './storage';

ownStorage();
afterLoad(() => void import('./main'));

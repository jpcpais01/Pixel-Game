// The page's only script: it starts the game once the page has loaded.
//
// The browser counts a page as loading, and shows its thin progress bar at
// the top, until every script in the page has run and the load event fires.
// The game's bundle is several megabytes and starting it takes seconds on a
// phone, all of it under that bar. Imported after the load event, it no
// longer counts: the page is done at once, and the game loads behind the
// loading screen as before.

import { afterLoad } from './loaded';

afterLoad(() => void import('./main'));

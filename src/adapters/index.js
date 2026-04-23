// Adapter registry. Maps retailer keys → adapter modules.
// Why centralised: src/index.js dispatches by watch.retailer, and the UI reads
// shared/schema.js#RETAILERS to offer the same set. One source of truth per
// retailer name avoids drift between the two sides.

import bestbuyCa from './bestbuy-ca.js';
import ebgamesCa from './ebgames-ca.js';

export const adapters = {
  [bestbuyCa.name]: bestbuyCa,
  [ebgamesCa.name]: ebgamesCa,
};

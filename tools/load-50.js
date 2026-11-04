// Compatibility alias; the isolated runner now supports up to 100 clients.
import { main } from './load-clients.js';
await main(50);

import "dotenv/config";

import { readEnv } from "../config/env.js";
import { NearMarketplaceAdapter } from "./near-marketplace-adapter.js";

const env = readEnv();
const adapter = new NearMarketplaceAdapter({ baseUrl: env.NEAR_MARKET_BASE_URL.replace(/\/$/, "") });
const services = await adapter.listServices({ category: env.AUVRA_MARKET_CATEGORY });

// Do not print raw provider payloads: this output is safe to retain as spike evidence.
console.log(JSON.stringify({ category: env.AUVRA_MARKET_CATEGORY, count: services.length, services: services.map(({ raw: _raw, ...service }) => service) }, null, 2));

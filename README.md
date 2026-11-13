# @metrc-manager-3000/client

Zero-dependency TypeScript client for the [METRC](https://www.metrc.com) cannabis
track-and-trace API. ESM + CJS, works in Node 22+ and edge runtimes.

Part of [Metrc Manager 3000](https://github.com/staqsIO/metrc-manager-3000), formerly Metrc-Formul8-OS.

## Install

```bash
npm install github:staqsIO/metrc-manager-3000-client
```

## Usage

```ts
import { createMetrcClient } from '@metrc-manager-3000/client';

const metrc = createMetrcClient({
  stateCode: 'CO',
  environment: 'sandbox',        // or 'production'
  vendorApiKey: process.env.METRC_VENDOR_API_KEY!,
  userApiKey: process.env.METRC_USER_API_KEY!,
  licenseNumber: 'SF-SBX-CO-1-8002',
});

const packages = await metrc.getActivePackages();
```

## Features

- All METRC states (`getSupportedStates()`), sandbox and production base URLs.
- Basic and HMAC auth helpers (`encodeBasicAuth`, `buildHmacHeaders`).
- Opt-in rate limiting and retry with backoff via wrappers
  (`withRateLimitClient`, `withRetryClient`).
- Typed errors (`MetrcApiError`, `MetrcRateLimitError`, `MetrcAuthError`, ...).

## Development

```bash
npm ci
npm test
npm run build
```

## Contributors

Created by [Staqs](https://github.com/staqsIO), [Waev Tech](https://github.com/waevtech) and [UMB Advisors](https://github.com/UMB-Advisors). See the [root repository](https://github.com/staqsIO/metrc-manager-3000#contributors) for details.

## License

MIT

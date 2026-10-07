import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMetrcClient, MetrcClient } from '../src/client.js';
import { MetrcApiError, MetrcAuthError } from '../src/errors.js';
import type { MetrcClientConfig } from '../src/types.js';

const baseConfig: MetrcClientConfig = {
  stateCode: 'CO',
  environment: 'sandbox',
  licenseNumber: 'LIC-TEST-001',
  vendorApiKey: 'test-vendor-key',
  userApiKey: 'test-user-key',
  authMethod: 'basic',
  timeout: 5000,
};

describe('createMetrcClient', () => {
  it('returns an IMetrcClient instance', () => {
    const client = createMetrcClient(baseConfig);
    expect(client).toBeDefined();
    expect(typeof client.getActivePackages).toBe('function');
    expect(typeof client.getActivePlants).toBe('function');
    expect(typeof client.getActiveStrains).toBe('function');
    expect(typeof client.createStrains).toBe('function');
  });
});

describe('MetrcClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchResponse(data: unknown, status = 200) {
    fetchMock.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: 'OK',
      text: () => Promise.resolve(JSON.stringify(data)),
      headers: new Headers(),
    });
  }

  function mockFetchError(status: number, body: string) {
    fetchMock.mockResolvedValue({
      ok: false,
      status,
      statusText: body,
      text: () => Promise.resolve(body),
      headers: new Headers(),
    });
  }

  it('sends Basic auth header when authMethod is basic', async () => {
    mockFetchResponse([{ Id: 1, Name: 'Test' }]);
    const client = new MetrcClient(baseConfig);

    await client.getActiveStrains();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('https://sandbox-api-co.metrc.com/strains/v1/active');
    expect(url).toContain('licenseNumber=LIC-TEST-001');
    expect(init.headers['Authorization']).toMatch(/^Basic /);
  });

  it('sends HMAC headers when authMethod is hmac', async () => {
    mockFetchResponse([]);
    const client = new MetrcClient({ ...baseConfig, authMethod: 'hmac' });

    await client.getActiveStrains();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['X-METRC-Vendor-API-Key']).toBe('test-vendor-key');
    expect(init.headers['X-METRC-User-API-Key']).toBe('test-user-key');
    expect(init.headers['X-METRC-Signature']).toMatch(/^[0-9a-f]{64}$/);
    expect(init.headers['X-METRC-Timestamp']).toMatch(/^\d+$/);
  });

  it('throws MetrcAuthError on 401', async () => {
    mockFetchError(401, 'Unauthorized');
    const client = new MetrcClient(baseConfig);

    await expect(client.getActiveStrains()).rejects.toThrow(MetrcAuthError);
  });

  it('throws MetrcApiError on 500', async () => {
    mockFetchError(500, 'Internal Server Error');
    const client = new MetrcClient(baseConfig);

    await expect(client.getActiveStrains()).rejects.toThrow(MetrcApiError);
  });

  it('handles 204 No Content for write operations', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      text: () => Promise.resolve(''),
      headers: new Headers(),
    });
    const client = new MetrcClient(baseConfig);

    await expect(client.createStrains([{ Name: 'Test' }])).resolves.toBeUndefined();
  });

  it('unwraps v2 response format', async () => {
    mockFetchResponse({ Data: [{ Id: 1, Name: 'Harvest 1' }], Total: 1, Page: 1 });
    const client = new MetrcClient(baseConfig);

    const result = await client.getActiveHarvests();
    expect(result).toEqual([{ Id: 1, Name: 'Harvest 1' }]);
  });

  it('handles v2 Data: null gracefully', async () => {
    mockFetchResponse({ Data: null, Total: 0 });
    const client = new MetrcClient(baseConfig);

    const result = await client.getActiveHarvests();
    expect(result).toEqual([]);
  });

  it('passes pagination params', async () => {
    mockFetchResponse([]);
    const client = new MetrcClient(baseConfig);

    await client.getActiveStrains({ pageNumber: 2, pageSize: 25 });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('pageNumber=2');
    expect(url).toContain('pageSize=25');
  });

  it('flattens nested Item fields on packages', async () => {
    mockFetchResponse([{
      Id: 1,
      Label: 'PKG-001',
      Item: { Name: 'Blue Dream', ProductCategoryName: 'Flower', StrainName: 'BD', UnitOfMeasureName: 'Grams' },
    }]);
    const client = new MetrcClient(baseConfig);

    const [pkg] = await client.getActivePackages();
    expect(pkg.ItemName).toBe('Blue Dream');
    expect(pkg.ItemCategory).toBe('Flower');
    expect(pkg.ItemStrainName).toBe('BD');
    expect(pkg.ItemUnitOfMeasureName).toBe('Grams');
  });
});

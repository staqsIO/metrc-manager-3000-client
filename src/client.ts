/**
 * METRC API client.
 *
 * Design notes:
 * - No encryption — accepts plaintext keys
 * - No baked-in rate limiter — use withRateLimitClient() wrapper
 * - No baked-in retry — use withRetryClient() wrapper
 * - Async HMAC via Web Crypto (Edge-safe)
 */

import { getMetrcApiUrl } from './state-urls.js';
import { buildHmacHeaders, encodeBasicAuth } from './auth.js';
import { createMetrcError, MetrcApiError } from './errors.js';
import type {
  IMetrcClient,
  MetrcClientConfig,
  MetrcPackage,
  MetrcPlant,
  MetrcTransfer,
  MetrcDelivery,
  MetrcDeliveryPackage,
  MetrcDeliveryPackageWholesale,
  MetrcSaleReceipt,
  MetrcSaleReceiptDetail,
  MetrcLabTest,
  MetrcStrain,
  MetrcItem,
  MetrcLocation,
  MetrcHarvest,
  MetrcHarvestWaste,
  MetrcPlantBatch,
  MetrcPlantBatchWaste,
  MetrcWasteReason,
  MetrcPackageAdjustReason,
  MetrcWasteMethod,
  MetrcTag,
  MetrcPaginationParams,
} from './types.js';

export class MetrcClient implements IMetrcClient {
  private readonly apiUrl: string;
  private readonly vendorApiKey: string;
  private readonly userApiKey: string;
  private readonly licenseNumber: string;
  private readonly authMethod: 'basic' | 'hmac';
  private readonly timeout: number;
  private readonly debug: boolean;

  constructor(config: MetrcClientConfig) {
    this.apiUrl = getMetrcApiUrl(config.stateCode, config.environment);
    this.vendorApiKey = config.vendorApiKey;
    this.userApiKey = config.userApiKey;
    this.licenseNumber = config.licenseNumber;
    this.authMethod = config.authMethod ?? 'hmac';
    this.timeout = config.timeout ?? 30000;
    this.debug = config.debug ?? false;
  }

  private async request<T>(method: string, endpoint: string, data?: unknown, params: Record<string, string> = {}): Promise<T> {
    if (!params.licenseNumber) {
      params.licenseNumber = this.licenseNumber;
    }

    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const body = data ? JSON.stringify(data) : '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authMethod === 'basic') {
      headers['Authorization'] = encodeBasicAuth(this.vendorApiKey, this.userApiKey);
    } else {
      const hmacHeaders = await buildHmacHeaders(
        this.vendorApiKey, this.userApiKey, method, path, body,
      );
      Object.assign(headers, hmacHeaders);
    }

    const queryString = new URLSearchParams(params).toString();
    const url = `${this.apiUrl}${path}${queryString ? `?${queryString}` : ''}`;

    if (this.debug) {
      console.log(`[METRC] ${method} ${path}`, { params });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? body : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        const retryAfter = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
        throw createMetrcError(response.status, errorText, retryAfterSeconds);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const text = await response.text();
      if (!text) {
        return undefined as T;
      }
      return JSON.parse(text);
    } catch (error: unknown) {
      if (error instanceof MetrcApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new MetrcApiError(0, `Request exceeded ${this.timeout}ms timeout`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async get<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, params);
  }

  private async post<T>(endpoint: string, data: unknown, params: Record<string, string> = {}): Promise<T> {
    return this.request<T>('POST', endpoint, data, params);
  }

  private async put<T>(endpoint: string, data: unknown, params: Record<string, string> = {}): Promise<T> {
    return this.request<T>('PUT', endpoint, data, params);
  }

  private async delete<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, params);
  }

  /**
   * Unwrap v2 API responses that return `{ Data: [...], Total, Page, PageSize }`.
   * Falls back to raw value if already an array.
   */
  private unwrapV2Response<T>(response: unknown): T[] {
    if (Array.isArray(response)) return response as T[];
    if (response && typeof response === 'object' && 'Data' in response) {
      const data = (response as { Data: T[] | null }).Data;
      if (data === null) {
        return [];
      }
      return data;
    }
    return [];
  }

  /** Merge optional pagination params into query params. */
  private withPagination(
    filters: Record<string, string>,
    pagination?: MetrcPaginationParams,
  ): Record<string, string> {
    const params = { ...filters };
    if (pagination?.pageNumber != null) params.pageNumber = String(pagination.pageNumber);
    if (pagination?.pageSize != null) params.pageSize = String(pagination.pageSize);
    return params;
  }

  /**
   * Normalize nested Item fields from Metrc v1 API responses.
   * The v1 API may return `Item: { Name, StrainName, ... }` but
   * our MetrcPackage type expects flat fields.
   */
  private flattenPackageFields(raw: Record<string, unknown>): MetrcPackage {
    const item = raw.Item as Record<string, unknown> | undefined;
    return {
      ...raw,
      ItemName: (raw.ItemName as string) ?? (item?.Name as string) ?? '',
      ItemCategory: (raw.ItemCategory as string) ?? (item?.ProductCategoryName as string) ?? '',
      ItemStrainName: (raw.ItemStrainName as string) ?? (item?.StrainName as string) ?? '',
      ItemUnitOfMeasureName: (raw.ItemUnitOfMeasureName as string) ?? (item?.UnitOfMeasureName as string) ?? '',
    } as MetrcPackage;
  }

  // ── Plants ──

  async getActivePlants(filters: Record<string, string> = {}, _pagination?: MetrcPaginationParams): Promise<MetrcPlant[]> {
    const catch404 = (error: unknown): MetrcPlant[] => {
      if (error instanceof MetrcApiError && error.statusCode === 404) return [];
      throw error;
    };
    const [flowering, vegetative] = await Promise.all([
      this.get<MetrcPlant[]>('/plants/v1/flowering', { ...filters }).catch(catch404),
      this.get<MetrcPlant[]>('/plants/v1/vegetative', { ...filters }).catch(catch404),
    ]);
    return [...flowering, ...vegetative];
  }

  async getPlant(plantId: number): Promise<MetrcPlant> {
    return this.get(`/plants/v1/${plantId}`);
  }

  // ── Packages ──

  async getActivePackages(filters: Record<string, string> = {}, pagination?: MetrcPaginationParams): Promise<MetrcPackage[]> {
    const raw = await this.get<Record<string, unknown>[]>('/packages/v1/active', this.withPagination(filters, pagination));
    return raw.map(pkg => this.flattenPackageFields(pkg));
  }

  async getPackage(packageId: number): Promise<MetrcPackage> {
    const raw = await this.get<Record<string, unknown>>(`/packages/v1/${packageId}`);
    return this.flattenPackageFields(raw);
  }

  async getPackageTypes(): Promise<string[]> {
    return this.get('/packages/v1/types');
  }

  // ── Transfers ──

  async getIncomingTransfers(filters: Record<string, string> = {}, pagination?: MetrcPaginationParams): Promise<MetrcTransfer[]> {
    return this.get('/transfers/v1/incoming', this.withPagination(filters, pagination));
  }

  async getOutgoingTransfers(filters: Record<string, string> = {}, pagination?: MetrcPaginationParams): Promise<MetrcTransfer[]> {
    return this.get('/transfers/v1/outgoing', this.withPagination(filters, pagination));
  }

  async getRejectedTransfers(filters: Record<string, string> = {}, pagination?: MetrcPaginationParams): Promise<MetrcTransfer[]> {
    const raw = await this.get<unknown>('/transfers/v2/rejected', this.withPagination(filters, pagination));
    return this.unwrapV2Response<MetrcTransfer>(raw);
  }

  async getTransferDeliveries(transferId: number): Promise<MetrcDelivery[]> {
    const raw = await this.get<unknown>(`/transfers/v2/${transferId}/deliveries`);
    return this.unwrapV2Response<MetrcDelivery>(raw);
  }

  async getDeliveryPackages(deliveryId: number): Promise<MetrcDeliveryPackage[]> {
    const raw = await this.get<unknown>(`/transfers/v2/deliveries/${deliveryId}/packages`);
    return this.unwrapV2Response<MetrcDeliveryPackage>(raw);
  }

  /**
   * V2 dedicated per-package wholesale price endpoint. Returns one row per
   * package in the delivery with separate ShipperWholesalePrice and
   * ReceiverWholesalePrice fields. The basic /packages endpoint does NOT
   * include wholesale prices on v2 — this dedicated endpoint is required.
   *
   * Endpoint: GET /transfers/v2/deliveries/{id}/packages/wholesale
   */
  async getDeliveryPackagesWholesale(
    deliveryId: number,
  ): Promise<MetrcDeliveryPackageWholesale[]> {
    const raw = await this.get<unknown>(`/transfers/v2/deliveries/${deliveryId}/packages/wholesale`);
    return this.unwrapV2Response<MetrcDeliveryPackageWholesale>(raw);
  }

  // ── Sales ──

  async getSalesReceipts(filters: Record<string, string> = {}, pagination?: MetrcPaginationParams): Promise<MetrcSaleReceipt[]> {
    return this.get('/sales/v1/receipts', this.withPagination(filters, pagination));
  }

  /**
   * V2 active sales receipts — summary list (no line items).
   * Endpoint: GET /sales/v2/receipts/active
   */
  async getSalesReceiptsActive(
    filters: Record<string, string> = {},
    pagination?: MetrcPaginationParams,
  ): Promise<MetrcSaleReceipt[]> {
    const raw = await this.get<unknown>('/sales/v2/receipts/active', this.withPagination(filters, pagination));
    return this.unwrapV2Response<MetrcSaleReceipt>(raw);
  }

  /**
   * V2 inactive (historical) sales receipts — summary list.
   * Endpoint: GET /sales/v2/receipts/inactive
   */
  async getSalesReceiptsInactive(
    filters: Record<string, string> = {},
    pagination?: MetrcPaginationParams,
  ): Promise<MetrcSaleReceipt[]> {
    const raw = await this.get<unknown>('/sales/v2/receipts/inactive', this.withPagination(filters, pagination));
    return this.unwrapV2Response<MetrcSaleReceipt>(raw);
  }

  /**
   * V2 individual sales receipt with line-item transactions. Used to close
   * the margin loop — joins sales price to packageLabel so we can compute
   * cost-vs-sale per package.
   * Endpoint: GET /sales/v2/receipts/{id}
   */
  async getSalesReceipt(receiptId: number): Promise<MetrcSaleReceiptDetail> {
    return this.get<MetrcSaleReceiptDetail>(`/sales/v2/receipts/${receiptId}`);
  }

  // ── Lab Tests ──

  async getLabTestResults(filters: Record<string, string> = {}, pagination?: MetrcPaginationParams): Promise<MetrcLabTest[]> {
    try {
      return await this.get<MetrcLabTest[]>('/labtests/v1/results', this.withPagination(filters, pagination));
    } catch (error) {
      if (error instanceof MetrcApiError && error.statusCode === 404) {
        return [];
      }
      throw error;
    }
  }

  // ── Strains ──

  async getActiveStrains(pagination?: MetrcPaginationParams): Promise<MetrcStrain[]> {
    return this.get('/strains/v1/active', this.withPagination({}, pagination));
  }

  // ── Items ──

  async getActiveItems(pagination?: MetrcPaginationParams): Promise<MetrcItem[]> {
    return this.get('/items/v1/active', this.withPagination({}, pagination));
  }

  // ── Locations ──

  async getActiveLocations(pagination?: MetrcPaginationParams): Promise<MetrcLocation[]> {
    return this.get('/locations/v1/active', this.withPagination({}, pagination));
  }

  // ── Harvests (v2 endpoints) ──

  async getActiveHarvests(filters: Record<string, string> = {}, pagination?: MetrcPaginationParams): Promise<MetrcHarvest[]> {
    const raw = await this.get<unknown>('/harvests/v2/active', this.withPagination(filters, pagination));
    return this.unwrapV2Response<MetrcHarvest>(raw);
  }

  async getOnHoldHarvests(filters: Record<string, string> = {}, pagination?: MetrcPaginationParams): Promise<MetrcHarvest[]> {
    const raw = await this.get<unknown>('/harvests/v2/onhold', this.withPagination(filters, pagination));
    return this.unwrapV2Response<MetrcHarvest>(raw);
  }

  async getInactiveHarvests(filters: Record<string, string> = {}, pagination?: MetrcPaginationParams): Promise<MetrcHarvest[]> {
    const raw = await this.get<unknown>('/harvests/v2/inactive', this.withPagination(filters, pagination));
    return this.unwrapV2Response<MetrcHarvest>(raw);
  }

  async getHarvest(harvestId: number): Promise<MetrcHarvest> {
    const raw = await this.get<unknown>(`/harvests/v2/${harvestId}`);
    if (raw && typeof raw === 'object' && 'Data' in raw) {
      return (raw as { Data: MetrcHarvest }).Data;
    }
    return raw as MetrcHarvest;
  }

  async getHarvestWaste(harvestId: number): Promise<MetrcHarvestWaste[]> {
    const raw = await this.get<unknown>('/harvests/v2/waste', { harvestId: String(harvestId) });
    return this.unwrapV2Response<MetrcHarvestWaste>(raw);
  }

  async getHarvestWasteTypes(): Promise<string[]> {
    const raw = await this.get<unknown>('/harvests/v2/waste/types');
    const items = this.unwrapV2Response<{ Name: string }>(raw);
    return items.map((t) => t.Name);
  }

  // ── Plant Batches ──

  async getActivePlantBatches(filters: Record<string, string> = {}, pagination?: MetrcPaginationParams): Promise<MetrcPlantBatch[]> {
    return this.get('/plantbatches/v1/active', this.withPagination(filters, pagination));
  }

  async getInactivePlantBatches(filters: Record<string, string> = {}, pagination?: MetrcPaginationParams): Promise<MetrcPlantBatch[]> {
    return this.get('/plantbatches/v1/inactive', this.withPagination(filters, pagination));
  }

  async getPlantBatch(plantBatchId: number): Promise<MetrcPlantBatch> {
    return this.get(`/plantbatches/v1/${plantBatchId}`);
  }

  // ── Write: Plant Batches ──

  async createPlantBatches(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/plantbatches/v1/createplantings', data);
  }

  async destroyPlantBatches(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/plantbatches/v1/destroy', data);
  }

  async changePlantBatchGrowthPhase(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/plantbatches/v1/changegrowthphase', data);
  }

  // ── Write: Packages ──

  async adjustPackages(data: Record<string, unknown>[]): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const mapped = data.map(d => ({ AdjustmentDate: today, ...d }));
    await this.post('/packages/v1/adjust', mapped);
  }

  async createPackages(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/packages/v1/create/plantings', data);
  }

  async finishPackages(data: Record<string, unknown>[]): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const mapped = data.map(d => ({ ActualDate: today, ...d }));
    await this.post('/packages/v1/finish', mapped);
  }

  async changePackageNote(data: Record<string, unknown>[]): Promise<void> {
    const mapped = data.map(d => {
      const { Label, ...rest } = d;
      return Label !== undefined ? { PackageLabel: Label, ...rest } : d;
    });
    await this.put('/packages/v1/change/note', mapped);
  }

  async remediatePackages(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/packages/v1/remediate', data);
  }

  async submitPackagesForTesting(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/packages/v2/testing', data);
  }

  async changePackageLocations(data: Record<string, unknown>[]): Promise<void> {
    await this.put('/packages/v2/location', data);
  }

  // ── Write: Processing ──

  async createProcessingPackages(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/packages/v1/create', data);
  }

  // ── Write: Harvests ──

  async finishHarvests(data: Record<string, unknown>[]): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const mapped = data.map(d => ({ ActualDate: today, ...d }));
    await this.put('/harvests/v2/finish', mapped);
  }

  async createPackagesFromHarvest(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/harvests/v2/packages', data);
  }

  async recordHarvestWaste(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/harvests/v2/waste', data);
  }

  // ── Write: Strains ──

  async createStrains(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/strains/v1/create', data);
  }

  async updateStrains(data: Record<string, unknown>[]): Promise<void> {
    await this.put('/strains/v2/', data);
  }

  // ── Write: Items ──

  async createItems(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/items/v1/create', data);
  }

  async updateItems(data: Record<string, unknown>[]): Promise<void> {
    await this.put('/items/v2/', data);
  }

  // ── Write: Locations ──

  async createLocations(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/locations/v1/create', data);
  }

  // ── Write: Transfers ──

  async createExternalIncomingTransfers(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/transfers/v2/external/incoming', data);
  }

  async createExternalOutgoingTransfers(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/transfers/v2/external/outgoing', data);
  }

  // ── Write: Sales ──

  async createSalesReceipts(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/sales/v2/receipts', data);
  }

  // ── Write: Lab Tests ──

  async recordLabTests(data: Record<string, unknown>[]): Promise<void> {
    await this.post('/labtests/v1/record', data);
  }

  // ── Waste & Loss ──

  async getPlantBatchWaste(licenseNumber: string): Promise<MetrcPlantBatchWaste[]> {
    const raw = await this.get<unknown>('/plantbatches/v2/waste', { licenseNumber });
    return this.unwrapV2Response<MetrcPlantBatchWaste>(raw);
  }

  async getPlantBatchWasteReasons(licenseNumber: string): Promise<MetrcWasteReason[]> {
    const raw = await this.get<unknown>('/plantbatches/v2/waste/reasons', { licenseNumber });
    return this.unwrapV2Response<MetrcWasteReason>(raw);
  }

  async recordPlantBatchWaste(licenseNumber: string, data: Record<string, unknown>[]): Promise<void> {
    await this.post('/plantbatches/v2/waste', data, { licenseNumber });
  }

  async getPackageAdjustReasons(licenseNumber: string): Promise<MetrcPackageAdjustReason[]> {
    const raw = await this.get<unknown>('/packages/v2/adjust/reasons', { licenseNumber });
    return this.unwrapV2Response<MetrcPackageAdjustReason>(raw);
  }

  async getPlantWasteMethods(): Promise<MetrcWasteMethod[]> {
    const raw = await this.get<unknown>('/plants/v1/waste/methods/all', {});
    return Array.isArray(raw) ? raw : this.unwrapV2Response<MetrcWasteMethod>(raw);
  }

  async deleteHarvestWaste(licenseNumber: string, wasteId: number): Promise<void> {
    await this.delete(`/harvests/v2/waste/${wasteId}`, { licenseNumber });
  }

  async destroyPlants(licenseNumber: string, data: Record<string, unknown>[]): Promise<void> {
    await this.post('/plants/v2/destroyplants', data, { licenseNumber });
  }

  // ── Tags ──

  async getAvailableTags(pagination?: MetrcPaginationParams): Promise<MetrcTag[]> {
    const raw = await this.get<unknown>('/tags/v2/package/available', this.withPagination({}, pagination));
    return this.unwrapV2Response<MetrcTag>(raw);
  }
}

/**
 * Factory function for creating a MetrcClient.
 */
export function createMetrcClient(config: MetrcClientConfig): IMetrcClient {
  return new MetrcClient(config);
}

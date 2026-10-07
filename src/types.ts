// ── Configuration types ──

export type MetrcEnvironment = 'sandbox' | 'production';
export type MetrcAuthMethod = 'basic' | 'hmac';

export interface MetrcClientConfig {
  stateCode: string;
  licenseNumber: string;
  vendorApiKey: string;
  userApiKey: string;
  environment: MetrcEnvironment;
  authMethod?: MetrcAuthMethod;
  timeout?: number;
  debug?: boolean;
}

// ── Pagination ──

export interface MetrcPaginationParams {
  /** Page number (1-based). */
  pageNumber?: number;
  /** Number of results per page. */
  pageSize?: number;
}

// ── Entity types ──

export interface MetrcTag {
  Id: number;
  Label: string;
  TagTypeName: string;
  StatusName: string;
  UsedDateTime: string | null;
}

export interface MetrcPackage {
  Id: number;
  Label: string;
  PackageType: string;
  SourceHarvestNames: string;
  SourcePackageLabels: string;
  ItemId: number;
  ItemName: string;
  ItemCategory: string;
  ItemStrainName: string;
  ItemUnitOfMeasureName: string;
  Quantity: number;
  UnitOfMeasureName: string;
  PatientLicenseNumber: string;
  ItemServeCount: string;
  Note: string;
  PackagedDate: string;
  InitialLabTestingState: string;
  LabTestingState: string;
  LabTestingStateDate: string;
  ProductionBatchNumber: string;
  IsDonation: boolean;
  IsTradesSample: boolean;
  IsTestingSample: boolean;
  ProductRequiresRemediation: boolean;
  ContainsRemediatedProduct: boolean;
  RemediationDate: string | null;
  ReceivedDateTime: string | null;
  ReceivedFromManifestNumber: string | null;
  ReceivedFromFacilityLicenseNumber: string | null;
  ReceivedFromFacilityName: string | null;
  IsOnHold: boolean;
  ArchivedDate: string | null;
  FinishedDate: string | null;
  LastModified: string;
  LocationName: string;
  RoomName: string;
}

export interface MetrcPlant {
  Id: number;
  Label: string;
  State: string;
  GrowthPhase: string;
  PlantBatchName: string;
  PlantBatchTypeName: string;
  StrainName: string;
  LocationName: string;
  RoomName: string;
  PatientLicenseNumber: string;
  HarvestCount: number;
  IsOnHold: boolean;
  PlantedDate: string;
  VegetativeDate: string | null;
  FloweringDate: string | null;
  HarvestedDate: string | null;
  DestroyedDate: string | null;
  LastModified: string;
}

export interface MetrcTransfer {
  Id: number;
  ManifestNumber: string;
  ShipperFacilityLicenseNumber: string;
  ShipperFacilityName: string;
  TransporterFacilityLicenseNumber: string;
  TransporterFacilityName: string;
  ReceiverFacilityLicenseNumber: string;
  ReceiverFacilityName: string;
  DeliveryCount: number;
  ReceivedDeliveryCount: number;
  PackageCount: number;
  ReceivedPackageCount: number;
  ContainsDonation: boolean;
  ContainsTradeSample: boolean;
  ContainsTestingSample: boolean;
  CreatedDateTime: string;
  CreatedByUserName: string;
  LastModified: string;
  EstimatedDepartureDateTime: string;
  EstimatedArrivalDateTime: string;
  ReceivedDateTime: string | null;
}

export interface MetrcDelivery {
  Id: number;
  RecipientFacilityLicenseNumber: string;
  RecipientFacilityName: string;
  ShipmentTypeName: string;
  ShipmentTransactionType: string;
  EstimatedDepartureDateTime: string;
  EstimatedArrivalDateTime: string;
  ActualDepartureDateTime: string | null;
  ActualArrivalDateTime: string | null;
  GrossWeight: number | null;
  GrossUnitOfWeightName: string | null;
  PlannedRoute: string;
  ReceivedDateTime: string | null;
  ReceivedByName: string | null;
  TotalPackages: number;
  TotalPrice: number | null;
}

export interface MetrcDeliveryPackage {
  PackageId: number;
  PackageLabel: string;
  PackageType: string;
  ItemName: string;
  ItemStrainName: string;
  ItemCategory: string;
  Quantity: number;
  UnitOfMeasureName: string;
  GrossWeight: number | null;
  GrossUnitOfWeightName: string | null;
  WholesalePrice: number | null;
  ShipmentPackageState: string;
  LabTestingState: string;
  RemediationDate: string | null;
}

/**
 * Per-package wholesale price returned by the dedicated endpoint
 * `GET /transfers/v2/deliveries/{id}/packages/wholesale`. The basic
 * /packages endpoint does NOT include wholesale prices on v2 — this
 * dedicated endpoint is required to fetch them.
 *
 * Both ShipperWholesalePrice and ReceiverWholesalePrice can be null
 * (the seller and/or buyer haven't entered a price). ReceiverWholesalePrice is what the
 * buyer actually paid/owes — prefer it when present.
 */
export interface MetrcDeliveryPackageWholesale {
  PackageId: number;
  PackageLabel: string;
  ShipperWholesalePrice: number | null;
  ReceiverWholesalePrice: number | null;
}

export interface MetrcSaleReceipt {
  Id: number;
  ReceiptNumber: string;
  SalesDateTime: string;
  SalesCustomerType: string;
  PatientLicenseNumber: string | null;
  TotalPackages: number;
  TotalPrice: number;
  LastModified: string;
}

/**
 * Line item within a sales receipt. Returned by `/sales/v2/receipts/{id}`.
 * Joins sales → packages via `PackageLabel` for per-package margin analysis.
 */
export interface MetrcSaleReceiptTransaction {
  PackageId: number;
  PackageLabel: string;
  ProductName: string;
  ProductCategoryName: string;
  QuantitySold: number;
  UnitOfMeasureName: string;
  UnitThcContent: number | null;
  UnitThcContentUnitOfMeasureName: string | null;
  UnitWeight: number | null;
  UnitWeightUnitOfMeasureName: string | null;
  TotalPrice: number;
  UnitPrice: number | null;
  SalesDeliveryState: string | null;
  ArchivedDate: string | null;
  RecordedDateTime: string;
  RecordedByUserName: string | null;
  LastModified: string;
}

/**
 * Detailed sales receipt with line items. Returned by the individual receipt
 * endpoint `/sales/v2/receipts/{id}` (the list endpoints only return summary).
 */
export interface MetrcSaleReceiptDetail extends MetrcSaleReceipt {
  Transactions: MetrcSaleReceiptTransaction[];
}

export interface MetrcLabTest {
  PackageId: number;
  PackageLabel: string;
  TestPerformedDate: string;
  OverallPassed: boolean;
  TestTypeName: string;
  TestResultLevel: number;
  TestResultUnit: string;
  LabFacilityName: string;
}

export interface MetrcStrain {
  Id: number;
  Name: string;
  TestingStatus: string;
  ThcLevel: number;
  CbdLevel: number;
  IndicaPercentage: number;
  SativaPercentage: number;
}

export interface MetrcItem {
  Id: number;
  Name: string;
  ProductCategoryName: string;
  ProductCategoryType: string;
  QuantityType: string;
  DefaultLabTestingState: string;
  UnitOfMeasureName: string;
  StrainName: string;
}

export interface MetrcLocation {
  Id: number;
  Name: string;
  LocationTypeId: number;
  LocationTypeName: string;
}

export interface MetrcHarvest {
  Id: number;
  Name: string;
  HarvestType: string;
  SourceStrainNames: string;
  DryingLocationName: string;
  PatientLicenseNumber: string | null;
  CurrentWeight: number;
  TotalWasteWeight: number;
  TotalRestoredWeight: number;
  PackageCount: number;
  TotalPackagedWeight: number;
  UnitOfWeightName: string;
  LabTestingState: string;
  LabTestingStateDate: string | null;
  IsOnHold: boolean;
  HarvestStartDate: string;
  FinishedDate: string | null;
  ArchivedDate: string | null;
  LastModified: string;
}

export interface MetrcHarvestWaste {
  Id: number;
  HarvestId: number;
  WasteTypeName: string;
  WasteWeight: number;
  UnitOfWeightName: string;
  ActualDate: string;
}

export interface MetrcPlantBatch {
  Id: number;
  Name: string;
  Type: string;
  StrainName: string;
  LocationName: string;
  RoomName: string;
  PatientLicenseNumber: string | null;
  Count: number;
  UntrackedCount: number;
  TrackedCount: number;
  PackagedCount: number;
  HarvestedCount: number;
  DestroyedCount: number;
  PlantedDate: string;
  LastModified: string;
}

export interface MetrcPlantBatchWaste {
  Id: number;
  PlantBatchId: number;
  PlantBatchName: string;
  WasteReasonName: string;
  WasteWeight: number;
  UnitOfWeightName: string;
  ActualDate: string;
  LastModified: string;
}

export interface MetrcWasteReason {
  Name: string;
}

export interface MetrcPackageAdjustReason {
  Name: string;
  RequiresNote: boolean;
  RequiresWasteWeight: boolean;
  RequiresImmatureWasteWeight: boolean;
  RequiresMatureWasteWeight: boolean;
}

export interface MetrcWasteMethod {
  Name: string;
  ForPlants: boolean;
  ForProductDestruction: boolean;
  LastModified: string;
}

// ── Client interface (44 methods) ──

export interface IMetrcClient {
  // Plants
  getActivePlants(filters?: Record<string, string>, pagination?: MetrcPaginationParams): Promise<MetrcPlant[]>;
  getPlant(plantId: number): Promise<MetrcPlant>;

  // Packages
  getActivePackages(filters?: Record<string, string>, pagination?: MetrcPaginationParams): Promise<MetrcPackage[]>;
  getPackage(packageId: number): Promise<MetrcPackage>;
  getPackageTypes(): Promise<string[]>;

  // Transfers
  getIncomingTransfers(filters?: Record<string, string>, pagination?: MetrcPaginationParams): Promise<MetrcTransfer[]>;
  getOutgoingTransfers(filters?: Record<string, string>, pagination?: MetrcPaginationParams): Promise<MetrcTransfer[]>;
  getRejectedTransfers(filters?: Record<string, string>, pagination?: MetrcPaginationParams): Promise<MetrcTransfer[]>;
  getTransferDeliveries(transferId: number): Promise<MetrcDelivery[]>;
  getDeliveryPackages(deliveryId: number): Promise<MetrcDeliveryPackage[]>;
  /**
   * V2 dedicated per-package wholesale endpoint. Optional — implementations
   * may throw or return [] if not supported. Required for v2 states (MA, CA)
   * because the basic /packages endpoint omits WholesalePrice on v2.
   */
  getDeliveryPackagesWholesale?(deliveryId: number): Promise<MetrcDeliveryPackageWholesale[]>;

  // Sales
  getSalesReceipts(filters?: Record<string, string>, pagination?: MetrcPaginationParams): Promise<MetrcSaleReceipt[]>;
  /**
   * V2 active sales receipts (summary list). Optional — implementations may
   * throw or return [] if not supported for a given state/environment.
   */
  getSalesReceiptsActive?(filters?: Record<string, string>, pagination?: MetrcPaginationParams): Promise<MetrcSaleReceipt[]>;
  /**
   * V2 inactive sales receipts (summary list). Optional — implementations may
   * throw or return [] if not supported for a given state/environment.
   */
  getSalesReceiptsInactive?(filters?: Record<string, string>, pagination?: MetrcPaginationParams): Promise<MetrcSaleReceipt[]>;
  /**
   * V2 individual receipt detail with line items (`Transactions` array).
   * Required for margin analysis (joins sales price to packageLabel).
   * Optional on the interface — callers should check for existence.
   */
  getSalesReceipt?(receiptId: number): Promise<MetrcSaleReceiptDetail>;

  // Lab Tests
  getLabTestResults(filters?: Record<string, string>, pagination?: MetrcPaginationParams): Promise<MetrcLabTest[]>;

  // Strains
  getActiveStrains(pagination?: MetrcPaginationParams): Promise<MetrcStrain[]>;

  // Items
  getActiveItems(pagination?: MetrcPaginationParams): Promise<MetrcItem[]>;

  // Locations
  getActiveLocations(pagination?: MetrcPaginationParams): Promise<MetrcLocation[]>;

  // Harvests
  getActiveHarvests(filters?: Record<string, string>, pagination?: MetrcPaginationParams): Promise<MetrcHarvest[]>;
  getOnHoldHarvests(filters?: Record<string, string>, pagination?: MetrcPaginationParams): Promise<MetrcHarvest[]>;
  getInactiveHarvests(filters?: Record<string, string>, pagination?: MetrcPaginationParams): Promise<MetrcHarvest[]>;
  getHarvest(harvestId: number): Promise<MetrcHarvest>;
  getHarvestWaste(harvestId: number): Promise<MetrcHarvestWaste[]>;
  getHarvestWasteTypes(): Promise<string[]>;

  // Plant Batches
  getActivePlantBatches(filters?: Record<string, string>, pagination?: MetrcPaginationParams): Promise<MetrcPlantBatch[]>;
  getInactivePlantBatches(filters?: Record<string, string>, pagination?: MetrcPaginationParams): Promise<MetrcPlantBatch[]>;
  getPlantBatch(plantBatchId: number): Promise<MetrcPlantBatch>;

  // Write operations — Plant Batches
  createPlantBatches(data: Record<string, unknown>[]): Promise<void>;
  destroyPlantBatches(data: Record<string, unknown>[]): Promise<void>;
  changePlantBatchGrowthPhase(data: Record<string, unknown>[]): Promise<void>;

  // Write operations — Packages
  adjustPackages(data: Record<string, unknown>[]): Promise<void>;
  createPackages(data: Record<string, unknown>[]): Promise<void>;
  finishPackages(data: Record<string, unknown>[]): Promise<void>;
  changePackageNote(data: Record<string, unknown>[]): Promise<void>;
  remediatePackages(data: Record<string, unknown>[]): Promise<void>;
  submitPackagesForTesting(data: Record<string, unknown>[]): Promise<void>;

  // Write operations — Processing
  createProcessingPackages(data: Record<string, unknown>[]): Promise<void>;

  // Write operations — Harvests
  finishHarvests(data: Record<string, unknown>[]): Promise<void>;
  createPackagesFromHarvest(data: Record<string, unknown>[]): Promise<void>;
  recordHarvestWaste(data: Record<string, unknown>[]): Promise<void>;

  // Write operations — Strains
  createStrains(data: Record<string, unknown>[]): Promise<void>;
  updateStrains(data: Record<string, unknown>[]): Promise<void>;

  // Write operations — Items
  createItems(data: Record<string, unknown>[]): Promise<void>;
  updateItems(data: Record<string, unknown>[]): Promise<void>;

  // Write operations — Locations
  createLocations(data: Record<string, unknown>[]): Promise<void>;

  // Write operations — Packages (location)
  changePackageLocations(data: Record<string, unknown>[]): Promise<void>;

  // Write operations — Transfers
  createExternalIncomingTransfers(data: Record<string, unknown>[]): Promise<void>;
  createExternalOutgoingTransfers(data: Record<string, unknown>[]): Promise<void>;

  // Write operations — Sales
  createSalesReceipts(data: Record<string, unknown>[]): Promise<void>;

  // Write operations — Lab Tests
  recordLabTests(data: Record<string, unknown>[]): Promise<void>;

  // Tags
  getAvailableTags(pagination?: MetrcPaginationParams): Promise<MetrcTag[]>;

  // Waste & Loss
  getPlantBatchWaste(licenseNumber: string): Promise<MetrcPlantBatchWaste[]>;
  getPlantBatchWasteReasons(licenseNumber: string): Promise<MetrcWasteReason[]>;
  recordPlantBatchWaste(licenseNumber: string, data: Record<string, unknown>[]): Promise<void>;
  getPackageAdjustReasons(licenseNumber: string): Promise<MetrcPackageAdjustReason[]>;
  getPlantWasteMethods(): Promise<MetrcWasteMethod[]>;
  deleteHarvestWaste(licenseNumber: string, wasteId: number): Promise<void>;
  destroyPlants(licenseNumber: string, data: Record<string, unknown>[]): Promise<void>;
}

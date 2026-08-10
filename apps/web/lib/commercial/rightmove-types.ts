/**
 * Minimal request/response types for Rightmove Commercial Listings API v2.
 * Derived from the Commercial Listings OpenAPI (BuildingOnly / WithSpaces).
 */

export type RightmoveTransactionType = 'SALES' | 'LETTINGS';

export type RightmoveStatus =
  | 'AVAILABLE'
  | 'SOLD_STC'
  | 'SOLD_STCM'
  | 'RESERVED'
  | 'LET_AGREED'
  | 'UNDER_OFFER';

export type RightmoveSubType =
  | 'AUTOMOTIVE'
  | 'BAR'
  | 'BUSINESS_PARK'
  | 'CAFE'
  | 'CARE_HOME_FACILITY'
  | 'CHILDCARE_FACILITY'
  | 'COMMERCIAL_DEVELOPMENT'
  | 'COMMERCIAL_KITCHEN'
  | 'DATA_CENTRE'
  | 'DENTAL_CARE'
  | 'DISTRIBUTION_WAREHOUSE'
  | 'FACTORY_MANUFACTURING'
  | 'FARM'
  | 'GARAGE'
  | 'HEALTHCARE_FACILITY'
  | 'HEAVY_INDUSTRIAL'
  | 'HOTEL'
  | 'INDUSTRIAL_PARK'
  | 'LAND'
  | 'LEISURE_FACILITY'
  | 'LIFE_SCIENCES_LABS'
  | 'LIGHT_INDUSTRIAL'
  | 'MIXED_USE'
  | 'OFFICE'
  | 'OTHER'
  | 'PETROL_STATION'
  | 'PLACE_OF_WORSHIP'
  | 'PHARMACY'
  | 'POST_OFFICE'
  | 'PUB'
  | 'RESIDENTIAL_DEVELOPMENT'
  | 'RESTAURANT'
  | 'RETAIL_HIGH_STREET'
  | 'RETAIL_OUT_OF_TOWN'
  | 'RETAIL_PROPERTY_SHOPPING_CENTRE'
  | 'SCIENCE_PARK'
  | 'SELF_STORAGE'
  | 'SERVICED_OFFICE'
  | 'SHOP'
  | 'SHOWROOM'
  | 'STUDENT_HOUSING'
  | 'TAKEAWAY'
  | 'TRADE_COUNTER'
  | 'WAREHOUSE'
  | 'WOODLAND'
  | 'WORKSHOP'
  | 'CAMPSITE_HOLIDAY_VILLAGE'
  | 'COMM_GUEST_HOUSE'
  | 'CONVENIENCE_STORE';

export type RightmoveAreaSizeUnit = 'SQFT' | 'SQM' | 'ACRES' | 'HECTARES';

export type RightmoveRentFrequency = 'YEARLY' | 'MONTHLY';

export type RightmoveBuildingPriceDisplayQualifier =
  | 'NONE'
  | 'PRICE_ON_APPLICATION'
  | 'GUIDE_PRICE'
  | 'OFFERS_IN_EXCESS_OF'
  | 'OFFERS_IN_REGION_OF'
  | 'FROM';

export type RightmoveSpacePriceDisplayQualifier =
  | 'NONE'
  | 'PRICE_ON_APPLICATION';

export type RightmoveRemovalReason =
  | 'SOLD_BY_US'
  | 'SOLD_BY_ANOTHER_AGENT'
  | 'WITHDRAWN_FROM_MARKET'
  | 'LOST_INSTRUCTION'
  | 'LET_BY_US'
  | 'REMOVED';

export type RightmoveMediaAsset = {
  url: string;
  description?: string;
  order?: number;
};

export type RightmoveMedia = {
  photos?: RightmoveMediaAsset[];
  floorPlans?: RightmoveMediaAsset[];
  epcs?: RightmoveMediaAsset[];
  epcGraphs?: RightmoveMediaAsset[];
  brochures?: RightmoveMediaAsset[];
  virtualTours?: RightmoveMediaAsset[];
};

export type RightmoveLocation = {
  displayAddress: string;
  buildingIdentifier: string;
  postcode: string;
  latitude?: number;
  longitude?: number;
  showMap?: boolean;
};

export type RightmoveBuildingPricing = {
  price: number;
  displayQualifier?: RightmoveBuildingPriceDisplayQualifier;
  frequency?: RightmoveRentFrequency;
  rentObligation?: string;
};

export type RightmoveSpacePricing = {
  price: number;
  displayQualifier?: RightmoveSpacePriceDisplayQualifier;
  frequency?: RightmoveRentFrequency;
  rentObligation?: string;
};

export type RightmoveBuildingSizing = {
  size?: number;
  minSize?: number;
  maxSize?: number;
  unit?: RightmoveAreaSizeUnit;
  measurementType?: string;
};

export type RightmoveSpaceSizing = {
  size: number;
  unit: RightmoveAreaSizeUnit;
  measurementType?: string;
};

export type RightmovePropertyClassification = {
  subType: RightmoveSubType;
  desks?: number;
  capacity?: { minimum?: number; maximum?: number };
  pricePerDeskPerMonth?: number;
  gradeOfSpaceType?: string;
  frontageFeet?: number;
  bedrooms?: number;
  clearHeight?: number;
  clearHeightUnit?: 'FT' | 'METRES';
  driveInBays?: number;
  dockLevelers?: number;
  powerSupplyKiloVoltAmperes?: number;
  floorLoadingCapacityKiloNewtons?: number;
  yardDepthMetres?: number;
};

export type RightmoveSpace = {
  reference: string;
  name: string;
  floorIdentifier: string;
  description?: string;
  sizing: RightmoveSpaceSizing;
  status: RightmoveStatus;
  pricing?: RightmoveSpacePricing;
  keyFeatures?: string[];
  availableDate?: string;
  published?: boolean;
  primaryPropertyClassification: RightmovePropertyClassification;
  media?: RightmoveMedia;
  order?: number;
};

type RightmoveBuildingBase = {
  agentId: number;
  description: string;
  summary: string;
  transactionType: RightmoveTransactionType;
  pricing: RightmoveBuildingPricing;
  primaryPropertyClassification: RightmovePropertyClassification;
  status: RightmoveStatus;
  published: boolean;
  location: RightmoveLocation;
  floors?: number;
  yearBuilt?: number;
  yearRenovated?: number;
  sizing?: RightmoveBuildingSizing;
  keyFeatures?: string[];
  amenities?: string[];
  useClasses?: string[];
  tenureType?: 'FREEHOLD' | 'LEASEHOLD' | 'SHARE_OF_FREEHOLD';
  tenureUnexpiredYears?: number;
  listedBuilding?: boolean;
  businessForSale?: boolean;
  auction?: boolean;
  parkingSpaces?: number;
  media?: RightmoveMedia;
  secondaryPropertyClassifications?: RightmovePropertyClassification[];
  letType?: string;
  availableDate?: string;
  serviceCharge?: number;
  businessRates?: number;
  letContractLength?: number;
  isRentAllInclusive?: boolean;
  condition?: string;
  environment?: {
    environmentalDescription?: string;
    breeamRating?: number;
    epcRating?: number;
  };
};

export type RightmoveBuildingOnly = RightmoveBuildingBase;

export type RightmoveBuildingWithSpaces = RightmoveBuildingBase & {
  spaces: RightmoveSpace[];
};

export type CommercialPropertyBuildingOnly = {
  building: RightmoveBuildingOnly;
};

export type CommercialPropertyWithSpaces = {
  building: RightmoveBuildingWithSpaces;
};

export type RightmovePropertyPayload =
  | CommercialPropertyBuildingOnly
  | CommercialPropertyWithSpaces;

export type RemoveCommercialProperty = {
  agentId: number;
  removalReason: RightmoveRemovalReason;
};

export type RightmovePropertySaveAction = {
  meta?: {
    requestTimestamp?: string;
    responseTimestamp?: string;
    traceId?: string;
  };
  data?: {
    links?: {
      self?: { building?: Record<string, unknown> };
      display?: {
        building?: Record<string, string> | Record<string, unknown>;
        spaces?: Record<string, string> | Record<string, unknown>;
      };
    };
  };
};

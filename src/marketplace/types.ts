export type ServiceFilter = {
  category?: string;
};

export type NormalizedService = {
  provider: "near-agent-market";
  externalServiceId: string;
  externalAgentId?: string;
  name: string;
  category?: string;
  description?: string;
  price?: {
    amount: string;
    acceptedAssets: string[];
  };
  availability?: string;
  availableNow?: boolean;
  deliveredJobs?: number;
  successRate?: number;
  slaSeconds?: number;
  builderVerification?: string;
  fetchedAt: string;
  raw: Record<string, unknown>;
};

export interface MarketplaceAdapter {
  listServices(filter: ServiceFilter): Promise<NormalizedService[]>;
}

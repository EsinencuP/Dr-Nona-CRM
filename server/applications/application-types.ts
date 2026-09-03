import type { ApplicationInput } from "../../shared/applications/application-schema";

export type ApplicationProduct = {
  slug: string;
  officialName: string;
  sku: string;
  quantity?: number;
};

export type ApplicationExtraFields = {
  email?: string;
  comment?: string;
  preferredCallTime?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  entryPoint?: string;
  sessionHistory?: string;
};

type ApplicationRecordBase = {
  schemaVersion: 1;
  requestId: string;
  type: ApplicationInput["type"];
  firstName: string;
  lastName: string;
  phone: string;
  phoneNormalized: string;
  city: string;
  source: "website";
  locale: ApplicationInput["locale"];
  submittedAt: string;
};

export type OrderApplicationRecord = ApplicationRecordBase & {
  type: "order";
  products: ApplicationProduct[];
};

export type ConsultationApplicationRecord = ApplicationRecordBase & {
  type: "consultation";
  consultationMode: "online" | "offline";
  consultationDate: string;
  consultationTime: string;
  timezone: "Europe/Chisinau";
};

export type MasterclassApplicationRecord = ApplicationRecordBase & {
  type: "masterclass";
  masterclassTopic: string;
  eventDate: string;
  eventTime: string;
  timezone: "Europe/Chisinau";
};

export type ApplicationRecord = OrderApplicationRecord | ConsultationApplicationRecord | MasterclassApplicationRecord;

export type ProviderName = "telegram";
export type ProviderResult =
  | {
      provider: ProviderName;
      status: "sent";
      providerMessageId: string;
      durationMs: number;
    }
  | {
      provider: ProviderName;
      status: "failed";
      statusCode?: number;
      errorCode: string;
      durationMs: number;
    };

export type DeliveryStatus = "sent" | "failed";

export type ApplicationServiceResult = {
  requestId: string;
  type: ApplicationInput["type"];
  delivery: {
    telegram: DeliveryStatus;
  };
  outcome: "success" | "failure";
};

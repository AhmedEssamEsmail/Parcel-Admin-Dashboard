export type RawDeliveryScope = "delivered" | "all" | "not_delivered";

export type RawDeliveryStagesResponse<T> = {
  rows: T[];
  totalCount: number;
  limit: number;
  offset: number;
  timingSourceSupported?: boolean;
  warning?: string;
};

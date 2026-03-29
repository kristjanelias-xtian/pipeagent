export interface PipedriveApiResponse<T> {
  success: boolean;
  data: T;
  additional_data?: {
    pagination?: {
      start: number;
      limit: number;
      more_items_in_collection: boolean;
      next_start?: number;
    };
  };
}

export interface PipedriveWebhookPayload {
  v: number;
  matches_filters: { current: string[] };
  meta: {
    action: string;
    object: string;
    id: number | string;
    company_id: number;
    user_id: number;
    timestamp: number;
  };
  current: Record<string, unknown> | null;
  previous: Record<string, unknown> | null;
  event: string;
}

export interface PipedriveTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  api_domain: string;
}

export interface PipedriveLeadLabel {
  id: string;
  name: string;
  color: string;
}

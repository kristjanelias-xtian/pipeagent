import type { PipedriveLead, PipedrivePerson, PipedriveOrganization, PipedriveDeal, PipedriveActivity, PipedriveNote } from '@pipeagent/shared';
import type { PipedriveApiResponse, PipedriveLeadLabel } from './types.js';

export class PipedriveClient {
  private apiDomain: string;
  private accessToken: string;

  constructor(apiDomain: string, accessToken: string) {
    // Normalize: strip trailing slash, ensure no /v1 suffix yet
    this.apiDomain = apiDomain.replace(/\/$/, '');
    this.accessToken = accessToken;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.apiDomain}/api/v1${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Pipedrive API error: ${response.status} - ${body}`);
    }

    const json = (await response.json()) as PipedriveApiResponse<T>;

    if (!json.success) {
      throw new Error(`Pipedrive API error: ${JSON.stringify(json)}`);
    }

    return json.data;
  }

  async getLead(id: string): Promise<PipedriveLead> {
    return this.request<PipedriveLead>(`/leads/${id}`);
  }

  async getPerson(id: number): Promise<PipedrivePerson> {
    return this.request<PipedrivePerson>(`/persons/${id}`);
  }

  async getOrganization(id: number): Promise<PipedriveOrganization> {
    return this.request<PipedriveOrganization>(`/organizations/${id}`);
  }

  async updateLead(id: string, data: Partial<PipedriveLead>): Promise<PipedriveLead> {
    return this.request<PipedriveLead>(`/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async createLead(data: Partial<PipedriveLead>): Promise<PipedriveLead> {
    return this.request<PipedriveLead>('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createPerson(data: Partial<PipedrivePerson>): Promise<PipedrivePerson> {
    return this.request<PipedrivePerson>('/persons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createOrganization(
    data: Partial<PipedriveOrganization>
  ): Promise<PipedriveOrganization> {
    return this.request<PipedriveOrganization>('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getLeadLabels(): Promise<PipedriveLeadLabel[]> {
    return this.request<PipedriveLeadLabel[]>('/leadLabels');
  }

  async addNote(data: {
    content: string;
    lead_id?: string;
    person_id?: number;
    org_id?: number;
  }): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWebhooks(): Promise<Array<{ id: number; subscription_url: string; event_action: string; event_object: string; [key: string]: unknown }>> {
    return this.request<Array<{ id: number; subscription_url: string; event_action: string; event_object: string }>>('/webhooks');
  }

  async deleteWebhook(id: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/webhooks/${id}`, { method: 'DELETE' });
  }

  async createWebhook(data: {
    subscription_url: string;
    event_action: string;
    event_object: string;
    name?: string;
  }): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/webhooks', {
      method: 'POST',
      body: JSON.stringify({ name: 'PipeAgent', ...data }),
    });
  }

  async createActivity(data: {
    subject: string;
    type: string;
    done?: 0 | 1;
    due_date?: string;
    lead_id?: string;
    person_id?: number;
    org_id?: number;
    note?: string;
  }): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getLeads(params?: { limit?: number; start?: number }): Promise<PipedriveLead[]> {
    const query = params
      ? '?' + new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    return this.request<PipedriveLead[]>(`/leads${query}`);
  }

  private get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const query = params
      ? '?' + new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    return this.request<T>(`${path}${query}`);
  }

  async getDeals(params?: { limit?: number; start?: number; status?: string }): Promise<PipedriveDeal[]> {
    return this.get<PipedriveDeal[]>('/deals', params as Record<string, unknown> | undefined);
  }

  async getDeal(id: number): Promise<PipedriveDeal> {
    return this.get<PipedriveDeal>(`/deals/${id}`);
  }

  async getDealActivities(dealId: number): Promise<PipedriveActivity[]> {
    return this.get<PipedriveActivity[]>(`/deals/${dealId}/activities`);
  }

  async getDealParticipants(dealId: number): Promise<Array<{ person_id: number; primary_flag: boolean }>> {
    return this.get<Array<{ person_id: number; primary_flag: boolean }>>(`/deals/${dealId}/participants`);
  }

  async getDealNotes(dealId: number): Promise<PipedriveNote[]> {
    return this.get<PipedriveNote[]>(`/deals/${dealId}/notes`, { sort: 'add_time DESC', limit: 20 });
  }

  async getStages(pipelineId?: number): Promise<Array<{ id: number; name: string; order_nr: number; pipeline_id: number }>> {
    return this.get<Array<{ id: number; name: string; order_nr: number; pipeline_id: number }>>('/stages', pipelineId ? { pipeline_id: pipelineId } : undefined);
  }
}

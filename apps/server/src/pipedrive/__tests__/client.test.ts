import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipedriveClient } from '../client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockSuccess(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data }),
  });
}

function mockError(status: number) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ success: false, data: null }),
  });
}

describe('PipedriveClient', () => {
  const client = new PipedriveClient('https://company.pipedrive.com', 'test-token');

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('fetches a lead by id', async () => {
    const leadData = {
      id: 'lead-123',
      title: 'Test Lead',
      person_id: null,
      organization_id: null,
      value: null,
      label_ids: [],
      source_name: null,
    };
    mockSuccess(leadData);

    const lead = await client.getLead('lead-123');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://company.pipedrive.com/api/v1/leads/lead-123');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    expect(lead).toEqual(leadData);
  });

  it('fetches an organization by id', async () => {
    const orgData = {
      id: 42,
      name: 'Acme Corp',
      address: '123 Main St',
      cc_email: null,
    };
    mockSuccess(orgData);

    const org = await client.getOrganization(42);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://company.pipedrive.com/api/v1/organizations/42');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    expect(org).toEqual(orgData);
  });

  it('throws on 401 error', async () => {
    mockError(401);

    await expect(client.getLead('lead-xyz')).rejects.toThrow('Pipedrive API error: 401');
  });
});

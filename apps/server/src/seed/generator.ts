import { PipedriveClient } from '../pipedrive/client.js';
import { SEED_LEADS } from './companies.js';

export async function generateLeads(
  client: PipedriveClient,
): Promise<{ created: number; errors: string[]; remaining: number }> {
  // Fetch all existing leads to check which seed leads already exist
  const existingLeads = await client.getLeads({ limit: 500 });
  const existingTitles = new Set(existingLeads.map((l) => l.title));

  // Filter to seed leads not yet created (match by company name in title)
  const available = SEED_LEADS.filter(
    (seed) => !existingTitles.has(`${seed.company} — ${seed.source}`),
  );

  if (available.length === 0) {
    return { created: 0, errors: ['All 20 test leads already exist in Pipedrive'], remaining: 0 };
  }

  // Pick 2 (or fewer if not enough remain)
  const batch = available.slice(0, 2);
  let created = 0;
  const errors: string[] = [];

  for (const seed of batch) {
    try {
      // Create organization (use company name for B2B, contact name for residential)
      const orgName = seed.type === 'B2B' ? seed.company : `${seed.contactName} (${seed.location})`;
      const org = await client.createOrganization({
        name: orgName,
        address: seed.location,
      });

      // Create person
      const pdPerson = await client.createPerson({
        name: seed.contactName,
        email: [{ value: seed.email, primary: true }],
        phone: [{ value: seed.phone, primary: true }],
        org_id: org.id,
      });

      // Create lead with source in title (used for dedup)
      await client.createLead({
        title: `${seed.company} — ${seed.source}`,
        person_id: pdPerson.id,
        organization_id: org.id,
      });

      created++;
      console.log(`Created lead: ${seed.company}`);
    } catch (err) {
      errors.push(`${seed.company}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { created, errors, remaining: available.length - created };
}

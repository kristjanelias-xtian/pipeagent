import { PipedriveClient } from '../pipedrive/client.js';
import { SEED_COMPANIES, type SeedCompany } from './companies.js';

const FIRST_NAMES = ['Alex', 'Jordan', 'Sarah', 'Marcus', 'Priya', 'Chen', 'Emma', 'Luca', 'Aisha', 'Kai'];
const LAST_NAMES = ['Smith', 'Park', 'Müller', 'Patel', 'Santos', 'Kim', 'Williams', 'Chen', 'Dubois', 'Nakamura'];
const SOURCES = ['Website', 'LinkedIn', 'Referral', 'Conference', 'Cold Outbound', 'Inbound'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fakePerson(company: SeedCompany) {
  const first = randomFrom(FIRST_NAMES);
  const last = randomFrom(LAST_NAMES);
  const domain = company.website || `${company.name.toLowerCase().replace(/[^a-z]/g, '')}.com`;
  return {
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`,
  };
}

function fakeValue(company: SeedCompany): { amount: number; currency: string } {
  const ranges: Record<string, [number, number]> = {
    tiny: [500, 2000],
    small: [2000, 10000],
    mid: [10000, 50000],
    large: [50000, 200000],
    enterprise: [100000, 500000],
  };
  const [min, max] = ranges[company.size];
  return {
    amount: Math.floor(Math.random() * (max - min) + min),
    currency: 'USD',
  };
}

export async function generateLeads(
  client: PipedriveClient,
  count: number,
): Promise<{ created: number; errors: string[] }> {
  const companies = [...SEED_COMPANIES].sort(() => Math.random() - 0.5).slice(0, count);
  let created = 0;
  const errors: string[] = [];

  for (const company of companies) {
    try {
      // Create organization
      const org = await client.createOrganization({
        name: company.name,
        address: company.website ? `https://${company.website}` : undefined,
      });

      // Create person
      const person = fakePerson(company);
      const pdPerson = await client.createPerson({
        name: person.name,
        email: [{ value: person.email, primary: true }],
        org_id: org.id,
      });

      // Create lead
      await client.createLead({
        title: `${company.name} — ${randomFrom(SOURCES)}`,
        person_id: pdPerson.id,
        organization_id: org.id,
        value: fakeValue(company),
      });

      created++;
      console.log(`Created lead: ${company.name}`);
    } catch (err) {
      errors.push(`${company.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { created, errors };
}

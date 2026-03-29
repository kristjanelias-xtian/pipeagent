import 'dotenv/config';
import { PipedriveClient } from '../pipedrive/client.js';
import { generateLeads } from './generator.js';

const count = parseInt(process.argv[2] ?? '10', 10);
const apiDomain = process.env.PIPEDRIVE_API_DOMAIN;
const apiToken = process.env.PIPEDRIVE_API_TOKEN;

if (!apiDomain || !apiToken) {
  console.error('Set PIPEDRIVE_API_DOMAIN and PIPEDRIVE_API_TOKEN in .env');
  console.error('(Use your personal API token from Pipedrive settings for seeding)');
  process.exit(1);
}

const client = new PipedriveClient(apiDomain, apiToken);
console.log(`Seeding ${count} leads...`);
const result = await generateLeads(client, count);
console.log(`Done: ${result.created} created, ${result.errors.length} errors`);
if (result.errors.length) {
  console.log('Errors:', result.errors);
}

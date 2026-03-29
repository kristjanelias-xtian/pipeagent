export interface SeedCompany {
  name: string;
  website: string;
  industry: string;
  size: 'tiny' | 'small' | 'mid' | 'large' | 'enterprise';
  expectedFit: 'good' | 'medium' | 'poor';
}

export const SEED_COMPANIES: SeedCompany[] = [
  // Good fit — mid-market tech/SaaS
  { name: 'Notion', website: 'notion.so', industry: 'Productivity Software', size: 'mid', expectedFit: 'good' },
  { name: 'Figma', website: 'figma.com', industry: 'Design Tools', size: 'mid', expectedFit: 'good' },
  { name: 'Datadog', website: 'datadoghq.com', industry: 'Monitoring', size: 'large', expectedFit: 'good' },
  { name: 'Linear', website: 'linear.app', industry: 'Project Management', size: 'small', expectedFit: 'good' },
  { name: 'Vercel', website: 'vercel.com', industry: 'Developer Tools', size: 'mid', expectedFit: 'good' },
  { name: 'Supabase', website: 'supabase.com', industry: 'Database/BaaS', size: 'mid', expectedFit: 'good' },
  { name: 'Retool', website: 'retool.com', industry: 'Internal Tools', size: 'mid', expectedFit: 'good' },
  { name: 'Airtable', website: 'airtable.com', industry: 'Productivity', size: 'mid', expectedFit: 'good' },
  { name: 'Loom', website: 'loom.com', industry: 'Video Communication', size: 'mid', expectedFit: 'good' },
  { name: 'PostHog', website: 'posthog.com', industry: 'Product Analytics', size: 'small', expectedFit: 'good' },
  { name: 'Clerk', website: 'clerk.com', industry: 'Auth/Identity', size: 'small', expectedFit: 'good' },
  { name: 'Resend', website: 'resend.com', industry: 'Email API', size: 'small', expectedFit: 'good' },
  { name: 'Cal.com', website: 'cal.com', industry: 'Scheduling', size: 'small', expectedFit: 'good' },
  { name: 'Dub', website: 'dub.co', industry: 'Link Management', size: 'tiny', expectedFit: 'good' },
  { name: 'Neon', website: 'neon.tech', industry: 'Serverless Postgres', size: 'small', expectedFit: 'good' },

  // Medium fit — bigger or different vertical
  { name: 'Stripe', website: 'stripe.com', industry: 'Payments', size: 'enterprise', expectedFit: 'medium' },
  { name: 'Shopify', website: 'shopify.com', industry: 'E-commerce', size: 'enterprise', expectedFit: 'medium' },
  { name: 'HubSpot', website: 'hubspot.com', industry: 'CRM/Marketing', size: 'enterprise', expectedFit: 'medium' },
  { name: 'Intercom', website: 'intercom.io', industry: 'Customer Support', size: 'large', expectedFit: 'medium' },
  { name: 'Twilio', website: 'twilio.com', industry: 'Communications API', size: 'enterprise', expectedFit: 'medium' },
  { name: 'Contentful', website: 'contentful.com', industry: 'CMS', size: 'mid', expectedFit: 'medium' },
  { name: 'Miro', website: 'miro.com', industry: 'Collaboration', size: 'large', expectedFit: 'medium' },
  { name: 'Deel', website: 'deel.com', industry: 'HR/Payroll', size: 'large', expectedFit: 'medium' },
  { name: 'Zapier', website: 'zapier.com', industry: 'Automation', size: 'mid', expectedFit: 'medium' },
  { name: 'Webflow', website: 'webflow.com', industry: 'Web Design', size: 'mid', expectedFit: 'medium' },

  // Poor fit — wrong vertical, too small, or too large
  { name: "McDonald's", website: 'mcdonalds.com', industry: 'Fast Food', size: 'enterprise', expectedFit: 'poor' },
  { name: 'Walmart', website: 'walmart.com', industry: 'Retail', size: 'enterprise', expectedFit: 'poor' },
  { name: 'Nike', website: 'nike.com', industry: 'Sportswear', size: 'enterprise', expectedFit: 'poor' },
  { name: 'John Deere', website: 'deere.com', industry: 'Agriculture Equipment', size: 'enterprise', expectedFit: 'poor' },
  { name: 'Marriott', website: 'marriott.com', industry: 'Hospitality', size: 'enterprise', expectedFit: 'poor' },
  { name: "Bob's Auto Repair", website: '', industry: 'Automotive Services', size: 'tiny', expectedFit: 'poor' },
  { name: 'Sunrise Bakery', website: '', industry: 'Food & Beverage', size: 'tiny', expectedFit: 'poor' },
  { name: 'Green Thumb Landscaping', website: '', industry: 'Landscaping', size: 'tiny', expectedFit: 'poor' },
  { name: 'Peak Fitness Gym', website: '', industry: 'Fitness', size: 'tiny', expectedFit: 'poor' },
  { name: 'Coastal Dental', website: '', industry: 'Healthcare', size: 'tiny', expectedFit: 'poor' },
];

// lib/integrations/status.ts
// Evaluates live vs mock status for each integrated external service

export interface ServiceIntegrationStatus {
  service: "enrichment" | "crm" | "email";
  isLive: boolean;
  provider: string;
  configuredKey: string;
  label: string;
  detail: string;
}

export interface IntegrationsStatusReport {
  enrichment: ServiceIntegrationStatus;
  crm: ServiceIntegrationStatus;
  email: ServiceIntegrationStatus;
  allLive: boolean;
}

export type IntegrationStatus = IntegrationsStatusReport;

export function getIntegrationsStatus(): IntegrationsStatusReport {
  // 1. Company Enrichment
  const hasAbstract = Boolean(process.env.ABSTRACT_API_KEY);
  const hasHunter = Boolean(process.env.HUNTER_API_KEY);
  const enrichmentLive = hasAbstract || hasHunter;
  const enrichmentProvider = hasAbstract ? "Abstract API" : hasHunter ? "Hunter.io" : "Simulated Mock";
  const enrichmentKey = hasAbstract ? "ABSTRACT_API_KEY" : hasHunter ? "HUNTER_API_KEY" : "NONE";

  // 2. CRM
  const hasHubspot = Boolean(process.env.HUBSPOT_TOKEN);
  const hasGoogleSheet = Boolean(process.env.GOOGLE_SHEET_ID);
  const crmLive = hasHubspot || hasGoogleSheet;
  const crmProvider = hasHubspot ? "HubSpot" : hasGoogleSheet ? "Google Sheets" : "Simulated Mock";
  const crmKey = hasHubspot ? "HUBSPOT_TOKEN" : hasGoogleSheet ? "GOOGLE_SHEET_ID" : "NONE";

  // 3. Email
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasEmailJs = Boolean(
    process.env.EMAILJS_SERVICE_ID &&
    process.env.EMAILJS_TEMPLATE_ID &&
    process.env.EMAILJS_PUBLIC_KEY
  );
  const emailLive = hasResend || hasEmailJs;
  const emailProvider = hasResend ? "Resend" : hasEmailJs ? "EmailJS" : "Simulated Mock";
  const emailKey = hasResend ? "RESEND_API_KEY" : hasEmailJs ? "EMAILJS_*" : "NONE";

  return {
    enrichment: {
      service: "enrichment",
      isLive: enrichmentLive,
      provider: enrichmentProvider,
      configuredKey: enrichmentKey,
      label: enrichmentProvider,
      detail: enrichmentLive ? `Live via ${enrichmentProvider} (${enrichmentKey})` : "Using simulated mock",
    },
    crm: {
      service: "crm",
      isLive: crmLive,
      provider: crmProvider,
      configuredKey: crmKey,
      label: crmProvider,
      detail: crmLive ? `Live via ${crmProvider} (${crmKey})` : "Using simulated mock",
    },
    email: {
      service: "email",
      isLive: emailLive,
      provider: emailProvider,
      configuredKey: emailKey,
      label: emailProvider,
      detail: emailLive ? `Live via ${emailProvider} (${emailKey})` : "Using simulated mock",
    },
    allLive: enrichmentLive && crmLive && emailLive,
  };
}


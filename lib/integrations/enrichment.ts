// lib/integrations/enrichment.ts
// Real company enrichment adapter (Abstract API or Hunter.io) with mock fallback

export interface CompanyEnrichmentInput {
  company: string;
  domain?: string;
}

export interface CompanyEnrichmentOutput {
  company: string;
  employees: number;
  industry: string;
}

export interface AdapterExecutionResult<T> {
  success: boolean;
  data?: T;
  rawResponse?: unknown;
  request: { url: string; method: string; body?: unknown };
  response?: { status: number; headers: Record<string, string>; body: unknown };
  errorMessage?: string;
  errorCode?: string;
  mode: "real" | "mock";
}

function extractDomain(input: CompanyEnrichmentInput): string {
  if (input.domain && input.domain.trim()) {
    return input.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim().toLowerCase();
  }
  // Fallback domain derivation from company name
  const clean = input.company.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${clean}.com`;
}

export async function fetchCompanyEnrichment(
  input: CompanyEnrichmentInput,
  mockFallbackUrl?: string
): Promise<AdapterExecutionResult<CompanyEnrichmentOutput>> {
  const abstractKey = process.env.ABSTRACT_API_KEY;
  const hunterKey = process.env.HUNTER_API_KEY;
  const targetDomain = extractDomain(input);

  // 1. ABSTRACT API COMPANY ENRICHMENT
  if (abstractKey) {
    const url = `https://companyenrichment.abstractapi.com/v1/?api_key=${encodeURIComponent(abstractKey)}&domain=${encodeURIComponent(targetDomain)}`;
    try {
      const res = await fetch(url, { method: "GET" });
      const headers = Object.fromEntries(res.headers.entries());
      const rawText = await res.text();
      let rawData: Record<string, unknown> = {};
      try {
        rawData = JSON.parse(rawText);
      } catch {
        rawData = { raw: rawText };
      }

      if (!res.ok) {
        return {
          success: false,
          request: { url, method: "GET" },
          response: { status: res.status, headers, body: rawData },
          errorMessage: (rawData.error as { message?: string })?.message || `Abstract API error ${res.status}`,
          errorCode: `ABSTRACT_API_${res.status}`,
          mode: "real",
        };
      }

      // Raw response from Abstract API usually has:
      // name, domain, year_founded, industry, employees_count, locality, country, etc.
      const normalized: CompanyEnrichmentOutput = {
        company: (rawData.name as string) || input.company,
        employees: typeof rawData.employees_count === "number" ? rawData.employees_count : 85,
        industry: (rawData.industry as string) || "Technology & Software",
      };

      return {
        success: true,
        data: normalized,
        rawResponse: rawData,
        request: { url, method: "GET" },
        response: { status: 200, headers, body: rawData },
        mode: "real",
      };
    } catch (err: unknown) {
      return {
        success: false,
        request: { url, method: "GET" },
        errorMessage: err instanceof Error ? err.message : "Network error contacting Abstract API",
        errorCode: "ABSTRACT_NETWORK_ERROR",
        mode: "real",
      };
    }
  }

  // 2. HUNTER.IO COMPANIES API
  if (hunterKey) {
    const url = `https://api.hunter.io/v2/companies/find?domain=${encodeURIComponent(targetDomain)}&api_key=${encodeURIComponent(hunterKey)}`;
    try {
      const res = await fetch(url, { method: "GET" });
      const headers = Object.fromEntries(res.headers.entries());
      const rawData = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          request: { url, method: "GET" },
          response: { status: res.status, headers, body: rawData },
          errorMessage: rawData.errors?.[0]?.details || `Hunter API error ${res.status}`,
          errorCode: `HUNTER_API_${res.status}`,
          mode: "real",
        };
      }

      const companyData = rawData.data || {};
      const normalized: CompanyEnrichmentOutput = {
        company: companyData.name || input.company,
        employees: companyData.metrics?.employees || 85,
        industry: companyData.industry || "Software & AI",
      };

      return {
        success: true,
        data: normalized,
        rawResponse: rawData,
        request: { url, method: "GET" },
        response: { status: 200, headers, body: rawData },
        mode: "real",
      };
    } catch (err: unknown) {
      return {
        success: false,
        request: { url, method: "GET" },
        errorMessage: err instanceof Error ? err.message : "Network error contacting Hunter API",
        errorCode: "HUNTER_NETWORK_ERROR",
        mode: "real",
      };
    }
  }

  // 3. FALLBACK TO SIMULATED MOCK API
  const fallbackUrl = mockFallbackUrl || "http://localhost:3001/api/mock/enrichment";
  try {
    const res = await fetch(fallbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: input.company }),
    });
    const headers = Object.fromEntries(res.headers.entries());
    const rawData = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        request: { url: fallbackUrl, method: "POST", body: { company: input.company } },
        response: { status: res.status, headers, body: rawData },
        errorMessage: rawData.message || rawData.error || `Enrichment HTTP failure ${res.status}`,
        errorCode: rawData.errorCode || `HTTP_${res.status}`,
        mode: "mock",
      };
    }

    const normalized: CompanyEnrichmentOutput = {
      company: (rawData.company as string) || input.company,
      employees: typeof rawData.employees === "number" ? rawData.employees : 85,
      industry: (rawData.industry as string) || "Software & AI",
    };

    return {
      success: true,
      data: normalized,
      rawResponse: rawData,
      request: { url: fallbackUrl, method: "POST", body: { company: input.company } },
      response: { status: 200, headers, body: rawData },
      mode: "mock",
    };
  } catch (err: unknown) {
    return {
      success: false,
      request: { url: fallbackUrl, method: "POST" },
      errorMessage: err instanceof Error ? err.message : "Failed to reach mock enrichment endpoint",
      errorCode: "MOCK_ENRICHMENT_ERROR",
      mode: "mock",
    };
  }
}

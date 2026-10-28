// lib/integrations/crm.ts
// Real HubSpot CRM & Google Sheets adapter with mock fallback

import { AdapterExecutionResult } from "./enrichment";

export interface SaveCrmInput {
  full_name: string;
  email: string;
  company: string;
  employees?: number;
}

export interface SaveCrmOutput {
  crmId: string;
  company: string;
  status: string;
  createdAt: string;
}

function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

/**
 * Appends row to Google Sheet using service account OAuth credentials
 */
async function appendToGoogleSheet(
  sheetId: string,
  input: SaveCrmInput
): Promise<{ success: boolean; id?: string; error?: string; raw?: unknown }> {
  try {
    // Generate JWT token from existing service account credentials
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!clientEmail || !privateKey) {
      throw new Error("Missing Google Service Account credentials in environment");
    }

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: clientEmail,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      })
    ).toString("base64url");

    const crypto = await import("crypto");
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(`${header}.${claimSet}`);
    const signature = signer.sign(privateKey, "base64url");
    const jwt = `${header}.${claimSet}.${signature}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error(`Google token error: ${tokenData.error_description || "Authentication failed"}`);
    }

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/A1:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: [
            [
              new Date().toISOString(),
              input.full_name,
              input.email,
              input.company,
              input.employees ?? "N/A",
              "Registered by AutoMedic",
            ],
          ],
        }),
      }
    );

    const appendData = await appendRes.json();
    if (!appendRes.ok) {
      throw new Error(appendData.error?.message || `Google Sheets append error ${appendRes.status}`);
    }

    return {
      success: true,
      id: appendData.updates?.updatedRange || `sheet_${Date.now()}`,
      raw: appendData,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function createOrUpdateCrmContact(
  input: SaveCrmInput,
  mockFallbackUrl?: string
): Promise<AdapterExecutionResult<SaveCrmOutput>> {
  const hubspotToken = process.env.HUBSPOT_TOKEN;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  // 1. HUBSPOT REST API (Private App Token)
  if (hubspotToken) {
    const { firstName, lastName } = parseName(input.full_name);
    const url = "https://api.hubapi.com/crm/v3/objects/contacts";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hubspotToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            email: input.email,
            firstname: firstName,
            lastname: lastName,
            company: input.company,
            num_employees: String(input.employees || 0),
          },
        }),
      });

      const headers = Object.fromEntries(res.headers.entries());
      const rawData = await res.json().catch(() => ({}));

      // If 409 Conflict: Contact already exists, update contact
      if (res.status === 409) {
        const existingId = (rawData.message as string)?.match(/ID:\s*(\d+)/)?.[1];
        if (existingId) {
          const updateUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${existingId}`;
          const updateRes = await fetch(updateUrl, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${hubspotToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              properties: {
                company: input.company,
                num_employees: String(input.employees || 0),
              },
            }),
          });
          const updateData = await updateRes.json().catch(() => ({}));

          return {
            success: true,
            data: {
              crmId: `hubspot_${existingId}`,
              company: input.company,
              status: "updated",
              createdAt: new Date().toISOString(),
            },
            rawResponse: updateData,
            request: { url: updateUrl, method: "PATCH", body: input },
            response: { status: updateRes.status, headers, body: updateData },
            mode: "real",
          };
        }
      }

      if (!res.ok) {
        return {
          success: false,
          request: { url, method: "POST", body: input },
          response: { status: res.status, headers, body: rawData },
          errorMessage: rawData.message || `HubSpot API returned status ${res.status}`,
          errorCode: `HUBSPOT_${res.status}`,
          mode: "real",
        };
      }

      return {
        success: true,
        data: {
          crmId: `hubspot_${rawData.id || Date.now()}`,
          company: input.company,
          status: "created",
          createdAt: rawData.createdAt || new Date().toISOString(),
        },
        rawResponse: rawData,
        request: { url, method: "POST", body: input },
        response: { status: 200, headers, body: rawData },
        mode: "real",
      };
    } catch (err: unknown) {
      return {
        success: false,
        request: { url, method: "POST", body: input },
        errorMessage: err instanceof Error ? err.message : "Network error contacting HubSpot API",
        errorCode: "HUBSPOT_NETWORK_ERROR",
        mode: "real",
      };
    }
  }

  // 2. GOOGLE SHEETS FALLBACK VIA SERVICE ACCOUNT
  if (sheetId) {
    const sheetResult = await appendToGoogleSheet(sheetId, input);
    if (sheetResult.success) {
      const output: SaveCrmOutput = {
        crmId: sheetResult.id || `sheet_${Date.now()}`,
        company: input.company,
        status: "appended_to_sheet",
        createdAt: new Date().toISOString(),
      };
      return {
        success: true,
        data: output,
        rawResponse: sheetResult.raw,
        request: { url: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, method: "POST", body: input },
        response: { status: 200, headers: {}, body: sheetResult.raw || output },
        mode: "real",
      };
    } else {
      console.warn("[AutoMedic CRM] Google Sheets append failed:", sheetResult.error);
    }
  }

  // 3. FALLBACK TO SIMULATED MOCK CRM
  const fallbackUrl = mockFallbackUrl || "http://localhost:3001/api/mock/crm";
  try {
    const res = await fetch(fallbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const headers = Object.fromEntries(res.headers.entries());
    const rawData = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        request: { url: fallbackUrl, method: "POST", body: input },
        response: { status: res.status, headers, body: rawData },
        errorMessage: rawData.message || rawData.error || `CRM API returned ${res.status}`,
        errorCode: rawData.errorCode || `HTTP_${res.status}`,
        mode: "mock",
      };
    }

    const output: SaveCrmOutput = {
      crmId: rawData.crmId || `crm_${Date.now()}`,
      company: rawData.company || input.company,
      status: rawData.status || "created",
      createdAt: rawData.createdAt || new Date().toISOString(),
    };

    return {
      success: true,
      data: output,
      rawResponse: rawData,
      request: { url: fallbackUrl, method: "POST", body: input },
      response: { status: 200, headers, body: rawData },
      mode: "mock",
    };
  } catch (err: unknown) {
    return {
      success: false,
      request: { url: fallbackUrl, method: "POST" },
      errorMessage: err instanceof Error ? err.message : "Failed to reach mock CRM endpoint",
      errorCode: "MOCK_CRM_ERROR",
      mode: "mock",
    };
  }
}

import { requireEnv } from "@/lib/env";

export type KeygenLicense = {
  id: string;
  type: "licenses";
  attributes: {
    key: string;
    name: string | null;
    expiry: string | null;
    maxMachines: number | null;
    suspended: boolean;
    metadata: Record<string, unknown>;
    created: string;
    updated: string;
  };
};

function getKeygenConfig() {
  return {
    apiKey: requireEnv("KEYGEN_API_KEY"),
    accountId: requireEnv("KEYGEN_ACCOUNT_ID"),
    policyId: requireEnv("KEYGEN_POLICY_ID"),
    version: process.env.KEYGEN_VERSION || "1.1",
  };
}

const KEYGEN_BASE = "https://api.keygen.sh/v1";

async function keygenRequest<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { apiKey, version } = getKeygenConfig();

  const headers: Record<string, string> = {
    Accept: "application/vnd.api+json",
    Authorization: `Bearer ${apiKey}`,
    "Keygen-Version": version,
  };

  if (init.json !== undefined) {
    headers["Content-Type"] = "application/vnd.api+json";
  }

  const res = await fetch(`${KEYGEN_BASE}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  const text = await res.text();
  const json = text ? (JSON.parse(text) as any) : null;

  if (!res.ok) {
    const detail =
      json?.errors?.[0]?.detail || json?.errors?.[0]?.title || text || "Unknown error";
    throw new Error(`Keygen API error (${res.status}): ${detail}`);
  }

  return json as T;
}

export async function createLicense(params: {
  metadata: Record<string, unknown>;
  maxMachinesOverride?: number;
  name?: string;
}): Promise<KeygenLicense> {
  const { accountId, policyId } = getKeygenConfig();

  const payload: any = {
    data: {
      type: "licenses",
      attributes: {
        metadata: params.metadata,
      },
      relationships: {
        policy: {
          data: { type: "policies", id: policyId },
        },
      },
    },
  };

  if (params.name) payload.data.attributes.name = params.name;
  if (typeof params.maxMachinesOverride === "number") {
    payload.data.attributes.maxMachines = params.maxMachinesOverride;
  }

  const res = await keygenRequest<{ data: KeygenLicense }>(
    `/accounts/${accountId}/licenses`,
    { method: "POST", json: payload }
  );

  return res.data;
}

export async function suspendLicense(licenseId: string): Promise<void> {
  const { accountId } = getKeygenConfig();
  await keygenRequest(
    `/accounts/${accountId}/licenses/${licenseId}/actions/suspend`,
    { method: "POST" }
  );
}

export async function reinstateLicense(licenseId: string): Promise<void> {
  const { accountId } = getKeygenConfig();
  await keygenRequest(
    `/accounts/${accountId}/licenses/${licenseId}/actions/reinstate`,
    { method: "POST" }
  );
}

export async function retrieveLicense(licenseId: string): Promise<KeygenLicense> {
  const { accountId } = getKeygenConfig();
  const res = await keygenRequest<{ data: KeygenLicense }>(
    `/accounts/${accountId}/licenses/${licenseId}`,
    { method: "GET" }
  );
  return res.data;
}

import { requireEnv } from "@/lib/env";

export type KeygenLicense = {
  id: string;
  attributes: {
    key: string;
    maxMachines?: number | null;
    suspended?: boolean;
  };
};

type KeygenConfig = {
  baseUrl: string;
  accountId: string;
  policyId: string;
  adminToken: string;
};

function getKeygenConfig(): KeygenConfig {
  return {
    baseUrl: requireEnv("KEYGEN_BASE_URL"), // e.g. https://api.keygen.sh
    accountId: requireEnv("KEYGEN_ACCOUNT_ID"),
    policyId: requireEnv("KEYGEN_POLICY_ID"),
    adminToken: requireEnv("KEYGEN_ADMIN_TOKEN"),
  };
}

async function keygenFetch<T>(path: string, init: RequestInit): Promise<T> {
  const { baseUrl, adminToken } = getKeygenConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${adminToken}`,
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keygen error (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

export async function createLicense(params: {
  metadata: Record<string, unknown>;
  maxMachinesOverride?: number;
  name?: string;
  /** Optional override for the Keygen policy ID (useful for mapping Stripe price IDs to different policies). */
  policyIdOverride?: string;
}): Promise<KeygenLicense> {
  const { accountId, policyId } = getKeygenConfig();
  const effectivePolicyId = params.policyIdOverride || policyId;

  const payload = {
    data: {
      type: "licenses",
      attributes: {
        name: params.name || "CutSwitch",
        metadata: params.metadata,
        ...(typeof params.maxMachinesOverride === "number"
          ? { maxMachines: params.maxMachinesOverride }
          : {}),
      },
      relationships: {
        account: {
          data: { type: "accounts", id: accountId },
        },
        policy: {
          data: { type: "policies", id: effectivePolicyId },
        },
      },
    },
  };

  const out = await keygenFetch<{ data: KeygenLicense }>("/licenses", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return out.data;
}

export async function retrieveLicense(licenseId: string): Promise<KeygenLicense> {
  const out = await keygenFetch<{ data: KeygenLicense }>(`/licenses/${licenseId}`, {
    method: "GET",
  });
  return out.data;
}

export async function suspendLicense(licenseId: string): Promise<void> {
  await keygenFetch(`/licenses/${licenseId}/actions/suspend`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function reinstateLicense(licenseId: string): Promise<void> {
  await keygenFetch(`/licenses/${licenseId}/actions/reinstate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
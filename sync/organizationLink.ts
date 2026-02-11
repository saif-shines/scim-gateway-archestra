import type { Scalekit } from "@scalekit-sdk/node";
import type { ArchestraClient } from "../archestra/client.ts";
import type { OrganizationLink } from "../models/syncTypes.ts";
import { InMemorySyncStore } from "./store.ts";

function nowIso(): string {
  return new Date().toISOString();
}

async function trySyncScalekitExternalId(
  scalekit: Scalekit,
  scalekitOrganizationId: string,
  archestraOrganizationId: string,
): Promise<void> {
  const sdk = scalekit as unknown as {
    organization?: {
      updateOrganization?: (id: string, input: Record<string, unknown>) => Promise<unknown>;
    };
  };
  if (!sdk.organization?.updateOrganization) {
    return;
  }
  try {
    await sdk.organization.updateOrganization(scalekitOrganizationId, {
      externalId: archestraOrganizationId,
    });
  } catch {
    // best-effort sync only; local link still remains source for runtime mapping
  }
}

export async function ensureOrganizationLink(
  store: InMemorySyncStore,
  scalekit: Scalekit,
  archestraClient: ArchestraClient,
  scalekitOrganizationId: string,
): Promise<OrganizationLink> {
  const existing = store.getOrganizationLink(scalekitOrganizationId);
  if (existing) {
    return existing;
  }

  const organization = await archestraClient.getOrganization();
  const newLink: OrganizationLink = {
    scalekitOrganizationId,
    archestraOrganizationId: organization.id,
    scalekitExternalId: organization.id,
    displayName: organization.name,
    autoCreated: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const saved = store.setOrganizationLink(newLink);
  await trySyncScalekitExternalId(
    scalekit,
    scalekitOrganizationId,
    organization.id,
  );
  return saved;
}

/** SDK shape for organization lookup and create (when available). */
type ScalekitOrganizationApi = {
  getOrganizationByExternalId?: (
    externalId: string,
  ) => Promise<{ organization?: { id?: string; displayName?: string } }>;
  createOrganization?: (
    name: string,
    options?: { externalId?: string },
  ) => Promise<{ organization?: { id?: string } }>;
};

/**
 * Resolves the Scalekit organization by Archestra organization ID (external_id).
 * If no organization exists with that external_id, creates one and returns its id.
 * Used by the /scim-gateway route to derive the Scalekit org from GET /api/organization.
 */
export async function resolveOrCreateScalekitOrganizationByExternalId(
  scalekit: Scalekit,
  archestraClient: ArchestraClient,
): Promise<{ scalekitOrganizationId: string }> {
  const organization = await archestraClient.getOrganization();
  const api = (scalekit as unknown as { organization?: ScalekitOrganizationApi }).organization;

  if (api?.getOrganizationByExternalId) {
    try {
      const existing = await api.getOrganizationByExternalId(organization.id);
      const existingId = existing?.organization?.id;
      if (existingId) {
        return { scalekitOrganizationId: existingId };
      }
    } catch {
      // Not found is expected for first-time org bootstrap; create below.
    }
  }

  if (api?.createOrganization) {
    const created = await api.createOrganization(
      organization.name ?? organization.id,
      { externalId: organization.id },
    );
    const createdId = created?.organization?.id;
    if (createdId) {
      return { scalekitOrganizationId: createdId };
    }
  }

  throw new Error(
    "Scalekit organization API does not support getOrganizationByExternalId or createOrganization; cannot resolve or create organization by external_id",
  );
}


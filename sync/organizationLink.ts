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
      update?: (id: string, input: Record<string, unknown>) => Promise<unknown>;
    };
  };
  if (!sdk.organization?.update) {
    return;
  }
  try {
    await sdk.organization.update(scalekitOrganizationId, {
      external_id: archestraOrganizationId,
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


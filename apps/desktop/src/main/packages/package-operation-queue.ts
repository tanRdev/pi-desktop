import type {
  PackageInstallScope,
  PackageOperationKind,
  PackageOperationSnapshot,
  PackageOperationStatus,
} from "@pidesk/shared";

function buildSnapshot(
  id: string,
  packageName: string,
  scope: PackageInstallScope,
  kind: PackageOperationKind,
  status: PackageOperationStatus,
  message: string | null,
  output: string[],
): PackageOperationSnapshot {
  return {
    id,
    packageName,
    scope,
    kind,
    status,
    message,
    output,
  };
}

export class PackageOperationQueue {
  private nextId = 1;

  create(
    packageName: string,
    scope: PackageInstallScope,
    kind: PackageOperationKind,
    status: PackageOperationStatus,
    message: string | null,
    output: string[] = [],
  ): PackageOperationSnapshot {
    const operationId = `package-operation-${this.nextId}`;
    this.nextId += 1;

    return buildSnapshot(
      operationId,
      packageName,
      scope,
      kind,
      status,
      message,
      output,
    );
  }

  update(
    snapshot: PackageOperationSnapshot,
    status: PackageOperationStatus,
    message: string | null,
    output: string[] = snapshot.output,
  ): PackageOperationSnapshot {
    return buildSnapshot(
      snapshot.id,
      snapshot.packageName,
      snapshot.scope,
      snapshot.kind,
      status,
      message,
      output,
    );
  }
}

import type {
  PackageCatalogDetail,
  PackageCatalogItem,
  PackageKind,
  PackageSearchRequest,
  PackageSearchResponse,
} from "@pidesk/shared";

const SEARCH_API = "https://registry.npmjs.org/-/v1/search";
const MANIFEST_API = "https://registry.npmjs.org";
const README_CDN = "https://cdn.jsdelivr.net/npm";
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const DETAIL_CACHE_TTL_MS = 10 * 60 * 1000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type SearchResultObject = {
  package?: {
    name?: string;
    version?: string;
    description?: string;
    date?: string;
    keywords?: string[];
    links?: {
      npm?: string;
      repository?: string;
    };
    publisher?: {
      username?: string;
    };
    maintainers?: Array<{
      username?: string;
    }>;
  };
  downloads?: {
    monthly?: number;
  };
};

type SearchApiResponse = {
  objects?: SearchResultObject[];
  total?: number;
};

type PackageManifest = {
  keywords?: string[];
  description?: string;
  version?: string;
  repository?: {
    url?: string;
  };
  homepage?: string;
  pi?: {
    extensions?: string[];
    skills?: string[];
    themes?: string[];
    prompts?: string[];
    video?: string;
    image?: string;
  };
};

function normalizeRepoUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  return url.replace(/^git\+/, "").replace(/\.git$/, "");
}

function inferKindsFromKeywords(keywords: string[]): PackageKind[] {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const kinds: PackageKind[] = [];

  if (
    normalizedKeywords.some(
      (keyword) =>
        keyword === "extension" ||
        keyword === "pi-extension" ||
        keyword === "extensions",
    )
  ) {
    kinds.push("extension");
  }

  if (
    normalizedKeywords.some(
      (keyword) =>
        keyword === "skill" || keyword === "pi-skill" || keyword === "skills",
    )
  ) {
    kinds.push("skill");
  }

  if (
    normalizedKeywords.some(
      (keyword) =>
        keyword === "theme" || keyword === "pi-theme" || keyword === "themes",
    )
  ) {
    kinds.push("theme");
  }

  if (
    normalizedKeywords.some(
      (keyword) =>
        keyword === "prompt" ||
        keyword === "pi-prompt" ||
        keyword === "prompts",
    )
  ) {
    kinds.push("prompt");
  }

  return kinds;
}

function inferKindsFromManifest(
  manifest: PackageManifest | null,
): PackageKind[] {
  if (!manifest?.pi) {
    return [];
  }

  const kinds: PackageKind[] = [];

  if ((manifest.pi.extensions?.length ?? 0) > 0) {
    kinds.push("extension");
  }
  if ((manifest.pi.skills?.length ?? 0) > 0) {
    kinds.push("skill");
  }
  if ((manifest.pi.themes?.length ?? 0) > 0) {
    kinds.push("theme");
  }
  if ((manifest.pi.prompts?.length ?? 0) > 0) {
    kinds.push("prompt");
  }

  return kinds;
}

function buildInstallCommand(packageName: string): string {
  return `pi install npm:${packageName}`;
}

function buildReadmeUrl(packageName: string, version: string): string {
  return `${README_CDN}/${encodeURIComponent(packageName)}@${version}/README.md`;
}

function isValidMediaUrl(
  url: string | null | undefined,
  extensions: string[],
): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return extensions.some((extension) =>
      parsedUrl.pathname.toLowerCase().endsWith(extension),
    );
  } catch {
    return false;
  }
}

export class PackagesCatalogClient {
  private readonly searchCache = new Map<
    string,
    CacheEntry<PackageSearchResponse>
  >();
  private readonly detailCache = new Map<
    string,
    CacheEntry<PackageCatalogDetail>
  >();

  async search(request: PackageSearchRequest): Promise<PackageSearchResponse> {
    const cacheKey = JSON.stringify(request);
    const cachedResult = this.searchCache.get(cacheKey);
    if (cachedResult && cachedResult.expiresAt > Date.now()) {
      return cachedResult.value;
    }

    const searchResults = await this.fetchSearchResults();
    const packageItems = searchResults.map((result) =>
      this.toCatalogItem(result),
    );
    const filteredPackages = packageItems.filter((pkg) =>
      this.matchesRequest(pkg, request),
    );
    const sortedPackages = this.sortPackages(filteredPackages, request.sort);
    const response: PackageSearchResponse = {
      query: request.query,
      sort: request.sort,
      total: sortedPackages.length,
      packages: sortedPackages,
    };

    this.searchCache.set(cacheKey, {
      value: response,
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    });

    return response;
  }

  async getDetail(packageName: string): Promise<PackageCatalogDetail> {
    const cachedDetail = this.detailCache.get(packageName);
    if (cachedDetail && cachedDetail.expiresAt > Date.now()) {
      return cachedDetail.value;
    }

    const manifest = await this.fetchManifest(packageName);
    const keywords = manifest?.keywords ?? [];
    const version = manifest?.version ?? "latest";
    const catalogItem: PackageCatalogItem = {
      name: packageName,
      version,
      description: manifest?.description ?? "",
      downloads: 0,
      publishedAt: null,
      kinds: this.resolveKinds(keywords, manifest),
      author: null,
      maintainers: [],
      repositoryUrl: normalizeRepoUrl(
        manifest?.repository?.url ?? manifest?.homepage ?? null,
      ),
      npmUrl: `https://www.npmjs.com/package/${packageName}`,
      readmeUrl: buildReadmeUrl(packageName, version),
      hasDemo:
        isValidMediaUrl(manifest?.pi?.video, [".mp4"]) ||
        isValidMediaUrl(manifest?.pi?.image, [
          ".png",
          ".jpg",
          ".jpeg",
          ".webp",
          ".gif",
        ]),
      demoVideoUrl: isValidMediaUrl(manifest?.pi?.video, [".mp4"])
        ? (manifest?.pi?.video ?? null)
        : null,
      demoImageUrl: isValidMediaUrl(manifest?.pi?.image, [
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".gif",
      ])
        ? (manifest?.pi?.image ?? null)
        : null,
    };
    const readmeMarkdown = await this.fetchReadme(packageName, version);
    const detail: PackageCatalogDetail = {
      ...catalogItem,
      keywords,
      readmeMarkdown,
      installCommand: buildInstallCommand(packageName),
    };

    this.detailCache.set(packageName, {
      value: detail,
      expiresAt: Date.now() + DETAIL_CACHE_TTL_MS,
    });

    return detail;
  }

  private async fetchSearchResults(): Promise<SearchResultObject[]> {
    const allObjects: SearchResultObject[] = [];
    let from = 0;

    while (true) {
      const params = new URLSearchParams({
        text: "keywords:pi-package",
        size: "250",
      });
      if (from > 0) {
        params.set("from", String(from));
      }

      const response = await fetch(`${SEARCH_API}?${params.toString()}`);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch package search results: ${response.status}`,
        );
      }

      const data = (await response.json()) as SearchApiResponse;
      const pageObjects = data.objects ?? [];
      allObjects.push(...pageObjects);

      const total = data.total ?? allObjects.length;
      if (pageObjects.length === 0 || allObjects.length >= total) {
        return allObjects;
      }

      from = allObjects.length;
    }
  }

  private async fetchManifest(
    packageName: string,
  ): Promise<PackageManifest | null> {
    const response = await fetch(
      `${MANIFEST_API}/${encodeURIComponent(packageName)}/latest`,
    );
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as PackageManifest;
  }

  private async fetchReadme(
    packageName: string,
    version: string,
  ): Promise<string | null> {
    const response = await fetch(buildReadmeUrl(packageName, version));
    if (!response.ok) {
      return null;
    }

    return response.text();
  }

  private toCatalogItem(result: SearchResultObject): PackageCatalogItem {
    const pkg = result.package;
    const keywords = pkg?.keywords ?? [];
    const name = pkg?.name ?? "unknown-package";
    return {
      name,
      version: pkg?.version ?? "latest",
      description: pkg?.description ?? "",
      downloads: result.downloads?.monthly ?? 0,
      publishedAt: pkg?.date ?? null,
      kinds: inferKindsFromKeywords(keywords),
      author:
        pkg?.publisher?.username ?? pkg?.maintainers?.[0]?.username ?? null,
      maintainers: (pkg?.maintainers ?? [])
        .map((maintainer) => maintainer.username)
        .filter((username): username is string => Boolean(username)),
      repositoryUrl: normalizeRepoUrl(pkg?.links?.repository),
      npmUrl:
        pkg?.links?.npm ??
        `https://www.npmjs.com/package/${encodeURIComponent(name)}`,
      readmeUrl: buildReadmeUrl(name, pkg?.version ?? "latest"),
      hasDemo: false,
      demoVideoUrl: null,
      demoImageUrl: null,
    };
  }

  private resolveKinds(
    keywords: string[],
    manifest: PackageManifest | null,
  ): PackageKind[] {
    const manifestKinds = inferKindsFromManifest(manifest);
    if (manifestKinds.length > 0) {
      return manifestKinds;
    }

    return inferKindsFromKeywords(keywords);
  }

  private matchesRequest(
    pkg: PackageCatalogItem,
    request: PackageSearchRequest,
  ): boolean {
    const normalizedQuery = request.query.trim().toLowerCase();
    if (normalizedQuery.length > 0) {
      const matchesQuery =
        pkg.name.toLowerCase().includes(normalizedQuery) ||
        pkg.description.toLowerCase().includes(normalizedQuery) ||
        (pkg.author?.toLowerCase().includes(normalizedQuery) ?? false);
      if (!matchesQuery) {
        return false;
      }
    }

    if (request.kinds.length > 0) {
      const matchesKind = pkg.kinds.some((kind) =>
        request.kinds.includes(kind),
      );
      if (!matchesKind) {
        return false;
      }
    }

    if (request.hasDemoOnly && !pkg.hasDemo) {
      return false;
    }

    return true;
  }

  private sortPackages(
    packages: PackageCatalogItem[],
    sort: PackageSearchRequest["sort"],
  ): PackageCatalogItem[] {
    const nextPackages = [...packages];
    if (sort === "recent") {
      nextPackages.sort((left, right) => {
        const leftTimestamp = left.publishedAt
          ? Date.parse(left.publishedAt)
          : 0;
        const rightTimestamp = right.publishedAt
          ? Date.parse(right.publishedAt)
          : 0;
        return rightTimestamp - leftTimestamp;
      });
      return nextPackages;
    }

    if (sort === "name") {
      nextPackages.sort((left, right) => left.name.localeCompare(right.name));
      return nextPackages;
    }

    nextPackages.sort((left, right) => right.downloads - left.downloads);
    return nextPackages;
  }
}

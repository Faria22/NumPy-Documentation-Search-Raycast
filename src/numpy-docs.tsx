import { Action, ActionPanel, Icon, List, Toast, showToast } from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { getInventory, type InventoryItem } from "./lib/inventory";
import { searchInventory } from "./lib/search";
import { buildMarkdown, fetchDocDetail, type DocDetail } from "./lib/doc-detail";

type DetailState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; detail: DocDetail; markdown: string };

export default function Command() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryError, setInventoryError] = useState<string | undefined>(undefined);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [detailState, setDetailState] = useState<Record<string, DetailState>>({});

  useEffect(() => {
    getInventory()
      .then((items) => {
        setInventory(items);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setInventoryError(message);
        showToast(Toast.Style.Failure, "Failed to load inventory", message);
      })
      .finally(() => {
        setIsLoadingInventory(false);
      });
  }, []);

  const inventoryMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const item of inventory) {
      map.set(item.id, item);
    }
    return map;
  }, [inventory]);

  const results = useMemo(() => searchInventory(inventory, searchText), [inventory, searchText]);

  useEffect(() => {
    if (results.length === 0) {
      setSelectedId(undefined);
      return;
    }

    setSelectedId((current) => {
      if (current && results.some((item) => item.id === current)) {
        return current;
      }
      return results[0]?.id;
    });
  }, [results]);

  useEffect(() => {
    if (!selectedId) {
      console.log("[numpy-docs] No selected item; skipping detail fetch");
      return;
    }

    const entry = inventoryMap.get(selectedId);
    if (!entry) {
      console.warn(
        "[numpy-docs] Selected item missing from inventory",
        selectedId,
        "inventory size",
        inventoryMap.size,
      );
      return;
    }

    let shouldFetch = false;

    setDetailState((prev) => {
      const existing = prev[selectedId];
      if (existing?.status === "ready") {
        console.log("[numpy-docs] Using cached detail state for", selectedId, existing.status);
        return prev;
      }

      shouldFetch = true;

      if (existing?.status === "loading") {
        console.log("[numpy-docs] Detail already loading for", selectedId);
        return prev;
      }

      console.log("[numpy-docs] Loading detail for", selectedId);
      return {
        ...prev,
        [selectedId]: { status: "loading" },
      };
    });

    if (!shouldFetch) {
      console.log("[numpy-docs] Skipping fetch because detail already loading or ready", selectedId);
      return;
    }

    let isCancelled = false;

    console.log("[numpy-docs] Triggering detail fetch for", selectedId, entry.url);

    fetchDocDetail(entry)
      .then((detail) => {
        if (isCancelled) {
          console.log("[numpy-docs] Detail request cancelled for", selectedId);
          return;
        }
        setDetailState((prev) => ({
          ...prev,
          [selectedId]: {
            status: "ready",
            detail,
            markdown: buildMarkdown(entry, detail),
          },
        }));
        console.log("[numpy-docs] Detail ready for", selectedId, {
          signature: detail.signature,
          descriptionCount: detail.description.length,
          parameterCount: detail.parameters.length,
          returnCount: detail.returns.length,
        });
      })
      .catch((error) => {
        if (isCancelled) {
          console.log("[numpy-docs] Detail error after cancel for", selectedId, error);
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setDetailState((prev) => ({
          ...prev,
          [selectedId]: { status: "error", error: message },
        }));
        showToast(Toast.Style.Failure, "Failed to load documentation", message);
        console.error("[numpy-docs] Detail fetch failed", selectedId, error);
      });

    return () => {
      isCancelled = true;
      console.log("[numpy-docs] Cleanup for", selectedId);
    };
  }, [selectedId, inventoryMap]);

  const listIsLoading = isLoadingInventory;
  const noResults = !listIsLoading && results.length === 0;

  return (
    <List
      isLoading={listIsLoading}
      isShowingDetail
      searchBarPlaceholder="Search NumPy documentation..."
      onSearchTextChange={setSearchText}
      throttle
      selectedItemId={selectedId}
      onSelectionChange={setSelectedId}
    >
      {inventoryError ? (
        <List.EmptyView icon={Icon.ExclamationMark} title="Unable to load inventory" description={inventoryError} />
      ) : noResults ? (
        <List.EmptyView icon={Icon.MagnifyingGlass} title="No results" description="Try a different NumPy symbol." />
      ) : (
        results.map((item) => {
          const detail = detailState[item.id];
          const detailMarkdown = buildDetailMarkdown(detail);
          return (
            <List.Item
              key={item.id}
              id={item.id}
              title={item.shortName}
              subtitle={item.name}
              accessories={[{ text: item.role.replace("py:", "") }]}
              icon={Icon.Book}
              detail={<List.Item.Detail markdown={detailMarkdown} metadata={buildMetadata(item)} />}
              actions={<ItemActions item={item} detail={detail} />}
            />
          );
        })
      )}
    </List>
  );
}

function buildDetailMarkdown(detail: DetailState | undefined): string {
  if (!detail) {
    return "Loading details...";
  }

  if (detail.status === "loading") {
    return "Loading details...";
  }

  if (detail.status === "error") {
    return `Failed to load documentation.\\n\\n${detail.error}`;
  }

  return detail.markdown;
}

function buildMetadata(item: InventoryItem): List.Item.Detail.Metadata | undefined {
  const metadata = (
    <List.Item.Detail.Metadata>
      <List.Item.Detail.Metadata.Label title="Type" text={item.role.replace("py:", "")} />
      <List.Item.Detail.Metadata.Label title="Full name" text={item.name} />
    </List.Item.Detail.Metadata>
  );

  return metadata;
}

function ItemActions({ item, detail }: { item: InventoryItem; detail: DetailState | undefined }) {
  const signature = detail && detail.status === "ready" ? detail.detail.signature : undefined;

  return (
    <ActionPanel>
      <Action.OpenInBrowser title="Open in Browser" url={item.url} />
      <Action.CopyToClipboard title="Copy URL" content={item.url} />
      <Action.CopyToClipboard title="Copy Qualified Name" content={item.name} />
      {signature ? <Action.CopyToClipboard title="Copy Signature" content={signature} /> : null}
    </ActionPanel>
  );
}

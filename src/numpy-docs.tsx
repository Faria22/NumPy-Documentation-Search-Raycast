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
      return;
    }

    const existing = detailState[selectedId];
    if (existing && (existing.status === "loading" || existing.status === "ready")) {
      return;
    }

    const entry = inventoryMap.get(selectedId);
    if (!entry) {
      return;
    }

    setDetailState((prev) => ({
      ...prev,
      [selectedId]: { status: "loading" },
    }));

    let isCancelled = false;

    fetchDocDetail(entry)
      .then((detail) => {
        if (isCancelled) {
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
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setDetailState((prev) => ({
          ...prev,
          [selectedId]: { status: "error", error: message },
        }));
        showToast(Toast.Style.Failure, "Failed to load documentation", message);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedId, inventoryMap, detailState]);

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

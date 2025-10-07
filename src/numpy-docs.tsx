import { Action, ActionPanel, Icon, List, getPreferenceValues } from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { useInventory } from "./hooks/useInventory";
import { useDocDetail } from "./hooks/useDocDetail";
import { type InventoryItem } from "./lib/inventory";
import { buildMarkdown, type DocDetail } from "./lib/doc-detail";
import { searchInventory } from "./lib/search";

type DetailRenderState = {
  detail?: DocDetail;
  isLoading: boolean;
  error?: Error;
};

export default function Command() {
  const { floatSignatureHeader = true } = getPreferenceValues<{ floatSignatureHeader: boolean }>();
  const [searchText, setSearchText] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const { data: inventory = [], isLoading: isLoadingInventory, error: inventoryError } = useInventory();

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

  const selectedItem = useMemo(() => results.find((item) => item.id === selectedId), [results, selectedId]);

  const { data: selectedDetail, isLoading: isLoadingDetail, error: selectedDetailError } = useDocDetail(selectedItem);

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
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Unable to load inventory"
          description={inventoryError.message}
        />
      ) : noResults ? (
        <List.EmptyView icon={Icon.MagnifyingGlass} title="No results" description="Try a different NumPy symbol." />
      ) : (
        results.map((item) => {
          const renderState: DetailRenderState =
            item.id === selectedItem?.id
              ? { detail: selectedDetail, isLoading: isLoadingDetail, error: selectedDetailError }
              : { detail: undefined, isLoading: false };

          const detailMarkdown = getDetailMarkdown(item, renderState);
          const metadata = buildMetadata(renderState.detail, floatSignatureHeader);

          return (
            <List.Item
              key={item.id}
              id={item.id}
              title={item.shortName}
              subtitle={item.name}
              accessories={[{ text: item.role.replace("py:", "") }]}
              icon={Icon.Book}
              detail={<List.Item.Detail markdown={detailMarkdown} metadata={metadata} />}
              actions={<ItemActions item={item} detail={renderState.detail} />}
            />
          );
        })
      )}
    </List>
  );
}

function getDetailMarkdown(item: InventoryItem, state: DetailRenderState): string {
  if (state.isLoading) {
    return "Loading details...";
  }

  if (state.error) {
    return `Failed to load documentation.\\n\\n${state.error.message}`;
  }

  if (!state.detail) {
    return "Select an entry to load its documentation.";
  }

  return buildMarkdown(item, state.detail);
}

function buildMetadata(
  detail: DocDetail | undefined,
  floatSignatureHeader: boolean,
): List.Item.Detail.Metadata | undefined {
  if (!floatSignatureHeader || !detail?.signature) {
    return undefined;
  }

  return (
    <List.Item.Detail.Metadata>
      <List.Item.Detail.Metadata.Label title="Signature" text={detail.signature} />
    </List.Item.Detail.Metadata>
  );
}

function ItemActions({ item, detail }: { item: InventoryItem; detail?: DocDetail }) {
  return (
    <ActionPanel>
      <Action.OpenInBrowser title="Open in Browser" url={item.url} />
      <Action.CopyToClipboard title="Copy URL" content={item.url} />
      <Action.CopyToClipboard title="Copy Qualified Name" content={item.name} />
      {detail?.signature ? <Action.CopyToClipboard title="Copy Signature" content={detail.signature} /> : null}
    </ActionPanel>
  );
}

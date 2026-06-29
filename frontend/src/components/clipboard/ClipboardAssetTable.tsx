import { ActionIcon, Group, Text } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { TbDownload, TbTrash } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import { HoverTip } from "../core/HoverTip";
import useTranslate from "../../hooks/useTranslate.hook";
import { Asset } from "../../types/asset.type";
import AssetTable, { sortAssetsByCreatedAtDesc } from "../asset/AssetTable";
import toast from "../../utils/toast.util";

const ClipboardAssetTable = ({
  assets,
  getFileDownloadUrl,
  onDelete,
}: {
  assets: Asset[];
  getFileDownloadUrl?: (asset: Asset) => string;
  onDelete?: (asset: Asset) => Promise<void>;
}) => {
  const t = useTranslate();
  const modals = useModals();
  const sortedAssets = sortAssetsByCreatedAtDesc(assets);

  const confirmDelete = (asset: Asset) => {
    if (!onDelete) return;

    modals.openConfirmModal({
      title: t("clipboard.assets.modal.delete.title"),
      children: (
        <Text size="sm">
          <FormattedMessage id="clipboard.assets.modal.delete.description" />
        </Text>
      ),
      confirmProps: { color: "red" },
      labels: {
        confirm: t("common.button.delete"),
        cancel: t("common.button.cancel"),
      },
      onConfirm: () => {
        onDelete(asset)
          .then(() => toast.success(t("clipboard.notify.asset-deleted")))
          .catch(toast.axiosError);
      },
    });
  };

  return (
    <AssetTable
      assets={sortedAssets}
      columns={["type", "value", "createdAt"]}
      typeLabelPrefix="clipboard.asset.type"
      headers={{
        type: <FormattedMessage id="clipboard.assets.table.type" />,
        value: <FormattedMessage id="clipboard.assets.table.value" />,
        createdAt: <FormattedMessage id="clipboard.assets.table.createdAt" />,
      }}
      empty={
        <Text c="dimmed" ta="center" py="xl">
          <FormattedMessage id="clipboard.assets.empty" />
        </Text>
      }
      renderActions={(asset) =>
        asset.type === "FILE" || onDelete ? (
          <Group justify="flex-end" wrap="nowrap">
            {asset.type === "FILE" && getFileDownloadUrl && (
              <HoverTip label={t("common.button.download")}>
                <ActionIcon
                  aria-label={t("common.button.download")}
                  variant="light"
                  color="victoria"
                  onClick={() => {
                    window.location.href = getFileDownloadUrl(asset);
                  }}
                >
                  <TbDownload />
                </ActionIcon>
              </HoverTip>
            )}
            {onDelete && (
              <HoverTip label={t("common.button.delete")}>
                <ActionIcon
                  aria-label={t("common.button.delete")}
                  variant="light"
                  color="red"
                  onClick={() => confirmDelete(asset)}
                >
                  <TbTrash />
                </ActionIcon>
              </HoverTip>
            )}
          </Group>
        ) : null
      }
    />
  );
};

export default ClipboardAssetTable;

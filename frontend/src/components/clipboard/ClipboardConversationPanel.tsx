import { Anchor, Badge, Box, Group, Stack, Text, Title } from "@mantine/core";
import moment from "moment";
import { ReactNode } from "react";
import { TbFile, TbFileText, TbLink } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import { Asset, AssetType } from "../../types/asset.type";
import {
  getAssetLabel,
  getAssetSizeLabel,
  sortAssetsByCreatedAtDesc,
} from "../asset/AssetTable";
import AssetActionMenu from "../asset/AssetActionMenu";
import classes from "./ClipboardConversationPanel.module.css";

const typeIcon: Record<AssetType, ReactNode> = {
  FILE: <TbFile />,
  TEXT: <TbFileText />,
  LINK: <TbLink />,
};

type ClipboardConversationPanelProps = {
  assets: Asset[];
  badge?: ReactNode;
  composer?: ReactNode;
  empty?: ReactNode;
  flushHeader?: boolean;
  getFileDownloadUrl?: (asset: Asset) => string;
  hideHeader?: boolean;
  onDelete?: (asset: Asset) => Promise<void>;
  subtitle?: ReactNode;
  title: ReactNode;
};

const ClipboardConversationPanel = ({
  assets,
  badge,
  composer,
  empty,
  flushHeader = false,
  getFileDownloadUrl,
  hideHeader = false,
  onDelete,
  subtitle,
  title,
}: ClipboardConversationPanelProps) => {
  const t = useTranslate();
  const clipboardConversationMessages = sortAssetsByCreatedAtDesc(assets)
    .slice()
    .reverse();

  const renderValue = (asset: Asset) => {
    if (asset.type === "LINK") {
      return (
        <Anchor href={asset.url} target="_blank" rel="noreferrer">
          {asset.url}
        </Anchor>
      );
    }

    if (asset.type === "FILE") {
      return (
        <Stack gap={2}>
          <Text fw={500}>{getAssetLabel(asset)}</Text>
          {asset.size && (
            <Text c="dimmed" size="xs">
              {getAssetSizeLabel(asset)}
            </Text>
          )}
        </Stack>
      );
    }

    return <Text>{getAssetLabel(asset)}</Text>;
  };

  const renderActions = (asset: Asset) => (
    <Group className={classes.bubbleActions} gap={4} wrap="nowrap">
      <AssetActionMenu
        asset={asset}
        deleteModalTitle={t("clipboard.assets.modal.delete.title")}
        deleteModalDescription={
          <Text size="sm">
            <FormattedMessage id="clipboard.assets.modal.delete.description" />
          </Text>
        }
        deleteSuccessMessage={t("clipboard.notify.asset-deleted")}
        downloadUrl={getFileDownloadUrl?.(asset)}
        onDelete={onDelete}
        showLibraryActions={false}
      />
    </Group>
  );

  return (
    <Box className={classes.clipboardConversationPanel}>
      {!hideHeader && (
        <Group
          className={`${classes.header} ${flushHeader ? classes.headerFlush : ""}`}
          justify="space-between"
          wrap="nowrap"
        >
          <div>
            <Title order={4}>{title}</Title>
            {subtitle && (
              <Text c="dimmed" size="sm">
                {subtitle}
              </Text>
            )}
          </div>
          {badge}
        </Group>
      )}

      <Stack className={classes.clipboardConversationMessages} gap="md">
        {clipboardConversationMessages.length === 0
          ? (empty ?? (
              <Text c="dimmed" ta="center" py="xl">
                <FormattedMessage id="clipboard.assets.empty" />
              </Text>
            ))
          : clipboardConversationMessages.map((asset) => (
              <Group
                key={asset.id}
                align="flex-start"
                className={`${classes.messageRow} ${classes.messageListItem}`}
                wrap="nowrap"
              >
                <Box className={classes.messageIcon}>
                  {typeIcon[asset.type]}
                </Box>
                <Box className={classes.clipboardMessageBubble}>
                  <div className={classes.bubbleHeader}>
                    <Group
                      className={classes.messageMeta}
                      gap="xs"
                      wrap="nowrap"
                    >
                      <Badge color="gray" variant="light">
                        {t(`clipboard.asset.type.${asset.type.toLowerCase()}`)}
                      </Badge>
                      <Text c="dimmed" size="xs">
                        {moment(asset.createdAt).format("LLL")}
                      </Text>
                    </Group>
                    {renderActions(asset)}
                  </div>
                  <Box className={classes.bubbleContent}>
                    {renderValue(asset)}
                  </Box>
                </Box>
              </Group>
            ))}
      </Stack>

      {composer && <Box className={classes.composer}>{composer}</Box>}
    </Box>
  );
};

export default ClipboardConversationPanel;

import {
  Button,
  Group,
  SegmentedControl,
  Stack,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  cloneElement,
  isValidElement,
  ReactElement,
  ReactNode,
  useState,
} from "react";
import { TbPlus } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import { Asset } from "../../types/asset.type";
import toast from "../../utils/toast.util";
import shareService from "../../services/share.service";

type ShareAssetComposerType = "TEXT" | "LINK" | "FILE";

type FileActionState = {
  dirty: boolean;
  isUploading: boolean;
};

type FilePanelActionProps = {
  formId?: string;
  hideActionButton?: boolean;
  onActionStateChange?: (state: FileActionState) => void;
};

const ShareAssetComposer = ({
  shareId,
  filePanel,
  onCreated,
}: {
  shareId: string;
  filePanel?: ReactNode;
  onCreated: (asset: Asset) => void;
}) => {
  const t = useTranslate();
  const [assetType, setAssetType] = useState<ShareAssetComposerType>("TEXT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileActionState, setFileActionState] = useState<FileActionState>({
    dirty: false,
    isUploading: false,
  });
  const textLinkFormId = `share-asset-composer-${shareId}`;
  const fileActionFormId = `share-file-assets-${shareId}`;
  const form = useForm({
    initialValues: {
      content: "",
      url: "",
    },
  });

  const submit = form.onSubmit(async (values) => {
    if (assetType === "FILE") return;

    setIsSubmitting(true);
    try {
      const asset = await shareService.addAsset(
        shareId,
        assetType === "TEXT"
          ? { type: "TEXT", content: values.content }
          : { type: "LINK", url: values.url },
      );
      onCreated(asset);
      form.reset();
      toast.success(t("share.asset.notify.created"));
    } catch (e) {
      toast.axiosError(e);
    } finally {
      setIsSubmitting(false);
    }
  });

  const isEmpty =
    assetType === "TEXT"
      ? form.values.content.trim().length === 0
      : assetType === "LINK"
        ? form.values.url.trim().length === 0
        : false;

  const injectedFilePanel = isValidElement(filePanel)
    ? cloneElement(filePanel as ReactElement<FilePanelActionProps>, {
        formId: fileActionFormId,
        hideActionButton: true,
        onActionStateChange: setFileActionState,
      })
    : filePanel;

  const typeOptions = [
    {
      value: "TEXT",
      label: t("account.assets.type.text"),
    },
    {
      value: "LINK",
      label: t("account.assets.type.link"),
    },
    ...(filePanel
      ? [
          {
            value: "FILE",
            label: t("account.assets.type.file"),
          },
        ]
      : []),
  ];

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end">
        <SegmentedControl
          value={assetType}
          onChange={(value) => setAssetType(value as ShareAssetComposerType)}
          data={typeOptions}
        />
        {assetType === "FILE" ? (
          <Button
            disabled={!fileActionState.dirty}
            form={fileActionFormId}
            leftSection={<TbPlus />}
            loading={fileActionState.isUploading}
            type="submit"
          >
            <FormattedMessage id="share.asset.add" />
          </Button>
        ) : (
          <Button
            disabled={isEmpty}
            form={textLinkFormId}
            leftSection={<TbPlus />}
            loading={isSubmitting}
            type="submit"
          >
            <FormattedMessage id="share.asset.add" />
          </Button>
        )}
      </Group>

      <form id={textLinkFormId} onSubmit={submit}>
        <Stack gap="sm">
          {assetType === "TEXT" && (
            <Textarea
              autosize
              minRows={3}
              label={t("account.assets.form.content")}
              {...form.getInputProps("content")}
            />
          )}
          {assetType === "LINK" && (
            <TextInput
              label={t("account.assets.form.url")}
              placeholder="https://example.com"
              {...form.getInputProps("url")}
            />
          )}
        </Stack>
      </form>
      {assetType === "FILE" && injectedFilePanel}
    </Stack>
  );
};

export default ShareAssetComposer;

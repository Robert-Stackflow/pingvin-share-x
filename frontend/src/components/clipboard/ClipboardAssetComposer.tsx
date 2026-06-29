import {
  Button,
  Group,
  SegmentedControl,
  Stack,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { AxiosError } from "axios";
import pLimit from "p-limit";
import { useState } from "react";
import { TbFile, TbLink, TbPlus, TbSend, TbTextCaption } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Dropzone from "../upload/Dropzone";
import FileList from "../upload/FileList";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import { FileUpload, FileUploadResponse } from "../../types/File.type";
import { Asset } from "../../types/asset.type";
import { CreateClipboardAsset } from "../../types/clipboard.type";

const promiseLimit = pLimit(3);
type ClipboardComposerAssetType = "FILE" | "TEXT" | "LINK";

type ClipboardAssetComposerProps = {
  onCreate: (asset: CreateClipboardAsset) => Promise<void>;
  onFileCreated: (assets: Asset[]) => void;
  uploadFile: (
    chunk: Blob,
    file: {
      id?: string;
      name: string;
    },
    chunkIndex: number,
    totalChunks: number,
  ) => Promise<FileUploadResponse & Partial<Asset>>;
  variant?: "default" | "chat";
};

const ClipboardAssetComposer = ({
  onCreate,
  onFileCreated,
  uploadFile,
  variant = "default",
}: ClipboardAssetComposerProps) => {
  const t = useTranslate();
  const config = useConfig();
  const [assetType, setAssetType] = useState<ClipboardComposerAssetType>("TEXT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<FileUpload[]>([]);
  const form = useForm({
    initialValues: {
      content: "",
      url: "",
    },
  });

  const submit = form.onSubmit(async (values) => {
    if (assetType === "FILE") {
      await uploadFiles(files);
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate(
        assetType === "TEXT"
          ? { type: "TEXT", content: values.content }
          : { type: "LINK", url: values.url },
      );
      form.reset();
    } finally {
      setIsSubmitting(false);
    }
  });

  const uploadFiles = async (selectedFiles: FileUpload[]) => {
    setIsSubmitting(true);
    const uploadedAssets: Asset[] = [];
    const chunkSize = parseInt(config.get("share.chunkSize"));
    const uploadPromises = selectedFiles.map(async (file, fileIndex) =>
      promiseLimit(async () => {
        let fileId: string | undefined;
        const setFileProgress = (progress: number) => {
          setFiles((currentFiles) =>
            currentFiles.map((currentFile, callbackIndex) => {
              if (fileIndex === callbackIndex) {
                currentFile.uploadingProgress = progress;
              }
              return currentFile;
            }),
          );
        };

        setFileProgress(1);
        let chunks = Math.ceil(file.size / chunkSize);
        if (chunks === 0) chunks++;

        for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
          const from = chunkIndex * chunkSize;
          const to = from + chunkSize;
          const blob = file.slice(from, to);

          try {
            const response = await uploadFile(
              blob,
              { id: fileId, name: file.name },
              chunkIndex,
              chunks,
            );

            fileId = response.id;
            if (response.type === "FILE") uploadedAssets.push(response as Asset);
            setFileProgress(((chunkIndex + 1) / chunks) * 100);
          } catch (e) {
            if (
              e instanceof AxiosError &&
              e.response?.data.error === "unexpected_chunk_index"
            ) {
              chunkIndex = e.response.data.expectedChunkIndex - 1;
              continue;
            }

            setFileProgress(-1);
            await new Promise((resolve) => setTimeout(resolve, 5000));
            chunkIndex = -1;
          }
        }
      }),
    );

    await Promise.all(uploadPromises);
    if (uploadedAssets.length > 0) onFileCreated(uploadedAssets);
    setFiles([]);
    setIsSubmitting(false);
  };

  const isEmpty =
    assetType === "FILE"
      ? files.length === 0
      : assetType === "TEXT"
      ? form.values.content.trim().length === 0
      : form.values.url.trim().length === 0;

  return (
    <form onSubmit={submit}>
      <Stack gap={variant === "chat" ? "xs" : "sm"}>
        <Group justify="space-between" align="flex-end">
          <SegmentedControl
            value={assetType}
            onChange={(value) => setAssetType(value as ClipboardComposerAssetType)}
            data={[
              {
                value: "FILE",
                label: t("clipboard.asset.type.file"),
              },
              {
                value: "TEXT",
                label: t("clipboard.asset.type.text"),
              },
              {
                value: "LINK",
                label: t("clipboard.asset.type.link"),
              },
            ]}
          />
          <Button
            type="submit"
            leftSection={
              assetType === "FILE" ? (
                <TbFile />
              ) : assetType === "TEXT" ? (
                <TbTextCaption />
              ) : (
                <TbLink />
              )
            }
            rightSection={variant === "chat" ? <TbSend /> : <TbPlus />}
            loading={isSubmitting}
            disabled={isEmpty}
          >
            <FormattedMessage id="clipboard.asset.create" />
          </Button>
        </Group>

        {assetType === "FILE" ? (
          <>
            <Dropzone
              title={t("clipboard.asset.file")}
              isUploading={isSubmitting}
              maxShareSize={parseInt(config.get("share.maxSize"))}
              onFilesChanged={(newFiles) => setFiles([...files, ...newFiles])}
            />
            {files.length > 0 && <FileList files={files} setFiles={setFiles} />}
          </>
        ) : assetType === "TEXT" ? (
          <Textarea
            minRows={variant === "chat" ? 2 : 4}
            maxRows={variant === "chat" ? 6 : undefined}
            autosize
            label={t("clipboard.asset.content")}
            {...form.getInputProps("content")}
          />
        ) : (
          <TextInput
            label={t("clipboard.asset.url")}
            placeholder="https://example.com"
            {...form.getInputProps("url")}
          />
        )}
      </Stack>
    </form>
  );
};

export default ClipboardAssetComposer;

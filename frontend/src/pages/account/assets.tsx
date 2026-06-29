import {
  Button,
  Center,
  Group,
  SegmentedControl,
  Select,
  Space,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDebouncedValue } from "@mantine/hooks";
import { AxiosError } from "axios";
import pLimit from "p-limit";
import { useEffect, useMemo, useState } from "react";
import { TbPlus, TbSearch } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import AssetActionMenu from "../../components/asset/AssetActionMenu";
import AssetTable from "../../components/asset/AssetTable";
import CenterLoader from "../../components/core/CenterLoader";
import Dropzone from "../../components/upload/Dropzone";
import FileList from "../../components/upload/FileList";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import assetService, {
  ListAssetParams,
} from "../../services/asset.service";
import { FileUpload } from "../../types/File.type";
import { Asset, AssetSource, AssetTagSummary, AssetType } from "../../types/asset.type";
import toast from "../../utils/toast.util";

const promiseLimit = pLimit(3);

type SortValue =
  | "createdAt_desc"
  | "createdAt_asc"
  | "lastAccessedAt_desc"
  | "name_asc";

const Assets = () => {
  const [assets, setAssets] = useState<Asset[]>();
  const [tags, setTags] = useState<AssetTagSummary[]>([]);
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [assetType, setAssetType] = useState<AssetType>("TEXT");
  const [isUploading, setIsUploading] = useState(false);
  const config = useConfig();
  const t = useTranslate();

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [typeFilter, setTypeFilter] = useState<AssetType | null>(null);
  const [sourceFilter, setSourceFilter] = useState<AssetSource | null>(null);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortValue>("createdAt_desc");

  const form = useForm({
    initialValues: {
      content: "",
      url: "",
    },
  });

  const filters: ListAssetParams = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      type: typeFilter ?? undefined,
      source: sourceFilter ?? undefined,
      favorite: favoriteOnly ? true : undefined,
      tag: tagFilter ?? undefined,
      sort,
    }),
    [debouncedSearch, typeFilter, sourceFilter, favoriteOnly, tagFilter, sort],
  );

  const refresh = () => {
    assetService.list(filters).then(setAssets).catch(toast.axiosError);
  };

  const refreshTags = () => {
    assetService.listTags().then(setTags).catch(toast.axiosError);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    refreshTags();
  }, []);

  const createAsset = form.onSubmit((values) => {
    if (assetType === "FILE") {
      uploadFiles(files);
      return;
    }

    const payload =
      assetType === "TEXT"
        ? { type: "TEXT" as const, content: values.content }
        : { type: "LINK" as const, url: values.url };

    assetService
      .create(payload)
      .then((asset) => {
        setAssets((current) => [asset, ...(current ?? [])]);
        form.reset();
        toast.success(t("account.assets.notify.created"));
      })
      .catch(toast.axiosError);
  });

  const uploadFiles = async (selectedFiles: FileUpload[]) => {
    setIsUploading(true);

    const uploadedAssets: Asset[] = [];
    const chunkSize = parseInt(config.get("share.chunkSize"));
    const fileUploadPromises = selectedFiles.map(async (file, fileIndex) =>
      promiseLimit(async () => {
        let fileId: string | undefined;

        const setFileProgress = (progress: number) => {
          setFiles((currentFiles) =>
            currentFiles.map((currentFile, callbackIndex) => {
              if (fileIndex == callbackIndex) {
                currentFile.uploadingProgress = progress;
              }
              return currentFile;
            }),
          );
        };

        setFileProgress(1);

        let chunks = Math.ceil(file.size / chunkSize);
        if (chunks == 0) chunks++;

        for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
          const from = chunkIndex * chunkSize;
          const to = from + chunkSize;
          const blob = file.slice(from, to);

          try {
            const response = await assetService.uploadFile(
              blob,
              {
                id: fileId,
                name: file.name,
              },
              chunkIndex,
              chunks,
            );

            fileId = response.id;
            if (response.type === "FILE")
              uploadedAssets.push(response as Asset);
            setFileProgress(((chunkIndex + 1) / chunks) * 100);
          } catch (e) {
            if (
              e instanceof AxiosError &&
              e.response?.data.error == "unexpected_chunk_index"
            ) {
              chunkIndex = e.response!.data!.expectedChunkIndex - 1;
              continue;
            }

            setFileProgress(-1);
            await new Promise((resolve) => setTimeout(resolve, 5000));
            chunkIndex = -1;
          }
        }
      }),
    );

    await Promise.all(fileUploadPromises);

    setAssets((current) => [...uploadedAssets, ...(current ?? [])]);
    setFiles([]);
    setIsUploading(false);
    if (uploadedAssets.length > 0) {
      toast.success(t("account.assets.notify.created"));
    }
  };

  if (!assets) return <CenterLoader />;

  return (
    <>
      <Meta title={t("account.assets.title")} />
      <Title mb={30} order={3}>
        <FormattedMessage id="account.assets.title" />
      </Title>

      <form onSubmit={createAsset}>
        <Stack gap="sm" mb="xl">
          <Group justify="space-between" align="flex-end">
            <SegmentedControl
              value={assetType}
              onChange={(value) => setAssetType(value as AssetType)}
              data={[
                {
                  value: "FILE",
                  label: t("account.assets.type.file"),
                },
                {
                  value: "TEXT",
                  label: t("account.assets.type.text"),
                },
                {
                  value: "LINK",
                  label: t("account.assets.type.link"),
                },
              ]}
            />
            <Button
              type="submit"
              leftSection={<TbPlus />}
              disabled={assetType === "FILE" && files.length === 0}
              loading={isUploading}
            >
              <FormattedMessage id="common.button.create" />
            </Button>
          </Group>
          {assetType === "FILE" ? (
            <>
              <Dropzone
                title={t("account.assets.form.file")}
                isUploading={isUploading}
                maxShareSize={parseInt(config.get("share.maxSize"))}
                onFilesChanged={(newFiles) => setFiles([...files, ...newFiles])}
              />
              {files.length > 0 && (
                <FileList files={files} setFiles={setFiles} />
              )}
            </>
          ) : assetType === "TEXT" ? (
            <Textarea
              minRows={4}
              autosize
              label={t("account.assets.form.content")}
              {...form.getInputProps("content")}
            />
          ) : (
            <TextInput
              label={t("account.assets.form.url")}
              placeholder="https://example.com"
              {...form.getInputProps("url")}
            />
          )}
        </Stack>
      </form>

      <Group gap="sm" align="flex-end" wrap="wrap" mb="md">
        <TextInput
          leftSection={<TbSearch />}
          placeholder={t("account.assets.filter.search")}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          style={{ flex: "1 1 220px" }}
        />
        <Select
          aria-label={t("account.assets.table.type")}
          clearable
          data={[
            { value: "FILE", label: t("account.assets.type.file") },
            { value: "TEXT", label: t("account.assets.type.text") },
            { value: "LINK", label: t("account.assets.type.link") },
          ]}
          placeholder={t("account.assets.filter.type.all")}
          value={typeFilter}
          onChange={(value) => setTypeFilter(value as AssetType | null)}
          w={130}
        />
        <Select
          aria-label={t("account.assets.filter.source.all")}
          clearable
          data={[
            { value: "UPLOAD", label: t("account.assets.source.upload") },
            { value: "SHARE", label: t("account.assets.source.share") },
            { value: "ROOM", label: t("account.assets.source.room") },
            { value: "INBOX", label: t("account.assets.source.inbox") },
          ]}
          placeholder={t("account.assets.filter.source.all")}
          value={sourceFilter}
          onChange={(value) => setSourceFilter(value as AssetSource | null)}
          w={140}
        />
        <Select
          aria-label={t("account.assets.filter.tag.all")}
          clearable
          data={tags.map((tag) => ({
            value: tag.name,
            label: `${tag.name} (${tag._count.assignments})`,
          }))}
          placeholder={t("account.assets.filter.tag.all")}
          value={tagFilter}
          onChange={setTagFilter}
          w={160}
        />
        <Select
          aria-label={t("account.assets.sort.createdAt_desc")}
          data={[
            {
              value: "createdAt_desc",
              label: t("account.assets.sort.createdAt_desc"),
            },
            {
              value: "createdAt_asc",
              label: t("account.assets.sort.createdAt_asc"),
            },
            {
              value: "lastAccessedAt_desc",
              label: t("account.assets.sort.lastAccessedAt_desc"),
            },
            {
              value: "name_asc",
              label: t("account.assets.sort.name_asc"),
            },
          ]}
          value={sort}
          onChange={(value) => setSort((value as SortValue) ?? "createdAt_desc")}
          w={170}
        />
        <Switch
          label={t("account.assets.filter.favorite")}
          checked={favoriteOnly}
          onChange={(event) => setFavoriteOnly(event.currentTarget.checked)}
        />
      </Group>

      <AssetTable
        assets={assets}
        headers={{
          type: <FormattedMessage id="account.assets.table.type" />,
          value: <FormattedMessage id="account.assets.table.value" />,
          createdAt: <FormattedMessage id="account.assets.table.createdAt" />,
          size: <FormattedMessage id="account.assets.table.size" />,
        }}
        empty={
          <Center style={{ height: "45vh" }}>
            <Stack align="center" gap={10}>
              <Title order={3}>
                <FormattedMessage id="account.assets.title.empty" />
              </Title>
              <Text>
                <FormattedMessage id="account.assets.description.empty" />
              </Text>
              <Space h={5} />
            </Stack>
          </Center>
        }
        renderActions={(asset) => (
          <AssetActionMenu
            asset={asset}
            onAssetCreated={(createdAsset) => {
              setAssets((current) => [createdAsset, ...(current ?? [])]);
            }}
            onAssetDeleted={(assetId) => {
              setAssets((current) =>
                current?.filter((item) => item.id !== assetId),
              );
            }}
            onAssetUpdated={(updatedAsset) => {
              setAssets((current) =>
                current?.map((item) =>
                  item.id === updatedAsset.id ? updatedAsset : item,
                ),
              );
            }}
            onTagsUpdated={refreshTags}
          />
        )}
      />
    </>
  );
};

export default Assets;

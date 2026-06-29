import { Button, Group } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { cleanNotifications } from "@mantine/notifications";
import { AxiosError } from "axios";
import pLimit from "p-limit";
import { useEffect, useRef, useState } from "react";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import Dropzone from "../../components/upload/Dropzone";
import FileList from "../../components/upload/FileList";
import showCompletedUploadModal from "../../components/upload/modals/showCompletedUploadModal";
import showCreateUploadModal from "../../components/upload/modals/showCreateUploadModal";
import useConfig from "../../hooks/config.hook";
import useConfirmLeave from "../../hooks/confirm-leave.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import inboxService from "../../services/inbox.service";
import shareService from "../../services/share.service";
import { CreateAsset } from "../../types/asset.type";
import { FileUpload, FileUploadResponse } from "../../types/File.type";
import { InboxSubmission } from "../../types/inbox.type";
import { CreateShare, Share } from "../../types/share.type";
import toast from "../../utils/toast.util";

const promiseLimit = pLimit(3);
let errorToastShown = false;
let createdShare: Share;
let createdSubmission: InboxSubmission;

const Upload = ({
  maxShareSize,
  isReverseShare = false,
  inboxToken,
  simplified,
}: {
  maxShareSize?: number;
  isReverseShare: boolean;
  inboxToken?: string;
  simplified: boolean;
}) => {
  const modals = useModals();
  const t = useTranslate();

  const { user } = useUser();
  const config = useConfig();
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isUploading, setisUploading] = useState(false);

  useConfirmLeave({
    message: t("upload.notify.confirm-leave"),
    enabled: isUploading,
  });

  const chunkSize = useRef(parseInt(config.get("share.chunkSize")));

  maxShareSize ??= parseInt(config.get("share.maxSize"));
  const autoOpenCreateUploadModal = config.get("share.autoOpenShareModal");
  const isInboxUpload = !!inboxToken;

  const uploadFiles = async (
    share: CreateShare,
    files: FileUpload[],
    pendingAssets: CreateAsset[] = [],
  ) => {
    setisUploading(true);

    try {
      if (isInboxUpload) {
        createdSubmission = await inboxService.createSubmission(inboxToken!, {
          message: [share.name, share.description].filter(Boolean).join("\n\n"),
          assets: pendingAssets,
          hasFiles: files.length > 0,
        });
      } else {
        const totalSize = files.reduce((acc, file) => acc + file.size, 0);
        createdShare = await shareService.create(
          { ...share, size: totalSize },
          isReverseShare,
        );
        const assetUploadPromises = pendingAssets.map((asset) =>
          shareService.addAsset(createdShare.id, asset),
        );
        await Promise.all(assetUploadPromises);
      }
    } catch (e) {
      toast.axiosError(e);
      setisUploading(false);
      return;
    }

    if (files.length === 0) {
      if (isInboxUpload) {
        setisUploading(false);
        toast.success(t("inbox.submission.created"));
        setFiles([]);
        return;
      }

      shareService.completeShare(createdShare.id)
        .then((share) => {
          setisUploading(false);
          showCompletedUploadModal(
            modals,
            share,
            config.get("general.appUrl"),
            config.get("general.appUrl", true),
          );
        })
        .catch(() => {
          setisUploading(false);
          toast.error(t("upload.notify.generic-error"));
        });
      return;
    }

    const fileUploadPromises = files.map(async (file, fileIndex) =>
      // Limit the number of concurrent uploads to 3
      promiseLimit(async () => {
        let fileId: string | undefined;

        const setFileProgress = (progress: number) => {
          setFiles((files) =>
            files.map((file, callbackIndex) => {
              if (fileIndex == callbackIndex) {
                file.uploadingProgress = progress;
              }
              return file;
            }),
          );
        };

        setFileProgress(1);

        let chunks = Math.ceil(file.size / chunkSize.current);

        // If the file is 0 bytes, we still need to upload 1 chunk
        if (chunks == 0) chunks++;

        for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
          const from = chunkIndex * chunkSize.current;
          const to = from + chunkSize.current;
          const blob = file.slice(from, to);
          try {
            const response: FileUploadResponse = isInboxUpload
              ? await inboxService.uploadSubmissionFile(
                  inboxToken!,
                  createdSubmission.id,
                  blob,
                  {
                    id: fileId,
                    name: file.name,
                  },
                  chunkIndex,
                  chunks,
                )
              : await shareService.uploadFile(
                  createdShare.id,
                  blob,
                  {
                    id: fileId,
                    name: file.name,
                  },
                  chunkIndex,
                  chunks,
                );
            fileId = response.id;

            setFileProgress(((chunkIndex + 1) / chunks) * 100);
          } catch (e) {
            if (
              e instanceof AxiosError &&
              e.response?.data.error == "unexpected_chunk_index"
            ) {
              // Retry with the expected chunk index
              chunkIndex = e.response!.data!.expectedChunkIndex - 1;
              continue;
            } else {
              setFileProgress(-1);
              // Retry after 5 seconds
              await new Promise((resolve) => setTimeout(resolve, 5000));
              chunkIndex = -1;

              continue;
            }
          }
        }
      }),
    );

    Promise.all(fileUploadPromises);
  };

  const showCreateUploadModalCallback = (files: FileUpload[]) => {
    showCreateUploadModal(
      modals,
      {
        isUserSignedIn: user ? true : false,
        isReverseShare,
        isInbox: isInboxUpload,
        appUrl: config.get("general.appUrl"),
        defaultAppUrl: config.get("general.appUrl", true),
        allowUnauthenticatedShares: config.get(
          "share.allowUnauthenticatedShares",
        ),
        enableEmailRecepients: config.get("email.enableShareEmailRecipients"),
        maxExpiration: config.get("share.maxExpiration"),
        defaultExpiration: config.get("share.defaultExpiration"),
        shareIdLength: config.get("share.shareIdLength"),
        simplified,
      },
      files,
      uploadFiles,
    );
  };

  const handleDropzoneFilesChanged = (files: FileUpload[]) => {
    if (autoOpenCreateUploadModal) {
      setFiles(files);
      showCreateUploadModalCallback(files);
    } else {
      setFiles((oldArr) => [...oldArr, ...files]);
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (modals.modals.length > 0) {
        return;
      }

      const clipboardData = e.clipboardData;

      if (!clipboardData) {
        return;
      }

      if (clipboardData?.getData("text/plain")) {
        const pastedText = clipboardData.getData("text/plain");
        if (!pastedText) {
          return;
        }

        // Create a sanitised file name from the pasted text
        const safeName = pastedText
          .substring(0, 50)
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .trim();
        const fileName = `${safeName || "clipboard_paste"}.txt`;

        const file = new File([pastedText], fileName, {
          type: "text/plain",
        });
        const fileUpload = file as FileUpload;
        fileUpload.uploadingProgress = 0;

        if (autoOpenCreateUploadModal) {
          setFiles([fileUpload]);
          showCreateUploadModalCallback([fileUpload]);
        } else {
          setFiles((oldArr) => [...oldArr, fileUpload]);
        }
      }
    };

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [autoOpenCreateUploadModal, modals.modals.length]);

  useEffect(() => {
    // Check if there are any files that failed to upload
    const fileErrorCount = files.filter(
      (file) => file.uploadingProgress == -1,
    ).length;

    if (fileErrorCount > 0) {
      if (!errorToastShown) {
        toast.error(
          t("upload.notify.count-failed", { count: fileErrorCount }),
          {
            withCloseButton: false,
            autoClose: false,
          },
        );
      }
      errorToastShown = true;
    } else {
      cleanNotifications();
      errorToastShown = false;
    }

    // Complete share
    if (
      files.length > 0 &&
      files.every((file) => file.uploadingProgress >= 100) &&
      fileErrorCount == 0
    ) {
      if (isInboxUpload) {
        setisUploading(false);
        toast.success(t("inbox.submission.created"));
        setFiles([]);
        return;
      }

      shareService.completeShare(createdShare.id)
        .then((share) => {
          setisUploading(false);
          showCompletedUploadModal(
            modals,
            share,
            config.get("general.appUrl"),
            config.get("general.appUrl", true),
          );
          setFiles([]);
        })
        .catch(() => toast.error(t("upload.notify.generic-error")));
    }
  }, [files, isInboxUpload]);

  return (
    <>
      <Meta title={t("upload.title")} />
      <Group justify="flex-end" mb={20}>
        <Button
          loading={isUploading}
          disabled={files.length <= 0}
          onClick={() => showCreateUploadModalCallback(files)}
        >
          <FormattedMessage
            id={
              isInboxUpload ? "upload.modal.inbox.submit" : "common.button.share"
            }
          />
        </Button>
      </Group>
      <Dropzone
        title={
          !autoOpenCreateUploadModal && files.length > 0
            ? t("share.edit.append-upload")
            : undefined
        }
        maxShareSize={maxShareSize}
        onFilesChanged={handleDropzoneFilesChanged}
        isUploading={isUploading}
      />
      {files.length > 0 && (
        <FileList<FileUpload> files={files} setFiles={setFiles} />
      )}
    </>
  );
};
export default Upload;

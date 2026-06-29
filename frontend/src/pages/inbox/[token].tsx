import { LoadingOverlay } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { GetServerSidePropsContext } from "next";
import { useEffect, useState } from "react";
import showErrorModal from "../../components/share/showErrorModal";
import useTranslate from "../../hooks/useTranslate.hook";
import inboxService from "../../services/inbox.service";
import Upload from "../upload";

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: { inboxToken: context.params!.token },
  };
}

const InboxUpload = ({ inboxToken }: { inboxToken: string }) => {
  const modals = useModals();
  const t = useTranslate();
  const [isLoading, setIsLoading] = useState(true);

  const [maxShareSize, setMaxShareSize] = useState(0);
  const [simplified, setSimplified] = useState(false);

  useEffect(() => {
    inboxService
      .setInbox(inboxToken)
      .then((inbox) => {
        setMaxShareSize(parseInt(inbox.maxShareSize));
        setSimplified(inbox.simplified);
        setIsLoading(false);
      })
      .catch(() => {
        showErrorModal(
          modals,
          t("upload.reverse-share.error.invalid.title"),
          t("upload.reverse-share.error.invalid.description"),
          "go-home",
        );
        setIsLoading(false);
      });
  }, []);

  if (isLoading) return <LoadingOverlay visible />;

  return (
    <Upload
      inboxToken={inboxToken}
      isReverseShare
      maxShareSize={maxShareSize}
      simplified={simplified}
    />
  );
};

export default InboxUpload;

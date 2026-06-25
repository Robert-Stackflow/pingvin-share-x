import { NotificationData, notifications } from "@mantine/notifications";
import { TbCheck, TbX } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import { getApiErrorMessage } from "./error.util";
import { ReactNode } from "react";

const error = (
  message: ReactNode,
  config?: Omit<NotificationData, "message">,
) =>
  notifications.show({
    icon: <TbX />,
    color: "red",
    radius: "md",
    title: <FormattedMessage id="common.error" />,
    message: message,

    autoClose: true,

    ...config,
  });

const axiosError = (axiosError: any) =>
  error(
    getApiErrorMessage(axiosError) ?? (
      <FormattedMessage id="common.error.unknown" />
    ),
  );

const success = (
  message: ReactNode,
  config?: Omit<NotificationData, "message">,
) =>
  notifications.show({
    icon: <TbCheck />,
    color: "green",
    radius: "md",
    title: <FormattedMessage id="common.success" />,
    message: message,
    autoClose: true,
    ...config,
  });

const toast = {
  error,
  success,
  axiosError,
};
export default toast;

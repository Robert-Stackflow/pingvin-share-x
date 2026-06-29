import {
  NumberInput,
  PasswordInput,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import useTranslate from "../../hooks/useTranslate.hook";
import {
  AccessControl,
  AccessControlField,
  toAccessControlPayload,
} from "../../types/accessControl.type";

export { toAccessControlPayload };
export type { AccessControl };

type AccessControlFormProps = {
  value: AccessControl;
  onChange: (value: AccessControl) => void;
  /**
   * Restrict which controls render for a given surface. When omitted, every
   * control is shown. e.g. clipboard rooms hide `password` because they keep
   * their existing passcode field.
   */
  fields?: AccessControlField[];
};

const ALL_FIELDS: AccessControlField[] = [
  "password",
  "expiresAt",
  "maxViews",
  "allowDownload",
  "allowAnonymous",
  "oneTime",
];

const AccessControlForm = ({
  value,
  onChange,
  fields,
}: AccessControlFormProps) => {
  const t = useTranslate();

  const visible = (field: AccessControlField) =>
    fields ? fields.includes(field) : ALL_FIELDS.includes(field);

  const set = <K extends keyof AccessControl>(
    key: K,
    fieldValue: AccessControl[K],
  ) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <Stack gap="sm">
      <Text size="sm" fw={500}>
        {t("accessControl.title")}
      </Text>

      {visible("password") && (
        <PasswordInput
          autoComplete="new-password"
          label={t("accessControl.password")}
          placeholder={t("accessControl.password.placeholder")}
          value={value.password ?? ""}
          variant="filled"
          onChange={(event) => set("password", event.currentTarget.value)}
        />
      )}

      {visible("expiresAt") && (
        <TextInput
          label={t("accessControl.expiresAt")}
          type="datetime-local"
          value={value.expiresAt ?? ""}
          variant="filled"
          onChange={(event) => set("expiresAt", event.currentTarget.value)}
        />
      )}

      {visible("maxViews") && (
        <NumberInput
          hideControls
          label={t("accessControl.maxViews")}
          min={1}
          placeholder={t("accessControl.maxViews.placeholder")}
          value={value.maxViews ?? ""}
          variant="filled"
          onChange={(maxViews) =>
            set(
              "maxViews",
              typeof maxViews === "number" ? maxViews : undefined,
            )
          }
        />
      )}

      {visible("allowDownload") && (
        <Switch
          checked={value.allowDownload ?? false}
          label={t("accessControl.allowDownload")}
          onChange={(event) =>
            set("allowDownload", event.currentTarget.checked)
          }
        />
      )}

      {visible("allowAnonymous") && (
        <Switch
          checked={value.allowAnonymous ?? false}
          label={t("accessControl.allowAnonymous")}
          onChange={(event) =>
            set("allowAnonymous", event.currentTarget.checked)
          }
        />
      )}

      {visible("oneTime") && (
        <Switch
          checked={value.oneTime ?? false}
          label={t("accessControl.oneTime")}
          onChange={(event) => set("oneTime", event.currentTarget.checked)}
        />
      )}
    </Stack>
  );
};

export default AccessControlForm;

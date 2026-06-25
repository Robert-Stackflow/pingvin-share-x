import { Anchor, Box, Text } from "@mantine/core";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";

const Footer = () => {
  const t = useTranslate();
  const config = useConfig();
  const hasImprint = !!(
    config.get("legal.imprintUrl") || config.get("legal.imprintText")
  );
  const hasPrivacy = !!(
    config.get("legal.privacyPolicyUrl") ||
    config.get("legal.privacyPolicyText")
  );
  const imprintUrl =
    (!config.get("legal.imprintText") && config.get("legal.imprintUrl")) ||
    "/imprint";
  const privacyUrl =
    (!config.get("legal.privacyPolicyText") &&
      config.get("legal.privacyPolicyUrl")) ||
    "/privacy";

  if (!config.get("legal.enabled")) {
    return null;
  }

  return (
    <Box component="footer" py={6} px="xl" style={{ zIndex: 100 }}>
      <Text size="xs" c="dimmed" ta="right">
        {hasImprint && (
          <Anchor size="xs" href={imprintUrl}>
            {t("imprint.title")}
          </Anchor>
        )}
        {hasImprint && hasPrivacy && " • "}
        {hasPrivacy && (
          <Anchor size="xs" href={privacyUrl}>
            {t("privacy.title")}
          </Anchor>
        )}
      </Text>
    </Box>
  );
};

export default Footer;

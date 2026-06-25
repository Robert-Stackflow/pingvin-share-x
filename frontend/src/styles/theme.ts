import { createTheme, MantineThemeOverride } from "@mantine/core";

const theme: MantineThemeOverride = createTheme({
  colors: {
    victoria: [
      "#E2E1F1",
      "#C2C0E7",
      "#A19DE4",
      "#7D76E8",
      "#544AF4",
      "#4940DE",
      "#4239C8",
      "#463FA8",
      "#47428E",
      "#464379",
    ],
  },
  primaryColor: "victoria",
  components: {
    Modal: {
      styles: {
        title: {
          fontSize: "var(--mantine-font-size-lg)",
          fontWeight: 700,
        },
      },
    },
  },
});

export default theme;

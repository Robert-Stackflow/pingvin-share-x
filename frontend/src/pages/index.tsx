import { useRouter } from "next/router";
import { useEffect } from "react";
import CenterLoader from "../components/core/CenterLoader";
import Meta from "../components/Meta";
import useConfig from "../hooks/config.hook";
import useUser from "../hooks/user.hook";

export default function Home() {
  const { refreshUser } = useUser();
  const router = useRouter();
  const config = useConfig();

  // The landing page is a pure redirect: authenticated users go to the upload
  // workspace, everyone else goes straight to sign in (or sign up when
  // registration is enabled). No marketing/welcome screen.
  useEffect(() => {
    refreshUser().then((user) => {
      if (user) {
        router.replace("/upload");
        return;
      }

      let signupEnabled = true;
      try {
        signupEnabled = config.get("share.allowRegistration") !== false;
      } catch {
        signupEnabled = true;
      }

      router.replace(signupEnabled ? "/auth/signUp" : "/auth/signIn");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Meta title="Home" />
      <CenterLoader />
    </>
  );
}

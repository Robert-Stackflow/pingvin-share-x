import axios, { AxiosError } from "axios";
import { GetServerSidePropsContext } from "next";
import { getQueryString } from "../../utils/router.util";

function getShareDestination(context: GetServerSidePropsContext) {
  const { shareId } = context.params!;
  const recipientId = getQueryString(context.query.recipient);

  return (
    "/share/" +
    shareId +
    (recipientId ? `?recipient=${encodeURIComponent(recipientId)}` : "")
  );
}

function redirect(destination: string) {
  return {
    redirect: {
      permanent: false,
      destination,
    },
  };
}

function redirectFromShortLinkResponse(error: unknown) {
  if (
    error instanceof AxiosError &&
    error.response?.status &&
    error.response.status >= 300 &&
    error.response.status < 400 &&
    error.response.headers.location
  ) {
    return redirect(error.response.headers.location);
  }
}

// Redirect short links first; if no short link exists, keep /s/:id as a share alias.
export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { shareId } = context.params!;
  if (typeof shareId !== "string") return { notFound: true };

  const apiURL = process.env.API_URL || "http://localhost:8080";

  try {
    const response = await axios.get(
      `${apiURL}/api/short-links/${encodeURIComponent(shareId)}/visit`,
      {
        headers: {
          "user-agent": context.req.headers["user-agent"] ?? "",
          referer: context.req.headers.referer ?? "",
          "x-forwarded-for":
            context.req.headers["x-forwarded-for"] ??
            context.req.socket.remoteAddress ??
            "",
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 300 && status < 400,
      },
    );

    const destination = response.headers.location;
    if (destination) return redirect(destination);
  } catch (error) {
    const shortLinkRedirect = redirectFromShortLinkResponse(error);
    if (shortLinkRedirect) return shortLinkRedirect;
  }

  return redirect(getShareDestination(context));
}

export default function ShareAlias() {
  return null;
}

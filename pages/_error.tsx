import type { NextPageContext } from "next";

function ErrorPage({ statusCode, message }: { statusCode?: number; message?: string }) {
  return (
    <div style={{ padding: 40 }}>
      <h1>Une erreur est survenue ⚠️</h1>
      {statusCode ? <p>Code: {statusCode}</p> : null}
      <p>{message ?? "Veuillez réessayer."}</p>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500;
  const message = err?.message;
  return { statusCode, message };
};

export default ErrorPage;

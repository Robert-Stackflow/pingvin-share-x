import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/admin/users",
      permanent: false,
    },
  };
};

const Admin = () => null;

export default Admin;

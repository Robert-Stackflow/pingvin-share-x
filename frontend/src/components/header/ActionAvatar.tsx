import { ActionIcon, Menu } from "@mantine/core";
import Link from "next/link";
import {
  TbActivity,
  TbDoorExit,
  TbHistory,
  TbLink,
  TbSettings,
  TbUser,
  TbUserCircle,
  TbUsers,
} from "react-icons/tb";
import useUser from "../../hooks/user.hook";
import authService from "../../services/auth.service";
import { FormattedMessage } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import classes from "./Header.module.css";

const ActionAvatar = () => {
  const { user } = useUser();
  const t = useTranslate();

  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <ActionIcon
          aria-label={t("common.button.profile")}
          className={classes.iconLink}
          color="gray"
          title={t("common.button.profile")}
          variant="subtle"
        >
          <TbUserCircle size={20} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          component={Link}
          href="/account"
          leftSection={<TbUser size={14} />}
        >
          <FormattedMessage id="navbar.avatar.account" />
        </Menu.Item>
        <Menu.Item
          component={Link}
          href="/account/activity"
          leftSection={<TbHistory size={14} />}
        >
          <FormattedMessage id="account.activity.title" />
        </Menu.Item>
        {user!.isAdmin && (
          <>
            <Menu.Divider />
            <Menu.Item
              component={Link}
              href="/admin/users"
              leftSection={<TbUsers size={14} />}
            >
              <FormattedMessage id="admin.button.users" />
            </Menu.Item>
            <Menu.Item
              component={Link}
              href="/admin/shares"
              leftSection={<TbLink size={14} />}
            >
              <FormattedMessage id="admin.button.shares" />
            </Menu.Item>
            <Menu.Item
              component={Link}
              href="/admin/config/general"
              leftSection={<TbSettings size={14} />}
            >
              <FormattedMessage id="admin.button.config" />
            </Menu.Item>
            <Menu.Item
              component={Link}
              href="/admin/activity"
              leftSection={<TbActivity size={14} />}
            >
              <FormattedMessage id="admin.button.activity" />
            </Menu.Item>
          </>
        )}

        <Menu.Divider />
        <Menu.Item
          onClick={async () => {
            await authService.signOut();
          }}
          leftSection={<TbDoorExit size={14} />}
        >
          <FormattedMessage id="navbar.avatar.signout" />
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default ActionAvatar;

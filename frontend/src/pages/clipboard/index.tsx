import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Checkbox,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Tabs,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import { AxiosError } from "axios";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import {
  TbClipboard,
  TbEdit,
  TbExternalLink,
  TbHistory,
  TbKey,
  TbLink,
  TbLock,
  TbPlus,
  TbSettings,
  TbTrash,
  TbUsers,
  TbWorld,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import AccessControlForm from "../../components/access/AccessControlForm";
import {
  AccessControl,
  toAccessControlPayload,
} from "../../types/accessControl.type";
import ClipboardAssetComposer from "../../components/clipboard/ClipboardAssetComposer";
import ClipboardConversationPanel from "../../components/clipboard/ClipboardConversationPanel";
import CenterLoader from "../../components/core/CenterLoader";
import tableClasses from "../../components/core/DataTable.module.css";
import { HoverTip } from "../../components/core/HoverTip";
import Meta from "../../components/Meta";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import clipboardService from "../../services/clipboard.service";
import { Asset } from "../../types/asset.type";
import { Clipboard } from "../../types/clipboard.type";
import toast from "../../utils/toast.util";
import {
  readVisitedClipboardRooms,
  rememberVisitedClipboardRoom,
  VisitedClipboardRoom,
} from "../../utils/visitedClipboardRooms.util";
import classes from "./ClipboardPage.module.css";

type SelectedClipboard =
  | {
      type: "private";
    }
  | {
      roomId: string;
      type: "room";
    }
  | {
      roomId: string;
      type: "visitedRoom";
    };

type RoomTab = "private" | "mine" | "visited" | "manage";

const ClipboardPage = () => {
  const t = useTranslate();
  const clipboardHook = useClipboard();
  const modals = useModals();
  const router = useRouter();
  const { user } = useUser();
  const [privateClipboard, setPrivateClipboard] = useState<Clipboard>();
  const [rooms, setRooms] = useState<Clipboard[]>();
  const [visitedRooms, setVisitedRooms] = useState<VisitedClipboardRoom[]>([]);
  const [visitedRoom, setVisitedRoom] = useState<Clipboard>();
  const [activeRoomTab, setActiveRoomTab] = useState<RoomTab>("private");
  const [selectedClipboard, setSelectedClipboard] = useState<SelectedClipboard>(
    {
      type: "private",
    },
  );
  const [isCreateRoomOpen, setCreateRoomOpen] = useState(false);
  const [roomAccessControl, setRoomAccessControl] = useState<AccessControl>({});
  const [isEditRoomOpen, setEditRoomOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Clipboard>();
  const updateClipboardRoom = clipboardService.updateRoom;
  const roomForm = useForm({
    initialValues: {
      name: "",
      passcode: "",
    },
  });
  const editRoomForm = useForm({
    initialValues: {
      name: "",
      passcode: "",
      removePasscode: false,
    },
  });

  const selectedRoom = useMemo(
    () =>
      selectedClipboard.type === "room"
        ? rooms?.find((room) => room.roomId === selectedClipboard.roomId)
        : undefined,
    [rooms, selectedClipboard],
  );
  const selectedVisitedRoom = useMemo(
    () =>
      selectedClipboard.type === "visitedRoom"
        ? visitedRooms.find((room) => room.roomId === selectedClipboard.roomId)
        : undefined,
    [selectedClipboard, visitedRooms],
  );
  const roomOptions = useMemo(
    () =>
      (rooms ?? []).map((room) => ({
        value: room.roomId ?? room.id,
        label: room.name || room.roomId || room.id,
      })),
    [rooms],
  );
  const visitedRoomOptions = useMemo(
    () =>
      visitedRooms.map((room) => ({
        value: room.roomId,
        label: room.name || room.roomId,
      })),
    [visitedRooms],
  );

  const isPrivateSelected =
    activeRoomTab === "private" && selectedClipboard.type === "private";
  const isRoomSelected =
    activeRoomTab === "mine" &&
    selectedClipboard.type === "room" &&
    !!selectedRoom;
  const isVisitedSelected =
    activeRoomTab === "visited" &&
    selectedClipboard.type === "visitedRoom" &&
    !!visitedRoom;
  const activeClipboard = isPrivateSelected
    ? privateClipboard
    : isRoomSelected
      ? selectedRoom
      : isVisitedSelected
        ? visitedRoom
        : undefined;
  const canCompose = isPrivateSelected || isRoomSelected;
  const isVisitedWithoutSelection =
    activeRoomTab === "visited" && !activeClipboard;

  const refresh = () => {
    Promise.all([clipboardService.getMine(), clipboardService.listRooms()])
      .then(([mine, roomList]) => {
        setPrivateClipboard(mine);
        setRooms(roomList);
      })
      .catch(toast.axiosError);
  };

  useEffect(() => {
    if (user) {
      refresh();
      setVisitedRooms(readVisitedClipboardRooms());
    }
  }, [user]);

  useEffect(() => {
    if (
      selectedClipboard.type === "room" &&
      rooms &&
      !rooms.some((room) => room.roomId === selectedClipboard.roomId)
    ) {
      setActiveRoomTab("private");
      setSelectedClipboard({ type: "private" });
    }
  }, [rooms, selectedClipboard]);

  const createRoom = roomForm.onSubmit((values) => {
    clipboardService
      .createRoom({
        name: values.name.trim() || undefined,
        passcode: values.passcode.trim() || undefined,
        accessControl: toAccessControlPayload(roomAccessControl),
      })
      .then((room) => {
        setRooms((current) => [room, ...(current ?? [])]);
        if (room.roomId) {
          setActiveRoomTab("mine");
          setSelectedClipboard({ type: "room", roomId: room.roomId });
        }
        setCreateRoomOpen(false);
        roomForm.reset();
        setRoomAccessControl({});
        toast.success(t("clipboard.notify.room-created"));
      })
      .catch(toast.axiosError);
  });

  const openEditRoom = (room = selectedRoom) => {
    if (!room) return;
    setEditingRoom(room);
    editRoomForm.setValues({
      name: room.name || "",
      passcode: "",
      removePasscode: false,
    });
    setEditRoomOpen(true);
  };

  const updateRoom = editRoomForm.onSubmit((values) => {
    if (!editingRoom?.roomId) return;
    updateClipboardRoom(editingRoom.roomId, {
      name: values.name.trim() || null,
      passcode: values.removePasscode
        ? null
        : values.passcode.trim() || undefined,
    })
      .then((updatedRoom) => {
        setRooms((current) =>
          current?.map((room) =>
            room.id === updatedRoom.id ? updatedRoom : room,
          ),
        );
        setEditRoomOpen(false);
        setEditingRoom(undefined);
        editRoomForm.reset();
        toast.success(t("clipboard.notify.room-updated"));
      })
      .catch(toast.axiosError);
  });

  const copyRoomLink = (roomId: string) => {
    clipboardHook.copy(`${window.location.origin}/clipboard/rooms/${roomId}`);
    toast.success(t("common.notify.copied-link"));
  };

  const confirmDeleteRoom = (room: Clipboard) => {
    if (!room.roomId) return;

    modals.openConfirmModal({
      title: t("clipboard.rooms.delete.title"),
      children: (
        <Text size="sm">
          <FormattedMessage
            id="clipboard.rooms.delete.description"
            values={{ room: room.name || room.roomId }}
          />
        </Text>
      ),
      confirmProps: { color: "red" },
      labels: {
        confirm: t("common.button.delete"),
        cancel: t("common.button.cancel"),
      },
      onConfirm: () => {
        clipboardService
          .removeRoom(room.roomId as string)
          .then(() => {
            const nextRooms =
              rooms?.filter((item) => item.roomId !== room.roomId) ?? [];

            setRooms(nextRooms);
            if (
              selectedClipboard.type === "room" &&
              selectedClipboard.roomId === room.roomId
            ) {
              if (nextRooms[0]?.roomId) {
                setSelectedClipboard({
                  type: "room",
                  roomId: nextRooms[0].roomId,
                });
              } else {
                setActiveRoomTab("private");
                setSelectedClipboard({ type: "private" });
              }
            }
            toast.success(t("clipboard.notify.room-deleted"));
          })
          .catch(toast.axiosError);
      },
    });
  };

  const loadVisitedRoom = (room: VisitedClipboardRoom) => {
    setActiveRoomTab("visited");
    setSelectedClipboard({ type: "visitedRoom", roomId: room.roomId });
    clipboardService
      .getRoom(room.roomId)
      .then((loadedRoom) => {
        setVisitedRoom(loadedRoom);
        rememberVisitedClipboardRoom(loadedRoom);
        setVisitedRooms(readVisitedClipboardRooms());
      })
      .catch((error) => {
        if (error instanceof AxiosError && error.response?.status === 403) {
          void router.push(`/clipboard/rooms/${room.roomId}`);
          return;
        }
        toast.axiosError(error);
      });
  };

  const addActiveAsset = async (
    asset: Parameters<typeof clipboardService.addMineAsset>[0],
  ) => {
    if (isPrivateSelected) {
      const created = await clipboardService.addMineAsset(asset);
      setPrivateClipboard((current) =>
        current
          ? { ...current, assets: [created, ...current.assets] }
          : current,
      );
      toast.success(t("clipboard.notify.asset-created"));
      return;
    }

    if (!selectedRoom?.roomId) return;
    const created = await clipboardService.addRoomAsset(
      selectedRoom.roomId,
      asset,
    );
    setRooms((current) =>
      current?.map((room) =>
        room.id === selectedRoom.id
          ? { ...room, assets: [created, ...room.assets] }
          : room,
      ),
    );
    toast.success(t("clipboard.notify.asset-created"));
  };

  const addActiveFiles = (assets: Asset[]) => {
    if (isPrivateSelected) {
      setPrivateClipboard((current) =>
        current
          ? { ...current, assets: [...assets, ...current.assets] }
          : current,
      );
      toast.success(t("clipboard.notify.asset-created"));
      return;
    }

    if (!selectedRoom) return;
    setRooms((current) =>
      current?.map((room) =>
        room.id === selectedRoom.id
          ? { ...room, assets: [...assets, ...room.assets] }
          : room,
      ),
    );
    toast.success(t("clipboard.notify.asset-created"));
  };

  const uploadActiveFile = (
    chunk: Blob,
    file: {
      id?: string;
      name: string;
    },
    chunkIndex: number,
    totalChunks: number,
  ) => {
    if (isPrivateSelected) {
      return clipboardService.uploadMineFile(
        chunk,
        file,
        chunkIndex,
        totalChunks,
      );
    }

    return clipboardService.uploadRoomFile(
      selectedRoom?.roomId as string,
      chunk,
      file,
      chunkIndex,
      totalChunks,
    );
  };

  const deleteActiveAsset = async (asset: Asset) => {
    if (isPrivateSelected) {
      await clipboardService.removeMineAsset(asset.id);
      setPrivateClipboard((current) =>
        current
          ? {
              ...current,
              assets: current.assets.filter((item) => item.id !== asset.id),
            }
          : current,
      );
      return;
    }

    if (!selectedRoom?.roomId) return;
    await clipboardService.removeRoomAsset(selectedRoom.roomId, asset.id);
    setRooms((current) =>
      current?.map((room) =>
        room.id === selectedRoom.id
          ? {
              ...room,
              assets: room.assets.filter((item) => item.id !== asset.id),
            }
          : room,
      ),
    );
  };

  const getActiveFileDownloadUrl = (asset: Asset) => {
    if (isPrivateSelected)
      return clipboardService.downloadMineFileUrl(asset.id);
    if (selectedClipboard.type === "visitedRoom") {
      return clipboardService.downloadRoomFileUrl(
        selectedClipboard.roomId,
        asset.id,
      );
    }
    return clipboardService.downloadRoomFileUrl(
      selectedRoom?.roomId as string,
      asset.id,
    );
  };

  const setTab = (value: string | null) => {
    const nextTab = (value || "private") as RoomTab;
    setActiveRoomTab(nextTab);

    if (nextTab === "private") {
      setSelectedClipboard({ type: "private" });
      return;
    }

    if (nextTab === "manage") {
      return;
    }

    if (nextTab === "mine") {
      const currentRoom =
        selectedClipboard.type === "room"
          ? rooms?.find((room) => room.roomId === selectedClipboard.roomId)
          : undefined;
      const nextRoom = currentRoom ?? rooms?.[0];

      if (nextRoom?.roomId) {
        setSelectedClipboard({ type: "room", roomId: nextRoom.roomId });
      }
      return;
    }

    if (nextTab === "visited") {
      const currentVisitedRoom =
        selectedClipboard.type === "visitedRoom"
          ? visitedRooms.find(
              (room) => room.roomId === selectedClipboard.roomId,
            )
          : undefined;
      const nextVisitedRoom = currentVisitedRoom ?? visitedRooms[0];

      if (nextVisitedRoom) {
        loadVisitedRoom(nextVisitedRoom);
      }
    }
  };

  const roomBadge = (room?: Clipboard | VisitedClipboardRoom) =>
    room ? (
      <Badge
        color="gray"
        leftSection={room.hasPasscode ? <TbLock /> : <TbWorld />}
        variant="light"
      >
        {room.hasPasscode
          ? t("clipboard.rooms.protected")
          : t("clipboard.rooms.open")}
      </Badge>
    ) : undefined;

  const renderRoomSummary = (
    room?: Clipboard | VisitedClipboardRoom,
    emptyMessageId = "clipboard.rooms.editor.empty",
  ) =>
    room ? (
      <Group className={classes.roomSummary} gap="sm" wrap="nowrap">
        <div className={classes.roomSummaryText}>
          <Text fw={700} lineClamp={1}>
            {room.name || room.roomId}
          </Text>
          <Text c="dimmed" lineClamp={1} size="sm">
            {room.roomId}
          </Text>
        </div>
        {roomBadge(room)}
      </Group>
    ) : (
      <Text c="dimmed" size="sm">
        <FormattedMessage id={emptyMessageId} />
      </Text>
    );

  const renderRoomActions = (
    room?: Clipboard | VisitedClipboardRoom,
    options: {
      canDelete?: boolean;
      canEdit?: boolean;
      canCreate?: boolean;
    } = {},
  ) => (
    <Group className={classes.roomActions} gap={4} wrap="nowrap">
      {options.canCreate && (
        <HoverTip label={t("clipboard.rooms.create")}>
          <ActionIcon
            aria-label={t("clipboard.rooms.create")}
            color="gray"
            variant="subtle"
            onClick={() => setCreateRoomOpen(true)}
          >
            <TbPlus />
          </ActionIcon>
        </HoverTip>
      )}
      {options.canEdit && (
        <HoverTip label={t("common.button.edit")}>
          <ActionIcon
            aria-label={t("common.button.edit")}
            color="gray"
            disabled={!room || !("assets" in room)}
            variant="subtle"
            onClick={() => {
              if (room && "assets" in room) openEditRoom(room);
            }}
          >
            <TbEdit />
          </ActionIcon>
        </HoverTip>
      )}
      <HoverTip label={t("common.button.copy-link")}>
        <ActionIcon
          aria-label={t("common.button.copy-link")}
          color="gray"
          disabled={!room?.roomId}
          variant="subtle"
          onClick={() => copyRoomLink(room?.roomId as string)}
        >
          <TbLink />
        </ActionIcon>
      </HoverTip>
      <HoverTip label={t("common.text.navigate-to-link")}>
        <ActionIcon
          aria-label={t("common.text.navigate-to-link")}
          color="gray"
          component={Link}
          disabled={!room?.roomId}
          href={`/clipboard/rooms/${room?.roomId ?? ""}`}
          variant="subtle"
        >
          <TbExternalLink />
        </ActionIcon>
      </HoverTip>
      {options.canDelete && room && "assets" in room && (
        <HoverTip label={t("common.button.delete")}>
          <ActionIcon
            aria-label={t("common.button.delete")}
            color="red"
            variant="subtle"
            onClick={() => confirmDeleteRoom(room)}
          >
            <TbTrash />
          </ActionIcon>
        </HoverTip>
      )}
    </Group>
  );

  if (!user) {
    return (
      <>
        <Meta title={t("clipboard.title")} />
        <Title mb={30} order={3}>
          <FormattedMessage id="clipboard.title" />
        </Title>
        <Center style={{ height: "45vh" }}>
          <Stack align="center" gap="sm">
            <Title order={3}>
              <FormattedMessage id="clipboard.auth.title" />
            </Title>
            <Text c="dimmed">
              <FormattedMessage id="clipboard.auth.description" />
            </Text>
            <Button component={Link} href="/auth/signIn">
              <FormattedMessage id="navbar.signin" />
            </Button>
          </Stack>
        </Center>
      </>
    );
  }

  if (!privateClipboard || !rooms) return <CenterLoader />;

  return (
    <>
      <Meta title={t("clipboard.title")} />
      <Title mb={30} order={3}>
        <FormattedMessage id="clipboard.title" />
      </Title>

      <Modal
        centered
        classNames={{
          body: classes.roomModalBody,
          content: classes.roomModalContent,
          header: classes.roomModalHeader,
          title: classes.roomModalTitle,
        }}
        opened={isCreateRoomOpen}
        size="md"
        title={<FormattedMessage id="clipboard.rooms.create.title" />}
        onClose={() => setCreateRoomOpen(false)}
      >
        <form onSubmit={createRoom}>
          <Stack className={classes.roomModalStack}>
            <section className={classes.roomModalSection}>
              <Stack gap="sm">
                <TextInput
                  label={t("clipboard.rooms.name")}
                  {...roomForm.getInputProps("name")}
                />
                <PasswordInput
                  label={t("clipboard.rooms.passcode")}
                  leftSection={<TbKey />}
                  {...roomForm.getInputProps("passcode")}
                />
              </Stack>
            </section>
            <section className={classes.roomModalSection}>
              <AccessControlForm
                value={roomAccessControl}
                onChange={setRoomAccessControl}
                fields={[
                  "expiresAt",
                  "maxViews",
                  "allowDownload",
                  "allowAnonymous",
                  "oneTime",
                ]}
              />
            </section>
            <Group className={classes.roomModalFooter}>
              <Button color="gray" leftSection={<TbPlus />} type="submit">
                <FormattedMessage id="clipboard.rooms.create" />
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        centered
        classNames={{
          body: classes.roomModalBody,
          content: classes.roomModalContent,
          header: classes.roomModalHeader,
          title: classes.roomModalTitle,
        }}
        opened={isEditRoomOpen}
        size="md"
        title={<FormattedMessage id="clipboard.rooms.edit.title" />}
        onClose={() => {
          setEditRoomOpen(false);
          setEditingRoom(undefined);
        }}
      >
        <form onSubmit={updateRoom}>
          <Stack className={classes.roomModalStack}>
            <section className={classes.roomModalSection}>
              <Stack gap="sm">
                <TextInput
                  label={t("clipboard.rooms.name")}
                  {...editRoomForm.getInputProps("name")}
                />
                <PasswordInput
                  description={t("clipboard.rooms.passcode.keep")}
                  disabled={editRoomForm.values.removePasscode}
                  label={t("clipboard.rooms.passcode")}
                  leftSection={<TbKey />}
                  {...editRoomForm.getInputProps("passcode")}
                />
                {editingRoom?.hasPasscode && (
                  <Checkbox
                    label={t("clipboard.rooms.passcode.remove")}
                    {...editRoomForm.getInputProps("removePasscode", {
                      type: "checkbox",
                    })}
                  />
                )}
              </Stack>
            </section>
            <Group className={classes.roomModalFooter}>
              <Button color="gray" leftSection={<TbEdit />} type="submit">
                <FormattedMessage id="common.button.save" />
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <div className={classes.clipboardShell}>
        <Tabs
          className={classes.roomTabs}
          value={activeRoomTab}
          onChange={setTab}
        >
          <Tabs.List className={classes.tabsHeader}>
            <Tabs.Tab leftSection={<TbClipboard />} value="private">
              <FormattedMessage id="clipboard.private.title" />
            </Tabs.Tab>
            <Tabs.Tab leftSection={<TbUsers />} value="mine">
              <FormattedMessage id="clipboard.rooms.title" />
            </Tabs.Tab>
            <Tabs.Tab leftSection={<TbHistory />} value="visited">
              <FormattedMessage id="clipboard.rooms.visited" />
            </Tabs.Tab>
            <Tabs.Tab leftSection={<TbSettings />} value="manage">
              <FormattedMessage id="clipboard.rooms.manage" />
            </Tabs.Tab>
          </Tabs.List>

          <div className={classes.tabBody}>
            <Tabs.Panel value="private">{null}</Tabs.Panel>

            <Tabs.Panel value="mine">
              <div className={classes.roomToolbar}>
                <Select
                  className={classes.roomSelect}
                  data={roomOptions}
                  disabled={roomOptions.length === 0}
                  placeholder={t("clipboard.rooms.select")}
                  value={selectedRoom?.roomId ?? null}
                  onChange={(roomId) => {
                    if (roomId) {
                      setSelectedClipboard({ type: "room", roomId });
                    }
                  }}
                />
                {renderRoomSummary(selectedRoom)}
                {renderRoomActions(selectedRoom, {
                  canCreate: true,
                  canEdit: true,
                })}
              </div>
            </Tabs.Panel>

            <Tabs.Panel value="visited">
              <div className={classes.roomToolbar}>
                <Select
                  className={classes.roomSelect}
                  data={visitedRoomOptions}
                  disabled={visitedRoomOptions.length === 0}
                  placeholder={t("clipboard.rooms.visited")}
                  value={
                    selectedClipboard.type === "visitedRoom"
                      ? selectedClipboard.roomId
                      : null
                  }
                  onChange={(roomId) => {
                    const room = visitedRooms.find(
                      (item) => item.roomId === roomId,
                    );
                    if (room) loadVisitedRoom(room);
                  }}
                />
                {renderRoomSummary(
                  selectedVisitedRoom,
                  "clipboard.rooms.visited.empty",
                )}
                {renderRoomActions(selectedVisitedRoom)}
              </div>
            </Tabs.Panel>

            <Tabs.Panel value="manage">{null}</Tabs.Panel>
          </div>
        </Tabs>

        <main className={classes.content}>
          {activeRoomTab === "manage" ? (
            <section className={classes.roomManagementPanel}>
              <Group
                className={classes.roomManagementHeader}
                justify="space-between"
              >
                <div>
                  <Text fw={700}>
                    <FormattedMessage id="clipboard.rooms.manage" />
                  </Text>
                  <Text c="dimmed" size="sm">
                    {rooms.length}{" "}
                    <FormattedMessage id="clipboard.rooms.count" />
                  </Text>
                </div>
                <Button
                  color="gray"
                  leftSection={<TbPlus />}
                  onClick={() => setCreateRoomOpen(true)}
                >
                  <FormattedMessage id="clipboard.rooms.create" />
                </Button>
              </Group>

              {rooms.length === 0 ? (
                <Center className={classes.roomManagementEmpty}>
                  <Text c="dimmed" size="sm">
                    <FormattedMessage id="clipboard.rooms.empty" />
                  </Text>
                </Center>
              ) : (
                <div
                  className={`${tableClasses.tablePanel} ${classes.roomManagementTablePanel}`}
                >
                  <Table
                    className={`${tableClasses.table} ${classes.roomManagementTable}`}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>
                          <FormattedMessage id="clipboard.rooms.name" />
                        </Table.Th>
                        <Table.Th>
                          <FormattedMessage id="clipboard.rooms.id" />
                        </Table.Th>
                        <Table.Th>
                          <FormattedMessage id="clipboard.rooms.status" />
                        </Table.Th>
                        <Table.Th>
                          <FormattedMessage id="clipboard.rooms.items" />
                        </Table.Th>
                        <Table.Th className={tableClasses.actionCell} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rooms.map((room) => (
                        <Table.Tr
                          className={tableClasses.tableRow}
                          key={room.id}
                        >
                          <Table.Td>
                            <Text fw={500} lineClamp={1}>
                              {room.name || room.roomId}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text c="dimmed" size="sm">
                              {room.roomId}
                            </Text>
                          </Table.Td>
                          <Table.Td>{roomBadge(room)}</Table.Td>
                          <Table.Td>
                            <Text size="sm">{room.assets?.length ?? 0}</Text>
                          </Table.Td>
                          <Table.Td className={tableClasses.actionCell}>
                            <Group
                              className={tableClasses.actions}
                              gap={4}
                              justify="flex-end"
                              wrap="nowrap"
                            >
                              <HoverTip label={t("common.button.edit")}>
                                <ActionIcon
                                  aria-label={t("common.button.edit")}
                                  color="gray"
                                  size="sm"
                                  variant="subtle"
                                  onClick={() => openEditRoom(room)}
                                >
                                  <TbEdit />
                                </ActionIcon>
                              </HoverTip>
                              <HoverTip label={t("common.button.copy-link")}>
                                <ActionIcon
                                  aria-label={t("common.button.copy-link")}
                                  color="gray"
                                  size="sm"
                                  variant="subtle"
                                  onClick={() =>
                                    copyRoomLink(room.roomId as string)
                                  }
                                >
                                  <TbLink />
                                </ActionIcon>
                              </HoverTip>
                              <HoverTip
                                label={t("common.text.navigate-to-link")}
                              >
                                <ActionIcon
                                  aria-label={t("common.text.navigate-to-link")}
                                  color="gray"
                                  component={Link}
                                  href={`/clipboard/rooms/${room.roomId ?? ""}`}
                                  size="sm"
                                  variant="subtle"
                                >
                                  <TbExternalLink />
                                </ActionIcon>
                              </HoverTip>
                              <HoverTip label={t("common.button.delete")}>
                                <ActionIcon
                                  aria-label={t("common.button.delete")}
                                  color="red"
                                  size="sm"
                                  variant="subtle"
                                  onClick={() => confirmDeleteRoom(room)}
                                >
                                  <TbTrash />
                                </ActionIcon>
                              </HoverTip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              )}
            </section>
          ) : activeClipboard ? (
            <ClipboardConversationPanel
              assets={activeClipboard.assets ?? []}
              badge={
                isPrivateSelected ? (
                  <Badge color="gray" leftSection={<TbLock />} variant="light">
                    <FormattedMessage id="clipboard.private.badge" />
                  </Badge>
                ) : selectedClipboard.type === "visitedRoom" ? (
                  roomBadge(visitedRoom)
                ) : (
                  roomBadge(selectedRoom)
                )
              }
              composer={
                canCompose ? (
                  <ClipboardAssetComposer
                    variant="chat"
                    onCreate={addActiveAsset}
                    uploadFile={uploadActiveFile}
                    onFileCreated={addActiveFiles}
                  />
                ) : undefined
              }
              getFileDownloadUrl={getActiveFileDownloadUrl}
              hideHeader={isRoomSelected || isVisitedSelected}
              onDelete={canCompose ? deleteActiveAsset : undefined}
              subtitle={
                isPrivateSelected
                  ? user.email || user.username
                  : activeClipboard.roomId
              }
              title={
                isPrivateSelected
                  ? t("clipboard.private.title")
                  : activeClipboard.name ||
                    activeClipboard.roomId ||
                    t("clipboard.rooms.visited")
              }
            />
          ) : (
            <div className={classes.emptyState}>
              <Text c="dimmed" size="sm">
                <FormattedMessage
                  id={
                    isVisitedWithoutSelection
                      ? "clipboard.rooms.visited.empty"
                      : "clipboard.rooms.editor.empty"
                  }
                />
              </Text>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default ClipboardPage;

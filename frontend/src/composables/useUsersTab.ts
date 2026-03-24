import { ref } from "vue";
import { ElMessage } from "element-plus";
import type { AdminClient, UserListItem } from "../api";

export function useUsersTab(getClient: () => AdminClient) {
  const search = ref("");
  const users = ref<UserListItem[]>([]);
  const syncResult = ref("尚未同步");
  const loadingUsers = ref(false);
  const loadingSyncUsers = ref(false);

  async function fetchUsers() {
    loadingUsers.value = true;
    try {
      const { data } = await getClient().listUsers(search.value);
      users.value = data.users;
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message || "查询用户失败");
    } finally {
      loadingUsers.value = false;
    }
  }

  async function syncUsersFromEmby() {
    loadingSyncUsers.value = true;
    try {
      const { data } = await getClient().syncEmbyUsers();
      syncResult.value = `同步完成: total=${data.total}, created=${data.created}, updated=${data.updated}`;
      ElMessage.success("用户同步成功");
      await fetchUsers();
    } catch (error: any) {
      syncResult.value = `同步失败: ${error?.response?.data?.message || error?.message || "未知错误"}`;
      ElMessage.error("用户同步失败");
    } finally {
      loadingSyncUsers.value = false;
    }
  }

  return {
    search,
    users,
    syncResult,
    loadingUsers,
    loadingSyncUsers,
    fetchUsers,
    syncUsersFromEmby,
  };
}

import PocketBase from 'pocketbase';

const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090';

const pb = new PocketBase(POCKETBASE_URL);

// Persist auth across page reloads
pb.authStore.onChange(() => {}, true);

export default pb;

export const logout = async () => {
  pb.authStore.clear();
};

export const getAccessToken = (): string | null => {
  return pb.authStore.token || null;
};

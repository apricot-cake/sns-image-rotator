import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'X Image Rotator',
    description: 'X (Twitter) の画像をワンクリックで回転',
    permissions: ['contextMenus', 'storage'],
  },
});

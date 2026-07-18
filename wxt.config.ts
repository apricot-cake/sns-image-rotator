import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'X Image Rotator',
    description: 'SNSに流れてくる横向きのイラストを、ワンクリックで縦に戻す拡張機能。',
    permissions: ['contextMenus', 'storage'],
  },
});
